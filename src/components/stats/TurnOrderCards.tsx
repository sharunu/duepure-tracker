"use client";

import { getWinRateColor } from "@/lib/stats-utils";
import { formatWLTJa, winRate as computeWinRate } from "@/lib/battle/result-format";

type TurnOrderCardsProps = {
  firstWins: number; firstLosses: number; firstDraws: number; firstTotal: number;
  secondWins: number; secondLosses: number; secondDraws: number; secondTotal: number;
  unknownWins: number; unknownLosses: number; unknownDraws: number; unknownTotal: number;
  game: string;
};

export function TurnOrderCards(props: TurnOrderCardsProps) {
  const cards = [
    { label: "先攻", color: "#f0a030", wins: props.firstWins, losses: props.firstLosses, draws: props.firstDraws, total: props.firstTotal },
    { label: "後攻", color: "#5b8def", wins: props.secondWins, losses: props.secondLosses, draws: props.secondDraws, total: props.secondTotal },
    { label: "不明", color: "#666688", wins: props.unknownWins, losses: props.unknownLosses, draws: props.unknownDraws, total: props.unknownTotal },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {cards.map((c) => {
        const rate = computeWinRate(c.wins, c.losses);
        return (
          <div
            key={c.label}
            style={{
              background: "#232640",
              borderRadius: 8,
              padding: 10,
              textAlign: "center",
              borderTop: `2px solid ${c.color}`,
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 500, color: c.color }}>{c.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
              <span style={{ fontSize: 10, color: "#8888aa" }}>勝率</span>
              <span style={{ fontSize: 20, fontWeight: 500, color: getWinRateColor(rate) }}>
                {rate !== null ? `${rate}%` : "--%"}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "#8888aa" }}>
              {c.total > 0 ? `${formatWLTJa(c.wins, c.losses, c.draws, props.game)} / ${c.total}件` : "0件"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
