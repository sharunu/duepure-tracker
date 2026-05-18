# 実装報告書: 円グラフ・推移グラフの色分けと表示改善

**日付**: 2026-05-18
**担当**: Claude Code (codex 外部レビュー併用)
**ブランチ**: `dev` → `main` (本番反映済、code-only)
**関連 plan**: `docs/plans/2026-05-18_chart_color_palette_and_trend_display.md`

---

## 概要

ポケポケ stats / dm stats 等で表示している円グラフ (`EncounterDonutChart`)・推移グラフ (`TrendChart` / `TrendHeatmap`) について、以下 3 つの課題を一括で解消した:

1. **色被り**: 旧 `colorForArchetype(deckName)` は deck 名 hash % 8 のため、画面内のデッキ数が 8 を超えれば必ず色被り。8 未満でもハッシュ衝突で被るケースあり
2. **円グラフの UI 課題**: 小スライスでラベルがはみ出る / 非選択を暗くする強調方式が全体を暗くする / PC マウスで反応しないことがある
3. **ポケポケ推移グラフ・ヒートマップで対面デッキ名が英語表示**: `TrendChart` は `opponentDeckNameMap` を受けているが、`TrendHeatmap` は受けていないため行ラベル / tooltip が `name` (英語) のまま

本作業は plan → plan-critic レビュー (2 ラウンド) → codex 外部レビュー (3 点指摘) → 実装 → ユーザー dev 確認 → codex 二次指摘 (lint error 1 件) → 修正 → 本番反映の流れで完了。memory `project_remaining_tasks_after_2026_05_09.md` の残タスクとは独立した新規 issue。

---

## レビューフロー

CLAUDE.md / memory `feedback_codex_review_flow` に従う:

1. ユーザー方針 review (色被り解消 / 円グラフ active 強調変更 / Heatmap nameMap propagation の 3 軸)
2. `AskUserQuestion` 3 点 (パレット数 / active 強調手段 / dm/admin スコープ) → 確定
   - パレット数: 12 色 + 「その他」固定グレー、12 色超過時は循環
   - active 強調: `activeShape` で扇形膨らます + 凡例強調
   - スコープ: pokepoke のみ修正 (dm/admin は無修正)
3. plan 作成 (`docs/plans/2026-05-18_chart_color_palette_and_trend_display.md`)
4. `/review-plan-loop` 実行 (2 ラウンド)
   - iteration 1: NO-GO (judgment 1: `recharts_active_index_prop_mismatch`)
     - Recharts v3 の `<Pie>` には外部 state 駆動の `activeIndex` prop が無いという設計欠陥指摘
     - ユーザー回答「shape callback + 外部 state」で plan 5 箇所修正 (設計判断 / Step 4-4 / Step 4-7 / Risk セクション / Resolved Decisions 末尾追加)
   - iteration 2: GO (Recharts v3 で `PieShape = (props, index) => ReactElement` が公式 API として有効と critic が verify)
5. codex 外部レビュー (3 点指摘)
   - **[P2]** 完了条件と「12 色循環」の矛盾 → Step 8-4 円グラフチェックリストを「件数 ≤ 12 で被りなし」「件数 ≥ 13 は循環するが隣接色/凡例/tooltip/active sector で識別」の 2 条件に分割
   - **[P3]** `activeShape` の古い表現がスコープ欄 / commit message 案 / 検証セクション要約に残存 → `shape callback` / `active sector` に置換 (API 名としての説明は残置)
   - **[P3]** light/dark の説明ラベル逆転 (`:root` が dark、`[data-theme="light"]` が light なのに plan は逆に記述) → 説明文 / hue 配置テーブル列ヘッダー / 「Tailwind 500 / 600」記載をすべて修正
6. ユーザー承認 → 実装着手
7. 実装後 codex 二次指摘 (新規 lint error 1 件)
   - `renderSectorShape (props: any)` を Recharts の `PieSectorShapeProps` で型付け
   - `PieSectorShapeProps = PieSectorDataItem & { isActive: boolean; index: number }` で必要 field 全て型付き
8. ユーザー本番反映指示 → main へ merge + push

---

## 実装した commits

| Commit | Message | 内容 |
|---|---|---|
| `bac2e99` | docs(plans): 円グラフ・推移グラフ表示改善 plan 追加 | plan 685 行 |
| `4261a5c` | feat(stats): 円グラフ・推移グラフ表示改善 (12色パレット + shape callback active sector + Heatmap nameMap) | 7 ファイル (+103/-42) |
| `6395577` | fix(stats): EncounterDonutChart の renderSectorShape を PieSectorShapeProps で型付け | 1 ファイル (+2/-2) |
| `1609792` | Merge branch 'dev' (main 反映マージコミット) | main 反映 (ort strategy) |

main 反映: 1 ラウンド (3 commits + merge commit)。DB 変更なし、code-only のため Supabase migration 適用なし。

---

## 変更ファイル

### CSS パレット拡張

- `src/app/globals.css` (+19 / -2)
  - `:root` (dark) と `[data-theme="light"]` (light) の chart palette を 8 色 → 12 色に拡張
  - `--chart-9` (Purple) / `--chart-10` (Lime) / `--chart-11` (Cyan) / `--chart-12` (Rose) を新規追加
  - 旧 `--chart-8` (Slate「その他」用) を Orange に再割り当て、Slate は `--chart-other` に独立 token 化
  - `@theme inline` ブロックに `--color-chart-9` 〜 `--color-chart-12` + `--color-chart-other` も追加
  - dark = Tailwind 500 系、light = Tailwind 600 系のパターン継承

### 色割り当てロジック

- `src/lib/chart-colors.ts` (+24 / -10) — 全置換
  - 旧 `CHART_COLORS` / `chartColorByIndex` (未使用 export) を削除
  - `CHART_PALETTE` (12 色定数) / `CHART_OTHER_COLOR` (グレー固定) / `assignChartColors(names): Map<string, string>` を新規 export
  - `assignChartColors` は「その他」を palette idx 消費せず固定グレー、12 色超過時は `% 12` で循環

- `src/lib/deck-archetype-colors.ts` (削除、-17)
  - 旧 `colorForArchetype(deckName)` (deck 名 hash % 8) を削除
  - 使用箇所が `EncounterDonutChart` と `TrendChart` の 2 ファイルのみ、両方 `assignChartColors` に置換済み

### 円グラフ (`src/components/stats/EncounterDonutChart.tsx`, +56 / -8 → +2 / -2 で型修正計 +58/-10)

1. `colorForArchetype` import → `assignChartColors, CHART_OTHER_COLOR`
2. Recharts から `Sector` + `type PieSectorShapeProps` を import 追加
3. `renderLabel` に `if (pct < 4) return null;` ガード追加 (小スライスはみ出し抑制)
4. `colorMap = useMemo(() => assignChartColors(data.map(d => d.name)), [data])` で色決定
5. `renderSectorShape = useCallback((props: PieSectorShapeProps) => {...}, [activeIndex])` を component 内に追加
   - `props.index === activeIndex` で active 判定
   - active なら `outerRadius + 6` + `stroke="var(--background)"` `strokeWidth={2}` で扇形膨らみ + 境界線
6. `<Pie>` の `onMouseEnter` / `onMouseLeave` を削除、`shape={renderSectorShape}` を追加
7. `<Cell>` の `opacity={activeIndex >= 0 && activeIndex !== i ? 0.35 : 1}` を削除 (非選択暗化廃止)
8. `getArcIndexFromPoint` の判定半径レンジを `innerRadius - 12 〜 outerRadius + 16` に拡張
9. `handlePointerMove` / `handlePointerLeave` を新規追加 (`e.pointerType === "touch"` はリターン)、`useEffect` の listener に登録

### 推移グラフ (`src/components/stats/TrendChart.tsx`, +6 / -5)

1. `colorForArchetype` import を `assignChartColors` に置換
2. `deckColorMap = assignChartColors(topDecks)` で色決定 (旧: `topDecks.forEach((deck) => deckColorMap.set(deck, colorForArchetype(deck)));` 4 行 → 1 行)
3. 残った 2 箇所の `colorForArchetype(deck)` を `deckColorMap.get(deck) ?? "var(--muted-foreground)"` に置換

### ヒートマップ (`src/components/stats/TrendHeatmap.tsx`, +12 / -4)

1. `displayDeckName` + `OpponentDeckNameMap` を import 追加
2. props を `{ data, opponentDeckNameMap }` に拡張 (optional のため dm/admin 側の引数省略でも互換)
3. 行ラベル (`{deck}`) を `{displayDeckName(deck, opponentDeckNameMap)}` でラップ
4. tooltip 行 (`{tooltip.deck}`) を同様にラップ

### pokepoke stats (`src/app/pokepoke/stats/page.tsx`, +1 / -1)

- `<TrendHeatmap data={filteredTrendData} />` → `<TrendHeatmap data={filteredTrendData} opponentDeckNameMap={opponentDeckNameMap} />`

### plan / 報告

- `docs/plans/2026-05-18_chart_color_palette_and_trend_display.md` (+685) — 本作業の plan
- `docs/reports/2026-05-18_chart_color_palette_and_trend_display.md` — 本報告書

---

## デプロイフロー

CLAUDE.md ルール「dev 経由で動作確認 → ユーザー本番反映指示後 main へ」に準拠:

1. dev push (3 commits: plan / 実装 / lint 修正)
2. Cloudflare dev preview build (3〜5 分、自動)
3. ユーザー dev preview 動作確認 → OK (codex 二次指摘の lint error 修正後に最終 OK)
4. ユーザー「本番反映」明示指示
5. `git checkout main && git pull origin main && git merge dev && git push origin main`
6. `git checkout dev` で dev に復帰
7. Cloudflare production build & deploy 開始 (3〜5 分、自動)

DB 変更なしのため Supabase migration 適用なし、CLAUDE.md「コード変更を伴う migration は main 反映後に db push」ルールの対象外。

---

## 検証結果

### Claude 自前 (実施済み)

- `npm run lint`: 私の変更による新規 error 0 件
  - pre-existing 33 errors はそのまま (memory `project_remaining_tasks_after_2026_05_09.md` 系統 B #9 Phase C 残部 lint と一致)
  - 当初 `renderSectorShape (props: any)` で 1 件追加されたが、codex 指摘を受け `PieSectorShapeProps` で型付けて解消
- `npx opennextjs-cloudflare build`: `OpenNext build complete.` で成功
- `grep -rn "colorForArchetype\|deck-archetype-colors" src`: 0 件
- `grep -rn "CHART_COLORS\b\|chartColorByIndex" src`: 0 件
- TrendHeatmap props 互換性確認: optional のため dm/admin 側の呼び出し (引数省略) でも動作

### ユーザー実機ブラウザ確認

- **dev preview** (`https://dev-duepure-tracker.jianrenzhongtian7.workers.dev`): OK 確認済
- **本番** (`https://duepure-tracker.jianrenzhongtian7.workers.dev`): Cloudflare ビルド完了後に確認 (本報告書時点で未確認)

---

## 設計判断のハイライト

### Recharts v3 で外部 state 駆動の active 表現

plan 当初は `activeShape` prop 利用を想定したが、plan-critic が「Recharts v3 の `<Pie>` には外部 state 駆動の `activeIndex` prop が無い、`activeShape` も内部 Tooltip activation でしか発火しない」と指摘。`PieProps` 型定義 (`node_modules/recharts/types/polar/Pie.d.ts`) で `activeShape` は `@deprecated`、`PieShape = (props: PieSectorShapeProps, index) => ReactElement` の `shape` prop が推奨パターンであることを確認。

`shape` callback 内で `props.index === activeIndex` (外部 state 比較) で active 判定する設計に変更。これにより custom pointer 検出 (`pointermove` + 既存 `getArcIndexFromPoint`) と Recharts 描画を独立に統合できた。

### 「その他」を palette と分離

ユーザー方針「12 色を超えても色数都合で『その他』集約しない」を踏まえ、`--chart-other` token を `--chart-1`〜`--chart-12` と独立に定義。`assignChartColors` 内で name が `"その他"` の場合は palette idx を消費せず固定グレーを割り当てる仕様。12 色超過は循環 + 識別性は隣接色配置 / 凡例 / tooltip / active sector でカバー。

### TrendHeatmap nameMap 伝播のスコープ最小化

ユーザー方針「pokepoke のみ修正、dm/admin は無修正」に従い、`TrendHeatmap` の `opponentDeckNameMap` を optional 化。dm は `opponent_deck_master.name = name_ja` のため表示変化なし、admin は呼び出し元側の nameMap 取得が未実装のため別作業として温存。

---

## 完了状況と残タスク

### 完了

- 実装 (8 ステップ全て)
- Claude 自前検証 (lint / build / grep)
- dev preview でユーザー動作確認 OK
- codex レビュー 4 件 (P2/P3 3 件 + 二次 lint error 1 件) 全て反映
- main へ merge + push (`1609792`)
- dev ブランチに復帰

### 残 (技術作業外、自動 or ユーザー側)

- Cloudflare 本番ビルド & deploy 完了 (自動、3〜5 分)
- ユーザーが本番でも円グラフ / 推移グラフ / ヒートマップ表示を確認

### 本作業に含めない (別 plan or 別作業、ユーザー方針で除外)

- dm / admin の `TrendHeatmap` への nameMap propagation (dm は表示変化なし、admin は呼び出し元側の nameMap 取得が必要)
- `nameMapReady` を `TrendChart` / `TrendHeatmap` の render gate に使う改修 (現状 `TrendChart` の挙動踏襲、チラつきは fallback で raw → 日本語の差し替え)
- ヒートマップのセル色 (現状の `--primary` opacity 段階表示) への deck 別色適用
- 円グラフ凡例 outline の色被り対策 (`assignChartColors` のユニーク色化で副次的に解決済み)
- pre-existing lint error 33 件への対応 (memory 系統 B #9 として別途扱い)

---

## 関連リンク

- 本番 URL: `https://duepure-tracker.jianrenzhongtian7.workers.dev`
- dev preview URL: `https://dev-duepure-tracker.jianrenzhongtian7.workers.dev`
- リポジトリ: `https://github.com/sharunu/duepure-tracker`
- 関連 plan: `docs/plans/2026-05-18_chart_color_palette_and_trend_display.md`
- 関連 memory: `project_remaining_tasks_after_2026_05_09.md` (今回作業は同 memory の残タスクに含まれず、新規 issue として独立)
