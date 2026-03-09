"use client";

import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";

type OpponentRow = DetailedPersonalStats["opponentDeckStats"][number];

export function OpponentDeckStatsSection({ stats }: { stats: OpponentRow[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4 text-sm">
        データがありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {stats.map((row) => (
        <div
          key={row.deckName}
          className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between"
        >
          <span className="text-sm">{row.deckName}</span>
          <span className="flex items-center gap-2">
            <span className={row.winRate >= 50 ? "text-success text-sm" : "text-destructive text-sm"}>
              {row.winRate}%
            </span>
            <span className="text-muted-foreground text-xs">
              {row.wins}W {row.losses}L ({row.total})
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
