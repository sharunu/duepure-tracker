-- discord_connections: ユーザーとDiscordアカウントの紐付け
CREATE TABLE discord_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  discord_id text NOT NULL UNIQUE,
  discord_username text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- teams: Discordサーバー = チーム
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_guild_id text NOT NULL UNIQUE,
  name text NOT NULL,
  icon_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- team_members: チームメンバーシップ
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  discord_username text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- RLS
ALTER TABLE discord_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- discord_connections: 自分のレコードのみ
CREATE POLICY "Users can read own discord connection"
  ON discord_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own discord connection"
  ON discord_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own discord connection"
  ON discord_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own discord connection"
  ON discord_connections FOR DELETE USING (auth.uid() = user_id);

-- teams: 所属メンバーのみ閲覧可
CREATE POLICY "Team members can read team"
  ON teams FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = id AND tm.user_id = auth.uid())
  );

-- team_members: 同じチームのメンバーのみ閲覧可
CREATE POLICY "Team members can read other members"
  ON team_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid())
  );

-- sync_team_membership: API Routeからservice_roleで呼び出す
CREATE OR REPLACE FUNCTION sync_team_membership(
  p_user_id uuid,
  p_discord_username text,
  p_guilds jsonb
)
RETURNS void AS $$
DECLARE
  g jsonb;
  v_team_id uuid;
BEGIN
  FOR g IN SELECT * FROM jsonb_array_elements(p_guilds) LOOP
    INSERT INTO teams (discord_guild_id, name, icon_url)
    VALUES (g->>'id', g->>'name', g->>'icon')
    ON CONFLICT (discord_guild_id) DO UPDATE SET
      name = EXCLUDED.name,
      icon_url = EXCLUDED.icon_url,
      updated_at = now()
    RETURNING id INTO v_team_id;

    INSERT INTO team_members (team_id, user_id, discord_username)
    VALUES (v_team_id, p_user_id, p_discord_username)
    ON CONFLICT (team_id, user_id) DO UPDATE SET
      discord_username = EXCLUDED.discord_username;
  END LOOP;

  DELETE FROM team_members
  WHERE user_id = p_user_id
    AND team_id NOT IN (
      SELECT t.id FROM teams t
      WHERE t.discord_guild_id IN (SELECT g2->>'id' FROM jsonb_array_elements(p_guilds) g2)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_team_members: チームメンバー一覧取得
CREATE OR REPLACE FUNCTION get_team_members(p_team_id uuid)
RETURNS TABLE (user_id uuid, discord_username text) AS $$
BEGIN
  RETURN QUERY
  SELECT tm.user_id, tm.discord_username
  FROM team_members tm
  WHERE tm.team_id = p_team_id
  ORDER BY tm.joined_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- チーム用: 使用デッキ別統計
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
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id
  ),
  battle_data AS (
    SELECT d.name AS my_deck, b.result
    FROM battles b
    JOIN decks d ON d.id = b.my_deck_id
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

-- チーム用: 対面デッキ別統計
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
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id
  ),
  battle_data AS (
    SELECT
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS opp_deck,
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

-- チーム用: 推移データ
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
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id
  ),
  daily AS (
    SELECT b.fought_at::date AS d,
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS deck,
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
