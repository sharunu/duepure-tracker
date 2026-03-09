// @ts-nocheck
import { createClient } from "@/lib/supabase/client";

export async function getPersonalStats(format: string = "ND") {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: battles } = await supabase
    .from("battles")
    .select("opponent_deck_name, opponent_deck_normalized, result")
    .eq("user_id", user.id)
    .eq("format", format);

  if (!battles || battles.length === 0) return [];

  // Aggregate by opponent deck
  const deckMap = new Map<
    string,
    { wins: number; losses: number; total: number }
  >();

  for (const b of battles) {
    const deckName = b.opponent_deck_normalized ?? b.opponent_deck_name;
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

export type DetailedPersonalStats = {
  myDeckStats: Array<{ deckName: string } & Omit<MyDeckStats, "opponents"> & { opponents: Array<{ opponentName: string } & OpponentDetail> }>;
  opponentDeckStats: Array<{ deckName: string } & OpponentDeckStats>;
};

export async function getDetailedPersonalStats(
  format: string = "ND",
  startDate?: string,
  endDate?: string
): Promise<DetailedPersonalStats> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { myDeckStats: [], opponentDeckStats: [] };

  let query = supabase
    .from("battles")
    .select("my_deck_id, opponent_deck_name, opponent_deck_normalized, result, turn_order, fought_at, decks(name)")
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
  if (!battles || battles.length === 0) return { myDeckStats: [], opponentDeckStats: [] };

  // Aggregate my deck stats
  const myDeckMap = new Map<string, { wins: number; losses: number; total: number; opponents: Map<string, OpponentDetail> }>();
  const oppDeckMap = new Map<string, { wins: number; losses: number; total: number }>();

  for (const b of battles) {
    const myDeckName = b.decks?.name ?? "不明";
    const oppName = b.opponent_deck_normalized ?? b.opponent_deck_name;
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
    } else if (b.turn_order === "second") {
      oppDetail.secondTotal++;
      if (isWin) oppDetail.secondWins++; else oppDetail.secondLosses++;
    } else {
      oppDetail.unknownTotal++;
      if (isWin) oppDetail.unknownWins++; else oppDetail.unknownLosses++;
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

  return { myDeckStats, opponentDeckStats };
}
