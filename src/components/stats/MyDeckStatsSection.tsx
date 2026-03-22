"use client";

import { useRouter } from "next/navigation";
import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";

type MyDeckRow = DetailedPersonalStats["myDeckStats"][number];

function WinRateText({ rate }: { rate: number }) {
  return (
    <span className={rate >= 50 ? "text-success" : "text-destructive"}>
      勝率 {rate}%
    </span>
  );
}

export function MyDeckStatsSection({ stats, startDate, endDate, scope }: { stats: MyDeckRow[]; startDate?: string; endDate?: string; scope?: "personal" | "global" }) {
  const router = useRouter();

  if (stats.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4 text-sm">
        データがありません
      </p>
    );
  }

  const handleClick = (deckName: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    if (scope === "global") params.set("scope", "global");
    const qs = params.toString();
    router.push(`/stats/deck/${encodeURIComponent(deckName)}${qs ? "?" + qs : ""}`);
  };

  return (
    <div className="space-y-2">
      {stats.map((deck) => (
        <div key={deck.deckName} className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => handleClick(deck.deckName)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-muted/50"
          >
            <span className="font-medium">{deck.deckName}</span>
            <span className="flex items-center gap-2">
              <WinRateText rate={deck.winRate} />
              <span className="text-muted-foreground text-xs">{deck.wins}勝 {deck.losses}敗 ({deck.total}件)</span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
