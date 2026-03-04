import { redirect } from "next/navigation";
import {
  checkIsAdmin,
  getOpponentDeckMasterList,
} from "@/lib/actions/admin-actions";
import { OpponentDeckManager } from "@/components/admin/OpponentDeckManager";

export default async function AdminOpponentDecksPage() {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) redirect("/battle");

  const decks = await getOpponentDeckMasterList();

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">対面デッキ管理</h1>
        <a
          href="/battle"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 戻る
        </a>
      </div>
      <OpponentDeckManager initialDecks={decks} />
    </div>
  );
}
