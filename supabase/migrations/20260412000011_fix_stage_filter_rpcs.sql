-- Fix: Phase2マイグレーションが削除済みカラム opponent_deck_normalized を参照し、
-- スナップショット方式 (b.my_deck_name) を JOIN decks に先祖返りさせていた問題を修正

-- Drop current (broken) versions
DROP FUNCTION IF EXISTS get_deck_trend_range(date, date, text, uuid, integer);
DROP FUNCTION IF EXISTS get_global_deck_detail_stats(text, text, date, date, integer);
DROP FUNCTION IF EXISTS get_global_opponent_deck_detail_stats(text, text, date, date, integer);
DROP FUNCTION IF EXISTS get_global_my_deck_stats_range(date, date, text, integer);

-- 1. get_deck_trend_range: opponent_deck_normalized → opponent_deck_name
CREATE FUNCTION get_deck_trend_range(
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

-- 2. get_global_deck_detail_stats: opponent_deck_normalized → opponent_deck_name, JOIN decks → b.my_deck_name
CREATE FUNCTION get_global_deck_detail_stats(
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
  GROUP BY b.opponent_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. get_global_opponent_deck_detail_stats: opponent_deck_normalized → opponent_deck_name, JOIN decks → b.my_deck_name
CREATE FUNCTION get_global_opponent_deck_detail_stats(
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
  GROUP BY b.my_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. get_global_my_deck_stats_range: JOIN decks → b.my_deck_name
CREATE FUNCTION get_global_my_deck_stats_range(
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
