"use client";

import { useState, useMemo } from "react";

export type TrendDataPoint = {
  periodStart: string;
  deckName: string;
  battleCount: number;
  sharePct: number;
};

function getCellStyle(pct: number, maxPct: number): {
  background: string;
  color: string;
  fontWeight: number;
} {
  if (pct === 0 || maxPct === 0) {
    return { background: "rgba(255,255,255,0.04)", color: "transparent", fontWeight: 400 };
  }
  const ratio = pct / maxPct;
  const opacity = 0.08 + ratio * 0.82;
  const background = `rgba(99,102,241,${opacity.toFixed(2)})`;

  if (ratio <= 0.25) {
    return { background, color: "rgba(255,255,255,0.5)", fontWeight: 400 };
  }
  if (ratio <= 0.6) {
    return { background, color: "rgba(255,255,255,0.75)", fontWeight: 400 };
  }
  return { background, color: "#ffffff", fontWeight: 700 };
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

  const cellSize = 38;
  const labelWidth = 120;
  const headerHeight = 22;

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
              {tooltip.period.slice(5)} &nbsp;{tooltip.pct}%（{tooltip.count}件）
            </div>
          </div>
        )}
        <div style={{ display: "flex" }}>
          <div style={{ flexShrink: 0, width: labelWidth }}>
            <table style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
              <thead>
                <tr>
                  <th style={{ height: headerHeight }} />
                </tr>
              </thead>
              <tbody>
                {decks.map((deck) => (
                  <tr key={deck}>
                    <td
                      style={{
                        height: cellSize,
                        fontSize: 11,
                        color: "#e8e8ec",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        paddingRight: 8,
                        width: labelWidth,
                        maxWidth: labelWidth,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        verticalAlign: "middle",
                      }}
                    >
                      {deck}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ overflowX: "auto", flex: 1, WebkitOverflowScrolling: "touch" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: "3px" }}>
              <thead>
                <tr>
                  {periods.map((p) => (
                    <th
                      key={p}
                      style={{
                        height: headerHeight,
                        width: cellSize,
                        minWidth: cellSize,
                        fontSize: 10,
                        color: "#94a3b8",
                        fontWeight: 400,
                        padding: 0,
                        textAlign: "center",
                        verticalAlign: "bottom",
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
                    {periods.map((period) => {
                      const cell = grid.get(deck)?.get(period);
                      const pct = cell?.pct ?? 0;
                      const count = cell?.count ?? 0;
                      const style = getCellStyle(pct, maxPct);
                      const displayVal = pct > 0 ? Math.round(pct) : null;
                      return (
                        <td
                          key={period}
                          style={{
                            width: cellSize,
                            height: cellSize,
                            padding: 0,
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
                              borderRadius: 4,
                              background: style.background,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 9,
                              color: style.color,
                              fontWeight: style.fontWeight,
                            }}
                          >
                            {displayVal !== null ? `${displayVal}` : ""}
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
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 4,
            marginTop: 8,
            paddingRight: 4,
            fontSize: 10,
            color: "#94a3b8",
          }}
        >
          <span>少ない</span>
          {[
            "rgba(255,255,255,0.04)",
            "rgba(99,102,241,0.08)",
            "rgba(99,102,241,0.28)",
            "rgba(99,102,241,0.49)",
            "rgba(99,102,241,0.69)",
            "rgba(99,102,241,0.90)",
          ].map((bg, i) => (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                background: bg,
              }}
            />
          ))}
          <span>多い</span>
        </div>
      </div>
    </div>
  );
}
