"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getDeckDetailStats, getGlobalDeckDetailStats } from "@/lib/actions/stats-actions";
import type { DeckDetailStats, OpponentDetail } from "@/lib/actions/stats-actions";
import { getDailyBattleCounts } from "@/lib/actions/battle-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { DateRangeCalendar } from "@/components/battle/DateRangeCalendar";
import { TuningStatsSection } from "@/components/stats/TuningStatsSection";
import { BottomNav } from "@/components/layout/BottomNav";

function WinRateText({ rate }: { rate: number }) {
  return (
    <span className={rate >= 50 ? "text-success" : "text-destructive"}>
      勝率 {rate}%
    </span>
  );
}

function TurnOrderRow({ label, wins, losses, total, winRate }: { label: string; wins: number; losses: number; total: number; winRate: number }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-muted-foreground w-14">{label}</span>
      <span className="flex-1 text-right">
        <WinRateText rate={winRate} />
        <span className="text-muted-foreground ml-2">{wins}Win {losses}Lose ({total}件)</span>
      </span>
    </div>
  );
}

function OpponentRow({ opp }: { opp: { opponentName: string } & OpponentDetail }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <span>vs {opp.opponentName}</span>
        <span className="flex items-center gap-2">
          <WinRateText rate={opp.winRate} />
          <span className="text-muted-foreground text-xs">{opp.wins}Win {opp.losses}Lose ({opp.total}件)</span>
        </span>
      </div>
      <div className="pl-2">
        <TurnOrderRow label="先攻" wins={opp.firstWins} losses={opp.firstLosses} total={opp.firstTotal} winRate={opp.firstWinRate} />
        <TurnOrderRow label="後攻" wins={opp.secondWins} losses={opp.secondLosses} total={opp.secondTotal} winRate={opp.secondWinRate} />
        <TurnOrderRow label="不明" wins={opp.unknownWins} losses={opp.unknownLosses} total={opp.unknownTotal} winRate={opp.unknownWinRate} />
      </div>
    </div>
  );
}

export default function DeckDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { format, setFormat, ready } = useFormat();

  const deckName = decodeURIComponent(params.deckName as string);
  const isGlobal = searchParams.get("scope") === "global";

  const [stats, setStats] = useState<DeckDetailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [battleCounts, setBattleCounts] = useState<Record<string, number>>({});

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
    const fetchFn = isGlobal ? getGlobalDeckDetailStats : getDeckDetailStats;
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

  const handleRangeChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        {/* Back button */}
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

        <h1 className="text-xl font-bold">{isGlobal ? `${deckName}（全体）` : deckName}</h1>

        <div className={!ready ? "invisible" : ""}>
          <FormatSelector format={format} setFormat={setFormat} />
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

            {/* Overall section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold">全体</h2>
                <span className="text-sm">
                  <WinRateText rate={stats.overallWinRate} />
                  <span className="text-muted-foreground text-xs ml-2">{stats.overallWins}Win {stats.overallLosses}Lose ({stats.overallTotal}件)</span>
                </span>
              </div>
              {stats.overall.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">データがありません</p>
              ) : (
                <div className="rounded-lg border border-border bg-card px-4 py-2 space-y-3">
                  {stats.overall.map((opp) => (
                    <OpponentRow key={opp.opponentName} opp={opp} />
                  ))}
                </div>
              )}
            </div>

            {/* Tuning stats section - only for personal scope */}
            {!isGlobal && stats.tuningStats.length > 0 && (
              <div>
                <h2 className="text-base font-bold mb-2">チューニング別</h2>
                <TuningStatsSection tuningStats={stats.tuningStats} />
              </div>
            )}
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}
