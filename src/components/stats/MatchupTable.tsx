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
  labelColor: string;
  total: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
};

function buildSubRows(d: OpponentDetail): SubRow[] {
  const subs: SubRow[] = [
    { label: "合計", labelColor: "#8888aa", total: d.total, wins: d.wins, losses: d.losses, draws: d.draws, winRate: d.winRate },
  ];
  if (d.firstTotal > 0) subs.push({ label: "先攻", labelColor: "#f0a030", total: d.firstTotal, wins: d.firstWins, losses: d.firstLosses, draws: d.firstDraws, winRate: d.firstWinRate });
  if (d.secondTotal > 0) subs.push({ label: "後攻", labelColor: "#5b8def", total: d.secondTotal, wins: d.secondWins, losses: d.secondLosses, draws: d.secondDraws, winRate: d.secondWinRate });
  if (d.unknownTotal > 0) subs.push({ label: "不明", labelColor: "#666688", total: d.unknownTotal, wins: d.unknownWins, losses: d.unknownLosses, draws: d.unknownDraws, winRate: d.unknownWinRate });
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
  const pct = (rate: number | null) => rate === null ? null : Math.round(rate * 100);
  o.winRate = pct(computeWinRate(o.wins, o.losses));
  o.firstWinRate = pct(computeWinRate(o.firstWins, o.firstLosses));
  o.secondWinRate = pct(computeWinRate(o.secondWins, o.secondLosses));
  o.unknownWinRate = pct(computeWinRate(o.unknownWins, o.unknownLosses));
  return o;
}

export function MatchupTable({ rows, showTotal = true, opponentDeckNameMap, game }: MatchupTableProps) {
  const overall = showTotal ? calcOverall(rows) : null;
  const overallSubs = overall ? buildSubRows(overall) : [];
  const showDraws = supportsDraw(game);

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
            {showDraws && <th style={{ textAlign: "right", padding: "4px 6px" }}>引分</th>}
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
                {showDraws && <td style={{ textAlign: "right", padding: "4px 6px", color: si === 0 ? undefined : "#aaaacc" }}>{sub.draws}</td>}
                <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: si === 0 ? 500 : undefined, color: sub.winRate === null ? "#8888aa" : getWinRateColor(sub.winRate) }}>{sub.winRate === null ? "--" : sub.winRate}%</td>
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
                  {showDraws && <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500 }}>{sub.draws}</td>}
                  <td style={{ textAlign: "right", padding: "4px 6px", fontWeight: 500, color: sub.winRate === null ? "#8888aa" : getWinRateColor(sub.winRate) }}>{sub.winRate === null ? "--" : sub.winRate}%</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
