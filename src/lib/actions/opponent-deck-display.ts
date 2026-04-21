/**
 * 対面デッキ名の表示用ユーティリティ。
 *
 * opponent_deck_master.name は英語/日本語いずれも格納され得るが、
 * LimitlessTCG 由来行は name が英語 (name_en と同値)、name_ja に日本語訳が入る。
 * ユーザー側 UI では name_ja があれば優先表示し、なければ name にフォールバックする。
 *
 * name は battles.opponent_deck_name と突き合わせるキーとして使われるため、
 * 表示用とキー用を分離する必要がある。この utility はその変換マップを提供する。
 */

import { createClient } from "@/lib/supabase/client";
import { DEFAULT_GAME, type GameSlug } from "@/lib/games";

export type OpponentDeckNameMap = Record<string, string>;

/**
 * 指定 (format, game) の opponent_deck_master を読み、
 * { name: name_ja } のマップを返す (name_ja が null の行はマップに含めない)。
 */
export async function getOpponentDeckNameMap(
  format: string,
  game: GameSlug = DEFAULT_GAME,
): Promise<OpponentDeckNameMap> {
  const supabase = createClient();
  const { data } = await supabase
    .from("opponent_deck_master")
    .select("name, name_ja" as unknown as "name")
    .eq("format", format)
    .eq("game_title", game);

  const map: OpponentDeckNameMap = {};
  for (const row of (data as unknown as Array<{ name: string; name_ja: string | null }>) ?? []) {
    if (row.name_ja) map[row.name] = row.name_ja;
  }
  return map;
}

/**
 * name を表示名に変換する。nameMap に登録されていれば name_ja、無ければ name。
 */
export function displayDeckName(
  name: string,
  nameMap?: OpponentDeckNameMap,
): string {
  return nameMap?.[name] ?? name;
}
