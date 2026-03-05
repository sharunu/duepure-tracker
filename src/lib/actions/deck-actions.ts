import { createClient } from "@/lib/supabase/client";

export async function getDecks() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("decks")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return data ?? [];
}

export async function createDeck(name: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("decks")
    .insert({ user_id: user.id, name });

  if (error) throw new Error(error.message);
}

export async function updateDeck(id: string, name: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("decks")
    .update({ name })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function archiveDeck(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("decks")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function reorderDecks(deckIds: string[]) {
  const supabase = createClient();
  const updates = deckIds.map((id, index) =>
    supabase.from("decks").update({ sort_order: index }).eq("id", id)
  );
  await Promise.all(updates);
}
