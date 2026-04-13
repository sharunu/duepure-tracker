-- ゲストユーザーの戦績を全体統計から除外する
-- 全てのグローバル系RPCに p.is_guest = false フィルタを追加

-- 1. get_global_my_deck_stats_range
CREATE OR REPLACE FUNCTION get_global_my_deck_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, total bigint, win_rate numeric
)
AS $$
BEGIN
  RETURN QUERY
  WITH battle_data AS (
    SELECT
      b.my_deck_name AS my_deck,
      b.result
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
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
      COUNT(*) AS t
    FROM battle_data
    GROUP BY my_deck
  )
  SELECT
    a.my_deck AS deck_name,
    a.w AS wins,
    a.l AS losses,
    a.t AS total,
    ROUND(a.w * 100.0 / NULLIF(a.t, 0), 0) AS win_rate
  FROM agg a
  ORDER BY a.t DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. get_global_opponent_deck_stats_range
CREATE OR REPLACE FUNCTION get_global_opponent_deck_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, total bigint, win_rate numeric
)
AS $$
BEGIN
  RETURN QUERY
  WITH battle_data AS (
    SELECT
      b.opponent_deck_name AS opp_deck,
      b.result
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
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
      COUNT(*) AS t
    FROM battle_data
    GROUP BY opp_deck
  )
  SELECT
    a.opp_deck AS deck_name,
    a.w AS wins,
    a.l AS losses,
    a.t AS total,
    ROUND(a.w * 100.0 / NULLIF(a.t, 0), 0) AS win_rate
  FROM agg a
  ORDER BY a.t DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. get_global_deck_detail_stats
CREATE OR REPLACE FUNCTION get_global_deck_detail_stats(
  p_deck_name text, p_format text DEFAULT 'AD',
  p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.opponent_deck_name AS opponent_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'loss') AS losses,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM battles b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.my_deck_name = p_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND p.stage <= p_max_stage
    AND p.is_guest = false
  GROUP BY b.opponent_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. get_global_opponent_deck_detail_stats
CREATE OR REPLACE FUNCTION get_global_opponent_deck_detail_stats(
  p_opponent_deck_name text, p_format text DEFAULT 'AD',
  p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.my_deck_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'loss') AS losses,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM battles b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND p.stage <= p_max_stage
    AND p.is_guest = false
  GROUP BY b.my_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. get_global_turn_order_stats_range
CREATE OR REPLACE FUNCTION get_global_turn_order_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  first_wins bigint, first_losses bigint,
  second_wins bigint, second_losses bigint,
  unknown_wins bigint, unknown_losses bigint
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses
  FROM battles b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.fought_at >= p_start_date
    AND b.fought_at < p_end_date + interval '1 day'
    AND b.format = p_format
    AND p.stage <= p_max_stage
    AND p.is_guest = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. get_deck_trend_range (個人モードではゲスト除外しない)
CREATE OR REPLACE FUNCTION get_deck_trend_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  period_start date, deck_name text, battle_count bigint, share_pct numeric
)
AS $$
BEGIN
  RETURN QUERY
  WITH daily AS (
    SELECT
      b.fought_at::date AS d,
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. get_environment_deck_shares (JOIN profiles追加)
CREATE OR REPLACE FUNCTION get_environment_deck_shares(p_days integer DEFAULT 7, p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. get_environment_deck_shares_range (JOIN profiles追加)
CREATE OR REPLACE FUNCTION get_environment_deck_shares_range(p_start_date date, p_end_date date, p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER;