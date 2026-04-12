"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getDetectionRules, updateDetectionRule } from "@/lib/actions/admin-actions";

type Rule = {
  id: string;
  rule_key: string;
  display_name: string;
  description: string | null;
  params: Record<string, number>;
  is_enabled: boolean;
};

const paramLabels: Record<string, Record<string, string>> = {
  extreme_winrate: {
    period_days: "判定期間（日）",
    min_battles: "最低戦闘数",
    max_winrate: "上限勝率",
    min_winrate: "下限勝率",
  },
  rapid_input: {
    window_hours: "ウィンドウ（時間）",
    max_battles: "閾値（戦闘数）",
  },
  repetitive_pattern: {
    max_consecutive: "連続回数",
  },
};

export default function DetectionRulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [editParams, setEditParams] = useState<Record<string, Record<string, number>>>({});
  const [editEnabled, setEditEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getDetectionRules().then((data) => {
      const r = data as Rule[];
      setRules(r);
      const params: Record<string, Record<string, number>> = {};
      const enabled: Record<string, boolean> = {};
      for (const rule of r) {
        params[rule.rule_key] = { ...rule.params };
        enabled[rule.rule_key] = rule.is_enabled;
      }
      setEditParams(params);
      setEditEnabled(enabled);
      setLoading(false);
    });
  }, []);

  const handleSave = async (ruleKey: string) => {
    setSaving(ruleKey);
    setMessage("");
    try {
      await updateDetectionRule(ruleKey, editParams[ruleKey], editEnabled[ruleKey]);
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

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin/detection")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium">検知ルール設定</h1>
      </div>

      {message && (
        <p className={`text-[12px] mb-3 ${message.includes("失敗") ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}

      <div className="space-y-4">
        {rules.map((rule) => {
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
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    editEnabled[rule.rule_key] ? "translate-x-5" : "translate-x-0.5"
                  }`} />
                </button>
              </div>

              <div className="space-y-2 mt-3">
                {Object.entries(editParams[rule.rule_key] || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-[12px] text-gray-400">{labels[key] || key}</label>
                    <input
                      type="number"
                      step={key.includes("rate") ? "0.01" : "1"}
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
}
