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
    return { background: "color-mix(in srgb, var(--foreground) 4%, transparent)", color: "transparent", fontWeight: 400 };
  }
  const ratio = pct / maxPct;
  const opacityPct = (0.08 + ratio * 0.82) * 100;
  const background = `color-mix(in srgb, var(--primary) ${opacityPct.toFixed(0)}%, transparent)`;

  if (ratio <= 0.25) {
    return { background, color: "color-mix(in srgb, var(--primary-foreground) 50%, transparent)", fontWeight: 400 };
  }
  if (ratio <= 0.6) {
    return { background, color: "color-mix(in srgb, var(--primary-foreground) 75%, transparent)", fontWeight: 400 };
  }
  return { background, color: "var(--primary-foreground)", fontWeight: 700 };
}

export function TrendHeatmap({
  data,
}: {
  data: TrendDataPoint[];
}) {
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
      <div className="text-[15px] font-medium text-foreground mb-2">
        対面デッキ使用率
      </div>
      <div
        className="bg-surface-2 rounded-[10px] border border-border-subtle px-2 py-3"
        role="img"
        aria-label={`対面デッキ使用率ヒートマップ: 上位${decks.length}デッキ × ${periods.length}期間の使用率の偏り`}
      >
        {tooltip && (
          <div
            className="fixed bg-surface-2 rounded-lg shadow-lg px-2.5 py-1.5 text-[11px] text-foreground z-50 pointer-events-none whitespace-nowrap"
            style={{
              left: tooltip.x,
              top: tooltip.y - 60,
              border: "0.5px solid var(--border-subtle)",
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-medium mb-0.5">{tooltip.deck}</div>
            <div className="text-muted-foreground">
              {tooltip.period.slice(5)} &nbsp;{tooltip.pct}%({tooltip.count}件)
            </div>
          </div>
        )}
        <div className="flex">
          <div className="shrink-0" style={{ width: labelWidth }}>
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
                      className="text-[11px] text-foreground font-medium whitespace-nowrap pr-2 overflow-hidden text-ellipsis align-middle"
                      style={{
                        height: cellSize,
                        width: labelWidth,
                        maxWidth: labelWidth,
                      }}
                    >
                      {deck}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-x-auto flex-1" style={{ WebkitOverflowScrolling: "touch" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: "3px" }}>
              <thead>
                <tr>
                  {periods.map((p) => (
                    <th
                      key={p}
                      className="text-[10px] text-muted-foreground font-normal text-center align-bottom"
                      style={{
                        height: headerHeight,
                        width: cellSize,
                        minWidth: cellSize,
                        padding: 0,
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
                          style={{ width: cellSize, height: cellSize, padding: 0 }}
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
                            className="w-full h-full rounded flex items-center justify-center text-[9px]"
                            style={{
                              background: style.background,
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
        <div className="flex justify-end items-center gap-1 mt-2 pr-1 text-[10px] text-muted-foreground">
          <span>少ない</span>
          {[
            "color-mix(in srgb, var(--foreground) 4%, transparent)",
            "color-mix(in srgb, var(--primary) 8%, transparent)",
            "color-mix(in srgb, var(--primary) 28%, transparent)",
            "color-mix(in srgb, var(--primary) 49%, transparent)",
            "color-mix(in srgb, var(--primary) 69%, transparent)",
            "color-mix(in srgb, var(--primary) 90%, transparent)",
          ].map((bg, i) => (
            <div
              key={i}
              className="w-[14px] h-[14px] rounded-sm"
              style={{ background: bg }}
            />
          ))}
          <span>多い</span>
        </div>
      </div>
    </div>
  );
}
