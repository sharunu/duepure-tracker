-- Phase 1: 正規化/投票機能の削除

-- 3a. 正規化専用RPC関数の削除
DROP FUNCTION IF EXISTS submit_normalization_vote(uuid, text);
DROP FUNCTION IF EXISTS get_pending_vote_for_user();

-- 3b. 正規化テーブルの削除（FK順）
DROP TABLE IF EXISTS normalization_votes;
DROP TABLE IF EXISTS deck_name_candidates;
DROP TABLE IF EXISTS normalization_results;

-- 3c. カラム削除
ALTER TABLE battles DROP COLUMN IF EXISTS opponent_deck_normalized;
ALTER TABLE decks DROP COLUMN IF EXISTS normalized_name;

-- 3d. 既存RPC関数の再作成（COALESCE除去）

-- get_environment_deck_shares
CREATE OR REPLACE FUNCTION get_environment_deck_shares(p_days integer DEFAULT 7, p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    WHERE b.fought_at >= NOW() - (p_days || ' days')::interval
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

-- get_environment_deck_shares_range
CREATE OR REPLACE FUNCTION get_environment_deck_shares_range(p_start_date date, p_end_date date, p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    WHERE b.fought_at >= p_start_date
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

-- get_personal_environment_shares_range
CREATE OR REPLACE FUNCTION get_personal_environment_shares_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD'
)
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_global_opponent_deck_stats_range
CREATE OR REPLACE FUNCTION get_global_opponent_deck_stats_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, total bigint, win_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH battle_data AS (
    SELECT
      CASE
        WHEN EXISTS (
          SELECT 1 FROM opponent_deck_master odm
          WHERE odm.name = b.opponent_deck_name
            AND odm.format = p_format
            AND odm.category = 'major'
        ) THEN b.opponent_deck_name
        ELSE 'その他'
      END AS opp_deck,
      b.result
    FROM battles b
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
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

-- get_deck_trend_range
CREATE OR REPLACE FUNCTION get_deck_trend_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  period_start date, deck_name text, battle_count bigint, share_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH daily AS (
    SELECT
      b.fought_at::date AS d,
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
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

-- get_global_deck_detail_stats
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
  JOIN decks d ON d.id = b.my_deck_id
  WHERE d.name = p_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.opponent_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_global_opponent_deck_detail_stats
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
    d.name AS my_deck_name,
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
  JOIN decks d ON d.id = b.my_deck_id
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY d.name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_opponent_deck_stats_range
CREATE OR REPLACE FUNCTION get_team_opponent_deck_stats_range(
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
      COUNT(*) AS t
    FROM battle_data GROUP BY opp_deck
  )
  SELECT a.opp_deck, a.w, a.l, a.t,
    ROUND(a.w * 100.0 / NULLIF(a.t, 0), 0)
  FROM agg a ORDER BY a.t DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_deck_trend_range
CREATE OR REPLACE FUNCTION get_team_deck_trend_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  period_start date, deck_name text, battle_count bigint, share_pct numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  ),
  daily AS (
    SELECT b.fought_at::date AS d,
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM battles b
    WHERE b.user_id IN (SELECT m.user_id FROM members m)
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
      AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
      AND b.format = p_format
    GROUP BY d, deck
  ),
  daily_total AS (
    SELECT d, SUM(cnt) AS total_cnt FROM daily GROUP BY d
  )
  SELECT dl.d, dl.deck, dl.cnt,
    ROUND(dl.cnt * 100.0 / NULLIF(dt.total_cnt, 0), 1)
  FROM daily dl JOIN daily_total dt ON dt.d = dl.d
  ORDER BY dl.d ASC, dl.cnt DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_deck_detail_stats
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
    COALESCE(dt.name, '指定なし') AS tuning_name
  FROM battles b
  JOIN decks d ON d.id = b.my_deck_id
  LEFT JOIN deck_tunings dt ON dt.id = b.tuning_id
  WHERE d.name = p_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.opponent_deck_name, COALESCE(dt.name, '指定なし')
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_opponent_deck_detail_stats
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
    d.name AS my_deck_name,
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
  JOIN decks d ON d.id = b.my_deck_id
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY d.name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
