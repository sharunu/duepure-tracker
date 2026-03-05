"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkIsAdmin,
  getOpponentDeckMasterList,
} from "@/lib/actions/admin-actions";
import { OpponentDeckManager } from "@/components/admin/OpponentDeckManager";

export default function AdminOpponentDecksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof getOpponentDeckMasterList>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkIsAdmin().then((isAdmin) => {
      if (!isAdmin) {
        router.replace("/battle");
        return;
      }
      getOpponentDeckMasterList().then((d) => {
        setDecks(d);
        setLoading(false);
      });
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    );
  }

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
