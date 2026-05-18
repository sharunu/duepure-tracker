export const CHART_PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
  "var(--chart-11)",
  "var(--chart-12)",
] as const;

export const CHART_OTHER_COLOR = "var(--chart-other)";

const OTHER_NAME = "その他";

export function assignChartColors(names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let paletteIdx = 0;
  for (const name of names) {
    if (name === OTHER_NAME) {
      map.set(name, CHART_OTHER_COLOR);
      continue;
    }
    map.set(name, CHART_PALETTE[paletteIdx % CHART_PALETTE.length]);
    paletteIdx++;
  }
  return map;
}
