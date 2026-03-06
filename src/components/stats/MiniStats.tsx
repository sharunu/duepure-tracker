"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
} from "recharts";

type Props = {
  stats: {
    wins: number;
    losses: number;
    total: number;
    streak: number;
    trend: { index: number; winRate: number }[];
  };
};

export function MiniStats({ stats }: Props) {
  const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold">{winRate}%</span>
          <span className="text-sm text-muted-foreground">
            {stats.wins}Win {stats.losses}Lose
          </span>
        </div>
        {stats.streak > 0 && (
          <span className="text-sm font-medium text-success">
            {stats.streak}連勝中
          </span>
        )}
      </div>

      {stats.trend.length > 1 && (
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trend}>
              <YAxis domain={[0, 100]} hide />
              <Line
                type="monotone"
                dataKey="winRate"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
