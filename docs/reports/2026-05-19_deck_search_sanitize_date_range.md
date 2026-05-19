# 実装報告書: デッキ管理改善 + 期間指定保存 + 注意書き変更

**日付**: 2026-05-19
**担当**: Claude Code (codex 外部レビュー併用)
**ブランチ**: `dev` → `main` (本番反映済 + production DB migration 適用済)
**関連 plan**: `docs/plans/2026-05-18_deck_search_sanitize_date_range.md`

---

## 1. 実装サマリ

「使用デッキ管理」「分析」「対戦記録」周りの 5 件を 1 PR で実施:

1. **デッキ管理画面の検索改善**: 対戦記録の対面デッキ検索と同等の正規化 (NFKC + lowercase + ひらがな⇄カタカナ) を共通 helper 化し、dm/pokepoke 両方に適用
2. **デッキ名から全空白を恒久排除**: UI (3 ハンドラ × 2 ファイル) + Server actions (createDeck/updateDeck) + DB CHECK 制約の三層防御。チューニング名は scope 外で空白許容のまま
3. **既存 DB の `decks.name` / `battles.my_deck_name` から全空白削除 + 重複統合**: trigger 一時無効化 + 永続ログテーブル (audit/best effort 復旧用) + CHECK 制約追加
4. **期間指定の開始日をゲーム別 localStorage 保存**: `useDateRange()` hook 新設、URL は表示のみ (LS 不変) 方針
5. **使用デッキ管理画面の注意書き文言変更**: 共有先 (Discord サーバー) が分かる文言に

### レビューフロー (CLAUDE.md `feedback_codex_review_flow` 準拠)

1. ユーザー方針 review (5 項目スコープ確認)
2. `AskUserQuestion` 2 件 (重複統合方針 = archive / scope 外論点扱い)
3. Plan 起草 (`docs/plans/2026-05-18_deck_search_sanitize_date_range.md`)
4. `/review-plan-loop` 実行 (通算 5 反復、verdict GO 到達):
   - **Round 1** (3 iter): useDateRange signature mismatch / use_game_optional import path / handle_new_user regression / URL→LS書込 (judgment) / regexp_replace 全角空白未カバー / createDeck return signature regression / merge_map_table_persistence (judgment) / verification_query_regex_class_mismatch
   - **Round 2** (3 iter): archived_decks_not_cleaned / pokepoke_chip_registered_state_drift_after_sanitize / limitless_sync_row_field_name_mismatch / 最終 GO
5. codex 外部レビュー (4 点指摘 P1×3 + P2×1):
   - P1 rollback log 不足 / P1 deleted tuning row 復元不可 / P1 CTAS with CTE 構文エラー / P2 service_role grant 不足
   - rollback 精度を「audit only / best effort + pg_dump backup 前提」に softening (Resolved Decisions [rollback精度])
6. ユーザー追加 2 点:
   - §7.1 暗黙 transaction 弱める + §10.2.1 trigger 復旧 troubleshooting 新設
   - §10.3 backup 手順を Supabase 公式 docs ベース (pg_dump / supabase db dump 主経路)
7. `/review-plan-loop` 再起動 (2 iter): pokepoke_chip_registered_state_drift / limitless_sync_row_field_name_mismatch → GO
8. ユーザー承認 → 実装着手 → dev push → staging 適用 + 8 検証 → 本番反映 → production 適用 + 8 検証

---

## 2. main 本番反映 commit / production migration

### Commits
- **main merge commit**: `10aa1de`
- 内容 (dev → main 3 commits):
  - `aae1076 feat(decks): デッキ名空白削除 + 検索正規化 + 期間指定保存 + 注意書き変更` (本 PR メイン、18 files / 1490+ / 120-)
  - `31dabbd docs(plans): scope 外論点に (c) 対戦記録画面の自由入力対面デッキ名空白削除を追記`
  - `3b77b5a docs(reports): 2026-05-18 円グラフ・推移グラフ色分け改善の実装報告書を追加` (別件 docs only)

### Production migration
- **ファイル**: `supabase/migrations/20260519000001_decks_strip_whitespace_and_dedupe.sql` (293 行)
- **適用方法**: `npx supabase db push --db-url "$PROD_DB_URL" --include-all` (ユーザー手元実行)
- **適用結果**: 1 件のみ適用、`Finished supabase db push.` で正常終了
- **適用後 migration list**: `20260519000001` が Local / Remote 両方に登録
- **Production project ref**: `asjqtqxvwipqmtpcatvz` (duepure-tracker)
- **Staging project ref**: `uqndrkaxmbfjuiociuns` (duepure-tracker-staging)

### Migration 構成 (Step 0-11)
- Step 0: `battles_normalize_deck_names` trigger 一時無効化
- Step A: 重複検出 + keeper 選定 → 永続ログテーブル `_decks_merge_log_2026_05_18` (CTAS with CTE 構文)
- Step B: battles の `my_deck_id` を keeper に付け替え + `my_deck_name` 明示更新
- Step C: tuning 統合 (battles 付け替え + deck_tunings 移管 / 削除) → 永続ログテーブル `_tunings_merge_log_2026_05_18`
- Step D: duplicate deck を `is_archived=true` + name clean 化
- Step E: 残った全 decks の name を clean に揃える (**active + archived 両方**、CHECK 制約は全行評価のため)
- Step F: battles.my_deck_name を decks.name から再同期
- Step G: ログテーブル hardening (ENABLE RLS + REVOKE FROM PUBLIC/anon/authenticated + GRANT SELECT TO service_role)
- Step 9: handle_new_user() を空白削除入りに CREATE OR REPLACE (multi-game + name_ja 優先 + ORDER BY 保持)
- Step 10: CHECK 制約追加 (`decks_name_no_whitespace_check` / `battles_my_deck_name_no_whitespace_check`、統一パターン `'[[:space:]　​-‍﻿]'`)
- Step 11: trigger 再有効化

---

## 3. preflight と適用後検証結果

### Staging (project ref: `uqndrkaxmbfjuiociuns`)

#### Preflight (適用前)
| 項目 | 件数 |
|---|---|
| dirty_active_decks | 5 |
| dirty_archived_decks | 3 |
| dirty_decks_total | 8 |
| dirty_battles (my_deck_name snapshot) | 7 |
| 重複統合される deck 組数 | 0 |

#### 適用後検証 (8 項目すべて PASS)
1. ✅ dirty decks: 0 / 0 / 0 (active / archived / total)
2. ✅ dirty battles: 0
3. ✅ CHECK 制約 2 件登録、定義は `'[[:space:]　​-‍﻿]'::text`
4. ✅ ログテーブル 2 件 + RLS enabled + policy_count=0 + COMMENT
5. ✅ trigger `tgenabled='O'` (ENABLE)
6. ✅ handle_new_user 関数本体に `regexp_replace(COALESCE(odm.name_ja, odm.name), '[[:space:]　​-‍﻿]', '', 'g')` 含む、multi-game + ORDER BY 保持
7. ✅ ログテーブル行数: deck 0 / tuning 0 (重複統合 0 件のため)
8. ✅ 権限: anon/authenticated 出現なし、postgres/service_role のみ

### Production (project ref: `asjqtqxvwipqmtpcatvz`)

#### Preflight (適用前)
| 項目 | 件数 |
|---|---|
| dirty_active_decks | 17 |
| dirty_archived_decks | 6 |
| dirty_decks_total | 23 |
| dirty_battles (my_deck_name snapshot) | 12 |
| 重複統合される deck 組数 | 0 |

#### 適用後検証 (8 項目すべて PASS)
1. ✅ dirty decks: 0 / 0 / 0 (active 17 → 0 / archived 6 → 0 / total 23 → 0)
2. ✅ dirty battles: 0 (12 → 0)
3. ✅ CHECK 制約 2 件登録、定義は staging と同一
4. ✅ ログテーブル 2 件 + RLS enabled + policy_count=0 + COMMENT
5. ✅ trigger `tgenabled='O'` (ENABLE)
6. ✅ handle_new_user 関数本体は staging と完全に同一
7. ✅ ログテーブル行数: deck 0 / tuning 0 (重複統合 0 件のため)
8. ✅ 権限: staging と同じ hardening

### 共通の所見
- 両環境とも **重複統合は 0 件**: 内部空白入り deck はあったが、同 user / 同 game_title / 同 format 内で他に同名 active deck が存在せず、Step A-D の重複統合は no-op になった
- 主な変更は **Step E (純粋 rename) + Step F (snapshot 同期) + CHECK 制約追加**
- merge log テーブルは「将来の重複統合発生時のため」「audit 用途」として残置

---

## 4. Staging schema_migrations repair の経緯

### 発端
本 PR の staging 適用は MCP `apply_migration` を使用 (Claude セッションに `STAGING_DB_URL` 環境変数がなかったため緊急策)。これにより staging の `_supabase_migrations.schema_migrations` に **git ファイル名と異なる version** で記録された。後日 `supabase db push --include-all` を実行する際に、整合性問題が顕在化した。

### 不整合の内容

| Migration | git ファイル名 | Staging schema_migrations (修復前) | 不整合 |
|---|---|---|---|
| 本 PR | `20260519000001_decks_strip_whitespace_and_dedupe.sql` | `20260518232423 decks_strip_whitespace_and_dedupe` | MCP 適用時刻 UTC ベース |
| 既存 (本 PR 外) | `20260518000001_shares_user_id_cascade.sql` | `20260518075515 shares_user_id_cascade` | 過去の MCP/Dashboard 由来 |

→ staging で `supabase db push` を試した時、両方の不整合が原因で「Remote migration versions not found in local migrations directory」エラー。

### 解消手順 (`supabase migration repair` 正規ルート、ユーザー手元実行)

```bash
# 本 PR 分: MCP 適用 timestamp を reverted、git timestamp を applied
npm_config_cache=/private/tmp/npm-cache npx supabase migration repair 20260518232423 --status reverted --db-url "$STAGING_DB_URL"
npm_config_cache=/private/tmp/npm-cache npx supabase migration repair 20260519000001 --status applied --db-url "$STAGING_DB_URL"

# 既存 shares_user_id_cascade 分: 同様
npm_config_cache=/private/tmp/npm-cache npx supabase migration repair 20260518075515 --status reverted --db-url "$STAGING_DB_URL"
npm_config_cache=/private/tmp/npm-cache npx supabase migration repair 20260518000001 --status applied --db-url "$STAGING_DB_URL"

# 確認
npm_config_cache=/private/tmp/npm-cache npx supabase migration list --db-url "$STAGING_DB_URL"
# 期待: Local = Remote すべて一致

npm_config_cache=/private/tmp/npm-cache npx supabase db push --db-url "$STAGING_DB_URL" --include-all
# 期待: "Remote database is up to date." (適用なし)
```

→ 4 コマンドすべて成功、最終的に staging の schema_migrations は git と完全一致。

### Production 側の状況
Production schema_migrations では `20260518000001 shares_user_id_cascade` が **git timestamp と一致** していたため、repair 不要。`20260519000001` を直接 `supabase db push` で適用するだけで整合した。これは production が過去から CLI 正規ルートで運用されてきた証拠。

### 教訓
- ad-hoc な MCP `apply_migration` は version mismatch を発生させるため、**production には絶対使わない**。staging でも避けるべき
- Supabase Dashboard 経由の DDL 適用も同様の理由で要注意
- 今後の DB migration は `supabase db push --db-url ...` を **正規ルート**として運用
- 緊急で MCP を使った場合は、適用直後に `supabase migration repair` で git timestamp に揃える

---

## 5. Rollback 方針 (Resolved Decisions [rollback精度] 通り)

### Merge log テーブルの位置付け
- `public._decks_merge_log_2026_05_18`: `(duplicate_id, keeper_id, cleaned_name)`
- `public._tunings_merge_log_2026_05_18`: `(dup_tuning_id, dup_deck_id, keeper_id, dup_tuning_name, keeper_tuning_id)`
- **用途**: audit / 事故調査 / best effort 部分復旧 (例: 特定 user の特定 deck のみ unarchive する手動 SQL)
- **完全 rollback は不可能**: per-battle log や deleted tuning row の full dump (sort_order / created_at / game_title) は意図的に保存していない (運用負荷・DB 容量増を回避するため、Resolved Decisions [rollback精度] で決定)

### 完全 rollback が必要な場合
- migration 適用前に取得した **`pg_dump` または `supabase db dump --linked -f backup-YYYYMMDD.sql` から restore する** 前提
- 本 PR の production 適用前に backup 取得済 (ユーザー実施)
- Supabase Dashboard / PITR の利用可否は project plan 次第 (`https://supabase.com/docs/guides/platform/backups` を事前確認するルール)

### Migration 失敗時の Troubleshooting (適用後 trigger 状態確認、結果問題なし)
本 migration は trigger 一時無効化に依存するため、適用後に念のため trigger 状態を確認する:
```sql
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid = 'public.battles'::regclass
  AND tgname = 'battles_normalize_deck_names';
-- 'O' なら enabled (正常)、'D' なら disabled (要 rescue)
```

Rescue (DISABLE のまま残った場合):
```sql
ALTER TABLE public.battles ENABLE TRIGGER battles_normalize_deck_names;
```

→ staging / production とも `tgenabled='O'` で正常。実行不要だった。

---

## 6. 既知の後続課題

### (c) 対戦記録画面の自由入力対面デッキ名の空白削除
- **発覚**: 2026-05-19 dev preview 実機確認
- **現状**:
  - 「使用デッキ管理」の自由入力 (dm/pokepoke `DeckList.tsx`) は本 PR で `stripAllWhitespace` 適用済 ✅
  - 「対戦記録」画面の対面デッキ名自由入力は空白が入る状態のまま ❌
- **設計上の注意点 (別 PR で扱う理由)**: 自由入力した対面デッキ名のみ sanitize する必要がある。既存 suggestion / Limitless 由来の候補 (英語内部キー `opponent_deck_master.name` / `name_en`) をタップした場合は **空白を残し内部キーをそのまま保存** する必要がある (Limitless 取り込みの「`name_ja` のみ空白削除、`name` / `name_en` は触らない」設計と揃える)
- **修正範囲案**:
  - 対戦記録画面の対面デッキ入力ハンドラ (`BattleRecordForm.tsx` or `OpponentDeckSelector.tsx` 経由) で自由入力フローと suggestion タップフローを分岐し、自由入力フローのみ sanitize
  - `auto_add_opponent_deck` trigger / `addOpponentDeck` admin action との整合 (`name_en` 不変で `name_ja` のみ空白削除する Limitless パターンと揃える)
  - `battles.opponent_deck_name` の CHECK 制約 (`opponent_deck_name !~ '[[:space:]　​-‍﻿]'`) を追加するなら、既存全データ cleanup 用の別 migration が必要 (Limitless suggestion 由来データの英語キーには空白が含まれないので影響は限定的)
- **Plan**: 別 plan で起草予定。今回の `docs/plans/2026-05-18_deck_search_sanitize_date_range.md` §13 (c) に詳細記載

### scope 外で既存に残った別件 (参考)
本 PR の plan §13 (a)(b) として記録済み、別 PR で対応:
- (a) `MyDeckStatsSection` / `OpponentDeckStatsSection` の `router.push` で game prefix 抜け
- (b) pokepoke `handleChipCreate` が label (表示名) を渡している (本 PR では既存挙動を維持しつつ sanitizer + isRegistered 判定だけ通した)

---

## 7. 今後の運用メモ

### Merge log テーブルの扱い

| 項目 | 内容 |
|---|---|
| 場所 | `public._decks_merge_log_2026_05_18` / `public._tunings_merge_log_2026_05_18` |
| 行数 (staging / production) | 0 / 0 (両環境とも重複統合 0 件のため) |
| 権限 | ENABLE RLS + RLS policy 0 + REVOKE FROM PUBLIC/anon/authenticated + GRANT SELECT TO service_role |
| 用途 | audit / 事故調査 (本 PR の clean 効果確認) / best effort 部分復旧 (将来の特殊復旧シナリオ) |
| COMMENT | テーブルに付与済 (DROP 前に `pg_catalog.obj_description` で確認できる) |

### 30 日後 DROP 検討 (推奨運用)
- 行数 0 のためストレージ負荷は無視できるレベル
- ただし「migration history の audit 視点」と「将来の重複統合発生時の再利用」のバランスを取り、**30 日経過後に DROP するのが推奨運用**
- DROP migration の例 (将来別 PR で適用):
  ```sql
  -- e.g. supabase/migrations/20260618000001_drop_merge_logs.sql
  DROP TABLE IF EXISTS public._decks_merge_log_2026_05_18;
  DROP TABLE IF EXISTS public._tunings_merge_log_2026_05_18;
  ```
- ※ もし行数が 0 でない (= 重複統合が実際に発生していた) 環境では、運用上必要なくなる時点まで保持期間を延長してもよい
- 本 PR の場合は両環境とも 0 行なので、30 日後の DROP 候補 (2026-06-18 以降)

### Schema_migrations 整合性運用 (新規ルール、本 PR の経験から策定)
- **今後は production / staging とも `supabase db push --db-url ...` を正規ルートとして運用**
- 緊急時に MCP `apply_migration` を使う場合は、適用直後に `supabase migration repair` で git timestamp に揃える運用を徹底
- ad-hoc な Dashboard 経由の DDL も同様の問題を起こすため避ける
- staging を `supabase db pull` で再生成する案もあるが、データ消失の影響が大きいので最終手段

### Resolved Decisions (Plan に永続化済、本 PR で確定)
1. **[URL→LS書込]** URL は表示のみ (LS 不変) — 共有リンク経由で他人の期間を一度見ただけで自分のゲーム別作業期間がリセットされる事故を防止
2. **[merge log保存]** 永続テーブル (`_decks_merge_log_2026_05_18` / `_tunings_merge_log_2026_05_18`) で audit / best effort 復旧用、RLS hardened
3. **[rollback精度]** audit only / best effort + pg_dump backup 前提に softening — per-battle log や DELETE 済 tuning row の full dump は作らない方針 (運用負荷・DB 容量増を回避)

---

## 関連リソース

- Plan: [`docs/plans/2026-05-18_deck_search_sanitize_date_range.md`](../plans/2026-05-18_deck_search_sanitize_date_range.md)
- Migration: `supabase/migrations/20260519000001_decks_strip_whitespace_and_dedupe.sql`
- main merge commit: `10aa1de`
- 本 PR メイン commit: `aae1076`
- Staging project ref: `uqndrkaxmbfjuiociuns` (duepure-tracker-staging)
- Production project ref: `asjqtqxvwipqmtpcatvz` (duepure-tracker)
- Cloudflare 本番 URL: `https://duepure-tracker.jianrenzhongtian7.workers.dev`
- Cloudflare dev preview URL: `https://dev-duepure-tracker.jianrenzhongtian7.workers.dev`
