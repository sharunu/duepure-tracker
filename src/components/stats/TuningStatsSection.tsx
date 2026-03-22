"use client";

import { useState } from "react";
import type { TuningStats } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import { MatchupCard } from "@/components/stats/MatchupCard";

export function TuningStatsSection({ tuningStats }: { tuningStats: TuningStats[] }) {
  const [expandedTuning, setExpandedTuning] = useState<string | null>(null);

  if (tuningStats.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4 text-sm">
        データがありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tuningStats.map((t) => {
        const key = t.tuningId ?? "__none__";
        const color = getWinRateColor(t.winRate);
        return (
          <div key={key} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedTuning(expandedTuning === key ? null : key)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium">{t.tuningName}</span>
              <span className="flex items-center gap-2">
                <span className="font-bold" style={{ color }}>{t.winRate}%</span>
                <span className="text-muted-foreground text-xs">{t.wins}勝 {t.losses}敗 ({t.total}件)</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`transition-transform ${expandedTuning === key ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {expandedTuning === key && (
              <div className="border-t border-border px-4 py-2 space-y-3">
                {t.opponents.map((opp) => (
                  <MatchupCard key={opp.opponentName} name={opp.opponentName} namePrefix="vs " detail={opp} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
