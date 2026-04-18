"use client";

import { forwardRef } from "react";
import type { StatsShareData } from "./ShareButton";

type Props = {
  data: StatsShareData;
};

const DONUT_COLORS = ["#6366f1", "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#64748b"];

function buildConicGradient(distribution: { percentage: number }[]) {
  const segments: string[] = [];
  let cumulative = 0;
  distribution.forEach((d, i) => {
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    segments.push(`${color} ${cumulative}% ${cumulative + d.percentage}%`);
    cumulative += d.percentage;
  });
  if (cumulative < 100) {
    segments.push(`#333 ${cumulative}% 100%`);
  }
  return `conic-gradient(${segments.join(", ")})`;
}

export const StatsShareCard = forwardRef<HTMLDivElement, Props>(
  function StatsShareCard({ data }, ref) {
    const totalBattles = data.totalWins + data.totalLosses;
    const firstTotal = data.firstWins + data.firstLosses;
    const secondTotal = data.secondWins + data.secondLosses;
    const unknownTotal = data.unknownWins + data.unknownLosses;
    const firstRate = firstTotal > 0 ? Math.round((data.firstWins / firstTotal) * 100) : -1;
    const secondRate = secondTotal > 0 ? Math.round((data.secondWins / secondTotal) * 100) : -1;
    const unknownRate = unknownTotal > 0 ? Math.round((data.unknownWins / unknownTotal) * 100) : -1;

    const turnCards = [
      { label: "先攻", color: "#f0a030", wins: data.firstWins, losses: data.firstLosses, total: firstTotal, rate: firstRate },
      { label: "後攻", color: "#5b8def", wins: data.secondWins, losses: data.secondLosses, total: secondTotal, rate: secondRate },
      { label: "不明", color: "#666688", wins: data.unknownWins, losses: data.unknownLosses, total: unknownTotal, rate: unknownRate },
    ];

    const winRateColor = data.winRate >= 50 ? "#5b8def" : "#e85d75";

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)",
          color: "#fff",
          fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
          padding: "32px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "absolute",
          left: -9999,
          top: -9999,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 22, color: "#818cf8", fontWeight: 700 }}>戦績サマリー</div>
          <div style={{ fontSize: 14, color: "#666" }}>{data.period} / {data.format}</div>
        </div>

        {/* Body: Donut chart + legend */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flex: 1, marginTop: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: "#818cf8", fontWeight: 700, marginBottom: 10 }}>対面デッキ分布</div>
            <div style={{ position: "relative", width: 240, height: 240 }}>
              {data.encounterDistribution.length > 0 ? (
                <>
                  <div
                    style={{
                      width: 240,
                      height: 240,
                      borderRadius: "50%",
                      background: buildConicGradient(data.encounterDistribution),
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 40,
                      left: 40,
                      width: 160,
                      height: 160,
                      borderRadius: "50%",
                      background: "#0f1129",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontSize: 14, color: "#888" }}>勝率</div>
                    <div style={{ fontSize: 42, fontWeight: 700, color: winRateColor, lineHeight: 1 }}>{data.winRate}%</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                      {data.totalWins}勝{data.totalLosses}敗 / {totalBattles}戦
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    width: 240,
                    height: 240,
                    borderRadius: "50%",
                    background: "#232640",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#666",
                    fontSize: 14,
                  }}
                >
                  データなし
                </div>
              )}
            </div>
          </div>

          {data.encounterDistribution.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 280, maxWidth: 360 }}>
              {data.encounterDistribution.slice(0, 6).map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: DONUT_COLORS[i % DONUT_COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: "#ccc",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 220,
                    }}
                  >
                    {d.name}
                  </span>
                  <span style={{ color: "#999", marginLeft: "auto", fontWeight: 700 }}>{d.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Turn order cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {turnCards.map((c) => (
            <div
              key={c.label}
              style={{
                background: "#232640",
                borderRadius: 10,
                padding: "14px 16px",
                textAlign: "center",
                borderTop: "3px solid " + c.color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 11, color: "#8888aa" }}>勝率</span>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: c.rate >= 0 ? (c.rate >= 50 ? "#5b8def" : "#e85d75") : "#8888aa",
                  }}
                >
                  {c.rate >= 0 ? c.rate + "%" : "-"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "#8888aa", marginTop: 2 }}>
                {c.total > 0 ? c.wins + "勝" + c.losses + "敗 / " + c.total + "戦" : "0戦"}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
          <div style={{ fontSize: 12, color: "#555" }}>{process.env.NEXT_PUBLIC_APP_URL ?? ""}</div>
        </div>
      </div>
    );
  }
);
