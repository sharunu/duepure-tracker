"use client";

import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { useState, useRef, useEffect, useCallback } from "react";
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

const RADIAN = Math.PI / 180;

// A. renderActiveShape: expanded Sector only, no text
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <style>{""
        + ".active-sector{"
        + "animation:sectorExpand 200ms ease-out;"
        + "transform-origin:" + cx + "px " + cy + "px;"
        + "}"
        + "@keyframes sectorExpand{"
        + "from{transform:scale(0.97)}"
        + "to{transform:scale(1)}"
        + "}"
      }</style>
      <g className="active-sector">
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 6}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
      </g>
    </g>
  );
};

// A. Stable label renderer — no activeIndex dependency
const renderLabel = (props: any) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, pct } = props;
  const radius = (innerRadius + outerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill="#fff"
      fontSize={11}
      fontWeight="bold"
      dominantBaseline="central"
    >
      {pct}%
    </text>
  );
};

export function EncounterDonutChart({ items, overallWinRate, overallWins, overallLosses, overallTotal }: Props) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [animationDone, setAnimationDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartCenter, setChartCenter] = useState<{ cx: number; cy: number } | null>(null);

  const innerRadius = 55;
  const outerRadius = 80;

  const data = items
    .map((item) => ({
      name: item.name,
      value: item.total,
      pct: overallTotal > 0 ? Math.round((item.total / overallTotal) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const winRateColor = getWinRateColor(overallWinRate);

  // Calculate chart center on mount/resize
  useEffect(() => {
    const updateCenter = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setChartCenter({ cx: rect.width / 2, cy: rect.height / 2 });
      }
    };
    updateCenter();
    window.addEventListener("resize", updateCenter);
    return () => window.removeEventListener("resize", updateCenter);
  }, []);

  // B. Calculate deck name overlay position from active segment
  const getOverlayPosition = useCallback(() => {
    if (activeIndex < 0 || !chartCenter) return null;

    // Compute start/end angles for the active segment
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return null;

    let cumulativeAngle = 90; // startAngle
    for (let i = 0; i < activeIndex; i++) {
      cumulativeAngle -= (data[i].value / total) * 360;
    }
    const segmentAngle = (data[activeIndex].value / total) * 360;
    const midAngle = cumulativeAngle - segmentAngle / 2;

    const labelRadius = outerRadius + 20;
    const x = chartCenter.cx + labelRadius * Math.cos(-midAngle * RADIAN);
    const y = chartCenter.cy + labelRadius * Math.sin(-midAngle * RADIAN);

    return { x, y, midAngle };
  }, [activeIndex, chartCenter, data, outerRadius]);

  const overlayPos = getOverlayPosition();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pieProps: any = {
    activeIndex: activeIndex >= 0 ? activeIndex : undefined,
    activeShape: renderActiveShape,
  };

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
              onAnimationEnd={() => setAnimationDone(true)}
              isAnimationActive={!animationDone}
              label={renderLabel}
              labelLine={false}
              {...pieProps}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center stats */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="flex items-baseline gap-1">
            <span className="text-sm text-muted-foreground">勝率</span>
            <span className="text-2xl font-bold" style={{ color: winRateColor }}>{overallWinRate}%</span>
          </div>
          <span className="text-xs text-muted-foreground">{overallWins}勝{overallLosses}敗 / {overallTotal}件</span>
        </div>

        {/* B. Deck name HTML overlay — always in front of SVG */}
        {activeIndex >= 0 && overlayPos && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: overlayPos.x,
              top: overlayPos.y,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            <span
              className="text-xs font-medium whitespace-nowrap px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "rgba(0,0,0,0.7)",
                color: "#fff",
              }}
            >
              {data[activeIndex].name}
            </span>
          </div>
        )}
      </div>

      {/* C. Legend with click support */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
        {data.map((d, i) => (
          <div
            key={d.name}
            className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-1 py-0.5 transition-colors"
            style={{
              backgroundColor: activeIndex === i ? "rgba(0,0,0,0.08)" : "transparent",
              outline: activeIndex === i ? `2px solid ${COLORS[i % COLORS.length]}` : "none",
              outlineOffset: 1,
            }}
            onClick={() => setActiveIndex(activeIndex === i ? -1 : i)}
          >
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="font-medium">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
