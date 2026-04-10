import { createClient } from "@/lib/supabase/client";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Not authorized");
  return supabase;
}

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ?? false;
}

export async function getOpponentDeckMasterList(format?: string) {
  const supabase = await requireAdmin();
  let query = supabase
    .from("opponent_deck_master")
    .select("*");

  if (format) {
    query = query.eq("format", format);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addOpponentDeck(name: string, format: string = "ND", category: string = "major") {
  const supabase = await requireAdmin();

  const { data: maxOrder } = await supabase
    .from("opponent_deck_master")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("opponent_deck_master").insert({
    name: name.trim(),
    sort_order: nextOrder,
    format,
    category,
  });

  if (error) throw new Error(error.message);
}

export async function updateOpponentDeck(
  id: string,
  updates: { name?: string; is_active?: boolean; category?: string; admin_bonus_count?: number }
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_master")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteOpponentDeck(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_master")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// === 設定関連 ===

export async function getOpponentDeckSettings(format: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("opponent_deck_settings")
    .select("*")
    .eq("format", format)
    .single();
  return data;
}

export async function updateOpponentDeckSettings(
  format: string,
  updates: {
    management_mode?: string;
    major_threshold?: number;
    minor_threshold?: number;
    usage_period_days?: number;
    disable_period_days?: number;
  }
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("format", format);
  if (error) throw new Error(error.message);
}

// === 即時再計算 ===

export async function recalculateOpponentDecks(format: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("recalculate_opponent_decks", {
    p_format: format,
  });
  if (error) throw new Error(error.message);
}

// === 並べ替え（モード1用） ===

export async function reorderOpponentDecks(deckIds: string[]) {
  const supabase = await requireAdmin();
  const updates = deckIds.map((id, index) =>
    supabase.from("opponent_deck_master").update({ sort_order: index }).eq("id", id)
  );
  await Promise.all(updates);
}

// === admin_bonus_count 更新 ===

export async function updateAdminBonusCount(id: string, count: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_master")
    .update({ admin_bonus_count: count })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// === モード2用: デッキ一覧+統計取得 ===

export async function getOpponentDeckStatsForAdmin(format: string) {
  const supabase = await requireAdmin();

  const { data: settings } = await supabase
    .from("opponent_deck_settings")
    .select("*")
    .eq("format", format)
    .single();

  const usagePeriod = settings?.usage_period_days ?? 14;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - usagePeriod);

  const { data: decks } = await supabase
    .from("opponent_deck_master")
    .select("*")
    .eq("format", format)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const { data: battles } = await supabase
    .from("battles")
    .select("opponent_deck_name")
    .eq("format", format)
    .gte("fought_at", startDate.toISOString());

  const battleCounts: Record<string, number> = {};
  let totalBattles = 0;
  for (const b of battles ?? []) {
    battleCounts[b.opponent_deck_name] = (battleCounts[b.opponent_deck_name] ?? 0) + 1;
    totalBattles++;
  }

  const totalBonus = (decks ?? [])
    .filter(d => d.is_active)
    .reduce((sum: number, d: { admin_bonus_count: number }) => sum + (d.admin_bonus_count ?? 0), 0);
  const denominator = totalBattles + totalBonus;

  return {
    decks: (decks ?? []).map((d: { name: string; admin_bonus_count: number; is_active: boolean; [key: string]: unknown }) => ({
      ...d,
      battle_count: battleCounts[d.name] ?? 0,
      usage_rate: denominator > 0
        ? ((battleCounts[d.name] ?? 0) + (d.admin_bonus_count ?? 0)) * 100 / denominator
        : 0,
    })),
    totalBattles,
    totalBonus,
    denominator,
  };
}
