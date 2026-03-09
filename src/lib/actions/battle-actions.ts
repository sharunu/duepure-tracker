// @ts-nocheck
import { createClient } from "@/lib/supabase/client";

export async function recordBattle(formData: {
  myDeckId: string;
  opponentDeckName: string;
  result: "win" | "loss";
  turnOrder: "first" | "second" | null;
  format: string;
}) {
  const supabase = createClient();
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
    format: formData.format,
  });

  if (error) throw new Error(error.message);

  // Auto-create normalization candidate for new deck names
  await maybeCreateNormalizationCandidate(supabase, formData.opponentDeckName);
}

async function maybeCreateNormalizationCandidate(
  supabase: ReturnType<typeof createClient>,
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

export async function updateBattle(
  id: string,
  fields: {
    opponentDeckName?: string;
    result?: "win" | "loss";
    turnOrder?: "first" | "second" | null;
    myDeckId?: string;
  }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const updateData: Record<string, unknown> = {};
  if (fields.result !== undefined) updateData.result = fields.result;
  if (fields.turnOrder !== undefined) updateData.turn_order = fields.turnOrder;
  if (fields.opponentDeckName !== undefined) {
    updateData.opponent_deck_name = fields.opponentDeckName;
    const { data: normResult } = await supabase
      .from("normalization_results")
      .select("canonical_name")
      .eq("raw_name", fields.opponentDeckName)
      .single();
    updateData.opponent_deck_normalized = normResult?.canonical_name ?? null;
  }

  if (fields.myDeckId !== undefined) updateData.my_deck_id = fields.myDeckId;

  const { error } = await supabase
    .from("battles")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function deleteBattle(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("battles")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function getRecentBattles(limit = 50, format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("battles")
    .select("*, decks(name)")
    .eq("user_id", user.id)
    .eq("format", format)
    .order("fought_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function getOpponentDeckSuggestions(format: string = "ND") {
  const supabase = createClient();
  const { data } = await supabase.rpc("get_opponent_deck_suggestions", {
    p_format: format,
  });
  const rows = (data as { deck_name: string; deck_category: string }[] | null) ?? [];
  return {
    major: rows.filter(r => r.deck_category === "major").map(r => r.deck_name),
    other: rows.filter(r => r.deck_category === "other").map(r => r.deck_name),
  };
}

export async function getMiniStats(format: string = "ND", sinceTimestamp?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from("battles")
    .select("result, fought_at")
    .eq("user_id", user.id)
    .eq("format", format)
    .order("fought_at", { ascending: false });

  if (sinceTimestamp) {
    query = query.gte("fought_at", sinceTimestamp);
  }

  const { data: battles } = await query;

  if (!battles || battles.length === 0) return null;

  const wins = battles.filter((b) => b.result === "win").length;
  const total = battles.length;

  // Win streak (current)
  let streak = 0;
  for (const b of battles) {
    if (b.result === "win") streak++;
    else break;
  }

  return { wins, losses: total - wins, total, streak };
}

export async function getAllBattles(format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("battles")
    .select("id, opponent_deck_name, result, fought_at, decks(name)")
    .eq("user_id", user.id)
    .eq("format", format)
    .order("fought_at", { ascending: false });

  return data ?? [];
}

export async function getBattlesByDateRange(format: string, startDate: string, endDate: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const endPlusOne = new Date(endDate);
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const { data } = await supabase
    .from("battles")
    .select("*, decks(name)")
    .eq("user_id", user.id)
    .eq("format", format)
    .gte("fought_at", startDate)
    .lt("fought_at", endPlusOne.toISOString().split("T")[0])
    .order("fought_at", { ascending: false });
  return data ?? [];
}

export async function getDailyBattleCounts(format: string, year: number, month: number) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
  const endDate = nextMonth.toISOString().split("T")[0];
  const { data } = await supabase
    .from("battles")
    .select("fought_at")
    .eq("user_id", user.id)
    .eq("format", format)
    .gte("fought_at", startDate)
    .lt("fought_at", endDate);
  const counts: Record<string, number> = {};
  for (const b of (data ?? [])) {
    const day = new Date(b.fought_at).toLocaleDateString("sv-SE");
    counts[day] = (counts[day] || 0) + 1;
  }
  return counts;
}
