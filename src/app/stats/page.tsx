"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { getDetailedPersonalStats, getGlobalStatsByRange, getDeckTrendByRange, getTeamStatsByRange, getTeamDeckTrendByRange } from "@/lib/actions/stats-actions";
import type { DetailedPersonalStats, TrendRow } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts, getOpponentDeckSuggestions } from "@/lib/actions/battle-actions";
import { getTeamMembers, getMyTeamsWithVisibility } from "@/lib/actions/team-actions";
import type { TeamMember, TeamWithVisibility } from "@/lib/actions/team-actions";
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
import { TrendHeatmap } from "@/components/stats/TrendHeatmap";
import { TeamMemberSelector } from "@/components/stats/TeamMemberSelector";
import { TeamSelector } from "@/components/stats/TeamSelector";
import { BottomNav } from "@/components/layout/BottomNav";
import { getWinRateColor } from "@/lib/stats-utils";
import { TurnOrderCards } from "@/components/stats/TurnOrderCards";

function StatsPageInner() {
  const searchParams = useSearchParams();
  const { format, setFormat, ready } = useFormat();
  const { activeTeamId, setActiveTeamId, ready: teamReady } = useActiveTeam();
  const [scope, setScope] = useState<Scope>(() => {
    const sp = searchParams.get("scope");
    return (sp === "personal" || sp === "global" || sp === "team") ? sp : "personal";
  });
  const [view, setView] = useState<View>("stats");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [personalStats, setPersonalStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [], turnOrder: { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 } });
  const [globalStats, setGlobalStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [], turnOrder: { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 } });
  const [teamStats, setTeamStats] = useState<DetailedPersonalStats>({ myDeckStats: [], opponentDeckStats: [], turnOrder: { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 } });
  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  const [deckCategories, setDeckCategories] = useState<{ major: string[]; minor: string[]; other: string[] }>({ major: [], minor: [], other: [] });
  const [trendMode, setTrendMode] = useState<"line" | "heatmap">("line");
  const [trendCalcMode, setTrendCalcMode] = useState<"daily" | "cumulative">("daily");

  // Team states
  const [visibleTeams, setVisibleTeams] = useState<TeamWithVisibility[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Load visible teams
  useEffect(() => {
    getMyTeamsWithVisibility().then((teams) => {
      setVisibleTeams(teams.filter((t) => !t.hidden));
    });
  }, []);

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

  // Fetch deck categories
  useEffect(() => {
    if (!ready) return;
    getOpponentDeckSuggestions(format).then(setDeckCategories);
  }, [format, ready]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, "major" | "minor" | "other">();
    for (const name of deckCategories.major) m.set(name, "major");
    for (const name of deckCategories.minor) m.set(name, "minor");
    for (const name of deckCategories.other) m.set(name, "other");
    return m;
  }, [deckCategories]);

  // Compute cumulative trend data from daily data
  const cumulativeTrendData = useMemo(() => {
    if (trendData.length === 0) return [];
    const periods = [...new Set(trendData.map(d => d.periodStart))].sort();
    const deckNames = [...new Set(trendData.map(d => d.deckName))];
    const lookup = new Map<string, Map<string, number>>();
    for (const d of trendData) {
      if (!lookup.has(d.periodStart)) lookup.set(d.periodStart, new Map());
      lookup.get(d.periodStart)!.set(d.deckName, d.battleCount);
    }
    const cumCounts = new Map<string, number>();
    const result: TrendRow[] = [];
    for (const period of periods) {
      for (const deck of deckNames) {
        const count = lookup.get(period)?.get(deck) ?? 0;
        cumCounts.set(deck, (cumCounts.get(deck) ?? 0) + count);
      }
      let totalCum = 0;
      for (const c of cumCounts.values()) totalCum += c;
      for (const deck of deckNames) {
        const cumCount = cumCounts.get(deck) ?? 0;
        if (cumCount > 0) {
          result.push({
            periodStart: period,
            deckName: deck,
            battleCount: cumCount,
            sharePct: totalCum > 0 ? Math.round((cumCount / totalCum) * 100) : 0,
          });
        }
      }
    }
    return result;
  }, [trendData]);

  // Apply calc mode + major-only filter
  const filteredTrendData = useMemo(() => {
    const source = trendCalcMode === "daily" ? trendData : cumulativeTrendData;
    if (deckCategories.major.length === 0) return source;
    const majorSet = new Set(deckCategories.major);
    return source.filter(row => majorSet.has(row.deckName));
  }, [trendData, cumulativeTrendData, trendCalcMode, deckCategories.major]);

  const loadData = useCallback(async () => {
    if (!ready || !teamReady) {
      return;
    }

    if (scope === "team" && !activeTeamId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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

    } catch {
      console.error("Failed to load stats data");
      setError("データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
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
    if (error) {
      return <p className="text-center text-red-400 py-12 text-sm">{error}</p>;
    }

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

      // Aggregate opponent deck stats: major/minor individual, other -> "その他"
      const aggregatedDonut: { name: string; total: number; winRate: number }[] = [];
      const otherBreakdown: { name: string; total: number; winRate: number }[] = [];
      let otherWins = 0, otherLosses = 0, otherTotal = 0;
      for (const o of stats.opponentDeckStats) {
        const cat = categoryMap.get(o.deckName) ?? "other";
        if (cat === "major" || cat === "minor") {
          aggregatedDonut.push({ name: o.deckName, total: o.total, winRate: o.winRate });
        } else {
          otherWins += o.wins;
          otherLosses += o.losses;
          otherTotal += o.total;
          otherBreakdown.push({ name: o.deckName, total: o.total, winRate: o.winRate });
        }
      }
      if (otherTotal > 0) {
        aggregatedDonut.push({ name: "その他", total: otherTotal, winRate: Math.round((otherWins / otherTotal) * 100) });
      }

      // Aggregate myDeckStats for global scope — also collect the actual "other" deck names
      const otherMyDeckNames: string[] = [];
      const myDeckData = scope === "global" && categoryMap.size > 0 ? (() => {
        const kept: typeof stats.myDeckStats = [];
        let mOtherWins = 0, mOtherLosses = 0, mOtherTotal = 0;
        for (const d of stats.myDeckStats) {
          const cat = categoryMap.get(d.deckName) ?? "other";
          if (cat === "major" || cat === "minor") {
            kept.push(d);
          } else {
            mOtherWins += d.wins;
            mOtherLosses += d.losses;
            mOtherTotal += d.total;
            otherMyDeckNames.push(d.deckName);
          }
        }
        if (mOtherTotal > 0) {
          kept.push({ deckName: "その他", wins: mOtherWins, losses: mOtherLosses, total: mOtherTotal, winRate: Math.round((mOtherWins / mOtherTotal) * 100), opponents: [] });
        }
        return kept;
      })() : stats.myDeckStats;

      return (
        <>
          <div>
            <h2 className="text-base font-bold mb-2">対面デッキ分布</h2>
            {stats.opponentDeckStats.length > 0 ? (
              <EncounterDonutChart
                items={categoryMap.size > 0 ? aggregatedDonut : stats.opponentDeckStats.map(o => ({ name: o.deckName, total: o.total, winRate: o.winRate }))}
                otherBreakdown={otherBreakdown}
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
            <h2 className="text-base font-bold mb-2">先攻/後攻別</h2>
            <TurnOrderCards
              firstWins={stats.turnOrder.firstWins} firstLosses={stats.turnOrder.firstLosses} firstTotal={stats.turnOrder.firstWins + stats.turnOrder.firstLosses}
              secondWins={stats.turnOrder.secondWins} secondLosses={stats.turnOrder.secondLosses} secondTotal={stats.turnOrder.secondWins + stats.turnOrder.secondLosses}
              unknownWins={stats.turnOrder.unknownWins} unknownLosses={stats.turnOrder.unknownLosses} unknownTotal={stats.turnOrder.unknownWins + stats.turnOrder.unknownLosses}
            />
          </div>
          <div>
            <h2 className="text-base font-bold mb-2">使用デッキ別</h2>
            {scope === "global" && categoryMap.size > 0 && (
              <p className="text-xs text-muted-foreground">※ 使用率の低いデッキは「その他」に集約されています</p>
            )}
            <MyDeckStatsSection stats={myDeckData} startDate={startDate} endDate={endDate} scope={scope} teamId={activeTeamId ?? undefined} memberId={selectedMemberId} memberName={selectedMemberId ? (teamMembers.find(m => m.user_id === selectedMemberId)?.discord_username ?? null) : null} otherDeckNames={otherMyDeckNames} />
          </div>
          <div>
            <h2 className="text-base font-bold mb-2">対面デッキ別</h2>
            <OpponentDeckStatsSection stats={stats.opponentDeckStats} startDate={startDate} endDate={endDate} scope={scope} teamId={activeTeamId ?? undefined} memberId={selectedMemberId} memberName={selectedMemberId ? (teamMembers.find(m => m.user_id === selectedMemberId)?.discord_username ?? null) : null} />
          </div>
        </>
      );
    }

    if (view === "trend") {
      return (
        <>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <div className="flex rounded-full border border-border overflow-hidden">
              <button onClick={() => setTrendMode("line")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${trendMode === "line" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                折れ線
              </button>
              <button onClick={() => setTrendMode("heatmap")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${trendMode === "heatmap" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                ヒートマップ
              </button>
            </div>
            <div className="flex rounded-full border border-border overflow-hidden">
              <button onClick={() => setTrendCalcMode("daily")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${trendCalcMode === "daily" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                単日
              </button>
              <button onClick={() => setTrendCalcMode("cumulative")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${trendCalcMode === "cumulative" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                累計
              </button>
            </div>
          </div>
          {deckCategories.major.length > 0 && (
            <p className="text-xs text-muted-foreground">※ 使用率の高いデッキのみ表示されています</p>
          )}
          {trendMode === "line"
            ? <TrendChart data={filteredTrendData} />
            : <TrendHeatmap data={filteredTrendData} />
          }
        </>
      );
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
            <ScopeSelector scope={scope} setScope={setScope} teamEnabled={visibleTeams.length > 0} />
            {scope === "team" && visibleTeams.length > 1 && (
              <TeamSelector
                teams={visibleTeams}
                activeTeamId={activeTeamId}
                onSelect={setActiveTeamId}
              />
            )}
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
