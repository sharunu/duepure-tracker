// @ts-nocheck
import { createClient } from "@/lib/supabase/client";

export async function getPersonalStats() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: battles } = await supabase
    .from("battles")
    .select("opponent_deck_name, opponent_deck_normalized, result")
    .eq("user_id", user.id);

  if (!battles || battles.length === 0) return [];

  // Aggregate by opponent deck
  const deckMap = new Map<
    string,
    { wins: number; losses: number; total: number }
  >();

  for (const b of battles) {
    const deckName = b.opponent_deck_normalized ?? b.opponent_deck_name;
    const entry = deckMap.get(deckName) ?? { wins: 0, losses: 0, total: 0 };
    entry.total++;
    if (b.result === "win") entry.wins++;
    else entry.losses++;
    deckMap.set(deckName, entry);
  }

  return Array.from(deckMap.entries())
    .map(([name, stats]) => ({
      deckName: name,
      ...stats,
      winRate: Math.round((stats.wins / stats.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getEnvironmentShares(days = 7) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_environment_deck_shares", {
    p_days: days,
  });

  if (error) return [];
  return (data as { deck_name: string; battle_count: number; share_pct: number }[]) ?? [];
}
