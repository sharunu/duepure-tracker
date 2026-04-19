"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { FormatSelector } from "@/components/ui/FormatSelector";
import { AdminUserDecks } from "@/components/admin/AdminUserDecks";
import { AdminUserBattles } from "@/components/admin/AdminUserBattles";
import { AdminUserStats } from "@/components/admin/AdminUserStats";
import { AdminUserStageControl } from "@/components/admin/AdminUserStageControl";
import { AdminUserStageHistory } from "@/components/admin/AdminUserStageHistory";
import { AdminUserQualityScore } from "@/components/admin/AdminUserQualityScore";
import { AdminUserAccountInfo } from "@/components/admin/AdminUserAccountInfo";
import { AdminUserHome } from "@/components/admin/AdminUserHome";
import { DEFAULT_GAME, GAMES, GAME_SLUGS, isGameSlug, type GameSlug } from "@/lib/games";

type Tab = "home" | "decks" | "battles" | "stats" | "manage";

const tabs: { value: Tab; label: string }[] = [
  { value: "home", label: "ホーム" },
  { value: "decks", label: "デッキ" },
  { value: "battles", label: "履歴" },
  { value: "stats", label: "分析" },
  { value: "manage", label: "管理" },
];

function AdminUserDetailInner() {
  const params = useParams();
  const userId = params.userId as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawGame = searchParams.get("game");
  const game: GameSlug = isGameSlug(rawGame) ? rawGame : DEFAULT_GAME;
  const gameFormats = GAMES[game].formats;
  const defaultFormatForGame = GAMES[game].defaultFormat ?? "";

  const rawFormat = searchParams.get("format");
  const format = rawFormat && gameFormats.some((f) => f.code === rawFormat)
    ? rawFormat
    : defaultFormatForGame;

  const [tab, setTab] = useState<Tab>("home");
  const [userName, setUserName] = useState<string>("");
  const [userError, setUserError] = useState<string | null>(null);

  const setFormat = (f: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", f);
    params.set("game", game);
    router.push(`/admin/users/${userId}?${params.toString()}`);
  };

  const changeGame = (newGame: GameSlug) => {
    const newDefault = GAMES[newGame].defaultFormat ?? "";
    const params = new URLSearchParams();
    params.set("game", newGame);
    if (newDefault) params.set("format", newDefault);
    router.push(`/admin/users/${userId}?${params.toString()}`);
  };

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          setUserError("ユーザー情報の取得に失敗しました");
        } else {
          setUserName(data?.display_name || "名前未設定");
        }
      });
  }, [userId]);

  return (
    <div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push("/admin/users")} className="text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        {userError ? (
          <p className="text-red-400 text-[14px]">{userError}</p>
        ) : (
          <h1 className="text-[20px] font-medium truncate">{userName}</h1>
        )}
      </div>

      <AdminUserAccountInfo userId={userId} />
      <AdminUserStageControl userId={userId} />

      {/* ゲームタブ */}
      <div className="flex gap-1 mb-3 border-b border-[#232640]">
        {GAME_SLUGS.map((g) => {
          const isActive = g === game;
          return (
            <button
              key={g}
              type="button"
              onClick={() => changeGame(g)}
              className={`px-4 py-2 text-sm transition-colors -mb-px border-b-2 ${
                isActive
                  ? "border-[#818cf8] text-white font-medium"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {GAMES[g].shortName}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <FormatSelector format={format} setFormat={setFormat} game={game} />
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

      {tab === "home" && <AdminUserHome userId={userId} />}
      {tab === "decks" && <AdminUserDecks userId={userId} format={format} game={game} />}
      {tab === "battles" && <AdminUserBattles userId={userId} format={format} game={game} />}
      {tab === "stats" && <AdminUserStats userId={userId} format={format} game={game} />}
      {tab === "manage" && (
        <>
          <AdminUserQualityScore userId={userId} />
          <AdminUserStageHistory userId={userId} />
        </>
      )}
    </div>
  );
}

export default function AdminUserDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen px-4 pt-6 pb-8 max-w-lg mx-auto"><p className="text-gray-500 text-sm">読み込み中...</p></div>}>
      <AdminUserDetailInner />
    </Suspense>
  );
}
