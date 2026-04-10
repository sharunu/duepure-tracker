"use client";

import { useEffect, useState, useCallback } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import {
  getOpponentDeckSuggestions,
  getMiniStats,
} from "@/lib/actions/battle-actions";
import { checkIsAdmin } from "@/lib/actions/admin-actions";
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
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!ready) return;
    Promise.all([
      getDecks(format),
      getOpponentDeckSuggestions(format),
      getMiniStats(format, localStorage.getItem(`measureSince_${format}`) ?? undefined),
      checkIsAdmin(),
    ]).then(([decks, suggestions, miniStats, isAdmin]) => {
      setData({ decks, suggestions, miniStats, isAdmin });
      setPageLoading(false);
    });
  }, [format, ready]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!data || !ready) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
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
        />
      </div>
      <BottomNav />
    </>
  );
}
