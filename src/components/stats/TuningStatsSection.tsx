"use client";

import { useState } from "react";
import type { TuningStats, OpponentDetail } from "@/lib/actions/stats-actions";

function WinRateText({ rate }: { rate: number }) {
  return (
    <span className={rate >= 50 ? "text-success" : "text-destructive"}>
      勝率 {rate}%
    </span>
  );
}

function TurnOrderRow({ label, wins, losses, total, winRate }: { label: string; wins: number; losses: number; total: number; winRate: number }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-muted-foreground w-14">{label}</span>
      <span className="flex-1 text-right">
        <WinRateText rate={winRate} />
        <span className="text-muted-foreground ml-2">{wins}Win {losses}Lose ({total}件)</span>
      </span>
    </div>
  );
}

function OpponentRow({ opp }: { opp: { opponentName: string } & OpponentDetail }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <span>vs {opp.opponentName}</span>
        <span className="flex items-center gap-2">
          <WinRateText rate={opp.winRate} />
          <span className="text-muted-foreground text-xs">{opp.wins}Win {opp.losses}Lose ({opp.total}件)</span>
        </span>
      </div>
      <div className="pl-2">
        <TurnOrderRow label="先攻" wins={opp.firstWins} losses={opp.firstLosses} total={opp.firstTotal} winRate={opp.firstWinRate} />
        <TurnOrderRow label="後攻" wins={opp.secondWins} losses={opp.secondLosses} total={opp.secondTotal} winRate={opp.secondWinRate} />
        <TurnOrderRow label="不明" wins={opp.unknownWins} losses={opp.unknownLosses} total={opp.unknownTotal} winRate={opp.unknownWinRate} />
      </div>
    </div>
  );
}

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
        return (
          <div key={key} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => setExpandedTuning(expandedTuning === key ? null : key)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium">{t.tuningName}</span>
              <span className="flex items-center gap-2">
                <WinRateText rate={t.winRate} />
                <span className="text-muted-foreground text-xs">{t.wins}Win {t.losses}Lose ({t.total}件)</span>
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
                  <OpponentRow key={opp.opponentName} opp={opp} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
