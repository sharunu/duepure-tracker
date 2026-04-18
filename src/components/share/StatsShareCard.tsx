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
  accent,
  wins,
  losses,
  total,
  rate,
}: {
  label: string;
  accent: string;
  wins: number;
  losses: number;
  total: number;
  rate: number;
}) {
  const barRate = rate >= 0 ? rate : 0;
  const rateColor = rate >= 0 ? winRateColor(rate) : "#55586e";
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(26,29,58,0.75) 50%, rgba(10,11,31,0.55) 100%)",
        border: "1px solid rgba(130,140,200,0.18)",
        borderRadius: 14,
        padding: "16px 24px 14px 22px",
        gap: 8,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          background: accent,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: accent,
            minWidth: 80,
            fontFamily: UI_FONT,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: rateColor,
            lineHeight: 1,
            fontFamily: MONO_FONT,
            minWidth: 135,
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
          <div style={{ fontSize: 17, fontWeight: 700, color: "#d6dae8", fontFamily: MONO_FONT, letterSpacing: 0.5 }}>
            {total > 0 ? `${wins}-${losses}` : "—"}
          </div>
          <div style={{ fontSize: 10, fontWeight: 400, color: "#6a6e85", letterSpacing: 0.3 }}>
            {total > 0 ? `${total} games` : "0 games"}
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 999,
          overflow: "hidden",
          marginLeft: 6,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${barRate}%`,
            background: rate >= 0 ? `linear-gradient(90deg, ${accent} 0%, ${rateColor} 100%)` : "transparent",
            boxShadow: rate >= 0 ? `0 0 8px ${rateColor}` : "none",
          }}
        />
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

    const heroGlow = data.winRate >= 50 ? "rgba(99,102,241,0.55)" : "rgba(248,113,113,0.45)";
    const heroStroke = data.winRate >= 50 ? "#6366f1" : "#ef4444";
    const distribution = (data.encounterDistribution ?? []).slice(0, 5);
    const appUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? "";

    // Arc params for hero circular gauge
    const GAUGE_CX = 220;
    const GAUGE_CY = 200;
    const GAUGE_R = 178;
    const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;
    const GAUGE_FILLED = (GAUGE_CIRCUMFERENCE * data.winRate) / 100;

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
            "radial-gradient(circle at 18% 22%, rgba(99,102,241,0.42) 0%, transparent 45%), radial-gradient(circle at 88% 85%, rgba(232,93,117,0.22) 0%, transparent 48%), linear-gradient(160deg, #07081a 0%, #13153a 55%, #07081a 100%)",
          boxSizing: "border-box",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background:
              "linear-gradient(90deg, transparent 0%, #818cf8 18%, #6366f1 45%, #60a5fa 72%, transparent 100%)",
            boxShadow: "0 0 18px rgba(99,102,241,0.45)",
          }}
        />
        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background:
              "linear-gradient(90deg, transparent 0%, #f0a030 25%, #818cf8 55%, #8a8aa0 80%, transparent 100%)",
            boxShadow: "0 0 12px rgba(129,140,248,0.3)",
          }}
        />

        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage:
              "linear-gradient(rgba(130,140,200,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(130,140,200,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            backgroundPosition: "center center",
            opacity: 0.8,
          }}
        />

        {/* Glow orb */}
        <div
          style={{
            position: "absolute",
            left: -40,
            top: 160,
            width: 600,
            height: 340,
            background: `radial-gradient(ellipse at center, ${heroGlow} 0%, transparent 70%)`,
            pointerEvents: "none",
            filter: "blur(22px)",
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
            padding: "36px 56px 30px 56px",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 10,
                  height: 30,
                  background: "linear-gradient(180deg, #a5b4fc 0%, #6366f1 100%)",
                  borderRadius: 2,
                  boxShadow: "0 0 14px rgba(129,140,248,0.7)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <svg width={280} height={26} viewBox="0 0 280 26" style={{ display: "block" }}>
                  <defs>
                    <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#e8eaf4" />
                      <stop offset="100%" stopColor="#a5b4fc" />
                    </linearGradient>
                  </defs>
                  <text
                    x="0"
                    y="20"
                    fontSize={19}
                    fontWeight={700}
                    fill="url(#logoGrad)"
                    fontFamily={UI_FONT}
                    letterSpacing={0.5}
                  >
                    デュエプレトラッカー
                  </text>
                </svg>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#818cf8",
                    letterSpacing: 3.5,
                    fontFamily: MONO_FONT,
                  }}
                >
                  STATS SUMMARY
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 3,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 400,
                  color: "#8a8fa3",
                  letterSpacing: 0.5,
                  fontFamily: MONO_FONT,
                }}
              >
                {data.period}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#a5b4fc",
                  letterSpacing: 3.5,
                  fontFamily: MONO_FONT,
                  padding: "2px 8px",
                  border: "1px solid rgba(165,180,252,0.35)",
                  borderRadius: 4,
                }}
              >
                {data.format}
              </div>
            </div>
          </div>

          {/* Main body */}
          <div style={{ display: "flex", flex: 1, gap: 52, marginTop: 14, alignItems: "center" }}>
            {/* Hero section with circular gauge */}
            <div style={{ display: "flex", flexDirection: "column", flex: 1, position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: "#a5b4fc",
                  marginBottom: 2,
                  fontFamily: MONO_FONT,
                }}
              >
                <div style={{ width: 20, height: 1, background: "#a5b4fc" }} />
                WIN RATE
                <div style={{ width: 20, height: 1, background: "#a5b4fc" }} />
              </div>
              {/* SVG with circular gauge BG + gradient hero text */}
              <svg
                width={460}
                height={260}
                viewBox="0 0 460 260"
                style={{ display: "block", overflow: "visible", marginTop: 0, marginLeft: -20 }}
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
                  <linearGradient id="gaugeStroke" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={heroStroke} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={heroStroke} stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                {/* Background circle (full) */}
                <circle
                  cx={GAUGE_CX}
                  cy={GAUGE_CY}
                  r={GAUGE_R}
                  fill="none"
                  stroke="rgba(130,140,200,0.12)"
                  strokeWidth={3}
                />
                {/* Progress arc */}
                <circle
                  cx={GAUGE_CX}
                  cy={GAUGE_CY}
                  r={GAUGE_R}
                  fill="none"
                  stroke="url(#gaugeStroke)"
                  strokeWidth={6}
                  strokeDasharray={`${GAUGE_FILLED} ${GAUGE_CIRCUMFERENCE - GAUGE_FILLED}`}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${GAUGE_CX} ${GAUGE_CY})`}
                  style={{ filter: `drop-shadow(0 0 8px ${heroGlow})` }}
                />
                {/* Big percent text */}
                <text
                  x="0"
                  y="215"
                  fontSize={228}
                  fontWeight={900}
                  fill="url(#heroRateGrad)"
                  fontFamily={MONO_FONT}
                  letterSpacing={-10}
                  style={{ filter: `drop-shadow(0 6px 24px ${heroGlow})` }}
                >
                  {data.winRate}%
                </text>
              </svg>

              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#e8eaf4",
                    fontFamily: MONO_FONT,
                    letterSpacing: 0.5,
                  }}
                >
                  <span>{data.totalWins}</span>
                  <span style={{ color: "#6a6e85", fontSize: 18, fontWeight: 700, marginLeft: -2 }}>W</span>
                  <span style={{ color: "#3a3d55", margin: "0 6px", fontSize: 20 }}>·</span>
                  <span>{data.totalLosses}</span>
                  <span style={{ color: "#6a6e85", fontSize: 18, fontWeight: 700, marginLeft: -2 }}>L</span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 400,
                    color: "#6a6e85",
                    fontFamily: MONO_FONT,
                    letterSpacing: 0.5,
                  }}
                >
                  / {totalBattles} GAMES
                </div>
              </div>
            </div>

            {/* Turn cards */}
            <div style={{ width: 540, display: "flex", flexDirection: "column", gap: 12 }}>
              <TurnCard
                label="先攻"
                accent="#f0a030"
                wins={data.firstWins}
                losses={data.firstLosses}
                total={firstTotal}
                rate={firstRate}
              />
              <TurnCard
                label="後攻"
                accent="#5b8def"
                wins={data.secondWins}
                losses={data.secondLosses}
                total={secondTotal}
                rate={secondRate}
              />
              <TurnCard
                label="先後不明"
                accent="#a78bfa"
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
                gap: 12,
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
                  letterSpacing: 3.5,
                  fontFamily: MONO_FONT,
                }}
              >
                <div style={{ width: 16, height: 1, background: "#a5b4fc" }} />
                MATCHUPS
              </div>
              {distribution.map((d, i) => {
                const c = CHIP_COLORS[i % CHIP_COLORS.length];
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 14px 8px 10px",
                      background: "rgba(26,29,58,0.7)",
                      borderRadius: 999,
                      border: "1px solid rgba(130,140,200,0.18)",
                    }}
                  >
                    <div
                      style={{
                        width: 3,
                        height: 14,
                        borderRadius: 2,
                        background: c,
                        boxShadow: `0 0 8px ${c}`,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 400,
                        color: "#e8eaf4",
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
                        fontSize: 13,
                        fontWeight: 700,
                        color: d.winRate !== undefined ? winRateColor(d.winRate) : "#9aa0b4",
                        fontFamily: MONO_FONT,
                      }}
                    >
                      {d.winRate !== undefined ? `${d.winRate}%` : `${d.percentage}%`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#3a3d55",
                letterSpacing: 2.5,
                fontFamily: MONO_FONT,
              }}
            >
              SHARED VIA
            </div>
            <div
              style={{
                fontSize: 11,
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
