-- battles RLS の強化と my_deck_name / tuning_name の正規化 trigger を導入する。
--
-- 背景: 旧 policy は `auth.uid() = user_id` だけで、my_deck_id が他人のデッキでも、
-- format / game_title が decks 側と不整合でも、tuning_id が my_deck_id 配下でなくても通っていた。
-- 環境統計を任意データで汚染できる経路があったため、書き込み時の整合性検証を DB 側で強制する。
--
-- 変更点:
-- 1. FOR ALL の単一 policy を SELECT / INSERT / UPDATE / DELETE に分割し、
--    USING (読取・削除) は所有者一致のみ、WITH CHECK (書込) で deck 所有 / format / game_title /
--    tuning_id 整合を強検証する。
-- 2. BEFORE INSERT OR UPDATE トリガで my_deck_name / tuning_name を decks / deck_tunings から正規化。
--    ID が変わらない UPDATE では OLD 値に書き戻し、過去戦績のスナップショットを保持しつつ
--    直叩き UPDATE での名前改ざんを塞ぐ。
--
-- ⚠️ 適用前 preflight (Supabase Studio で実行し不整合 0 件を確認):
--   SELECT count(*) FROM public.battles b
--   JOIN public.decks d ON d.id = b.my_deck_id
--   WHERE d.format <> b.format OR d.game_title <> b.game_title OR d.user_id <> b.user_id;
--
--   SELECT count(*) FROM public.battles b
--   JOIN public.deck_tunings t ON t.id = b.tuning_id
--   WHERE t.deck_id <> b.my_deck_id;
--
-- 1 件以上ある場合は、本 migration の前に修復 SQL を流すか、本 migration の先頭に追加する。

-- ---------- 1. RLS policy 分離 + 強化 ----------
DROP POLICY IF EXISTS "Users can manage own battles" ON public.battles;
DROP POLICY IF EXISTS "Users can read own battles"   ON public.battles;
DROP POLICY IF EXISTS "Users can delete own battles" ON public.battles;
DROP POLICY IF EXISTS "Users can insert own battles" ON public.battles;
DROP POLICY IF EXISTS "Users can update own battles" ON public.battles;

CREATE POLICY "Users can read own battles"
  ON public.battles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own battles"
  ON public.battles FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own battles"
  ON public.battles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = battles.my_deck_id
        AND d.user_id = auth.uid()
        AND d.format = battles.format
        AND d.game_title = battles.game_title
    )
    AND (
      battles.tuning_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.deck_tunings t
        WHERE t.id = battles.tuning_id
          AND t.deck_id = battles.my_deck_id
      )
    )
  );

CREATE POLICY "Users can update own battles"
  ON public.battles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.decks d
      WHERE d.id = battles.my_deck_id
        AND d.user_id = auth.uid()
        AND d.format = battles.format
        AND d.game_title = battles.game_title
    )
    AND (
      battles.tuning_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.deck_tunings t
        WHERE t.id = battles.tuning_id
          AND t.deck_id = battles.my_deck_id
      )
    )
  );

-- ---------- 2. my_deck_name / tuning_name 正規化 trigger ----------
CREATE OR REPLACE FUNCTION public.normalize_battle_deck_names()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
  -- ID も tuning_id も変わらない UPDATE では OLD のスナップショット名を保持
  -- (RETURN NEW のままだと、ID 不変で my_deck_name だけ直接 UPDATE する改ざんが通ってしまう)
  IF TG_OP = 'UPDATE'
     AND NEW.my_deck_id IS NOT DISTINCT FROM OLD.my_deck_id
     AND NEW.tuning_id  IS NOT DISTINCT FROM OLD.tuning_id THEN
    NEW.my_deck_name := OLD.my_deck_name;
    NEW.tuning_name  := OLD.tuning_name;
    RETURN NEW;
  END IF;

  SELECT name INTO NEW.my_deck_name FROM public.decks WHERE id = NEW.my_deck_id;
  IF NEW.tuning_id IS NOT NULL THEN
    SELECT name INTO NEW.tuning_name FROM public.deck_tunings WHERE id = NEW.tuning_id;
  ELSE
    NEW.tuning_name := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- trigger 経由でのみ呼ばれる関数。直 EXECUTE は禁止
REVOKE EXECUTE ON FUNCTION public.normalize_battle_deck_names() FROM PUBLIC;

DROP TRIGGER IF EXISTS battles_normalize_deck_names ON public.battles;
CREATE TRIGGER battles_normalize_deck_names
BEFORE INSERT OR UPDATE ON public.battles
FOR EACH ROW EXECUTE FUNCTION public.normalize_battle_deck_names();
