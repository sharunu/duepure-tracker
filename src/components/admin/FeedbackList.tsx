"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Feedback = {
  id: string;
  category: string;
  message: string;
  user_id: string | null;
  created_at: string | null;
};

type Props = {
  feedbacks: Feedback[];
};

const categoryConfig: Record<string, { label: string; color: string; bg: string }> = {
  bug: { label: "バグ", color: "#e85d75", bg: "rgba(232,93,117,0.12)" },
  feature: { label: "機能要望", color: "#5b8def", bg: "rgba(91,141,239,0.12)" },
  other: { label: "その他", color: "#8888aa", bg: "rgba(136,136,170,0.12)" },
};

const filters = [
  { value: null, label: "全て" },
  { value: "bug", label: "バグ" },
  { value: "feature", label: "機能要望" },
  { value: "other", label: "その他" },
];

export function FeedbackList({ feedbacks }: Props) {
  const [filter, setFilter] = useState<string | null>(null);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const userIds = [...new Set(feedbacks.map(f => f.user_id).filter(Boolean))] as string[];
    if (userIds.length === 0) return;

    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        for (const p of data ?? []) {
          map[p.id] = p.display_name || "名前未設定";
        }
        setUserNames(map);
      });
  }, [feedbacks]);

  const filtered = filter ? feedbacks.filter(f => f.category === filter) : feedbacks;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value ?? "all"}
            onClick={() => setFilter(f.value)}
            className={`rounded-[20px] border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-[rgba(91,141,239,0.15)] text-[#5b8def] border-transparent"
                : "bg-[#232640] text-[#8888aa] border-transparent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">フィードバックがありません</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((fb) => {
            const cat = categoryConfig[fb.category] ?? categoryConfig.other;
            const userName = fb.user_id ? (userNames[fb.user_id] ?? "...") : "退会済みユーザー";
            const date = fb.created_at ? new Date(fb.created_at) : null;
            const dateStr = date ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "";

            return (
              <div key={fb.id} className="bg-[#232640] rounded-[10px] px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ color: cat.color, backgroundColor: cat.bg }}
                  >
                    {cat.label}
                  </span>
                  <span className="text-[11px] text-gray-500">{dateStr}</span>
                  <span className="text-[11px] text-gray-500 ml-auto truncate max-w-[120px]">{userName}</span>
                </div>
                <p className="text-[13px] text-[#ccccdd] whitespace-pre-wrap break-words">{fb.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
