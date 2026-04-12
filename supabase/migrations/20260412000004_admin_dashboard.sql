-- =============================================
-- Admin Dashboard: RLS policies + RPC
-- =============================================

-- battles: 管理者は全ユーザーの戦績を閲覧可能
CREATE POLICY "admin_select_battles" ON battles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- decks: 管理者は全ユーザーのデッキを閲覧可能
CREATE POLICY "admin_select_decks" ON decks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- deck_tunings: 管理者は全ユーザーの構築を閲覧可能
CREATE POLICY "admin_select_deck_tunings" ON deck_tunings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- feedback: 管理者は全フィードバックを閲覧可能
CREATE POLICY "admin_select_feedback" ON feedback
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- profiles: 管理者は全ユーザーのプロフィールを閲覧可能
CREATE POLICY "admin_select_profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =============================================
-- ユーザー一覧RPC (SECURITY DEFINER)
-- =============================================
CREATE OR REPLACE FUNCTION get_users_for_admin()
RETURNS TABLE (
  id uuid,
  display_name text,
  email text,
  is_guest boolean,
  created_at timestamptz,
  battle_count bigint
) AS $$
BEGIN
  -- SECURITY DEFINERのため内部で管理者チェック必須
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
    (SELECT COUNT(*) FROM battles b WHERE b.user_id = p.id) AS battle_count
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
