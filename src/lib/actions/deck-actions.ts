import { createClient } from "@/lib/supabase/client";

export async function getDecks(format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("decks")
    .select("*, deck_tunings(id, name, sort_order)")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .eq("format", format)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  // Sort tunings within each deck
  return (data ?? []).map((d) => ({
    ...d,
    deck_tunings: (d.deck_tunings ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function createDeck(name: string, format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", name)
    .eq("format", format)
    .eq("is_archived", false)
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error("同じ名前のデッキが既に登録されています");
  }

  const { data, error } = await supabase
    .from("decks")
    .insert({ user_id: user.id, name, format })
    .select("*, deck_tunings(id, name, sort_order)")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateDeck(id: string, name: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: deck } = await supabase.from("decks").select("format").eq("id", id).single();
  if (!deck) throw new Error("Deck not found");

  const { data: dup } = await supabase
    .from("decks")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", name)
    .eq("format", deck.format)
    .eq("is_archived", false)
    .neq("id", id)
    .limit(1);

  if (dup && dup.length > 0) {
    throw new Error("同じ名前のデッキが既に登録されています");
  }

  const { error } = await supabase.from("decks").update({ name }).eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function archiveDeck(id: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("decks")
    .update({ is_archived: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
}

export async function reorderDecks(deckIds: string[]) {
  const supabase = createClient();
  const updates = deckIds.map((id, index) =>
    supabase.from("decks").update({ sort_order: index }).eq("id", id)
  );
  await Promise.all(updates);
}

export async function createTuning(deckId: string, name: string) {
  const supabase = createClient();

  const { data: dup } = await supabase
    .from("deck_tunings")
    .select("id")
    .eq("deck_id", deckId)
    .eq("name", name)
    .limit(1);

  if (dup && dup.length > 0) {
    throw new Error("同じ名前のチューニングが既に登録されています");
  }

  // Get max sort_order for this deck
  const { data: existing } = await supabase
    .from("deck_tunings")
    .select("sort_order")
    .eq("deck_id", deckId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("deck_tunings")
    .insert({ deck_id: deckId, name, sort_order: nextOrder })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateTuning(id: string, name: string) {
  const supabase = createClient();

  const { data: current } = await supabase.from("deck_tunings").select("deck_id").eq("id", id).single();
  if (!current) throw new Error("Tuning not found");

  const { data: dup } = await supabase
    .from("deck_tunings")
    .select("id")
    .eq("deck_id", current.deck_id)
    .eq("name", name)
    .neq("id", id)
    .limit(1);

  if (dup && dup.length > 0) {
    throw new Error("同じ名前のチューニングが既に登録されています");
  }

  const { error } = await supabase.from("deck_tunings").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTuning(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("deck_tunings")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
