"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function recordBattle(formData: {
  myDeckId: string;
  opponentDeckName: string;
  result: "win" | "loss";
  turnOrder: "first" | "second" | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check normalization cache
  const { data: normResult } = await supabase
    .from("normalization_results")
    .select("canonical_name")
    .eq("raw_name", formData.opponentDeckName)
    .single();

  const { error } = await supabase.from("battles").insert({
    user_id: user.id,
    my_deck_id: formData.myDeckId,
    opponent_deck_name: formData.opponentDeckName,
    opponent_deck_normalized: normResult?.canonical_name ?? null,
    result: formData.result,
    turn_order: formData.turnOrder,
  });

  if (error) throw new Error(error.message);

  // Auto-create normalization candidate for new deck names
  await maybeCreateNormalizationCandidate(supabase, formData.opponentDeckName);

  revalidatePath("/battle");
}

async function maybeCreateNormalizationCandidate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rawName: string
) {
  // Check if already normalized
  const { data: existing } = await supabase
    .from("normalization_results")
    .select("raw_name")
    .eq("raw_name", rawName)
    .single();

  if (existing) return;

  // Get top deck suggestions to compare against
  const { data: suggestions } = await supabase.rpc(
    "get_opponent_deck_suggestions"
  );
  if (!suggestions || suggestions.length === 0) return;

  // Check if this name is already a top deck
  const topNames = suggestions.map(
    (s: { deck_name: string }) => s.deck_name
  );
  if (topNames.includes(rawName)) return;

  // Find the most similar deck name (simple substring match)
  for (const topName of topNames) {
    // Check if already a candidate
    const { data: candidateExists } = await supabase
      .from("deck_name_candidates")
      .select("id")
      .eq("raw_name", rawName)
      .eq("compare_to", topName)
      .single();

    if (candidateExists) continue;

    // Simple similarity: check if names share significant characters
    const rawLower = rawName.toLowerCase();
    const topLower = topName.toLowerCase();
    if (
      rawLower.includes(topLower) ||
      topLower.includes(rawLower) ||
      levenshteinDistance(rawLower, topLower) <= 3
    ) {
      await supabase.from("deck_name_candidates").insert({
        raw_name: rawName,
        compare_to: topName,
      });
      break;
    }
  }
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export async function getRecentBattles(limit = 50) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("battles")
    .select("*, decks(name)")
    .eq("user_id", user.id)
    .order("fought_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getOpponentDeckSuggestions() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_opponent_deck_suggestions");
  return (data as { deck_name: string }[] | null)?.map((d) => d.deck_name) ?? [];
}

export async function getMiniStats() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: battles } = await supabase
    .from("battles")
    .select("result, fought_at")
    .eq("user_id", user.id)
    .order("fought_at", { ascending: false })
    .limit(50);

  if (!battles || battles.length === 0) return null;

  const wins = battles.filter((b) => b.result === "win").length;
  const total = battles.length;

  // Win streak (current)
  let streak = 0;
  for (const b of battles) {
    if (b.result === "win") streak++;
    else break;
  }

  // Win rate trend (groups of 5)
  const trend: { index: number; winRate: number }[] = [];
  for (let i = 0; i < Math.min(battles.length, 50); i += 5) {
    const chunk = battles.slice(i, i + 5);
    const chunkWins = chunk.filter((b) => b.result === "win").length;
    trend.unshift({
      index: trend.length,
      winRate: Math.round((chunkWins / chunk.length) * 100),
    });
  }

  return { wins, losses: total - wins, total, streak, trend };
}
