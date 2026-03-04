import Link from "next/link";
import { getEnvironmentShares } from "@/lib/actions/stats-actions";
import { EnvironmentChart } from "@/components/stats/EnvironmentChart";
import { BottomNav } from "@/components/layout/BottomNav";

export default async function EnvironmentPage() {
  const data = await getEnvironmentShares();

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
        <EnvironmentChart data={data} />
      </div>
      <BottomNav />
    </>
  );
}
