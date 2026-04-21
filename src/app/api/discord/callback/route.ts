import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@/lib/games";

/**
 * base64url を decode。'-'→'+', '_'→'/', padding を復元。
 * atob が使える Next.js Edge/Node 両ランタイムで動作。
 */
function base64urlDecode(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  try {
    return typeof atob === "function"
      ? atob(b64)
      : Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * state をパース。新形式: base64url(JSON.stringify({ t: token, g: game }))
 * 旧形式（access_token 生文字列）も暫定互換で受け入れる（game は DEFAULT）。
 */
function parseState(state: string): { token: string; game: GameSlug } {
  try {
    const decoded = base64urlDecode(state);
    if (decoded) {
      const parsed = JSON.parse(decoded) as { t?: string; g?: string };
      if (parsed?.t && isGameSlug(parsed.g)) {
        return { token: parsed.t, game: parsed.g };
      }
    }
  } catch {
    // fallthrough to legacy
  }
  // 旧形式: state == access_token
  return { token: state, game: DEFAULT_GAME };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  if (!code || !state) {
    return NextResponse.redirect(new URL("/home?discord=error", origin));
  }

  const { token: accessTokenSupabase, game } = parseState(state);

  try {
    // 1. Discord token 交換
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "",
        client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/discord/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }

    const tokens = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string | null = tokens.refresh_token ?? null;
    const expiresIn: number = tokens.expires_in;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 2. Discord user info
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }
    const discordUser = await userRes.json();
    const discordId: string = discordUser.id;
    const discordUsername: string = discordUser.global_name ?? discordUser.username;

    // 3. Guilds
    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!guildsRes.ok) {
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }
    const guilds = await guildsRes.json();
    const guildData = (guilds as { id: string; name: string; icon: string | null }[]).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
    }));

    // 4. Supabase JWT 検証
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessTokenSupabase);
    if (authError || !user) {
      console.error("Supabase auth failed:", authError);
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }

    // 5. discord_connections UPSERT: onConflict は (user_id, game_title)
    const { error: upsertError } = await supabaseAdmin
      .from("discord_connections")
      .upsert(
        {
          user_id: user.id,
          game_title: game,
          discord_id: discordId,
          discord_username: discordUsername,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,game_title" }
      );

    if (upsertError) {
      console.error("discord_connections upsert error:", upsertError);
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }

    // 6. Team 同期 (p_game_title 付き)
    const { error: syncError } = await supabaseAdmin.rpc("sync_team_membership", {
      p_user_id: user.id,
      p_discord_username: discordUsername,
      p_guilds: guildData,
      p_game_title: game,
    });

    if (syncError) {
      console.error("sync_team_membership error:", syncError);
    }

    return NextResponse.redirect(new URL(`/${game}/home?discord=connected`, origin));
  } catch (err) {
    console.error("Discord callback error:", err);
    return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
  }
}
