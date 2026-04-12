-- Step 1-1: カラム追加
ALTER TABLE battles
  ADD COLUMN my_deck_name text,
  ADD COLUMN tuning_name text;

-- Step 1-2: 既存データのバックフィル
UPDATE battles b
SET my_deck_name = d.name
FROM decks d
WHERE d.id = b.my_deck_id;

UPDATE battles b
SET tuning_name = dt.name
FROM deck_tunings dt
WHERE dt.id = b.tuning_id;

-- バックフィル後にNOT NULL制約を追加
ALTER TABLE battles ALTER COLUMN my_deck_name SET NOT NULL;

-- Step 1-3: RPC関数の書き換え

-- get_global_my_deck_stats_range: JOINを削除し、b.my_deck_nameを直接参照
CREATE OR REPLACE FUNCTION get_global_my_deck_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, total bigint, win_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH battle_data AS (
    SELECT
      b.my_deck_name AS my_deck,
      b.result
    FROM battles b
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
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

-- get_global_deck_detail_stats: JOINを削除し、b.my_deck_nameを直接参照
CREATE OR REPLACE FUNCTION get_global_deck_detail_stats(
  p_deck_name text, p_format text DEFAULT 'AD', p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
) AS $$
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
  WHERE b.my_deck_name = p_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.opponent_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_global_opponent_deck_detail_stats: d.name → b.my_deck_name
CREATE OR REPLACE FUNCTION get_global_opponent_deck_detail_stats(
  p_opponent_deck_name text, p_format text DEFAULT 'AD', p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
) AS $$
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
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.my_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_my_deck_stats_range: JOINを削除し、b.my_deck_nameを直接参照
CREATE OR REPLACE FUNCTION get_team_my_deck_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, total bigint, win_rate numeric
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
      COUNT(*) AS t
    FROM battle_data GROUP BY my_deck
  )
  SELECT a.my_deck, a.w, a.l, a.t,
    ROUND(a.w * 100.0 / NULLIF(a.t, 0), 0)
  FROM agg a ORDER BY a.t DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_deck_detail_stats: JOIN decks/deck_tunings → b.my_deck_name/b.tuning_name
CREATE OR REPLACE FUNCTION get_team_deck_detail_stats(
  p_team_id uuid,
  p_deck_name text,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint,
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
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
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

-- get_team_opponent_deck_detail_stats: d.name → b.my_deck_name
CREATE OR REPLACE FUNCTION get_team_opponent_deck_detail_stats(
  p_team_id uuid,
  p_opponent_deck_name text,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
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
