"use client";

import { useState } from "react";
import type { TuningStats } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import { MatchupCard } from "@/components/stats/MatchupCard";
import { MatchupTable } from "@/components/stats/MatchupTable";
import { BattleCountBadge } from "@/components/ui/BattleCountBadge";
import { formatWLTJa } from "@/lib/battle/result-format";
import type { OpponentDeckNameMap } from "@/lib/actions/opponent-deck-display";

export function TuningStatsSection({ tuningStats, viewMode, game, opponentDeckNameMap }: { tuningStats: TuningStats[]; viewMode?: "visual" | "table"; game: string; opponentDeckNameMap?: OpponentDeckNameMap }) {
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
          <div key={key} style={{ backgroundColor: "#232640", borderRadius: 10 }} className="overflow-hidden">
            <button
              onClick={() => setExpandedTuning(expanded ? null : key)}
              className="w-full px-4 py-3 hover:opacity-80 transition-opacity"
            >
              {/* 1行目 */}
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 15, fontWeight: 500 }}>{t.tuningName}</span>
                <BattleCountBadge count={t.total} />
              </div>
              {/* 2行目 */}
              <div className="flex items-center gap-2 mt-1.5">
                <div className="h-1 rounded-sm overflow-hidden" style={{ maxWidth: 120, flex: 1, backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <div className="h-full rounded-sm" style={{ width: `${ratePct}%`, backgroundColor: color }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color }}>{t.winRate === null ? "--" : t.winRate}%</span>
                <span style={{ fontSize: 10, color: "#8888aa" }}>{formatWLTJa(t.wins, t.losses, t.draws, game)}</span>
                <span className="ml-auto">{expanded ? "▴" : "▾"}</span>
              </div>
            </button>

            {expanded && (
              <div style={{ backgroundColor: "#1b1e35", borderTop: "0.5px solid #2a2d48" }} className="px-4 py-2 space-y-3">
                {viewMode === "table" ? (
                  <MatchupTable
                    rows={t.opponents.map((opp) => ({ ...opp, name: opp.opponentName, namePrefix: "vs " }))}
                    showTotal
                    game={game}
                    opponentDeckNameMap={opponentDeckNameMap}
                  />
                ) : (
                  t.opponents.map((opp) => (
                    <MatchupCard
                      key={opp.opponentName}
                      name={opp.opponentName}
                      namePrefix="vs "
                      detail={opp}
                      game={game}
                      opponentDeckNameMap={opponentDeckNameMap}
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
