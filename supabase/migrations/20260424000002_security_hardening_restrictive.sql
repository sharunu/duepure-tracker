-- Phase 2: profiles の直 UPDATE を完全閉塞し share-images 旧 policy を削除する破壊的 migration
--
-- 適用状況: 2026-04-24 に本番 DB に適用済み (`supabase migration list` で remote にも記録あり)。
-- 過去のコメントでは supabase/pending/ に保管とされていたが、実体は当初から migrations/ にあり db push で適用された。
-- 履歴として残す目的でリポジトリに保持。`DROP POLICY IF EXISTS` 等で冪等に書かれているため再適用も安全。
--
-- 当時の適用条件チェックリスト (記録用):
--   - Phase 1 コードが main に merge 済み、Cloudflare 本番デプロイ済み
--   - 本番で display_name 更新 / X 連携 link+unlink / stage 更新 / auth/callback での X 連携自動同期 /
--     共有画像アップロード（{userId}/{shareId}.png パス）が全て RPC 経由で成功している
--   - information_schema.role_table_grants で profiles の UPDATE 付与が service_role 以外に残っていない

-- 1. profiles の本人 UPDATE policy を削除し UPDATE 権限も revoke
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 防御的に PUBLIC からも revoke（Supabase 既定では通常 PUBLIC 付与はないが、
-- 万一 PUBLIC に UPDATE が残ると authenticated/anon への revoke が無効化されるため）
REVOKE UPDATE ON public.profiles FROM PUBLIC, authenticated, anon;

-- 2. share-images の bucket_id だけで絞る旧 policy を削除
DROP POLICY IF EXISTS "Authenticated users can upload share images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update share images" ON storage.objects;

-- ロールバック用 SQL（必要になった場合に手動で流す）:
--   GRANT UPDATE ON public.profiles TO authenticated;
--   CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
--   CREATE POLICY "Authenticated users can upload share images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'share-images');
--   CREATE POLICY "Authenticated users can update share images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'share-images');
