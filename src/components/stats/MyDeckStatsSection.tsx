"use client";

import { useRouter } from "next/navigation";
import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";

type MyDeckRow = DetailedPersonalStats["myDeckStats"][number];

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
      {stats.map((deck) => {
        const color = getWinRateColor(deck.winRate);
        return (
          <div key={deck.deckName} className="relative rounded-lg border border-border bg-card overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: color }} />
            <button
              onClick={() => handleClick(deck.deckName)}
              className="w-full pl-4 pr-4 py-3 text-sm transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{deck.deckName}</span>
                <span className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color }}>
                    {deck.winRate}%
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {deck.wins}勝 {deck.losses}敗 ({deck.total}件)
                  </span>
                  <span className="text-muted-foreground">›</span>
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted/30">
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${deck.winRate}%`, backgroundColor: color }}
                />
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
