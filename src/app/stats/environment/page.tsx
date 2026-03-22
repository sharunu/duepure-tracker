"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getEnvironmentSharesByRange } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { EnvironmentChart } from "@/components/stats/EnvironmentChart";
import { BottomNav } from "@/components/layout/BottomNav";

export default function EnvironmentPage() {
  const { format, setFormat, ready } = useFormat();
  const [data, setData] = useState<{ deck_name: string; battle_count: number; share_pct: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString("sv-SE");
  });
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  const loadData = useCallback(() => {
    if (!ready) return;
    setLoading(true);
    getEnvironmentSharesByRange(startDate, endDate, format).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [format, startDate, endDate, ready]);

  const loadCounts = useCallback((year: number, month: number) => {
    if (!ready) return;
    getDailyBattleCounts(format, year, month).then(setBattleCounts);
  }, [format, ready]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">環境統計</h1>
          <Link
            href="/stats"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← 個人統計
          </Link>
        </div>
        <div className="mb-4">
          <FormatSelector format={format} setFormat={setFormat} />
        </div>
        {(!ready || loading) ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <DateRangeCalendar
              startDate={startDate}
              endDate={endDate}
              onRangeChange={handleRangeChange}
              battleCounts={battleCounts}
              onMonthChange={loadCounts}
            />
            <EnvironmentChart data={data} />
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}
