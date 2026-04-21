/**
 * PokeAPI からポケモン名の英日対応辞書を生成し、
 * src/lib/pokepoke/pokemon-names.json に出力する。
 *
 * 実行: npx tsx scripts/generate-pokemon-names.ts
 * 依存: なし（Node 18+ の fetch を利用）
 *
 * 注意: 1回のフル実行で 1000+ リクエストを PokeAPI に送る。
 *       辞書更新は新ポケモン追加時など稀。普段は生成済み JSON を同梱して利用する。
 */

import fs from "node:fs/promises";
import path from "node:path";

type PokeApiListItem = { name: string; url: string };
type PokeApiListResponse = { count: number; results: PokeApiListItem[] };
type PokeApiName = { name: string; language: { name: string; url: string } };
type PokeApiSpecies = { id: number; name: string; names: PokeApiName[] };

const LIMIT = 2000;
const CONCURRENCY = 20;
const THROTTLE_MS = 50;
const SPECIES_LIST_URL = `https://pokeapi.co/api/v2/pokemon-species?limit=${LIMIT}`;
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "src/lib/pokepoke/pokemon-names.json",
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  console.log(`→ ポケモン species 一覧取得: ${SPECIES_LIST_URL}`);
  const list = await fetchJson<PokeApiListResponse>(SPECIES_LIST_URL);
  console.log(`  合計 ${list.count} 件`);

  const entries: Record<string, { en: string; ja: string }> = {};
  let done = 0;

  for (let i = 0; i < list.results.length; i += CONCURRENCY) {
    const batch = list.results.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        const species = await fetchJson<PokeApiSpecies>(item.url);
        const en = species.names.find((n) => n.language.name === "en")?.name;
        const ja =
          species.names.find((n) => n.language.name === "ja-Hrkt")?.name ??
          species.names.find((n) => n.language.name === "ja")?.name;
        if (en && ja) {
          entries[species.name] = { en, ja };
        }
      }),
    );
    done += batch.length;
    if (done % 100 === 0 || done === list.results.length) {
      console.log(`  進捗: ${done}/${list.results.length}`);
    }
    await sleep(THROTTLE_MS);
  }

  const output = {
    version: "v1",
    generatedAt: new Date().toISOString(),
    source: "pokeapi.co pokemon-species",
    entries,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`✓ 書き込み完了: ${OUTPUT_PATH}`);
  console.log(`  エントリ数: ${Object.keys(entries).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
