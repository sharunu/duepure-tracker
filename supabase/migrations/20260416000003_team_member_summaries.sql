-- チームメンバー別の勝敗サマリーを取得するRPC
CREATE OR REPLACE FUNCTION get_team_member_summaries(p_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  discord_username text,
  wins bigint,
  losses bigint,
  total bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tm.user_id,
    tm.discord_username,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'win'), 0) AS wins,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'loss'), 0) AS losses,
    COALESCE(COUNT(b.id), 0) AS total
  FROM team_members tm
  LEFT JOIN battles b ON b.user_id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND tm.hidden_at IS NULL
  GROUP BY tm.user_id, tm.discord_username
  ORDER BY COALESCE(COUNT(b.id), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
