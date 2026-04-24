"use client";

import { forwardRef } from "react";
import type { CSSProperties } from "react";
import { useGame } from "@/lib/games/context";
import { formatWLTJa } from "@/lib/battle/result-format";
import type { StatsShareData } from "./ShareButton";

type Props = {
  data: StatsShareData;
};

const UI = "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO = "ui-monospace, 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace";

const shellStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 78px), repeating-linear-gradient(0deg, rgba(255,255,255,0.014) 0 1px, transparent 1px 78px), linear-gradient(135deg, #070914 0%, #0b1322 54%, #111023 100%)",
};

function calcRate(wins: number, losses: number): number | null {
  const total = wins + losses;
  return total > 0 ? Math.round((wins / total) * 100) : null;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function rateText(rate: number | null | undefined): string {
  return rate === null || rate === undefined || rate < 0 ? "--%" : `${rate}%`;
}

function rateColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || rate < 0) return "#7b8197";
  if (rate >= 70) return "#2dd4bf";
  if (rate >= 50) return "#8b9bff";
  return "#fb7185";
}

function accentColor(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || rate < 0) return "#8b9bff";
  if (rate >= 70) return "#2dd4bf";
  if (rate >= 50) return "#8b9bff";
  return "#fb7185";
}

function ResultTile({
  label,
  wins,
  losses,
  draws,
  game,
}: {
  label: string;
  wins: number;
  losses: number;
  draws: number;
  game: string;
}) {
  const ratedTotal = wins + losses;
  const total = ratedTotal + draws;
  const rate = calcRate(wins, losses);
  const color = rateColor(rate);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        border: "1px solid rgba(148,163,184,0.16)",
        background: "linear-gradient(180deg, rgba(17,24,39,0.78) 0%, rgba(15,23,42,0.58) 100%)",
        borderRadius: 8,
        padding: "15px 16px 14px",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: "#f5f7ff", lineHeight: 1.1 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 900, color, lineHeight: 0.9 }}>
          {rateText(rate)}
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#aab1c5", marginTop: 10 }}>
        {total > 0 ? formatWLTJa(wins, losses, draws, game) : "0戦"}
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 999,
          background: "rgba(148,163,184,0.16)",
          overflow: "hidden",
          marginTop: 12,
        }}
      >
        <div
          style={{
            width: `${rate === null ? 0 : clampPercent(rate)}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function EncounterRow({
  item,
  maxCount,
}: {
  item: StatsShareData["encounterDistribution"][number];
  maxCount: number;
}) {
  const color = rateColor(item.winRate);
  const width = maxCount > 0 ? Math.max(8, (item.count / maxCount) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 30 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 15,
            fontWeight: 800,
            color: "#e6eaf5",
            lineHeight: "26px",
            height: 26,
            paddingBottom: 4,
            boxSizing: "content-box",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.name}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 900, color, lineHeight: "26px" }}>
          {rateText(item.winRate)}
        </div>
        <div style={{ width: 58, textAlign: "right", fontSize: 12, fontWeight: 700, color: "#8e96aa", lineHeight: "26px" }}>
          {item.count}戦
        </div>
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: "rgba(148,163,184,0.14)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${color} 0%, rgba(255,255,255,0.82) 100%)`,
          }}
        />
      </div>
    </div>
  );
}

export const StatsShareCard = forwardRef<HTMLDivElement, Props>(
  function StatsShareCard({ data }, ref) {
    const { trackerName } = useGame();
    const totalBattles = data.totalWins + data.totalLosses + data.totalDraws;
    const firstRate = calcRate(data.firstWins, data.firstLosses);
    const secondRate = calcRate(data.secondWins, data.secondLosses);
    const unknownRate = calcRate(data.unknownWins, data.unknownLosses);
    const heroColor = accentColor(data.winRate);
    const encounters = (data.encounterDistribution ?? []).slice(0, 5);
    const maxEncounterCount = Math.max(1, ...encounters.map((item) => item.count));
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
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          padding: "38px 52px 28px",
          isolation: "isolate",
        }}
      >
        <div style={shellStyle} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 5,
            opacity: 0.86,
            background: `linear-gradient(90deg, ${heroColor} 0%, #38bdf8 42%, #f59e0b 72%, rgba(245,158,11,0.12) 100%)`,
          }}
        />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 9,
                  height: 34,
                  borderRadius: 3,
                  background: `linear-gradient(180deg, ${heroColor} 0%, #38bdf8 100%)`,
                  boxShadow: `0 0 24px ${heroColor}88`,
                }}
              />
              <div>
                <div style={{ fontSize: 25, fontWeight: 900, color: "#f8fafc", lineHeight: 1.05 }}>
                  {trackerName}
                </div>
                <div style={{ fontSize: 11, fontWeight: 900, color: "#8e96aa", marginTop: 5 }}>
                  ANALYTICS REPORT
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15,23,42,0.64)",
                color: "#cbd5e1",
                fontFamily: MONO,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              <span>{data.period}</span>
              <span style={{ color: heroColor }}>・</span>
              <span>{data.format}</span>
            </div>
          </header>

          <div style={{ display: "flex", gap: 28, flex: 1, alignItems: "stretch", marginTop: 30 }}>
            <section
              style={{
                width: 490,
                border: "1px solid rgba(148,163,184,0.16)",
                borderRadius: 8,
                background:
                  `linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(17,24,39,0.58) 100%), linear-gradient(135deg, ${heroColor}16 0%, transparent 56%)`,
                padding: "34px 34px 30px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 24,
                boxShadow: "0 26px 80px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#dbe4f0" }}>総合勝率</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    marginTop: 12,
                    color: heroColor,
                    textShadow: `0 14px 46px ${heroColor}66`,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 164, fontWeight: 900, lineHeight: 1 }}>
                    {data.winRate === null ? "--" : data.winRate}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 76, fontWeight: 900, lineHeight: 1 }}>%</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontSize: 31, fontWeight: 900, color: "#f8fafc" }}>
                    {formatWLTJa(data.totalWins, data.totalLosses, data.totalDraws, data.game)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: "#8e96aa" }}>
                    / {totalBattles}戦
                  </div>
                </div>
                <div
                  style={{
                    height: 9,
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.14)",
                    overflow: "hidden",
                    marginTop: 16,
                  }}
                >
                  <div
                    style={{
                      width: `${clampPercent(data.winRate ?? 0)}%`,
                      height: "100%",
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${heroColor} 0%, #f59e0b 100%)`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <ResultTile label="先攻" wins={data.firstWins} losses={data.firstLosses} draws={data.firstDraws} game={data.game} />
                <ResultTile label="後攻" wins={data.secondWins} losses={data.secondLosses} draws={data.secondDraws} game={data.game} />
                <ResultTile label="不明" wins={data.unknownWins} losses={data.unknownLosses} draws={data.unknownDraws} game={data.game} />
              </div>

              <div
                style={{
                  flex: 1,
                  border: "1px solid rgba(148,163,184,0.16)",
                  borderRadius: 8,
                  background: "rgba(15,23,42,0.6)",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#f8fafc" }}>対面分布 Top 5</div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#8e96aa" }}>WIN RATE / BATTLES</div>
                </div>
                {encounters.length > 0 ? (
                  encounters.map((item) => (
                    <EncounterRow key={item.name} item={item} maxCount={maxEncounterCount} />
                  ))
                ) : (
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#8e96aa", marginTop: 20 }}>
                    対面データなし
                  </div>
                )}
              </div>
            </section>
          </div>

          <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#7d879b", fontSize: 12, fontWeight: 900 }}>
              <span>先攻 {rateText(firstRate)}</span>
              <span style={{ color: "#3e4658" }}>/</span>
              <span>後攻 {rateText(secondRate)}</span>
              <span style={{ color: "#3e4658" }}>/</span>
              <span>不明 {rateText(unknownRate)}</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: "#687084" }}>
              {appUrl.replace(/^https?:\/\//, "")}
            </div>
          </footer>
        </div>
      </div>
    );
  }
);
