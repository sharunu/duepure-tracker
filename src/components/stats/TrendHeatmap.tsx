"use client";

import { useState, useMemo } from "react";

export type TrendDataPoint = {
  periodStart: string;
  deckName: string;
  battleCount: number;
  sharePct: number;
};

function getIntensityColor(pct: number, maxPct: number): string {
  if (maxPct === 0) return "rgba(99, 102, 241, 0.05)";
  const ratio = pct / maxPct;
  const alpha = 0.08 + ratio * 0.82;
  return `rgba(99, 102, 241, ${alpha.toFixed(2)})`;
}

export function TrendHeatmap({ data }: { data: TrendDataPoint[] }) {
  const [tooltip, setTooltip] = useState<{ deck: string; period: string; pct: number; count: number; x: number; y: number } | null>(null);

  const { decks, periods, grid, maxPct } = useMemo(() => {
    if (data.length === 0) return { decks: [] as string[], periods: [] as string[], grid: new Map<string, Map<string, { pct: number; count: number }>>(), maxPct: 0 };

    const deckTotals = new Map<string, number>();
    for (const d of data) {
      deckTotals.set(d.deckName, (deckTotals.get(d.deckName) ?? 0) + d.battleCount);
    }

    const sortedDecks = Array.from(deckTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    const periodSet = new Set<string>();
    for (const d of data) {
      if (sortedDecks.includes(d.deckName)) periodSet.add(d.periodStart);
    }
    const sortedPeriods = Array.from(periodSet).sort();

    const g = new Map<string, Map<string, { pct: number; count: number }>>();
    let max = 0;
    for (const d of data) {
      if (!sortedDecks.includes(d.deckName)) continue;
      if (!g.has(d.deckName)) g.set(d.deckName, new Map());
      g.get(d.deckName)!.set(d.periodStart, { pct: d.sharePct, count: d.battleCount });
      if (d.sharePct > max) max = d.sharePct;
    }

    return { decks: sortedDecks, periods: sortedPeriods, grid: g, maxPct: max };
  }, [data]);

  if (data.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        データがありません
      </p>
    );
  }

  const cellSize = 36;
  const labelWidth = 80;

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "#e8e8ec", marginBottom: 8 }}>
        対面デッキ使用率
      </div>
      <div
        style={{
          background: "#1e2138",
          borderRadius: 10,
          border: "0.5px solid #2a2d48",
          padding: "12px 8px",
        }}
      >
        <div style={{ overflowX: "auto", position: "relative" }}>
          {tooltip && (
            <div
              style={{
                position: "fixed",
                left: tooltip.x,
                top: tooltip.y - 60,
                background: "#232640",
                borderRadius: 8,
                border: "0.5px solid #2a2d48",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                padding: "6px 10px",
                fontSize: 11,
                color: "#e8e8ec",
                zIndex: 50,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                transform: "translateX(-50%)",
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 2 }}>{tooltip.deck}</div>
              <div style={{ color: "#aaaacc" }}>
                {tooltip.period.slice(5)} &nbsp;{tooltip.pct}%&#xFF08;{tooltip.count}件&#xFF09;
              </div>
            </div>
          )}
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ width: labelWidth, minWidth: labelWidth }} />
                {periods.map((p) => (
                  <th
                    key={p}
                    style={{
                      width: cellSize,
                      minWidth: cellSize,
                      fontSize: 10,
                      color: "#94a3b8",
                      fontWeight: 400,
                      padding: "0 0 4px",
                      textAlign: "center",
                    }}
                  >
                    {p.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decks.map((deck) => (
                <tr key={deck}>
                  <td
                    style={{
                      fontSize: 11,
                      color: "#e8e8ec",
                      paddingRight: 6,
                      paddingTop: 2,
                      paddingBottom: 2,
                      maxWidth: labelWidth,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {deck}
                  </td>
                  {periods.map((period) => {
                    const cell = grid.get(deck)?.get(period);
                    const pct = cell?.pct ?? 0;
                    const count = cell?.count ?? 0;
                    return (
                      <td
                        key={period}
                        style={{
                          width: cellSize,
                          height: cellSize - 4,
                          padding: 1,
                        }}
                        onMouseEnter={(e) => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({ deck, period, pct, count, x: rect.left + rect.width / 2, y: rect.top });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        onClick={(e) => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip(prev =>
                            prev?.deck === deck && prev?.period === period
                              ? null
                              : { deck, period, pct, count, x: rect.left + rect.width / 2, y: rect.top }
                          );
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: 3,
                            background: pct > 0 ? getIntensityColor(pct, maxPct) : "rgba(255,255,255,0.03)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            color: pct > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.15)",
                            fontWeight: 500,
                          }}
                        >
                          {pct > 0 ? `${pct}` : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
