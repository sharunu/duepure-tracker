-- PR5 (Phase 2 hardening): アクティブデッキ + deck_tunings 同名重複禁止
--
-- race-safe な uniqueness を DB に持つ。Resolved Decision [PR5 dedupe] に従い既存重複を
-- 自動 fix してから UNIQUE expression index を張る (同一トランザクションで実施し race-free)。

-- ========== 1. active decks の同名重複自動 fix ==========
-- 同一 (user_id, game_title, format, lower(trim(name))) のアクティブデッキ群から、
-- 最も古い created_at の 1 件のみを active のまま残し、それ以外を is_archived=true にする。
-- アーカイブ後でも battles の history は my_deck_name snapshot で保持されるので影響なし。
WITH dups AS (
  SELECT
    id,
    user_id,
    game_title,
    format,
    lower(trim(name)) AS lname,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, game_title, format, lower(trim(name))
      ORDER BY created_at ASC, id ASC  -- 最古を keep。tie breaker は id
    ) AS rn
  FROM public.decks
  WHERE is_archived = false
)
UPDATE public.decks
SET is_archived = true
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- ========== 2. deck_tunings の同名重複自動 fix ==========
-- 同一 (deck_id, lower(trim(name))) のチューニング群から、最も古い created_at の 1 件を
-- 残し、それ以外は name に suffix を付けて重複解消する (アーカイブ列が無いため rename 方式)。
--
-- suffix は対象行の id (uuid) 前 8 桁を含めることで既存ユーザー入力名と衝突回避する:
--   - 重複解消対象の各行は uuid 由来でユニーク → 同 deck 内の他行と衝突しない
--   - 16進 8 桁 = 約 43 億通り → 同 deck 内での偶発衝突は実質ゼロ
--
-- 文字数計算 (元 name を 28 字に truncate + ' (重複N_<id8桁>)' 14〜17字):
--   rn=2:    28 + ' (重複2_xxxxxxxx)'    (15字) = 43 字
--   rn=1000: 28 + ' (重複1000_xxxxxxxx)' (18字) = 46 字
-- すべて PR4 の deck_tunings_name_length_check (50 字) 制限内に収まる。
WITH dups AS (
  SELECT
    id,
    deck_id,
    name,
    lower(trim(name)) AS lname,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY deck_id, lower(trim(name))
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.deck_tunings
)
UPDATE public.deck_tunings t
SET name = LEFT(t.name, 28)
        || ' (重複'
        || d.rn::text
        || '_'
        || substr(t.id::text, 1, 8)
        || ')'
FROM dups d
WHERE t.id = d.id AND d.rn > 1;

-- 安全網: dedupe 後も同名重複が残っていないか明示的に確認 (理論上ありえないが、
-- 万一 uuid 8 桁衝突 / ユーザー入力名衝突などで残った場合は migration を中断して
-- 手動 fix に倒す。これにより直後の UNIQUE index 作成失敗を防ぐ)。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.deck_tunings
    GROUP BY deck_id, lower(trim(name))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION '[migration abort] deck_tunings 重複解消後も同名重複が残存しています。staging で手動確認後、suffix 衝突行の name を手で変更してください。';
  END IF;
END $$;

-- ========== 3. unique index 追加 ==========
-- expression index は IMMUTABLE 関数のみ可。lower/trim は IMMUTABLE。
CREATE UNIQUE INDEX IF NOT EXISTS decks_active_name_unique_idx
  ON public.decks (user_id, game_title, format, lower(trim(name)))
  WHERE is_archived = false;

CREATE UNIQUE INDEX IF NOT EXISTS deck_tunings_name_unique_idx
  ON public.deck_tunings (deck_id, lower(trim(name)));
