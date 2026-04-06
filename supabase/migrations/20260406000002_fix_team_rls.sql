-- Fix infinite recursion in team_members and teams RLS policies
-- The original policies referenced team_members within team_members SELECT policy,
-- causing PostgreSQL error 42P17.

-- Drop existing problematic policies
DROP POLICY "Team members can read other members" ON team_members;
DROP POLICY "Team members can read team" ON teams;

-- Helper function: check if user belongs to a team (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- New policy for team_members: can read members of teams you belong to
CREATE POLICY "Team members can read team members"
  ON team_members FOR SELECT USING (
    is_team_member(team_id, auth.uid())
  );

-- New policy for teams: can read teams you belong to
CREATE POLICY "Team members can read team"
  ON teams FOR SELECT USING (
    is_team_member(id, auth.uid())
  );
