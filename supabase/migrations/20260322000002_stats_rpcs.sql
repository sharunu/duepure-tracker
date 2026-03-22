-- 1a. Personal environment shares (filtered by auth.uid())
CREATE OR REPLACE FUNCTION get_personal_environment_shares_range(
  p_start_date date, p_end_date date, p_format text DEFAULT 'AD'
)
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS deck,
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

-- 1b-1. Global my-deck stats
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
      d.name AS my_deck,
      b.result
    FROM battles b
    JOIN decks d ON d.id = b.my_deck_id
    WHERE b.fought_at >= p_start_date
      AND b.fought_at < p_end_date + interval '1 day'
      AND b.format = p_format
  ),
  agg AS (
    SELECT
      my_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'lose') AS l,
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

-- 1b-2. Global opponent-deck stats (non-major -> その他)
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
          WHERE odm.name = COALESCE(b.opponent_deck_normalized, b.opponent_deck_name)
            AND odm.format = p_format
            AND odm.category = 'major'
        ) THEN COALESCE(b.opponent_deck_normalized, b.opponent_deck_name)
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
      COUNT(*) FILTER (WHERE result = 'lose') AS l,
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

-- 1c. Deck trend (daily opponent deck share)
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
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS deck,
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
