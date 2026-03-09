"use client";

import { useEffect, useState, useCallback } from "react";
import { getRecentBattles, getOpponentDeckSuggestions } from "@/lib/actions/battle-actions";
import { getDecks } from "@/lib/actions/deck-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { BattleHistoryList } from "@/components/battle/BattleHistoryList";
import { BottomNav } from "@/components/layout/BottomNav";

type Deck = { id: string; name: string };

export default function BattlesPage() {
  const { format, setFormat } = useFormat();
  const [battles, setBattles] = useState<Awaited<ReturnType<typeof getRecentBattles>> | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const loadData = useCallback(() => {
    setBattles(null);
    Promise.all([
      getRecentBattles(100, format),
      getDecks(format),
      getOpponentDeckSuggestions(format),
    ]).then(([battlesData, decksData, suggestionsData]) => {
      setBattles(battlesData);
      setDecks(decksData as Deck[]);
      setSuggestions(suggestionsData);
    });
  }, [format]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <h1 className="text-lg font-bold">対戦履歴</h1>
        <FormatSelector format={format} setFormat={setFormat} />
        {battles === null ? (
          <p className="text-muted-foreground text-sm">読み込み中...</p>
        ) : (
          <BattleHistoryList battles={battles} decks={decks} suggestions={suggestions} onRefresh={loadData} />
        )}
      </div>
      <BottomNav />
    </>
  );
}
