-- decks の RLS 強化 + battles 側 EXISTS による深層防御
--
-- 背景: 既存 decks RLS は `auth.uid() = user_id` のみで、format / game_title の組合せ整合性が
-- DB 側で強制されていなかった。`game_title='pokepoke', format='ND'` のような不整合 deck と
-- battle を作ると dm 側の ND 統計に混ざる経路があった。
--
-- 採用方針: opponent_deck_settings(format, game_title) UNIQUE (20260419000001 で seed 済み:
-- dm/AD, dm/ND, pokepoke/RANKED, pokepoke/RANDOM) を正規ソースとし、
-- decks INSERT/UPDATE と battles INSERT/UPDATE で EXISTS で確認する深層防御。
-- FK ではなく EXISTS 採用 (FK は新ゲーム seed 順序で migration がハマる可能性あり、運用柔軟性優先)。
--
-- battles 側は第 1 ラウンドの 20260426005407_strengthen_battles_rls.sql で
--   - auth.uid() = user_id
--   - decks 所有 + format/game_title 一致
--   - tuning_id IS NULL OR deck_tunings 配下
-- が入っている。本 migration ではこれら全てを維持しつつ、opponent_deck_settings EXISTS を追加する。
--
-- ⚠️ db push 前の preflight (Studio で 0 件確認、ユーザー指示待ち):
--   SELECT count(*) FROM public.decks d
--   LEFT JOIN public.opponent_deck_settings s
--     ON s.format = d.format AND s.game_title = d.game_title
--   WHERE s.format IS NULL;
--
--   SELECT count(*) FROM public.battles b
--   LEFT JOIN public.opponent_deck_settings s
--     ON s.format = b.format AND s.game_title = b.game_title
--   WHERE s.format IS NULL;
-- → 1 件以上なら修復 SQL を本ファイル先頭に追加してから適用。

-- ---------- 1. decks RLS 強化 (USING / WITH CHECK 分離 + EXISTS) ----------
DROP POLICY IF EXISTS "Users can manage own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can read own decks"   ON public.decks;
DROP POLICY IF EXISTS "Users can delete own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can insert own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can update own decks" ON public.decks;

CREATE POLICY "Users can read own decks"
  ON public.decks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own decks"
  ON public.decks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own decks"
  ON public.decks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.opponent_deck_settings s
      WHERE s.format = decks.format
        AND s.game_title = decks.game_title
    )
  );

CREATE POLICY "Users can update own decks"
  ON public.decks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.opponent_deck_settings s
      WHERE s.format = decks.format
        AND s.game_title = decks.game_title
    )
  );

-- ---------- 2. battles 側に opponent_deck_settings EXISTS を追加 (深層防御) ----------
-- 第 1 ラウンドの policy を DROP/CREATE で書き直し、既存検証 + 新規 EXISTS の両方を維持する。
DROP POLICY IF EXISTS "Users can insert own battles" ON public.battles;
DROP POLICY IF EXISTS "Users can update own battles" ON public.battles;

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
    AND EXISTS (
      SELECT 1 FROM public.opponent_deck_settings s
      WHERE s.format = battles.format
        AND s.game_title = battles.game_title
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
    AND EXISTS (
      SELECT 1 FROM public.opponent_deck_settings s
      WHERE s.format = battles.format
        AND s.game_title = battles.game_title
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

-- 第 1 ラウンドで作成済の SELECT/DELETE policy + normalize_battle_deck_names trigger は
-- そのまま維持される (本 migration では touch しない)。
