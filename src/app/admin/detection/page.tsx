"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings, Play } from "lucide-react";
import { getDetectionAlerts, resolveDetectionAlert, runDetectionScan, getAdminUserList } from "@/lib/actions/admin-actions";

type Alert = {
  id: string;
  user_id: string;
  rule_key: string;
  details: Record<string, unknown> | null;
  is_resolved: boolean;
  created_at: string;
};

const ruleLabels: Record<string, string> = {
  extreme_winrate: "極端な勝率",
  rapid_input: "短時間大量入力",
  repetitive_pattern: "同一結果の連続",
};

export default function DetectionPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertData, users] = await Promise.all([
        getDetectionAlerts(showResolved),
        getAdminUserList(),
      ]);
      setAlerts(alertData as Alert[]);
      const map: Record<string, string> = {};
      for (const u of users as { id: string; display_name: string | null }[]) {
        map[u.id] = u.display_name || "名前未設定";
      }
      setUserMap(map);
    } catch {
      // error
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [showResolved]);

  const handleResolve = async (alertId: string) => {
    await resolveDetectionAlert(alertId);
    loadData();
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const count = await runDetectionScan();
      setScanResult(`スキャン完了: ${count}件のアラートを検知`);
      loadData();
    } catch {
      setScanResult("スキャンに失敗しました");
    }
    setScanning(false);
  };

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/admin")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">検知アラート</h1>
      </div>

      {/* アクションバー */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-1.5 bg-[#6366f1] text-white rounded-[8px] px-3 py-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Play size={14} />
          {scanning ? "実行中..." : "今すぐスキャン"}
        </button>
        <button
          onClick={() => router.push("/admin/detection/rules")}
          className="flex items-center gap-1.5 bg-[#232640] text-gray-300 rounded-[8px] px-3 py-2 text-[12px] font-medium hover:opacity-90"
          style={{ border: "0.5px solid rgba(100,100,150,0.2)" }}
        >
          <Settings size={14} />
          ルール設定
        </button>
        <div className="ml-auto">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`text-[11px] px-2.5 py-1 rounded-full ${showResolved ? "bg-[#6366f1] text-white" : "bg-[#232640] text-gray-400"}`}
          >
            {showResolved ? "全件" : "未解決のみ"}
          </button>
        </div>
      </div>

      {scanResult && (
        <p className={`text-[12px] mb-3 ${scanResult.includes("失敗") ? "text-red-400" : "text-green-400"}`}>
          {scanResult}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-center text-[13px] text-gray-500 py-12">アラートはありません</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-[#232640] rounded-[10px] px-4 py-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(232,93,117,0.15)] text-[#e85d75] font-medium">
                    {ruleLabels[alert.rule_key] || alert.rule_key}
                  </span>
                  <p className="text-[13px] font-medium mt-1.5">
                    {userMap[alert.user_id] || alert.user_id.slice(0, 8)}
                  </p>
                </div>
                <span className="text-[10px] text-gray-600">
                  {new Date(alert.created_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* 詳細展開 */}
              {alert.details && (
                <div className="text-[11px] text-gray-500 bg-[#1a1d2e] rounded-[6px] px-3 py-2 mb-2">
                  {Object.entries(alert.details).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="text-gray-400">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/admin/users/${alert.user_id}`)}
                  className="text-[11px] text-[#818cf8] hover:underline"
                >
                  ユーザー詳細
                </button>
                {!alert.is_resolved && (
                  <button
                    onClick={() => handleResolve(alert.id)}
                    className="text-[11px] text-gray-500 hover:text-gray-300 ml-auto"
                  >
                    対処済みにする
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
