/**
 * LimitlessTCG の /decks ページの HTML を正規表現で解析して行配列に変換する。
 *
 * HTML 構造（2026-04 時点）:
 *   <tr data-share="..." data-winrate="...">
 *     <td>N</td>                                          ← rank
 *     <td><img class="pokemon" src="...gen9/xxx.png"/>...</td>  ← アイコン
 *     <td><a href="/decks/SLUG?...">NAME</a></td>        ← デッキ名 + slug
 *     <td class="landscape-only">1514</td>                ← count
 *     <td>10.91%</td>                                     ← share
 *     <td class="landscape-only"><a>W - L - T</a></td>    ← score
 *     <td><a>51.82%</a></td>                              ← win%
 *   </tr>
 *
 * Cloudflare Workers / Node.js どちらでも動くように、外部依存なし。
 * 壊れた場合は __fixtures__/limitless-decks.html を再取得して差分デバッグする。
 */

export type LimitlessRow = {
  rank: number;
  name_en: string;
  slug: string | null;
  icon_urls: string[];
  count: number | null;
  share: number | null; // %
  wins: number | null;
  losses: number | null;
  ties: number | null;
  win_pct: number | null; // %
};

const ROW_RE =
  /<tr\s+data-share="([^"]*)"\s+data-winrate="([^"]*)"[^>]*>([\s\S]*?)<\/tr>/g;

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

const stripTags = (s: string) =>
  decodeEntities(s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

const toFloat = (s: string | null | undefined) => {
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

const toInt = (s: string | null | undefined) => {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

export function parseDeckTable(html: string): LimitlessRow[] {
  const rows: LimitlessRow[] = [];
  let m: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;

  while ((m = ROW_RE.exec(html)) !== null) {
    const dataShare = m[1];
    const dataWinrate = m[2];
    const inner = m[3];

    const tds = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (mm) => mm[1],
    );
    if (tds.length < 7) continue;

    const rank = toInt(stripTags(tds[0]));
    if (rank == null) continue;

    const iconHtml = tds[1];
    const icon_urls = [...iconHtml.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)].map(
      (mm) => decodeEntities(mm[1]),
    );

    const nameCell = tds[2];
    const name_en = stripTags(nameCell);
    const slugMatch = nameCell.match(/href="\/decks\/([^"?#]+)/);
    const slug = slugMatch ? decodeEntities(slugMatch[1]) : null;

    const count = toInt(stripTags(tds[3]));

    const shareText = stripTags(tds[4]).replace("%", "");
    const shareFromText = toFloat(shareText);
    const shareFromAttr = toFloat(dataShare);
    const share =
      shareFromText ??
      (shareFromAttr !== null ? shareFromAttr * 100 : null);

    const scoreText = stripTags(tds[5]);
    const scoreMatch = scoreText.match(/(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/);
    const wins = scoreMatch ? toInt(scoreMatch[1]) : null;
    const losses = scoreMatch ? toInt(scoreMatch[2]) : null;
    const ties = scoreMatch ? toInt(scoreMatch[3]) : null;

    const winPctText = stripTags(tds[6]).replace("%", "");
    const winPctFromText = toFloat(winPctText);
    const winRateFromAttr = toFloat(dataWinrate);
    const win_pct =
      winPctFromText ??
      (winRateFromAttr !== null ? winRateFromAttr * 100 : null);

    rows.push({
      rank,
      name_en,
      slug,
      icon_urls,
      count,
      share,
      wins,
      losses,
      ties,
      win_pct,
    });
  }

  return rows;
}
