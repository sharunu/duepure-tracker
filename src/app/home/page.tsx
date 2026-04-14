"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDiscordConnection, getMyTeamsWithVisibility, getTeamMembers, disconnectDiscord, toggleTeamVisibility, refreshGuilds } from "@/lib/actions/team-actions";
import type { DiscordConnection, TeamWithVisibility } from "@/lib/actions/team-actions";
import { useActiveTeam } from "@/hooks/use-active-team";
import { BottomNav } from "@/components/layout/BottomNav";

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeTeamId, setActiveTeamId, ready: teamReady } = useActiveTeam();

  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [connection, setConnection] = useState<DiscordConnection | null>(null);
  const [teams, setTeams] = useState<TeamWithVisibility[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hiddenExpanded, setHiddenExpanded] = useState(false);

  const visibleTeams = teams.filter((t) => !t.hidden);
  const hiddenTeams = teams.filter((t) => t.hidden);

  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/auth");
      return;
    }

    setIsGuest(!!user.is_anonymous);

    const conn = await getDiscordConnection();
    setConnection(conn);

    if (conn) {
      const myTeams = await getMyTeamsWithVisibility();
      setTeams(myTeams);
    }

    setLoading(false);
    } catch {
      setError("データの読み込みに失敗しました");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh guilds on load when connected
  useEffect(() => {
    if (!loading && connection) {
      refreshGuilds().then((ok) => {
        if (ok) {
          getMyTeamsWithVisibility().then(setTeams);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, !!connection]);

  // Load member count when active team changes
  useEffect(() => {
    if (!activeTeamId) {
      setMemberCount(null);
      return;
    }
    getTeamMembers(activeTeamId).then((members) => {
      setMemberCount(members.length);
    });
  }, [activeTeamId]);

  // Auto-select first visible team if none selected
  useEffect(() => {
    if (!loading && teamReady && !activeTeamId && visibleTeams.length > 0) {
      setActiveTeamId(visibleTeams[0].id);
    }
  }, [loading, teamReady, activeTeamId, visibleTeams, setActiveTeamId]);

  // Clear active team if it is not in visible list
  useEffect(() => {
    if (!loading && teamReady && activeTeamId && visibleTeams.length > 0 && !visibleTeams.find((t) => t.id === activeTeamId)) {
      setActiveTeamId(visibleTeams[0].id);
    }
  }, [loading, teamReady, activeTeamId, visibleTeams, setActiveTeamId]);

  // Clear active team if all teams hidden
  useEffect(() => {
    if (!loading && teamReady && activeTeamId && visibleTeams.length === 0) {
      setActiveTeamId(null);
    }
  }, [loading, teamReady, activeTeamId, visibleTeams, setActiveTeamId]);

  const handleDiscordConnect = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    if (!clientId) {
      alert("Discord Client IDが設定されていません");
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/api/discord/callback`,
      response_type: "code",
      scope: "identify guilds",
      state: session.access_token,
    });

    window.location.href = `https://discord.com/oauth2/authorize?${params.toString()}`;
  };

  const handleDisconnect = async () => {
    if (!confirm("Discord連携を解除しますか？チーム情報も削除されます。")) return;
    setDisconnecting(true);
    const ok = await disconnectDiscord();
    if (ok) {
      setConnection(null);
      setTeams([]);
      setActiveTeamId(null);
    }
    setDisconnecting(false);
  };

  const handleToggleVisibility = async (teamId: string, currentlyHidden: boolean) => {
    if (!currentlyHidden) {
      if (!confirm("このサーバーを非表示にすると、戦績の共有も停止されます。")) return;
    }
    const ok = await toggleTeamVisibility(teamId, !currentlyHidden);
    if (ok) {
      setTeams((prev) =>
        prev.map((t) => (t.id === teamId ? { ...t, hidden: !currentlyHidden } : t))
      );
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    const ok = await refreshGuilds();
    if (ok) {
      const myTeams = await getMyTeamsWithVisibility();
      setTeams(myTeams);
    }
    setRefreshing(false);
  };

  const discordStatus = searchParams.get("discord");

  if (error) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <p className="text-center text-red-400 py-12 text-sm">{error}</p>
        </div>
        <BottomNav />
      </>
    );
  }

  if (loading) {
    return (
      <>
        <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto">
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  const renderTeamCard = (team: TeamWithVisibility, isHiddenSection: boolean) => {
    const isActive = activeTeamId === team.id;
    return (
      <div key={team.id} className="flex items-center gap-2">
        <button
          onClick={() => !isHiddenSection && setActiveTeamId(team.id)}
          className={`flex-1 flex items-center gap-3 rounded-xl border p-3 transition-colors text-left ${
            isHiddenSection
              ? "border-muted/20 opacity-50"
              : isActive
              ? "border-primary/50 bg-primary/10"
              : "border-muted/30 hover:border-muted/50"
          }`}
          disabled={isHiddenSection}
        >
          {team.icon_url ? (
            <img
              src={team.icon_url}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center text-sm font-medium text-muted-foreground">
              {team.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{team.name}</p>
          </div>
          {isActive && !isHiddenSection && (
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
          )}
        </button>
        <button
          onClick={() => handleToggleVisibility(team.id, team.hidden)}
          className="p-2 rounded-lg hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
          title={team.hidden ? "再表示" : "非表示にする"}
        >
          {team.hidden ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
        <h1 className="text-xl font-bold">ホーム</h1>

        {discordStatus === "connected" && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
            Discordとの連携が完了しました
          </div>
        )}
        {discordStatus === "error" && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            Discord連携に失敗しました。もう一度お試しください。
          </div>
        )}

        {!connection ? (
          // Discord未連携
          <div className="rounded-xl border border-muted/30 p-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-base font-bold">Discord連携</h2>
              <p className="text-sm text-muted-foreground">
                Discordと連携すると、同じサーバーのメンバーとチームとして戦績を共有できます。
              </p>
            </div>
            {isGuest ? (
              <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg px-4 py-3">
                Discord連携にはアカウント登録が必要です
              </p>
            ) : (
              <button
                onClick={handleDiscordConnect}
                className="w-full rounded-lg px-4 py-3 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: "#5865F2" }}
              >
                Discordと連携する
              </button>
            )}
          </div>
        ) : (
          // Discord連携済み
          <>
            <div className="rounded-xl border border-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#5865F2" }}>
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="white">
                      <path d="M13.55 1.01A13.3 13.3 0 0010.26 0a.05.05 0 00-.05.02c-.14.25-.3.58-.41.84a12.3 12.3 0 00-3.6 0 8.6 8.6 0 00-.42-.84.05.05 0 00-.05-.02c-1.15.2-2.24.56-3.29 1.01a.05.05 0 00-.02.02C.39 3.95-.24 6.8.07 9.61a.06.06 0 00.02.04 13.4 13.4 0 004.03 2.01.05.05 0 00.06-.02c.31-.42.59-.86.83-1.33a.05.05 0 00-.03-.07 8.8 8.8 0 01-1.25-.59.05.05 0 01-.01-.08c.08-.06.17-.13.25-.19a.05.05 0 01.05-.01c2.63 1.18 5.47 1.18 8.07 0a.05.05 0 01.05 0c.08.07.17.13.25.2a.05.05 0 010 .08c-.4.23-.82.43-1.26.59a.05.05 0 00-.02.07c.24.47.52.91.82 1.33a.05.05 0 00.06.02 13.4 13.4 0 004.04-2.01.05.05 0 00.02-.04c.37-3.34-.62-6.16-2.63-8.58a.04.04 0 00-.02-.02zM5.34 7.88c-.76 0-1.38-.69-1.38-1.53s.61-1.53 1.38-1.53c.78 0 1.4.69 1.39 1.53 0 .84-.61 1.53-1.39 1.53zm5.14 0c-.76 0-1.38-.69-1.38-1.53s.61-1.53 1.38-1.53c.78 0 1.4.69 1.39 1.53 0 .84-.61 1.53-1.39 1.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{connection.discord_username}</p>
                    <p className="text-xs text-muted-foreground">Discord連携済み</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {disconnecting ? "解除中..." : "連携解除"}
                </button>
              </div>
            </div>

            {/* Team list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">チーム一覧</h2>
                <div className="flex items-center gap-2">
                  {memberCount !== null && activeTeamId && (
                    <span className="text-xs text-muted-foreground">メンバー {memberCount}人</span>
                  )}
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    title="サーバー情報を更新"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={refreshing ? "animate-spin" : ""}
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                選択中のチームメンバーと戦績を共有できます。戦績タブでチーム統計を確認しましょう。
              </p>

              {teams.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  所属チームがありません
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Visible teams */}
                  {visibleTeams.map((team) => renderTeamCard(team, false))}

                  {/* Hidden teams */}
                  {hiddenTeams.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => setHiddenExpanded(!hiddenExpanded)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`transition-transform ${hiddenExpanded ? "rotate-90" : ""}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        非表示サーバー（{hiddenTeams.length}件）
                      </button>
                      {hiddenExpanded && (
                        <div className="space-y-2 mt-2">
                          {hiddenTeams.map((team) => renderTeamCard(team, true))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}
