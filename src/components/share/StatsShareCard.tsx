"use client";

import { forwardRef } from "react";
import type { StatsShareData } from "./ShareButton";

type Props = {
  data: StatsShareData;
};

const CHIP_COLORS = ["#a5b4fc", "#818cf8", "#60a5fa", "#34d399", "#fbbf24", "#f87171"];
const MONO_FONT = "ui-monospace, 'SF Mono', 'Monaco', 'Cascadia Code', 'Menlo', 'Consolas', monospace";
const UI_FONT = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function winRateColor(rate: number): string {
  if (rate < 0) return "#55586e";
  if (rate >= 60) return "#60a5fa";
  if (rate >= 50) return "#818cf8";
  return "#f87171";
}

function TurnCard({
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
        height: 92,
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(26,29,58,0.6) 50%, rgba(10,11,31,0.4) 100%)",
        border: "1px solid rgba(130,140,200,0.15)",
        borderLeft: `3px solid ${color}`,
        borderRadius: 14,
        padding: "0 26px 0 22px",
        gap: 18,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          color: color,
          minWidth: 46,
          fontFamily: UI_FONT,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 54,
          fontWeight: 900,
          color: winRateColor(rate),
          lineHeight: 1,
          fontFamily: MONO_FONT,
          minWidth: 155,
          letterSpacing: -1,
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
          gap: 2,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: "#d6dae8", fontFamily: MONO_FONT, letterSpacing: 0.5 }}>
          {total > 0 ? `${wins}-${losses}` : "—"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 400, color: "#6a6e85", letterSpacing: 0.3 }}>
          {total > 0 ? `${total} games` : "0 games"}
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

    const heroGlow = data.winRate >= 50 ? "rgba(99,102,241,0.45)" : "rgba(248,113,113,0.35)";
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
          position: "absolute",
          left: -9999,
          top: -9999,
          overflow: "hidden",
          fontFamily: UI_FONT,
          color: "#fff",
          background:
            "radial-gradient(circle at 18% 22%, rgba(99,102,241,0.38) 0%, transparent 45%), radial-gradient(circle at 88% 85%, rgba(232,93,117,0.22) 0%, transparent 48%), linear-gradient(160deg, #0a0b1f 0%, #141636 60%, #0a0b1f 100%)",
          boxSizing: "border-box",
        }}
      >
        {/* Decorative grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(130,140,200,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(130,140,200,0.035) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            backgroundPosition: "center center",
          }}
        />

        {/* Glow orb behind hero number */}
        <div
          style={{
            position: "absolute",
            left: -40,
            top: 180,
            width: 560,
            height: 300,
            background: `radial-gradient(ellipse at center, ${heroGlow} 0%, transparent 70%)`,
            pointerEvents: "none",
            filter: "blur(20px)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: "38px 56px 28px 56px",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 8,
                  height: 28,
                  background: "linear-gradient(180deg, #a5b4fc 0%, #6366f1 100%)",
                  borderRadius: 2,
                  boxShadow: "0 0 12px rgba(129,140,248,0.6)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf4", letterSpacing: 0.5 }}>
                  デュエプレトラッカー
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#818cf8",
                    letterSpacing: 3,
                    fontFamily: MONO_FONT,
                  }}
                >
                  STATS SUMMARY
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "#8a8fa3",
                letterSpacing: 0.5,
                fontFamily: MONO_FONT,
              }}
            >
              {data.period} · {data.format}
            </div>
          </div>

          {/* Main body */}
          <div style={{ display: "flex", flex: 1, gap: 52, marginTop: 16, alignItems: "center" }}>
            {/* Hero win rate */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: "#a5b4fc",
                  marginBottom: 4,
                  fontFamily: MONO_FONT,
                }}
              >
                <div style={{ width: 20, height: 1, background: "#a5b4fc" }} />
                WIN RATE
                <div style={{ width: 20, height: 1, background: "#a5b4fc" }} />
              </div>
              <svg
                width={580}
                height={210}
                viewBox="0 0 580 210"
                style={{ display: "block", overflow: "visible", marginTop: 4 }}
              >
                <defs>
                  <linearGradient id="heroRateGrad" x1="0" y1="0" x2="1" y2="1">
                    {data.winRate >= 50 ? (
                      <>
                        <stop offset="0%" stopColor="#a5b4fc" />
                        <stop offset="35%" stopColor="#818cf8" />
                        <stop offset="70%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#4338ca" />
                      </>
                    ) : (
                      <>
                        <stop offset="0%" stopColor="#fca5a5" />
                        <stop offset="40%" stopColor="#f87171" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </>
                    )}
                  </linearGradient>
                </defs>
                <text
                  x="0"
                  y="175"
                  fontSize={228}
                  fontWeight={900}
                  fill="url(#heroRateGrad)"
                  fontFamily={MONO_FONT}
                  letterSpacing={-10}
                  style={{
                    filter: `drop-shadow(0 8px 40px ${heroGlow})`,
                  }}
                >
                  {data.winRate}%
                </text>
              </svg>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 18 }}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 900,
                    color: "#e8eaf4",
                    fontFamily: MONO_FONT,
                    letterSpacing: 0.5,
                  }}
                >
                  {data.totalWins}W {data.totalLosses}L
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 400,
                    color: "#6a6e85",
                    fontFamily: MONO_FONT,
                    letterSpacing: 0.5,
                  }}
                >
                  / {totalBattles} games
                </div>
              </div>
            </div>

            {/* Turn cards */}
            <div style={{ width: 516, display: "flex", flexDirection: "column", gap: 12 }}>
              <TurnCard
                label="先攻 · 1ST"
                color="#f0a030"
                wins={data.firstWins}
                losses={data.firstLosses}
                total={firstTotal}
                rate={firstRate}
              />
              <TurnCard
                label="後攻 · 2ND"
                color="#5b8def"
                wins={data.secondWins}
                losses={data.secondLosses}
                total={secondTotal}
                rate={secondRate}
              />
              <TurnCard
                label="不明 · N/A"
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 18,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#a5b4fc",
                  letterSpacing: 3,
                  fontFamily: MONO_FONT,
                }}
              >
                <div style={{ width: 16, height: 1, background: "#a5b4fc" }} />
                MATCHUPS
              </div>
              {distribution.map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 14px",
                    background: "rgba(26,29,58,0.65)",
                    borderRadius: 999,
                    border: "1px solid rgba(130,140,200,0.15)",
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: CHIP_COLORS[i % CHIP_COLORS.length],
                      boxShadow: `0 0 6px ${CHIP_COLORS[i % CHIP_COLORS.length]}`,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "#d6dae8",
                      maxWidth: 140,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: d.winRate !== undefined ? winRateColor(d.winRate) : "#9aa0b4",
                      fontFamily: MONO_FONT,
                    }}
                  >
                    {d.winRate !== undefined ? `${d.winRate}%` : `${d.percentage}%`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              marginTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 400,
                color: "#55586e",
                letterSpacing: 0.5,
                fontFamily: MONO_FONT,
              }}
            >
              {appUrl.replace(/^https?:\/\//, "")}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
