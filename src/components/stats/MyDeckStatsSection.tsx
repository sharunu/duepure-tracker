"use client";

import { useState } from "react";
import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";

type MyDeckRow = DetailedPersonalStats["myDeckStats"][number];

function WinRateText({ rate }: { rate: number }) {
  return (
    <span className={rate >= 50 ? "text-success" : "text-destructive"}>
      {rate}%
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
        <span className="text-muted-foreground ml-2">{wins}W {losses}L ({total})</span>
      </span>
    </div>
  );
}

export function MyDeckStatsSection({ stats }: { stats: MyDeckRow[] }) {
  const [expandedDeck, setExpandedDeck] = useState<string | null>(null);

  if (stats.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4 text-sm">
        データがありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {stats.map((deck) => (
        <div key={deck.deckName} className="rounded-lg border border-border bg-card overflow-hidden">
          <button
            onClick={() => setExpandedDeck(expandedDeck === deck.deckName ? null : deck.deckName)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">{deck.deckName}</span>
            <span className="flex items-center gap-2">
              <WinRateText rate={deck.winRate} />
              <span className="text-muted-foreground text-xs">{deck.wins}W {deck.losses}L ({deck.total})</span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${expandedDeck === deck.deckName ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {expandedDeck === deck.deckName && (
            <div className="border-t border-border px-4 py-2 space-y-3">
              {deck.opponents.map((opp) => (
                <div key={opp.opponentName} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>vs {opp.opponentName}</span>
                    <span className="flex items-center gap-2">
                      <WinRateText rate={opp.winRate} />
                      <span className="text-muted-foreground text-xs">{opp.wins}W {opp.losses}L ({opp.total})</span>
                    </span>
                  </div>
                  <div className="pl-2">
                    <TurnOrderRow label="先攻" wins={opp.firstWins} losses={opp.firstLosses} total={opp.firstTotal} winRate={opp.firstWinRate} />
                    <TurnOrderRow label="後攻" wins={opp.secondWins} losses={opp.secondLosses} total={opp.secondTotal} winRate={opp.secondWinRate} />
                    <TurnOrderRow label="不明" wins={opp.unknownWins} losses={opp.unknownLosses} total={opp.unknownTotal} winRate={opp.unknownWinRate} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
