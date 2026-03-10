"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getDetailedPersonalStats } from "@/lib/actions/stats-actions";
import type { DetailedPersonalStats } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { MyDeckStatsSection } from "@/components/stats/MyDeckStatsSection";
import { OpponentDeckStatsSection } from "@/components/stats/OpponentDeckStatsSection";
import { BottomNav } from "@/components/layout/BottomNav";

export default function StatsPage() {
  const { format, setFormat, ready } = useFormat();
  const [stats, setStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [] });
  const [loading, setLoading] = useState(true);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString("sv-SE");
  });
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  const loadStats = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    getDetailedPersonalStats(format, startDate, endDate).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, [format, startDate, endDate, ready]);

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

  const handleRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">個人統計</h1>
          <Link
            href="/stats/environment"
            className="text-sm text-primary hover:underline"
          >
            環境統計 →
          </Link>
        </div>
        <div className={!ready ? "invisible" : ""}>
          <FormatSelector format={format} setFormat={setFormat} />
        </div>
        {(!ready || loading) ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              battleCounts={battleCounts}
              onMonthChange={loadCounts}
            />

            <div>
              <h2 className="text-base font-bold mb-2">使用デッキ別</h2>
              <MyDeckStatsSection stats={stats.myDeckStats} />
            </div>

            <div>
              <h2 className="text-base font-bold mb-2">対面デッキ別</h2>
              <OpponentDeckStatsSection stats={stats.opponentDeckStats} />
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
