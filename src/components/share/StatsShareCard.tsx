"use client";

import { forwardRef } from "react";
import type { StatsShareData } from "./ShareButton";

type Props = {
  data: StatsShareData;
};

const DONUT_COLORS = ["#818cf8", "#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#64748b"];

function buildConicGradient(distribution: { percentage: number }[]) {
  const segments: string[] = [];
  let cumulative = 0;
  distribution.forEach((d, i) => {
    const color = DONUT_COLORS[i % DONUT_COLORS.length];
    segments.push(`${color} ${cumulative}% ${cumulative + d.percentage}%`);
    cumulative += d.percentage;
  });
  if (cumulative < 100) {
    segments.push(`#1a1d3a ${cumulative}% 100%`);
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
      { label: "不明", color: "#8a8aa0", wins: data.unknownWins, losses: data.unknownLosses, total: unknownTotal, rate: unknownRate },
    ];

    const winRateColor = data.winRate >= 50 ? "#5b8def" : "#e85d75";
    const appUrl = typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? "");

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)",
          color: "#fff",
          fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
          padding: "28px 56px 22px 56px",
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: -9999,
          top: -9999,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>デュエプレトラッカー</div>
            <div style={{ width: 1, height: 20, background: "#3a3d55" }} />
            <div style={{ fontSize: 16, fontWeight: 400, color: "#cbd0e0" }}>戦績サマリー</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 400, color: "#888" }}>{data.period} / {data.format}</div>
        </div>

        {/* Main body: Donut + Legend */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 64, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ position: "relative", width: 260, height: 260 }}>
              {data.encounterDistribution.length > 0 ? (
                <>
                  <div
                    style={{
                      width: 260,
                      height: 260,
                      borderRadius: "50%",
                      background: buildConicGradient(data.encounterDistribution),
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 56,
                      left: 56,
                      width: 148,
                      height: 148,
                      borderRadius: "50%",
                      background: "#0f1129",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 400, color: "#9aa0b4" }}>勝率</div>
                    <div style={{ fontSize: 52, fontWeight: 700, color: winRateColor, lineHeight: 1, marginTop: 2 }}>
                      {data.winRate}%
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3", marginTop: 6 }}>
                      {data.totalWins}勝{data.totalLosses}敗 / {totalBattles}戦
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    width: 260,
                    height: 260,
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
            <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8", marginTop: 10 }}>対面デッキ分布</div>
          </div>

          {data.encounterDistribution.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 320 }}>
              {data.encounterDistribution.slice(0, 6).map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15 }}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: DONUT_COLORS[i % DONUT_COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: "#d6dae8",
                      fontWeight: 400,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 240,
                    }}
                  >
                    {d.name}
                  </span>
                  <span style={{ color: "#9aa0b4", marginLeft: "auto", fontWeight: 700 }}>{d.percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Turn order cards */}
        <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
          {turnCards.map((c) => (
            <div
              key={c.label}
              style={{
                flex: 1,
                background: "#232640",
                borderRadius: 12,
                padding: "16px 20px 14px 20px",
                borderTop: "3px solid " + c.color,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: c.color, marginBottom: 4 }}>{c.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3" }}>勝率</span>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: c.rate >= 0 ? (c.rate >= 50 ? "#5b8def" : "#e85d75") : "#8a8fa3",
                    lineHeight: 1,
                  }}
                >
                  {c.rate >= 0 ? c.rate + "%" : "-"}
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3", marginTop: 4 }}>
                {c.total > 0 ? c.wins + "勝" + c.losses + "敗 / " + c.total + "戦" : "0戦"}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 400, color: "#555" }}>{appUrl}</div>
        </div>
      </div>
    );
  }
);
