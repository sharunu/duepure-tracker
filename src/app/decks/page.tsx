"use client";

import { useEffect, useState } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import { getOpponentDeckSuggestions } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DeckList } from "./DeckList";
import { BottomNav } from "@/components/layout/BottomNav";

export default function DecksPage() {
  const { format, setFormat, ready } = useFormat();
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof getDecks>>>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    setLoading(true);
    Promise.all([getDecks(format), getOpponentDeckSuggestions(format)]).then(
      ([d, s]) => {
        setDecks(d);
        setSuggestions([...s.major, ...s.other]);
        setLoading(false);
      }
    );
  }, [format, ready]);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">使用デッキ管理</h1>
          <div className={!ready ? "invisible" : ""}>
            <FormatSelector format={format} setFormat={setFormat} />
          </div>
        </div>
        {(!ready || loading) ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <DeckList initialDecks={decks} format={format} suggestions={suggestions} />
        )}
      </div>
      <BottomNav />
    </>
  );
}
