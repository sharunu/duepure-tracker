"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getQualityScoringRules, updateQualityScoringRule } from "@/lib/actions/admin-actions";

type Rule = {
  id: string;
  rule_key: string;
  display_name: string;
  description: string | null;
  category: string;
  params: Record<string, number>;
  score: number;
  is_enabled: boolean;
};

const paramLabels: Record<string, Record<string, string>> = {
  throwaway_suspect: { max_days: "判定期間（日）" },
  long_term_user: { min_days: "最低利用期間（日）" },
  recent_battles: { period_days: "判定期間（日）", min_battles: "最低戦闘数" },
  opponent_diversity: { last_n_battles: "直近N戦", min_distinct: "最低種類数" },
  normal_winrate: { min_battles: "最低戦闘数", min_rate: "下限勝率(%)", max_rate: "上限勝率(%)" },
  normal_input_pace: { window_hours: "ウィンドウ（時間）", min_battles: "最低戦闘数", max_battles: "上限戦闘数" },
  extreme_winrate_q: { min_battles: "最低戦闘数", high_rate: "上限勝率(%)", low_rate: "下限勝率(%)" },
  repetitive_pattern_q: { max_consecutive: "連続回数" },
  excessive_input: { window_hours: "ウィンドウ（時間）", max_battles: "閾値（戦闘数）" },
};

const categoryLabels: Record<string, string> = {
  account_trust: "アカウント信頼性",
  activity: "活動量",
  data_quality: "データ品質",
  behavior_plus: "行動（加点）",
  behavior_minus: "行動（減点）",
};

const categoryOrder = ["account_trust", "activity", "data_quality", "behavior_plus", "behavior_minus"];

export default function QualityScoringRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editParams, setEditParams] = useState<Record<string, Record<string, number>>>({});
  const [editScores, setEditScores] = useState<Record<string, number>>({});
  const [editEnabled, setEditEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getQualityScoringRules().then((data) => {
      const r = data as Rule[];
      setRules(r);
      const params: Record<string, Record<string, number>> = {};
      const scores: Record<string, number> = {};
      const enabled: Record<string, boolean> = {};
      for (const rule of r) {
        params[rule.rule_key] = { ...rule.params };
        scores[rule.rule_key] = rule.score;
        enabled[rule.rule_key] = rule.is_enabled;
      }
      setEditParams(params);
      setEditScores(scores);
      setEditEnabled(enabled);
      setLoading(false);
    });
  }, []);

  const handleSave = async (ruleKey: string) => {
    setSaving(ruleKey);
    setMessage("");
    try {
      await updateQualityScoringRule(ruleKey, editParams[ruleKey], editScores[ruleKey], editEnabled[ruleKey]);
      setMessage("保存しました");
    } catch {
      setMessage("保存に失敗しました");
    }
    setSaving(null);
    setTimeout(() => setMessage(""), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center pt-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // カテゴリ別にグループ化
  const grouped: Record<string, Rule[]> = {};
  for (const rule of rules) {
    if (!grouped[rule.category]) grouped[rule.category] = [];
    grouped[rule.category].push(rule);
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin/quality-scoring")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">スコアリングルール設定</h1>
      </div>

      {message && (
        <p className={`text-[12px] mb-3 ${message.includes("失敗") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}

      <div className="space-y-6">
        {categoryOrder.map((cat) => {
          const catRules = grouped[cat];
          if (!catRules || catRules.length === 0) return null;
          return (
            <div key={cat}>
              <p className="text-[13px] font-medium text-gray-400 mb-2">{categoryLabels[cat] || cat}</p>
              <div className="space-y-3">
                {catRules.map((rule) => {
                  const labels = paramLabels[rule.rule_key] || {};
                  return (
                    <div key={rule.id} className="bg-[#232640] rounded-[10px] px-4 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-[14px] font-medium">{rule.display_name}</p>
                          {rule.description && (
                            <p className="text-[11px] text-gray-500 mt-0.5">{rule.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditEnabled(prev => ({ ...prev, [rule.rule_key]: !prev[rule.rule_key] }))}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            editEnabled[rule.rule_key] ? "bg-[#6366f1]" : "bg-[#333355]"
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${
                            editEnabled[rule.rule_key] ? "left-[22px]" : "left-[2px]"
                          }`} />
                        </button>
                      </div>

                      {/* スコア */}
                      <div className="flex items-center justify-between mt-3 mb-2">
                        <label className="text-[12px] text-gray-400">スコア</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editScores[rule.rule_key]}
                            onChange={(e) => {
                              const num = parseInt(e.target.value);
                              if (!isNaN(num)) {
                                setEditScores(prev => ({ ...prev, [rule.rule_key]: num }));
                              }
                            }}
                            className="w-20 bg-[#1a1d2e] rounded-[6px] px-2 py-1.5 text-[13px] text-right focus:outline-none"
                            style={{ border: "0.5px solid #333355" }}
                          />
                          <span className="text-[11px] text-gray-500">点</span>
                        </div>
                      </div>

                      {/* パラメータ */}
                      {Object.keys(editParams[rule.rule_key] || {}).length > 0 && (
                        <div className="space-y-2">
                          {Object.entries(editParams[rule.rule_key]).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between">
                              <label className="text-[12px] text-gray-400">{labels[key] || key}</label>
                              <input
                                type="number"
                                step="1"
                                value={value}
                                onChange={(e) => {
                                  const num = parseFloat(e.target.value);
                                  if (!isNaN(num)) {
                                    setEditParams(prev => ({
                                      ...prev,
                                      [rule.rule_key]: { ...prev[rule.rule_key], [key]: num },
                                    }));
                                  }
                                }}
                                className="w-24 bg-[#1a1d2e] rounded-[6px] px-2 py-1.5 text-[13px] text-right focus:outline-none"
                                style={{ border: "0.5px solid #333355" }}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => handleSave(rule.rule_key)}
                        disabled={saving === rule.rule_key}
                        className="w-full mt-3 bg-[#3d4070] text-white rounded-[6px] px-3 py-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {saving === rule.rule_key ? "保存中..." : "保存"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
