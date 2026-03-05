"use client";

import { useEffect, useState } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import { DeckList } from "./DeckList";
import { BottomNav } from "@/components/layout/BottomNav";

export default function DecksPage() {
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof getDecks>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDecks().then((d) => { setDecks(d); setLoading(false); });
  }, []);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">デッキ管理</h1>
        {loading ? (
          <p className="text-muted-foreground text-sm">読み込み中...</p>
        ) : (
          <DeckList initialDecks={decks} />
        )}
      </div>
      <BottomNav />
    </>
  );
}
