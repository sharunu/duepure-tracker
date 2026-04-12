"use client";

import { useRouter } from "next/navigation";
import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";
import { getWinRateColor } from "@/lib/stats-utils";
import { BattleCountBadge } from "@/components/ui/BattleCountBadge";

type MyDeckRow = DetailedPersonalStats["myDeckStats"][number];

export function MyDeckStatsSection({ stats, startDate, endDate, scope, teamId, memberId, memberName, otherDeckNames, disableLinks }: { stats: MyDeckRow[]; startDate?: string; endDate?: string; scope?: "personal" | "global" | "team"; teamId?: string; memberId?: string | null; memberName?: string | null; otherDeckNames?: string[]; disableLinks?: boolean }) {
  const router = useRouter();

  if (stats.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-4 text-sm">
        データがありません
      </p>
    );
  }

  const handleClick = (deckName: string) => {
    if (disableLinks) return;
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    if (endDate) params.set("end", endDate);
    if (scope === "global") params.set("scope", "global");
    if (scope === "team") {
      params.set("scope", "team");
      if (teamId) params.set("teamId", teamId);
      if (memberId) params.set("memberId", memberId);
      if (memberName) params.set("memberName", memberName);
    }
    if (deckName === "\u305d\u306e\u4ed6" && otherDeckNames && otherDeckNames.length > 0) {
      params.set("otherDecks", otherDeckNames.join(","));
    }
    const qs = params.toString();
    router.push(`/stats/deck/${encodeURIComponent(deckName)}${qs ? "?" + qs : ""}`);
  };

  return (
    <div className="space-y-2">
      {stats.map((deck) => {
        const color = getWinRateColor(deck.winRate);
        return (
          <div key={deck.deckName} className="relative rounded-lg border border-border bg-card overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: color }} />
            <button
              onClick={() => handleClick(deck.deckName)}
              className={`w-full pl-4 pr-4 py-3 text-sm transition-colors ${disableLinks ? "cursor-default" : "hover:bg-muted/50"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="font-medium">{deck.deckName}</span>
                  <BattleCountBadge count={deck.total} />
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex items-baseline">
                    <span className="text-xs text-muted-foreground" style={{ width: 24, flexShrink: 0 }}>勝率</span>
                    <span className="text-base font-bold" style={{ color, width: 40, textAlign: "right", flexShrink: 0 }}>{deck.winRate}%</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {deck.wins}勝 {deck.losses}敗
                  </span>
                  {!disableLinks && <span className="text-muted-foreground">›</span>}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted/30">
                <div
                  className="h-1 rounded-full transition-all"
                  style={{ width: `${deck.winRate}%`, backgroundColor: color }}
                />
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
