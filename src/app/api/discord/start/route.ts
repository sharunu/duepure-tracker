import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isGameSlug } from "@/lib/games";
import { getServerEnv } from "@/lib/cf-env";

export async function POST(request: NextRequest) {
  try {
    // 1. body の game 検証
    let bodyGame: unknown;
    try {
      const body = await request.json();
      bodyGame = (body as { game?: unknown })?.game;
    } catch {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }
    if (typeof bodyGame !== "string" || !isGameSlug(bodyGame)) {
      return NextResponse.json({ error: "invalid game" }, { status: 400 });
    }
    const game = bodyGame;

    // 2. Authorization: Bearer <jwt> で Supabase ユーザー検証
    const authHeader = request.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    if (!jwt) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (await getServerEnv("SUPABASE_SERVICE_ROLE_KEY"))!,
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 3. opportunistic cleanup（期限切れ nonce を削除）
    await supabaseAdmin
      .from("discord_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    // 4. nonce 生成 + INSERT
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("discord_oauth_states")
      .insert({ user_id: user.id, game_title: game })
      .select("nonce")
      .single();

    if (insertError || !inserted) {
      console.error("discord_oauth_states insert error:", insertError);
      return NextResponse.json({ error: "state creation failed" }, { status: 500 });
    }

    // 5. origin はリクエスト由来（NEXT_PUBLIC_APP_URL は本番固定のため preview で事故る）
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "discord client id not configured" }, { status: 500 });
    }
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "https";
    const origin = `${protocol}://${host}`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}/api/discord/callback`,
      response_type: "code",
      scope: "identify guilds",
      state: inserted.nonce,
    });

    const authorizeUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
    return NextResponse.json({ authorizeUrl });
  } catch (err) {
    console.error("discord/start error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
