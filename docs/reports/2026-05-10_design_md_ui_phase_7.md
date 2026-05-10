# DESIGN.md UI 改善 Phase 7 (stats トップ デスクトップ幅レイアウト拡張) 実施レポート

- 日付: 2026-05-10
- ブランチ: `dev` で実装 → `main` にマージ済 (`991f946`)
- 本番 URL: https://duepure-tracker.jianrenzhongtian7.workers.dev
- plan ファイル: `~/.claude/plans/design-md-ui-phase7-stats-desktop.md`
- 前段: Phase 1-6c (2026-05-10_design_md_ui_phase_1_6c.md) で UI 共通基盤 + stats サブ詳細の PageShell 化が完了済

## 概要

DESIGN.md L309「分析画面や詳細画面は、タブレット/デスクトップで広げる余地を残す」と L624「`max-w-lg` 固定が読み取りを妨げる画面は、画面単位で広げる」を背景に、stats トップ 2 ファイル (`/dm/stats`, `/pokepoke/stats`) のデスクトップ幅 (1024px+) のみ広げた。

ゴール (達成済):

- stats トップだけをデスクトップで広げる (モバイル/タブレット portrait は完全維持)
- PageShell の API 互換性維持 (既存消費者は引数省略で旧挙動)
- 2 カラム化・内部レイアウト変更は別 plan に切り離す
- 実機確認結果に応じた幅微調整 (`max-w-4xl` → `max-w-3xl`)

スコープ外として明示的に切り離し (本 Phase では touch しない):

- 2 カラム化 / レスポンシブグリッド (DESIGN.md L562/L622 の「検討する」段階、別 plan)
- FilterBar / KPI / chart 内部のデスクトップ調整 (`lg:flex-row`, `lg:grid-cols-N` 等)
- stats サブ詳細・他画面 (home / battle / decks / account / admin / share) への PageShell `maxWidth` 適用

## 実装内容

### Commit 履歴 (dev → main)

| Commit | 種別 | 主な変更 | 規模 |
|--------|------|---------|------|
| `10a8abf` | feat | PageShell に `maxWidth?: "default" \| "wide"` prop 追加 (default 後方互換)。dm/pokepoke stats トップ生 div → `<PageShell maxWidth="wide">` 移行。`wide` = `max-w-lg lg:max-w-4xl` (896px) | 3 files +16/-6 |
| `62736ab` | fix | 実機確認で 4xl は分析トップが横に間延び (FilterBar/ScopeSelector/ViewSelector が 1 カラムのまま伸びる) と判断、`lg:max-w-4xl` → `lg:max-w-3xl` (768px) に狭めた | 1 file +1/-1 |

### PageShell.tsx の API 拡張

`maxWidth` prop を後方互換で追加。default は `"default"` で既存呼び出し (Phase 6c で導入された stats サブ詳細 4 ページ等) は完全に旧挙動。

```tsx
type Props = {
  children: ReactNode;
  bottomNav?: boolean;
  maxWidth?: "default" | "wide"; // 新規
  className?: string;
};

export function PageShell({
  children,
  bottomNav = true,
  maxWidth = "default",
  className,
}: Props) {
  const padBottom = bottomNav ? "pb-20" : "";
  const widthClass =
    maxWidth === "wide" ? "max-w-lg lg:max-w-3xl" : "max-w-lg";
  const extra = className ? ` ${className}` : "";
  return (
    <div className={`min-h-screen ${padBottom} px-4 pt-6 ${widthClass} mx-auto space-y-4${extra}`}>
      {children}
    </div>
  );
}
```

### stats トップ 2 ファイルの wrapper 移行

dm/pokepoke の stats トップで使われていた:

```tsx
<div className="min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4">
  ...
</div>
<BottomNav />
```

を以下に置換 (`<BottomNav />` は Phase 6c の慣習どおり PageShell の sibling として残す):

```tsx
<PageShell maxWidth="wide">
  ...
</PageShell>
<BottomNav />
```

`import { PageShell } from "@/components/ui/PageShell";` 追加のみで他 import / 内部コンポーネント / 機能ロジックは一切変更なし。

## レビュー〜実機確認〜微調整の経緯

### 1. plan-critic (内部 subagent) レビュー

`/review-plan-loop` で 1 反復目に `verdict: GO` 判定。実コード位置 (dm/stats:L402-404 / pokepoke/stats:L418-420 / Phase 6c PageShell 消費者) との整合・CLAUDE.md 規約準拠を確認。

### 2. codex (外部) レビュー: 条件付き GO

Must Fix 2 点 + Should Improve 1 点を反映:

1. 「コンポーネント API は一切変更しない」と書いておきながら PageShell に prop を追加する矛盾 → 「色・トークン・機能ロジックは変更しない。コンポーネント API は PageShell の後方互換な maxWidth prop 追加のみに限定する」に修正
2. SSR HTML 内 class 文字列 grep は stats page が `"use client"` + Suspense なので reliable でない → source grep + 実機 DevTools (可能なら程度) に置換
3. line 5「main 反映済」表現の緩和 → 「dev で Phase 1-6c 完了、必要に応じて main 反映済み」に置換

### 3. dev push → 実機確認

`max-w-4xl` (896px) で push 後、実機で「分析トップが横に広がりすぎ、FilterBar / ScopeSelector / ViewSelector が 1 カラムのまま伸びて間延び」とのフィードバック。

### 4. 微調整 (1 line, 1 commit)

幅だけを `lg:max-w-3xl` (768px) に狭める軽量修正。2 カラム化や内部レイアウト変更は今回は行わない方針を維持。再 push 後の実機確認で「OK」を得て main 反映。

## 検証

### Claude 自前検証 (完了)

- `grep -c '<PageShell maxWidth="wide">' src/app/{dm,pokepoke}/stats/page.tsx`: 1/1
- `grep -c 'min-h-screen pb-20 px-4 pt-6 max-w-lg mx-auto space-y-4' src/app/{dm,pokepoke}/stats/page.tsx`: 0/0 (旧 wrapper 完全撤去)
- `grep -c 'lg:max-w-3xl' src/components/ui/PageShell.tsx`: 1
- `grep -c 'lg:max-w-4xl' src/components/ui/PageShell.tsx`: 0
- `grep -rn 'lg:max-w-3xl' src/app/{dm,pokepoke}/stats/{deck,opponent}/`: 該当なし (Phase 6c サブ詳細回帰なし)
- `grep -rn 'lg:max-w-4xl' src/`: 該当なし (撤去完了)
- `npm run lint`: PageShell.tsx 0 issues、stats トップ 2 ファイルは Phase 7 起因の新規 lint 問題ゼロ (既存 unused warning のみ、Phase 6c から不変)
- `npx opennextjs-cloudflare build`: 成功 (`/dm/stats`, `/pokepoke/stats`, サブ詳細含む全ルート生成)

### ユーザー実機確認 (完了)

- `/dm/stats` と `/pokepoke/stats` のデスクトップ幅 (1024px+) で `max-w-3xl` (768px) に拡張、間延びなし
- モバイル / タブレット portrait は `max-w-lg` のまま (回帰なし)
- `/dm/stats/deck/{任意}` / `/pokepoke/stats/opponent/{任意}` のサブ詳細は従来の `max-w-lg` のまま (Phase 6c 回帰確認 OK)

## main 反映

- マージ commit: `991f946` (`a189034..991f946`, ort strategy のマージコミット)
- 含まれる Phase 7 commits: `10a8abf` + `62736ab`
- Cloudflare 自動本番デプロイ実行

## 累計変更規模

| 項目 | 値 |
|------|-----|
| Files changed | 3 |
| 追加 | +17 |
| 削除 | -7 |
| 純増 | +10 |
| 新規ファイル | 0 (PageShell.tsx は Phase 6c で新規追加済、本 Phase は API 拡張のみ) |

## 学び

- **段階的拡張パターンの有効性**: Phase 6c で PageShell を導入し、Phase 7 で `maxWidth` prop を後方互換に追加した。既存消費者 (Phase 6c で導入された 4 つのサブ詳細) を一切 touch せず stats トップだけを広げられた。default 値による後方互換は OSS 的だが、内部プロジェクトでも非常に効く
- **実機確認による値の微調整は別 commit が正解**: 当初 `max-w-4xl` (896px) で plan 通り実装し push、実機で「広すぎる」と分かってから 1 line 1 commit で `max-w-3xl` (768px) に狭めた。1 つの commit にまとめるより、初期実装 commit と微調整 commit を分けた方が rollback 単位として明確で、判断の経緯も追える
- **2 カラム化を別 plan に分離した判断は正解**: max-width 拡張だけだと内部レイアウトが「1 カラムのまま間延び」に見えるが、これは「max-width 拡張+2 カラム化を一気にやるべき」という意味ではなく「2 カラム化を始める前に、まず max-width で読み取り余地を確保し、画面密度の体感を確認する」のが正しい順番。実機 768px 表示で 2 カラム化が必要かどうかの判断材料が揃った
- **plan-critic + codex の二段レビュー**: 内部 critic は実コード整合・CLAUDE.md 規約・命名一貫性で GO。外部 codex は plan 文書の論理矛盾 (API 不変宣言 vs. prop 追加) と検証手段の reliability (SSR HTML class grep) を指摘。役割分担できた

## 残課題 (本 Phase 後の別 plan で扱う)

- **2 カラム化検討**: stats トップで FilterBar / KPI / chart の左右配置や `lg:grid-cols-2` を検討 (DESIGN.md L562/L622)
- **stats サブ詳細のデスクトップ幅**: 必要なら Phase 6c で導入済の `<PageShell>` (maxWidth 省略) に `maxWidth="wide"` を追加する別 plan
- **他画面 (home / battle / decks / account / admin / share) のデスクトップ幅対応**: 各画面の用途に応じて個別判断
- **ライトモード実装本体**: `[data-theme="light"]` ブロック追加・トグル UI・状態永続化 (Phase 1-6c で token 構造は準備済)
- **`--accent` alias の最終削除**: 残参照がある account 系の対応後

## 参照

- DESIGN.md L308-312 (PageShell)
- DESIGN.md L543-562 (Stats)
- DESIGN.md L617-624 (Tablet / Desktop)
- plan: `~/.claude/plans/design-md-ui-phase7-stats-desktop.md`
- 前段レポート: `docs/reports/2026-05-10_design_md_ui_phase_1_6c.md`
