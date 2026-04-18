"use client";

import { forwardRef } from "react";
import type { StatsShareData } from "./ShareButton";

type Props = {
  data: StatsShareData;
};

const DONUT_COLORS = ["#6366f1", "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#777"];

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
    const firstRate = firstTotal > 0 ? Math.round((data.firstWins / firstTotal) * 100) : 0;
    const secondRate = secondTotal > 0 ? Math.round((data.secondWins / secondTotal) * 100) : 0;

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)",
          color: "#fff",
          fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
          padding: "40px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "absolute",
          left: -9999,
          top: -9999,
        }}
      >
        {/* Row 1: Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, color: "#818cf8", fontWeight: 600 }}>戦績サマリー</div>
          <div style={{ fontSize: 13, color: "#555" }}>{data.period} / {data.format}</div>
        </div>

        {/* Row 2: Win rate + Turn order cards */}
        <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 8 }}>
          {/* Main win rate */}
          <div style={{ textAlign: "center", minWidth: 220 }}>
            <div style={{ fontSize: 72, fontWeight: 700, color: data.winRate >= 50 ? "#5b8def" : "#e85d75", lineHeight: 1 }}>
              {data.winRate}%
            </div>
            <div style={{ fontSize: 18, color: "#888", marginTop: 8 }}>
              {data.totalWins}勝 {data.totalLosses}敗 / {totalBattles}戦
            </div>
          </div>

          {/* Turn order cards */}
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ background: "rgba(99,102,241,0.12)", borderRadius: 12, padding: "14px 24px", minWidth: 140, textAlign: "center", border: "1px solid rgba(99,102,241,0.2)" }}>
              <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600, marginBottom: 6 }}>先攻</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{firstRate}%</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{data.firstWins}勝 {data.firstLosses}敗</div>
            </div>
            <div style={{ background: "rgba(56,189,248,0.12)", borderRadius: 12, padding: "14px 24px", minWidth: 140, textAlign: "center", border: "1px solid rgba(56,189,248,0.2)" }}>
              <div style={{ fontSize: 12, color: "#38bdf8", fontWeight: 600, marginBottom: 6 }}>後攻</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{secondRate}%</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{data.secondWins}勝 {data.secondLosses}敗</div>
            </div>
          </div>
        </div>

        {/* Row 3: Donut chart + Deck lists */}
        <div style={{ display: "flex", gap: 36, flex: 1, alignItems: "center", marginTop: 12 }}>
          {/* Donut chart */}
          {data.encounterDistribution.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 240 }}>
              <div style={{ fontSize: 13, color: "#818cf8", fontWeight: 600, marginBottom: 10 }}>対面分布</div>
              <div style={{ position: "relative", width: 140, height: 140 }}>
                <div style={{
                  width: 140, height: 140, borderRadius: "50%",
                  background: buildConicGradient(data.encounterDistribution),
                }} />
                <div style={{
                  position: "absolute", top: 25, left: 25, width: 90, height: 90,
                  borderRadius: "50%", background: "#151832",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: "#888",
                }}>{totalBattles}戦</div>
              </div>
              {/* Legend */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8, maxWidth: 240, justifyContent: "center" }}>
                {data.encounterDistribution.slice(0, 5).map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#999" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My decks Top3 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#818cf8", marginBottom: 10, fontWeight: 600 }}>使用デッキ Top3</div>
            {data.topMyDecks.slice(0, 3).map((d, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 3 }}>
                  <span style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{d.name}</span>
                  <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{d.winRate}% <span style={{ color: "#666", fontSize: 11 }}>({d.wins}-{d.losses})</span></span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "#1e2138", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.winRate}%`, borderRadius: 2, background: d.winRate >= 50 ? "#5b8def" : "#e85d75" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Opponent decks Top3 */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "#818cf8", marginBottom: 10, fontWeight: 600 }}>対面デッキ Top3</div>
            {data.topOpponentDecks.slice(0, 3).map((d, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 3 }}>
                  <span style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{d.name}</span>
                  <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{d.winRate}% <span style={{ color: "#666", fontSize: 11 }}>({d.wins}-{d.losses})</span></span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "#1e2138", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.winRate}%`, borderRadius: 2, background: d.winRate >= 50 ? "#5b8def" : "#e85d75" }} />
                </div>
              </div>
            ))}
          </div>
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
