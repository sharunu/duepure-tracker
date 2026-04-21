"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getBattlesByDateRange, getDailyBattleCounts, getOpponentDeckSuggestions, hasAnyBattles } from "@/lib/actions/battle-actions";
import { getDecks } from "@/lib/actions/deck-actions";
import { getOpponentDeckNameMap, type OpponentDeckNameMap } from "@/lib/actions/opponent-deck-display";
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
  my_deck_name: string;
  opponent_deck_name: string;
  result: "win" | "loss";
  turn_order: "first" | "second" | null;
  fought_at: string;
  tuning_id: string | null;
  tuning_name?: string | null;
};

export default function BattlesPage() {
  const { format, setFormat, ready } = useFormat();
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [suggestions, setSuggestions] = useState<{ major: string[]; minor: string[]; other: string[] }>({ major: [], minor: [], other: [] });
  const [nameMap, setNameMap] = useState<OpponentDeckNameMap>({});
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});
  const [hasAny, setHasAny] = useState<boolean | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toLocaleDateString("sv-SE");
  });
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  const loadBattles = useCallback(() => {
    if (!ready) return;
    Promise.all([
      getBattlesByDateRange(format, startDate, endDate, "pokepoke"),
      getDecks(format, "pokepoke"),
      getOpponentDeckSuggestions(format, "pokepoke"),
      hasAnyBattles(format, "pokepoke"),
      getOpponentDeckNameMap(format, "pokepoke"),
    ]).then(([battlesData, decksData, suggestionsData, anyData, nameMapData]) => {
      setBattles(battlesData as Battle[]);
      setDecks(decksData as Deck[]);
      setSuggestions(suggestionsData);
      setHasAny(anyData);
      setNameMap(nameMapData);
      setPageLoading(false);
    }).catch(() => {
      setError("データの読み込みに失敗しました");
      setPageLoading(false);
    });
  }, [format, startDate, endDate, ready]);

  const loadCounts = useCallback((year: number, month: number) => {
    if (!ready) return;
    getDailyBattleCounts(format, year, month, "pokepoke").then(setBattleCounts);
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
      if (b.my_deck_name) names.add(b.my_deck_name);
    }
    return Array.from(names);
  }, [battles]);

  const filteredBattles = useMemo(() => {
    if (!selectedDeck) return battles;
    return battles.filter((b) => b.my_deck_name === selectedDeck);
  }, [battles, selectedDeck]);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-[20px] font-medium">対戦履歴</h1>
          <div className={!ready ? "invisible" : ""}>
            <FormatSelector format={format} setFormat={setFormat} />
          </div>
        </div>
        {error ? (
          <p className="text-center text-red-400 py-12 text-sm">{error}</p>
        ) : (!ready || pageLoading) ? (
          <div className="space-y-3">
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-10" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[280px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
          </div>
        ) : hasAny === false ? (
          <div
            className="rounded-[12px] p-6 text-center space-y-4"
            style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355" }}
          >
            <div className="space-y-2">
              <h2 className="text-[18px] font-medium">まだ対戦記録がありません</h2>
              <p className="text-sm text-gray-400">
                最初の対戦を記録してみましょう。
              </p>
            </div>
            <Link
              href="/pokepoke/battle"
              className="inline-block rounded-[10px] px-5 py-3 text-sm font-medium bg-[#6366f1] hover:bg-[#5558e6] transition-colors"
            >
              対戦を記録する
            </Link>
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
              opponentDeckNameMap={nameMap}
            />
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
