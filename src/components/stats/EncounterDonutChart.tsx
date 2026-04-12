"use client";

import { PieChart, Pie, Cell, Sector, ResponsiveContainer } from "recharts";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { getWinRateColor, COLORS } from "@/lib/stats-utils";

interface DonutItem {
  name: string;
  total: number;
  winRate: number;
}

interface Props {
  items: DonutItem[];
  otherBreakdown?: DonutItem[];
  overallWinRate: number;
  overallWins: number;
  overallLosses: number;
  overallTotal: number;
}

const OTHER_COLOR = "#64748b";
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

export function EncounterDonutChart({ items, otherBreakdown, overallWinRate, overallWins, overallLosses, overallTotal }: Props) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [animationDone, setAnimationDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartCenter, setChartCenter] = useState<{ cx: number; cy: number } | null>(null);
  const [otherExpanded, setOtherExpanded] = useState(false);

  const innerRadius = 55;
  const outerRadius = 80;

  // Reset expansion when items change
  useEffect(() => { setOtherExpanded(false); }, [items]);

  // Sort: "その他" always last in both chart and legend
  const data = useMemo(() =>
    items
      .map((item) => ({
        name: item.name,
        value: item.total,
        pct: overallTotal > 0 ? Math.round((item.total / overallTotal) * 100) : 0,
      }))
      .sort((a, b) => {
        if (a.name === "\u305D\u306E\u4ED6") return 1;
        if (b.name === "\u305D\u306E\u4ED6") return -1;
        return b.value - a.value;
      }),
  [items, overallTotal]);

  // Sorted breakdown for expansion display
  const sortedBreakdown = useMemo(() => {
    if (!otherBreakdown || otherBreakdown.length === 0) return [];
    return [...otherBreakdown]
      .sort((a, b) => b.total - a.total)
      .map(item => ({
        name: item.name,
        total: item.total,
        pct: overallTotal > 0 ? Math.round((item.total / overallTotal) * 100) : 0,
        winRate: item.winRate,
      }));
  }, [otherBreakdown, overallTotal]);

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

  // Color assignment: "その他" gets a fixed color
  const getColor = (name: string, index: number) =>
    name === "\u305D\u306E\u4ED6" ? OTHER_COLOR : COLORS[index % COLORS.length];

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
              {data.map((entry, i) => (
                <Cell key={i} fill={getColor(entry.name, i)} />
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
        {data.map((d, i) => {
          const color = getColor(d.name, i);
          const isOther = d.name === "\u305D\u306E\u4ED6";
          const hasBreakdown = isOther && otherBreakdown && otherBreakdown.length > 0;
          return (
            <div
              key={d.name}
              className="flex items-center gap-1.5 text-xs cursor-pointer rounded px-1 py-0.5 transition-colors"
              style={{
                backgroundColor: activeIndex === i ? "rgba(0,0,0,0.08)" : "transparent",
                outline: activeIndex === i ? `2px solid ${color}` : "none",
                outlineOffset: 1,
              }}
              onClick={() => {
                if (hasBreakdown) {
                  setOtherExpanded(prev => !prev);
                  setActiveIndex(-1);
                } else {
                  setActiveIndex(activeIndex === i ? -1 : i);
                }
              }}
            >
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <span className="text-muted-foreground">
                {d.name}
                {hasBreakdown && <span className="ml-0.5 text-[10px]">{otherExpanded ? "\u25B2" : "\u25BC"}</span>}
              </span>
              <span className="font-medium">{d.pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Other breakdown (expanded) */}
      {otherExpanded && sortedBreakdown.length > 0 && (
        <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
          <div className="text-[11px] text-muted-foreground mb-1.5">{"\u300C\u305D\u306E\u4ED6\u300D\u5185\u8A33"}</div>
          <div className="space-y-1">
            {sortedBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{item.name}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{item.pct}%</span>
                  <span className="text-muted-foreground">({item.total}件)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
