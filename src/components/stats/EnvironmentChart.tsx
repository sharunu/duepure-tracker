"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
} from "recharts";

type DeckShare = {
  deck_name: string;
  battle_count: number;
  share_pct: number;
};

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLabel(props: any) {
  const { name, value, x, y } = props;
  return (
    <text x={x} y={y} fontSize={10} fill="#94a3b8" textAnchor="middle">
      {`${name} ${value}%`}
    </text>
  );
}

export function EnvironmentChart({ data }: { data: DeckShare[] }) {
  if (data.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        環境データがありません
      </p>
    );
  }

  const chartData = data.map((d) => ({
    name: d.deck_name,
    value: Number(d.share_pct),
    count: d.battle_count,
  }));

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={renderLabel}
            labelLine={false}
          >
            {chartData.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e1e2e",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#ffffff",
            }}
            formatter={(value?: number, name?: string) => [
              `${value}%`,
              name ?? "",
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
