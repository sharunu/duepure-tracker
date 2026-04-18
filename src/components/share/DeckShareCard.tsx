"use client";

import { forwardRef } from "react";
import type { DeckShareData } from "./ShareButton";

type Props = {
  data: DeckShareData;
  type: "deck" | "opponent";
};

const MONO = "ui-monospace, 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace";
const UI = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function winRateColor(rate: number): string {
  if (rate < 0) return "#55586e";
  if (rate >= 50) return "#818cf8";
  return "#f87171";
}

function TurnStat({
  label,
  wins,
  losses,
  total,
  rate,
}: {
  label: string;
  wins: number;
  losses: number;
  total: number;
  rate: number;
}) {
  const rateColor = rate >= 0 ? winRateColor(rate) : "#55586e";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: "#e8eaf4",
          fontFamily: UI,
          letterSpacing: 2,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 400, color: "#8a8fa3", fontFamily: UI, letterSpacing: 0.8 }}>
          勝率
        </div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: rateColor,
            fontFamily: MONO,
            lineHeight: 1,
            letterSpacing: -1,
          }}
        >
          {rate >= 0 ? `${rate}%` : "—"}
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#8a8fa3",
          fontFamily: MONO,
          marginTop: 6,
          letterSpacing: 0.3,
        }}
      >
        {total > 0 ? `${wins}勝${losses}敗 / ${total}戦` : "0戦"}
      </div>
    </div>
  );
}

function MatchupRow({
  name,
  wins,
  losses,
  rate,
}: {
  name: string;
  wins: number;
  losses: number;
  rate: number;
}) {
  const barRate = Math.max(0, Math.min(100, rate));
  const color = winRateColor(rate);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 400,
            color: "#d6dae8",
            fontFamily: UI,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 680,
          }}
        >
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 400, color: "#8a8fa3", fontFamily: UI }}>勝率</div>
          <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1 }}>
            {rate}%
          </div>
          <div style={{ fontSize: 12, fontWeight: 400, color: "#55586e", fontFamily: MONO }}>
            {wins}-{losses}
          </div>
        </div>
      </div>
      <div
        style={{
          height: 3,
          background: "rgba(130,140,200,0.1)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", width: `${barRate}%`, background: color, opacity: 0.85 }} />
      </div>
    </div>
  );
}

export const DeckShareCard = forwardRef<HTMLDivElement, Props>(
  function DeckShareCard({ data, type }, ref) {
    const totalBattles = data.totalWins + data.totalLosses;
    const firstTotal = data.firstWins + data.firstLosses;
    const secondTotal = data.secondWins + data.secondLosses;
    const firstRate = firstTotal > 0 ? Math.round((data.firstWins / firstTotal) * 100) : -1;
    const secondRate = secondTotal > 0 ? Math.round((data.secondWins / secondTotal) * 100) : -1;

    const deckLabel = type === "opponent" ? "対戦相手" : "使用デッキ";
    const displayName = type === "opponent" ? `vs ${data.deckName}` : data.deckName;
    const matchupLabel = type === "opponent" ? "使用デッキ別" : "対面別勝率";
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
          fontFamily: UI,
          color: "#fff",
          background:
            "radial-gradient(circle at 50% 40%, rgba(99,102,241,0.18) 0%, transparent 55%), linear-gradient(180deg, #0a0b1f 0%, #13153a 60%, #0a0b1f 100%)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          padding: "36px 64px 28px 64px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 8,
                height: 26,
                background: "linear-gradient(180deg, #a5b4fc 0%, #6366f1 100%)",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#e8eaf4",
                letterSpacing: 1,
              }}
            >
              デュエプレトラッカー
            </div>
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: "#8a8fa3",
              fontFamily: MONO,
              letterSpacing: 0.5,
            }}
          >
            {data.period} · {data.format}
          </div>
        </div>

        {/* Main: Deck name + Win rate side by side */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 40,
            marginTop: 18,
            marginBottom: 10,
          }}
        >
          {/* Deck name block */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#a5b4fc",
                letterSpacing: 4,
                fontFamily: UI,
                marginBottom: 6,
              }}
            >
              {deckLabel}
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                color: "#f4f5fa",
                fontFamily: UI,
                lineHeight: 1.1,
                letterSpacing: 0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </div>
          </div>

          {/* Win rate block */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: "#a5b4fc",
                letterSpacing: 6,
                fontFamily: UI,
                marginBottom: -8,
                paddingRight: 6,
              }}
            >
              勝率
            </div>
            <svg width={260} height={140} viewBox="0 0 260 140" style={{ display: "block", overflow: "visible" }}>
              <defs>
                <linearGradient id="deckHeroGrad" x1="0" y1="0" x2="1" y2="1">
                  {data.winRate >= 50 ? (
                    <>
                      <stop offset="0%" stopColor="#c7d2fe" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#4338ca" />
                    </>
                  ) : (
                    <>
                      <stop offset="0%" stopColor="#fca5a5" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </>
                  )}
                </linearGradient>
              </defs>
              <text
                x="260"
                y="115"
                textAnchor="end"
                fontSize={128}
                fontWeight={900}
                fill="url(#deckHeroGrad)"
                fontFamily={MONO}
                letterSpacing={-4}
                style={{
                  filter:
                    data.winRate >= 50
                      ? "drop-shadow(0 6px 28px rgba(99,102,241,0.45))"
                      : "drop-shadow(0 6px 24px rgba(239,68,68,0.4))",
                }}
              >
                {data.winRate}%
              </text>
            </svg>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#d6dae8",
                fontFamily: UI,
                letterSpacing: 0.5,
                marginTop: -2,
              }}
            >
              {data.totalWins}勝 {data.totalLosses}敗{" "}
              <span style={{ color: "#6a6e85", fontSize: 13, fontWeight: 400, fontFamily: MONO }}>
                / {totalBattles}戦
              </span>
            </div>
          </div>
        </div>

        {/* Turn row (先攻 / 後攻) */}
        <div style={{ display: "flex", alignItems: "stretch", marginTop: 4 }}>
          <TurnStat
            label="先攻"
            wins={data.firstWins}
            losses={data.firstLosses}
            total={firstTotal}
            rate={firstRate}
          />
          <div style={{ width: 1, background: "rgba(130,140,200,0.14)" }} />
          <TurnStat
            label="後攻"
            wins={data.secondWins}
            losses={data.secondLosses}
            total={secondTotal}
            rate={secondRate}
          />
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(130,140,200,0.28) 20%, rgba(130,140,200,0.28) 80%, transparent 100%)",
            marginTop: 20,
            marginBottom: 16,
          }}
        />

        {/* Matchups */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#a5b4fc",
              letterSpacing: 3.5,
              fontFamily: UI,
              marginBottom: 10,
            }}
          >
            {matchupLabel} TOP{Math.min(5, data.topMatchups.length)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.topMatchups.slice(0, 5).map((m, i) => (
              <MatchupRow key={i} name={m.name} wins={m.wins} losses={m.losses} rate={m.winRate} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: "#55586e",
              fontFamily: MONO,
              letterSpacing: 0.5,
            }}
          >
            {appUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>
      </div>
    );
  }
);
