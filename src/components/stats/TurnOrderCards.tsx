"use client";

import { getWinRateColor } from "@/lib/stats-utils";

type TurnOrderCardsProps = {
  firstWins: number; firstLosses: number; firstTotal: number;
  secondWins: number; secondLosses: number; secondTotal: number;
  unknownWins: number; unknownLosses: number; unknownTotal: number;
};

export function TurnOrderCards(props: TurnOrderCardsProps) {
  const cards = [
    { label: "先攻", color: "#f0a030", wins: props.firstWins, losses: props.firstLosses, total: props.firstTotal },
    { label: "後攻", color: "#5b8def", wins: props.secondWins, losses: props.secondLosses, total: props.secondTotal },
    { label: "不明", color: "#666688", wins: props.unknownWins, losses: props.unknownLosses, total: props.unknownTotal },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
      {cards.map((c) => {
        const rate = c.total > 0 ? Math.round((c.wins / c.total) * 100) : -1;
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
              <span style={{ fontSize: 20, fontWeight: 500, color: rate >= 0 ? getWinRateColor(rate) : "#8888aa" }}>
                {rate >= 0 ? `${rate}%` : "-"}
              </span>
            </div>
            <div style={{ fontSize: 9, color: "#8888aa" }}>
              {c.total > 0 ? `${c.wins}勝${c.losses}敗 / ${c.total}件` : "0件"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
