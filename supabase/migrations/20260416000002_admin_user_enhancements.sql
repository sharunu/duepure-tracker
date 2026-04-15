-- ============================================================
-- 管理者ユーザー一覧にXアカウント情報を追加
-- ============================================================

DROP FUNCTION IF EXISTS get_users_for_admin;
CREATE FUNCTION get_users_for_admin()
RETURNS TABLE (
  id uuid,
  display_name text,
  email text,
  is_guest boolean,
  created_at timestamptz,
  battle_count bigint,
  x_username text,
  x_user_id text
) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.display_name,
    u.email::text,
    p.is_guest,
    u.created_at,
    (SELECT COUNT(*) FROM battles b WHERE b.user_id = p.id) AS battle_count,
    p.x_username,
    p.x_user_id
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 管理者用ユーザー詳細情報取得
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_detail_for_admin(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_profile record;
  v_discord record;
  v_teams jsonb;
  v_email text;
  v_provider text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Profile info
  SELECT p.x_username, p.x_user_id INTO v_profile FROM profiles p WHERE p.id = p_user_id;

  -- Discord connection
  SELECT dc.discord_id, dc.discord_username INTO v_discord
  FROM discord_connections dc WHERE dc.user_id = p_user_id;

  -- Teams + members
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'team_id', t.id,
      'team_name', t.name,
      'discord_guild_id', t.discord_guild_id,
      'icon_url', t.icon_url,
      'members', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('user_id', tm2.user_id, 'discord_username', tm2.discord_username)
        ), '[]'::jsonb)
        FROM team_members tm2
        WHERE tm2.team_id = t.id AND tm2.hidden_at IS NULL
      )
    )
  ), '[]'::jsonb)
  INTO v_teams
  FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.user_id = p_user_id;

  -- Auth info
  SELECT u.email::text, COALESCE(u.raw_app_meta_data->>'provider', 'unknown')
  INTO v_email, v_provider
  FROM auth.users u WHERE u.id = p_user_id;

  RETURN jsonb_build_object(
    'x_username', v_profile.x_username,
    'x_user_id', v_profile.x_user_id,
    'discord_id', v_discord.discord_id,
    'discord_username', v_discord.discord_username,
    'teams', v_teams,
    'auth_provider', v_provider,
    'email', v_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
