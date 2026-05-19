# 実装報告書: opponent_deck_master.name を空白なし日本語正式名に統一

**日付**: 2026-05-19
**担当**: Claude Code (codex 外部レビュー併用 + dev preview 手動検証)
**ブランチ**: `dev` → `main` (本番反映済 + production DB migration 適用済)
**関連 plan**: `docs/plans/2026-05-19_opponent_deck_name_canonicalization.md`

---

## 1. 実装サマリ

`opponent_deck_master.name` のソース横断不一致 (Limitless = 英語名、manual = 空白入り日本語名、admin 編集後 = 空白なし日本語名) を「全ソース共通: stripAllWhitespace(日本語正式名)」に統一する大規模リファクタリング。`displayDeckName` / `getOpponentDeckNameMap` / `OpponentDeckNameMap` 経由の動的ラベル変換を廃止し、UI/API/DB の全層で `opponent_deck_master.name` をそのまま「アプリ内正式名」として扱う方針へ移行。

### 主な変更点
1. **TS 入力経路の全方位 sanitize**: `recordBattle` / `updateBattle` / `addOpponentDeck` / `updateOpponentDeck` / `BattleRecordForm` / `EditBattleModal` を `stripAllWhitespace` 必須化
2. **`apply_limitless_snapshot` を slug primary + name_en fallback + admin 手動優先 + collision pre-check 仕様で書き換え**
3. **新規 SECURITY DEFINER RPC `admin_update_opponent_deck_name_ja`** (admin 画面の和名編集を 1 transaction で完結、battles 同期 UPDATE 含む)
4. **既存 DB データ正規化** (Phase E1-E5: 衝突 case の battles 統合 + opponent_deck_master の name 空白削除 + battles.opponent_deck_name 連動)
5. **空白禁止 CHECK 制約追加** (`opponent_deck_master.name` / `battles.opponent_deck_name`)
6. **`displayDeckName` 関連シンボル完全撤去** (19 caller + 1 本体 = 20 ファイル、`src/lib/actions/opponent-deck-display.ts` 削除)
7. **admin 和名空欄フォーカスアウト時の翻訳再生成** (追加修正、後述 §6)

### レビュー / 反復フロー (CLAUDE.md `feedback_codex_review_flow` 準拠)
1. `AskUserQuestion` 4 ラウンド (撤去戦略 / 衝突時挙動 / name 再計算規則 / 互換期間)
2. Plan 起草 (`docs/plans/2026-05-19_opponent_deck_name_canonicalization.md` 1139 行)
3. `/review-plan-loop` 通算 5+ 反復 (mechanical 修正 + judgment escalate)
4. **Codex 外部レビュー 3 ラウンド**: 累計 12 件指摘
   - Round 1: 6 件 (P1-P6) → 反映
   - Round 2: 3 件 (P1-P3) → 反映
   - Round 3: 3 件 (types/§9.4/rollback) → 反映
   - Round 4: GO + 任意メモ 1 件 (`trim(coalesce(p_name_ja, ''))` null 防御) → 反映
5. ユーザー承認 → 実装着手 → dev push → staging 適用 + 検証 → 本番反映 → production 適用 + 検証
6. dev preview 手動検証で admin 和名挙動の **追加要求** (空欄解除時に翻訳再生成) → 追加 migration + UI 修正 → 再度 staging/preview/production まで通す

---

## 2. main 本番反映 commit / production migration

### Commits (dev → main、main merge `18ff92e`)
- `7e4c550 feat(opponent-deck): admin 和名空欄→翻訳再生成 + name 同期` (追加修正、4 files / +244 -13)
- `6d86dae feat(opponent-deck): opponent_deck_master.name を空白なし日本語正式名に統一` (本 PR メイン、26 files / +1748 -254)

### Production migration
- **適用ファイル**: 2 本
  - `supabase/migrations/20260519000002_canonicalize_opponent_deck_name.sql` (507 行: Phase E1-E5 + apply_limitless_snapshot 改修 + admin RPC 初版 + Phase C7-C8 CHECK 制約)
  - `supabase/migrations/20260519000003_admin_rpc_explicit_is_manual.sql` (160 行: admin RPC を 3 引数版に拡張 + Returns 拡張)
- **適用方法**: `npx supabase db push --db-url "$PROD_DB_URL" --include-all` (ユーザー手元実行)
- **適用結果**: 2 件正常適用、`migration list` で両方が Local / Remote 両方に登録
- **適用前バックアップ**: ユーザー手元で `backup-prod-20260519-151906-{roles,schema,data}.sql` 取得済
- **Production project ref**: `asjqtqxvwipqmtpcatvz`
- **Staging project ref**: `uqndrkaxmbfjuiociuns`

---

## 3. 設計の核 (Resolved Decisions)

| 論点 | 採択 | 根拠 |
|---|---|---|
| **撤去戦略** | TS シンボル一括撤去 + DB column も同 PR で正規化 | 互換期間なしで足元の不整合を解消する方針 |
| **衝突時挙動** | 全体 abort + RAISE EXCEPTION (transaction rollback) | 自動マージは battles の WLD 集計を壊すリスク大、admin 手動 merge を求める方が安全 |
| **name 再計算規則** | `name_ja_is_manual=true` の行は admin 手動を優先 (payload 無視) | Limitless 翻訳辞書未収載の固有名詞を admin が手で直した結果を上書きさせない |
| **互換期間** | なし (本 PR で TS + DB 同時切替) | 互換 view / dual-write 等の overhead を避ける、staging で十分検証可能 |
| **空欄フォーカスアウト時の挙動** | name_en があれば translateDeckName で再翻訳 → is_manual=false。name_en 無しはキャンセル + アラート | dev preview レビューで「現状の name_ja=NULL は『未翻訳状態』を露出させ UX が悪い」と確定 |
| **fallback 規則 (translateDeckName が null)** | name_ja = name_en (Limitless 同期 fallback と一致) | 「自動取得値だが未翻訳」を一貫表現 |
| **rollback 精度** | audit only / best effort + pg_dump backup 前提 | 完全 rollback を保証する DDL は規模が膨らみ過ぎる、運用で吸収 |

---

## 4. Migration 構成詳細

### `20260519000002` (Phase E1-E6 + Phase C7-C8)

| Phase | 目的 | 影響 |
|---|---|---|
| **E1** | 衝突 case 事前 battles merge (`Mega Altaria ex Igglybuff` 等 → `メガチルタリスexププリン`) | battles 5 件 UPDATE |
| **E2** | 衝突 manual 行 DELETE (E3 の UNIQUE 制約衝突回避) | opponent_deck_master 1 件 DELETE |
| **E3** | Limitless 由来行 (`source='limitless'`) の name を `stripAllWhitespace(COALESCE(name_ja, name_en))` に正規化 | opponent_deck_master 104 件 UPDATE |
| **E4** | manual 由来行 (`source='manual'`) の空白を含む name を正規化 | opponent_deck_master 1 件 UPDATE (pokepoke RANKED「アローラキュウコンex シザリガー」) |
| **E5** | battles.opponent_deck_name を全体正規化 (name_en 一致 → master.name / master.name 直接一致 / 自由入力は stripAllWhitespace のみ) | battles 74 件 UPDATE |
| **E6** | `apply_limitless_snapshot` CREATE OR REPLACE: slug primary + name_en fallback + admin 手動優先 + collision pre-check + v_name_changes battles 同期 UPDATE | 関数定義差し替え |
| **admin RPC** | `admin_update_opponent_deck_name_ja(uuid, text)` 初版 (旧シグネチャ、20260519000003 で DROP) | SECURITY DEFINER + admin 判定 + 衝突 pre-check + battles 同期 UPDATE |
| **C7** | `opponent_deck_master.name !~ '[[:space:]　​-‍﻿]'` CHECK 制約追加 | 以後 INSERT/UPDATE で空白禁止 |
| **C8** | `battles.opponent_deck_name !~ '[[:space:]　​-‍﻿]'` CHECK 制約追加 | 同上 |

### `20260519000003` (admin RPC を 3 引数版に拡張)
- 旧 `admin_update_opponent_deck_name_ja(uuid, text)` を **DROP**
- 新 `admin_update_opponent_deck_name_ja(uuid, text, boolean DEFAULT true)` を CREATE
- **Returns jsonb 拡張**: `updated_name`, `old_name`, `name_ja`, `name_ja_is_manual`, `battles_synced`, `cleared`
- **挙動**:
  - `p_name_ja` 非空: `name = stripAllWhitespace(p_name_ja)`, `name_ja = trim(p_name_ja)`, `name_ja_is_manual = p_is_manual`
  - `p_name_ja` 空 + `p_is_manual=true`: 旧 manual override 解除 (`name_ja=NULL`, `is_manual=false`, `name` 不変)
  - `p_name_ja` 空 + `p_is_manual=false`: **invalid (RAISE)** — auto 経路は server action 側で再翻訳して詰め直す前提

---

## 5. Staging 検証結果 (適用前後)

### Preflight (適用前 staging)
| 項目 | 件数 |
|---|---|
| opponent_deck_master_total | 105 |
| opponent_deck_master_name_has_whitespace | 71 |
| battles_total | 286 |
| battles_opponent_name_has_whitespace | 38 |

### Phase E4 で発生した衝突 (staging のみ)
- `バルカ　ディアス` (全角空白入りテストデータ) が既存 `バルカディアス` と Phase E4 後に衝突 → UNIQUE violation で migration ROLLBACK
- **解消**: staging で `バルカ　ディアス` の battles 1 件を `バルカディアス` に統合 + opponent_deck_master の `バルカ　ディアス` 行を DELETE → migration 再 apply 成功
- **production には同等のテストデータ無し** (dry-run check #1 で確認)

### 適用後 staging
| 項目 | 件数 |
|---|---|
| opponent_deck_master_name_has_whitespace | **0** |
| battles_opponent_name_has_whitespace | **0** |
| admin_update_opponent_deck_name_ja 3 引数版 | ✅ |
| CHECK 制約 (opponent_deck_master / battles) | ✅ 両方 |

---

## 6. 追加修正 (dev preview レビュー反映)

### 経緯
dev preview の admin 画面実機検証で、空欄フォーカスアウト時の旧挙動 (`name_ja=NULL` で「未翻訳状態」を露出) が UX 上望ましくないと判明。希望挙動:
- 名前欄が空になったら `translateDeckName(name_en)` で再翻訳して name_ja に保存し直し、`name_ja_is_manual=false` に戻す
- name は再生成後の `stripAllWhitespace(name_ja)` に同期、battles も同期 UPDATE
- name_en が無い行はキャンセル + アラート (操作前値に戻す)
- 辞書未ヒットなら fallback: name_ja = name_en (Limitless 同期 fallback と一致)

### 実装
- **新 migration `20260519000003_admin_rpc_explicit_is_manual.sql`**:
  - RPC を 3 引数版 `(p_id, p_name_ja, p_is_manual DEFAULT true)` に拡張
  - Returns jsonb に `name_ja` / `name_ja_is_manual` を追加 (UI ローカル state 同期用)
- **`src/lib/actions/admin-actions.ts`**:
  - `MissingNameEnError` クラス export
  - `updateOpponentDeckNameJa` を空入力分岐対応 (再翻訳 + null fallback + name_en 無しエラー)
- **`src/components/admin/OpponentDeckManager.tsx`**:
  - `handleNameJaBlur` を RPC 戻り値で `decks` / `statsDecks` の `name` も同期
  - `MissingNameEnError` catch でユーザー通知 + 編集 state 破棄

### dev preview 実機確認結果 (ユーザー報告)
- ✅ 和名を手動変更すると「手動」表示が出る
- ✅ 和名欄を空にしてフォーカスアウトすると自動翻訳和名に戻る
- ✅ 「手動」表示が消える
- ✅ 主表示が英語名にならない
- (省略) name_en 無し manual 行 — production に該当データ無し
- (省略) translateDeckName 戻り値 null — production に該当データ無し

---

## 7. Production 適用前 dry-run (Claude が Supabase MCP で実施)

### 衝突候補抽出 (Phase E3+E4 後の name 重複)
| 観点 | 件数 |
|---|---|
| normalized name の (format, game_title) 内重複 | **0** |
| 正規化後 name が空文字になる行 | **0** |
| Phase E5 後 battles.opponent_deck_name に空白が残る行 | **0** |

### 影響範囲予測 (production)
| 項目 | 件数 |
|---|---|
| opponent_deck_master_total | 151 (Limitless 104 / manual 47) |
| opponent_deck_master_name_has_whitespace | 105 → 0 |
| battles_total | 429 |
| battles_opponent_name_has_whitespace | 74 → 0 |
| Phase E1 で書き換わる battles | 5 件 |
| Phase E2 で DELETE される opponent_deck_master | 1 件 |

---

## 8. Production 適用後検証 (Claude が Supabase MCP で実施)

| # | 検証項目 | 結果 |
|---|---|---|
| 1 | migration list (両方 Remote) | ✅ `20260519000002` / `20260519000003` 登録済 |
| 2 | admin RPC シグネチャ `(uuid, text, boolean)` + SECURITY DEFINER | ✅ 3 引数版のみ存在 |
| 3 | apply_limitless_snapshot 新仕様 (slug primary / manual priority / collision check / NULLIF 防御) | ✅ 4 項目すべて埋め込み確認 |
| 4 | CHECK 制約 (opponent_deck_master / battles) | ✅ 両方存在 |
| 5a | opponent_deck_master.name に空白を含む行 | ✅ **0 件** (105 → 0) |
| 5b | battles.opponent_deck_name に空白を含む行 | ✅ **0 件** (74 → 0) |
| 5c | opponent_deck_master_total (Phase E2 で 1 件削除) | ✅ 151 → 150 |
| 5d | battles_total (UPDATE のみ、INSERT/DELETE なし) | ✅ 429 維持 |
| 5e | Phase E1 統合後の battles (`メガチルタリスexププリン` 5 件) | ✅ 5 件で集計 |
| 6 | admin RPC GRANT (authenticated/postgres/service_role 付与、anon 非付与) | ✅ 正しい権限 |

### 適用後 master/battles の総合 health-check
```sql
-- ALL ZERO ✅
opponent_deck_master_name_has_whitespace = 0
battles_opponent_name_has_whitespace = 0
phase_e1_target_remaining = 0
phase_e2_target_remaining = 0
```

---

## 9. Claude 検証完了項目 / ユーザー検証完了項目

### Claude が自前で完了 (CLAUDE.md `feedback_self_verification` 準拠)
- staging migration apply 成功 (衝突 1 件は pre-cleanup で解消)
- types 再生成 (`p_is_manual?: boolean` 反映)
- `npx tsc --noEmit` PASS
- `npx opennextjs-cloudflare build` PASS
- `rg displayDeckName|getOpponentDeckNameMap|OpponentDeckNameMap src/` 残存ゼロ
- lint: 新規 error/warning 増加なし (既存問題のみ残存)
- production 本番 HTTP 200 / `x-opennext: 1` / `cf-ray` 確認
- production DB 適用前 dry-run × 3 観点ゼロ
- production DB 適用後検証 × 6 観点 PASS

### ユーザー実機確認 (dev preview)
- ✅ 対戦記録: 自由入力対面デッキ名に全角/半角空白を含めて保存 → DB に空白なしで格納
- ✅ 統計画面: Limitless 由来の対面デッキ名が空白なし日本語名で表示
- ✅ admin 和名 inline 編集の手動入力: 「手動」表示が出る
- ✅ admin 和名 inline 編集の空欄解除: 自動翻訳和名で再生成、手動表示消える、主表示は英語に戻らない
- (該当データなしでスキップ) admin manual 行で name_en 無し / translateDeckName null

---

## 10. 残課題 / 後続タスク

なし。本 PR で displayDeckName/getOpponentDeckNameMap/OpponentDeckNameMap 撤去、TS 入力経路 sanitize、admin RPC 拡張、DB 正規化 + CHECK 制約、admin 和名空欄翻訳再生成、production 適用までを完全クローズ。

---

## 11. 参考リンク

- **Plan**: `docs/plans/2026-05-19_opponent_deck_name_canonicalization.md`
- **Migration**:
  - `supabase/migrations/20260519000002_canonicalize_opponent_deck_name.sql`
  - `supabase/migrations/20260519000003_admin_rpc_explicit_is_manual.sql`
- **main merge commit**: `18ff92e`
- **dev → main commits**: `6d86dae` (本 PR メイン), `7e4c550` (admin 和名空欄追加修正)
