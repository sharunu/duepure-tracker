import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_GAME, isGameSlug, type GameSlug } from "@/lib/games";

import { getServerEnv } from "@/lib/cf-env";

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
 * 旧形式 state パース（base64url JSON + 最古の raw access_token fallback）。
 * 新方式（UUID nonce + discord_oauth_states）に移行済みだが、デプロイ直前に authorize を
 * 開始したユーザーの in-flight OAuth を破壊しないため暫定継続。
 * TODO: Phase 2 完了後 1 週間以上経過した別 PR で削除予定。
 */
function parseLegacyState(state: string): { token: string; game: GameSlug } {
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
  return { token: state, game: DEFAULT_GAME };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (await getServerEnv("SUPABASE_SERVICE_ROLE_KEY"))!,
  );

  // 1. state を解析してユーザー特定
  let userId: string;
  let game: GameSlug;

  if (UUID_RE.test(state)) {
    // 新方式: discord_oauth_states から atomic consume（DELETE ... RETURNING）
    // 同一 nonce が並列 callback に来ても片方しか成功しない
    const { data, error } = await supabaseAdmin
      .from("discord_oauth_states")
      .delete()
      .eq("nonce", state)
      .gte("expires_at", new Date().toISOString())
      .select("user_id, game_title")
      .maybeSingle();

    if (error || !data) {
      console.error("discord_oauth_states consume failed:", error);
      return NextResponse.redirect(new URL(`/${DEFAULT_GAME}/home?discord=error`, origin));
    }
    userId = data.user_id;
    game = isGameSlug(data.game_title) ? data.game_title : DEFAULT_GAME;
  } else {
    // 旧方式: state に Supabase access_token が埋め込まれている（in-flight 救済）
    const legacy = parseLegacyState(state);
    game = legacy.game;
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(legacy.token);
    if (authError || !user) {
      console.error("legacy state auth failed:", authError);
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }
    userId = user.id;
  }

  try {
    // 2. Discord token 交換
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
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }

    const tokens = await tokenRes.json();
    const accessToken: string = tokens.access_token;
    const refreshToken: string | null = tokens.refresh_token ?? null;
    const expiresIn: number = tokens.expires_in;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3. Discord user info
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(new URL(`/${game}/home?discord=error`, origin));
    }
    const discordUser = await userRes.json();
    const discordId: string = discordUser.id;
    const discordUsername: string = discordUser.global_name ?? discordUser.username;

    // 4. Guilds
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

    // 5. discord_connections UPSERT: onConflict は (user_id, game_title)
    const { error: upsertError } = await supabaseAdmin
      .from("discord_connections")
      .upsert(
        {
          user_id: userId,
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
      p_user_id: userId,
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
