import { getDecks } from "@/lib/actions/deck-actions";
import { DeckList } from "./DeckList";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function DecksPage() {
  const decks = await getDecks();

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">デッキ管理</h1>
        <DeckList initialDecks={decks} />
      </div>
      <BottomNav />
    </>
  );
}
