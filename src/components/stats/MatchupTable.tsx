"use client";

import type { OpponentDetail } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import {
  displayDeckName,
  type OpponentDeckNameMap,
} from "@/lib/actions/opponent-deck-display";

type MatchupTableRow = { name: string; namePrefix?: string } & OpponentDetail;

type MatchupTableProps = {
  rows: MatchupTableRow[];
  showTotal?: boolean;
  opponentDeckNameMap?: OpponentDeckNameMap;
};

type SubRow = {
  label: string;
  labelColor: string;
  total: number;
  wins: number;
  losses: number;
  winRate: number;
};

function buildSubRows(d: OpponentDetail): SubRow[] {
  const subs: SubRow[] = [
    { label: "合計", labelColor: "#8888aa", total: d.total, wins: d.wins, losses: d.losses, winRate: d.winRate },
  ];
  if (d.firstTotal > 0) subs.push({ label: "先攻", labelColor: "#f0a030", total: d.firstTotal, wins: d.firstWins, losses: d.firstLosses, winRate: d.firstWinRate });
  if (d.secondTotal > 0) subs.push({ label: "後攻", labelColor: "#5b8def", total: d.secondTotal, wins: d.secondWins, losses: d.secondLosses, winRate: d.secondWinRate });
  if (d.unknownTotal > 0) subs.push({ label: "不明", labelColor: "#666688", total: d.unknownTotal, wins: d.unknownWins, losses: d.unknownLosses, winRate: d.unknownWinRate });
  return subs;
}

function calcOverall(rows: MatchupTableRow[]): OpponentDetail {
  const o: OpponentDetail = { wins: 0, losses: 0, total: 0, winRate: 0, firstWins: 0, firstLosses: 0, firstTotal: 0, firstWinRate: 0, secondWins: 0, secondLosses: 0, secondTotal: 0, secondWinRate: 0, unknownWins: 0, unknownLosses: 0, unknownTotal: 0, unknownWinRate: 0 };
  for (const r of rows) {
    o.wins += r.wins; o.losses += r.losses; o.total += r.total;
    o.firstWins += r.firstWins; o.firstLosses += r.firstLosses; o.firstTotal += r.firstTotal;
    o.secondWins += r.secondWins; o.secondLosses += r.secondLosses; o.secondTotal += r.secondTotal;
    o.unknownWins += r.unknownWins; o.unknownLosses += r.unknownLosses; o.unknownTotal += r.unknownTotal;
  }
  o.winRate = o.total > 0 ? Math.round(o.wins / o.total * 100) : 0;
  o.firstWinRate = o.firstTotal > 0 ? Math.round(o.firstWins / o.firstTotal * 100) : 0;
  o.secondWinRate = o.secondTotal > 0 ? Math.round(o.secondWins / o.secondTotal * 100) : 0;
  o.unknownWinRate = o.unknownTotal > 0 ? Math.round(o.unknownWins / o.unknownTotal * 100) : 0;
  return o;
}

export function MatchupTable({ rows, showTotal = true, opponentDeckNameMap }: MatchupTableProps) {
  const overall = showTotal ? calcOverall(rows) : null;
  const overallSubs = overall ? buildSubRows(overall) : [];

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ fontSize: 10, color: "#666688", fontWeight: 500, borderBottom: "1px solid #2a2d48" }}>
            <th style={{ textAlign: "left", padding: "4px 6px", position: "sticky", left: 0, zIndex: 1, background: "#1a1c2e", whiteSpace: "nowrap" }}>対面</th>
            <th style={{ textAlign: "left", padding: "4px 6px", whiteSpace: "nowrap" }}></th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>試合</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>勝利</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>敗北</th>
            <th style={{ textAlign: "right", padding: "4px 6px" }}>勝率</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, gi) => {
            const subs = buildSubRows(row);
            const bg = gi % 2 === 0 ? "rgba(91,141,239,0.04)" : "transparent";
            return subs.map((sub, si) => (
              <tr key={`${row.name}-${sub.label}`} style={{ background: bg, borderTop: si === 0 && gi > 0 ? "1px solid #2a2d48" : undefined }}>
                {si === 0 && (
                  <td rowSpan={subs.length} style={{ padding: "4px 6px", fontSize: 12, fontWeight: 500, verticalAlign: "top", position: "sticky", left: 0, zIndex: 1, background: bg, whiteSpace: "nowrap" }}>
                    {row.namePrefix}{displayDeckName(row.name, opponentDeckNameMap)}
                  </td>
                )}
                <td style={{ padding: "4px 6px", color: sub.labelColor, fontSize: 10, whiteSpace: "nowrap" }}>{sub.label}</td>
                <td style={{ textAlign: "right", padding: "4px 6px", color: si === 0 ? undefined : "#aaaacc" }}>{sub.total}</td>
                <td style={{ textAlign: "right", padding: "4px 6px", color: si === 0 ? undefined : "#aaaacc" }}>{sub.wins}</td>
                <td style={{ textAlign: "right", padding: "4px 6px", color: si === 0 ? undefined : "#aaaacc" }}>{sub.losses}</td>
                <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: si === 0 ? 500 : undefined, color: getWinRateColor(sub.winRate) }}>{sub.winRate}%</td>
              </tr>
            ));
          })}
          {overall && (
            <>
              {overallSubs.map((sub, si) => (
                <tr key={`overall-${sub.label}`} style={{ background: "rgba(91,141,239,0.04)", borderTop: si === 0 ? "2px solid #2a2d48" : undefined }}>
                  {si === 0 && (
                    <td rowSpan={overallSubs.length} style={{ padding: "4px 6px", fontSize: 12, fontWeight: 500, verticalAlign: "top", position: "sticky", left: 0, zIndex: 1, background: "rgba(91,141,239,0.04)", whiteSpace: "nowrap" }}>
                      全対面合計
                    </td>
                  )}
                  <td style={{ padding: "4px 6px", color: sub.labelColor, fontSize: 10, whiteSpace: "nowrap", fontWeight: 500 }}>{sub.label}</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500 }}>{sub.total}</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500 }}>{sub.wins}</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500 }}>{sub.losses}</td>
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500, color: getWinRateColor(sub.winRate) }}>{sub.winRate}%</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
