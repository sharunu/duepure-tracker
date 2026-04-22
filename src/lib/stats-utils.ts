export function getWinRateColor(rate: number | null): string {
  if (rate === null) return "#8888aa";
  if (rate >= 65) return "#50c878";
  if (rate >= 55) return "#7dcea0";
  if (rate >= 45) return "#f0a030";
  if (rate >= 35) return "#e87585";
  return "#e85d75";
}

export const COLORS = [
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
