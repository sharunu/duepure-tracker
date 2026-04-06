import { createClient } from "@/lib/supabase/client";

export type DiscordConnection = {
  id: string;
  discord_id: string;
  discord_username: string;
};

export type Team = {
  id: string;
  discord_guild_id: string;
  name: string;
  icon_url: string | null;
};

export type TeamMember = {
  user_id: string;
  discord_username: string;
};

export async function getDiscordConnection(): Promise<DiscordConnection | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("discord_connections")
    .select("id, discord_id, discord_username")
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function getMyTeams(): Promise<Team[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) return [];

  const teamIds = memberships.map((m) => m.team_id);
  const { data: teams } = await supabase
    .from("teams")
    .select("id, discord_guild_id, name, icon_url")
    .in("id", teamIds)
    .order("name");

  return teams ?? [];
}

export async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_team_members", {
    p_team_id: teamId,
  });

  if (error) return [];
  return (data as TeamMember[]) ?? [];
}

export async function disconnectDiscord(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from("discord_connections")
    .delete()
    .eq("user_id", user.id);

  return !error;
}
