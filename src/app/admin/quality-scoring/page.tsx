"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Settings, Play } from "lucide-react";
import {
  getQualityScoreThreshold,
  updateQualityScoreThreshold,
  runQualityScoring,
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

  useEffect(() => {
    getQualityScoreThreshold().then((t) => {
      setThreshold(t);
      setEditThreshold(t);
      setLoading(false);
    });
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

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center pt-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/admin")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">品質スコアリング</h1>
      </div>

      {/* アクションバー */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-1.5 bg-[#6366f1] text-white rounded-[8px] px-3 py-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          <Play size={14} />
          {running ? "実行中..." : "今すぐ再計算"}
        </button>
        <button
          onClick={() => router.push("/admin/quality-scoring/rules")}
          className="flex items-center gap-1.5 bg-[#232640] text-gray-300 rounded-[8px] px-3 py-2 text-[12px] font-medium hover:opacity-90"
          style={{ border: "0.5px solid rgba(100,100,150,0.2)" }}
        >
          <Settings size={14} />
          ルール設定
        </button>
      </div>

      {message && (
        <p className={`text-[12px] mb-3 ${message.includes("失敗") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}

      {/* 再計算結果 */}
      {result && (
        <div className="bg-[#232640] rounded-[10px] px-4 py-4 mb-4">
          <p className="text-[14px] font-medium mb-3">再計算結果</p>
          <div className="space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-gray-400">計算対象ユーザー数</span>
              <span>{result.calculated}人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">昇格（一般→優良）</span>
              <span className="text-green-400">{result.promoted}人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">降格（優良→一般）</span>
              <span className="text-orange-400">{result.demoted}人</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">判定閾値</span>
              <span>{result.threshold}点</span>
            </div>
          </div>
        </div>
      )}

      {/* 閾値設定 */}
      <div className="bg-[#232640] rounded-[10px] px-4 py-4">
        <p className="text-[14px] font-medium mb-1">優良判定の閾値</p>
        <p className="text-[11px] text-gray-500 mb-3">合計スコアがこの値以上で優良ユーザーと判定されます</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={editThreshold}
            onChange={(e) => {
              const num = parseInt(e.target.value);
              if (!isNaN(num)) setEditThreshold(num);
            }}
            className="w-24 bg-[#1a1d2e] rounded-[6px] px-2 py-1.5 text-[13px] text-right focus:outline-none"
            style={{ border: "0.5px solid #333355" }}
          />
          <span className="text-[12px] text-gray-500">点</span>
          <button
            onClick={handleSaveThreshold}
            disabled={savingThreshold || editThreshold === threshold}
            className="ml-auto bg-[#3d4070] text-white rounded-[6px] px-4 py-1.5 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
          >
            {savingThreshold ? "保存中..." : "保存"}
          </button>
        </div>
        <p className="text-[11px] text-gray-600 mt-2">現在の閾値: {threshold}点</p>
      </div>
    </div>
  );
}
