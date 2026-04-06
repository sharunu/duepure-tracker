import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();
    if (!accessToken) {
      return NextResponse.json({ error: "missing accessToken" }, { status: 400 });
    }

    // Verify user via Supabase JWT in Authorization header
    const authHeader = request.headers.get("authorization");
    const jwt = authHeader?.replace("Bearer ", "");
    if (!jwt) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Get discord connection to retrieve discord username
    const { data: conn } = await supabaseAdmin
      .from("discord_connections")
      .select("discord_username, access_token")
      .eq("user_id", user.id)
      .single();

    if (!conn) {
      return NextResponse.json({ error: "no discord connection" }, { status: 404 });
    }

    // Fetch guilds from Discord
    const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });

    if (!guildsRes.ok) {
      return NextResponse.json({ error: "discord api error" }, { status: 502 });
    }

    const guilds = await guildsRes.json();
    const guildData = (guilds as { id: string; name: string; icon: string | null }[]).map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
    }));

    // Sync
    const { error: syncError } = await supabaseAdmin.rpc("sync_team_membership", {
      p_user_id: user.id,
      p_discord_username: conn.discord_username,
      p_guilds: guildData,
    });

    if (syncError) {
      console.error("sync error:", syncError);
      return NextResponse.json({ error: "sync failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, guildCount: guildData.length });
  } catch (err) {
    console.error("refresh-guilds error:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
