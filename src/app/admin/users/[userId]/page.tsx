"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormat } from "@/hooks/use-format";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { AdminUserDecks } from "@/components/admin/AdminUserDecks";
import { AdminUserBattles } from "@/components/admin/AdminUserBattles";
import { AdminUserStats } from "@/components/admin/AdminUserStats";

type Tab = "decks" | "battles" | "stats";

const tabs: { value: Tab; label: string }[] = [
  { value: "decks", label: "デッキ" },
  { value: "battles", label: "履歴" },
  { value: "stats", label: "分析" },
];

export default function AdminUserDetailPage() {
  const params = useParams();
  const userId = params.userId as string;
  const router = useRouter();
  const { format, setFormat, ready } = useFormat();
  const [tab, setTab] = useState<Tab>("decks");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        setUserName(data?.display_name || "名前未設定");
      });
  }, [userId]);

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/admin/users")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-[20px] font-medium truncate">{userName}</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className={!ready ? "invisible" : ""}>
          <FormatSelector format={format} setFormat={setFormat} />
        </div>
      </div>

      <div className="flex rounded-[8px] border border-border overflow-hidden mb-4">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 py-2 text-[13px] font-medium transition-colors ${
              tab === t.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/30"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ready && tab === "decks" && <AdminUserDecks userId={userId} format={format} />}
      {ready && tab === "battles" && <AdminUserBattles userId={userId} format={format} />}
      {ready && tab === "stats" && <AdminUserStats userId={userId} format={format} />}
    </div>
  );
}
