export const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "";
export const DISCORD_REDIRECT_URI =
  (process.env.NEXT_PUBLIC_APP_URL ?? "http://54.152.11.99:3000") +
  "/api/discord/callback";
export const DISCORD_SCOPES = "identify guilds";

export function getDiscordAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: DISCORD_SCOPES,
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
