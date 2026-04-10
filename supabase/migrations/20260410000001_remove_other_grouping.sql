-- 全体統計の対面デッキ円グラフで「その他」グルーピングを廃止し、個人統計と同様に全デッキ個別表示にする
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
      b.opponent_deck_name AS opp_deck,
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
