"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings, Play } from "lucide-react";
import {
  getQualityScoreThreshold,
  updateQualityScoreThreshold,
  runQualityScoring,
  getPremiumUiVisible,
  updatePremiumUiVisible,
} from "@/lib/actions/admin-actions";

export default function QualityScoringPage() {
  const router = useRouter();
  const [threshold, setThreshold] = useState(40);
  const [editThreshold, setEditThreshold] = useState(40);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [result, setResult] = useState<{
    calculated: number;
    promoted: number;
    demoted: number;
    threshold: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [premiumUiVisible, setPremiumUiVisible] = useState(true);
  const [savingPremiumUi, setSavingPremiumUi] = useState(false);

  useEffect(() => {
    Promise.all([getQualityScoreThreshold(), getPremiumUiVisible()]).then(
      ([t, visible]) => {
        setThreshold(t);
        setEditThreshold(t);
        setPremiumUiVisible(visible);
        setLoading(false);
      }
    );
  }, []);

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setMessage("");
    try {
      const res = await runQualityScoring();
      setResult(res);
    } catch {
      setMessage("再計算に失敗しました");
    }
    setRunning(false);
  };

  const handleSaveThreshold = async () => {
    setSavingThreshold(true);
    setMessage("");
    try {
      await updateQualityScoreThreshold(editThreshold);
      setThreshold(editThreshold);
      setMessage("閾値を保存しました");
    } catch {
      setMessage("保存に失敗しました");
    }
    setSavingThreshold(false);
    setTimeout(() => setMessage(""), 2000);
  };

  const handleTogglePremiumUi = async () => {
    setSavingPremiumUi(true);
    try {
      const next = !premiumUiVisible;
      await updatePremiumUiVisible(next);
      setPremiumUiVisible(next);
    } catch {
      setMessage("保存に失敗しました");
    }
    setSavingPremiumUi(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center pt-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.push("/admin")} className="text-muted-foreground hover:text-foreground">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">品質スコアリング</h1>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4 ml-7">
        毎日 04:15 JST に全ユーザーの品質スコアが再計算され、ステージの昇降格が自動で行われます。「今すぐ再計算」は即時確認用です。
      </p>

      {/* アクションバー */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-[8px] px-3 py-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Play size={14} />
          {running ? "実行中..." : "今すぐ再計算"}
        </button>
        <button
          onClick={() => router.push("/admin/quality-scoring/rules")}
          className="flex items-center gap-1.5 bg-surface-2 text-foreground rounded-[8px] px-3 py-2 text-[12px] font-medium hover:opacity-90"
          style={{ border: "0.5px solid var(--border-subtle)" }}
        >
          <Settings size={14} />
          ルール設定
        </button>
      </div>

      {message && (
        <p className={`text-[12px] mb-3 ${message.includes("失敗") ? "text-destructive" : "text-success"}`}>
          {message}
        </p>
      )}

      {/* 再計算結果 */}
      {result && (
        <div className="bg-surface-2 rounded-[10px] px-4 py-4 mb-4">
          <p className="text-[14px] font-medium mb-3">再計算結果</p>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-muted-foreground">計算対象ユーザー数</span>
              <span>{result.calculated}人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">昇格（一般→優良）</span>
              <span className="text-success">{result.promoted}人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">降格（優良→一般）</span>
              <span className="text-warning">{result.demoted}人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">判定閾値</span>
              <span>{result.threshold}点</span>
            </div>
          </div>
        </div>
      )}

      {/* 閾値設定 */}
      <div className="bg-surface-2 rounded-[10px] px-4 py-4">
        <p className="text-[14px] font-medium mb-1">優良判定の閾値</p>
        <p className="text-[11px] text-muted-foreground mb-3">合計スコアがこの値以上で優良ユーザーと判定されます</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={editThreshold}
            onChange={(e) => {
              const num = parseInt(e.target.value);
              if (!isNaN(num)) setEditThreshold(num);
            }}
            className="w-24 bg-surface-1 rounded-[6px] px-2 py-1.5 text-[13px] text-right focus:outline-none"
            style={{ border: "0.5px solid var(--border)" }}
          />
          <span className="text-[12px] text-muted-foreground">点</span>
          <button
            onClick={handleSaveThreshold}
            disabled={savingThreshold || editThreshold === threshold}
            className="ml-auto bg-primary text-primary-foreground rounded-[6px] px-4 py-1.5 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {savingThreshold ? "保存中..." : "保存"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">現在の閾値: {threshold}点</p>
      </div>

      {/* 優良ユーザーUI表示設定 */}
      <div className="bg-surface-2 rounded-[10px] px-4 py-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium mb-1">優良ユーザーUI表示</p>
            <p className="text-[11px] text-muted-foreground">
              OFFにするとユーザー側の優良ユーザー関連UIが非表示になります
            </p>
          </div>
          <button
            onClick={handleTogglePremiumUi}
            disabled={savingPremiumUi}
            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-3 ${
              premiumUiVisible ? "bg-primary" : "bg-muted"
            } ${savingPremiumUi ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
              premiumUiVisible ? "left-[22px]" : "left-[2px]"
            }`} />
          </button>
        </div>
      </div>
    </div>
  );
}
