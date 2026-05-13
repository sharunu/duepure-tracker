# 2026-05-13 database.types.ts 最新化

## 目的
PR4〜PR10 (Phase 2 hardening、2026-05-12〜13 本番反映済) で DB に追加された entity を
`src/lib/supabase/database.types.ts` に反映する。同時に、型不在のために置いていた
キャスト workaround のうち、PR7/PR9 起因のものを除去する。

これは Phase 2 hardening の「後片付け」であり、機能変更や DB 変更を伴わない。
公開前残タスクに着手する前に型を最新化しておくことで、これ以降の実装で誤って
旧 RPC 名 (`delete_own_account` 等) を呼んだり、新テーブル (`app_settings`) や
新カラム (`shares.expires_at` / `shares.image_path`) に型なしで触ったりするリスクを下げる。

## スコープ外 (本 plan では扱わない)
- `@supabase/supabase-js` / `@supabase/ssr` のバージョンアップ
- 既存の `as unknown as` キャスト全件除去
  (PR7/PR9 起因のもの以外は意図的設計であり個別判断、本 plan では触らない)
- `Json` 型 / `CompositeTypes` ヘルパー型の独自改修
- DB schema 変更 (今回は read-only な `gen types` のみ)
- 公開前残タスク (規約 / LP / Sentry / PWA / lint cleanup など)
- `delete_own_account` 型エントリの再削除 (PR10 Phase B で手動除去済、再生成でも消える)

## 関連 plan / 履歴
- `docs/plans/2026-05-11_db_pre_public_phase2.md` (Phase 2 hardening、完了済)
- 直近 migration:
  - `20260512000001`〜`20260512000003` (PR4: REVOKE / CHECK / composite index)
  - `20260513000001`〜`20260513000003` (PR5: UNIQUE、PR6: auto_add_opponent_deck trigger 化)
  - `20260514000001` (PR7 Phase 7a: personal stats RPCs)
  - `20260515000001`〜`20260515000002` (PR9 Phase 9a + 9b-3)
  - `20260516000001` (PR10 Phase B: DROP delete_own_account)

## 入力資料
- 現 `src/lib/supabase/database.types.ts` (1396 行、PostgrestVersion: "14.4")
- production / staging DB スキーマ (Phase 2 hardening 全反映済、両者は完全同期)
- supabase CLI 2.98.2 の `gen types` (`--db-url` で remote DB 参照可能)
- `supabase/config.toml` の `schemas = ["public", "graphql_public"]`
- 既存 cast workaround 一覧 (調査済): 24 occurrences / 7 files

## 現状サマリ (production DB と types.ts の差分)

### types.ts に**追加**されるべきもの

| カテゴリ | エンティティ | 出所 | 用途 |
|---|---|---|---|
| Table | `app_settings` (key/value/description/updated_at/updated_by + Relationships) | PR9 Phase 9a | 一般設定 (admin) |
| Column | `shares.expires_at` (timestamptz NOT NULL) | PR9 Phase 9a | 保存期限 |
| Column | `shares.image_path` (text NULL) | PR9 Phase 9a | Storage 削除パス |
| RPC | `get_personal_my_deck_stats_range` | PR7 Phase 7a | 個人デッキ統計 |
| RPC | `get_personal_opponent_deck_stats_range` | PR7 Phase 7a | 個人対面統計 |
| RPC | `get_personal_turn_order_stats_range` | PR7 Phase 7a | 個人先後統計 |
| RPC | `get_personal_deck_detail_stats_overall` | PR7 Phase 7a | 個人デッキ詳細 (全体) |
| RPC | `get_personal_deck_detail_stats_by_tuning` | PR7 Phase 7a | 個人デッキ詳細 (調整別) |
| RPC | `get_personal_opponent_deck_detail_stats` | PR7 Phase 7a | 個人対面詳細 |
| RPC | `list_expired_shares` | PR9 Phase 9a | 期限切れ shares 列挙 (service_role) |

### types.ts に**残ったまま消えるべきもの**
- なし (`delete_own_account` は PR10 Phase B で既に手動除去済、再生成でも追加されない)

### 既存 entity に対する潜在的差分 (要 diff 確認)
- PR4 の CHECK constraints は type レイヤに出ない (column type は同じ)
- PR4 の composite index / PR5 の UNIQUE index は Relationships に出る可能性あり
- PR6 で `auto_add_opponent_deck` が trigger 経由になったが、RPC 自体は残り型は変わらない見込み
- PR9 の trigger function (`validate_app_settings` / `derive_image_path_from_url` /
  `set_shares_expires_at` / `recalc_shares_expires_at_on_retention_change`) は
  supabase gen が `Functions` に含めるか不明 (含まれても害はないが要確認)

### 型不在による cast/workaround (PR7/PR9 起因、本 plan で除去対象)

| ファイル | 箇所 | 現状 | 除去後 |
|---|---|---|---|
| `src/components/share/ShareModal.tsx` | share_data Json cast | `share_data as unknown as ...Json` | 残す (share_data → Json は意図的、`StatsShareData/DeckShareData` を Json に絞り込み) |
| `src/components/share/ShareModal.tsx` | `insertPayload as never` | INSERT payload 型化なし | **除去**: image_path 型化後、payload 型を `Database["public"]["Tables"]["shares"]["Insert"]` で明示 |
| `src/app/api/admin/share-cleanup/route.ts` | `ExpiredShareRow` 自前定義 + manual cast | RPC 未登録のため | **置換**: `Database["public"]["Functions"]["list_expired_shares"]["Returns"][number]` を使用 |
| `src/app/api/admin/settings/route.ts` | `AppSettingsRow` 自前定義 + maybeSingle cast | テーブル未登録のため | **置換**: `Database["public"]["Tables"]["app_settings"]["Row"]` を使用 |
| `src/lib/actions/stats-actions.ts` | `getPersonalStats` 内 rpc wrapper + 戻り値 cast (2 occurrences) | PR7 Phase 7b 起因 | **除去**: `supabase.rpc("get_personal_opponent_deck_stats_range", ...)` を直接呼ぶ、戻り値は自動生成 Functions Returns 型に依存 |
| `src/lib/actions/stats-actions.ts` | `getDetailedPersonalStats` 内 cast (4 occurrences: rpc wrapper + myDeck/oppDeck/turn 戻り値) | PR7 Phase 7b 起因 | **除去**: 同上 |
| `src/lib/actions/stats-actions.ts` | `getDeckDetailStats` 内 cast (3 occurrences: rpc wrapper + overall/byTuning 戻り値) | PR7 Phase 7b 起因 | **除去**: 同上 |
| `src/lib/actions/stats-actions.ts` | `getOpponentDeckDetailStats` 内 cast (2 occurrences: rpc wrapper + 戻り値) | PR7 Phase 7b 起因 | **除去**: 同上 |

計 14 occurrences (PR9 3 + PR7 11)。

**実装時の注意 (Resolved Decisions の追加条件より)**:
- tsc で大きな型不一致が出る場合は plan を更新して再レビュー
- cast 除去でロジック変更が必要になる場合は実装前に相談

その他の cast (battles cursor 受け取り、og route 内 share_data shape、admin-actions の意図的回避、opponent-deck-display の select 文字列 cast 等) は **本 plan のスコープ外** とし維持する。

## 実装ステップ (1 PR、Phase 分割なし)

### Step 1: types.ts.new を生成して diff を取る
```bash
. .env.staging-sync.local
npm_config_cache=/private/tmp/npm-cache npx supabase gen types typescript \
  --db-url "$PROD_DB_URL" \
  --schema public,graphql_public \
  > src/lib/supabase/database.types.ts.new
diff -u src/lib/supabase/database.types.ts src/lib/supabase/database.types.ts.new
```

期待される差分:
- 上記「追加されるべきもの」一覧通り
- 既存 entity に予期せぬ変更がないこと

不一致があれば一旦止めて plan 修正 (大規模差分なら本 plan で扱わない判断もあり)。

### Step 2: types.ts を置き換え
```bash
mv src/lib/supabase/database.types.ts.new src/lib/supabase/database.types.ts
```

### Step 3: PR7/PR9 起因の cast workaround を除去 (計 14 occurrences)
- `ShareModal.tsx`: `insertPayload as never` を `Database["public"]["Tables"]["shares"]["Insert"]` 経由に書き換え (image_path/image_url が型に乗ったので自然な型推論で通る)
- `share-cleanup/route.ts`: 自前 `ExpiredShareRow` を削除し、Supabase の RPC 戻り型を直接使用
- `settings/route.ts`: 自前 `AppSettingsRow` を削除し、Tables Row 型を直接使用
- `stats-actions.ts`: PR7 Phase 7b 起因 cast 11 occurrences を除去
  - 4 関数 (`getPersonalStats` / `getDetailedPersonalStats` / `getDeckDetailStats` / `getOpponentDeckDetailStats`) の冒頭 `const rpcs = supabase as unknown as { rpc: ... }` ラッパーを削除し、`supabase.rpc("get_personal_*", { ... })` を直接呼ぶ
  - RPC 戻り値 `as unknown as PersonalStatsRpcRow[]` / `DeckDetailOverallRpcRow[]` / `DeckDetailByTuningRpcRow[]` / `OpponentDeckDetailRpcRow[]` / `TurnRow[]` キャストを除去し、自動生成 Functions Returns 型に依存させる
  - **重要**: 自前 `PersonalStatsRpcRow` / `DeckDetailOverallRpcRow` / `DeckDetailByTuningRpcRow` / `OpponentDeckDetailRpcRow` / `TurnRow` 型定義は、自動生成型と shape が一致するか tsc 確認後、置換可能なら削除する。一致しない場合は plan を更新して再レビュー (Resolved Decisions の追加条件)

### Step 4: 自前検証
- `npx tsc --noEmit` exit 0
- `npm run lint` 新規エラーなし (既存 52 件は touchable 範囲外なので維持)
- `npx opennextjs-cloudflare build` 成功

### Step 5: dev push + Cloudflare preview build 確認

### Step 6: dev preview の機能 smoke (ユーザー必須)
- `/admin/general-settings` → retention 保存・cleanup プレビュー
- 共有モーダル → share 作成 (image_path INSERT 経路)
- 個人戦績 (personal stats RPC 6 本) → 既存通り表示
- 共有ページ表示 → og 画像も含む

### Step 7: ユーザー OK 後に main 反映 (コードのみ、migration なし)

## 破壊リスク
- **低**: code-only、DB 変更なし、機能変更なし、production への migration なし
- **中リスク要素**:
  1. supabase gen 出力の style 差 (改行 / コメント) が大量で diff レビューが重い → Step 1 dry-run で全量目視
  2. 自動再生成で既存型に **意図せぬ nullability/type 変更** が混入する可能性 → Step 1 で重点確認
  3. cast 除去で隠れていた型不一致が表面化 → tsc で検出、必要なら cast を残す判断
  4. trigger function が Functions に含まれた場合、`Args: never; Returns: undefined` 等で
     ノイズ追加 → 機能影響なし、保持 OK

## staging 確認項目
本 plan は DB 変更なしのため staging DB 適用不要。
Cloudflare dev preview ビルドが staging Supabase を参照して動くことだけ確認する。

## ユーザー手動作業
- なし (DB 触らない、Cloudflare 環境変数変更なし、Discord/Supabase Dashboard 操作なし)

## 検証 SQL
不要 (DB 変更なし)。

## 実装前確認事項 (要回答)

### Q1. ソース DB は production と staging どちらにするか?
- A: production (PROD_DB_URL)
- B: staging (STAGING_DB_URL)
- 想定: production を信頼ソースとする (Phase 2 hardening は両者完全同期だがどちらか選ぶなら production)

### Q2. gen types の出力 style が現状と大きく異なる場合の方針
- A: gen 出力をそのまま採用 (差分は許容、style に手を入れない)
- B: 既存 style に手で揃える (手間あり、divergence 発生しやすい)
- 想定: A 採用 (将来 1 コマンドで再生成可能な状態を保つ)

### Q3. 既存 entity に予期せぬ差分があった場合の対処
- A: 本 plan 内で確認しユーザーに判断委ね、必要なら手動マージ
- B: 大きな差分は別 plan に切り出し、本 plan は新規 entity 追加のみに留める

## Resolved Decisions

- [PR7 cast範囲] stats-actions.ts の PR7 Phase 7b 起因 cast (11 箇所、`as unknown as` + コメント「自動生成型に未登録のため」) を本 plan の scope に含めるか? → PR9 + PR7 全件
  - **追加条件 (ユーザー指示)**:
    - tsc で大きな型不一致が出る場合は無理に実装を進めず、plan を更新して再レビュー
    - cast 除去によってロジック変更が必要になる場合も、実装前に相談
- [Q1 ソース DB] supabase gen types のソース DB → production (PROD_DB_URL)。本番反映済みスキーマを型の正とする
- [Q2 出力 style] gen 出力 → そのまま採用。自動生成ファイルに手整形は入れない
- [Q3 予期せぬ差分処理] 既存 entity に予期せぬ差分があった場合 → その場で止め、差分概要をユーザーに共有して相談。勝手に採用しない

## 参考: ファイル参照
- `src/lib/supabase/database.types.ts:13` (PostgrestVersion: "14.4")
- `src/lib/supabase/database.types.ts:669` (shares table、`expires_at`/`image_path` 未反映)
- `src/lib/supabase/database.types.ts:828` (Functions 開始)
- `src/components/share/ShareModal.tsx:163` (`insertPayload as never`)
- `src/app/api/admin/share-cleanup/route.ts:25-31` (`ExpiredShareRow` 自前定義)
- `src/app/api/admin/settings/route.ts:13-17` (`AppSettingsRow` 自前定義)
- `supabase/config.toml:11` (`schemas = ["public", "graphql_public"]`)
- production DB スキーマ確認結果: app_settings table 存在、shares に expires_at + image_path、
  list_expired_shares + 6 personal stats RPC + 4 trigger function 存在
