"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { getWinRateColor, COLORS } from "@/lib/stats-utils";

interface DonutItem {
  name: string;
  total: number;
  winRate: number;
}

interface Props {
  items: DonutItem[];
  overallWinRate: number;
  overallWins: number;
  overallLosses: number;
  overallTotal: number;
}

export function EncounterDonutChart({ items, overallWinRate, overallWins, overallLosses, overallTotal }: Props) {
  const data = items.map((item) => ({
    name: item.name,
    value: item.total,
    pct: overallTotal > 0 ? Math.round((item.total / overallTotal) * 100) : 0,
  }));

  const winRateColor = getWinRateColor(overallWinRate);

  return (
    <div className="space-y-3">
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold" style={{ color: winRateColor }}>{overallWinRate}%</span>
          <span className="text-xs text-muted-foreground">{overallWins}勝{overallLosses}敗 / {overallTotal}件</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-medium">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
