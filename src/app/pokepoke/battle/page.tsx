"use client";

import { useEffect, useState, useCallback } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import {
  getOpponentDeckSuggestions,
  getMiniStats,
} from "@/lib/actions/battle-actions";
import { checkIsAdmin } from "@/lib/actions/admin-actions";
import { getOpponentDeckNameMap, type OpponentDeckNameMap } from "@/lib/actions/opponent-deck-display";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { BattleRecordForm } from "@/components/battle/BattleRecordForm";
import { BottomNav } from "@/components/layout/BottomNav";

export default function BattlePage() {
  const { format, setFormat, ready } = useFormat();
  const [data, setData] = useState<{
    decks: Awaited<ReturnType<typeof getDecks>>;
    suggestions: { major: string[]; minor: string[]; other: string[] };
    miniStats: Awaited<ReturnType<typeof getMiniStats>>;
    isAdmin: boolean;
    nameMap: OpponentDeckNameMap;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    if (!ready) return;
    Promise.all([
      getDecks(format, "pokepoke"),
      getOpponentDeckSuggestions(format, "pokepoke"),
      getMiniStats(format, localStorage.getItem(`measureSince_${format}`) ?? undefined, "pokepoke"),
      checkIsAdmin(),
      getOpponentDeckNameMap(format, "pokepoke"),
    ]).then(([decks, suggestions, miniStats, isAdmin, nameMap]) => {
      setData({ decks, suggestions, miniStats, isAdmin, nameMap });
      setPageLoading(false);
    }).catch(() => {
      setError("データの読み込みに失敗しました");
      setPageLoading(false);
    });
  }, [format, ready]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (error) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <p className="text-center text-red-400 py-12 text-sm">{error}</p>
        </div>
        <BottomNav />
      </>
    );
  }

  if (!data || !ready) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="animate-pulse rounded-[8px] bg-[#232640] h-6 w-24" />
            <div className="animate-pulse rounded-[8px] bg-[#232640] h-8 w-20" />
          </div>
          <div className="space-y-4">
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[56px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[52px]" />
            <div className="animate-pulse rounded-[10px] bg-[#232640] h-[44px]" />
            <div className="flex gap-3"><div className="animate-pulse rounded-[10px] bg-[#232640] h-[56px] flex-1" /><div className="animate-pulse rounded-[10px] bg-[#232640] h-[56px] flex-1" /></div>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[20px] font-medium">対戦記録</h1>
          <div className={"flex items-center gap-2" + (!ready ? " invisible" : "")}>
            {data.isAdmin && (
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

        <BattleRecordForm
          decks={data.decks}
          suggestions={data.suggestions}
          miniStats={data.miniStats}
          format={format}
          setFormat={setFormat}
          opponentDeckNameMap={data.nameMap}
        />
      </div>
      <BottomNav />
    </>
  );
}
