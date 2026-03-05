"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPersonalStats } from "@/lib/actions/stats-actions";
import { PersonalStatsTable } from "@/components/stats/PersonalStatsTable";
import { BottomNav } from "@/components/layout/BottomNav";

export default function StatsPage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPersonalStats>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPersonalStats().then((s) => { setStats(s); setLoading(false); });
  }, []);

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">個人統計</h1>
          <Link
            href="/stats/environment"
            className="text-sm text-primary hover:underline"
          >
            環境統計 →
          </Link>
        </div>
        {loading ? (
          <p className="text-muted-foreground text-sm">読み込み中...</p>
        ) : (
          <PersonalStatsTable stats={stats} />
        )}
      </div>
      <BottomNav />
    </>
  );
}
