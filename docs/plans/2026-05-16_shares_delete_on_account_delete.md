# 2026-05-16 アカウント削除時の shares 行削除 (#2 from 公開前セキュリティレビュー)

## 目的

ユーザーがアカウントを削除した時、本人が作成した「共有用データ (`shares` テーブルの行)」が DB に残り続け、削除後も `/share/[id]` で公開され続けてしまう問題を解消する。

2026-05-14 の公開前セキュリティレビュー (`memory/project_security_review_2026_05_14.md` #2) で発見した実プライバシー課題で、唯一の「公開ブロッカー級」項目。codex の 2026-05-16 レビューを踏まえ、route 側修正だけでは閉じない 2 つの隙間 (同時実行レース / 将来別経路からの削除) を DB レイヤで根本封じするため、**FK CASCADE 化 migration も含む 2-phase plan** に拡張。

## 問題詳細

### 現象

1. ユーザーが `/account` から「アカウント削除」を実行
2. `/api/account/delete` (POST) が呼ばれ、`auth.users` が削除される
3. 関連テーブル (`decks`, `battles`, `discord_connections` 等) は外部キーの CASCADE 設定により連動して自動削除
4. **しかし `shares` テーブルだけは「`user_id` 列を NULL に置き換えるだけで行自体は残る」設定になっている**
5. 結果: 削除前に生成された share URL (`/share/<id>`) は **アカウント削除後もずっと公開され続ける**

### なぜそうなっているか (3 つの要因の重なり)

1. `supabase/migrations/20260415000002_shares_table.sql:6` で `shares.user_id` の外部キーが `ON DELETE SET NULL` で定義されている (= 親レコードが消えても子レコードは削除せず、親への参照だけ NULL にする挙動)
2. `src/app/api/account/delete/route.ts` のコメントは「`shares` 行は `deleteUser` 後の CASCADE で消える」と想定している (= FK の実定義と食い違っている)。コード本体も Storage 画像は明示削除するが `shares` 行自体は削除していない
3. `shares` テーブルの SELECT は service_role 専用 (`20260509000002` で `anon`/`authenticated` から REVOKE 済) だが、`/share/[id]` と `/api/og/[id]` の 2 経路は両方とも service_role で id 参照するため、行が残っている限り公開され続ける

### 影響範囲

- `shares.share_data` (jsonb) は戦績 JSON を含む: 勝率・デッキ名・対面別データ。ユーザーが任意の文字列を入れたデッキ名も保持される
- アカウント削除は「ユーザー本人がデータ削除を希望した」ケース。残留はプライバシーポリシー (今後策定する規約・プラポリ) と矛盾する
- 期限切れクリーンアップ (PR9 の `expires_at` + admin の手動 cleanup ボタン) で最終的には消えるが、既定 90 日 + 手動実行依存。本人視点では「削除したのに残った」期間が長い

### 直接アクセスされる Storage URL について (本 plan の対象外、ただし明記)

`share-images` は public bucket のため、`https://<project>.supabase.co/storage/v1/object/public/share-images/<userId>/<filename>.png` の直 URL は誰でも取れる (URL を知っていれば)。アカウント削除後、`/share/[id]` 経由の発見は 404 で防げるが、**過去に URL を控えた人が直 URL でアクセスすれば画像自体は取れる**。本 plan では shares 行 + Storage ファイルの両方を削除することで、新規発見も既知 URL でのアクセスも遮断する。

## Preflight (実環境確認、2026-05-16 13:00 JST 時点)

MCP 経由で本番・staging の実 DB を確認した事実:

| 項目 | prod (asjqtqxvwipqmtpcatvz) | staging (uqndrkaxmbfjuiociuns) |
|---|---|---|
| `shares` 行数 | 58 | 6 |
| 既存 orphan (`user_id IS NULL` の数) | **0** | **0** |
| share 所有ユーザー数 | 3 | 1 |
| `service_role` の DELETE 権限 | ✅ true | ✅ true |
| FK 定義 | `FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL` | 同左 |
| `shares.user_id` INDEX | あり (`20260511000001_fk_indexes.sql`) | 同左 |

→ codex の 2026-05-16 レビューで提起された 4 点のうち:
- **#1 既存 orphan**: 両環境で 0 件のため「過去 share を消し残し」のクリーンアップ不要 (本 plan では一回限りの SQL を流さない判断)
- **#4 service_role DELETE 権限**: 両環境で許可済みのため Phase A の route 側 DELETE は確実に実行可能
- **#2 同時実行レース** / **#3 Storage 失敗扱い**: 後述の Phase B + 処理順序変更で対応

### 実装/適用直前に再確認 (必須)

上記 preflight は 2026-05-16 時点。時間経過で状態が変わっている可能性があるため、以下のタイミングでそれぞれ MCP `execute_sql` で再確認する:

- **Phase A 実装着手直前**: orphan count / service_role DELETE 権限 / shares 総件数 を再確認。0 でなければクリーンアップ計画を本 plan に追記してから実装に進む
- **Phase B staging 適用直前**: FK 名 (`pg_get_constraintdef` で実 constraint name を取得、`shares_user_id_fkey` を前提にしているが実名と DROP/ADD 対象が一致するか確認)
- **Phase B prod 適用直前**: 同じく FK 名 + shares 総件数 を記録 (適用前後の整合性チェック用)

FK 名は手動で別名で再作成されている可能性は低いが、念のため毎回確認する。

## スコープ

本 plan で扱う:
- Phase A: `src/app/api/account/delete/route.ts` に `shares` 行の明示 DELETE を追加 + 処理順序の安全化 (Storage remove を shares DELETE 前に移動)
- Phase A: 同ファイルの既存コメントを実装と整合する内容に修正
- Phase B: FK を `ON DELETE SET NULL` → `ON DELETE CASCADE` に変更する migration

本 plan で扱わない (必要になったら別 plan):
- 他テーブルの ON DELETE SET NULL レビュー (security review で確認済: `user_id` 起因の SET NULL は shares のみ。`app_settings.updated_by` 等は admin 属性のため SET NULL のままで OK)
- 管理者による他ユーザー削除フロー (現状機能としてなし)
- public storage bucket 自体を private にする変更 (OGP 配信に影響、別件)

## 設計判断

### Phase A: route 側で明示 DELETE + 処理順序の安全化

**処理順序**: Bearer auth → Storage path 収集 → list → **Storage remove** → **shares DELETE** → deleteUser

旧設計 (現状コード) は「収集 → list → deleteUser → Storage remove」だった。これだと shares 行が残るうえ、deleteUser 成功後の Storage remove 失敗で「行は消えたが画像は残った」可能性があった。新設計では:
- すべての破壊操作 (Storage remove / shares DELETE / deleteUser) を「リトライ安全」な順序にする
- どのステップで失敗しても、リトライで前進する (deleteUser 以前で失敗なら全リトライ可能。deleteUser 後の失敗は元コード踏襲で警告扱い)
- 万一 Storage remove 失敗で orphan ファイルが残った場合は、shares 行はまだ存在するため (Storage 失敗時は shares DELETE/deleteUser に進まない)、リトライで paths を再収集できる

### Phase B: FK を ON DELETE CASCADE に変更

route 側 DELETE だけでは閉じない 2 つの隙間を DB レイヤで根本封じする:

1. **同時実行レース**: route が shares DELETE → deleteUser までの数十ミリ秒の間に同一ユーザーが新規 share を作ると、その新 share は SET NULL で orphan 化する。CASCADE なら deleteUser が必ず連鎖削除するため race window が消える
2. **将来の別経路**: 管理者削除フロー追加や、Supabase の `auth.admin.deleteUser` を別 API から呼ぶ将来の拡張で、route の明示 DELETE を通らないケースが発生し得る。FK CASCADE なら経路に依存せず保証される

route 側の明示 DELETE は Phase B 後も残す (defense in depth + 順序の明示性、コストはコード数行)。CASCADE があれば deleteUser が同じ shares を再削除しようとして no-op になるだけ。

### Phase A → Phase B の順序 (CLAUDE.md ルール準拠)

CLAUDE.md「コード変更を伴う migration は main 本番反映後に db push する」は **production DB への適用** に対するルール。staging DB は dev preview の検証用なので、dev branch 検証のために main 反映を待たずに先に適用してよい。

具体的フロー:
1. Phase A code を dev に commit/push → Cloudflare dev preview ビルド完了待ち
2. Phase B migration を **staging DB に適用** (`npx supabase db push --db-url $STAGING_DB_URL --include-all`)
3. dev preview (staging DB を参照) で動作確認 — アカウント削除 → shares 削除 + Storage 削除 + CASCADE 経由でも shares が連鎖削除されること確認
4. ユーザー OK 指示
5. dev → main マージ + push → Cloudflare prod ビルド完了確認
6. Phase B migration を **production DB に適用** (`npx supabase db push --db-url $PROD_DB_URL --include-all`)

Phase A 単独でも privacy 課題は実質解決 (race window が残るのみ)。Phase B は完全閉じこめ。両方適用で完全対応。

### 不採用方針

- **route 側 DELETE を Phase B 後に削除**: 不採用。defense in depth として保持する方が安全。コードコストは 5 行程度
- **既存 orphan cleanup SQL を含める**: 不採用。preflight で両環境 0 件確認済のため不要。将来 migration 適用後に再確認すれば良い
- **Storage 配信を private bucket に変更**: 別 plan のスコープ

## 実装ステップ

### Phase A: route.ts 修正 (Step 1〜3)

#### Step 1: `/api/account/delete/route.ts` の処理順序変更 + shares DELETE 追加

新しい処理順序:
1. `requireBearer` で本人認証
2. `shares.image_path` / `image_url` から Storage path を Set に収集 (既存)
3. `share-images/<userId>/` 配下の実ファイルを `list` で取得して path Set に追加 (既存)
4. **(NEW)** Storage path の `remove()` を実行 (旧設計の Step 6 から繰り上げ)
5. **(NEW)** `shares` から `user_id = userId` の行を DELETE
6. `auth.admin.deleteUser(userId)` を実行 (既存だが番号変更)
7. 旧 Step 6 (deleteUser 後の Storage remove) は削除 (Step 4 に統合された)

#### Step 2: Storage remove (新規 Step 4 の挿入)

既存 `// === 2. share-images/<userId>/ 配下を列挙 ===` ブロックの直後に挿入:

```ts
// === 3. Storage 上のファイルを先に削除 ===
// shares 行 DELETE / deleteUser よりも前に Storage cleanup を試みる。理由:
// 旧設計のように deleteUser 後の Storage remove だと、Storage 失敗時に
// 「DB は消えたが画像は残る」状態になり、shares 行も既に消えているため list_expired_shares
// で後から回収できない。順序を逆にすれば、Storage 失敗時は shares 行も auth.users も
// 残るのでリトライで paths を再収集できる。
const paths = Array.from(pathsToDelete);
let storageDeleted = 0;
const storageWarnings: string[] = [];
if (paths.length > 0) {
  const { data: removed, error: removeError } = await auth.supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove(paths);
  if (removeError) {
    return NextResponse.json(
      { error: "storage_error", reason: `remove failed: ${removeError.message}`, attempted_paths: paths.length },
      { status: 500 },
    );
  }
  storageDeleted = removed?.length ?? 0;
  if (storageDeleted < paths.length) {
    storageWarnings.push(`expected ${paths.length} files removed, got ${storageDeleted}`);
  }
}
```

#### Step 3: shares DELETE (新規 Step 5 の挿入)

直後に挿入:

```ts
// === 4. shares 行を明示削除 ===
// shares.user_id FK は (Phase B 完了までは) ON DELETE SET NULL なので deleteUser では消えない。
// share_data は /share/[id] と /api/og/[id] から service_role で公開され続けるため、
// アカウント削除時に行も削除しないとプライバシー保護にならない。
// (Phase B 完了後は deleteUser の CASCADE で同じ shares を no-op で再削除する形になる)
const { error: sharesDeleteError } = await auth.supabaseAdmin
  .from("shares")
  .delete()
  .eq("user_id", userId);
if (sharesDeleteError) {
  return NextResponse.json(
    { error: "db_error", reason: `shares delete failed: ${sharesDeleteError.message}` },
    { status: 500 },
  );
}
```

#### Step 4: deleteUser 直後の Storage remove ブロック削除

旧 Step 4 の `// === 4. deleteUser 成功 → Storage 削除 ===` 以下のブロック (paths の remove と storageWarnings の積み上げ) は、新 Step 3 (Storage remove) に統合済みなので **削除**。

最終的な response 組み立て (`return NextResponse.json({ ok: true, storage_deleted, storage_warnings })`) は維持。

#### Step 5: 冒頭コメント修正

route.ts 冒頭の「削除順序」procedural list (現在 6 ステップ) を新しい順序に書き換える:

```
// 削除順序 (ユーザー指定 + 2026-05-16 修正):
//   1. Bearer JWT で本人検証 (admin チェックなし)
//   2. shares.image_path / image_url から Storage path を収集
//   3. share-images/<user_id>/ 配下の実ファイルも列挙して削除候補に追加
//   4. Storage path を remove (失敗時は 500 で abort、shares/auth.users は残るのでリトライ可能)
//   5. shares 行を user_id 条件で明示 DELETE
//      (Phase B 完了までは FK が SET NULL なので明示 DELETE 必須。完了後は CASCADE の defense-in-depth)
//   6. auth.admin.deleteUser(user.id) を実行
//   7. deleteUser 失敗時は ok: true を返さず 500 (shares/Storage は既に消えているが auth.users は残るので
//      リトライ時に再度 deleteUser だけが実行され、最終的に整合する)
```

冒頭の「shares 行は deleteUser 後の CASCADE で消える可能性があるため」のコメント (line 16-17 の段落) は以下に置換:

```
// shares.user_id FK は ON DELETE SET NULL なので deleteUser では消えない (Phase B 完了までは)。
// Storage 上の画像は public bucket のため直 URL でもアクセス可能であり、行と画像の両方を
// 確実に削除する必要がある。順序は「Storage → shares DELETE → deleteUser」で、deleteUser
// より前で失敗した場合はリトライで前進可能、deleteUser 後の失敗は警告扱い (元設計踏襲)。
```

既存の `// === 3. auth.admin.deleteUser を実行 ===` は Step 1 で示した新しい処理順序 (deleteUser = 第 5 ステップ) に合わせて `// === 5. auth.admin.deleteUser を実行 ===` にセクション番号を更新する。あわせて直下のインラインコメント:

```
// (CASCADE: auth.users → profiles → shares / decks / battles / discord_connections / 等)
```

は以下に修正:

```
// (CASCADE: auth.users → profiles → decks / battles / discord_connections / 等)
// ※ shares は Phase A の明示 DELETE で先に削除済。Phase B 完了後は CASCADE が二重保険として効く
```

### Phase B: FK migration (Step 6)

#### Step 6: migration 作成

`supabase/migrations/<YYYYMMDDNNNNNN>_shares_user_id_cascade.sql` を新規作成 (リポジトリの命名規約は `YYYYMMDD` + 6 桁シーケンス。直近は `20260516000001_drop_delete_own_account.sql` なので、次は `20260516000002_*` などになる):

```sql
-- 2026-05-16 PR<N>: shares.user_id FK を ON DELETE SET NULL → ON DELETE CASCADE に変更
--
-- 背景:
--   - 2026-05-14 セキュリティレビュー (#2) で「アカウント削除後も shares が残り
--     /share/[id] で公開され続ける」問題が発覚
--   - Phase A (route.ts) で明示 DELETE を入れたが、同時実行レース
--     (route 内で shares DELETE → deleteUser の間に新規 share INSERT) や
--     route を通さない将来の admin 削除フロー追加に対しては route 側だけでは閉じない
--   - DB レイヤで FK を CASCADE 化することで、deleteUser を呼んだ瞬間に
--     shares が連鎖削除され、race window が消える
--
-- 適用順序:
--   - staging DB: dev preview 検証のため main 反映前に適用 (dev preview は staging DB 参照)
--   - production DB: CLAUDE.md ルールに従い main 反映完了後に適用 (順序を逆にすると prod 側だけ
--                    先に CASCADE になり、prod コードが追従していない状態で本番が壊れる)

ALTER TABLE public.shares
  DROP CONSTRAINT shares_user_id_fkey;

ALTER TABLE public.shares
  ADD CONSTRAINT shares_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
```

(`shares_user_id_fkey` は Postgres 自動命名の FK 名。MCP preflight で確認した実 FK 名と一致するか、適用前に再確認する)

#### Step 7: rollback migration の準備 (適用しない、保管のみ)

`supabase/rollback/<同シーケンス番号>_rollback.sql` (例: `20260516000002_rollback.sql`):

```sql
-- Phase B rollback: CASCADE → SET NULL に戻す
ALTER TABLE public.shares
  DROP CONSTRAINT shares_user_id_fkey;

ALTER TABLE public.shares
  ADD CONSTRAINT shares_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
```

これは `supabase/rollback/` ディレクトリに置く (`supabase/rollback/20260424000004_rollback.sql` の前例あり、自動適用されない場所)。緊急時に手動で `apply_migration` で流せる状態にしておく。

## 失敗時の挙動 (新設計)

| ステップ | 失敗時 | リトライ可否 | 残留状態 |
|---|---|---|---|
| 1 Bearer 検証 | 401/500 | 可 | 何も触らず |
| 2 path 収集 | 500 (DB error) | 可 | 何も触らず |
| 3 path 列挙 | 500 (Storage list error) | 可 | 何も触らず |
| 4 **Storage remove** | 500 (storage_error) | 可 | shares 行と auth.users は残る。一部画像が消えた可能性あり (Set に積んでいた paths はリクエスト終了で消える) |
| 5 **shares DELETE** | 500 (db_error) | 可 (**リトライ必須**) | Storage 画像は消えている、shares 行と auth.users は残る。画像公開リスクは下がる (Storage 上のファイルは消えているので直 URL でも 404、`/share/[id]` の OGP 画像も `/api/og/[id]` も 404) が、**`shares.share_data` (戦績 JSON / デッキ名 / 期間 / format 等の textual data) は残るため `/share/[id]` の title / description / 本文表示は引き続き公開される**。プライバシー保護を完了させるためリトライ必須 (リトライ時は paths が空になり Storage remove は no-op、shares DELETE は冪等、deleteUser まで一気に進めば収束) |
| 6 deleteUser | 500 (delete_user_error) | 可 | Storage と shares は消えている、auth.users だけ残る。リトライで deleteUser だけ再実行され収束 |

→ どのステップで失敗してもリトライで前進可能 = retry-safe 設計。

## エッジケース

### 同時実行 (multi-tab)
- 同じユーザーが複数タブで同時に削除ボタンを押すケース
- Phase A 単独時: 1 つ目が成功すると `auth.users` 消滅 → 2 つ目の `requireBearer` は JWT 失効で 401
- shares DELETE は冪等 (= 既に消えた行を DELETE しても無害)
- Phase B 完了後: FK CASCADE により最終的な整合性は保証

### Phase A 完了 〜 Phase B 適用までの race window (production 環境のみ)

- Phase A コードのみがデプロイされ Phase B 未適用の状態でアカウント削除すると、route の shares DELETE → deleteUser の間 (数十 ms) に新規 share INSERT があれば orphan が残る可能性
- **staging では race window はない**: Phase B migration は dev preview 検証前に staging DB に適用するため、dev preview は常に「Phase A コード + Phase B CASCADE 済 staging DB」の状態で動作する
- **production には race window が一時的に存在する**: main 反映 (Phase A コードが prod に出る) から production DB への Phase B migration 適用までの間。この期間を最小化するため、main 反映直後にユーザー OK をもらってすぐ production DB への Phase B migration 適用に着手する
- 実害シナリオの確率は非常に低い (本人が削除ボタンを押した直後の数十 ms 内に別タブで share 作成、というユースケース)

### shares が大量にある場合
- preflight で確認: 最大ユーザーで数十件オーダー (prod の 58 行 / 3 ユーザー = 平均約 20)
- `shares.user_id` INDEX あり → DELETE は O(log n) で完了
- Cloudflare Workers の CPU 30 秒制限には余裕

### Phase A コード + Phase B 未適用 = 二重削除に見えるが問題なし
- Phase A の route が shares DELETE
- deleteUser 時、FK は SET NULL なので shares には何も起きない
- Phase B 適用後は、deleteUser 時に CASCADE が走るが shares は既に空なので no-op

### Phase B 適用後 + Phase A route コード未デプロイ (理論上のロールバック中)
- 新 FK CASCADE は有効
- 旧 route は shares DELETE せずに deleteUser
- → deleteUser の CASCADE で shares が連鎖削除される (DB レイヤで privacy 保証)
- = Phase B のみでも privacy は守られる

## テスト計画

### Claude 自前検証 (Phase A 実装前)
- preflight 結果 (本 plan 「Preflight」セクション) で既存 orphan 0 件 / service_role DELETE 権限 ✅ / FK 状態を確認済

### Claude 自前検証 (Phase A 実装後)
- `npm run lint` 通過確認 (新規 errors なし)
- `npx opennextjs-cloudflare build` 通過確認

### staging 検証 (Phase A 実装後・dev push 後)
1. dev push → Cloudflare preview build 完了待ち
2. staging のテストユーザーで sign up → `/share/*` から複数 share を生成 (画像生成完了まで待つ)
3. MCP `execute_sql` で staging の `shares` を SELECT して該当 `user_id` の行数を記録 (例: 3 件)
4. `/account` からアカウント削除を実行
5. MCP `execute_sql` で再度 SELECT して 0 件になったことを確認
6. 削除前に控えた share URL (`/share/<id>`) を curl して 404 が返ることを確認
7. `/api/og/<id>` も 404 確認
8. Storage の `share-images/<userId>/` を MCP もしくは Supabase dashboard で確認して該当ファイルが削除されているか確認

### Phase B 適用前検証 (staging)
- migration を staging に適用 (`supabase/migrations/` から `npx supabase db push --db-url $STAGING_DB_URL --include-all`)
- 適用後に FK 状態を MCP `execute_sql` で再確認 (`pg_get_constraintdef`)
- 既存テストユーザーの shares が壊れていないことを SELECT で確認
- 新規アカウント削除フロー (Phase A route を通る) で挙動が変わらないことを確認 (route 削除 → CASCADE no-op の組み合わせで結果は同じ)

### Phase B prod 適用後検証
- prod に migration 適用後、FK 状態を MCP `execute_sql` で確認
- 既存 prod ユーザーの shares が壊れていないか、`count(*)` が適用前と一致するか確認
- 本番アカウント削除は実テストせず staging の結果で代替

### 公開後の監視
- なし (一過性の修正、定常監視不要)

## ロールバック計画

### Phase A (route.ts) のロールバック
- git revert で即座に戻る
- revert すると新規アカウント削除で shares が残る挙動に戻るが、それは Phase B 適用済みなら CASCADE で救済される

### Phase B (migration) のロールバック
- `supabase/rollback/` 配下に用意した SET NULL 戻し migration を MCP `apply_migration` で適用
- 適用後は Phase A の route 側 DELETE が単独で privacy 保護を担当 (race window あり)

### 両方ロールバック
- Phase B → Phase A の順で戻す (DB → コード)
- 旧状態に完全復帰、shares 残留問題が再発する

## 関連ファイル

| ファイル | 該当箇所 | 本 plan での扱い |
|---|---|---|
| `src/app/api/account/delete/route.ts` | 全体 (Phase A) | 変更: 処理順序入れ替え + DELETE 追加 + コメント全面更新 |
| `supabase/migrations/<NEW>_shares_user_id_cascade.sql` | 新規 (Phase B) | 追加 |
| `supabase/rollback/<同タイムスタンプ>_rollback.sql` | 新規 (Phase B 緊急用) | 追加、適用しない |
| `supabase/migrations/20260415000002_shares_table.sql:6` | `shares.user_id` 旧 FK 定義 | 参考 (Phase B で上書きされる) |
| `src/app/share/[id]/page.tsx:37` | shares を読む側 | 確認のみ、変更なし |
| `src/app/api/og/[id]/route.tsx:376` | shares を読む側 | 確認のみ、変更なし |

## Resolved Decisions

plan-critic レビュー / codex レビューで判明・確定したものを追記する。

- **既存 orphan cleanup の要否**: 2026-05-16 13:00 JST 時点の MCP preflight で prod / staging とも 0 件と確認。本 plan ではクリーンアップ SQL を含めない (将来 migration 適用後に再確認すれば良い)
- **service_role DELETE 権限の前提**: 2026-05-16 13:00 JST 時点の MCP preflight で prod / staging とも許可済みと確認。Phase A の route 側 DELETE は確実に実行可能
- **修正方針**: route 側 DELETE (Phase A) + FK CASCADE migration (Phase B) の 2-phase。route 側 DELETE は Phase B 後も defense in depth として残す
- **処理順序**: Storage remove → shares DELETE → deleteUser。Storage 失敗時のリトライ安全性を優先 (orphan ファイル残留を防ぐ)
- **デプロイ順序**: Phase A code を dev push → Phase B migration を **staging 適用** → dev preview 検証 → ユーザー OK → main 反映 → Phase B migration を **prod 適用**。CLAUDE.md「migration は main 反映後」ルールは production DB への適用に対するもので、staging への適用は dev preview 検証のため先行する

## 公開前残タスクとの位置付け

- これは 2026-05-14 セキュリティレビュー (`memory/project_security_review_2026_05_14.md`) の **#2 = 唯一の「公開ブロッカー級」項目**
- 公開前残タスク `memory/project_remaining_tasks_after_2026_05_09.md` のドメインバッチ 7 項目 (規約/LP/Sentry/PWA 等) とは独立。本 plan が完了したら、ドメイン取得待ちの残タスクと並走可能
- 同じセキュリティレビュー由来の #3 (Sentry) は公開ブロッカーから格下げされたので、本 plan 完了後に着手すれば良い
