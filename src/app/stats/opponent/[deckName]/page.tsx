"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getOpponentDeckDetailStats, getGlobalOpponentDeckDetailStats } from "@/lib/actions/stats-actions";
import type { OpponentDeckDetailStats } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { MatchupCard } from "@/components/stats/MatchupCard";
import { EncounterDonutChart } from "@/components/stats/EncounterDonutChart";
import { BottomNav } from "@/components/layout/BottomNav";

export default function OpponentDeckDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { format, setFormat, ready } = useFormat();

  const deckName = decodeURIComponent(params.deckName as string);
  const isGlobal = searchParams.get("scope") === "global";

  const [stats, setStats] = useState<OpponentDeckDetailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});
  const [sortBy, setSortBy] = useState<"count" | "winRate">("count");

  const [startDate, setStartDate] = useState(() => {
    return searchParams.get("start") || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return d.toLocaleDateString("sv-SE");
    })();
  });
  const [endDate, setEndDate] = useState(() => {
    return searchParams.get("end") || new Date().toLocaleDateString("sv-SE");
  });

  const loadStats = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    const fetchFn = isGlobal ? getGlobalOpponentDeckDetailStats : getOpponentDeckDetailStats;
    fetchFn(deckName, format, startDate, endDate).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, [deckName, format, startDate, endDate, ready, isGlobal]);

  const loadCounts = useCallback((year: number, month: number) => {
    if (!ready) return;
    getDailyBattleCounts(format, year, month).then(setBattleCounts);
  }, [format, ready]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const now = new Date();
    loadCounts(now.getFullYear(), now.getMonth() + 1);
  }, [loadCounts]);

  const sortedOverall = useMemo(() => {
    if (!stats) return [];
    const arr = [...stats.overall];
    if (sortBy === "winRate") {
      arr.sort((a, b) => b.winRate - a.winRate || b.total - a.total);
    } else {
      arr.sort((a, b) => b.total - a.total);
    }
    return arr;
  }, [stats, sortBy]);

  const donutItems = useMemo(() => {
    if (!stats) return [];
    return stats.overall.map((o) => ({ name: o.myDeckName, total: o.total, winRate: o.winRate }));
  }, [stats]);

  const handleRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <button
          onClick={() => {
            const params = new URLSearchParams();
            params.set("scope", isGlobal ? "global" : "personal");
            params.set("start", startDate);
            params.set("end", endDate);
            router.push("/stats?" + params.toString());
          }}
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          統計に戻る
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{isGlobal ? `vs ${deckName}（全体）` : `vs ${deckName}`}</h1>
          <div className={!ready ? "invisible" : ""}>
            <FormatSelector format={format} setFormat={setFormat} />
          </div>
        </div>

        {(!ready || loading) ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : stats && (
          <>
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              battleCounts={battleCounts}
              onMonthChange={loadCounts}
            />

            <div className="space-y-3">
              <h2 className="text-base font-bold">全体</h2>

              {stats.overall.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">データがありません</p>
              ) : (
                <>
                  <EncounterDonutChart
                    items={donutItems}
                    overallWinRate={stats.overallWinRate}
                    overallWins={stats.overallWins}
                    overallLosses={stats.overallLosses}
                    overallTotal={stats.overallTotal}
                  />

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">並び替え:</span>
                    <button
                      onClick={() => setSortBy("count")}
                      className={`px-2 py-0.5 rounded ${sortBy === "count" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      対戦数
                    </button>
                    <button
                      onClick={() => setSortBy("winRate")}
                      className={`px-2 py-0.5 rounded ${sortBy === "winRate" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      勝率
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sortedOverall.map((row) => (
                      <MatchupCard key={row.myDeckName} name={row.myDeckName} detail={row} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
