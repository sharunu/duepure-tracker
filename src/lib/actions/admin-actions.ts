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

  if (!(profile as { is_admin?: boolean })?.is_admin) throw new Error("Not authorized");
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

  return (profile as { is_admin?: boolean })?.is_admin ?? false;
}

export async function getOpponentDeckMasterList() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("opponent_deck_master")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addOpponentDeck(name: string) {
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
  });

  if (error) throw new Error(error.message);
}

export async function updateOpponentDeck(
  id: string,
  updates: { name?: string; is_active?: boolean }
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
