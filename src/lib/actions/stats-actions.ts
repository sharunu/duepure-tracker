import { createClient } from "@/lib/supabase/client";
import { winRate } from "@/lib/battle/result-format";

// PR7 Phase 7b: 4 個人統計関数 (getPersonalStats / getDetailedPersonalStats /
// getDeckDetailStats / getOpponentDeckDetailStats) は personal stats RPC 経由に切替済。
// JS 集計時代のヘルパー (addToDetail / newOppDetail / finalizeDetail / finalizeDetailWithName) は
// 切替により dead になったため削除。
type PersonalStatsRpcRow = {
  deck_name: string;
  wins: number | string;
  losses: number | string;
  draws: number | string | null;
  total: number | string;
  win_rate: number | string | null;
};

type PersonalDetailRpcRow = {
  wins: number | string;
  losses: number | string;
  draws: number | string | null;
  total: number | string;
  win_rate: number | string | null;
  first_wins: number | string;
  first_losses: number | string;
  first_draws: number | string | null;
  first_total: number | string;
  second_wins: number | string;
  second_losses: number | string;
  second_draws: number | string | null;
  second_total: number | string;
  unknown_wins: number | string;
  unknown_losses: number | string;
  unknown_draws: number | string | null;
  unknown_total: number | string;
};

type DeckDetailOverallRpcRow = PersonalDetailRpcRow & { opponent_deck_name: string };
type DeckDetailByTuningRpcRow = PersonalDetailRpcRow & {
  tuning_name: string;
  opponent_deck_name: string;
};
type OpponentDeckDetailRpcRow = PersonalDetailRpcRow & { my_deck_name: string };

const toN = (v: number | string | null | undefined): number =>
  v == null ? 0 : Number(v);

const toWinRate = (v: number | string | null | undefined): number | null =>
  v == null ? null : Number(v);

const mapDetailRow = (r: PersonalDetailRpcRow): OpponentDetail => ({
  wins: toN(r.wins),
  losses: toN(r.losses),
  draws: toN(r.draws),
  total: toN(r.total),
  winRate: toWinRate(r.win_rate),
  firstWins: toN(r.first_wins),
  firstLosses: toN(r.first_losses),
  firstDraws: toN(r.first_draws),
  firstTotal: toN(r.first_total),
  firstWinRate: winRate(toN(r.first_wins), toN(r.first_losses)),
  secondWins: toN(r.second_wins),
  secondLosses: toN(r.second_losses),
  secondDraws: toN(r.second_draws),
  secondTotal: toN(r.second_total),
  secondWinRate: winRate(toN(r.second_wins), toN(r.second_losses)),
  unknownWins: toN(r.unknown_wins),
  unknownLosses: toN(r.unknown_losses),
  unknownDraws: toN(r.unknown_draws),
  unknownTotal: toN(r.unknown_total),
  unknownWinRate: winRate(toN(r.unknown_wins), toN(r.unknown_losses)),
});

export async function getPersonalStats(format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 個人統計 RPC で opponent_deck 軸に集計 (auth.uid() で本人 battles のみ対象)。
  // 全期間表示のため p_start_date / p_end_date は null。
  // database.types.ts の自動生成型に未登録のため supabase 全体を any にキャスト (this binding を保持)。
  const rpcs = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcs.rpc("get_personal_opponent_deck_stats_range", {
    p_start_date: null,
    p_end_date: null,
    p_format: format,
  });
  if (error || !data) return [];
  return ((data as unknown as PersonalStatsRpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: toN(r.wins),
    losses: toN(r.losses),
    draws: toN(r.draws),
    total: toN(r.total),
    winRate: toWinRate(r.win_rate),
  }));
}

export async function getEnvironmentShares(days = 7, format: string = "ND") {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_environment_deck_shares", {
    p_days: days,
    p_format: format,
  });

  if (error) return [];
  return (data as { deck_name: string; battle_count: number; share_pct: number }[]) ?? [];
}

export async function getEnvironmentSharesByRange(startDate: string, endDate: string, format: string = "ND") {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_environment_deck_shares_range", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
  });

  if (error) return [];
  return (data as { deck_name: string; battle_count: number; share_pct: number }[]) ?? [];
}

export type OpponentDetail = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number | null;
  firstWins: number;
  firstLosses: number;
  firstDraws: number;
  firstTotal: number;
  firstWinRate: number | null;
  secondWins: number;
  secondLosses: number;
  secondDraws: number;
  secondTotal: number;
  secondWinRate: number | null;
  unknownWins: number;
  unknownLosses: number;
  unknownDraws: number;
  unknownTotal: number;
  unknownWinRate: number | null;
};

export type MyDeckStats = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number | null;
  opponents: Map<string, OpponentDetail>;
};

export type OpponentDeckStats = {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number | null;
};

export type TurnOrderSummary = {
  firstWins: number; firstLosses: number; firstDraws: number;
  secondWins: number; secondLosses: number; secondDraws: number;
  unknownWins: number; unknownLosses: number; unknownDraws: number;
};

const EMPTY_TURN_ORDER: TurnOrderSummary = {
  firstWins: 0, firstLosses: 0, firstDraws: 0,
  secondWins: 0, secondLosses: 0, secondDraws: 0,
  unknownWins: 0, unknownLosses: 0, unknownDraws: 0,
};

export type DetailedPersonalStats = {
  myDeckStats: Array<{ deckName: string } & Omit<MyDeckStats, "opponents"> & { opponents: Array<{ opponentName: string } & OpponentDetail> }>;
  opponentDeckStats: Array<{ deckName: string } & OpponentDeckStats>;
  turnOrder: TurnOrderSummary;
};

export async function getDetailedPersonalStats(
  format: string = "ND",
  startDate?: string,
  endDate?: string
): Promise<DetailedPersonalStats> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { myDeckStats: [], opponentDeckStats: [], turnOrder: { ...EMPTY_TURN_ORDER } };

  // 個人統計 RPC を 3 本並列で呼び、TS 側で legacy return shape に組み立てる。
  // myDeckStats[].opponents は型定義上残るが UI で未参照のため空配列で OK。
  const params = {
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
    p_format: format,
  };

  // database.types.ts の自動生成型に未登録のため supabase 全体を any にキャスト (既存パターン)。
  // ※ const rpc = supabase.rpc as ... で参照を取り出すと this binding が失われて SDK 内部の
  //    this.url / this.headers が undefined になり throw する。必ず supabase.rpc(...) を method
  //    call として呼ぶこと。
  const rpcs = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const [{ data: myDeckData, error: myDeckErr }, { data: oppDeckData, error: oppDeckErr }, { data: turnData, error: turnErr }] = await Promise.all([
    rpcs.rpc("get_personal_my_deck_stats_range", params),
    rpcs.rpc("get_personal_opponent_deck_stats_range", params),
    rpcs.rpc("get_personal_turn_order_stats_range", params),
  ]);
  if (myDeckErr) throw new Error(`get_personal_my_deck_stats_range failed: ${myDeckErr.message}`);
  if (oppDeckErr) throw new Error(`get_personal_opponent_deck_stats_range failed: ${oppDeckErr.message}`);
  if (turnErr) throw new Error(`get_personal_turn_order_stats_range failed: ${turnErr.message}`);

  const myDeckStats = ((myDeckData as unknown as PersonalStatsRpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: toN(r.wins),
    losses: toN(r.losses),
    draws: toN(r.draws),
    total: toN(r.total),
    winRate: toWinRate(r.win_rate),
    opponents: [] as Array<{ opponentName: string } & OpponentDetail>,
  }));

  const opponentDeckStats = ((oppDeckData as unknown as PersonalStatsRpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: toN(r.wins),
    losses: toN(r.losses),
    draws: toN(r.draws),
    total: toN(r.total),
    winRate: toWinRate(r.win_rate),
  }));

  type TurnRow = {
    first_wins: number | string; first_losses: number | string; first_draws: number | string | null;
    second_wins: number | string; second_losses: number | string; second_draws: number | string | null;
    unknown_wins: number | string; unknown_losses: number | string; unknown_draws: number | string | null;
  };
  const turnRow = ((turnData as unknown as TurnRow[]) ?? [])[0];
  const turnOrder: TurnOrderSummary = turnRow ? {
    firstWins: toN(turnRow.first_wins),
    firstLosses: toN(turnRow.first_losses),
    firstDraws: toN(turnRow.first_draws),
    secondWins: toN(turnRow.second_wins),
    secondLosses: toN(turnRow.second_losses),
    secondDraws: toN(turnRow.second_draws),
    unknownWins: toN(turnRow.unknown_wins),
    unknownLosses: toN(turnRow.unknown_losses),
    unknownDraws: toN(turnRow.unknown_draws),
  } : { ...EMPTY_TURN_ORDER };

  return { myDeckStats, opponentDeckStats, turnOrder };
}

export type TuningOpponentDetail = OpponentDetail;

export type TuningStats = {
  tuningName: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number | null;
  opponents: Array<{ opponentName: string } & OpponentDetail>;
};

export type DeckDetailStats = {
  overall: Array<{ opponentName: string } & OpponentDetail>;
  overallWins: number;
  overallLosses: number;
  overallDraws: number;
  overallTotal: number;
  overallWinRate: number | null;
  tuningStats: TuningStats[];
};

export async function getDeckDetailStats(
  deckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<DeckDetailStats> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empty: DeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null, tuningStats: [] };
  if (!user) return empty;

  // 2 personal RPC (overall + by_tuning) を並列実行し TS 側で legacy return shape に組み立てる。
  // by_tuning は (tuning_name, opponent_deck_name) per row、TS で tuning_name ごとに軽くグルーピングする。
  const params = {
    p_deck_name: deckName,
    p_format: format,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  };

  // database.types.ts の自動生成型に未登録のため supabase 全体を any にキャスト (既存パターン)。
  // ※ const rpc = supabase.rpc as ... で参照を取り出すと this binding が失われて throw するため、
  //    必ず supabase.rpc(...) を method call として呼ぶ。
  const rpcs = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };

  const [{ data: overallData, error: overallErr }, { data: byTuningData, error: byTuningErr }] = await Promise.all([
    rpcs.rpc("get_personal_deck_detail_stats_overall", params),
    rpcs.rpc("get_personal_deck_detail_stats_by_tuning", params),
  ]);
  if (overallErr) throw new Error(`get_personal_deck_detail_stats_overall failed: ${overallErr.message}`);
  if (byTuningErr) throw new Error(`get_personal_deck_detail_stats_by_tuning failed: ${byTuningErr.message}`);

  const overallRows = (overallData as unknown as DeckDetailOverallRpcRow[]) ?? [];
  if (overallRows.length === 0) return empty;

  const overall = overallRows
    .map((r) => ({ opponentName: r.opponent_deck_name, ...mapDetailRow(r) }))
    .sort((a, b) => b.total - a.total);

  const overallWins = overall.reduce((s, o) => s + o.wins, 0);
  const overallLosses = overall.reduce((s, o) => s + o.losses, 0);
  const overallDraws = overall.reduce((s, o) => s + o.draws, 0);
  const overallTotal = overallWins + overallLosses + overallDraws;

  // by_tuning グルーピング (tuning_name 単位で opponents 配列を集約 + total/win/loss/draw を sum)
  const byTuningRows = (byTuningData as unknown as DeckDetailByTuningRpcRow[]) ?? [];
  const tuningMap = new Map<string, { wins: number; losses: number; draws: number; total: number; opponents: Array<{ opponentName: string } & OpponentDetail> }>();

  for (const r of byTuningRows) {
    const entry = tuningMap.get(r.tuning_name) ?? { wins: 0, losses: 0, draws: 0, total: 0, opponents: [] };
    const detail = mapDetailRow(r);
    entry.wins += detail.wins;
    entry.losses += detail.losses;
    entry.draws += detail.draws;
    entry.total += detail.total;
    entry.opponents.push({ opponentName: r.opponent_deck_name, ...detail });
    tuningMap.set(r.tuning_name, entry);
  }

  const tuningStats: TuningStats[] = Array.from(tuningMap.entries())
    .map(([tuningName, t]) => ({
      tuningName,
      wins: t.wins,
      losses: t.losses,
      draws: t.draws,
      total: t.total,
      winRate: winRate(t.wins, t.losses),
      opponents: t.opponents.sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    overall,
    overallWins,
    overallLosses,
    overallDraws,
    overallTotal,
    overallWinRate: winRate(overallWins, overallLosses),
    tuningStats,
  };
}

export type OpponentDeckDetailStats = {
  overall: Array<{ myDeckName: string } & OpponentDetail>;
  overallWins: number;
  overallLosses: number;
  overallDraws: number;
  overallTotal: number;
  overallWinRate: number | null;
};

export async function getOpponentDeckDetailStats(
  opponentDeckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<OpponentDeckDetailStats> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const empty: OpponentDeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null };
  if (!user) return empty;

  // personal RPC 経由で my_deck 軸の集計を取得 (legacy JS 集計の RPC 化)。
  // database.types.ts の自動生成型に未登録のため supabase 全体を any にキャスト (this binding を保持)。
  const rpcs = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcs.rpc("get_personal_opponent_deck_detail_stats", {
    p_opponent_deck_name: opponentDeckName,
    p_format: format,
    p_start_date: startDate ?? null,
    p_end_date: endDate ?? null,
  });
  if (error) throw new Error(`get_personal_opponent_deck_detail_stats failed: ${error.message}`);
  if (!data) return empty;

  const rows = (data as unknown as OpponentDeckDetailRpcRow[]) ?? [];
  if (rows.length === 0) return empty;

  const overall = rows
    .map((r) => ({ myDeckName: r.my_deck_name, ...mapDetailRow(r) }))
    .sort((a, b) => b.total - a.total);

  const overallWins = overall.reduce((s, o) => s + o.wins, 0);
  const overallLosses = overall.reduce((s, o) => s + o.losses, 0);
  const overallDraws = overall.reduce((s, o) => s + o.draws, 0);
  const overallTotal = overallWins + overallLosses + overallDraws;

  return {
    overall,
    overallWins,
    overallLosses,
    overallDraws,
    overallTotal,
    overallWinRate: winRate(overallWins, overallLosses),
  };
}

export async function getPersonalEnvironmentSharesByRange(
  startDate: string,
  endDate: string,
  format: string = "ND"
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_personal_environment_shares_range", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
  });
  if (error) return [];
  return (data as { deck_name: string; battle_count: number; share_pct: number }[]) ?? [];
}

export async function getGlobalStatsByRange(
  startDate: string,
  endDate: string,
  format: string = "ND",
  maxStage?: number
): Promise<DetailedPersonalStats> {
  const supabase = createClient();

  const rpcParams = {
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
    ...(maxStage !== undefined ? { p_max_stage: maxStage } : {}),
  };

  const [{ data: myDeckData }, { data: oppDeckData }] = await Promise.all([
    supabase.rpc("get_global_my_deck_stats_range", rpcParams),
    supabase.rpc("get_global_opponent_deck_stats_range", rpcParams),
  ]);

  type RpcRow = { deck_name: string; wins: number; losses: number; draws: number | null; total: number; win_rate: number | null };

  const myDeckStats = ((myDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws ?? 0),
    total: Number(r.total),
    winRate: r.win_rate === null ? null : Number(r.win_rate),
    opponents: [],
  }));

  const opponentDeckStats = ((oppDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws ?? 0),
    total: Number(r.total),
    winRate: r.win_rate === null ? null : Number(r.win_rate),
  }));

  // Turn order aggregation via RPC
  const { data: turnData } = await supabase.rpc("get_global_turn_order_stats_range", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
    ...(maxStage !== undefined ? { p_max_stage: maxStage } : {}),
  });

  const turnRow = (turnData as { first_wins: number; first_losses: number; first_draws: number | null; second_wins: number; second_losses: number; second_draws: number | null; unknown_wins: number; unknown_losses: number; unknown_draws: number | null }[] | null)?.[0];
  const turnOrder: TurnOrderSummary = turnRow ? {
    firstWins: Number(turnRow.first_wins),
    firstLosses: Number(turnRow.first_losses),
    firstDraws: Number(turnRow.first_draws ?? 0),
    secondWins: Number(turnRow.second_wins),
    secondLosses: Number(turnRow.second_losses),
    secondDraws: Number(turnRow.second_draws ?? 0),
    unknownWins: Number(turnRow.unknown_wins),
    unknownLosses: Number(turnRow.unknown_losses),
    unknownDraws: Number(turnRow.unknown_draws ?? 0),
  } : { ...EMPTY_TURN_ORDER };

  return { myDeckStats, opponentDeckStats, turnOrder };
}

export type TrendRow = {
  periodStart: string;
  deckName: string;
  battleCount: number;
  sharePct: number;
};

export async function getDeckTrendByRange(
  startDate: string,
  endDate: string,
  format: string = "ND",
  isPersonal: boolean = false,
  maxStage?: number
): Promise<TrendRow[]> {
  const supabase = createClient();
  let userId: string | undefined = undefined;
  if (isPersonal) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
    if (!userId) return [];
  }

  const { data, error } = await supabase.rpc("get_deck_trend_range", {
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
    p_user_id: userId ?? undefined,
    ...(maxStage !== undefined ? { p_max_stage: maxStage } : {}),
  });

  if (error) return [];
  return ((data as { period_start: string; deck_name: string; battle_count: number; share_pct: number }[]) ?? []).map((r) => ({
    periodStart: r.period_start,
    deckName: r.deck_name,
    battleCount: Number(r.battle_count),
    sharePct: Number(r.share_pct),
  }));
}

type DetailRpcRow = {
  opponent_name?: string;
  my_deck_name?: string;
  wins: number; losses: number; draws: number | null; total: number;
  first_wins: number; first_losses: number; first_draws: number | null; first_total: number;
  second_wins: number; second_losses: number; second_draws: number | null; second_total: number;
  unknown_wins: number; unknown_losses: number; unknown_draws: number | null; unknown_total: number;
  tuning_name?: string;
};

const rowToDetail = (r: DetailRpcRow): OpponentDetail => {
  const w = Number(r.wins); const l = Number(r.losses); const d = Number(r.draws ?? 0); const t = Number(r.total);
  const fw = Number(r.first_wins); const fl = Number(r.first_losses); const fd = Number(r.first_draws ?? 0); const ft = Number(r.first_total);
  const sw = Number(r.second_wins); const sl = Number(r.second_losses); const sd = Number(r.second_draws ?? 0); const st = Number(r.second_total);
  const uw = Number(r.unknown_wins); const ul = Number(r.unknown_losses); const ud = Number(r.unknown_draws ?? 0); const ut = Number(r.unknown_total);
  return {
    wins: w, losses: l, draws: d, total: t, winRate: winRate(w, l),
    firstWins: fw, firstLosses: fl, firstDraws: fd, firstTotal: ft, firstWinRate: winRate(fw, fl),
    secondWins: sw, secondLosses: sl, secondDraws: sd, secondTotal: st, secondWinRate: winRate(sw, sl),
    unknownWins: uw, unknownLosses: ul, unknownDraws: ud, unknownTotal: ut, unknownWinRate: winRate(uw, ul),
  };
};

export async function getGlobalDeckDetailStats(
  deckName: string,
  format: string,
  startDate?: string,
  endDate?: string,
  maxStage?: number
): Promise<DeckDetailStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_global_deck_detail_stats", {
    p_deck_name: deckName,
    p_format: format,
    p_start_date: startDate ?? undefined,
    p_end_date: endDate ?? undefined,
    ...(maxStage !== undefined ? { p_max_stage: maxStage } : {}),
  });

  const empty: DeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null, tuningStats: [] };

  if (error || !data || data.length === 0) return empty;

  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;

  const overall = (data as DetailRpcRow[]).map((r) => {
    const detail = rowToDetail(r);
    totalWins += detail.wins;
    totalLosses += detail.losses;
    totalDraws += detail.draws;
    return { opponentName: r.opponent_name ?? "", ...detail };
  });

  const overallTotal = totalWins + totalLosses + totalDraws;
  return {
    overall,
    overallWins: totalWins,
    overallLosses: totalLosses,
    overallDraws: totalDraws,
    overallTotal,
    overallWinRate: winRate(totalWins, totalLosses),
    tuningStats: [],
  };
}

export async function getGlobalDeckDetailStatsMulti(
  deckNames: string[],
  format: string,
  startDate?: string,
  endDate?: string,
  maxStage?: number
): Promise<DeckDetailStats> {
  const empty: DeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null, tuningStats: [] };
  if (deckNames.length === 0) return empty;

  const results = await Promise.all(
    deckNames.map(name => getGlobalDeckDetailStats(name, format, startDate, endDate, maxStage))
  );

  type Agg = { w: number; l: number; d: number; t: number; fw: number; fl: number; fd: number; ft: number; sw: number; sl: number; sd: number; st: number; uw: number; ul: number; ud: number; ut: number };
  const newAgg = (): Agg => ({ w: 0, l: 0, d: 0, t: 0, fw: 0, fl: 0, fd: 0, ft: 0, sw: 0, sl: 0, sd: 0, st: 0, uw: 0, ul: 0, ud: 0, ut: 0 });
  const overallMap = new Map<string, Agg>();
  let totalWins = 0, totalLosses = 0, totalDraws = 0;

  for (const result of results) {
    totalWins += result.overallWins;
    totalLosses += result.overallLosses;
    totalDraws += result.overallDraws;
    for (const opp of result.overall) {
      const existing = overallMap.get(opp.opponentName) ?? newAgg();
      existing.w += opp.wins; existing.l += opp.losses; existing.d += opp.draws; existing.t += opp.total;
      existing.fw += opp.firstWins; existing.fl += opp.firstLosses; existing.fd += opp.firstDraws; existing.ft += opp.firstTotal;
      existing.sw += opp.secondWins; existing.sl += opp.secondLosses; existing.sd += opp.secondDraws; existing.st += opp.secondTotal;
      existing.uw += opp.unknownWins; existing.ul += opp.unknownLosses; existing.ud += opp.unknownDraws; existing.ut += opp.unknownTotal;
      overallMap.set(opp.opponentName, existing);
    }
  }

  const overall = Array.from(overallMap.entries())
    .map(([opponentName, d]) => ({
      opponentName,
      wins: d.w, losses: d.l, draws: d.d, total: d.t, winRate: winRate(d.w, d.l),
      firstWins: d.fw, firstLosses: d.fl, firstDraws: d.fd, firstTotal: d.ft, firstWinRate: winRate(d.fw, d.fl),
      secondWins: d.sw, secondLosses: d.sl, secondDraws: d.sd, secondTotal: d.st, secondWinRate: winRate(d.sw, d.sl),
      unknownWins: d.uw, unknownLosses: d.ul, unknownDraws: d.ud, unknownTotal: d.ut, unknownWinRate: winRate(d.uw, d.ul),
    }))
    .sort((a, b) => b.total - a.total);

  const overallTotal = totalWins + totalLosses + totalDraws;
  return {
    overall,
    overallWins: totalWins,
    overallLosses: totalLosses,
    overallDraws: totalDraws,
    overallTotal,
    overallWinRate: winRate(totalWins, totalLosses),
    tuningStats: [],
  };
}

export async function getGlobalOpponentDeckDetailStats(
  opponentDeckName: string,
  format: string,
  startDate?: string,
  endDate?: string,
  maxStage?: number
): Promise<OpponentDeckDetailStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_global_opponent_deck_detail_stats", {
    p_opponent_deck_name: opponentDeckName,
    p_format: format,
    p_start_date: startDate ?? undefined,
    p_end_date: endDate ?? undefined,
    ...(maxStage !== undefined ? { p_max_stage: maxStage } : {}),
  });

  const empty: OpponentDeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null };

  if (error || !data || data.length === 0) return empty;

  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;

  const overall = (data as DetailRpcRow[]).map((r) => {
    const detail = rowToDetail(r);
    totalWins += detail.wins;
    totalLosses += detail.losses;
    totalDraws += detail.draws;
    return { myDeckName: r.my_deck_name ?? "", ...detail };
  });

  const overallTotal = totalWins + totalLosses + totalDraws;
  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallDraws: totalDraws, overallTotal, overallWinRate: winRate(totalWins, totalLosses) };
}

// === チーム統計 ===

export async function getTeamStatsByRange(
  teamId: string,
  memberId: string | null,
  format: string,
  startDate: string,
  endDate: string
): Promise<DetailedPersonalStats> {
  const supabase = createClient();

  const [{ data: myDeckData }, { data: oppDeckData }] = await Promise.all([
    supabase.rpc("get_team_my_deck_stats_range", {
      p_team_id: teamId,
      p_user_id: memberId ?? undefined,
      p_start_date: startDate,
      p_end_date: endDate,
      p_format: format,
    }),
    supabase.rpc("get_team_opponent_deck_stats_range", {
      p_team_id: teamId,
      p_user_id: memberId ?? undefined,
      p_start_date: startDate,
      p_end_date: endDate,
      p_format: format,
    }),
  ]);

  type RpcRow = { deck_name: string; wins: number; losses: number; draws: number | null; total: number; win_rate: number | null };

  const myDeckStats = ((myDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws ?? 0),
    total: Number(r.total),
    winRate: r.win_rate === null ? null : Number(r.win_rate),
    opponents: [],
  }));

  const opponentDeckStats = ((oppDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    draws: Number(r.draws ?? 0),
    total: Number(r.total),
    winRate: r.win_rate === null ? null : Number(r.win_rate),
  }));

  const { data: turnData } = await supabase.rpc("get_team_turn_order_stats_range", {
    p_team_id: teamId,
    p_user_id: memberId ?? undefined,
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
  });

  const tr = (turnData as { first_wins: number; first_losses: number; first_draws: number | null; second_wins: number; second_losses: number; second_draws: number | null; unknown_wins: number; unknown_losses: number; unknown_draws: number | null }[] | null)?.[0];
  const turnOrder: TurnOrderSummary = {
    firstWins: Number(tr?.first_wins ?? 0),
    firstLosses: Number(tr?.first_losses ?? 0),
    firstDraws: Number(tr?.first_draws ?? 0),
    secondWins: Number(tr?.second_wins ?? 0),
    secondLosses: Number(tr?.second_losses ?? 0),
    secondDraws: Number(tr?.second_draws ?? 0),
    unknownWins: Number(tr?.unknown_wins ?? 0),
    unknownLosses: Number(tr?.unknown_losses ?? 0),
    unknownDraws: Number(tr?.unknown_draws ?? 0),
  };

  return { myDeckStats, opponentDeckStats, turnOrder };
}

export async function getTeamDeckTrendByRange(
  teamId: string,
  memberId: string | null,
  startDate: string,
  endDate: string,
  format: string
): Promise<TrendRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_team_deck_trend_range", {
    p_team_id: teamId,
    p_user_id: memberId ?? undefined,
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
  });

  if (error) return [];
  return ((data as { period_start: string; deck_name: string; battle_count: number; share_pct: number }[]) ?? []).map((r) => ({
    periodStart: r.period_start,
    deckName: r.deck_name,
    battleCount: Number(r.battle_count),
    sharePct: Number(r.share_pct),
  }));
}

export async function getTeamDeckDetailStats(
  teamId: string,
  memberId: string | null,
  deckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<DeckDetailStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_team_deck_detail_stats", {
    p_team_id: teamId,
    p_deck_name: deckName,
    p_format: format,
    p_user_id: memberId ?? undefined,
    p_start_date: startDate ?? undefined,
    p_end_date: endDate ?? undefined,
  });

  const empty: DeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null, tuningStats: [] };

  if (error || !data || data.length === 0) return empty;

  type Row = DetailRpcRow & { opponent_name: string; tuning_name: string };
  const rows = data as Row[];

  type Agg = { w: number; l: number; d: number; t: number; fw: number; fl: number; fd: number; ft: number; sw: number; sl: number; sd: number; st: number; uw: number; ul: number; ud: number; ut: number };
  const newAgg = (): Agg => ({ w: 0, l: 0, d: 0, t: 0, fw: 0, fl: 0, fd: 0, ft: 0, sw: 0, sl: 0, sd: 0, st: 0, uw: 0, ul: 0, ud: 0, ut: 0 });

  const overallMap = new Map<string, Agg>();
  const tuningMap = new Map<string, { opponents: Map<string, Agg>; totalW: number; totalL: number; totalD: number; totalT: number }>();

  for (const r of rows) {
    const opp = r.opponent_name;
    const w = Number(r.wins); const l = Number(r.losses); const d = Number(r.draws ?? 0); const t = Number(r.total);
    const fw = Number(r.first_wins); const fl = Number(r.first_losses); const fd = Number(r.first_draws ?? 0); const ft = Number(r.first_total);
    const sw = Number(r.second_wins); const sl = Number(r.second_losses); const sd = Number(r.second_draws ?? 0); const st = Number(r.second_total);
    const uw = Number(r.unknown_wins); const ul = Number(r.unknown_losses); const ud = Number(r.unknown_draws ?? 0); const ut = Number(r.unknown_total);

    // Overall
    const existing = overallMap.get(opp) ?? newAgg();
    existing.w += w; existing.l += l; existing.d += d; existing.t += t;
    existing.fw += fw; existing.fl += fl; existing.fd += fd; existing.ft += ft;
    existing.sw += sw; existing.sl += sl; existing.sd += sd; existing.st += st;
    existing.uw += uw; existing.ul += ul; existing.ud += ud; existing.ut += ut;
    overallMap.set(opp, existing);

    // Tuning
    const tn = r.tuning_name;
    if (!tuningMap.has(tn)) {
      tuningMap.set(tn, { opponents: new Map(), totalW: 0, totalL: 0, totalD: 0, totalT: 0 });
    }
    const te = tuningMap.get(tn)!;
    te.totalW += w; te.totalL += l; te.totalD += d; te.totalT += t;
    const to2 = te.opponents.get(opp) ?? newAgg();
    to2.w += w; to2.l += l; to2.d += d; to2.t += t;
    to2.fw += fw; to2.fl += fl; to2.fd += fd; to2.ft += ft;
    to2.sw += sw; to2.sl += sl; to2.sd += sd; to2.st += st;
    to2.uw += uw; to2.ul += ul; to2.ud += ud; to2.ut += ut;
    te.opponents.set(opp, to2);
  }

  const mapToDetail = (d: Agg) => ({
    wins: d.w, losses: d.l, draws: d.d, total: d.t, winRate: winRate(d.w, d.l),
    firstWins: d.fw, firstLosses: d.fl, firstDraws: d.fd, firstTotal: d.ft, firstWinRate: winRate(d.fw, d.fl),
    secondWins: d.sw, secondLosses: d.sl, secondDraws: d.sd, secondTotal: d.st, secondWinRate: winRate(d.sw, d.sl),
    unknownWins: d.uw, unknownLosses: d.ul, unknownDraws: d.ud, unknownTotal: d.ut, unknownWinRate: winRate(d.uw, d.ul),
  });

  const overall = Array.from(overallMap.entries())
    .map(([opponentName, d]) => ({ opponentName, ...mapToDetail(d) }))
    .sort((a, b) => b.total - a.total);

  const totalWins = overall.reduce((s, o) => s + o.wins, 0);
  const totalLosses = overall.reduce((s, o) => s + o.losses, 0);
  const totalDraws = overall.reduce((s, o) => s + o.draws, 0);
  const overallTotal = totalWins + totalLosses + totalDraws;

  const tuningStats: TuningStats[] = Array.from(tuningMap.entries())
    .map(([tuningName, te]) => ({
      tuningName,
      wins: te.totalW,
      losses: te.totalL,
      draws: te.totalD,
      total: te.totalT,
      winRate: winRate(te.totalW, te.totalL),
      opponents: Array.from(te.opponents.entries())
        .map(([opponentName, d]) => ({ opponentName, ...mapToDetail(d) }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallDraws: totalDraws, overallTotal, overallWinRate: winRate(totalWins, totalLosses), tuningStats };
}

export async function getTeamOpponentDeckDetailStats(
  teamId: string,
  memberId: string | null,
  opponentDeckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<OpponentDeckDetailStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_team_opponent_deck_detail_stats", {
    p_team_id: teamId,
    p_opponent_deck_name: opponentDeckName,
    p_format: format,
    p_user_id: memberId ?? undefined,
    p_start_date: startDate ?? undefined,
    p_end_date: endDate ?? undefined,
  });

  const empty: OpponentDeckDetailStats = { overall: [], overallWins: 0, overallLosses: 0, overallDraws: 0, overallTotal: 0, overallWinRate: null };

  if (error || !data || data.length === 0) return empty;

  let totalWins = 0;
  let totalLosses = 0;
  let totalDraws = 0;

  const overall = (data as DetailRpcRow[]).map((r) => {
    const detail = rowToDetail(r);
    totalWins += detail.wins;
    totalLosses += detail.losses;
    totalDraws += detail.draws;
    return { myDeckName: r.my_deck_name ?? "", ...detail };
  });

  const overallTotal = totalWins + totalLosses + totalDraws;
  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallDraws: totalDraws, overallTotal, overallWinRate: winRate(totalWins, totalLosses) };
}
