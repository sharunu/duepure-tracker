-- 1a: team_membersにhidden_atカラム追加
ALTER TABLE team_members ADD COLUMN hidden_at timestamptz DEFAULT NULL;

-- 1b: RLSポリシー追加（自分のメンバーシップの更新・削除を許可）
CREATE POLICY "Users can update own membership"
  ON team_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own membership"
  ON team_members FOR DELETE USING (user_id = auth.uid());

-- 1c: 全チーム系RPC更新（hidden_at IS NULLフィルタ追加）

-- get_team_members: チームメンバー一覧取得（非表示メンバーを除外）
CREATE OR REPLACE FUNCTION get_team_members(p_team_id uuid)
RETURNS TABLE (user_id uuid, discord_username text) AS $$
BEGIN
  RETURN QUERY
  SELECT tm.user_id, tm.discord_username
  FROM team_members tm
  WHERE tm.team_id = p_team_id
    AND tm.hidden_at IS NULL
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
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
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
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
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
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
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

-- チーム用: 使用デッキ詳細
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
    COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS opponent_name,
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
  GROUP BY COALESCE(b.opponent_deck_normalized, b.opponent_deck_name), COALESCE(dt.name, '指定なし')
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- チーム用: 対面デッキ詳細
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
  WHERE COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) = p_opponent_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY d.name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
