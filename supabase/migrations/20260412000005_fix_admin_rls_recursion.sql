-- =============================================
-- Fix: admin RLS self-referencing recursion
-- admin_select_profiles がprofilesテーブル上で
-- profiles自体を参照し無限再帰が発生していた問題を修正
-- =============================================

-- 1. SECURITY DEFINER関数で管理者チェック（RLSをバイパス）
CREATE OR REPLACE FUNCTION is_admin_user() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. 既存の管理者ポリシーを全て削除
DROP POLICY IF EXISTS "admin_select_battles" ON battles;
DROP POLICY IF EXISTS "admin_select_decks" ON decks;
DROP POLICY IF EXISTS "admin_select_deck_tunings" ON deck_tunings;
DROP POLICY IF EXISTS "admin_select_feedback" ON feedback;
DROP POLICY IF EXISTS "admin_select_profiles" ON profiles;

-- 3. SECURITY DEFINER関数を使ったポ���シーを再作成
CREATE POLICY "admin_select_battles" ON battles
  FOR SELECT USING (is_admin_user());

CREATE POLICY "admin_select_decks" ON decks
  FOR SELECT USING (is_admin_user());

CREATE POLICY "admin_select_deck_tunings" ON deck_tunings
  FOR SELECT USING (is_admin_user());

CREATE POLICY "admin_select_feedback" ON feedback
  FOR SELECT USING (is_admin_user());

CREATE POLICY "admin_select_profiles" ON profiles
  FOR SELECT USING (is_admin_user());
