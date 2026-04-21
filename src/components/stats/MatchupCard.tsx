"use client";

import type { OpponentDetail } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import { BattleCountBadge } from "@/components/ui/BattleCountBadge";
import {
  displayDeckName,
  type OpponentDeckNameMap,
} from "@/lib/actions/opponent-deck-display";

function TurnOrderBar({ label, wins, losses, total, winRate }: { label: string; wins: number; losses: number; total: number; winRate: number }) {
  if (total === 0) return null;
  const color = getWinRateColor(winRate);
  return (
    <div className="flex items-center gap-2 text-xs py-0.5">
      <span className="text-muted-foreground w-8 shrink-0">{label}</span>
      <div className="flex-1 bg-muted rounded h-1.5 overflow-hidden">
        <div className="h-full rounded" style={{ width: `${winRate}%`, backgroundColor: color }} />
      </div>
      <span className="shrink-0 font-medium" style={{ color, width: 36, textAlign: "right" }}>{winRate}%</span>
      <span className="text-muted-foreground shrink-0" style={{ width: 80, textAlign: "right" }}>{wins}-{losses} ({total})</span>
    </div>
  );
}

export function MatchupCard({ name, namePrefix, detail, opponentDeckNameMap }: { name: string; namePrefix?: string; detail: OpponentDetail; opponentDeckNameMap?: OpponentDeckNameMap }) {
  const color = getWinRateColor(detail.winRate);
  return (
    <div className="flex rounded-lg border border-border bg-card overflow-hidden">
      <div className="w-[3px] shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 px-3 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{namePrefix}{displayDeckName(name, opponentDeckNameMap)}</span>
            <BattleCountBadge count={detail.total} />
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-baseline">
              <span className="text-xs text-muted-foreground" style={{ width: 24, flexShrink: 0 }}>勝率</span>
              <span className="text-lg font-bold" style={{ color, width: 46, textAlign: "right", flexShrink: 0 }}>{detail.winRate}%</span>
            </span>
            <span className="text-muted-foreground text-xs">{detail.wins}勝{detail.losses}敗</span>
          </div>
        </div>
        <div>
          <TurnOrderBar label="先攻" wins={detail.firstWins} losses={detail.firstLosses} total={detail.firstTotal} winRate={detail.firstWinRate} />
          <TurnOrderBar label="後攻" wins={detail.secondWins} losses={detail.secondLosses} total={detail.secondTotal} winRate={detail.secondWinRate} />
          <TurnOrderBar label="不明" wins={detail.unknownWins} losses={detail.unknownLosses} total={detail.unknownTotal} winRate={detail.unknownWinRate} />
        </div>
      </div>
    </div>
  );
}
