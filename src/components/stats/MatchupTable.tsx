"use client";

import type { OpponentDetail } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import {
  displayDeckName,
  type OpponentDeckNameMap,
} from "@/lib/actions/opponent-deck-display";
import { supportsDraw, winRate as computeWinRate } from "@/lib/battle/result-format";

type MatchupTableRow = { name: string; namePrefix?: string } & OpponentDetail;

type MatchupTableProps = {
  rows: MatchupTableRow[];
  showTotal?: boolean;
  opponentDeckNameMap?: OpponentDeckNameMap;
  game: string;
};

type SubRow = {
  label: string;
  labelClass: string;
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
};

function buildSubRows(d: OpponentDetail): SubRow[] {
  const subs: SubRow[] = [
    { label: "合計", labelClass: "text-muted-foreground", total: d.total, wins: d.wins, losses: d.losses, draws: d.draws, winRate: d.winRate },
  ];
  if (d.firstTotal > 0) subs.push({ label: "先攻", labelClass: "text-warning", total: d.firstTotal, wins: d.firstWins, losses: d.firstLosses, draws: d.firstDraws, winRate: d.firstWinRate });
  if (d.secondTotal > 0) subs.push({ label: "後攻", labelClass: "text-primary", total: d.secondTotal, wins: d.secondWins, losses: d.secondLosses, draws: d.secondDraws, winRate: d.secondWinRate });
  if (d.unknownTotal > 0) subs.push({ label: "不明", labelClass: "text-muted-foreground", total: d.unknownTotal, wins: d.unknownWins, losses: d.unknownLosses, draws: d.unknownDraws, winRate: d.unknownWinRate });
  return subs;
}

function calcOverall(rows: MatchupTableRow[]): OpponentDetail {
  const o: OpponentDetail = {
    wins: 0, losses: 0, draws: 0, total: 0, winRate: null,
    firstWins: 0, firstLosses: 0, firstDraws: 0, firstTotal: 0, firstWinRate: null,
    secondWins: 0, secondLosses: 0, secondDraws: 0, secondTotal: 0, secondWinRate: null,
    unknownWins: 0, unknownLosses: 0, unknownDraws: 0, unknownTotal: 0, unknownWinRate: null,
  };
  for (const r of rows) {
    o.wins += r.wins; o.losses += r.losses; o.draws += r.draws; o.total += r.total;
    o.firstWins += r.firstWins; o.firstLosses += r.firstLosses; o.firstDraws += r.firstDraws; o.firstTotal += r.firstTotal;
    o.secondWins += r.secondWins; o.secondLosses += r.secondLosses; o.secondDraws += r.secondDraws; o.secondTotal += r.secondTotal;
    o.unknownWins += r.unknownWins; o.unknownLosses += r.unknownLosses; o.unknownDraws += r.unknownDraws; o.unknownTotal += r.unknownTotal;
  }
  o.winRate = computeWinRate(o.wins, o.losses);
  o.firstWinRate = computeWinRate(o.firstWins, o.firstLosses);
  o.secondWinRate = computeWinRate(o.secondWins, o.secondLosses);
  o.unknownWinRate = computeWinRate(o.unknownWins, o.unknownLosses);
  return o;
}

export function MatchupTable({ rows, showTotal = true, opponentDeckNameMap, game }: MatchupTableProps) {
  const overall = showTotal ? calcOverall(rows) : null;
  const overallSubs = overall ? buildSubRows(overall) : [];
  const showDraws = supportsDraw(game);

  return (
    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-[10px] text-muted-foreground font-medium border-b border-border-subtle">
            <th className="text-left px-1.5 py-1 sticky left-0 z-[1] bg-surface-1 whitespace-nowrap">対面</th>
            <th className="text-left px-1.5 py-1 whitespace-nowrap"></th>
            <th className="text-right px-1.5 py-1">試合</th>
            <th className="text-right px-1.5 py-1">勝利</th>
            <th className="text-right px-1.5 py-1">敗北</th>
            {showDraws && <th className="text-right px-1.5 py-1">引分</th>}
            <th className="text-right px-1.5 py-1">勝率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, gi) => {
            const subs = buildSubRows(row);
            const bgClass = gi % 2 === 0 ? "bg-primary/5" : "";
            return subs.map((sub, si) => (
              <tr
                key={`${row.name}-${sub.label}`}
                className={`${bgClass} ${si === 0 && gi > 0 ? "border-t border-border-subtle" : ""}`}
              >
                {si === 0 && (
                  <td
                    rowSpan={subs.length}
                    className={`px-1.5 py-1 text-xs font-medium align-top sticky left-0 z-[1] whitespace-nowrap ${bgClass || "bg-background"}`}
                  >
                    {row.namePrefix}{displayDeckName(row.name, opponentDeckNameMap)}
                  </td>
                )}
                <td className={`px-1.5 py-1 text-[10px] whitespace-nowrap ${sub.labelClass}`}>{sub.label}</td>
                <td className={`text-right px-1.5 py-1 ${si === 0 ? "" : "text-muted-foreground"}`}>{sub.total}</td>
                <td className={`text-right px-1.5 py-1 ${si === 0 ? "" : "text-muted-foreground"}`}>{sub.wins}</td>
                <td className={`text-right px-1.5 py-1 ${si === 0 ? "" : "text-muted-foreground"}`}>{sub.losses}</td>
                {showDraws && <td className={`text-right px-1.5 py-1 ${si === 0 ? "" : "text-muted-foreground"}`}>{sub.draws}</td>}
                <td
                  className={`text-right px-1.5 py-1 ${si === 0 ? "font-medium" : ""}`}
                  style={{ color: sub.winRate === null ? "var(--muted-foreground)" : getWinRateColor(sub.winRate) }}
                >
                  {sub.winRate === null ? "--" : sub.winRate}%
                </td>
              </tr>
            ));
          })}
          {overall && (
            <>
              {overallSubs.map((sub, si) => (
                <tr
                  key={`overall-${sub.label}`}
                  className={`bg-primary/5 ${si === 0 ? "border-t-2 border-border-subtle" : ""}`}
                >
                  {si === 0 && (
                    <td
                      rowSpan={overallSubs.length}
                      className="px-1.5 py-1 text-xs font-medium align-top sticky left-0 z-[1] bg-primary/5 whitespace-nowrap"
                    >
                      全対面合計
                    </td>
                  )}
                  <td className={`px-1.5 py-1 text-[10px] whitespace-nowrap font-medium ${sub.labelClass}`}>{sub.label}</td>
                  <td className="text-right px-1.5 py-1 font-medium">{sub.total}</td>
                  <td className="text-right px-1.5 py-1 font-medium">{sub.wins}</td>
                  <td className="text-right px-1.5 py-1 font-medium">{sub.losses}</td>
                  {showDraws && <td className="text-right px-1.5 py-1 font-medium">{sub.draws}</td>}
                  <td
                    className="text-right px-1.5 py-1 font-medium"
                    style={{ color: sub.winRate === null ? "var(--muted-foreground)" : getWinRateColor(sub.winRate) }}
                  >
                    {sub.winRate === null ? "--" : sub.winRate}%
                  </td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
