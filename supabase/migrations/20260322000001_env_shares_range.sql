-- New function with date range parameters (keeps existing p_days version intact)
CREATE OR REPLACE FUNCTION get_environment_deck_shares_range(p_start_date date, p_end_date date, p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS deck,
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
