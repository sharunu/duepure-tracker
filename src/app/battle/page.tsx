import { getDecks } from "@/lib/actions/deck-actions";
import {
  getOpponentDeckSuggestions,
  getMiniStats,
} from "@/lib/actions/battle-actions";
import { getPendingVoteForUser } from "@/lib/actions/vote-actions";
import { checkIsAdmin } from "@/lib/actions/admin-actions";
import { BattleRecordForm } from "@/components/battle/BattleRecordForm";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function BattlePage() {
  const [decks, suggestions, miniStats, pendingVote, isAdmin] =
    await Promise.all([
      getDecks(),
      getOpponentDeckSuggestions(),
      getMiniStats(),
      getPendingVoteForUser(),
      checkIsAdmin(),
    ]);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        {isAdmin && (
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
          decks={decks}
          suggestions={suggestions}
          miniStats={miniStats}
          pendingVote={pendingVote}
        />
      </div>
      <BottomNav />
    </>
  );
}
