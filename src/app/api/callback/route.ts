import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/lib/cf-env";
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // Supabase access_token

  // Build origin from Host header to avoid 0.0.0.0 in Docker
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const origin = `${protocol}://${host}`;

  if (!code || !state) {
    return NextResponse.redirect(new URL("/home?discord=error", origin));
  }

  try {
    // 1. Exchange code for Discord tokens
    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "",
        client_secret: (await getServerEnv("DISCORD_CLIENT_SECRET")) ?? "",
        grant_type: "authorization_code",
        code,
        redirect_uri: `${origin}/api/discord/callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Discord token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(new URL("/home?discord=error", origin));
    }

    const tokens = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string | null = tokens.refresh_token ?? null;
    const expiresIn: number = tokens.expires_in;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 2. Get Discord user info
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(new URL("/home?discord=error", origin));
    }
    const discordUser = await userRes.json();
    const discordId: string = discordUser.id;
    const discordUsername: string = discordUser.global_name ?? discordUser.username;

    // 3. Get guilds
    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!guildsRes.ok) {
      return NextResponse.redirect(new URL("/home?discord=error", origin));
    }
    const guilds = await guildsRes.json();
    const guildData = (guilds as { id: string; name: string; icon: string | null }[]).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
    }));

    // 4. Verify Supabase JWT from state and get user_id
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (await getServerEnv("SUPABASE_SERVICE_ROLE_KEY"))!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(state);
    if (authError || !user) {
      console.error("Supabase auth failed:", authError);
      return NextResponse.redirect(new URL("/home?discord=error", origin));
    }

    // 5. Upsert discord_connections
    const { error: upsertError } = await supabaseAdmin
      .from("discord_connections")
      .upsert(
        {
          user_id: user.id,
          discord_id: discordId,
          discord_username: discordUsername,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("discord_connections upsert error:", upsertError);
      return NextResponse.redirect(new URL("/home?discord=error", origin));
    }

    // 6. Sync team membership
    const { error: syncError } = await supabaseAdmin.rpc("sync_team_membership", {
      p_user_id: user.id,
      p_discord_username: discordUsername,
      p_guilds: guildData,
    });

    if (syncError) {
      console.error("sync_team_membership error:", syncError);
    }

    return NextResponse.redirect(new URL("/home?discord=connected", origin));
  } catch (err) {
    console.error("Discord callback error:", err);
    return NextResponse.redirect(new URL("/home?discord=error", origin));
  }
}
