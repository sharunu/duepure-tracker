import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateShareId } from "@/lib/share-utils";
import { DEFAULT_GAME, isGameSlug } from "@/lib/games";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { type, data, game: bodyGame } = body;
  const game = isGameSlug(bodyGame) ? bodyGame : DEFAULT_GAME;

  if (!["stats", "deck", "opponent"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const id = generateShareId();
  const { error } = await supabase.from("shares").insert({
    id,
    share_type: type,
    share_data: data,
    user_id: user.id,
    game_title: game,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ id });
}
