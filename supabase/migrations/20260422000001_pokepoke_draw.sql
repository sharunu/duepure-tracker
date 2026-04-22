-- ポケポケ 引き分け (DRAW) 対応
-- 1. battles.result CHECK 制約に 'draw' を追加
-- 2. 統計系 RPC を draws 列追加 + 勝率計算を引き分け除外に変更
--    返却列追加のため CREATE OR REPLACE では失敗する → DROP FUNCTION ... CASCADE → CREATE FUNCTION

-- ========================================================================
-- 1. CHECK 制約差替え（動的検出）
-- ========================================================================
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'battles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%result%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE battles DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE battles
  ADD CONSTRAINT battles_result_check CHECK (result IN ('win','loss','draw'));

-- ========================================================================
-- 2. Global RPC 再定義
-- ========================================================================

-- 2-1. get_global_my_deck_stats_range: draws 列追加、勝率 = wins/(wins+losses)
DROP FUNCTION IF EXISTS get_global_my_deck_stats_range(date, date, text, integer) CASCADE;
CREATE FUNCTION get_global_my_deck_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2-2. get_global_opponent_deck_stats_range
DROP FUNCTION IF EXISTS get_global_opponent_deck_stats_range(date, date, text, integer) CASCADE;
CREATE FUNCTION get_global_opponent_deck_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2-3. get_global_deck_detail_stats
DROP FUNCTION IF EXISTS get_global_deck_detail_stats(text, text, date, date, integer) CASCADE;
CREATE FUNCTION get_global_deck_detail_stats(
  p_deck_name text, p_format text DEFAULT 'AD',
  p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint
)
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

-- 2-4. get_global_opponent_deck_detail_stats
DROP FUNCTION IF EXISTS get_global_opponent_deck_detail_stats(text, text, date, date, integer) CASCADE;
CREATE FUNCTION get_global_opponent_deck_detail_stats(
  p_opponent_deck_name text, p_format text DEFAULT 'AD',
  p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL,
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint
)
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

-- 2-5. get_global_turn_order_stats_range
DROP FUNCTION IF EXISTS get_global_turn_order_stats_range(date, date, text, integer) CASCADE;
CREATE FUNCTION get_global_turn_order_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_max_stage integer DEFAULT 2
)
RETURNS TABLE (
  first_wins bigint, first_losses bigint, first_draws bigint,
  second_wins bigint, second_losses bigint, second_draws bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint
)
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
  FROM battles b
  JOIN profiles p ON p.id = b.user_id
  WHERE b.fought_at >= p_start_date
    AND b.fought_at < p_end_date + interval '1 day'
    AND b.format = p_format
    AND p.stage <= p_max_stage
    AND p.is_guest = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================================
-- 3. Team RPC 再定義
-- ========================================================================

-- 3-1. get_team_my_deck_stats_range
DROP FUNCTION IF EXISTS get_team_my_deck_stats_range(uuid, uuid, date, date, text) CASCADE;
CREATE FUNCTION get_team_my_deck_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  ),
  battle_data AS (
    SELECT b.my_deck_name AS my_deck, b.result
    FROM battles b
    WHERE b.user_id IN (SELECT m.user_id FROM members m)
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
      AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
      AND b.format = p_format
  ),
  agg AS (
    SELECT my_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'loss') AS l,
      COUNT(*) FILTER (WHERE result = 'draw') AS d,
      COUNT(*) AS t
    FROM battle_data GROUP BY my_deck
  )
  SELECT a.my_deck, a.w, a.l, a.d, a.t,
    CASE WHEN (a.w + a.l) = 0 THEN NULL
         ELSE ROUND(a.w * 100.0 / (a.w + a.l), 0) END
  FROM agg a ORDER BY a.t DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-2. get_team_opponent_deck_stats_range
DROP FUNCTION IF EXISTS get_team_opponent_deck_stats_range(uuid, uuid, date, date, text) CASCADE;
CREATE FUNCTION get_team_opponent_deck_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  ),
  battle_data AS (
    SELECT
      b.opponent_deck_name AS opp_deck,
      b.result
    FROM battles b
    WHERE b.user_id IN (SELECT m.user_id FROM members m)
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
      AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
      AND b.format = p_format
  ),
  agg AS (
    SELECT opp_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'loss') AS l,
      COUNT(*) FILTER (WHERE result = 'draw') AS d,
      COUNT(*) AS t
    FROM battle_data GROUP BY opp_deck
  )
  SELECT a.opp_deck, a.w, a.l, a.d, a.t,
    CASE WHEN (a.w + a.l) = 0 THEN NULL
         ELSE ROUND(a.w * 100.0 / (a.w + a.l), 0) END
  FROM agg a ORDER BY a.t DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-3. get_team_deck_detail_stats
DROP FUNCTION IF EXISTS get_team_deck_detail_stats(uuid, text, text, uuid, date, date) CASCADE;
CREATE FUNCTION get_team_deck_detail_stats(
  p_team_id uuid,
  p_deck_name text,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint,
  tuning_name text
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
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
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total,
    COALESCE(b.tuning_name, '指定なし') AS tuning_name
  FROM battles b
  WHERE b.my_deck_name = p_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.opponent_deck_name, COALESCE(b.tuning_name, '指定なし')
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-4. get_team_opponent_deck_detail_stats
DROP FUNCTION IF EXISTS get_team_opponent_deck_detail_stats(uuid, text, text, uuid, date, date) CASCADE;
CREATE FUNCTION get_team_opponent_deck_detail_stats(
  p_team_id uuid,
  p_opponent_deck_name text,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
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
  FROM battles b
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.my_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-5. get_team_turn_order_stats_range
DROP FUNCTION IF EXISTS get_team_turn_order_stats_range(uuid, uuid, date, date, text) CASCADE;
CREATE FUNCTION get_team_turn_order_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  first_wins bigint, first_losses bigint, first_draws bigint,
  second_wins bigint, second_losses bigint, second_draws bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'draw'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'draw'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'draw')
  FROM battles b
  WHERE b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND b.format = p_format;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3-6. get_team_member_summaries
DROP FUNCTION IF EXISTS get_team_member_summaries(uuid) CASCADE;
CREATE FUNCTION get_team_member_summaries(p_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  discord_username text,
  wins bigint,
  losses bigint,
  draws bigint,
  total bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.user_id,
    tm.discord_username,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'win'), 0) AS wins,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'loss'), 0) AS losses,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'draw'), 0) AS draws,
    COALESCE(COUNT(b.id), 0) AS total
  FROM team_members tm
  LEFT JOIN battles b ON b.user_id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND tm.hidden_at IS NULL
  GROUP BY tm.user_id, tm.discord_username
  ORDER BY COALESCE(COUNT(b.id), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
