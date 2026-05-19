"use client";

import { useState } from "react";
import type { TuningStats } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import { MatchupCard } from "@/components/stats/MatchupCard";
import { MatchupTable } from "@/components/stats/MatchupTable";
import { BattleCountBadge } from "@/components/ui/BattleCountBadge";
import { formatWLTJa } from "@/lib/battle/result-format";

export function TuningStatsSection({ tuningStats, viewMode, game }: { tuningStats: TuningStats[]; viewMode?: "visual" | "table"; game: string }) {
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
        const key = t.tuningName;
        const ratePct = t.winRate === null ? 0 : t.winRate;
        const color = getWinRateColor(t.winRate);
        const expanded = expandedTuning === key;
        return (
          <div key={key} className="overflow-hidden rounded-[10px] bg-surface-2">
            <button
              onClick={() => setExpandedTuning(expanded ? null : key)}
              aria-expanded={expanded}
              className="w-full px-4 py-3 hover:opacity-80 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium">{t.tuningName}</span>
                <BattleCountBadge count={t.total} />
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-1 rounded-sm overflow-hidden bg-foreground/10" style={{ maxWidth: 120, flex: 1 }}>
                  <div className="h-full rounded-sm" style={{ width: `${ratePct}%`, backgroundColor: color }} />
                </div>
                <span className="text-sm font-medium" style={{ color }}>{t.winRate === null ? "--" : t.winRate}%</span>
                <span className="text-[10px] text-muted-foreground">{formatWLTJa(t.wins, t.losses, t.draws, game)}</span>
                <span className="ml-auto">{expanded ? "▴" : "▾"}</span>
              </div>
            </button>

            {expanded && (
              <div className="bg-surface-1 border-t border-border-subtle px-4 py-2 space-y-3">
                {viewMode === "table" ? (
                  <MatchupTable
                    rows={t.opponents.map((opp) => ({ ...opp, name: opp.opponentName, namePrefix: "vs " }))}
                    showTotal
                    game={game}
                  />
                ) : (
                  t.opponents.map((opp) => (
                    <MatchupCard
                      key={opp.opponentName}
                      name={opp.opponentName}
                      namePrefix="vs "
                      detail={opp}
                      game={game}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
