-- チーム用: 先攻/後攻別統計（RLSバイパス）
CREATE OR REPLACE FUNCTION get_team_turn_order_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  first_wins bigint, first_losses bigint,
  second_wins bigint, second_losses bigint,
  unknown_wins bigint, unknown_losses bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'loss')
  FROM battles b
  WHERE b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND b.format = p_format;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
