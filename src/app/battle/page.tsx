"use client";

import { useEffect, useState } from "react";
import { getDecks } from "@/lib/actions/deck-actions";
import {
  getOpponentDeckSuggestions,
  getMiniStats,
} from "@/lib/actions/battle-actions";
import { getPendingVoteForUser } from "@/lib/actions/vote-actions";
import { checkIsAdmin } from "@/lib/actions/admin-actions";
import { BattleRecordForm } from "@/components/battle/BattleRecordForm";
import { BottomNav } from "@/components/layout/BottomNav";

export default function BattlePage() {
  const [data, setData] = useState<{
    decks: Awaited<ReturnType<typeof getDecks>>;
    suggestions: string[];
    miniStats: Awaited<ReturnType<typeof getMiniStats>>;
    pendingVote: Awaited<ReturnType<typeof getPendingVoteForUser>>;
    isAdmin: boolean;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      getDecks(),
      getOpponentDeckSuggestions(),
      getMiniStats(),
      getPendingVoteForUser(),
      checkIsAdmin(),
    ]).then(([decks, suggestions, miniStats, pendingVote, isAdmin]) => {
      setData({ decks, suggestions, miniStats, pendingVote, isAdmin });
    });
  }, []);

  if (!data) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <p className="text-muted-foreground text-sm">読み込み中...</p>
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
        />
      </div>
      <BottomNav />
    </>
  );
}
