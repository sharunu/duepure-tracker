/**
 * LimitlessTCG の英語デッキ名を日本語に翻訳する。
 *
 * 例:
 *   "Suicune ex Baxcalibur"                        → "スイクンex セグレイブ"
 *   "Mega Charizard X ex Mega Charizard Y ex"      → "メガリザードンX ex メガリザードンY ex"
 *   "Alolan Ninetales ex Baxcalibur"               → "アローラキュウコンex セグレイブ"
 *   "Teal Mask Ogerpon ex"                         → "みどりのめんオーガポンex"
 *
 * 方針:
 *   - 修飾語 (Mega / Alolan / Galarian / Hisuian / Paldean / Teal Mask 等) を先に翻訳
 *   - 辞書 (pokemon-names.json) の英語名を長い順でサブストリング置換
 *   - 日本語文字直後のスペースは詰める（英→日の結合時に不自然な空白が残らないように）
 *   - ex / GX / V / VMAX / X / Y は原語のまま
 *   - 辞書に1件もポケモン名 hit しない場合は null を返し、UI 側で name_en にフォールバック
 */

import namesData from "./pokemon-names.json";

type NamesFile = {
  version: string;
  generatedAt: string;
  source?: string;
  entries: Record<string, { en: string; ja: string }>;
};

const data = namesData as NamesFile;

const EN_TO_JA: Array<[string, string]> = Object.values(data.entries)
  .map((v): [string, string] => [v.en, v.ja])
  .sort((a, b) => b[0].length - a[0].length);

// 修飾語は長い順に並べて先勝ちで置換（"Teal Mask" を "Teal" と "Mask" に分割しないため）
const MODIFIER_MAP: Array<[string, string]> = (
  [
    ["Teal Mask", "みどりのめん"],
    ["Wellspring Mask", "いどのめん"],
    ["Hearthflame Mask", "かまどのめん"],
    ["Cornerstone Mask", "いしずえのめん"],
    ["Mega", "メガ"],
    ["Alolan", "アローラ"],
    ["Galarian", "ガラル"],
    ["Hisuian", "ヒスイ"],
    ["Paldean", "パルデア"],
  ] as Array<[string, string]>
).sort((a, b) => b[0].length - a[0].length);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const JAPANESE_CHAR = "\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF";

export function translateDeckName(nameEn: string): string | null {
  let result = nameEn;

  for (const [en, ja] of MODIFIER_MAP) {
    const re = new RegExp(
      `(?<![A-Za-z])${escapeRegex(en)}(?![A-Za-z])`,
      "g",
    );
    result = result.replace(re, ja);
  }

  let pokemonHit = false;
  for (const [en, ja] of EN_TO_JA) {
    const re = new RegExp(
      `(?<![A-Za-z])${escapeRegex(en)}(?![A-Za-z])`,
      "g",
    );
    if (re.test(result)) {
      result = result.replace(re, ja);
      pokemonHit = true;
    }
  }

  if (!pokemonHit) return null;

  // 日本語文字直後のスペースを詰める ("メガ リザードン" → "メガリザードン")
  result = result.replace(
    new RegExp(`([${JAPANESE_CHAR}])\\s+`, "g"),
    "$1",
  );

  return result.replace(/\s+/g, " ").trim();
}
