# 実装報告書: 公開前 DB Hardening (PR1 / PR2 / PR3)

**日付**: 2026-05-11 (Mon)
**担当**: Claude Code (codex 外部レビュー併用)
**ブランチ**: `dev` → `main` (本番反映済)
**関連 plan**: `docs/plans/2026-05-11_db_hardening_pre_public.md`

---

## 概要

公開前ハードニングとして、Supabase Advisor (Performance & Security Lints) の警告を 3 PR に分割してまとめて解消した。Supabase production / staging 両 DB の CSV スナップショットを起点に、`unindexed_foreign_keys` / `auth_rls_initplan` / `multiple_permissive_policies` の 3 大警告と、設計意図の明文化 (`discord_oauth_states` COMMENT) と membership oracle 縮小 (`is_team_member` hardening) を同日に処理。

PR1/PR2 は低リスクのため staging 確認後すぐ本番反映、PR3 は破壊リスクが高いため staging で広範な実機確認 (Google/X ログイン / X・Discord 連携 / チーム表示 / 統計 / admin 等) を経てから本番反映した。

---

## レビューフロー

CLAUDE.md / memory `feedback_codex_review_flow` に従い、plan-critic と codex の往復で plan を磨いてから実装:

1. plan 初版作成 (`docs/plans/2026-05-11_db_hardening_pre_public.md`、Supabase Advisor CSV 4 件を起点)
2. plan-critic (`/review-plan-loop`) で 3 ラウンド検証 → 計 14 件 mechanical 自動修正 + 5 件 judgment escalate (Resolved Decisions 化)
3. codex 1 回目レビュー → 設計上の致命的指摘 4 点を mechanical 修正:
   - is_team_member REVOKE で RLS policy が破綻するリスク → Migration 5 に RLS policy swap (is_my_team_member) を追加
   - FOR ALL の admin policy を素朴に DROP すると admin write が消失するリスク → admin INSERT/UPDATE/DELETE policy 3 本を明示
   - Migration 2 SQL 例が battles INSERT/UPDATE の深層防御 WITH CHECK を欠落 → 完全保持に書き直し
   - deck_tunings の FOR ALL を OR 統合すると privilege escalation → SELECT consolidated + 所有者ベース 3 本に分割
4. codex 2 回目レビュー指摘を反映 (5 件、auth_leaked_password_protection / `npm run cf-typegen` 誤り / CREATE INDEX ロック挙動 / multiple_permissive_policies の件数 36→37 / is_my_team_member SECDEF 残存許容)
5. codex 3 回目レビュー指摘を反映 (staging CSV 比較追加、unused_index 件数差、auth_leaked / Lint Exception 最終調整)
6. plan-critic 最終 GO → ユーザー承認 → PR1 実装着手
7. PR1 staging OK → 本番反映 → PR2 着手 → staging OK → 本番反映 → PR3 着手 (順次)

---

## 実装した commits (dev → main)

| Commit | Message | 内容 |
|---|---|---|
| `a686190` | feat(db): PR1 hardening - FK indexes + discord_oauth_states comment | PR1 dev push |
| `9cfad80` | Merge dev into main: PR1 DB hardening | PR1 main 反映 |
| `d64a74d` | feat(db): PR2 hardening - RLS auth.uid() initplan wrap | PR2 dev push |
| `936f107` | Merge dev into main: PR2 DB hardening | PR2 main 反映 |
| `7f4a88d` | feat(db): PR3 hardening - admin SELECT consolidation + is_team_member oracle reduction | PR3 dev push |
| `73fd43f` | Merge dev into main: PR3 DB hardening | PR3 main 反映 |

main 反映: 3 ラウンド (PR1 → PR2 → PR3)。DB push: 3 ラウンド (staging → production 各回)。

---

## 変更ファイル

### 新規 migration (5 ファイル)

- `supabase/migrations/20260511000001_fk_indexes.sql` — Advisor `unindexed_foreign_keys` 警告 8 件への対応
  - detection_alerts(resolved_by, user_id) / feedback(user_id) / quality_admin_bonus(granted_by) / shares(user_id) / team_members(user_id) / user_stage_history(changed_by, user_id) に btree index 追加
  - すべて `IF NOT EXISTS` で冪等化、index 名は `<table>_<column>_idx` で統一

- `supabase/migrations/20260511000002_discord_oauth_states_comment.sql` — `COMMENT ON TABLE` で設計意図を DB カタログに記録
  - "RLS enabled with no policy intentionally: service_role 経由のみアクセスする Discord OAuth state nonce テーブル。anon/authenticated は REVOKE ALL で二重拒否。"
  - Advisor INFO は scan で残る可能性を許容 (Dashboard Lint Exception は使わない)

- `supabase/migrations/20260511000003_rls_auth_init_plan.sql` — Advisor `auth_rls_initplan` 警告 34 件への対応
  - 18 テーブル / 34 policy の `auth.uid()` を `(SELECT auth.uid())` でラップ (initplan 最適化、挙動互換)
  - 既存深層防御 (battles INSERT/UPDATE の decks/opponent_deck_settings/tuning_id EXISTS、decks INSERT/UPDATE の opponent_deck_settings EXISTS、deck_tunings の決定的 EXISTS) を完全保持
  - `TO authenticated` 句保持 (feedback / opponent_deck_settings)
  - team_members / teams の `is_team_member()` ガード版は Migration 5 で再上書きする前提で一旦維持

- `supabase/migrations/20260511000004_consolidate_admin_select_policies.sql` — Advisor `multiple_permissive_policies` 警告 37 件への対応
  - battles / decks / profiles / feedback: admin_select_* (FOR SELECT) を user SELECT policy に `OR (SELECT public.is_admin_user())` で統合
  - deck_tunings: FOR ALL を 4 policies (SELECT consolidated + 所有者 INSERT/UPDATE/DELETE) に分割 (privilege escalation 防止)
  - quality_score_snapshots / quality_scoring_settings: FOR ALL admin policy を DROP し、SELECT consolidated + admin INSERT/UPDATE/DELETE 3 本に分割 (admin write 経路保持)
  - `user_read_premium_ui_setting` の `key = 'premium_ui_visible'` フィルタ保持

- `supabase/migrations/20260511000005_is_team_member_hardening.sql` — membership oracle 縮小
  - `public.is_my_team_member(p_team_id uuid)` を新設 (自己限定 SECDEF wrapper、内部で `auth.uid()` 参照)
  - team_members / teams の RLS policy を `is_team_member(team_id, auth.uid())` から `is_my_team_member(team_id)` に切替
  - `is_team_member(uuid, uuid)` の authenticated 直 EXECUTE を REVOKE (Team RPC 8 本の SECDEF 内部呼び出しは owner 権限で機能維持)

### .gitignore
- `.tmp/` を追加 (Supabase Advisor CSV 等のローカル一時ファイル)

### docs
- `docs/plans/2026-05-11_db_hardening_pre_public.md` (plan 文書、約 700 行)

---

## 確認結果

### Supabase Advisor (production / staging) 推移

| 警告タイプ | Before (PR1 前) | After (PR3 後) | 担当 PR |
|---|---|---|---|
| `unindexed_foreign_keys` | 8 件 | **0 件** | PR1 |
| `auth_rls_initplan` | 34 件 | **0 件** | PR2 |
| `multiple_permissive_policies` | production 37 / staging 31 | **0 件** | PR3 |
| `authenticated_security_definer_function_executable` | 33 件 | 34 件 (is_my_team_member 追加、意図通り) | — |
| `rls_enabled_no_policy on discord_oauth_states` | 1 件 (INFO) | 1 件 (INFO、COMMENT 記録済) | — |
| `auth_leaked_password_protection` | 1 件 (WARN) | 1 件 (Email provider 本格運用時に再検討) | — |
| `unused_index` | production 2 / staging 4 | 同左 (公開後 1 ヶ月で再評価) | — |

production 最終 Linter 結果: **Errors 0 / Warnings 0 / Info 10 (Unused Index のみ)**。

### staging 実機確認 (PR3 後、ユーザー実施)
- Google ログイン / X ログイン
- X 連携表示 / Discord 連携表示
- デッキ一覧 / 対戦入力・編集・削除
- 個人統計 / 全体統計 / チーム一覧 / メンバー一覧 / チーム統計
- admin 画面 (ユーザー一覧 / 詳細 / stage 更新 / feedback 一覧)

全項目で破壊なし。

### Cloudflare Workers 本番デプロイ
- PR1 main 反映後: 3 分間 HTTP 200 安定 (`a686190` → `9cfad80`)
- PR2 main 反映後: 3 分間 HTTP 200 安定 (`d64a74d` → `936f107`)
- PR3 main 反映後: 3 分間 HTTP 200 安定 (`7f4a88d` → `73fd43f`)
- 3 PR とも TS コード変更なし (SQL 単独) のため機能影響なし

---

## Resolved Decisions (plan 文書から)

| 項目 | 決定内容 |
|---|---|
| is_admin REVOKE | 現状維持 (admin 系 RLS が壊れる可能性、authenticated GRANT は意図的な例外) |
| team_member | wrapper 新設 + REVOKE (is_my_team_member 自己限定版、Migration 5) |
| PR 分割 | 3 PR 分割 (PR1=FK index、PR2=auth_rls_initplan、PR3=multiple permissive + is_team_member) |
| unused index | 公開後に再評価 (production 利用統計 1 ヶ月分待ち) |
| lint silence | SQL COMMENT 追加 (Dashboard Lint Exception は使わない、Advisor INFO 残存許容) |
| 適用タイミング | PR1/2 即時 + PR3 慎重 (PR1/2 は staging 確認後すぐ本番、PR3 のみ広範な実機確認後) |
| auth_leaked_password | 今回は保留 (Email provider / Email ログイン本格運用時に再検討) |

---

## 残作業 / 今後の課題

### 期限のあるフォロー
- **公開後 1 ヶ月程度**: production の index 使用統計を確認し、`unused_index` 警告 (`idx_feedback_status_created_at`, `alerts_game_idx`、staging のみ `idx_battles_tuning_id`, `idx_shares_created_at`) の DROP 可否を再判定する。staging の使用統計は低トラフィックで信頼性低のため、production 統計をベースにする。

### 期限のないフォロー
- **Email provider 本格運用検討時**: Supabase Auth → Providers → Email → `Enable leaked password protection` を ON にする (公式 docs: <https://supabase.com/docs/guides/auth/password-security>)。今回は SMTP / template 等の本格運用判断と一緒に持ち越し。

### 公開ブロッカーへの影響
- 公開前 hardening の Advisor スコアは想定通り `Errors 0 / Warnings 0` に到達。
- 既存 memory `project_remaining_tasks_after_2026_05_09` の残タスクには影響なし (DB hardening は別軸の作業)。

---

## メモリ更新

特になし。本作業のレビューフロー / コーディング方針 / 検証セルフサービス化はすべて既存の `feedback_codex_review_flow` / `feedback_self_verification` / `feedback_db_migration_order` / `feedback_verify_external_ui_with_docs` で既に保存済の方針通りに実行できた。
