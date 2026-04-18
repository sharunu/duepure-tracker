"use client";

import { forwardRef } from "react";
import type { DeckShareData } from "./ShareButton";

type Props = {
  data: DeckShareData;
  type: "deck" | "opponent";
};

export const DeckShareCard = forwardRef<HTMLDivElement, Props>(
  function DeckShareCard({ data, type }, ref) {
    const totalBattles = data.totalWins + data.totalLosses;
    const firstTotal = data.firstWins + data.firstLosses;
    const secondTotal = data.secondWins + data.secondLosses;
    const firstRate = firstTotal > 0 ? Math.round((data.firstWins / firstTotal) * 100) : 0;
    const secondRate = secondTotal > 0 ? Math.round((data.secondWins / secondTotal) * 100) : 0;

    const title = type === "opponent" ? `vs ${data.deckName}` : data.deckName;
    const matchupLabel = type === "opponent" ? "使用デッキ別" : "対面別勝率";

    return (
      <div
        ref={ref}
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0f1129 0%, #1a1d3a 50%, #0f1129 100%)",
          color: "#fff",
          fontFamily: "'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "absolute",
          left: -9999,
          top: -9999,
        }}
      >
        {/* ヘッダー */}
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 14, color: "#666" }}>
            {data.period} / {data.format}
          </div>
        </div>

        {/* メイン勝率 + 先攻後攻 */}
        <div style={{ display: "flex", alignItems: "center", gap: 60, margin: "20px 0" }}>
          <div>
            <div style={{ fontSize: 72, fontWeight: 700, color: data.winRate >= 50 ? "#5b8def" : "#e85d75" }}>
              {data.winRate}%
            </div>
            <div style={{ fontSize: 20, color: "#999", marginTop: 4 }}>
              {data.totalWins}勝 {data.totalLosses}敗 / {totalBattles}戦
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 18 }}>
              <span style={{ color: "#aaa", width: 40 }}>先攻</span>
              <span style={{ fontWeight: 600 }}>{firstRate}%</span>
              <span style={{ color: "#666", fontSize: 14 }}>({data.firstWins}-{data.firstLosses})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 18 }}>
              <span style={{ color: "#aaa", width: 40 }}>後攻</span>
              <span style={{ fontWeight: 600 }}>{secondRate}%</span>
              <span style={{ color: "#666", fontSize: 14 }}>({data.secondWins}-{data.secondLosses})</span>
            </div>
          </div>
        </div>

        {/* 対面別/使用デッキ別 Top5 */}
        <div>
          <div style={{ fontSize: 14, color: "#818cf8", marginBottom: 12, fontWeight: 600 }}>{matchupLabel} Top5</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.topMatchups.slice(0, 5).map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16 }}>
                <span style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 500 }}>{m.name}</span>
                <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 16 }}>
                  {m.winRate}% <span style={{ color: "#666", fontSize: 13 }}>({m.wins}-{m.losses})</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* フッター */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#818cf8" }}>
            デュエプレトラッカー
          </div>
          <div style={{ fontSize: 13, color: "#555" }}>
            {process.env.NEXT_PUBLIC_APP_URL ?? ""}
          </div>
        </div>
      </div>
    );
  }
);
