"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getBattlesByDateRange, getDailyBattleCounts, getOpponentDeckSuggestions } from "@/lib/actions/battle-actions";
import { getDecks } from "@/lib/actions/deck-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { DeckFilter } from "@/components/battle/DeckFilter";
import { BattleHistoryList } from "@/components/battle/BattleHistoryList";
import { BottomNav } from "@/components/layout/BottomNav";

type Deck = { id: string; name: string };
type Battle = {
  id: string;
  my_deck_id: string;
  opponent_deck_name: string;
  result: "win" | "loss";
  turn_order: "first" | "second" | null;
  fought_at: string;
  decks: { name: string } | null;
};

export default function BattlesPage() {
  const { format, setFormat } = useFormat();
  const [pageLoading, setPageLoading] = useState(true);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString("sv-SE");
  });
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  const loadBattles = useCallback(() => {
    Promise.all([
      getBattlesByDateRange(format, startDate, endDate),
      getDecks(format),
      getOpponentDeckSuggestions(format),
    ]).then(([battlesData, decksData, suggestionsData]) => {
      setBattles(battlesData as Battle[]);
      setDecks(decksData as Deck[]);
      setSuggestions([...suggestionsData.major, ...suggestionsData.other]);
      setPageLoading(false);
    });
  }, [format, startDate, endDate]);

  const loadCounts = useCallback((year: number, month: number) => {
    getDailyBattleCounts(format, year, month).then(setBattleCounts);
  }, [format]);

  useEffect(() => {
    loadBattles();
  }, [loadBattles]);

  // Load counts for the current month on mount and format change
  useEffect(() => {
    const now = new Date();
    loadCounts(now.getFullYear(), now.getMonth() + 1);
  }, [loadCounts]);

  // Reset deck filter when format changes
  useEffect(() => {
    setSelectedDeck(null);
  }, [format]);

  const handleRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const deckNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of battles) {
      if (b.decks?.name) names.add(b.decks.name);
    }
    return Array.from(names);
  }, [battles]);

  const filteredBattles = useMemo(() => {
    if (!selectedDeck) return battles;
    return battles.filter((b) => b.decks?.name === selectedDeck);
  }, [battles, selectedDeck]);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <h1 className="text-lg font-bold">対戦履歴</h1>
        <FormatSelector format={format} setFormat={setFormat} />
        {pageLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              battleCounts={battleCounts}
              onMonthChange={loadCounts}
            />
            {deckNames.length > 0 && (
              <DeckFilter
                deckNames={deckNames}
                selectedDeck={selectedDeck}
                onSelect={setSelectedDeck}
              />
            )}
            <BattleHistoryList
              battles={filteredBattles}
              decks={decks}
              suggestions={suggestions}
              onRefresh={loadBattles}
            />
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
