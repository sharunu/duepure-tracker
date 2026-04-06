"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getDetailedPersonalStats, getGlobalStatsByRange, getDeckTrendByRange, getTeamStatsByRange, getTeamDeckTrendByRange } from "@/lib/actions/stats-actions";
import type { DetailedPersonalStats, TrendRow } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts } from "@/lib/actions/battle-actions";
import { getTeamMembers } from "@/lib/actions/team-actions";
import type { TeamMember } from "@/lib/actions/team-actions";
import { useFormat } from "@/hooks/use-format";
import { useActiveTeam } from "@/hooks/use-active-team";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { ScopeSelector } from "@/components/ui/ScopeSelector";
import type { Scope } from "@/components/ui/ScopeSelector";
import { ViewSelector } from "@/components/ui/ViewSelector";
import type { View } from "@/components/ui/ViewSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { MyDeckStatsSection } from "@/components/stats/MyDeckStatsSection";
import { OpponentDeckStatsSection } from "@/components/stats/OpponentDeckStatsSection";
import { EncounterDonutChart } from "@/components/stats/EncounterDonutChart";
import { TrendChart } from "@/components/stats/TrendChart";
import { TeamMemberSelector } from "@/components/stats/TeamMemberSelector";
import { BottomNav } from "@/components/layout/BottomNav";
import { getWinRateColor } from "@/lib/stats-utils";

function StatsPageInner() {
  const searchParams = useSearchParams();
  const { format, setFormat, ready } = useFormat();
  const { activeTeamId, ready: teamReady } = useActiveTeam();
  const [scope, setScope] = useState<Scope>(() => {
    const sp = searchParams.get("scope");
    return (sp === "personal" || sp === "global" || sp === "team") ? sp : "personal";
  });
  const [view, setView] = useState<View>("stats");
  const [loading, setLoading] = useState(true);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

  const [startDate, setStartDate] = useState(() => {
    return searchParams.get("start") || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toLocaleDateString("sv-SE");
    })();
  });
  const [endDate, setEndDate] = useState(() => {
    return searchParams.get("end") || new Date().toLocaleDateString("sv-SE");
  });

  // Data states
  const [personalStats, setPersonalStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [] });
  const [globalStats, setGlobalStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [] });
  const [teamStats, setTeamStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [] });
  const [trendData, setTrendData] = useState<TrendRow[]>([]);

  // Team member states
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Load team members when activeTeamId changes
  useEffect(() => {
    if (activeTeamId) {
      getTeamMembers(activeTeamId).then(setTeamMembers);
    } else {
      setTeamMembers([]);
    }
  }, [activeTeamId]);

  // Reset selectedMemberId when scope changes away from team
  useEffect(() => {
    if (scope !== "team") {
      setSelectedMemberId(null);
    }
  }, [scope]);

  const loadData = useCallback(async () => {
    if (!ready || !teamReady) {
      return;
    }

    if (scope === "team" && !activeTeamId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    if (scope === "personal" && view === "stats") {
      const s = await getDetailedPersonalStats(format, startDate, endDate);
      setPersonalStats(s);
    } else if (scope === "personal" && view === "trend") {
      const t = await getDeckTrendByRange(startDate, endDate, format, true);
      setTrendData(t);
    } else if (scope === "global" && view === "stats") {
      const s = await getGlobalStatsByRange(startDate, endDate, format);
      setGlobalStats(s);
    } else if (scope === "global" && view === "trend") {
      const t = await getDeckTrendByRange(startDate, endDate, format, false);
      setTrendData(t);
    } else if (scope === "team" && activeTeamId && view === "stats") {
      const s = await getTeamStatsByRange(activeTeamId, selectedMemberId, format, startDate, endDate);
      setTeamStats(s);
    } else if (scope === "team" && activeTeamId && view === "trend") {
      const t = await getTeamDeckTrendByRange(activeTeamId, selectedMemberId, startDate, endDate, format);
      setTrendData(t);
    }

    setLoading(false);
  }, [format, startDate, endDate, ready, teamReady, scope, view, activeTeamId, selectedMemberId]);

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
    if (scope === "team" && !activeTeamId) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">ホームタブでチームを選択してください</p>
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
      const stats = scope === "personal" ? personalStats : scope === "global" ? globalStats : teamStats;
      const totalWins = stats.myDeckStats.reduce((sum, d) => sum + d.wins, 0);
      const totalLosses = stats.myDeckStats.reduce((sum, d) => sum + d.losses, 0);
      const totalBattles = totalWins + totalLosses;
      const overallWinRate = totalBattles > 0 ? Math.round((totalWins / totalBattles) * 100) : 0;

      return (
        <>
          <div>
            <h2 className="text-base font-bold mb-2">対面デッキ分布</h2>
            {stats.opponentDeckStats.length > 0 ? (
              <EncounterDonutChart
                items={stats.opponentDeckStats.map(o => ({ name: o.deckName, total: o.total, winRate: o.winRate }))}
                overallWinRate={overallWinRate}
                overallWins={totalWins}
                overallLosses={totalLosses}
                overallTotal={totalBattles}
              />
            ) : (
              <p className="text-center text-muted-foreground py-4 text-sm">データがありません</p>
            )}
          </div>
          <div>
            <h2 className="text-base font-bold mb-2">使用デッキ別</h2>
            <MyDeckStatsSection stats={stats.myDeckStats} startDate={startDate} endDate={endDate} scope={scope} teamId={activeTeamId ?? undefined} memberId={selectedMemberId} memberName={selectedMemberId ? (teamMembers.find(m => m.user_id === selectedMemberId)?.discord_username ?? null) : null} />
          </div>
          <div>
            <h2 className="text-base font-bold mb-2">対面デッキ別</h2>
            <OpponentDeckStatsSection stats={stats.opponentDeckStats} startDate={startDate} endDate={endDate} scope={scope} teamId={activeTeamId ?? undefined} memberId={selectedMemberId} memberName={selectedMemberId ? (teamMembers.find(m => m.user_id === selectedMemberId)?.discord_username ?? null) : null} />
          </div>
        </>
      );
    }

    if (view === "trend") {
      return <TrendChart data={trendData} />;
    }

    return null;
  };

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">分析</h1>
          <div className={!ready ? "invisible" : ""}>
            <FormatSelector format={format} setFormat={setFormat} />
          </div>
        </div>
        {(!ready || !teamReady) ? (
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
            <ScopeSelector scope={scope} setScope={setScope} teamEnabled={!!activeTeamId} />
            {scope === "team" && activeTeamId && teamMembers.length > 0 && (
              <TeamMemberSelector
                members={teamMembers}
                selectedMemberId={selectedMemberId}
                onSelect={setSelectedMemberId}
              />
            )}
            <ViewSelector view={view} setView={setView} />
            {renderContent()}
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    }>
      <StatsPageInner />
    </Suspense>
  );
}
