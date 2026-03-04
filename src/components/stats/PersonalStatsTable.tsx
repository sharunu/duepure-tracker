"use client";

type StatRow = {
  deckName: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

export function PersonalStatsTable({ stats }: { stats: StatRow[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">
        対戦データがありません
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 pr-4">対面デッキ</th>
            <th className="pb-2 px-2 text-center">勝率</th>
            <th className="pb-2 px-2 text-center">W</th>
            <th className="pb-2 px-2 text-center">L</th>
            <th className="pb-2 pl-2 text-center">計</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.deckName} className="border-b border-border/50">
              <td className="py-2 pr-4">{row.deckName}</td>
              <td className="py-2 px-2 text-center">
                <span
                  className={
                    row.winRate >= 50 ? "text-success" : "text-destructive"
                  }
                >
                  {row.winRate}%
                </span>
              </td>
              <td className="py-2 px-2 text-center text-success">
                {row.wins}
              </td>
              <td className="py-2 px-2 text-center text-destructive">
                {row.losses}
              </td>
              <td className="py-2 pl-2 text-center text-muted-foreground">
                {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
