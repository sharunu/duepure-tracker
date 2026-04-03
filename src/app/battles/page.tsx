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

type Tuning = { id: string; name: string; sort_order: number };
type Deck = { id: string; name: string; deck_tunings?: Tuning[] };
type Battle = {
  id: string;
  my_deck_id: string;
  opponent_deck_name: string;
  result: "win" | "loss";
  turn_order: "first" | "second" | null;
  fought_at: string;
  tuning_id: string | null;
  decks: { name: string } | null;
  deck_tunings: { name: string } | null;
};

export default function BattlesPage() {
  const { format, setFormat, ready } = useFormat();
  const [pageLoading, setPageLoading] = useState(true);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [suggestions, setSuggestions] = useState<{ major: string[]; other: string[] }>({ major: [], other: [] });
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("sv-SE");
  });
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  const loadBattles = useCallback(() => {
    if (!ready) return;
    Promise.all([
      getBattlesByDateRange(format, startDate, endDate),
      getDecks(format),
      getOpponentDeckSuggestions(format),
    ]).then(([battlesData, decksData, suggestionsData]) => {
      setBattles(battlesData as Battle[]);
      setDecks(decksData as Deck[]);
      setSuggestions(suggestionsData);
      setPageLoading(false);
    });
  }, [format, startDate, endDate, ready]);

  const loadCounts = useCallback((year: number, month: number) => {
    if (!ready) return;
    getDailyBattleCounts(format, year, month).then(setBattleCounts);
  }, [format, ready]);

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">対戦履歴</h1>
          <div className={!ready ? "invisible" : ""}>
            <FormatSelector format={format} setFormat={setFormat} />
          </div>
        </div>
        {(!ready || pageLoading) ? (
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
