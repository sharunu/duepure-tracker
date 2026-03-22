"use client";

import { useRouter } from "next/navigation";
import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";

type OpponentRow = DetailedPersonalStats["opponentDeckStats"][number];

function WinRateText({ rate }: { rate: number }) {
  return (
    <span className={rate >= 50 ? "text-success" : "text-destructive"}>
      勝率 {rate}%
    </span>
  );
}

export function OpponentDeckStatsSection({ stats, startDate, endDate }: { stats: OpponentRow[]; startDate?: string; endDate?: string }) {
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
    const qs = params.toString();
    router.push(`/stats/opponent/${encodeURIComponent(deckName)}${qs ? "?" + qs : ""}`);
  };

  return (
    <div className="space-y-2">
      {stats.map((row) => (
        <div key={row.deckName} className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => handleClick(row.deckName)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">{row.deckName}</span>
            <span className="flex items-center gap-2">
              <WinRateText rate={row.winRate} />
              <span className="text-muted-foreground text-xs">{row.wins}Win {row.losses}Lose ({row.total}件)</span>
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
