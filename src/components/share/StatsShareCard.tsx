"use client";

import { forwardRef } from "react";
import type { StatsShareData } from "./ShareButton";

type Props = {
  data: StatsShareData;
};

const CHIP_COLORS = ["#818cf8", "#6366f1", "#38bdf8", "#34d399", "#fbbf24", "#64748b"];

function winRateColor(rate: number): string {
  if (rate < 0) return "#8a8fa3";
  if (rate >= 50) return "#5b8def";
  return "#e85d75";
}

function TurnRow({
  label,
  color,
  wins,
  losses,
  total,
  rate,
}: {
  label: string;
  color: string;
  wins: number;
  losses: number;
  total: number;
  rate: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 92,
        background: "#1a1d3a",
        borderRadius: 14,
        paddingLeft: 23,
        paddingRight: 28,
        borderLeft: "5px solid " + color,
        gap: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 20,
          fontWeight: 700,
          color: color,
          minWidth: 60,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontSize: 54,
          fontWeight: 700,
          color: rate >= 0 ? winRateColor(rate) : "#55586e",
          minWidth: 150,
          lineHeight: 1,
        }}
      >
        {rate >= 0 ? `${rate}%` : "—"}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginLeft: "auto",
          alignItems: "flex-end",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#d6dae8" }}>
          {total > 0 ? `${wins}-${losses}` : "—"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 400, color: "#8a8fa3", marginTop: 2 }}>
          {total > 0 ? `${total}戦` : "0戦"}
        </div>
      </div>
    </div>
  );
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

    const heroColor = winRateColor(data.winRate);
    const distribution = (data.encounterDistribution ?? []).slice(0, 5);
    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "";

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0b0d24 0%, #1a1d3a 55%, #0b0d24 100%)",
          color: "#fff",
          fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
          padding: "36px 56px 26px 56px",
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: -9999,
          top: -9999,
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
              }}
            />
            <div style={{ fontSize: 18, fontWeight: 700, color: "#cbd0e0", letterSpacing: 0.5 }}>
              デュエプレトラッカー
            </div>
            <div style={{ width: 1, height: 18, background: "#3a3d55" }} />
            <div style={{ fontSize: 15, fontWeight: 400, color: "#8a8fa3" }}>戦績サマリー</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 400, color: "#8a8fa3" }}>
            {data.period} · {data.format}
          </div>
        </div>

        {/* Main: Hero + Turn stats */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, marginTop: 16 }}>
          {/* Hero win rate */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              alignItems: "flex-start",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 400, color: "#9aa0b4", letterSpacing: 2 }}>
              WIN RATE
            </div>
            <div
              style={{
                fontSize: 200,
                fontWeight: 700,
                color: heroColor,
                lineHeight: 1,
                marginTop: 4,
                letterSpacing: -4,
              }}
            >
              {data.winRate}%
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 18 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: "#e8eaf4" }}>
                {data.totalWins}勝 {data.totalLosses}敗
              </div>
              <div style={{ fontSize: 18, fontWeight: 400, color: "#8a8fa3" }}>
                / {totalBattles}戦
              </div>
            </div>
          </div>

          {/* Turn stats */}
          <div style={{ display: "flex", flexDirection: "column", width: 560, gap: 14 }}>
            <TurnRow
              label="先攻"
              color="#f0a030"
              wins={data.firstWins}
              losses={data.firstLosses}
              total={firstTotal}
              rate={firstRate}
            />
            <TurnRow
              label="後攻"
              color="#5b8def"
              wins={data.secondWins}
              losses={data.secondLosses}
              total={secondTotal}
              rate={secondRate}
            />
            <TurnRow
              label="不明"
              color="#8a8aa0"
              wins={data.unknownWins}
              losses={data.unknownLosses}
              total={unknownTotal}
              rate={unknownRate}
            />
          </div>
        </div>

        {/* Matchup chips */}
        {distribution.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 20, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", letterSpacing: 1.5 }}>
              MATCHUPS
            </div>
            {distribution.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  background: "rgba(26,29,58,0.7)",
                  borderRadius: 999,
                  border: "1px solid #2a2d48",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: CHIP_COLORS[i % CHIP_COLORS.length],
                  }}
                />
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#d6dae8",
                    maxWidth: 130,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: d.winRate !== undefined ? winRateColor(d.winRate) : "#9aa0b4",
                  }}
                >
                  {d.winRate !== undefined ? `${d.winRate}%` : `${d.percentage}%`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 400, color: "#55586e", letterSpacing: 0.3 }}>
            {appUrl}
          </div>
        </div>
      </div>
    );
  }
);
