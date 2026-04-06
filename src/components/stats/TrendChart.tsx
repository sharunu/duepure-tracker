"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const COLORS = [
  "#6366f1",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#8b5cf6",
  "#64748b",
];

export type TrendDataPoint = {
  periodStart: string;
  deckName: string;
  battleCount: number;
  sharePct: number;
};

/* ── Custom Tooltip ── */
function CustomTrendTooltip({
  active,
  payload,
  label,
  highlightedDeck,
  deckColorMap,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  highlightedDeck: string | null;
  deckColorMap: Map<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const items = highlightedDeck
    ? payload.filter((p: any) => p.dataKey === highlightedDeck)
    : payload;

  if (items.length === 0) return null;

  const borderColor =
    highlightedDeck && items.length === 1
      ? deckColorMap.get(highlightedDeck) ?? "#2a2d48"
      : "#2a2d48";

  return (
    <div
      style={{
        background: "#232640",
        borderRadius: 8,
        border: `0.5px solid ${borderColor}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        padding: "8px 10px",
        fontSize: 12,
        color: "#e8e8ec",
        minWidth: 100,
      }}
    >
      {items.map((entry: any) => {
        const color = deckColorMap.get(entry.dataKey) ?? "#aaa";
        const battleCount = entry.payload?.[`__bc_${entry.dataKey}`];
        return (
          <div key={entry.dataKey} style={{ marginBottom: items.length > 1 ? 4 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  backgroundColor: color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 500 }}>{entry.dataKey}</span>
            </div>
            <div style={{ color: "#aaaacc", marginLeft: 12, marginTop: 1 }}>
              {label} &nbsp;{entry.value}%
              {battleCount != null && (
                <span style={{ marginLeft: 4 }}>（{battleCount}件）</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ── */
export function TrendChart({ data }: { data: TrendDataPoint[] }) {
  const [highlightedDeck, setHighlightedDeck] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        データがありません
      </p>
    );
  }

  // Get top N decks by total battle count
  const deckTotals = new Map<string, number>();
  for (const d of data) {
    deckTotals.set(d.deckName, (deckTotals.get(d.deckName) ?? 0) + d.battleCount);
  }
  const topDecks = Array.from(deckTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  // Build color map
  const deckColorMap = new Map<string, string>();
  topDecks.forEach((deck, i) => {
    deckColorMap.set(deck, COLORS[i % COLORS.length]);
  });

  // Transform data: { date, deck1: pct, deck2: pct, __bc_deck1: count, ... }
  const dateMap = new Map<string, Record<string, number>>();
  for (const d of data) {
    if (!topDecks.includes(d.deckName)) continue;
    if (!dateMap.has(d.periodStart)) {
      dateMap.set(d.periodStart, {});
    }
    const rec = dateMap.get(d.periodStart)!;
    rec[d.deckName] = d.sharePct;
    rec[`__bc_${d.deckName}`] = d.battleCount;
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, decks]) => ({
      date: date.slice(5), // MM-DD
      ...decks,
    }));

  // Latest period sharePct for legend display
  const latestPeriod = chartData[chartData.length - 1];

  const handleLegendClick = (deck: string) => {
    setHighlightedDeck((prev) => (prev === deck ? null : deck));
  };

  const handleLineClick = (deck: string) => {
    setHighlightedDeck((prev) => (prev === deck ? null : deck));
  };

  return (
    <div onClick={() => setHighlightedDeck(null)}>
      {/* Title */}
      <div style={{ fontSize: 15, fontWeight: 500, color: "#e8e8ec", marginBottom: 8 }}>
        対面デッキ使用率
      </div>

      {/* Chart card */}
      <div
        style={{
          background: "#1e2138",
          borderRadius: 10,
          border: "0.5px solid #2a2d48",
          padding: "16px 8px 12px",
        }}
      >
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke="#2a2d48" strokeWidth={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
              />
              <YAxis
                width={40}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                unit="%"
              />
              <Tooltip
                trigger="click"
                content={
                  <CustomTrendTooltip
                    highlightedDeck={highlightedDeck}
                    deckColorMap={deckColorMap}
                  />
                }
              />
              {topDecks.map((deck, i) => {
                const color = COLORS[i % COLORS.length];
                const isHighlighted = highlightedDeck === deck;
                const hasHighlight = highlightedDeck !== null;

                const sw = hasHighlight
                  ? isHighlighted ? 3 : 1.5
                  : 2;
                const op = hasHighlight
                  ? isHighlighted ? 1 : 0.4
                  : 1;
                const dotConfig = hasHighlight
                  ? isHighlighted ? { r: 4 } : false
                  : { r: 3 };

                return (
                  <Line
                    key={deck}
                    type="monotone"
                    dataKey={deck}
                    stroke={color}
                    strokeWidth={sw}
                    opacity={op}
                    dot={dotConfig as any}
                    activeDot={{
                      r: 5,
                      onClick: (e: any) => {
                        e?.stopPropagation?.();
                        handleLineClick(deck);
                      },
                    }}
                    connectNulls
                    style={{ transition: "opacity 0.2s ease" }}
                    onClick={() => handleLineClick(deck)}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Custom Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "4px 12px",
          fontSize: 11,
          lineHeight: 1.8,
          marginTop: 10,
        }}
      >
        {topDecks.map((deck, i) => {
          const color = COLORS[i % COLORS.length];
          const isHighlighted = highlightedDeck === deck;
          const hasHighlight = highlightedDeck !== null;
          const latestPct = (latestPeriod as any)?.[deck];

          return (
            <div
              key={deck}
              onClick={(e) => {
                e.stopPropagation();
                handleLegendClick(deck);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                cursor: "pointer",
                transition: "color 0.2s ease, opacity 0.2s ease",
                color: hasHighlight
                  ? isHighlighted ? "#e8e8ec" : "#aaaacc"
                  : "#aaaacc",
                fontWeight: isHighlighted ? 500 : 400,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  backgroundColor: color,
                  flexShrink: 0,
                  transition: "opacity 0.2s ease",
                  opacity: hasHighlight && !isHighlighted ? 0.4 : 1,
                }}
              />
              <span>{deck}</span>
              {latestPct != null && (
                <span style={{ fontWeight: 500 }}>{latestPct}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
