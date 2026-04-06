export function BattleCountBadge({ count }: { count: number }) {
  return (
    <span style={{
      fontSize: 10, color: "#666688", backgroundColor: "#1e2138",
      padding: "2px 6px", borderRadius: 3, whiteSpace: "nowrap",
    }}>
      {count}件
    </span>
  );
}
