# DESIGN.md UI 改善 Phase 9 (ライトモード実装) 実施レポート

- 日付: 2026-05-11
- ブランチ: `dev` で実装 → `main` にマージ済
- 本番 URL: https://duepure-tracker.jianrenzhongtian7.workers.dev
- plan ファイル: `~/.claude/plans/design-md-ui-phase8-9-color-cleanup-and-light-mode.md`
- 前段: Phase 8 (2026-05-10_design_md_ui_phase_8.md) で `src/` 全域の hex/rgba を semantic token 化 + `--accent` alias 削除 + `color-mix` 動的 opacity 化が完了済
- 後段: なし (Phase 9 で UI 改善シリーズの token 化フェーズは完結)

## 概要

Phase 1-8 で構築した semantic token 基盤 (`--background` / `--foreground` / `--surface-1/2/3` / `--primary` / `--primary-soft` / `--warning` / `--destructive` / `--chart-1〜8` / `--win-rate-*` / `--border` / `--border-subtle/strong` / `--shadow-popover` 等) を活かし、`[data-theme="light"]` ブロックを追加するだけで light モードに切り替わる仕組みを実装した。

ゴール (達成済):

- `globals.css` に `[data-theme="light"]` ブロックを追加 (24 token を light 用に再定義)
- `:root` に `color-scheme: dark` を、light ブロックに `color-scheme: light` を追加 (native form control 等のテーマ追従)
- `ThemeProvider` + FOUC 対策 inline `<script>` + `<html data-theme>` 属性管理
- アカウントページに `<ThemeToggle>` を配置 (ライト / ダーク / システム の 3 値、lucide Sun/Moon/Monitor アイコン)
- localStorage 永続化 (キー: `duepure-theme`、未設定時は dark 強制で安全側)
- 実機確認後の light モード対応漏れを 6 回に分けて修正 (`text-white` / `text-gray-*` / `text-red-*` / `bg-*-XXX/NN` などの Tailwind native palette を semantic token に置換)
- X アイコン 4 箇所を公式ブランドの黒い角丸正方形 + 白 X letter に統一 (light で白抜きが見えなくなる問題に対応)
- codex 外部レビュー P2/P3 を反映 (hydration safety + radiogroup ARIA + arrow key focus 移動)

スコープ外として明示的に切り離し:

- 既存負債 lint 32 errors / 20 warnings (codex P2/P3 指摘、別 plan で対応)
- 共有画像 (`StatsShareCard` / `DeckShareCard`) の light 対応 (satori 制約、別 plan で satori token 解決ヘルパー)
- DB / Supabase / 認証 / Discord / X / Cloudflare デプロイ設定 (UI のみの変更)

## 実装内容

### Commit 履歴 (dev → main)

Phase 9 は機能の段階的解放 (UI 変化ゼロ → dark 固定 → トグル公開) と外部レビュー反映で 9 コミットに分割。

| Commit | サブ Phase | 主な変更 | 規模 |
|--------|-----------|---------|------|
| `bd7f5b0` | 9a | `globals.css` に `[data-theme="light"]` ブロック 24 token 追加 + `color-scheme: dark/light` | 1 file +59 |
| `7c32794` | 9b | `src/lib/theme.ts` (新規) / `ThemeProvider.tsx` (新規) / `layout.tsx` 編集 (FOUC inline script + `suppressHydrationWarning`) | 3 files +115/-4 |
| `71eb8f6` | 9c | `ThemeToggle.tsx` (新規、SegmentedControl + lucide Sun/Moon/Monitor) + account ページに「表示」セクション追加 | 2 files +64 |
| `8737f52` | 9d-1 | ユーザー第 1 ラウンド指摘の light 対応漏れ修正 (terms/privacy/decks/security/admin users/opponent-decks/home Discord カード) | 9 files +104/-104 |
| `dcedc1a` | 9d-2 | 対面デッキ管理 pokepoke タブの Limitless TCG セクション集中対応 (説明見出し / inline 強調 / focus ring / カテゴリバッジ) | 2 files +28/-28 |
| `34f162b` | 9d-3 | Claude 自前網羅調査で発見した残り 33 ファイルの semantic token 化 (admin 全画面 / auth / account / dm/pokepoke / stats / share / error / 404 / BanGuard / ErrorBoundary) | 34 files +169/-169 |
| `7a13f64` | 9d-4 | X アイコン 4 箇所を黒い角丸正方形 bg + 白 X letter に統一 (公式ブランド準拠) | 4 files +12/-8 |
| `c99a1b7` | 9d-5 | codex P2 反映: ThemeProvider hydration safety (初期 state を固定 dark に) + SegmentedControl radiogroup ARIA 強化 (role=radio / aria-checked / 矢印キー) | 2 files +36/-13 |
| `fb2d7fe` | 9d-6 | codex P3 反映: 矢印キーで DOM focus も次項目に移動 (buttonRefs + focus() 呼出し) | 1 file +17/-7 |

**集計**: 47 files changed, +586 / -315

### 主要トピック

#### 1. Phase 9a: `[data-theme="light"]` ブロック追加

`:root` の dark 値は完全に保護し、light 用 token を新規ブロックで定義:

```css
:root {
  color-scheme: dark;
  /* 既存 dark 値 (省略) */
}

[data-theme="light"] {
  color-scheme: light;
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --surface-1: #f1f5f9;
  --surface-2: #e2e8f0;
  --surface-3: #cbd5e1;
  --primary: #4f46e5;
  /* ... 24 token 完全再定義 */
}
```

`@theme inline` は触らず、CSS 変数のカスケード解決に任せる (Tailwind v4 native pattern)。chart palette / win-rate gradient は light 背景でのコントラスト確保のため彩度・明度を再調整。

#### 2. Phase 9b: ThemeProvider + FOUC inline script

`<head>` 内に hydration 前に同期実行される inline `<script>` を配置:

```js
(function(){
  try {
    var t = localStorage.getItem('duepure-theme');
    var r;
    if (t === 'light' || t === 'dark') r = t;
    else if (t === 'system') r = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    else r = 'dark';
    document.documentElement.setAttribute('data-theme', r);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
```

これにより React hydration 前に `data-theme` 属性が確定し、FOUC (dark→light フラッシュ) を回避。

`src/lib/theme.ts` で型 + 4 utility 関数 (`readStoredTheme` / `writeStoredTheme` / `resolveTheme` / `applyThemeToDocument`) を提供、`ThemeProvider.tsx` で context 提供 + `prefers-color-scheme` 変化追従。

#### 3. Phase 9c: ThemeToggle UI

Phase 2 で確立した `<SegmentedControl>` を再利用。3 値 (ライト / ダーク / システム) を lucide-react の `Sun` / `Moon` / `Monitor` アイコンと組み合わせ、アカウントページ「表示」セクションに配置。

```tsx
<SegmentedControl<Theme>
  items={[{value: "light", label: <Sun /> + "ライト"}, ...]}
  value={theme}
  onChange={setTheme}
  size="sm"
  fullWidth
  ariaLabel="テーマ切替"
  role="radiogroup"
/>
```

#### 4. Phase 9d-1 〜 9d-3: light モード対応漏れの段階修正

実機切替で発見した Phase 8 漏れを段階的に修正。共通パターン:

| Before | After |
|--------|-------|
| `text-white` (light 背景) | `text-foreground` |
| `text-gray-400/500/600` | `text-muted-foreground` |
| `text-gray-200/300` | `text-foreground` |
| `text-gray-400 hover:text-white` (戻るボタン) | `text-muted-foreground hover:text-foreground` |
| `text-red-400/500` (error) | `text-destructive` |
| `text-green-400` (success) | `text-success` |
| `text-yellow/orange/amber-400` | `text-warning` (or `text-success`) |
| `bg-{red,green}-500/10 border-{...}/30` | `bg-{destructive,success}/10 border-{...}/30` |
| `bg-indigo-900/50 text-indigo-300` (badge) | `bg-primary/20 text-primary-soft` |
| `focus:ring-indigo-500` | `focus:ring-primary` |
| `bg-primary text-white` | `bg-primary text-primary-foreground` |
| `placeholder:text-gray-500` | `placeholder:text-muted-foreground` |

意図的に残した `text-white`:
- `bg-destructive text-white` (削除ボタン / 通知バッジ): dark red bg + 白文字は両モードで高コントラスト
- `bg-[#5865F2] text-white` (Discord ブランド bg): 例外領域
- アバターイニシャル (primary gradient 上): 両モードで高コントラスト

#### 5. Phase 9d-4: X アイコンの公式ブランド化

light モードで `<path fill="white">` の X letter のみだと白背景に溶けて見えなくなるため、SVG に黒い角丸正方形を bg として追加:

```diff
- <svg viewBox="0 0 24 24" fill="white">
-   <path d="M18.244 2.25..."/>
- </svg>
+ <svg viewBox="0 0 24 24">
+   <rect width="24" height="24" rx="4" fill="black"/>
+   <path d="M18.244 2.25..." fill="white"/>
+ </svg>
```

対象 4 箇所:
- `auth/page.tsx` (X (Twitter) でログインボタン)
- `account/page.tsx` (X 連携ボタン)
- `share/ShareModal.tsx` (X 投稿ボタン)
- `share/ShareButton.tsx` (stats ヘッダーの X 連携リンク 小サイズ)

両モードで X 公式ブランドの見た目 (黒角丸正方形 + 白 X) で統一。

#### 6. Phase 9d-5: codex P2 反映 — ThemeProvider hydration safety

これまで `useState(() => readStoredTheme())` の lazy initializer で localStorage から読んでいたが、SSR は "dark"、client 初回 hydration は localStorage 値で差分が発生し、`light` / `system` 保存済ユーザーの `ThemeToggle` button class が SSR と client で不一致になる可能性があった。

修正:
- 初期 state を固定 `"dark"` に変更 → SSR と client 初回 hydration の HTML を一致
- mount 後の `useEffect` で localStorage から実値に sync
- `data-theme` 属性は `<head>` inline script が hydration 前に正しい値を付与済 → 見た目の FOUC は発生せず
- `react-hooks/set-state-in-effect` 警告は意図的に許容 (eslint-disable + コメントで根拠明記)

#### 7. Phase 9d-5: codex P2 反映 — SegmentedControl radiogroup ARIA

これまで `role="radiogroup"` を渡しても子要素は `<button>` のままだった (tablist 分岐のみ実装)。スクリーンリーダーで「ラジオグループ内の選択肢」として読まれない問題を修正:

- `isRadiogroup` 分岐を追加
- 子要素に `role="radio"` + `aria-checked` + roving `tabIndex`
- ArrowLeft / ArrowRight キーで前後の有効項目に選択移動 (disabled をスキップ)

#### 8. Phase 9d-6: codex P3 反映 — arrow key DOM focus 移動

矢印キー押下時、`onChange` で選択値は変わるが DOM focus が旧 button に残り、roving tabIndex と相まって「focus は旧項目、選択は新項目」のズレが発生していた。

修正:
- `useRef<(HTMLButtonElement | null)[]>` で各 button の DOM ref を保持
- 矢印キーで次項目決定後 `onChange(next) + buttonRefs.current[nextIdx]?.focus()` で DOM focus も移動

WAI-ARIA Authoring Practices の radio group pattern に準拠。

## 検証

### Claude 自前検証

- `npm run lint`: 52 件 (Phase 9 着手前と同数、新規 lint regression なし)。32 errors / 20 warnings は既存負債 (codex P2/P3 指摘)、別 plan で対応
- `npx opennextjs-cloudflare build`: 各サブ Phase で 0 エラー
- `grep -rnE "text-(white|gray-XXX)|bg-(red|amber|indigo)-XXX" src/`: 例外領域 (Discord ブランド bg / destructive 高コントラスト / アバター gradient) を除き 0 件
- 9 サブ Phase それぞれで preview URL の curl + SSR HTML 確認

### ユーザー実機確認

各サブ Phase 完了後、Cloudflare preview deploy で確認:
- 9a/9b: token 値の見た目影響ゼロ (data-theme 未設定または "dark" 固定で従来と完全一致)
- 9c: 「表示」セクションのトグル動作、ライトモード初体験、リロード後の永続化
- 9d-1 〜 9d-3: 報告された箇所と Claude 網羅調査で発見した箇所の light モード表示
- 9d-4: X アイコンが両モードで黒角丸正方形 + 白 X letter で一貫表示
- 9d-5: ThemeToggle のキーボード操作 / スクリーンリーダー読み上げ
- 9d-6: ArrowLeft / ArrowRight で focus と選択が同時に次項目へ移動

## codex 外部レビュー

Phase 9d-4 完了時点で codex に実装レビューを依頼。主要指摘:

| ラウンド | 指摘 | 反映先 |
|---------|------|--------|
| 1 (P2) | ThemeProvider hydration mismatch 可能性 | Phase 9d-5 で固定 dark + useEffect sync に変更 |
| 1 (P2) | radiogroup ARIA 未完成 | Phase 9d-5 で role=radio / aria-checked / 矢印キー追加 |
| 1 (P2/P3) | lint 既存負債 32 errors | Phase 9 範囲外、別 plan で対応 |
| 2 (P3) | 矢印キーで DOM focus が次項目に移らない | Phase 9d-6 で buttonRefs + focus() 呼出し |

2 ラウンドのレビュー → 修正を経て GO 判定。

## 学び・既知の課題

### 学び

1. **lazy initializer は SSR/client hydration mismatch の温床**
   `useState(() => readStoredTheme())` のような lazy init はクライアント初回 render で外部状態 (localStorage) を読むが SSR は読めない。React は両者の HTML 差分を `suppressHydrationWarning` で抑制できるが、子コンポーネントが state を class/style で表現すると差分が見える。安全側のパターンは「SSR と一致する初期 state → mount useEffect で sync」。

2. **WAI-ARIA radio group pattern は role + aria-checked + roving tabIndex + 矢印キー + focus 移動の 5 要素セット**
   どれか 1 つでも欠けるとスクリーンリーダー / キーボードユーザーの体験が損なわれる。codex 2 ラウンドの指摘で完成に至ったが、最初から全要素を仕様として認識すべきだった。

3. **`color-scheme` CSS プロパティは theme 切替の重要な仕上げ**
   `:root { color-scheme: dark }` / `[data-theme="light"] { color-scheme: light }` の追加で `<input type="date">` / スクロールバー / native select 等のブラウザ標準 UI もテーマ追従する。CSS 変数の token 化だけでは届かない領域をカバー。

4. **light モード対応漏れの発見には実機切替 + Claude 自前網羅 grep の組み合わせが有効**
   ユーザー目視で発見できたのは 7 箇所、その後 Claude 自前 grep で 33 ファイル / 100+ 箇所の漏れを発見。grep パターン `text-(white|gray-XXX)|bg-{red,indigo,...}-XXX` を初期から自動化していれば Phase 8 段階で潰せた漏れだった。

5. **`text-white` は意図的なケースと漏れケースが混在**
   `bg-destructive text-white` (削除ボタン) は両モードで高コントラスト → 残すべき。`<h1 className="text-white">` (タイトル) は light で見えない → 修正すべき。grep で機械的に置換せず、bg と組み合わせて判断する必要がある。

### 既知の課題

- 共有画像 (`StatsShareCard` / `DeckShareCard`) は satori 制約で hex 直書きのまま、light モード対応未実施。別 plan で satori token 解決ヘルパーを書く必要あり
- `BottomNav` のアクティブ状態は `text-primary` / `text-muted-foreground` で token 経由化済、ただし light モードでの体感は実機で再確認推奨
- 既存負債 lint 32 errors / 20 warnings (codex P2/P3 指摘) は Phase 9 範囲外
- `recharts` の chart 系列が light で隣接系列の区別が難しい場合、Phase 9 の chart palette 値は実機確認後の微調整余地あり

## Phase 9 完了時の状態

- `globals.css`: `:root` (dark) + `[data-theme="light"]` の 2 ブロック構成、24 token 完全対応
- `ThemeProvider`: SSR safe hydration + localStorage 永続化 + prefers-color-scheme 追従
- `ThemeToggle`: account ページに配置、3 値 (light/dark/system) + WAI-ARIA radio group 完全準拠
- `SegmentedControl`: tablist / radiogroup の両 ARIA pattern をサポート (汎用 a11y 共通部品)
- `text-white` / `text-gray-*` / `text-red-*` 等の Tailwind native palette を例外領域除き 0 件に
- X アイコン 4 箇所が公式ブランドの黒角丸正方形 + 白 X letter で統一
- 全 Phase 1-9 を通して `src/` 全域が semantic token + light/dark の二モード対応

## 補足: 集計

- 影響ファイル数: 47 (Phase 9a-9d-6 合計、重複は 1 とカウント)
- 実 commit 数: 9 (9a / 9b / 9c / 9d-1 〜 9d-6)
- 新規ファイル: 3 (`src/lib/theme.ts` / `src/components/providers/ThemeProvider.tsx` / `src/components/ui/ThemeToggle.tsx`)
- 削除ファイル: 0
- semantic 化した Tailwind class: 約 300 件
- 新規 SVG background 追加: X アイコン 4 箇所
- codex 外部レビュー: 2 ラウンド (P2 × 2 + P3 × 1)
- lint 警告数: 52 (着手前と同数、リグレッションなし)
