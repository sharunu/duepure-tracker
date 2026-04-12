"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  checkIsAdmin,
  getOpponentDeckMasterList,
  getOpponentDeckSettings,
} from "@/lib/actions/admin-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { OpponentDeckManager } from "@/components/admin/OpponentDeckManager";

type Settings = {
  management_mode: string;
  major_threshold: number;
  minor_threshold: number;
  usage_period_days: number;
  disable_period_days: number;
};

export default function AdminOpponentDecksPage() {
  const router = useRouter();
  const { format, setFormat } = useFormat();
  const [decks, setDecks] = useState<Awaited<ReturnType<typeof getOpponentDeckMasterList>>>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const applyRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const loadDecks = useCallback(() => {
    setLoading(true);
    checkIsAdmin().then((isAdmin) => {
      if (!isAdmin) {
        router.replace("/battle");
        return;
      }
      Promise.all([
        getOpponentDeckMasterList(format),
        getOpponentDeckSettings(format),
      ]).then(([d, s]) => {
        setDecks(d);
        setSettings(s as Settings | null);
        setLoading(false);
      });
    });
  }, [format, router]);

  useEffect(() => {
    loadDecks();
  }, [loadDecks]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
        <p className="text-gray-500 text-sm">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-medium">対面デッキ管理</h1>
        <a
          href="/battle"
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          ← 戻る
        </a>
      </div>
      <div className="bg-[#232640] rounded-[10px] px-4 py-3 mb-4 flex items-center gap-3">
        <div className="flex-1">
          <FormatSelector format={format} setFormat={setFormat} />
        </div>
        <button
            onClick={() => applyRef.current?.()}
            disabled={!dirty || applying}
            className="bg-[#6366f1] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium hover:bg-[#5558e6] disabled:opacity-50 transition-colors whitespace-nowrap min-h-[40px]"
          >
            {applying ? "反映中..." : "変更内容反映"}
          </button>
      </div>
      <OpponentDeckManager
        initialDecks={decks}
        format={format}
        initialSettings={settings}
        onDirtyChange={setDirty}
        onApplyingChange={setApplying}
        applyRef={applyRef}
      />
    </div>
  );
}
