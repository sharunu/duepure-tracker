-- ============================================================
-- 管理者ユーザー一覧に stage / auth_provider を追加
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
  x_user_id text,
  stage integer,
  auth_provider text
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
    p.x_user_id,
    p.stage,
    COALESCE(u.raw_app_meta_data->>'provider', 'unknown')::text AS auth_provider
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- feedback テーブルに status カラムを追加
-- ============================================================

ALTER TABLE feedback
  ADD COLUMN status text NOT NULL DEFAULT 'pending',
  ADD CONSTRAINT feedback_status_check CHECK (status IN ('pending', 'resolved'));

CREATE INDEX idx_feedback_status_created_at ON feedback(status, created_at DESC);

-- ============================================================
-- フィードバック status 更新 RPC (管理者専用)
-- ============================================================

CREATE OR REPLACE FUNCTION update_feedback_status(
  p_feedback_id uuid,
  p_status text
) RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_status NOT IN ('pending', 'resolved') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;
  UPDATE feedback SET status = p_status WHERE id = p_feedback_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
