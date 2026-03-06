"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPersonalStats } from "@/lib/actions/stats-actions";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { PersonalStatsTable } from "@/components/stats/PersonalStatsTable";
import { BottomNav } from "@/components/layout/BottomNav";

export default function StatsPage() {
  const { format, setFormat } = useFormat();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getPersonalStats>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPersonalStats(format).then((s) => { setStats(s); setLoading(false); });
  }, [format]);

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
        <div className="mb-4">
          <FormatSelector format={format} setFormat={setFormat} />
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
