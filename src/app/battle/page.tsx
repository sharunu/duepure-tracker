"use client";

import { useEffect, useState, useCallback } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import {
  getOpponentDeckSuggestions,
  getMiniStats,
} from "@/lib/actions/battle-actions";
import { getPendingVoteForUser } from "@/lib/actions/vote-actions";
import { checkIsAdmin } from "@/lib/actions/admin-actions";
import { useFormat } from "@/hooks/use-format";
import { BattleRecordForm } from "@/components/battle/BattleRecordForm";
import { BottomNav } from "@/components/layout/BottomNav";

export default function BattlePage() {
  const { format, setFormat } = useFormat();
  const [data, setData] = useState<{
    decks: Awaited<ReturnType<typeof getDecks>>;
    suggestions: { major: string[]; other: string[] };
    miniStats: Awaited<ReturnType<typeof getMiniStats>>;
    pendingVote: Awaited<ReturnType<typeof getPendingVoteForUser>>;
    isAdmin: boolean;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  const loadData = useCallback(() => {
    Promise.all([
      getDecks(format),
      getOpponentDeckSuggestions(format),
      getMiniStats(format),
      getPendingVoteForUser(),
      checkIsAdmin(),
    ]).then(([decks, suggestions, miniStats, pendingVote, isAdmin]) => {
      setData({ decks, suggestions, miniStats, pendingVote, isAdmin });
      setPageLoading(false);
    });
  }, [format]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!data) {
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
        {data.isAdmin && (
          <div className="flex justify-end mb-2">
            <a
              href="/admin/opponent-decks"
              className="text-xs text-muted-foreground hover:text-primary underline"
            >
              対面デッキ管理
            </a>
          </div>
        )}
        <BattleRecordForm
          decks={data.decks}
          suggestions={data.suggestions}
          miniStats={data.miniStats}
          pendingVote={data.pendingVote}
          format={format}
          setFormat={setFormat}
        />
      </div>
      <BottomNav />
    </>
  );
}
