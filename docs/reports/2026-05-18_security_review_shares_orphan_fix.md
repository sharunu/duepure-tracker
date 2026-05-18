# 実装報告書: 公開前セキュリティレビュー対応 (#1 npm audit + #2 shares 孤児化 2-phase)

**日付**: 2026-05-14 (調査開始) 〜 2026-05-18 (prod 適用完了)
**担当**: Claude Code (codex 外部レビュー併用)
**ブランチ**: `dev` → `main` (本番反映 + production DB migration 適用済)
**関連 plan**: `docs/plans/2026-05-16_shares_delete_on_account_delete.md`
**関連 memory**: `memory/project_security_review_2026_05_14.md`

---

## 概要

公開前セキュリティレビューを 4 パス (手動スイープ / DB 差分レビュー / `/security-review` skill マルチエージェント / Supabase Security Advisor + 自前 grep 検証) で実施し、悪用可能な脆弱性 0 件を確認。検出された 8 項目のうち、公開ブロッカー級の 2 件 (`#1 npm audit` の transitive 依存脆弱性、`#2 shares 孤児化` プライバシー課題) を本セッションで対応完了した。

`#2` は当初 route 修正のみの 1-phase plan で進めたが、codex 二次レビューで「同時実行レース」「将来の別経路」「Storage 失敗時の orphan 回収不可」の 3 つの隙間を指摘され、DB 層で FK CASCADE 化する Phase B を追加して 2-phase plan に書き直した。Phase A (route 修正) は staging/dev preview で動作確認後 main 反映、Phase B (FK CASCADE migration) は CLAUDE.md ルールに従い main 反映後に production DB へ CLI 経由で適用。

スキップ確定の `#4 Leaked Password Protection` は Supabase Pro Plan 必須のため Free 運用継続。残 4 項目 (`#3 Sentry` / `#5 INTERNAL_API_KEY` / `#6 CSP nonce` / `#7 OGP rate limit` / `#8 admin RPC server-side refactor`) はいずれも運用改善・defense-in-depth であって公開ブロッカーではないため、ドメイン取得タイミングで他の残タスクと並行して対応する方針。

---

## レビューフロー

CLAUDE.md / memory `feedback_codex_review_flow` に従い、plan-critic と codex の往復で plan を磨いてから実装:

1. セキュリティレビュー 4 パス実施 (2026-05-14)
   - パス 1 = 手動スイープ (API routes / middleware / next.config / RLS migration の静的精読、npm audit、git 履歴の secret 漏洩 grep)
   - パス 2 = 直近 DB 差分 (`6335b11..467faba`、PR5-PR10 Phase 2 hardening) の精読
   - パス 3 = `/security-review` skill (origin/HEAD を root commit に向けて全 268 ファイル対象に general-purpose agent 1 本で識別 + 自前で hard-exclusion フィルタ)
   - パス 4 = Supabase Security Advisor (本番 + staging、`get_advisors` MCP) + 自前検証 grep (`USING(true)` / `SECDEF without search_path` の false positive 判定)
2. 8 項目に整理し優先度付け、codex 二次レビューで #3 の格下げ (公開ブロッカー → 運用改善) と #4 の Pro Plan 制約を反映
3. `#1 npm audit fix` 実施 → main 反映 (1 commit)
4. `#2 shares 孤児化` の plan 初版作成 → `/review-plan-loop` で 3 ラウンド GO → ユーザー一次承認
5. codex 二次レビューで 4 点 (existing orphan / race condition / Storage 失敗扱い / service_role DELETE 権限) 指摘 → preflight 実施 (orphan 0 / sr_delete ✅) + plan を 2-phase に書き直し (Phase B FK CASCADE 追加、処理順序入れ替え、失敗マトリクス文言修正、版番号規約準拠)
6. ユーザー二次補正 3 点 (デプロイ順序の staging 先行 / preflight 再確認の明文化 / 失敗マトリクスの「画像公開リスクは下がるが share_data は残る」表現) を反映
7. `/review-plan-loop` 再実行 3 ラウンド GO → ユーザー最終承認 → 実装着手
8. Phase A 実装 → dev push → Cloudflare dev preview build 確認
9. Phase B migration 作成 → MCP `apply_migration` で staging 適用 → dev preview で E2E 3 パターン検証
10. ユーザー OK → main 反映
11. Cloudflare production deploy 完了確認 (ユーザー dashboard 確認)
12. Phase B migration を CLI (`npx supabase db push --include-all`) で production DB に適用 → MCP で FK CASCADE + orphan 0 確認

---

## 実装した commits (dev → main)

| Commit | Message | 内容 |
|---|---|---|
| `788d901` | fix(deps): npm audit で flatted/picomatch/brace-expansion を patch 更新 | #1 dev push |
| `709fba4` | Merge branch 'dev' (#1) | #1 main 反映 |
| `a9699af` | docs(plans): #2 shares 削除 plan v2 を追加 (Phase A + Phase B 2-phase 構成) | #2 plan docs |
| `6b629f3` | fix(account-delete): #2 Phase A - shares 行明示 DELETE + 処理順序入れ替え | #2 Phase A 実装 |
| `9803814` | feat(db): #2 Phase B - shares.user_id FK を ON DELETE CASCADE 化 (staging 適用済) | #2 Phase B migration files |
| `b8682b6` | Merge branch 'dev' (#2 Phase A + B) | #2 main 反映 |

main 反映: 2 ラウンド (#1 single → #2 Phase A+B+plan 3 commits)。DB push: staging は MCP `apply_migration` (Phase B 用)、production は CLI で適用 (version alignment クリーン)。

---

## 変更ファイル

### `#1` 由来 (lockfile のみ、コード変更なし)

- `package-lock.json` — `npm audit fix` で 3 件の脆弱性を patch レベルで解消
  - `brace-expansion` 5.0.4 → 5.0.6 / 1.1.12 → 1.1.14 (moderate: zero-step DoS)
  - `flatted` 3.3.4 → 3.4.2 (high: prototype pollution / unbounded recursion DoS)
  - `picomatch` 4.0.3 → 4.0.4 (high: method injection / ReDoS)
  - 全て dev/build-time transitive (ESLint / @opennextjs/cloudflare / typescript-eslint 経由)、本番ランタイムバンドル外。`package.json` 変更なし。diff +12/-12 行のみ

### `#2 Phase A` 由来 (route のみ、migration なし)

- `src/app/api/account/delete/route.ts` — 処理順序入れ替え + shares 行明示 DELETE 追加
  - **旧設計**: Bearer 認証 → path 収集 → list → deleteUser → Storage remove (失敗は警告)
  - **新設計**: Bearer 認証 → path 収集 → list → **Storage remove (失敗は 500 で abort)** → **shares DELETE (新規)** → deleteUser
  - 新規 `// === 3. Storage 上のファイルを先に削除 ===` ブロック挿入。旧設計の「deleteUser 後の Storage remove」は Storage 失敗時に DB は消えたが画像は残り、shares 行も既に消えているため `list_expired_shares` で回収できない問題があった。順序を逆にすればリトライで前進可能
  - 新規 `// === 4. shares 行を明示削除 ===` ブロック挿入。shares.user_id FK が SET NULL のため deleteUser では消えない (= /share/[id] と /api/og/[id] で公開され続ける) ため明示 DELETE が必須
  - 既存 `// === 3. auth.admin.deleteUser ===` を `// === 5. ===` にリネーム、インライン CASCADE コメントから shares を削除して SET NULL を踏まえた表現に
  - 冒頭の「削除順序」procedural list を 6 → 7 ステップに更新、CASCADE 前提のコメントを撤回
  - +69 行 / -35 行 (route 1 ファイル)

### `#2 Phase B` 由来 (migration + rollback)

- `supabase/migrations/20260518000001_shares_user_id_cascade.sql` — shares.user_id FK を `ON DELETE SET NULL` → `ON DELETE CASCADE` に変更
  - `DROP CONSTRAINT shares_user_id_fkey` → `ADD CONSTRAINT shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE`
  - FK 名は preflight で実 constraint name `shares_user_id_fkey` を確認済 (prod / staging 共通)
  - 冒頭 comment で適用順序 (staging 先行 / production は main 反映後) と preflight 結果 (orphan 0 / sr_delete ✅) を明記

- `supabase/rollback/20260518000001_rollback.sql` — Phase B 緊急時用 SET NULL 戻し migration
  - 適用しない (`supabase/rollback/` は `supabase db push` 対象外、手動で `apply_migration` で流す)
  - 既存 `supabase/rollback/20260424000004_rollback.sql` の前例に倣う格納

### plan / 報告 (docs のみ)

- `docs/plans/2026-05-16_shares_delete_on_account_delete.md` — #2 用 plan v2 (393 行)
  - 背景 / 問題詳細 / preflight 結果 / 設計判断 / 実装ステップ (Phase A 5 step + Phase B 2 step) / 失敗マトリクス / エッジケース / テスト計画 / ロールバック / 関連ファイル / Resolved Decisions / 公開前残タスクとの位置付け
- `docs/reports/2026-05-18_security_review_shares_orphan_fix.md` — 本報告書

---

## デプロイフロー

CLAUDE.md「コード変更を伴う migration は production DB への適用時に main 反映完了後で実施する」ルールを **production に対するもの** として解釈し、staging は dev preview 検証のため先行適用する方針を Resolved Decisions で確定:

1. Phase A code を dev に commit/push → Cloudflare dev preview ビルド (`6b629f3`)
2. Phase B migration を staging DB に適用 (MCP `apply_migration`)
3. dev preview (staging DB 参照) で動作確認 — アカウント削除 → shares 削除 + Storage 削除 + CASCADE 経由でも shares が連鎖削除されること
4. ユーザー OK
5. dev → main マージ + push (`b8682b6` = Merge branch 'dev') → Cloudflare prod ビルド
6. ユーザーが Cloudflare dashboard で main の prod deploy 完了確認
7. Phase B migration を CLI で production DB に適用
   - ユーザーがローカル terminal で `export PROD_DB_URL='...'` + `npx supabase db push --db-url "$PROD_DB_URL" --include-all` 実行
   - 出力は `Local | Remote = 20260518000001 | 20260518000001` でクリーン (CLI 経由なので version drift なし)
8. MCP で prod の FK 状態 + migration list 確認 → `ON DELETE CASCADE` + orphan 0 件確定

注: staging migration は MCP `apply_migration` を使ったため、Supabase 側で auto-generated version (`20260518075515`) で記録されている。ローカルファイル `20260518000001_*` との不一致は機能影響なし (migration は冪等)、将来 `supabase db push --include-all` を staging で実行すると同 migration が再適用されるが結果は同じ。production は CLI 適用したため version は綺麗に揃っている。

---

## 検証

### Claude 自前検証 (実装時)

- `npx eslint src/app/api/account/delete/route.ts` → exit 0 (今回の変更ファイルに新規 errors なし)
- `npx eslint src/app/api/account/delete/route.ts src/lib/auth/require-bearer.ts` → exit 0 (Phase A + 認証 helper)
- `npx opennextjs-cloudflare build` → 通過 (Worker bundle 生成成功)
- 注: `npm run lint` (project 全体) は既存の lint debt 32 errors (PR 範囲外) で落ちるため未実行

### dev preview E2E (staging DB 適用後)

公開 staging に対して使い捨てテストアカウントを 3 ユーザー作成し、3 パターンの E2E を実施:

#### E2E #1: フル route 経由 (Phase A + Phase B 統合動作確認)

`image_path` 設定済 / 実 Storage ファイルなしのケース:

| ステップ | 結果 |
|---|---|
| Sign up + share INSERT (`e2e-cascade-20260518`) | 完了 |
| **pre-state** `/share/<id>` | HTTP 200, 16073 bytes (page render) |
| **pre-state** `/api/og/<id>` | HTTP 200, 122820 bytes (OGP image 生成) |
| `/api/account/delete` POST with JWT | HTTP 200, `{ok:true, storage_deleted:0, storage_warnings:["expected 1 files removed, got 0"]}` |
| **post-state** `/share/<id>` | HTTP **404** ✓ |
| **post-state** `/api/og/<id>` | HTTP **404** ✓ |
| shares / auth.users / profiles for user | **0** ✓ |
| 既存ユーザーの shares total | 6 (無傷) ✓ |

response の `expected 1 files removed, got 0` 文言は Phase A 新コードのもの (`expected ${paths.length} files removed, got ${storageDeleted}`) → Cloudflare dev preview が `9803814` を反映している間接証拠。

#### E2E #2: Phase B 単独 (route を通さない直接 DELETE)

別の使い捨てテストユーザーで MCP `execute_sql` から直接 `DELETE FROM auth.users WHERE id = ...` を実行 (= route の Phase A コードを通さず Phase B の FK CASCADE 単独動作を分離検証):

| | pre | post |
|---|---|---|
| shares for user_id | 1 | **0** ✓ (FK CASCADE で連鎖削除) |
| auth.users / profiles | 1 / 1 | 0 / 0 |
| orphan (`user_id IS NULL`) | — | 0 ✓ (Phase B 適用前なら 1 件残ったはず) |
| 既存 shares total | — | 6 (無傷) |

Phase B FK CASCADE が route を介さず単独で動作することを実証。Phase A の route 内 DELETE が万一バイパスされても DB レイヤで保護される defense-in-depth が機能。

#### E2E #3: 実 Storage ファイル付き (ユーザー指示で追加)

3 人目の使い捨てユーザーを作成し、`share-images/<user_id>/e2e-real-20260518.png` に 1024 byte の実ファイルを upload (user JWT 認証) → share INSERT で `image_path` をリンク → `/api/account/delete` 実行:

| | 値 |
|---|---|
| Delete API response | `{"ok":true,"storage_deleted":1,"storage_warnings":[]}` HTTP 200 |
| **storage_deleted** | **1** ✓ (実ファイル削除成功) |
| **storage_warnings** | `[]` ✓ (warning 0) |
| `/share/<id>` post | HTTP 404 |
| `/api/og/<id>` post | HTTP 404 |
| 直 Storage URL post | HTTP 400 (ファイル消失) |
| MCP `storage.objects` for user | 0 ✓ |
| shares / auth.users / profiles for user | 0 / 0 / 0 ✓ |
| 既存 shares total | 6 (無傷) ✓ |

実ファイル付きで Phase A の Storage cleanup (Storage remove → shares DELETE → deleteUser の順序) が正しく動作することを実証。

### production 検証 (migration 適用直後)

CLI 適用直後 (`b8682b6` main 反映完了 + production deploy 完了の状態) に MCP で確認:

| 項目 | 適用前 | 適用後 |
|---|---|---|
| `fk_def` | `ON DELETE SET NULL` | **`ON DELETE CASCADE`** ✓ |
| `orphan_count` | 0 | **0** ✓ |
| `total_shares` (参考) | 58 | 58 (変動なし) |
| `users_with_shares` | 3 | 3 |
| `service_role DELETE` | ✅ | ✅ |
| `migration list` 最終行 | `20260516000001 / drop_delete_own_account` | `20260518000001 / shares_user_id_cascade` ✓ |
| CLI `Local | Remote` | — | `20260518000001 | 20260518000001` ✓ |

最重要 2 項目 (FK CASCADE 化 + orphan 0) を確認、production への影響は scope 内 (既存 shares 件数は無変動)。

---

## 残タスク (memory に詳細)

`memory/project_security_review_2026_05_14.md` に記録した 8 項目のうち:

**完了**:
- ✅ `#1 npm audit fix` (本セッション完了)
- ✅ `#2 shares 孤児化` (本セッション完了、Phase A + Phase B + prod 適用)

**スキップ確定**:
- ⛔ `#4 Leaked Password Protection` (Pro Plan 必須、Free 運用継続)

**残 4 項目** (公開ブロッカーなし、優先度低い順):
1. `#3 Sentry 導入` — Cloudflare `observability.enabled` は既に有効でランタイム error は捕捉済、Sentry はフロントエンド例外 + ユーザー影響追跡として運用改善
2. `#5 INTERNAL_API_KEY 定数時間比較` (`/api/internal/detection-scan/route.ts:9`) + `#7 /api/og/[id] GET rate limit` — 相乗り 1 plan で軽く
3. `#6 CSP script-src 'unsafe-inline' の nonce 化` (`next.config.ts:9`) — 単独 plan、中程度
4. `#8 admin RPC に REVOKE EXECUTE FROM authenticated` — 単純 REVOKE では admin UI が壊れる (現状ブラウザの authenticated session で `supabase-js` 直で RPC 呼び出し)。admin 操作を `/api/admin/*` server-side に寄せる大規模 refactor が前提、別 plan 急がない

公開前残タスク全体は `memory/project_remaining_tasks_after_2026_05_09.md` のドメインバッチ 7 項目 (規約 / LP / Sentry / PWA / オンボーディング 等) と合流予定。ドメイン取得後にまとめて対応するのが効率的。

---

## 関連 plan / 履歴

- `docs/plans/2026-05-16_shares_delete_on_account_delete.md` — 本件 plan v2 (Phase A + Phase B、Resolved Decisions 含む)
- `memory/project_security_review_2026_05_14.md` — セキュリティレビュー全体記録 (4 パス + 8 項目)
- `memory/project_remaining_tasks_after_2026_05_09.md` — 公開前残タスク (ドメインバッチ、Sentry と一部重複)
- `memory/feedback_codex_review_flow.md` — plan → codex レビュー → 指摘反映 → ユーザー承認 → 実装フロー
- 直近 migration:
  - `20260518000001` (本件 Phase B)
  - `20260516000001` (PR10 Phase B: DROP delete_own_account)
  - `20260515000001`〜`20260515000002` (PR9 Phase 9a + 9b-3)
