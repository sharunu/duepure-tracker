"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

export function TrendChart({ data }: { data: TrendDataPoint[] }) {
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

  // Transform data: { date, deck1: pct, deck2: pct, ... }
  const dateMap = new Map<string, Record<string, number>>();
  for (const d of data) {
    if (!topDecks.includes(d.deckName)) continue;
    if (!dateMap.has(d.periodStart)) {
      dateMap.set(d.periodStart, {});
    }
    dateMap.get(d.periodStart)![d.deckName] = d.sharePct;
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, decks]) => ({
      date: date.slice(5), // MM-DD
      ...decks,
    }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e1e2e",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "12px",
            }}
            formatter={(value?: number, name?: string) => [`${value}%`, name ?? ""]}
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
          {topDecks.map((deck, i) => (
            <Line
              key={deck}
              type="monotone"
              dataKey={deck}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
