"use client";

import { useEffect, useState, useCallback } from "react";
import { getDetailedPersonalStats, getEnvironmentSharesByRange, getPersonalEnvironmentSharesByRange, getGlobalStatsByRange, getDeckTrendByRange } from "@/lib/actions/stats-actions";
import type { DetailedPersonalStats, TrendRow } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { ScopeSelector } from "@/components/ui/ScopeSelector";
import type { Scope } from "@/components/ui/ScopeSelector";
import { ViewSelector } from "@/components/ui/ViewSelector";
import type { View } from "@/components/ui/ViewSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { MyDeckStatsSection } from "@/components/stats/MyDeckStatsSection";
import { OpponentDeckStatsSection } from "@/components/stats/OpponentDeckStatsSection";
import { EnvironmentChart } from "@/components/stats/EnvironmentChart";
import { TrendChart } from "@/components/stats/TrendChart";
import { BottomNav } from "@/components/layout/BottomNav";

export default function StatsPage() {
  const { format, setFormat, ready } = useFormat();
  const [scope, setScope] = useState<Scope>("personal");
  const [view, setView] = useState<View>("stats");
  const [loading, setLoading] = useState(true);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString("sv-SE");
  });
  const [endDate, setEndDate] = useState(() => new Date().toLocaleDateString("sv-SE"));

  // Data states
  const [personalStats, setPersonalStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [] });
  const [globalStats, setGlobalStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [] });
  const [distributionData, setDistributionData] = useState<{ deck_name: string; battle_count: number; share_pct: number }[]>([]);
  const [trendData, setTrendData] = useState<TrendRow[]>([]);

  const loadData = useCallback(async () => {
    if (!ready || scope === "team") {
      setLoading(false);
      return;
    }
    setLoading(true);

    if (scope === "personal" && view === "stats") {
      const s = await getDetailedPersonalStats(format, startDate, endDate);
      setPersonalStats(s);
    } else if (scope === "personal" && view === "distribution") {
      const d = await getPersonalEnvironmentSharesByRange(startDate, endDate, format);
      setDistributionData(d);
    } else if (scope === "personal" && view === "trend") {
      const t = await getDeckTrendByRange(startDate, endDate, format, true);
      setTrendData(t);
    } else if (scope === "global" && view === "stats") {
      const s = await getGlobalStatsByRange(startDate, endDate, format);
      setGlobalStats(s);
    } else if (scope === "global" && view === "distribution") {
      const d = await getEnvironmentSharesByRange(startDate, endDate, format);
      setDistributionData(d);
    } else if (scope === "global" && view === "trend") {
      const t = await getDeckTrendByRange(startDate, endDate, format, false);
      setTrendData(t);
    }

    setLoading(false);
  }, [format, startDate, endDate, ready, scope, view]);

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

  const renderContent = () => {
    if (scope === "team") {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">チーム機能は近日公開予定です</p>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }

    if (view === "stats") {
      const stats = scope === "personal" ? personalStats : globalStats;
      const isGlobal = scope === "global";
      return (
        <>
          <div>
            <h2 className="text-base font-bold mb-2">使用デッキ別</h2>
            <MyDeckStatsSection stats={stats.myDeckStats} startDate={startDate} endDate={endDate} disableNavigation={isGlobal} />
          </div>
          <div>
            <h2 className="text-base font-bold mb-2">対面デッキ別</h2>
            <OpponentDeckStatsSection stats={stats.opponentDeckStats} startDate={startDate} endDate={endDate} disableNavigation={isGlobal} />
          </div>
        </>
      );
    }

    if (view === "distribution") {
      return <EnvironmentChart data={distributionData} />;
    }

    if (view === "trend") {
      return <TrendChart data={trendData} />;
    }

    return null;
  };

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <h1 className="text-xl font-bold">統計</h1>
        <div className={!ready ? "invisible" : ""}>
          <FormatSelector format={format} setFormat={setFormat} />
        </div>
        {(!ready) ? (
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
            <ScopeSelector scope={scope} setScope={setScope} />
            <ViewSelector view={view} setView={setView} />
            {renderContent()}
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
