"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
} from "recharts";
import { getWinRateColor } from "@/lib/stats-utils";
import { formatWLTJa, winRate as computeWinRate } from "@/lib/battle/result-format";

type Props = {
  stats: {
    wins: number;
    losses: number;
    draws: number;
    total: number;
    streak: number;
    trend?: { index: number; winRate: number }[];
  };
  onEditInterval?: () => void;
  game: string;
};

export function MiniStats({ stats, onEditInterval, game }: Props) {
  const winRatePct = computeWinRate(stats.wins, stats.losses);
  const winRateColor = getWinRateColor(winRatePct ?? 0);

  return (
    <div className="rounded-[10px] px-4 py-3" style={{ backgroundColor: "#232640" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[15px] font-bold" style={{ color: winRateColor }}>
            勝率 {winRatePct === null ? "--" : winRatePct}%
          </span>
          <span className="text-[13px] text-gray-400">
            {formatWLTJa(stats.wins, stats.losses, stats.draws, game)}（{stats.total}戦）
          </span>
          {stats.streak > 0 && (
            <span className="text-[12px] font-medium" style={{ color: "#50c878" }}>
              {stats.streak}連勝中
            </span>
          )}
        </div>
        {onEditInterval && (
          <button
            type="button"
            onClick={onEditInterval}
            className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded-[6px] transition-colors shrink-0 ml-2"
            style={{ backgroundColor: "#1a1d2e", border: "0.5px solid #333355" }}
          >
            計測区間編集
          </button>
        )}
      </div>

      {stats.trend && stats.trend.length > 1 && (
        <div className="h-12 mt-2">
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
