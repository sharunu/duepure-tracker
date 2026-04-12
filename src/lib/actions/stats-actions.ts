import { createClient } from "@/lib/supabase/client";

export async function getPersonalStats(format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: battles } = await supabase
    .from("battles")
    .select("opponent_deck_name, result")
    .eq("user_id", user.id)
    .eq("format", format);

  if (!battles || battles.length === 0) return [];

  // Aggregate by opponent deck
  const deckMap = new Map<
    string,
    { wins: number; losses: number; total: number }
  >();

  for (const b of battles) {
    const deckName = b.opponent_deck_name;
    const entry = deckMap.get(deckName) ?? { wins: 0, losses: 0, total: 0 };
    entry.total++;
    if (b.result === "win") entry.wins++;
    else entry.losses++;
    deckMap.set(deckName, entry);
  }

  return Array.from(deckMap.entries())
    .map(([name, stats]) => ({
      deckName: name,
      ...stats,
      winRate: Math.round((stats.wins / stats.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
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
  total: number;
  winRate: number;
  firstWins: number;
  firstLosses: number;
  firstTotal: number;
  firstWinRate: number;
  secondWins: number;
  secondLosses: number;
  secondTotal: number;
  secondWinRate: number;
  unknownWins: number;
  unknownLosses: number;
  unknownTotal: number;
  unknownWinRate: number;
};

export type MyDeckStats = {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  opponents: Map<string, OpponentDetail>;
};

export type OpponentDeckStats = {
  wins: number;
  losses: number;
  total: number;
  winRate: number;
};

export type TurnOrderSummary = {
  firstWins: number; firstLosses: number;
  secondWins: number; secondLosses: number;
  unknownWins: number; unknownLosses: number;
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
  if (!user) return { myDeckStats: [], opponentDeckStats: [], turnOrder: { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 } };

  let query = supabase
    .from("battles")
    .select("my_deck_id, opponent_deck_name, result, turn_order, fought_at, decks(name)")
    .eq("user_id", user.id)
    .eq("format", format);

  if (startDate) {
    query = query.gte("fought_at", startDate);
  }
  if (endDate) {
    const endPlusOne = new Date(endDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    query = query.lt("fought_at", endPlusOne.toISOString().split("T")[0]);
  }

  const { data: battles } = await query;
  if (!battles || battles.length === 0) return { myDeckStats: [], opponentDeckStats: [], turnOrder: { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 } };

  // Aggregate my deck stats
  const myDeckMap = new Map<string, { wins: number; losses: number; total: number; opponents: Map<string, OpponentDetail> }>();
  const oppDeckMap = new Map<string, { wins: number; losses: number; total: number }>();
  const turnOrder: TurnOrderSummary = { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 };

  for (const b of battles) {
    const myDeckName = b.decks?.name ?? "不明";
    const oppName = b.opponent_deck_name;
    const isWin = b.result === "win";

    // My deck stats
    if (!myDeckMap.has(myDeckName)) {
      myDeckMap.set(myDeckName, { wins: 0, losses: 0, total: 0, opponents: new Map() });
    }
    const myEntry = myDeckMap.get(myDeckName)!;
    myEntry.total++;
    if (isWin) myEntry.wins++; else myEntry.losses++;

    // Opponent detail within my deck
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

    // Opponent deck global stats
    if (!oppDeckMap.has(oppName)) {
      oppDeckMap.set(oppName, { wins: 0, losses: 0, total: 0 });
    }
    const oppGlobal = oppDeckMap.get(oppName)!;
    oppGlobal.total++;
    if (isWin) oppGlobal.wins++; else oppGlobal.losses++;
  }

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  const myDeckStats = Array.from(myDeckMap.entries())
    .map(([deckName, s]) => ({
      deckName,
      wins: s.wins,
      losses: s.losses,
      total: s.total,
      winRate: safeRate(s.wins, s.total),
      opponents: Array.from(s.opponents.entries())
        .map(([opponentName, o]) => ({
          opponentName,
          ...o,
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
      deckName,
      ...s,
      winRate: safeRate(s.wins, s.total),
    }))
    .sort((a, b) => b.total - a.total);

  return { myDeckStats, opponentDeckStats, turnOrder };
}

export type TuningOpponentDetail = OpponentDetail;

export type TuningStats = {
  tuningName: string;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
  opponents: Array<{ opponentName: string } & OpponentDetail>;
};

export type DeckDetailStats = {
  overall: Array<{ opponentName: string } & OpponentDetail>;
  overallWins: number;
  overallLosses: number;
  overallTotal: number;
  overallWinRate: number;
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
  if (!user) return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0, tuningStats: [] };

  let query = supabase
    .from("battles")
    .select("opponent_deck_name, result, turn_order, tuning_id, decks(name), deck_tunings(id, name)")
    .eq("user_id", user.id)
    .eq("format", format);

  if (startDate) {
    query = query.gte("fought_at", startDate);
  }
  if (endDate) {
    const endPlusOne = new Date(endDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    query = query.lt("fought_at", endPlusOne.toISOString().split("T")[0]);
  }

  const { data: battles } = await query;
  if (!battles || battles.length === 0) return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0, tuningStats: [] };

  // Filter to only battles with this deck name
  const filtered = battles.filter(b => b.decks?.name === deckName);
  if (filtered.length === 0) return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0, tuningStats: [] };

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  const newOppDetail = (): OpponentDetail => ({
    wins: 0, losses: 0, total: 0, winRate: 0,
    firstWins: 0, firstLosses: 0, firstTotal: 0, firstWinRate: 0,
    secondWins: 0, secondLosses: 0, secondTotal: 0, secondWinRate: 0,
    unknownWins: 0, unknownLosses: 0, unknownTotal: 0, unknownWinRate: 0,
  });

  function addToDetail(detail: OpponentDetail, isWin: boolean, turnOrder: string | null) {
    detail.total++;
    if (isWin) detail.wins++; else detail.losses++;
    if (turnOrder === "first") {
      detail.firstTotal++;
      if (isWin) detail.firstWins++; else detail.firstLosses++;
    } else if (turnOrder === "second") {
      detail.secondTotal++;
      if (isWin) detail.secondWins++; else detail.secondLosses++;
    } else {
      detail.unknownTotal++;
      if (isWin) detail.unknownWins++; else detail.unknownLosses++;
    }
  }

  // Overall opponent map
  const overallMap = new Map<string, OpponentDetail>();
  // Tuning map: tuningKey -> { tuningName, opponents }
  const tuningMap = new Map<string, { tuningName: string; opponents: Map<string, OpponentDetail>; wins: number; losses: number; total: number }>();

  let overallWins = 0;
  let overallLosses = 0;

  for (const b of filtered) {
    const oppName = b.opponent_deck_name;
    const isWin = b.result === "win";

    // Overall
    if (!overallMap.has(oppName)) overallMap.set(oppName, newOppDetail());
    addToDetail(overallMap.get(oppName)!, isWin, b.turn_order);
    if (isWin) overallWins++; else overallLosses++;

    // Tuning
    const tuningName = b.deck_tunings?.name ?? "指定なし";
    const tuningKey = tuningName;
    if (!tuningMap.has(tuningKey)) {
      tuningMap.set(tuningKey, { tuningName, opponents: new Map(), wins: 0, losses: 0, total: 0 });
    }
    const tEntry = tuningMap.get(tuningKey)!;
    tEntry.total++;
    if (isWin) tEntry.wins++; else tEntry.losses++;
    if (!tEntry.opponents.has(oppName)) tEntry.opponents.set(oppName, newOppDetail());
    addToDetail(tEntry.opponents.get(oppName)!, isWin, b.turn_order);
  }

  const finalizeDetail = (d: OpponentDetail): OpponentDetail => ({
    ...d,
    winRate: safeRate(d.wins, d.total),
    firstWinRate: safeRate(d.firstWins, d.firstTotal),
    secondWinRate: safeRate(d.secondWins, d.secondTotal),
    unknownWinRate: safeRate(d.unknownWins, d.unknownTotal),
  });

  const overall = Array.from(overallMap.entries())
    .map(([opponentName, d]) => ({ opponentName, ...finalizeDetail(d) }))
    .sort((a, b) => b.total - a.total);

  const overallTotal = overallWins + overallLosses;

  const tuningStats: TuningStats[] = Array.from(tuningMap.entries())
    .map(([, t]) => ({
      tuningName: t.tuningName,
      wins: t.wins,
      losses: t.losses,
      total: t.total,
      winRate: safeRate(t.wins, t.total),
      opponents: Array.from(t.opponents.entries())
        .map(([opponentName, d]) => ({ opponentName, ...finalizeDetail(d) }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

  return { overall, overallWins, overallLosses, overallTotal, overallWinRate: safeRate(overallWins, overallTotal), tuningStats };
}

export type OpponentDeckDetailStats = {
  overall: Array<{ myDeckName: string } & OpponentDetail>;
  overallWins: number;
  overallLosses: number;
  overallTotal: number;
  overallWinRate: number;
};

export async function getOpponentDeckDetailStats(
  opponentDeckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<OpponentDeckDetailStats> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0 };

  let query = supabase
    .from("battles")
    .select("opponent_deck_name, result, turn_order, decks(name)")
    .eq("user_id", user.id)
    .eq("format", format);

  if (startDate) {
    query = query.gte("fought_at", startDate);
  }
  if (endDate) {
    const endPlusOne = new Date(endDate);
    endPlusOne.setDate(endPlusOne.getDate() + 1);
    query = query.lt("fought_at", endPlusOne.toISOString().split("T")[0]);
  }

  const { data: battles } = await query;
  if (!battles || battles.length === 0) return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0 };

  // Filter to only battles against this opponent deck
  const filtered = battles.filter(b => (b.opponent_deck_name) === opponentDeckName);
  if (filtered.length === 0) return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0 };

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  const newOppDetail = (): OpponentDetail => ({
    wins: 0, losses: 0, total: 0, winRate: 0,
    firstWins: 0, firstLosses: 0, firstTotal: 0, firstWinRate: 0,
    secondWins: 0, secondLosses: 0, secondTotal: 0, secondWinRate: 0,
    unknownWins: 0, unknownLosses: 0, unknownTotal: 0, unknownWinRate: 0,
  });

  function addToDetail(detail: OpponentDetail, isWin: boolean, turnOrder: string | null) {
    detail.total++;
    if (isWin) detail.wins++; else detail.losses++;
    if (turnOrder === "first") {
      detail.firstTotal++;
      if (isWin) detail.firstWins++; else detail.firstLosses++;
    } else if (turnOrder === "second") {
      detail.secondTotal++;
      if (isWin) detail.secondWins++; else detail.secondLosses++;
    } else {
      detail.unknownTotal++;
      if (isWin) detail.unknownWins++; else detail.unknownLosses++;
    }
  }

  // Group by my deck name
  const myDeckMap = new Map<string, OpponentDetail>();
  let overallWins = 0;
  let overallLosses = 0;

  for (const b of filtered) {
    const myDeckName = b.decks?.name ?? "不明";
    const isWin = b.result === "win";

    if (!myDeckMap.has(myDeckName)) myDeckMap.set(myDeckName, newOppDetail());
    addToDetail(myDeckMap.get(myDeckName)!, isWin, b.turn_order);
    if (isWin) overallWins++; else overallLosses++;
  }

  const finalizeDetail = (d: OpponentDetail): OpponentDetail => ({
    ...d,
    winRate: safeRate(d.wins, d.total),
    firstWinRate: safeRate(d.firstWins, d.firstTotal),
    secondWinRate: safeRate(d.secondWins, d.secondTotal),
    unknownWinRate: safeRate(d.unknownWins, d.unknownTotal),
  });

  const overall = Array.from(myDeckMap.entries())
    .map(([myDeckName, d]) => ({ myDeckName, ...finalizeDetail(d) }))
    .sort((a, b) => b.total - a.total);

  const overallTotal = overallWins + overallLosses;

  return { overall, overallWins, overallLosses, overallTotal, overallWinRate: safeRate(overallWins, overallTotal) };
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
  format: string = "ND"
): Promise<DetailedPersonalStats> {
  const supabase = createClient();

  const [{ data: myDeckData }, { data: oppDeckData }] = await Promise.all([
    supabase.rpc("get_global_my_deck_stats_range", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_format: format,
    }),
    supabase.rpc("get_global_opponent_deck_stats_range", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_format: format,
    }),
  ]);

  type RpcRow = { deck_name: string; wins: number; losses: number; total: number; win_rate: number };

  const myDeckStats = ((myDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    total: Number(r.total),
    winRate: Number(r.win_rate),
    opponents: [],
  }));

  const opponentDeckStats = ((oppDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    total: Number(r.total),
    winRate: Number(r.win_rate),
  }));

  // Turn order aggregation
  const endPlusOne = new Date(endDate);
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const { data: turnBattles } = await supabase
    .from("battles")
    .select("turn_order, result")
    .gte("fought_at", startDate)
    .lt("fought_at", endPlusOne.toISOString().split("T")[0])
    .eq("format", format);

  const turnOrder: TurnOrderSummary = { firstWins: 0, firstLosses: 0, secondWins: 0, secondLosses: 0, unknownWins: 0, unknownLosses: 0 };
  for (const b of turnBattles ?? []) {
    const isWin = b.result === "win";
    if (b.turn_order === "first") { if (isWin) turnOrder.firstWins++; else turnOrder.firstLosses++; }
    else if (b.turn_order === "second") { if (isWin) turnOrder.secondWins++; else turnOrder.secondLosses++; }
    else { if (isWin) turnOrder.unknownWins++; else turnOrder.unknownLosses++; }
  }

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
  isPersonal: boolean = false
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
  });

  if (error) return [];
  return ((data as { period_start: string; deck_name: string; battle_count: number; share_pct: number }[]) ?? []).map((r) => ({
    periodStart: r.period_start,
    deckName: r.deck_name,
    battleCount: Number(r.battle_count),
    sharePct: Number(r.share_pct),
  }));
}

export async function getGlobalDeckDetailStats(
  deckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<DeckDetailStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_global_deck_detail_stats", {
    p_deck_name: deckName,
    p_format: format,
    p_start_date: startDate ?? undefined,
    p_end_date: endDate ?? undefined,
  });

  if (error || !data || data.length === 0) {
    return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0, tuningStats: [] };
  }

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  let totalWins = 0;
  let totalLosses = 0;

  const overall = (data as { opponent_name: string; wins: number; losses: number; total: number; first_wins: number; first_losses: number; first_total: number; second_wins: number; second_losses: number; second_total: number; unknown_wins: number; unknown_losses: number; unknown_total: number }[]).map((r) => {
    const w = Number(r.wins);
    const l = Number(r.losses);
    const t = Number(r.total);
    const fw = Number(r.first_wins); const fl = Number(r.first_losses); const ft = Number(r.first_total);
    const sw = Number(r.second_wins); const sl = Number(r.second_losses); const st = Number(r.second_total);
    const uw = Number(r.unknown_wins); const ul = Number(r.unknown_losses); const ut = Number(r.unknown_total);
    totalWins += w;
    totalLosses += l;
    return {
      opponentName: r.opponent_name,
      wins: w, losses: l, total: t, winRate: safeRate(w, t),
      firstWins: fw, firstLosses: fl, firstTotal: ft, firstWinRate: safeRate(fw, ft),
      secondWins: sw, secondLosses: sl, secondTotal: st, secondWinRate: safeRate(sw, st),
      unknownWins: uw, unknownLosses: ul, unknownTotal: ut, unknownWinRate: safeRate(uw, ut),
    };
  });

  const overallTotal = totalWins + totalLosses;
  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallTotal, overallWinRate: safeRate(totalWins, overallTotal), tuningStats: [] };
}

export async function getGlobalOpponentDeckDetailStats(
  opponentDeckName: string,
  format: string,
  startDate?: string,
  endDate?: string
): Promise<OpponentDeckDetailStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_global_opponent_deck_detail_stats", {
    p_opponent_deck_name: opponentDeckName,
    p_format: format,
    p_start_date: startDate ?? undefined,
    p_end_date: endDate ?? undefined,
  });

  if (error || !data || data.length === 0) {
    return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0 };
  }

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  let totalWins = 0;
  let totalLosses = 0;

  const overall = (data as { my_deck_name: string; wins: number; losses: number; total: number; first_wins: number; first_losses: number; first_total: number; second_wins: number; second_losses: number; second_total: number; unknown_wins: number; unknown_losses: number; unknown_total: number }[]).map((r) => {
    const w = Number(r.wins);
    const l = Number(r.losses);
    const t = Number(r.total);
    const fw = Number(r.first_wins); const fl = Number(r.first_losses); const ft = Number(r.first_total);
    const sw = Number(r.second_wins); const sl = Number(r.second_losses); const st = Number(r.second_total);
    const uw = Number(r.unknown_wins); const ul = Number(r.unknown_losses); const ut = Number(r.unknown_total);
    totalWins += w;
    totalLosses += l;
    return {
      myDeckName: r.my_deck_name,
      wins: w, losses: l, total: t, winRate: safeRate(w, t),
      firstWins: fw, firstLosses: fl, firstTotal: ft, firstWinRate: safeRate(fw, ft),
      secondWins: sw, secondLosses: sl, secondTotal: st, secondWinRate: safeRate(sw, st),
      unknownWins: uw, unknownLosses: ul, unknownTotal: ut, unknownWinRate: safeRate(uw, ut),
    };
  });

  const overallTotal = totalWins + totalLosses;
  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallTotal, overallWinRate: safeRate(totalWins, overallTotal) };
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

  type RpcRow = { deck_name: string; wins: number; losses: number; total: number; win_rate: number };

  const myDeckStats = ((myDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    total: Number(r.total),
    winRate: Number(r.win_rate),
    opponents: [],
  }));

  const opponentDeckStats = ((oppDeckData as RpcRow[]) ?? []).map((r) => ({
    deckName: r.deck_name,
    wins: Number(r.wins),
    losses: Number(r.losses),
    total: Number(r.total),
    winRate: Number(r.win_rate),
  }));

  // Turn order aggregation via RPC (bypasses RLS)
  const { data: turnData } = await supabase.rpc("get_team_turn_order_stats_range", {
    p_team_id: teamId,
    p_user_id: memberId ?? undefined,
    p_start_date: startDate,
    p_end_date: endDate,
    p_format: format,
  });

  const tr = (turnData as { first_wins: number; first_losses: number; second_wins: number; second_losses: number; unknown_wins: number; unknown_losses: number }[] | null)?.[0];
  const turnOrder: TurnOrderSummary = {
    firstWins: Number(tr?.first_wins ?? 0),
    firstLosses: Number(tr?.first_losses ?? 0),
    secondWins: Number(tr?.second_wins ?? 0),
    secondLosses: Number(tr?.second_losses ?? 0),
    unknownWins: Number(tr?.unknown_wins ?? 0),
    unknownLosses: Number(tr?.unknown_losses ?? 0),
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

  if (error || !data || data.length === 0) {
    return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0, tuningStats: [] };
  }

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  type Row = {
    opponent_name: string; wins: number; losses: number; total: number;
    first_wins: number; first_losses: number; first_total: number;
    second_wins: number; second_losses: number; second_total: number;
    unknown_wins: number; unknown_losses: number; unknown_total: number;
    tuning_name: string;
  };

  const rows = data as Row[];

  // Overall: aggregate across tunings
  const overallMap = new Map<string, { w: number; l: number; t: number; fw: number; fl: number; ft: number; sw: number; sl: number; st: number; uw: number; ul: number; ut: number }>();
  // Tuning: group by tuning_name -> opponent
  const tuningMap = new Map<string, { opponents: Map<string, { w: number; l: number; t: number; fw: number; fl: number; ft: number; sw: number; sl: number; st: number; uw: number; ul: number; ut: number }>; totalW: number; totalL: number; totalT: number }>();

  for (const r of rows) {
    const opp = r.opponent_name;
    const w = Number(r.wins); const l = Number(r.losses); const t = Number(r.total);
    const fw = Number(r.first_wins); const fl = Number(r.first_losses); const ft = Number(r.first_total);
    const sw = Number(r.second_wins); const sl = Number(r.second_losses); const st = Number(r.second_total);
    const uw = Number(r.unknown_wins); const ul = Number(r.unknown_losses); const ut = Number(r.unknown_total);

    // Overall
    const existing = overallMap.get(opp) ?? { w: 0, l: 0, t: 0, fw: 0, fl: 0, ft: 0, sw: 0, sl: 0, st: 0, uw: 0, ul: 0, ut: 0 };
    existing.w += w; existing.l += l; existing.t += t;
    existing.fw += fw; existing.fl += fl; existing.ft += ft;
    existing.sw += sw; existing.sl += sl; existing.st += st;
    existing.uw += uw; existing.ul += ul; existing.ut += ut;
    overallMap.set(opp, existing);

    // Tuning
    const tn = r.tuning_name;
    if (!tuningMap.has(tn)) {
      tuningMap.set(tn, { opponents: new Map(), totalW: 0, totalL: 0, totalT: 0 });
    }
    const te = tuningMap.get(tn)!;
    te.totalW += w; te.totalL += l; te.totalT += t;
    const to2 = te.opponents.get(opp) ?? { w: 0, l: 0, t: 0, fw: 0, fl: 0, ft: 0, sw: 0, sl: 0, st: 0, uw: 0, ul: 0, ut: 0 };
    to2.w += w; to2.l += l; to2.t += t;
    to2.fw += fw; to2.fl += fl; to2.ft += ft;
    to2.sw += sw; to2.sl += sl; to2.st += st;
    to2.uw += uw; to2.ul += ul; to2.ut += ut;
    te.opponents.set(opp, to2);
  }

  const mapToDetail = (d: { w: number; l: number; t: number; fw: number; fl: number; ft: number; sw: number; sl: number; st: number; uw: number; ul: number; ut: number }) => ({
    wins: d.w, losses: d.l, total: d.t, winRate: safeRate(d.w, d.t),
    firstWins: d.fw, firstLosses: d.fl, firstTotal: d.ft, firstWinRate: safeRate(d.fw, d.ft),
    secondWins: d.sw, secondLosses: d.sl, secondTotal: d.st, secondWinRate: safeRate(d.sw, d.st),
    unknownWins: d.uw, unknownLosses: d.ul, unknownTotal: d.ut, unknownWinRate: safeRate(d.uw, d.ut),
  });

  const overall = Array.from(overallMap.entries())
    .map(([opponentName, d]) => ({ opponentName, ...mapToDetail(d) }))
    .sort((a, b) => b.total - a.total);

  const totalWins = overall.reduce((s, o) => s + o.wins, 0);
  const totalLosses = overall.reduce((s, o) => s + o.losses, 0);
  const overallTotal = totalWins + totalLosses;

  const tuningStats: TuningStats[] = Array.from(tuningMap.entries())
    .map(([tuningName, te]) => ({
      tuningName,
      wins: te.totalW,
      losses: te.totalL,
      total: te.totalT,
      winRate: safeRate(te.totalW, te.totalT),
      opponents: Array.from(te.opponents.entries())
        .map(([opponentName, d]) => ({ opponentName, ...mapToDetail(d) }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);

  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallTotal, overallWinRate: safeRate(totalWins, overallTotal), tuningStats };
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

  if (error || !data || data.length === 0) {
    return { overall: [], overallWins: 0, overallLosses: 0, overallTotal: 0, overallWinRate: 0 };
  }

  const safeRate = (w: number, t: number) => t === 0 ? 0 : Math.round((w / t) * 100);

  let totalWins = 0;
  let totalLosses = 0;

  const overall = (data as { my_deck_name: string; wins: number; losses: number; total: number; first_wins: number; first_losses: number; first_total: number; second_wins: number; second_losses: number; second_total: number; unknown_wins: number; unknown_losses: number; unknown_total: number }[]).map((r) => {
    const w = Number(r.wins); const l = Number(r.losses); const t = Number(r.total);
    const fw = Number(r.first_wins); const fl = Number(r.first_losses); const ft = Number(r.first_total);
    const sw = Number(r.second_wins); const sl = Number(r.second_losses); const st = Number(r.second_total);
    const uw = Number(r.unknown_wins); const ul = Number(r.unknown_losses); const ut = Number(r.unknown_total);
    totalWins += w;
    totalLosses += l;
    return {
      myDeckName: r.my_deck_name,
      wins: w, losses: l, total: t, winRate: safeRate(w, t),
      firstWins: fw, firstLosses: fl, firstTotal: ft, firstWinRate: safeRate(fw, ft),
      secondWins: sw, secondLosses: sl, secondTotal: st, secondWinRate: safeRate(sw, st),
      unknownWins: uw, unknownLosses: ul, unknownTotal: ut, unknownWinRate: safeRate(uw, ut),
    };
  });

  const overallTotal = totalWins + totalLosses;
  return { overall, overallWins: totalWins, overallLosses: totalLosses, overallTotal, overallWinRate: safeRate(totalWins, overallTotal) };
}
