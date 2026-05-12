-- PR9 Phase 9a (Phase 2 hardening): shares 保存期間管理 + app_settings 一般設定
--
-- migration 内訳:
--   1. app_settings table (汎用 key-value 設定、admin-only)
--   2. validate_app_settings trigger (share_retention_days の jsonb number / 1〜3650 強制)
--   3. share_retention_days 初期値 90 投入
--   4. shares.expires_at column 追加 + backfill + NOT NULL + CHECK (>= created_at)
--   5. shares.image_path column 追加 + image_url からバックフィル
--   6. derive_image_path_from_url BEFORE INSERT/UPDATE trigger (Phase 9b 反映前の orphan 防止)
--   7. set_shares_expires_at BEFORE INSERT trigger (新規 share の expires_at 自動補完)
--   8. shares_expires_at_idx
--   9. recalc_shares_expires_at_on_retention_change AFTER trigger (retention 追従更新)
--   10. list_expired_shares() RPC (service_role 限定、image_url も返却で fallback 用)
--
-- Phase 9b でこの DB 上にコード切替 (ShareModal image_path INSERT / Bearer JWT helper /
-- /api/admin/settings / /api/admin/share-cleanup / /admin/general-settings page) を行う。

-- ===== 1. app_settings table =====
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- admin のみ read/write (authenticated_read は不要、設定値は admin 専用)
CREATE POLICY app_settings_admin_all ON public.app_settings
  FOR ALL USING ((SELECT public.is_admin_user())) WITH CHECK ((SELECT public.is_admin_user()));

-- 防御的に anon/authenticated の table grant を REVOKE
REVOKE ALL ON public.app_settings FROM anon, authenticated;

-- service_role API route (9-E /api/admin/settings) から SELECT/INSERT/UPDATE が必要なので明示 grant
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO service_role;

-- ===== 2. share_retention_days validation trigger =====
CREATE OR REPLACE FUNCTION public.validate_app_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.key = 'share_retention_days' THEN
    -- jsonb 型が number でないとエラー (例: '"90"'::jsonb は string なので reject)
    IF jsonb_typeof(NEW.value) <> 'number' THEN
      RAISE EXCEPTION 'share_retention_days は jsonb number 型で指定してください。実際の型: %', jsonb_typeof(NEW.value);
    END IF;
    BEGIN
      v_days := (NEW.value#>>'{}')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'share_retention_days を integer に変換できません: %', NEW.value;
    END;
    IF v_days < 1 OR v_days > 3650 THEN
      RAISE EXCEPTION 'share_retention_days は 1〜3650 の範囲で指定してください。実際: %', v_days;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validate_app_settings() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS app_settings_validate ON public.app_settings;
CREATE TRIGGER app_settings_validate
BEFORE INSERT OR UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.validate_app_settings();

-- ===== 3. 初期値 90 (validate trigger を通過することで型/範囲もスモークテスト) =====
INSERT INTO public.app_settings (key, value, description)
VALUES ('share_retention_days', '90', '共有データと共有画像を保持する日数。1〜3650 の整数。期限到達後は admin 一般設定画面の手動ボタンで削除する (公開初期方針)。')
ON CONFLICT (key) DO NOTHING;

-- ===== 4. shares.expires_at 追加 + backfill + NOT NULL + CHECK =====
ALTER TABLE public.shares
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 既存 shares の expires_at を初期化 (90 日固定、retention 設定値ではなく定数で OK)
UPDATE public.shares
SET expires_at = created_at + interval '90 days'
WHERE expires_at IS NULL;

-- backfill 漏れ防御
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shares WHERE expires_at IS NULL) THEN
    RAISE EXCEPTION '[migration abort] shares.expires_at が backfill 後も NULL の行が残っています。手動で確認してください。';
  END IF;
END $$;

ALTER TABLE public.shares
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.shares
  ADD CONSTRAINT shares_expires_at_after_created_at_check
  CHECK (expires_at >= created_at);

-- ===== 5. shares.image_path 追加 + バックフィル =====
-- Storage 削除時に image_url の URL 解析を避けるため、画像作成時に Storage 上のパスを直接保存
ALTER TABLE public.shares
  ADD COLUMN IF NOT EXISTS image_path text;

-- 既存 image_url がある share の image_path を URL から抽出してバックフィル
UPDATE public.shares
SET image_path = split_part(image_url, '/storage/v1/object/public/share-images/', 2)
WHERE image_url IS NOT NULL
  AND image_path IS NULL
  AND image_url LIKE '%/storage/v1/object/public/share-images/%';

-- ※ バックフィル後の image_url NOT NULL かつ image_path NULL の残行は staging で
--    `SELECT count(*) FROM public.shares WHERE image_url IS NOT NULL AND image_path IS NULL` で確認

-- ===== 6. derive_image_path_from_url BEFORE INSERT/UPDATE trigger =====
-- Phase 9a 適用後 / Phase 9b 反映前は旧 ShareModal が image_url のみ INSERT する時間帯あり。
-- この間の orphan 化 (Storage path 不明) を防ぐため、INSERT/UPDATE 時に image_url から
-- path を自動補完する trigger を入れる (image_path が NULL のときのみ)。
CREATE OR REPLACE FUNCTION public.derive_image_path_from_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_path text;
BEGIN
  IF NEW.image_path IS NULL
     AND NEW.image_url IS NOT NULL
     AND NEW.image_url LIKE '%/storage/v1/object/public/share-images/%' THEN
    v_path := split_part(NEW.image_url, '/storage/v1/object/public/share-images/', 2);
    -- 空文字 / '/' 等の不正値はスキップ (cleanup 側で image_url fallback で救済)
    IF v_path IS NOT NULL AND v_path <> '' AND v_path <> '/' THEN
      NEW.image_path := v_path;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.derive_image_path_from_url() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS shares_derive_image_path ON public.shares;
CREATE TRIGGER shares_derive_image_path
BEFORE INSERT OR UPDATE ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.derive_image_path_from_url();

-- ===== 7. set_shares_expires_at BEFORE INSERT trigger =====
-- 新規 share INSERT 時に expires_at を app_settings の share_retention_days で自動補完
CREATE OR REPLACE FUNCTION public.set_shares_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_days integer;
BEGIN
  SELECT (value#>>'{}')::integer INTO v_days
  FROM public.app_settings
  WHERE key = 'share_retention_days';
  IF v_days IS NULL THEN v_days := 90; END IF;
  NEW.expires_at := COALESCE(NEW.expires_at, NEW.created_at + (v_days || ' days')::interval);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_shares_expires_at() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS shares_set_expires_at ON public.shares;
CREATE TRIGGER shares_set_expires_at
BEFORE INSERT ON public.shares
FOR EACH ROW EXECUTE FUNCTION public.set_shares_expires_at();

-- ===== 8. shares_expires_at_idx =====
CREATE INDEX IF NOT EXISTS shares_expires_at_idx ON public.shares(expires_at);

-- ===== 9. recalc_shares_expires_at_on_retention_change AFTER trigger =====
-- retention 変更時に既存 shares の expires_at を追従更新 (Resolved Decision [PR9 retention])
CREATE OR REPLACE FUNCTION public.recalc_shares_expires_at_on_retention_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.key <> 'share_retention_days' THEN RETURN NEW; END IF;
  v_days := (NEW.value#>>'{}')::integer;
  IF v_days IS NULL THEN RETURN NEW; END IF;
  UPDATE public.shares
     SET expires_at = created_at + (v_days || ' days')::interval;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.recalc_shares_expires_at_on_retention_change() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS app_settings_recalc_shares_expires_at ON public.app_settings;
CREATE TRIGGER app_settings_recalc_shares_expires_at
AFTER INSERT OR UPDATE ON public.app_settings
FOR EACH ROW WHEN (NEW.key = 'share_retention_days')
EXECUTE FUNCTION public.recalc_shares_expires_at_on_retention_change();

-- ===== 10. list_expired_shares RPC (service_role 限定) =====
-- cleanup API route から呼ばれる。image_path を一次キーとして使うが、Phase 9a 直後 /
-- trigger LIKE 不一致時の image_path NULL + image_url NOT NULL の行を fallback 抽出するため
-- image_url も同時に返す。
CREATE OR REPLACE FUNCTION public.list_expired_shares()
RETURNS TABLE(id text, user_id uuid, image_path text, image_url text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.user_id, s.image_path, s.image_url
  FROM public.shares s
  WHERE s.expires_at IS NOT NULL AND s.expires_at < now();
$$;
REVOKE EXECUTE ON FUNCTION public.list_expired_shares() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_expired_shares() TO service_role;
