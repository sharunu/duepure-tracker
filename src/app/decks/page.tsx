"use client";

import { useEffect, useState } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import { getOpponentDeckSuggestions } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DeckList } from "./DeckList";
import { BottomNav } from "@/components/layout/BottomNav";

export default function DecksPage() {
  const { format, setFormat } = useFormat();
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof getDecks>>>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getDecks(format), getOpponentDeckSuggestions(format)]).then(
      ([d, s]) => {
        setDecks(d);
        setSuggestions([...s.major, ...s.other]);
        setLoading(false);
      }
    );
  }, [format]);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">使用デッキ管理</h1>
        <div className="mb-4">
          <FormatSelector format={format} setFormat={setFormat} />
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">読み込み中...</p>
        ) : (
          <DeckList initialDecks={decks} format={format} suggestions={suggestions} />
        )}
      </div>
      <BottomNav />
    </>
  );
}
