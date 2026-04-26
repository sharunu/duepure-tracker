-- 公開 SECDEF RPC の search_path 固定 + public. 修飾 (Phase 2、11 本)
--
-- 背景: 第 1 ラウンドの 20260426005408_secdef_search_path.sql で is_admin_user / auto_add_opponent_deck /
-- recalculate_opponent_decks / run_daily_opponent_deck_batch / sync_team_membership / normalize_battle_deck_names
-- に SET search_path = '' を入れたが、authenticated に GRANT 想定の他公開 RPC は未対応のままだった。
-- Supabase Security Advisor 系警告と検索パス汚染攻撃面の縮小のため、本 migration で対応する。
--
-- 対象: get_environment_deck_shares / get_environment_deck_shares_range /
--       get_personal_environment_shares_range / get_opponent_deck_suggestions /
--       get_global_my_deck_stats_range / get_global_opponent_deck_stats_range /
--       get_global_deck_detail_stats / get_global_opponent_deck_detail_stats /
--       get_global_turn_order_stats_range / get_deck_trend_range / delete_own_account (11 本)
--
-- 対象外: get_team_member_summaries は 20260424000001 で is_team_member ガード + SET search_path = '' 付きに
-- 改修済のため除外 (古い 20260416 の定義から転記するとガードが消える回帰になる)。
--
-- 書き直し時の注意:
-- - 関数本体ロジックは「最新定義の migration」を起点にコピペし、過去 migration の古い実装を復活させない。
-- - LANGUAGE plpgsql SECURITY DEFINER に SET search_path = '' を追加。
-- - public. プレフィックスでテーブル参照を完全修飾。
-- - delete_own_account は auth.users / auth.uid() を使うため auth. 修飾を維持 (public. に書き換えると壊れる)。
-- - 引数シグネチャ / 返却型は現行最新と完全一致 (CREATE OR REPLACE で書き直し可能な前提)。
-- - GRANT は authenticated に明示再宣言。

-- =============================================================================
-- 1. get_opponent_deck_suggestions (起点: 20260411000001 L16)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_opponent_deck_suggestions(p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, deck_category text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT odm.name AS deck_name, odm.category AS deck_category
  FROM public.opponent_deck_master odm
  WHERE odm.is_active = true AND odm.format = p_format
  ORDER BY odm.sort_order ASC, odm.name ASC;
END;
$$;

-- =============================================================================
-- 2. get_environment_deck_shares (起点: 20260413000001 L248)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_environment_deck_shares(
  p_days integer DEFAULT 7,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.is_guest = false
      AND b.fought_at >= NOW() - (p_days || ' days')::interval
      AND b.format = p_format
    GROUP BY deck
  ),
  total AS (
    SELECT SUM(cnt) AS total_cnt FROM recent
  )
  SELECT
    r.deck AS deck_name,
    r.cnt AS battle_count,
    ROUND(r.cnt * 100.0 / NULLIF(t.total_cnt, 0), 1) AS share_pct
  FROM recent r, total t
  ORDER BY r.cnt DESC;
END;
$$;

-- =============================================================================
-- 3. get_environment_deck_shares_range (起点: 20260413000001 L276)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_environment_deck_shares_range(
  p_start_date date,
  p_end_date date,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.is_guest = false
      AND b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
    GROUP BY deck
  ),
  total AS (
    SELECT SUM(cnt) AS total_cnt FROM recent
  )
  SELECT
    r.deck AS deck_name,
    r.cnt AS battle_count,
    ROUND(r.cnt * 100.0 / NULLIF(t.total_cnt, 0), 1) AS share_pct
  FROM recent r, total t
  ORDER BY r.cnt DESC;
END;
$$;

-- =============================================================================
-- 4. get_personal_environment_shares_range (起点: 20260408000001 L72)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_personal_environment_shares_range(
  p_start_date date,
  p_end_date date,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM public.battles b
    WHERE b.user_id = auth.uid()
      AND b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
    GROUP BY deck
  ),
  total AS (
    SELECT SUM(cnt) AS total_cnt FROM recent
  )
  SELECT
    r.deck AS deck_name,
    r.cnt AS battle_count,
    ROUND(r.cnt * 100.0 / NULLIF(t.total_cnt, 0), 1) AS share_pct
  FROM recent r, total t
  ORDER BY r.cnt DESC;
END;
$$;

-- =============================================================================
-- 5. get_global_my_deck_stats_range (起点: 20260422000001 L31, draws 列対応版)
-- 返却型変更を含むため CREATE OR REPLACE では NG → DROP + CREATE
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_global_my_deck_stats_range(date, date, text, integer);
CREATE FUNCTION public.get_global_my_deck_stats_range(
  p_start_date date,
  p_end_date date,
  p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH battle_data AS (
    SELECT
      b.my_deck_name AS my_deck,
      b.result
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
      AND p.stage <= p_max_stage
      AND p.is_guest = false
  ),
  agg AS (
    SELECT
      my_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'loss') AS l,
      COUNT(*) FILTER (WHERE result = 'draw') AS d,
      COUNT(*) AS t
    FROM battle_data
    GROUP BY my_deck
  )
  SELECT
    a.my_deck AS deck_name,
    a.w AS wins,
    a.l AS losses,
    a.d AS draws,
    a.t AS total,
    CASE WHEN (a.w + a.l) = 0 THEN NULL
         ELSE ROUND(a.w * 100.0 / (a.w + a.l), 0) END AS win_rate
  FROM agg a
  ORDER BY a.t DESC;
END;
$$;

-- =============================================================================
-- 6. get_global_opponent_deck_stats_range (起点: 20260422000001 L78)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_global_opponent_deck_stats_range(date, date, text, integer);
CREATE FUNCTION public.get_global_opponent_deck_stats_range(
  p_start_date date,
  p_end_date date,
  p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH battle_data AS (
    SELECT
      b.opponent_deck_name AS opp_deck,
      b.result
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
      AND p.stage <= p_max_stage
      AND p.is_guest = false
  ),
  agg AS (
    SELECT
      opp_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'loss') AS l,
      COUNT(*) FILTER (WHERE result = 'draw') AS d,
      COUNT(*) AS t
    FROM battle_data
    GROUP BY opp_deck
  )
  SELECT
    a.opp_deck AS deck_name,
    a.w AS wins,
    a.l AS losses,
    a.d AS draws,
    a.t AS total,
    CASE WHEN (a.w + a.l) = 0 THEN NULL
         ELSE ROUND(a.w * 100.0 / (a.w + a.l), 0) END AS win_rate
  FROM agg a
  ORDER BY a.t DESC;
END;
$$;

-- =============================================================================
-- 7. get_global_deck_detail_stats (起点: 20260422000001 L125)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_global_deck_detail_stats(text, text, date, date, integer);
CREATE FUNCTION public.get_global_deck_detail_stats(
  p_deck_name text,
  p_format text DEFAULT 'AD',
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.opponent_deck_name AS opponent_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'loss') AS losses,
    COUNT(*) FILTER (WHERE b.result = 'draw') AS draws,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'first') AS first_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'second') AS second_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_draws,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM public.battles b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.my_deck_name = p_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND p.stage <= p_max_stage
    AND p.is_guest = false
  GROUP BY b.opponent_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$;

-- =============================================================================
-- 8. get_global_opponent_deck_detail_stats (起点: 20260422000001 L173)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_global_opponent_deck_detail_stats(text, text, date, date, integer);
CREATE FUNCTION public.get_global_opponent_deck_detail_stats(
  p_opponent_deck_name text,
  p_format text DEFAULT 'AD',
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.my_deck_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'loss') AS losses,
    COUNT(*) FILTER (WHERE b.result = 'draw') AS draws,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'first') AS first_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'second') AS second_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_draws,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM public.battles b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND p.stage <= p_max_stage
    AND p.is_guest = false
  GROUP BY b.my_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$;

-- =============================================================================
-- 9. get_global_turn_order_stats_range (起点: 20260422000001 L221)
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_global_turn_order_stats_range(date, date, text, integer);
CREATE FUNCTION public.get_global_turn_order_stats_range(
  p_start_date date,
  p_end_date date,
  p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  first_wins bigint, first_losses bigint, first_draws bigint,
  second_wins bigint, second_losses bigint, second_draws bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'first') AS first_draws,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'second') AS second_draws,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_draws
  FROM public.battles b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE b.fought_at >= p_start_date
    AND b.fought_at < p_end_date + interval '1 day'
    AND b.format = p_format
    AND p.stage <= p_max_stage
    AND p.is_guest = false;
END;
$$;

-- =============================================================================
-- 10. get_deck_trend_range (起点: 20260413000001 L207)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_deck_trend_range(
  p_start_date date,
  p_end_date date,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  period_start date, deck_name text, battle_count bigint, share_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH daily AS (
    SELECT
      b.fought_at::date AS d,
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND p.stage <= p_max_stage
      AND (p_user_id IS NOT NULL OR p.is_guest = false)
    GROUP BY d, deck
  ),
  daily_total AS (
    SELECT d, SUM(cnt) AS total_cnt FROM daily GROUP BY d
  )
  SELECT
    dl.d AS period_start,
    dl.deck AS deck_name,
    dl.cnt AS battle_count,
    ROUND(dl.cnt * 100.0 / NULLIF(dt.total_cnt, 0), 1) AS share_pct
  FROM daily dl
  JOIN daily_total dt ON dt.d = dl.d
  ORDER BY dl.d ASC, dl.cnt DESC;
END;
$$;

-- =============================================================================
-- 11. delete_own_account (auth.users / auth.uid() を使うため auth. 修飾は維持)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- =============================================================================
-- 権限再設計 (authenticated に明示 GRANT、PUBLIC / anon から REVOKE)
-- =============================================================================
REVOKE ALL ON FUNCTION public.get_opponent_deck_suggestions(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_environment_deck_shares(integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_environment_deck_shares_range(date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_personal_environment_shares_range(date, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_global_my_deck_stats_range(date, date, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_global_opponent_deck_stats_range(date, date, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_global_deck_detail_stats(text, text, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_global_opponent_deck_detail_stats(text, text, date, date, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_global_turn_order_stats_range(date, date, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_deck_trend_range(date, date, text, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_opponent_deck_suggestions(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_environment_deck_shares(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_environment_deck_shares_range(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_personal_environment_shares_range(date, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_my_deck_stats_range(date, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_opponent_deck_stats_range(date, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_deck_detail_stats(text, text, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_opponent_deck_detail_stats(text, text, date, date, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_turn_order_stats_range(date, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deck_trend_range(date, date, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
