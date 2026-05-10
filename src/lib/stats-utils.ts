export function getWinRateColor(rate: number | null): string {
  if (rate === null) return "var(--win-rate-empty)";
  if (rate >= 65) return "var(--win-rate-high)";
  if (rate >= 55) return "var(--win-rate-mid-high)";
  if (rate >= 45) return "var(--win-rate-mid)";
  if (rate >= 35) return "var(--win-rate-mid-low)";
  return "var(--win-rate-low)";
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
