import { createClient } from "@/lib/supabase/client";
import { DEFAULT_GAME, type GameSlug } from "@/lib/games";
import type { DetailedPersonalStats, TurnOrderSummary, OpponentDetail, TrendRow } from "@/lib/actions/stats-actions";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Not authorized");
  return supabase;
}

export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ?? false;
}

// === 対面デッキ管理（既存） ===

export async function getOpponentDeckMasterList(format?: string, game: GameSlug = DEFAULT_GAME) {
  const supabase = await requireAdmin();
  let query = supabase
    .from("opponent_deck_master")
    .select("*")
    .eq("game_title", game);

  if (format) {
    query = query.eq("format", format);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addOpponentDeck(name: string, format: string = "ND", category: string = "major", game: GameSlug = DEFAULT_GAME) {
  const supabase = await requireAdmin();

  const { data: maxOrder } = await supabase
    .from("opponent_deck_master")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextOrder = (maxOrder?.sort_order ?? 0) + 10;

  const { error } = await supabase.from("opponent_deck_master").insert({
    name: name.trim(),
    sort_order: nextOrder,
    format,
    category,
    game_title: game,
  });

  if (error) throw new Error(error.message);
}

export async function updateOpponentDeck(
  id: string,
  updates: { name?: string; is_active?: boolean; category?: string; admin_bonus_count?: number }
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_master")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteOpponentDeck(id: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_master")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// === 設定関連 ===

export async function getOpponentDeckSettings(format: string, game: GameSlug = DEFAULT_GAME) {
  const supabase = createClient();
  const { data } = await supabase
    .from("opponent_deck_settings")
    .select("*")
    .eq("format", format)
    .eq("game_title", game)
    .single();
  return data;
}

export async function updateOpponentDeckSettings(
  format: string,
  updates: {
    management_mode?: string;
    major_threshold?: number;
    minor_threshold?: number;
    usage_period_days?: number;
    disable_period_days?: number;
  },
  game: GameSlug = DEFAULT_GAME
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("format", format)
    .eq("game_title", game);
  if (error) throw new Error(error.message);
}

// === 即時再計算 ===

export async function recalculateOpponentDecks(format: string, game: GameSlug = DEFAULT_GAME) {
  const supabase = await requireAdmin();
  const { error } = await supabase.rpc("recalculate_opponent_decks", {
    p_format: format,
    p_game_title: game,
  });
  if (error) throw new Error(error.message);
}

// === 並べ替え（モード1用） ===

export async function reorderOpponentDecks(deckIds: string[]) {
  const supabase = await requireAdmin();
  const updates = deckIds.map((id, index) =>
    supabase.from("opponent_deck_master").update({ sort_order: index }).eq("id", id)
  );
  await Promise.all(updates);
}

// === admin_bonus_count 更新 ===

export async function updateAdminBonusCount(id: string, count: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("opponent_deck_master")
    .update({ admin_bonus_count: count })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// === モード2用: デッキ一覧+統計取得 ===

export async function getOpponentDeckStatsForAdmin(format: string, game: GameSlug = DEFAULT_GAME) {
  const supabase = await requireAdmin();

  const { data: settings } = await supabase
    .from("opponent_deck_settings")
    .select("*")
    .eq("format", format)
    .eq("game_title", game)
    .single();

  const usagePeriod = settings?.usage_period_days ?? 14;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - usagePeriod);

  const { data: decks } = await supabase
    .from("opponent_deck_master")
    .select("*")
    .eq("format", format)
    .eq("game_title", game)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  const { data: battles } = await supabase
    .from("battles")
    .select("opponent_deck_name")
    .eq("format", format)
    .eq("game_title", game)
    .gte("fought_at", startDate.toISOString());

  const battleCounts: Record<string, number> = {};
  let totalBattles = 0;
  for (const b of battles ?? []) {
    battleCounts[b.opponent_deck_name] = (battleCounts[b.opponent_deck_name] ?? 0) + 1;
    totalBattles++;
  }

  const totalBonus = (decks ?? [])
    .filter(d => d.is_active)
    .reduce((sum: number, d: { admin_bonus_count: number }) => sum + (d.admin_bonus_count ?? 0), 0);
  const denominator = totalBattles + totalBonus;

  return {
    decks: (decks ?? []).map((d: { name: string; admin_bonus_count: number; is_active: boolean; [key: string]: unknown }) => ({
      ...d,
      battle_count: battleCounts[d.name] ?? 0,
      usage_rate: denominator > 0
        ? ((battleCounts[d.name] ?? 0) + (d.admin_bonus_count ?? 0)) * 100 / denominator
        : 0,
    })),
    totalBattles,
    totalBonus,
    denominator,
  };
}

export async function getBattleCountsForPeriod(format: string, periodDays: number, game: GameSlug = DEFAULT_GAME) {
  const supabase = await requireAdmin();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);
  const { data: battles } = await supabase
    .from("battles")
    .select("opponent_deck_name")
    .eq("format", format)
    .eq("game_title", game)
    .gte("fought_at", startDate.toISOString());
  const counts: Record<string, number> = {};
  for (const b of battles ?? []) {
    counts[b.opponent_deck_name] = (counts[b.opponent_deck_name] ?? 0) + 1;
  }
  return counts;
}

// =============================================
// 管理者ダッシュボード用関数
// =============================================

// === ユーザー一覧 ===

export type AdminUserListRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  is_guest: boolean;
  created_at: string;
  battle_count: number;
  x_username: string | null;
  x_user_id: string | null;
  stage: number;
  auth_provider: string;
};

export async function getAdminUserList(): Promise<AdminUserListRow[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)("get_users_for_admin");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminUserListRow[];
}

// === ユーザーのデッキ取得 ===

export async function getAdminUserDecks(userId: string, format: string) {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("decks")
    .select("id, name, sort_order, deck_tunings(id, name, sort_order)")
    .eq("user_id", userId)
    .eq("format", format)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  return (data ?? []).map(d => ({
    ...d,
    deck_tunings: (d.deck_tunings ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }));
}

// === ユーザーの戦績取得 ===

export async function getAdminUserBattles(
  userId: string, format: string, startDate: string, endDate: string
) {
  await requireAdmin();
  const supabase = createClient();
  const endPlusOne = new Date(endDate);
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const { data } = await supabase
    .from("battles")
    .select("*")
    .eq("user_id", userId)
    .eq("format", format)
    .gte("fought_at", startDate)
    .lt("fought_at", endPlusOne.toISOString().split("T")[0])
    .order("fought_at", { ascending: false });
  return data ?? [];
}

// === ユーザーの個人統計 ===

export async function getAdminUserPersonalStats(
  userId: string, format: string, startDate?: string, endDate?: string
): Promise<DetailedPersonalStats> {
  await requireAdmin();
  const supabase = createClient();

  const empty: DetailedPersonalStats = {
    myDeckStats: [], opponentDeckStats: [],
    turnOrder: { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 },
  };

  let query = supabase
    .from("battles")
    .select("my_deck_name, opponent_deck_name, result, turn_order, fought_at")
    .eq("user_id", userId)
    .eq("format", format);

  if (startDate) query = query.gte("fought_at", startDate);
  if (endDate) {
    const endPlusOne = new Date(endDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    query = query.lt("fought_at", endPlusOne.toISOString().split("T")[0]);
  }

  const { data: battles } = await query;
  if (!battles || battles.length === 0) return empty;

  const myDeckMap = new Map<string, { wins: number; losses: number; total: number; opponents: Map<string, OpponentDetail> }>();
  const oppDeckMap = new Map<string, { wins: number; losses: number; total: number }>();
  const turnOrder: TurnOrderSummary = { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 };

  for (const b of battles) {
    const myDeckName = b.my_deck_name ?? "不明";
    const oppName = b.opponent_deck_name;
    const isWin = b.result === "win";

    if (!myDeckMap.has(myDeckName)) {
      myDeckMap.set(myDeckName, { wins: 0, losses: 0, total: 0, opponents: new Map() });
    }
    const myEntry = myDeckMap.get(myDeckName)!;
    myEntry.total++;
    if (isWin) myEntry.wins++; else myEntry.losses++;

    if (!myEntry.opponents.has(oppName)) {
      myEntry.opponents.set(oppName, {
        wins: 0, losses: 0, total: 0, winRate: 0,
        firstWins: 0, firstLosses: 0, firstTotal: 0, firstWinRate: 0,
        secondWins: 0, secondLosses: 0, secondTotal: 0, secondWinRate: 0,
        unknownWins: 0, unknownLosses: 0, unknownTotal: 0, unknownWinRate: 0,
      });
    }
    const oppDetail = myEntry.opponents.get(oppName)!;
    oppDetail.total++;
    if (isWin) oppDetail.wins++; else oppDetail.losses++;

    if (b.turn_order === "first") {
      oppDetail.firstTotal++;
      if (isWin) oppDetail.firstWins++; else oppDetail.firstLosses++;
      if (isWin) turnOrder.firstWins++; else turnOrder.firstLosses++;
    } else if (b.turn_order === "second") {
      oppDetail.secondTotal++;
      if (isWin) oppDetail.secondWins++; else oppDetail.secondLosses++;
      if (isWin) turnOrder.secondWins++; else turnOrder.secondLosses++;
    } else {
      oppDetail.unknownTotal++;
      if (isWin) oppDetail.unknownWins++; else oppDetail.unknownLosses++;
      if (isWin) turnOrder.unknownWins++; else turnOrder.unknownLosses++;
    }

    if (!oppDeckMap.has(oppName)) oppDeckMap.set(oppName, { wins: 0, losses: 0, total: 0 });
    const oppGlobal = oppDeckMap.get(oppName)!;
    oppGlobal.total++;
    if (isWin) oppGlobal.wins++; else oppGlobal.losses++;
  }

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  const myDeckStats = Array.from(myDeckMap.entries())
    .map(([deckName, s]) => ({
      deckName,
      wins: s.wins, losses: s.losses, total: s.total,
      winRate: safeRate(s.wins, s.total),
      opponents: Array.from(s.opponents.entries())
        .map(([opponentName, o]) => ({
          opponentName, ...o,
          winRate: safeRate(o.wins, o.total),
          firstWinRate: safeRate(o.firstWins, o.firstTotal),
          secondWinRate: safeRate(o.secondWins, o.secondTotal),
          unknownWinRate: safeRate(o.unknownWins, o.unknownTotal),
        }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

  const opponentDeckStats = Array.from(oppDeckMap.entries())
    .map(([deckName, s]) => ({
      deckName, ...s, winRate: safeRate(s.wins, s.total),
    }))
    .sort((a, b) => b.total - a.total);

  return { myDeckStats, opponentDeckStats, turnOrder };
}

// === ユーザーのデッキ推移 ===

export async function getAdminUserDeckTrend(
  userId: string, startDate: string, endDate: string, format: string
): Promise<TrendRow[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_deck_trend_range", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
    p_user_id: userId,
  });
  if (error) return [];
  return ((data as { period_start: string; deck_name: string; battle_count: number; share_pct: number }[]) ?? []).map((r) => ({
    periodStart: r.period_start,
    deckName: r.deck_name,
    battleCount: Number(r.battle_count),
    sharePct: Number(r.share_pct),
  }));
}

// === ユーザーの日別戦績数（カレンダー用） ===

export async function getAdminUserDailyBattleCounts(
  userId: string, format: string, year: number, month: number
): Promise<Record<string, number>> {
  await requireAdmin();
  const supabase = createClient();
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
  const endDate = nextMonth.toISOString().split("T")[0];
  const { data } = await supabase
    .from("battles")
    .select("fought_at")
    .eq("user_id", userId)
    .eq("format", format)
    .gte("fought_at", startDate)
    .lt("fought_at", endDate);
  const counts: Record<string, number> = {};
  for (const b of (data ?? [])) {
    const day = new Date(b.fought_at).toLocaleDateString("sv-SE");
    counts[day] = (counts[day] || 0) + 1;
  }
  return counts;
}

// === フィードバック一覧 ===

export type AdminFeedback = {
  id: string;
  category: string;
  message: string;
  user_id: string | null;
  created_at: string | null;
  status: "pending" | "resolved";
};

export async function getAdminFeedbackList(): Promise<AdminFeedback[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("feedback")
    .select("id, category, message, user_id, created_at, status")
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminFeedback[];
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: "pending" | "resolved"
): Promise<void> {
  const supabase = await requireAdmin();
  const { error } = await (supabase.rpc as any)("update_feedback_status", {
    p_feedback_id: feedbackId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
}

// =============================================
// ステージ管理
// =============================================

export async function updateUserStage(
  userId: string, newStage: number, reason: string
): Promise<void> {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles").select("stage").eq("id", userId).single();
  const fromStage = profile?.stage ?? 2;

  await supabase.from("profiles").update({ stage: newStage }).eq("id", userId);

  await supabase.from("user_stage_history").insert({
    user_id: userId,
    from_stage: fromStage,
    to_stage: newStage,
    reason,
    changed_by: user!.id,
  });
}

export async function getUserStageHistory(userId: string) {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("user_stage_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// =============================================
// 検知ルール管理
// =============================================

export async function getDetectionRules() {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("detection_rules")
    .select("*")
    .order("rule_key");
  return data ?? [];
}

export async function updateDetectionRule(
  ruleKey: string, params: Record<string, unknown>, isEnabled: boolean
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("detection_rules")
    .update({ params: params as Record<string, number>, is_enabled: isEnabled, updated_at: new Date().toISOString() })
    .eq("rule_key", ruleKey);
  if (error) throw new Error(error.message);
}

// =============================================
// 検知アラート管理
// =============================================

export async function getDetectionAlerts(resolvedOnly: boolean = false) {
  await requireAdmin();
  const supabase = createClient();
  let query = supabase
    .from("detection_alerts")
    .select("*")
    .order("created_at", { ascending: false });

  if (!resolvedOnly) {
    query = query.eq("is_resolved", false);
  }

  const { data } = await query;
  return data ?? [];
}

export async function getDetectionAlertCount(): Promise<number> {
  await requireAdmin();
  const supabase = createClient();
  const { count } = await supabase
    .from("detection_alerts")
    .select("*", { count: "exact", head: true })
    .eq("is_resolved", false);
  return count ?? 0;
}

export async function resolveDetectionAlert(alertId: string) {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("detection_alerts")
    .update({
      is_resolved: true,
      resolved_by: user!.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", alertId);
  if (error) throw new Error(error.message);
}

export async function runDetectionScan(): Promise<number> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc("run_detection_scan");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

// ============================================================
// 品質スコアリング管理
// ============================================================

export async function getQualityScoringRules() {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quality_scoring_rules")
    .select("*")
    .order("category")
    .order("rule_key");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateQualityScoringRule(
  ruleKey: string,
  params: Record<string, number>,
  score: number,
  isEnabled: boolean
) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("quality_scoring_rules")
    .update({
      params,
      score,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("rule_key", ruleKey);
  if (error) throw new Error(error.message);
}

export async function getQualityScoreThreshold(): Promise<number> {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("quality_scoring_settings")
    .select("value")
    .eq("key", "threshold")
    .single();
  return data?.value ? Number(data.value) : 40;
}

export async function updateQualityScoreThreshold(threshold: number) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("quality_scoring_settings")
    .update({ value: threshold as unknown as string, updated_at: new Date().toISOString() })
    .eq("key", "threshold");
  if (error) throw new Error(error.message);
}

export async function getQualityScoreSnapshot(userId: string) {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("quality_score_snapshots")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function getQualityAdminBonus(userId: string) {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase
    .from("quality_admin_bonus")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function upsertQualityAdminBonus(
  userId: string,
  score: number,
  memo: string
) {
  const supabase = await requireAdmin();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("quality_admin_bonus")
    .upsert(
      {
        user_id: userId,
        score,
        memo,
        granted_by: user!.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
  if (error) throw new Error(error.message);
}

export async function deleteQualityAdminBonus(userId: string) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("quality_admin_bonus")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function runQualityScoring(): Promise<{
  calculated: number;
  promoted: number;
  demoted: number;
  threshold: number;
}> {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc("run_quality_scoring", {
    p_auto_update: true,
  });
  if (error) throw new Error(error.message);
  return data as { calculated: number; promoted: number; demoted: number; threshold: number };
}

export async function calculateSingleUserScore(userId: string) {
  const supabase = await requireAdmin();
  const { data, error } = await supabase.rpc("calculate_quality_score", {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return data as { total_score: number; breakdown: Record<string, number>; eligible: boolean };
}

// === 優良ユーザーUI表示設定 ===

export async function getPremiumUiVisible(): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("quality_scoring_settings")
    .select("value")
    .eq("key", "premium_ui_visible")
    .single();
  if (!data || data.value === null || data.value === undefined) return true;
  return data.value === true || data.value === "true";
}

export async function updatePremiumUiVisible(visible: boolean) {
  const supabase = await requireAdmin();
  const { error } = await supabase
    .from("quality_scoring_settings")
    .update({ value: visible as unknown as string, updated_at: new Date().toISOString() })
    .eq("key", "premium_ui_visible");
  if (error) throw new Error(error.message);
}

// === 管理者用ユーザー詳細情報 ===

export type AdminUserDetail = {
  x_username: string | null;
  x_user_id: string | null;
  discord_id: string | null;
  discord_username: string | null;
  teams: {
    team_id: string;
    team_name: string;
    discord_guild_id: string;
    icon_url: string | null;
    members: { user_id: string; discord_username: string }[];
  }[];
  auth_provider: string;
  email: string | null;
};

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  const supabase = await requireAdmin();
  const { data, error } = await (supabase.rpc as any)('get_user_detail_for_admin', { p_user_id: userId });
  if (error) throw new Error(error.message);
  return data as AdminUserDetail;
}
