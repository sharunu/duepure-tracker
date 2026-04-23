"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { BattleRecordForm } from "@/components/battle/BattleRecordForm";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { DeckFilter } from "@/components/battle/DeckFilter";
import { BattleHistoryList } from "@/components/battle/BattleHistoryList";
import type { Format } from "@/hooks/use-format";
import type { OpponentDeckNameMap } from "@/lib/actions/opponent-deck-display";

type Tuning = { id: string; name: string; sort_order: number };
type Deck = { id: string; name: string; deck_tunings?: Tuning[] };

type Battle = {
  id: string;
  my_deck_id: string;
  my_deck_name: string;
  opponent_deck_name: string;
  result: "win" | "loss" | "draw";
  turn_order: "first" | "second" | null;
  fought_at: string;
  tuning_id: string | null;
  tuning_name?: string | null;
};

type Suggestions = { major: string[]; minor: string[]; other: string[] };

type MiniStatsData = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  streak: number;
};

type TabKey = "input" | "history";

type Props = {
  format: Format;
  setFormat: (f: Format) => void;
  ready: boolean;

  // input slide
  decks: Deck[];
  suggestions: Suggestions;
  miniStats: MiniStatsData | null;
  isAdmin: boolean;

  // history slide
  battles: Battle[];
  selectedDeck: string | null;
  setSelectedDeck: (d: string | null) => void;
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  battleCounts: Record<string, number>;
  onMonthChange: (year: number, month: number) => void;
  hasAny: boolean | null;
  historyLoading: boolean;
  onHistoryRefresh: () => void;

  opponentDeckNameMap?: OpponentDeckNameMap;
};

function readInitialTab(sp: URLSearchParams | null): TabKey {
  return sp?.get("tab") === "history" ? "history" : "input";
}

export function BattleTabsView(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = readInitialTab(searchParams);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    containScroll: "trimSnaps",
    startIndex: urlTab === "history" ? 1 : 0,
    watchDrag: (_, event) => {
      const target = event.target as Element | null;
      if (!target) return true;
      if (
        target.closest(
          "input, textarea, select, button, [contenteditable='true']"
        )
      ) {
        return false;
      }
      return true;
    },
  });

  const [currentSlide, setCurrentSlide] = useState<TabKey>(urlTab);
  const lastSyncedTabRef = useRef<TabKey>(urlTab);
  const [toast, setToast] = useState<string | null>(null);

  // embla -> URL
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      const next: TabKey = idx === 0 ? "input" : "history";
      setCurrentSlide(next);
      if (lastSyncedTabRef.current === next) return;
      lastSyncedTabRef.current = next;
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (next === "input") {
        params.delete("tab");
      } else {
        params.set("tab", "history");
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    };
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, router, searchParams]);

  // URL -> embla
  useEffect(() => {
    if (!emblaApi) return;
    const targetIdx = urlTab === "history" ? 1 : 0;
    if (emblaApi.selectedScrollSnap() !== targetIdx) {
      lastSyncedTabRef.current = urlTab;
      emblaApi.scrollTo(targetIdx);
    }
  }, [urlTab, emblaApi]);

  const switchTo = useCallback(
    (next: TabKey) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(next === "input" ? 0 : 1);
    },
    [emblaApi]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "End") {
      e.preventDefault();
      switchTo("history");
    } else if (e.key === "ArrowLeft" || e.key === "Home") {
      e.preventDefault();
      switchTo("input");
    }
  };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, []);

  const handleBattleRecorded = useCallback(() => {
    showToast("対戦を記録しました");
    props.onHistoryRefresh();
  }, [showToast, props]);

  const deckNames = useMemo(() => {
    const names = new Set<string>();
    for (const b of props.battles) {
      if (b.my_deck_name) names.add(b.my_deck_name);
    }
    return Array.from(names);
  }, [props.battles]);

  const filteredBattles = useMemo(() => {
    if (!props.selectedDeck) return props.battles;
    return props.battles.filter((b) => b.my_deck_name === props.selectedDeck);
  }, [props.battles, props.selectedDeck]);

  const { format, setFormat, ready } = props;
  const tabs: { key: TabKey; label: string }[] = [
    { key: "input", label: "入力" },
    { key: "history", label: "履歴" },
  ];

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[20px] font-medium">対戦記録</h1>
          <div className={"flex items-center gap-2" + (!ready ? " invisible" : "")}>
            {props.isAdmin && (
              <a
                href="/admin/opponent-decks"
                className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded-[6px] transition-colors"
                style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355" }}
              >
                対面デッキ管理
              </a>
            )}
            <FormatSelector format={format} setFormat={setFormat} />
          </div>
        </div>

        <div
          role="tablist"
          aria-label="対戦記録ビュー"
          className="flex rounded-xl p-1 border border-muted/20 mb-4"
          style={{ backgroundColor: "#1a1d35" }}
          onKeyDown={handleKeyDown}
        >
          {tabs.map(({ key, label }) => {
            const isActive = currentSlide === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                id={`battle-tab-${key}`}
                aria-selected={isActive}
                aria-controls={`battle-panel-${key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => switchTo(key)}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all min-h-[40px] ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            <div
              className="flex-[0_0_100%] min-w-0"
              role="tabpanel"
              id="battle-panel-input"
              aria-labelledby="battle-tab-input"
            >
              <BattleRecordForm
                decks={props.decks}
                suggestions={props.suggestions}
                miniStats={props.miniStats}
                format={format}
                setFormat={setFormat}
                opponentDeckNameMap={props.opponentDeckNameMap}
                onBattleRecorded={handleBattleRecorded}
              />
            </div>

            <div
              className="flex-[0_0_100%] min-w-0 space-y-4"
              role="tabpanel"
              id="battle-panel-history"
              aria-labelledby="battle-tab-history"
            >
              {props.historyLoading ? (
                <div className="space-y-3">
                  <div className="animate-pulse rounded-[10px] bg-[#232640] h-10" />
                  <div className="animate-pulse rounded-[10px] bg-[#232640] h-[280px]" />
                  <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
                  <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
                  <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
                  <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
                </div>
              ) : props.hasAny === false ? (
                <div
                  className="rounded-[12px] p-6 text-center space-y-4"
                  style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355" }}
                >
                  <div className="space-y-2">
                    <h2 className="text-[18px] font-medium">まだ対戦記録がありません</h2>
                    <p className="text-sm text-gray-400">最初の対戦を記録してみましょう。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTo("input")}
                    className="inline-block rounded-[10px] px-5 py-3 text-sm font-medium bg-[#6366f1] hover:bg-[#5558e6] transition-colors"
                  >
                    対戦を記録する
                  </button>
                </div>
              ) : (
                <>
                  <DateRangeCalendar
                    startDate={props.startDate}
                    endDate={props.endDate}
                    onRangeChange={props.onRangeChange}
                    battleCounts={props.battleCounts}
                    onMonthChange={props.onMonthChange}
                  />
                  {deckNames.length > 0 && (
                    <DeckFilter
                      deckNames={deckNames}
                      selectedDeck={props.selectedDeck}
                      onSelect={props.setSelectedDeck}
                    />
                  )}
                  <BattleHistoryList
                    battles={filteredBattles}
                    decks={props.decks}
                    suggestions={props.suggestions}
                    onRefresh={props.onHistoryRefresh}
                    opponentDeckNameMap={props.opponentDeckNameMap}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-center mt-4 gap-2" aria-hidden="true">
          {tabs.map(({ key }) => (
            <span
              key={key}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                currentSlide === key ? "bg-[#818cf8]" : "bg-gray-600"
              }`}
            />
          ))}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 bottom-[72px] z-50 rounded-[10px] px-4 py-2 text-sm font-medium bg-[#6366f1] text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </>
  );
}
