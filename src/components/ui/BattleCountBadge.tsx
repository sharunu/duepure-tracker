export function BattleCountBadge({ count }: { count: number }) {
  return (
    <span style={{
      fontSize: 10, color: "var(--muted-foreground)", backgroundColor: "var(--surface-1)",
      padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap",
    }}>
      {count}件
    </span>
  );
}
