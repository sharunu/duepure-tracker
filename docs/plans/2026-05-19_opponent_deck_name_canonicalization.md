# 2026-05-19: 対面デッキ名 (opponent_deck_master.name) を「アプリ内正式名・空白なし日本語」に統一する

## 1. 概要 / 目的

現状、`opponent_deck_master.name` は source ごとに格納される値の言語と形式が不揃いで、画面表示と DB 集計キーが乖離している:

- **Limitless 由来 (pokepoke)**: `name` は **英語空白あり** (例: `"Mega Altaria ex Igglybuff"`), `name_ja` に **日本語空白あり** (例: `"メガチルタリスex ププリン"`)
- **manual 由来 (dm/pokepoke)**: `name` は **日本語空白なし／一部空白あり** (例: `"アローラキュウコンex シザリガー"`), `name_ja` は `null`

`battles.opponent_deck_name` も上記をそのまま保存するため、英語名・日本語名・空白あり・空白なしが混在する。集計・検索・自由入力・候補選択の整合性確保のために `displayDeckName()` / `getOpponentDeckNameMap()` などのラッパーが必要になり、後付け修正で空白削除する場合も「候補選択か自由入力か」「Limitless 由来か manual 由来か」の場合分けがフォーム側に漏れ出している。

本 plan の目的は、`opponent_deck_master.name` を **「アプリ内正式名: 全 source 共通の空白なし日本語名」** に統一し、`battles.opponent_deck_name` も同じ正式名で保存する設計に揃えることである。これにより:

- `displayDeckName()` / `getOpponentDeckNameMap()` の存在意義がなくなる (表示・集計・検索のキーが `name` 単独になる)
- 自由入力フォーム側で「Limitless 英語名 vs 日本語名」の判定が不要になる
- 対戦記録の自由入力の空白削除も、`stripAllWhitespace` を入口に挟むだけで一貫した正規化が成立
- 既存の `decks.name` / `battles.my_deck_name` で実施済みの「全空白排除 + CHECK 制約」と同じ防御層を `opponent_deck_master.name` / `battles.opponent_deck_name` にも導入できる

`name_ja` は「翻訳由来の日本語ラベル」、`name_en` は「Limitless 英語元データ」として残し、管理画面など補助情報用途に限定する。`apply_limitless_snapshot` の照合キーは `name` から `limitless_deck_slug` (primary) / `name_en` (fallback) に変更し、翻訳改善で `name` が変動しても既存行を正しく更新できるようにする。

## 2. スコープ

### 含む
- `opponent_deck_master.name` を「空白なし日本語正式名」に統一する DB migration (全 source)
- `battles.opponent_deck_name` を新 `name` (正式名) に統一する DB migration
- `apply_limitless_snapshot` RPC の照合キー変更 (name → limitless_deck_slug / name_en)
- 対戦記録の自由入力フォーム (dm/pokepoke の BattleRecordForm / EditBattleModal) に `stripAllWhitespace` 適用
- `opponent_deck_master.name` / `battles.opponent_deck_name` に CHECK 制約「全空白を含まない」を追加
- admin 画面の対面デッキ追加・更新フォームに `stripAllWhitespace` を適用
- `getOpponentDeckNameMap()` / `displayDeckName()` の用途縮小または撤去
- migration 前検証 SQL と staging / production 検証手順
- rollback / backup 方針

### 含まない (scope 外)
- `name_ja` の空白削除 (翻訳由来の表示ラベルなのでスペース許容のまま)
- `name_en` の空白削除 (Limitless 英語データなので元のまま)
- 既存 share 仕様の URL 互換性維持 — `/[game]/stats/opponent/[deckName]` URL は破壊的に変わる (許容)
- OGP 画像内に埋め込まれた古い対面デッキ名のキャッシュ無効化 (Cloudflare/Discord 側のキャッシュは時間経過で更新)
- `decks.name` / `battles.my_deck_name` の追加 hardening (2026-05-18 PR で完了)
- `deck_tunings.name` の空白削除 (2026-05-18 で scope 外と決定済み)
- `auto_add_opponent_deck` の **category 自動判定ロジック** の改修 (現行の閾値 / 件数判定をそのまま使用)
- 衝突 case (後述 §6.2) の手動データ修正以外の自動マージ機構
- 新しい Limitless API 移行 (現状 HTML scraping は LIMITLESS_HTML_SYNC_PAUSED=true で停止中、本 plan は停止状態のまま設計し再開時にも整合する形にする)
- §13 に列挙する scope 外論点

## 3. 現状調査結果 (production DB at 2026-05-19)

`asjqtqxvwipqmtpcatvz` (production) で確認した実数値。staging (`uqndrkaxmbfjuiociuns`) は同期前のため別途検証で揃える。

### 3.1 opponent_deck_master の source 別件数

| game_title | format | source | 件数 | name_ja null | name_en null | slug null |
|---|---|---|---|---|---|---|
| dm | AD | manual | 5 | 5 | 5 | 5 |
| dm | ND | manual | 17 | 17 | 17 | 17 |
| pokepoke | RANDOM | limitless | 52 | 0 | 0 | 0 |
| pokepoke | RANKED | limitless | 52 | 0 | 0 | 0 |
| pokepoke | RANKED | manual | 24 | 24 | 24 | 24 |

- dm 側は全 22 行とも manual・name_ja / name_en / slug すべて null・name は日本語空白なし
- pokepoke/limitless 52行 × 2 format = 104 行。すべて name=英語空白あり / name_ja=日本語空白あり (`name_ja_is_manual=false`)
- pokepoke/manual 24 行: 1 行のみ name に半角スペースあり (`アローラキュウコンex シザリガー`)
- `auto_add_opponent_deck` trigger 経由で INSERT される行 (実態は `source='manual'`、DEFAULT 'manual' のまま挿入される。§5.2 参照) は **0 件** (battles trigger 経由の自動追加は現時点で実例なし)

### 3.2 空白を含む行の集計

| game_title | source | 件数 | name 空白 | name_ja 空白 | name_en 空白 |
|---|---|---|---|---|---|
| dm | manual | 22 | 0 | 0 | 0 |
| pokepoke | limitless | 104 | 104 | 76 | 104 |
| pokepoke | manual | 24 | 1 | 0 | 0 |

→ CHECK 制約「`opponent_deck_master.name` に空白を含まない」を素朴に追加すると **105 行違反**。migration 内で正規化してから ALTER TABLE ADD CONSTRAINT する。

### 3.3 battles.opponent_deck_name の分布

| game_title | format | battles 件数 | distinct names | 空白あり件数 |
|---|---|---|---|---|
| dm | AD | 15 | 7 | 0 |
| dm | ND | 269 | 23 | 0 |
| pokepoke | RANKED | 138 | 49 | 71 |

→ CHECK 制約「`battles.opponent_deck_name` に空白を含まない」を素朴に追加すると **71 行違反**。

### 3.4 battles.opponent_deck_name の master 照合分布

「現在の `battles.opponent_deck_name` がどの master 行と一致しているか」を検査した結果:

| game_title | format | match_source | distinct names | battle 件数 |
|---|---|---|---|---|
| dm | AD | manual_by_name | 4 | 12 |
| dm | AD | free_input (master 未登録) | 3 | 3 |
| dm | ND | manual_by_name | 16 | 223 |
| dm | ND | free_input | 7 | 46 |
| pokepoke | RANKED | limitless_by_name_en | 25 | 69 |
| pokepoke | RANKED | manual_by_name | 23 | 46 |
| pokepoke | RANKED | free_input | 1 | 23 |

- pokepoke/RANKED の 69 件は `battles.opponent_deck_name` に Limitless 英語名がそのまま入っている (例: `"Mega Altaria ex Igglybuff"`)
- pokepoke/RANKED の `free_input` は `"スイクンセグレイブ"` x23 のみ (ユーザーが ex を抜いた自由入力)
- dm/ND の `free_input` 46件は「あ」x26, 「アポロヌス」x6, 「い」x6 など、テスト / 誤入力データ

### 3.5 新 name (`stripAllWhitespace(name_ja)`) の重複検査

Limitless 由来 104 行に対し `stripAllWhitespace(name_ja)` を新 `name` とした場合の `(format, game_title)` 内重複: **0 件** (すべてユニーク)。

Limitless 由来 (`stripAllWhitespace(name_ja)`) と manual 由来 (`stripAllWhitespace(name)`) を突合した衝突: **1 件**

| game_title | format | 正規化 name | limitless id | manual id |
|---|---|---|---|---|
| pokepoke | RANKED | `メガチルタリスexププリン` | `2825a19a-…` (`name_ja="メガチルタリスex ププリン"` / `name_en="Mega Altaria ex Igglybuff"`) | `ea0b15de-…` (`name="メガチルタリスexププリン"`) |

→ 同一デッキを指す重複。両者は (`format, game_title, name`) UNIQUE 制約上 共存不可。**migration では manual 行を削除し、対応する battles を Limitless 行参照に統合する** (詳細 §6.2)。

該当 battles の現状:
- `opponent_deck_name = "メガチルタリスexププリン"` (manual 由来): **2 件**
- `opponent_deck_name = "Mega Altaria ex Igglybuff"` (limitless 英語名): **3 件**

→ 計 5 件を新正規化 name `"メガチルタリスexププリン"` に統合する。

### 3.6 opponent_deck_settings の現状

| game_title | format | management_mode | classification_method | limitless_last_synced_at |
|---|---|---|---|---|
| dm | AD | admin | threshold | null |
| dm | ND | auto | threshold | null |
| pokepoke | RANDOM | limitless | threshold | 2026-04-26 |
| pokepoke | RANKED | auto | threshold | 2026-04-26 |

- pokepoke/RANKED は `management_mode='auto'` だが Limitless 由来行 52行 + manual 24行が共存。`management_mode` は category 自動判定ロジックの切替に使われるだけで、Limitless 同期は format に依らず両 format に流れている。
- dm 側は Limitless 同期対象外 (`limitless_last_synced_at IS NULL`)

### 3.7 関連 RPC 一覧

```
_recalculate_opponent_decks_internal
apply_limitless_snapshot
auto_add_opponent_deck
get_global_opponent_deck_detail_stats
get_global_opponent_deck_stats_range
get_opponent_deck_suggestions
get_personal_opponent_deck_detail_stats
get_personal_opponent_deck_stats_range
get_team_opponent_deck_detail_stats
get_team_opponent_deck_stats_range
mark_limitless_sync_error
recalculate_opponent_decks
run_daily_opponent_deck_batch
trg_battles_auto_add_opponent_deck
```

- 集計系 RPC (`get_*_opponent_deck_*`) は `opponent_deck_name` / `name` 文字列をキーに集計しているだけなので、ロジック自体は変更不要 (名前空間が空白なし日本語に揃うだけ)
- `auto_add_opponent_deck(p_deck_name, p_format, p_game_title)` は `opponent_deck_master.name` と直接照合する → 入力する `p_deck_name` 側を `stripAllWhitespace` した値で渡せば衝突なし
- `apply_limitless_snapshot` の照合キー変更が本 plan の中核改修

### 3.8 share / detection_alerts / quality_scoring

```
public.battles.my_deck_name
public.battles.opponent_deck_name
```

`%opponent_deck%` / `%deck_name%` の column は上 2 つのみ。`shares.share_data` (JSON) には対面デッキ名が埋め込まれる可能性があるが、これは既存 OGP / share カード機能上 **古い表示でも許容** とユーザーから事前同意あり (§1 「既存の分析詳細URLや共有リンクが壊れることは許容」)。

## 4. 影響範囲ファイル一覧

### 4.1 新規追加

- `supabase/migrations/<timestamp>_canonicalize_opponent_deck_name.sql`
  - Phase 1 (Expand): `opponent_deck_master.name` の正規化 + battles 同期 UPDATE + `apply_limitless_snapshot` 改修 + CHECK 制約追加
  - 中身は §6 で詳述
- `docs/reports/2026-05-19_opponent_deck_name_canonicalization.md` — 実装後の報告書 (実装時に作成)

### 4.2 編集

#### DB / SQL
- `supabase/migrations/20260421000001_limitless_sync.sql` — **直接編集しない**。新 migration で `apply_limitless_snapshot` を CREATE OR REPLACE する
- `supabase/migrations/20260512000002_add_check_constraints.sql` — **直接編集しない**。新 migration で CHECK を追加

#### TypeScript / フォーム
- `src/lib/actions/battle-actions.ts:25-39` — `recordBattle()` 内で `opponentDeckName` を `stripAllWhitespace` 後に保存
- `src/lib/actions/battle-actions.ts:60-90` — `updateBattle()` 内で `opponentDeckName` を `stripAllWhitespace` 後に保存
- `src/lib/actions/admin-actions.ts:60-81` — `addOpponentDeck()` の `name.trim()` を `stripAllWhitespace` に置換
- `src/lib/actions/admin-actions.ts:83-94` — `updateOpponentDeck()` も同様に `stripAllWhitespace`
- `src/lib/actions/admin-actions.ts:142-155` — `updateOpponentDeckNameJa()` を **改修**: 内部で **新規 SECURITY DEFINER RPC `admin_update_opponent_deck_name_ja(p_id, p_name_ja)` を呼ぶだけ** に変更する (Codex review P1 / 再レビュー P1 反映)。クライアント側 (`createClient()`) の anon key + RLS 権限では `battles.opponent_deck_name` の他ユーザー行を UPDATE できないため、admin 判定 / 衝突 pre-check / `opponent_deck_master` 更新 / `battles` 同期 UPDATE を 1 transaction で完結させる SECURITY DEFINER RPC を migration で追加する (詳細 §6.6)。
  - 背景: Resolved Decisions [name再計算規則] で「admin 手動 name_ja を canonical name に優先反映」を確定したが、現行実装は `name_ja` / `name_ja_is_manual` のみ更新で `name` には反映されない。次回 Limitless sync が走るまで `name` が古いままになり、`LIMITLESS_HTML_SYNC_PAUSED=true` 中は永続的にずれる。
  - TS 側仕様: `updateOpponentDeckNameJa(id, nameJa)` は (a) `await supabase.rpc('admin_update_opponent_deck_name_ja', { p_id: id, p_name_ja: nameJa })` を呼び、(b) RPC が `RAISE EXCEPTION 'name collision: ...'` で reject した場合は `throw new Error('対面デッキ名が既に存在します: ' + computedName)` 相当のメッセージに変換して UI 側に投げる。trim / stripAllWhitespace / 衝突 pre-check / battles 同期 UPDATE は **すべて RPC 内部** で実施 (RLS bypass しないと battles UPDATE が落ちる)。
  - 検証要件: admin UI から手動 name_ja を編集した直後に、該当デッキの統計画面 / 履歴 / OGP の表示が新 name で揃うことを実機確認 (§9.4 ユーザー必須項目に追加)。Limitless 同期再開後に admin override 行が `name_ja_is_manual = true` 保護で `payload.name_ja` 無視され続けること、`name_ja_is_manual = false` に戻した行は次回 sync で payload に追従することを確認。
- `src/lib/pokepoke/limitless-sync.ts:89-105` — 現行 `stripAllWhitespace(nameJa)` 適用箇所 (line 91-92 の `cleanedNameJa` を生成して payload の `name_ja` に渡している処理) を **削除**し、`name_ja` は `translateDeckName(r.name_en)` の **raw 翻訳結果 (空白あり) のまま** payload に渡す。アプリ内正式名 `name` の正規化 (空白削除) は Server 側 `apply_limitless_snapshot` で `computed_name` として一元算出する設計に統一する (TS 側で先に削るとサーバ側ロジックと二重正規化になり、`name_ja` の翻訳ラベルとしての元データ情報が失われ、admin 画面で「翻訳結果に空白がない不自然な表示」が固定化される。また Resolved Decisions [name再計算規則] の `name_ja_is_manual = true` 時のフォールバック (`stripAllWhitespace(<既存 name_ja>)`) も元データ保持を前提とする)
- `src/components/battle/BattleRecordForm.tsx:160` — `opponentDeck.trim()` を `stripAllWhitespace(opponentDeck)` に置換 (DB 書き込み payload)
- `src/components/battle/BattleRecordForm.tsx:142-143` — `getOpponentMemoSuggestions(opponentDeck.trim(), game)` の引数を `stripAllWhitespace(opponentDeck)` に置換 (`battles.opponent_deck_name` を eq 検索する用途のため、正規化済み DB 値と一致させる必要あり)
- `src/components/battle/BattleRecordForm.tsx:320` — `deleteOpponentMemoSuggestion(opponentDeck.trim(), memo, game)` の第 1 引数を `stripAllWhitespace(opponentDeck)` に置換 (同 eq 検索)
- `src/components/battle/BattleRecordForm.tsx:153 / 226 / 299 / 362 / 373 / 384` — submit ボタン disabled 判定や表示制御の `!opponentDeck.trim()` / `opponentDeck.trim().length` を `stripAllWhitespace(opponentDeck)` ベースに揃える (ZWSP のみ入力など `.trim()` で残るケースを統一して空入力扱いにする)
- `src/components/battle/EditBattleModal.tsx:145` — `opponentDeckName.trim()` を `stripAllWhitespace(opponentDeckName)` に置換 (DB 書き込み payload)
- `src/components/battle/EditBattleModal.tsx:86-87` — `getOpponentMemoSuggestions(opponentDeckName.trim())` の引数を `stripAllWhitespace(opponentDeckName)` に置換、**かつ第 2 引数に `game` を追加** (`getOpponentMemoSuggestions(stripAllWhitespace(opponentDeckName), game)`)。現行は game 未指定で default 'dm' になっており、pokepoke 編集時に dm のメモ候補が返る不具合がある。EditBattleModal は props 経由で既に `game` を持っているので渡せる (Codex review P2 反映)
- `src/components/battle/EditBattleModal.tsx:237` — `deleteOpponentMemoSuggestion(opponentDeckName.trim(), memo)` の第 1 引数を `stripAllWhitespace(opponentDeckName)` に置換、**かつ第 3 引数に `game` を追加** (`deleteOpponentMemoSuggestion(stripAllWhitespace(opponentDeckName), memo, game)`)。EditBattleModal:86-87 と同じ理由で default 'dm' フォールバックを防ぐ (Codex review P2 反映)
- `src/components/battle/EditBattleModal.tsx:306` — submit disabled 判定の `!opponentDeckName.trim()` を `stripAllWhitespace(opponentDeckName)` ベースに揃える
- `src/components/battle/OpponentDeckSelector.tsx` — 候補表示・検索は **変更しない** (`displayDeckName` 撤去後に直接 `name` 表示で OK)。ただし将来 `displayDeckName` を撤去するための呼び出し置換のみ実施

#### 表示系 (displayDeckName 撤去)
- `src/lib/actions/opponent-deck-display.ts` — **ファイル本体を削除** (Resolved Decisions [撤去戦略] §13.1 で「本PRで完全撤去」確定済み、no-op 互換シムは残さない)。`displayDeckName()` / `getOpponentDeckNameMap()` / `OpponentDeckNameMap` 型 export を依存している全 caller (本 §4.2 表示系撤去ファイル一覧の 19 ファイル) から呼び出し・型 import・props 受け渡しを一括削除する
- `src/components/battle/BattleHistoryList.tsx:157` — `displayDeckName(b.opponent_deck_name, opponentDeckNameMap)` → `b.opponent_deck_name`
- `src/components/battle/BattleIntervalModal.tsx` — 同上
- `src/components/stats/OpponentDeckStatsSection.tsx` — 同上
- `src/components/stats/TrendChart.tsx` — 同上
- `src/components/stats/TrendHeatmap.tsx` — 同上
- `src/components/stats/MatchupTable.tsx` — 同上
- `src/components/stats/EncounterDonutChart.tsx` — 同上
- `src/components/stats/MatchupCard.tsx` — 同上
- `src/components/battle/OpponentDeckSelector.tsx` — `displayDeckName` 呼び出し撤去
- `src/app/pokepoke/decks/DeckList.tsx` — `displayDeckName` 呼び出し撤去
- `src/app/pokepoke/stats/page.tsx` / `src/app/pokepoke/stats/opponent/[deckName]/page.tsx` / `src/app/pokepoke/stats/deck/[deckName]/page.tsx` — `displayDeckName` / `getOpponentDeckNameMap` 撤去
- `src/app/pokepoke/battle/page.tsx` — `getOpponentDeckNameMap` 呼び出し (2 箇所) + `nameMap` state + `BattleTabsView` への `opponentDeckNameMap` prop 受け渡しを撤去
- `src/app/pokepoke/decks/page.tsx` — `getOpponentDeckNameMap` 呼び出し + `nameMap` state + `DeckList` への `opponentDeckNameMap` prop 受け渡しを撤去
- `src/components/battle/BattleTabsView.tsx` — `OpponentDeckNameMap` 型 import + `opponentDeckNameMap?` prop + 子コンポーネントへの prop 受け渡しを撤去
- `src/components/stats/TuningStatsSection.tsx` — `OpponentDeckNameMap` 型 import + `opponentDeckNameMap?` prop + 子コンポーネントへの prop 受け渡しを撤去
- `src/components/battle/BattleRecordForm.tsx` — `OpponentDeckNameMap` 型 import + `opponentDeckNameMap?` prop + `OpponentDeckSelector` への `nameMap={opponentDeckNameMap}` + `BattleIntervalModal` への `opponentDeckNameMap={opponentDeckNameMap}` 受け渡しを撤去
- `src/components/battle/EditBattleModal.tsx` — `OpponentDeckNameMap` 型 import + `opponentDeckNameMap?` prop + `OpponentDeckSelector` への `nameMap={opponentDeckNameMap}` 受け渡しを撤去

#### OGP / share
- `src/app/api/og/[id]/route.tsx:40-64` — encounterDistribution の `name` は新正規化 name (空白なし日本語) になる。表示崩れの可能性を確認 (フォントサイズ調整等は不要見込み、長文ケースは既存処理で対応)

### 4.3 触らない (scope 外確定)

- `src/lib/pokepoke/deck-translator.ts` — `translateDeckName` のロジック改修なし
- `src/lib/pokepoke/pokemon-names.json` — 翻訳辞書改修なし
- `src/lib/util/whitespace.ts` — `stripAllWhitespace` ロジックそのまま再利用
- `src/lib/actions/admin-actions.ts:142-155` の `updateOpponentDeckNameJa` 内での `name_ja` 自体への空白削除は適用しない (name_ja は翻訳ラベルとして空白許容のまま)。ただし **canonical key `name` 即時反映 + 衝突 pre-check + battles 同期 UPDATE は §4.2 で改修対象に含める** (Codex review P1 で plan に追加。「scope 外」ではない)
- `src/app/dm/*` の対面デッキ関連 UI — dm は元々 name=日本語空白なしなので新ロジックでも自然に動く
- 既存 share の URL 仕様 / OGP 画像内容
- `decks.name` / `battles.my_deck_name` 周りの追加変更

## 5. 設計方針 (核心)

### 5.1 opponent_deck_master の各列の意味再定義

| 列 | 新しい意味 | 制約 |
|---|---|---|
| `name` | **アプリ内正式名 (全 source 共通)**: 空白なし日本語名 (Limitless 由来は翻訳成功時、それ以外は元入力を空白除去) | NOT NULL, 1〜80字, 全空白を含まない (CHECK), `(name, format, game_title)` UNIQUE |
| `name_ja` | 翻訳由来の日本語ラベル (空白許容、表示用補助情報) | NULL 許容、現行どおり (CHECK 追加なし) |
| `name_en` | Limitless の英語元データ (UPSERT 照合キーとしても使用) | NULL 許容、現行どおり |
| `limitless_deck_slug` | Limitless 内部 slug (UPSERT 照合キー primary) | NULL 許容、現行どおり |
| `name_ja_is_manual` | admin が name_ja を手動編集したか (`true` の場合は `name` 再計算にも **admin 手動編集を優先的に反映**: `computed_name := stripAllWhitespace(<既存行の name_ja>)` で算出。Resolved Decisions [name再計算規則] / §5.4 / §6.4 step 3 参照) | 現行どおり |

→ `name` は **アプリ内で安定するキー**。`name_ja` / `name_en` は補助。

### 5.2 name の決定ロジック

source 別:

- **Limitless 由来** (`source='limitless'`):
  - `name = stripAllWhitespace(translateDeckName(name_en) or name_en)`
  - 翻訳成功 (`name_ja IS NOT NULL`) → 日本語空白なし
  - 翻訳失敗 (`name_ja IS NULL`) → 英語空白なし (フォールバック)
- **manual 由来** (`source='manual'`):
  - `name = stripAllWhitespace(admin が入力した name)`
- **trigger 経由の自動追加** (実態は `source='manual'`、`opponent_deck_master.source` の DEFAULT 'manual' のまま INSERT される。§3.1 で示したとおり該当行は現状 0 件):
  - `name = stripAllWhitespace(battles.opponent_deck_name)` (`auto_add_opponent_deck` trigger 経由で入力)
  - 入力時点で `stripAllWhitespace` 済みのはずなのでそのまま
  - 注: 旧文書では 'auto_battle 由来' と表記していたが、`auto_add_opponent_deck` (`20260513000003_auto_add_opponent_deck_revoke.sql`) は INSERT 時に source 列を明示せず DEFAULT 'manual' が使われるため、実際の source 値は 'manual' になる

### 5.3 apply_limitless_snapshot の照合キー変更

現行最新定義 (`supabase/migrations/20260509000001_secure_rpc_permissions.sql` 1-1 セクション、RETURNS jsonb / SECURITY DEFINER SET search_path = '' / REVOKE PUBLIC・anon・authenticated + GRANT service_role 付き):
```sql
ON CONFLICT (name, format, game_title) DO UPDATE …
```

新仕様:
1. まず `limitless_deck_slug = p_slug AND format = p_format AND game_title = p_game_title` で既存行検索
2. 見つからなければ `name_en = p_name_en AND format = p_format AND game_title = p_game_title AND source = 'limitless'` で再検索 (slug が変わるケースを救う)
3. 見つかれば UPDATE (limitless 列 + name_en + name_ja を更新、name は §5.4 のルールで再計算)
4. 見つからなければ INSERT (新規 Limitless デッキ)

→ `(name, format, game_title)` UNIQUE 制約は残しつつ、UPSERT 経路を slug primary に切り替える。

### 5.4 apply_limitless_snapshot の name 再計算ポリシー

**選択肢:**
- 案 A: `name = stripAllWhitespace(translated_name_ja or name_en)` を毎回再計算 (翻訳改善に追従)
- 案 B: 既存行の `name` は変更しない、新規 INSERT 時のみ計算 (battles との整合保持)
- 案 C: 案 A + name 変動を検知したら `battles.opponent_deck_name` を旧 → 新に UPDATE (一貫性最優先)

→ **採用方針 (Resolved Decisions §5.4 / §13.2 参照): 案 C (毎回再計算 + battles 同期 UPDATE)**。ただし `name_ja_is_manual = true` の行は `computed_name := stripAllWhitespace(<既存行の name_ja>)` で **admin 手動編集を優先** (Limitless payload の name_ja は無視)。さらに `computed_name` が同 `(format, game_title)` 内の他行 `name` と衝突した場合は `RAISE EXCEPTION` で transaction 全体を rollback し、`mark_limitless_sync_error` で記録する (自動 merge しない)。詳細は本ファイル末尾 `## Resolved Decisions` セクション参照。

### 5.5 CHECK 制約

新規追加:
```sql
ALTER TABLE public.opponent_deck_master
  ADD CONSTRAINT opponent_deck_master_name_no_whitespace_check
  CHECK (name !~ '[[:space:]　​-‍﻿]');

ALTER TABLE public.battles
  ADD CONSTRAINT battles_opponent_deck_name_no_whitespace_check
  CHECK (opponent_deck_name !~ '[[:space:]　​-‍﻿]');
```

- パターンは `decks.name` / `battles.my_deck_name` で使用済みのものと同一 (`supabase/migrations/20260519000001_*.sql` 参照)
- `stripAllWhitespace` (TS) と完全一致するパターン

### 5.6 getOpponentDeckNameMap / displayDeckName の去就

`name` が全 source 共通で日本語空白なしになるため、`displayDeckName(name, map)` の役目 (英語 name を日本語 name_ja に変換表示) は不要。

撤去戦略 (Resolved Decisions [撤去戦略] §13.1 で確定: **本PRで完全撤去**):
- `src/lib/actions/opponent-deck-display.ts` 本体を **削除** (no-op 互換シムも残さない)
- `displayDeckName` / `getOpponentDeckNameMap` / `OpponentDeckNameMap` / `opponentDeckNameMap` の全 caller (§4.2 表示系撤去ファイル一覧の 19 ファイル) から呼び出し・型 import・props 受け渡しを一括削除
- 最後に `rg "displayDeckName|getOpponentDeckNameMap|OpponentDeckNameMap|opponentDeckNameMap"` で残存ゼロを確認 (検証 §9.1 に組み込む)

→ 詳細は plan ファイル末尾 `## Resolved Decisions` セクション参照。

## 6. Migration 設計

### 6.1 Phase 構成

破壊的変更を含むため expand → migrate → contract の 3 段階を 1 migration ファイル内に収める (本番 1 回適用で完結):

**Phase E (Expand):**
1. 衝突 case (§6.2) の事前 merge: 衝突 manual 行 (name='メガチルタリスexププリン', source='manual') に紐づく battles を Limitless 由来正規化 name に統合 UPDATE (`opponent_deck_name IN ('メガチルタリスexププリン','Mega Altaria ex Igglybuff')` → `'メガチルタリスexププリン'`)
2. 衝突 manual 行を **先に** DELETE (UNIQUE 衝突を回避するため Phase E3 より前に行う)
3. Limitless 由来行の `name` を `stripAllWhitespace(name_ja)` で UPDATE (翻訳失敗行は `stripAllWhitespace(name_en)`)
4. manual 由来行 (1 件のみ該当: `アローラキュウコンex シザリガー`) の `name` を `stripAllWhitespace(name)` で UPDATE
5. `battles.opponent_deck_name` を新 `name` で UPDATE (詳細 §6.3)
6. `apply_limitless_snapshot` を新仕様で CREATE OR REPLACE

**Phase C (Contract):**
7. CHECK 制約 `opponent_deck_master_name_no_whitespace_check` 追加
8. CHECK 制約 `battles_opponent_deck_name_no_whitespace_check` 追加

※ 衝突 manual 行 DELETE は Phase E2 で **既に実施済み** (UNIQUE 衝突回避のため Phase E1 / E3 より前に倒した)。

### 6.2 衝突 case の merge 手順

```sql
-- pokepoke/RANKED の「メガチルタリスexププリン」(manual) を Limitless 行に統合
-- step 1: 該当 battles を Limitless 由来の正規化 name に揃える
--   ・"メガチルタリスexププリン" → "メガチルタリスexププリン" (no change)
--   ・"Mega Altaria ex Igglybuff" → "メガチルタリスexププリン"
UPDATE public.battles
SET opponent_deck_name = 'メガチルタリスexププリン'
WHERE game_title = 'pokepoke'
  AND format = 'RANKED'
  AND opponent_deck_name IN ('メガチルタリスexププリン', 'Mega Altaria ex Igglybuff');

-- step 2: Limitless 行の name を確定 (Phase E3 で実施される — §6.1 参照、§6.2 自体は Phase E1)
-- step 3: 衝突 manual 行を DELETE (Phase E2 で実施: §6.1 参照、UNIQUE 衝突回避のため E3 の Limitless name UPDATE より前に倒す)
DELETE FROM public.opponent_deck_master
WHERE id = 'ea0b15de-…'::uuid;
```

※ 上記の `ea0b15de-…` は migration 内では `WHERE name = 'メガチルタリスexププリン' AND format = 'RANKED' AND game_title = 'pokepoke' AND source = 'manual'` で安全に絞り込む (id 直書きしない)。

### 6.3 battles.opponent_deck_name の正規化

```sql
-- 全 battles に対して name 突合 → 新正規化 name に UPDATE
WITH new_names AS (
  SELECT
    b.id AS battle_id,
    COALESCE(
      m_slug.new_name,
      m_name_en.new_name,
      m_name.new_name,
      regexp_replace(b.opponent_deck_name, '[[:space:]　​-‍﻿]', '', 'g')
    ) AS new_opponent_deck_name
  FROM public.battles b
  -- master 側で limitless 由来は name_en / slug 両方マッチを試す
  LEFT JOIN (
    SELECT format, game_title, name_en, name AS new_name
    FROM public.opponent_deck_master
    WHERE source = 'limitless'
  ) m_name_en
    ON m_name_en.format = b.format
   AND m_name_en.game_title = b.game_title
   AND m_name_en.name_en = b.opponent_deck_name
  -- manual 由来は元 name でマッチ (新 name に migration 済みの場合は no-op)
  LEFT JOIN (
    SELECT format, game_title, name, name AS new_name
    FROM public.opponent_deck_master
    WHERE source = 'manual'
  ) m_name
    ON m_name.format = b.format
   AND m_name.game_title = b.game_title
   AND m_name.name = regexp_replace(b.opponent_deck_name, '[[:space:]　​-‍﻿]', '', 'g')
  -- slug 直接保存ケースは現在なし、将来用に余地として残す
  LEFT JOIN (SELECT NULL::text AS new_name, NULL::text AS format, NULL::text AS game_title LIMIT 0) m_slug
    ON FALSE
)
UPDATE public.battles b
SET opponent_deck_name = nn.new_opponent_deck_name
FROM new_names nn
WHERE nn.battle_id = b.id
  AND b.opponent_deck_name <> nn.new_opponent_deck_name;
```

→ 実行順序として **「opponent_deck_master の name 正規化を先に終わらせてから battles を UPDATE」** が必須。これは Phase E1, E2, E3, E4 の後で E5 として実行 (§6.1 の番号付けに準拠)。

### 6.4 apply_limitless_snapshot RPC の新定義 (擬似コード)

```sql
CREATE OR REPLACE FUNCTION public.apply_limitless_snapshot(
  p_game_title text,
  p_format text,
  p_rows jsonb,
  p_synced_at timestamptz DEFAULT now()
) RETURNS jsonb   -- 現行と同じ {count, synced_at} を返す signature を維持
LANGUAGE plpgsql
SECURITY DEFINER  -- 必須 (公開ブロッカー hardening 20260509000001 由来)
SET search_path = ''  -- 必須
AS $func$
DECLARE
  v_settings record;
  r jsonb;
  existing_id uuid;
  computed_name text;
  v_old_name text;                       -- UPDATE 直前の既存 name を保持 (battles 同期 UPDATE で old_name → new_name にも揃えるため)
  v_name_changes jsonb := '[]'::jsonb;   -- 各 row の {old_name, new_name, name_en} を蓄積 (loop 終了後の battles UPDATE 材料)
  v_count int := 0;
BEGIN
  -- 設定 row 取得 (現行と同じ)
  SELECT * INTO v_settings
  FROM public.opponent_deck_settings
  WHERE game_title = p_game_title AND format = p_format;
  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'settings row not found for game_title=%, format=%', p_game_title, p_format;
  END IF;
  -- 全行を行ごとに loop (現行と同じ構造)
  FOR r IN SELECT jsonb_array_elements(p_rows) LOOP
    -- step 1: slug 一致で既存検索
    SELECT id INTO existing_id
    FROM public.opponent_deck_master
    WHERE format = p_format
      AND game_title = p_game_title
      AND limitless_deck_slug = r->>'slug';

    -- step 2: なければ name_en で再検索
    IF existing_id IS NULL THEN
      SELECT id INTO existing_id
      FROM public.opponent_deck_master
      WHERE format = p_format
        AND game_title = p_game_title
        AND source = 'limitless'
        AND name_en = r->>'name_en';
    END IF;

    -- step 3: 新 name 算出 (Resolved Decisions §5.4 準拠)
    --   name_ja_is_manual = true の行: 既存 name_ja から算出 (admin 手動を優先、payload 無視)
    --   それ以外: payload の name_ja (なければ name_en) から算出
    IF existing_id IS NOT NULL THEN
      SELECT
        CASE
          WHEN name_ja_is_manual
            THEN regexp_replace(COALESCE(name_ja, name_en), '[[:space:]　​-‍﻿]', '', 'g')
          ELSE regexp_replace(COALESCE(r->>'name_ja', r->>'name_en'), '[[:space:]　​-‍﻿]', '', 'g')
        END
      INTO computed_name
      FROM public.opponent_deck_master
      WHERE id = existing_id;
    ELSE
      computed_name := regexp_replace(
        COALESCE(r->>'name_ja', r->>'name_en'),
        '[[:space:]　​-‍﻿]', '', 'g'
      );
    END IF;

    -- step 4: collision pre-check (Resolved Decisions §13.2 準拠)
    --   computed_name が同 (format, game_title) 内の他行 name と衝突したら全体 abort
    IF EXISTS (
      SELECT 1 FROM public.opponent_deck_master
      WHERE name = computed_name
        AND format = p_format
        AND game_title = p_game_title
        AND (existing_id IS NULL OR id <> existing_id)
    ) THEN
      RAISE EXCEPTION
        'apply_limitless_snapshot name collision: computed_name=%, incoming name_en=%, slug=%, existing_id=%',
        computed_name, r->>'name_en', r->>'slug',
        (SELECT id::text || ' (source=' || source || ', name_en=' || COALESCE(name_en, '') || ')'
         FROM public.opponent_deck_master
         WHERE name = computed_name AND format = p_format AND game_title = p_game_title
           AND (existing_id IS NULL OR id <> existing_id) LIMIT 1);
    END IF;

    IF existing_id IS NOT NULL THEN
      -- step 5a: UPDATE 直前に既存 name を保持 (battles 同期 UPDATE で old_name → new_name 経路にも使うため)
      SELECT name INTO v_old_name
      FROM public.opponent_deck_master
      WHERE id = existing_id;

      UPDATE public.opponent_deck_master
      SET
        name = computed_name,
        name_ja = CASE WHEN name_ja_is_manual THEN name_ja ELSE r->>'name_ja' END,
        name_en = r->>'name_en',
        limitless_deck_slug = r->>'slug',
        limitless_share = (r->>'share')::numeric,
        limitless_count = (r->>'count')::int,
        limitless_wins = (r->>'wins')::int,
        limitless_losses = (r->>'losses')::int,
        limitless_ties = (r->>'ties')::int,
        limitless_win_pct = (r->>'win_pct')::numeric,
        limitless_icon_urls = ARRAY(SELECT jsonb_array_elements_text(r->'icon_urls')),
        limitless_last_synced_at = p_synced_at,
        is_active = TRUE
      WHERE id = existing_id;

      -- step 5b: name 変動 (old_name <> computed_name) のみ v_name_changes に追加
      --   battles 側に旧 name で残っている行を新 name に統一するため
      IF v_old_name IS NOT NULL AND v_old_name <> computed_name THEN
        v_name_changes := v_name_changes || jsonb_build_array(
          jsonb_build_object(
            'old_name', v_old_name,
            'new_name', computed_name,
            'name_en', r->>'name_en'
          )
        );
      END IF;
    ELSE
      INSERT INTO public.opponent_deck_master (
        name, name_ja, name_en, source, format, game_title,
        limitless_deck_slug, limitless_share, limitless_count, limitless_wins,
        limitless_losses, limitless_ties, limitless_win_pct, limitless_icon_urls,
        limitless_last_synced_at, is_active, sort_order
      ) VALUES (
        computed_name, r->>'name_ja', r->>'name_en', 'limitless', p_format, p_game_title,
        r->>'slug', (r->>'share')::numeric, (r->>'count')::int, (r->>'wins')::int,
        (r->>'losses')::int, (r->>'ties')::int, (r->>'win_pct')::numeric,
        ARRAY(SELECT jsonb_array_elements_text(r->'icon_urls')),
        p_synced_at, TRUE, 0
      );

      -- step 5c: 新規 INSERT の場合も name_en で battles 側に残っている可能性があるため v_name_changes に追加
      --   (旧 sync で英語名のまま保存された battles を新 INSERT の name に統一)
      v_name_changes := v_name_changes || jsonb_build_array(
        jsonb_build_object(
          'old_name', NULL,
          'new_name', computed_name,
          'name_en', r->>'name_en'
        )
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- (2) 今回スナップショットに含まれなかった既存 limitless 行は is_active=false に
  --     現行 20260509000001 セクション 1-1 (2) と同一ロジックをそのまま流用
  UPDATE public.opponent_deck_master
  SET is_active = false
  WHERE game_title = p_game_title
    AND format = p_format
    AND source = 'limitless'
    AND (limitless_last_synced_at IS NULL OR limitless_last_synced_at < p_synced_at);

  -- (3) classification_method に応じて category 再計算 (現行 1-1 (3) を流用)
  -- (4) sort_order を category 順 → share 降順で振り直し (現行 1-1 (4) を流用)
  -- (5) settings 側の同期状態を更新 (現行 1-1 (5) を流用)
  -- ※ 上記 (3)(4)(5) は本擬似コードでは省略しているが、新 migration では
  --   20260509000001_secure_rpc_permissions.sql の 1-1 セクション (3)(4)(5) を
  --   コピーペーストで含めること (省略不可)。

  -- §5.4 案 C: name 変動時 battles を同期 UPDATE
  --   v_name_changes (loop 内で蓄積した {old_name, new_name, name_en} 配列) を元に、
  --   battles.opponent_deck_name が **旧 name (old_name)** か **英語名 (name_en)** で残っている行を新 name に置き換える。
  --   - old_name 経路: 前回 sync 後に翻訳改善で name が変わったケース (旧日本語名 → 新日本語名)
  --   - name_en 経路: 旧 sync 以前の英語名のまま保存された battles (初回 migration 直後 / Limitless 同期前の自由入力)
  --   両方を OR で見ることで「英語名と旧日本語名の混在」を同時に解消する。
  --   新 name と一致している行は WHERE で除外して空 UPDATE を避ける。
  WITH name_map AS (
    SELECT
      (x->>'old_name') AS old_name,
      (x->>'new_name') AS new_name,
      (x->>'name_en')  AS name_en
    FROM jsonb_array_elements(v_name_changes) AS x
  )
  UPDATE public.battles b
  SET opponent_deck_name = nm.new_name
  FROM name_map nm
  WHERE b.format = p_format
    AND b.game_title = p_game_title
    AND (
      (nm.old_name IS NOT NULL AND b.opponent_deck_name = nm.old_name)
      OR (nm.name_en IS NOT NULL AND b.opponent_deck_name = nm.name_en)
    )
    AND b.opponent_deck_name <> nm.new_name;

  RETURN jsonb_build_object('count', v_count, 'synced_at', p_synced_at);
END;
$func$;

-- 公開ブロッカー hardening を維持: PUBLIC/anon/authenticated REVOKE + service_role GRANT
REVOKE ALL ON FUNCTION public.apply_limitless_snapshot(text, text, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_limitless_snapshot(text, text, jsonb, timestamptz)
  TO service_role;
```

※ 詳細実装は migration 作成時に現行最新 SQL (`supabase/migrations/20260509000001_secure_rpc_permissions.sql` の 1-1 セクション全体) を 1:1 で再現しつつ照合キーだけ差し替える。SECURITY DEFINER / SET search_path = '' / 末尾の REVOKE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role; も新 CREATE OR REPLACE で必ず再宣言する。

※ さらに上記擬似コードでは簡略化のために省略しているが、現行 20260509000001 で実装されている以下の防御パターンは必ず保持すること (剥がすと limitless payload 形状次第で実行時例外になる):
  1. `NULLIF(r->>'share', '')::numeric` / `NULLIF(r->>'count', '')::int` 等、数値 field は全て `NULLIF('')` でラップしてから cast する (空文字を NULL に変換)。これは INSERT / UPDATE の両方に適用する
  2. `limitless_icon_urls` は `CASE WHEN jsonb_typeof(r->'icon_urls') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(r->'icon_urls')) ELSE NULL END` で型ガードする (payload が null や非配列でも例外を出さない)
  3. INSERT の column list には `category` を含め `'other'` を明示する (現行実装と同じ初期値、後段の category 再計算ロジックで上書きされる前提)

### 6.5 migration ファイル名 / 適用順序

- ファイル名: `supabase/migrations/20260519000002_canonicalize_opponent_deck_name.sql` (既存命名規則 `YYYYMMDD000NNN_<name>.sql` の 3桁ゼロパディング sequence に準拠。直前が `20260519000001` なので次は `20260519000002`)
- 直前 migration: `20260519000001_decks_strip_whitespace_and_dedupe.sql` (2026-05-18 PR で適用済み)
- 依存:
  - `20260421000001_limitless_sync.sql` (apply_limitless_snapshot 元定義)
  - `20260512000002_add_check_constraints.sql` (既存 name CHECK)

### 6.6 admin_update_opponent_deck_name_ja RPC の新定義 (P1 関連、新規追加)

§4.2 の `updateOpponentDeckNameJa()` 改修方針に対応する DB 側 RPC。`battles.opponent_deck_name` の他ユーザー行 UPDATE には RLS bypass (`SECURITY DEFINER`) が必要なので、クライアント側で直接複数 UPDATE する設計ではなく、本 RPC で admin 判定 / 衝突 pre-check / master 更新 / battles 同期 UPDATE を 1 transaction で完結させる。

```sql
CREATE OR REPLACE FUNCTION public.admin_update_opponent_deck_name_ja(
  p_id uuid,
  p_name_ja text
) RETURNS jsonb            -- {updated_name, battles_synced} を返す (UI/log 用)
LANGUAGE plpgsql
SECURITY DEFINER           -- 必須: battles の他ユーザー行を UPDATE するため RLS bypass
SET search_path = ''       -- 必須 (公開ブロッカー hardening 共通方針)
AS $func$
DECLARE
  v_old_name text;
  v_format text;
  v_game_title text;
  v_trimmed text;
  v_computed_name text;
  v_battles_synced int := 0;
BEGIN
  -- (1) admin 判定: profiles.is_admin = true でない呼び出しは reject
  --     auth.uid() が null (anon) または profiles.is_admin = false の場合
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'forbidden: admin role required (uid=%)', auth.uid();
  END IF;

  -- (2) 既存行取得 (FOR UPDATE で同時更新を排他)
  SELECT name, format, game_title
  INTO v_old_name, v_format, v_game_title
  FROM public.opponent_deck_master
  WHERE id = p_id
  FOR UPDATE;
  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'opponent_deck_master row not found: id=%', p_id;
  END IF;

  -- (3) name_ja 正規化
  v_trimmed := trim(p_name_ja);

  IF v_trimmed = '' THEN
    -- manual override 解除: name_ja=null, name_ja_is_manual=false にし、name は不変
    --   (次回 Limitless sync で payload 由来の name_ja / name に追従できるようにする)
    UPDATE public.opponent_deck_master
    SET name_ja = NULL,
        name_ja_is_manual = false
    WHERE id = p_id;
    RETURN jsonb_build_object('updated_name', v_old_name, 'battles_synced', 0, 'cleared', true);
  END IF;

  -- (4) computed_name 算出 (TS stripAllWhitespace と同等パターン)
  v_computed_name := regexp_replace(v_trimmed, '[[:space:]　​-‍﻿]', '', 'g');
  IF v_computed_name = '' THEN
    RAISE EXCEPTION 'name_ja contains only whitespace, computed_name would be empty';
  END IF;

  -- (5) 衝突 pre-check (同 format/game_title 内の他行 name と衝突したら abort)
  IF EXISTS (
    SELECT 1 FROM public.opponent_deck_master
    WHERE name = v_computed_name
      AND format = v_format
      AND game_title = v_game_title
      AND id <> p_id
  ) THEN
    RAISE EXCEPTION
      'name collision: computed_name=%, existing_id=%',
      v_computed_name,
      (SELECT id::text || ' (source=' || source || ', name_en=' || COALESCE(name_en, '') || ')'
       FROM public.opponent_deck_master
       WHERE name = v_computed_name AND format = v_format AND game_title = v_game_title AND id <> p_id
       LIMIT 1);
  END IF;

  -- (6) opponent_deck_master 更新
  UPDATE public.opponent_deck_master
  SET name = v_computed_name,
      name_ja = v_trimmed,
      name_ja_is_manual = true
  WHERE id = p_id;

  -- (7) battles 同期 UPDATE (旧 name <> 新 name の場合のみ)
  --     SECURITY DEFINER により RLS bypass で全ユーザー行を UPDATE できる
  IF v_old_name IS NOT NULL AND v_old_name <> v_computed_name THEN
    WITH updated AS (
      UPDATE public.battles
      SET opponent_deck_name = v_computed_name
      WHERE format = v_format
        AND game_title = v_game_title
        AND opponent_deck_name = v_old_name
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_battles_synced FROM updated;
  END IF;

  RETURN jsonb_build_object(
    'updated_name', v_computed_name,
    'old_name', v_old_name,
    'battles_synced', v_battles_synced,
    'cleared', false
  );
END;
$func$;

-- 権限: anon は reject、authenticated に GRANT (RPC 内部で admin 判定して非 admin は EXCEPTION)
REVOKE ALL ON FUNCTION public.admin_update_opponent_deck_name_ja(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_opponent_deck_name_ja(uuid, text)
  TO authenticated;
```

※ TS 側 `updateOpponentDeckNameJa()` (admin-actions.ts:142-155) は `await supabase.rpc('admin_update_opponent_deck_name_ja', { p_id: id, p_name_ja: nameJa })` を呼ぶだけに変更。RPC が `RAISE EXCEPTION 'name collision: ...'` で reject した場合は `error.message` を UI に表示できるよう変換する。
※ `profiles.is_admin` カラムは `20260305000001_admin_opponent_decks.sql` で導入済 (line 2: `ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;`)。本 RPC の (1) admin 判定はこの列を SELECT してチェックする。

### 6.7 rollback / backup 方針

**自動 rollback はしない (DB レベルの破壊的変更を含むため)**。代わりに事前バックアップ + 緊急時の手動復元手順を用意。

1. **事前バックアップ** (production 適用直前):
   ```bash
   pg_dump -h db.asjqtqxvwipqmtpcatvz.supabase.co \
     -t public.opponent_deck_master \
     -t public.battles \
     --data-only --column-inserts \
     -f /tmp/before_canonicalize_$(date +%Y%m%d_%H%M).sql
   ```
   (チャットには貼らない、ローカル一時ファイル)
2. **migration 適用** (staging で先に検証 → production)
3. **検証** (§9 参照)
4. **問題発生時の復元**:
   - opponent_deck_master / battles を TRUNCATE → backup SQL を psql 経由で再挿入
   - `apply_limitless_snapshot` 旧定義に戻すには **最新 hardening 済み定義** `supabase/migrations/20260509000001_secure_rpc_permissions.sql` の 1-1 セクション (RETURNS jsonb / SECURITY DEFINER / SET search_path = '' / 末尾の REVOKE PUBLIC・anon・authenticated + GRANT service_role 付き) を再適用 (CREATE OR REPLACE 可)。20260421000001_limitless_sync.sql は origin 定義であり SECURITY hardening 前 (公開ブロッカー対応前) なので rollback 用には使わない (戻すと公開ブロッカーが再発する)
   - CHECK 制約剥がし: `ALTER TABLE … DROP CONSTRAINT opponent_deck_master_name_no_whitespace_check;` 等
   - **新規 RPC `admin_update_opponent_deck_name_ja` の DROP (Codex 再レビュー P3 反映)**:
     ```sql
     -- 権限撤去 (REVOKE は DROP 前に明示しなくても DROP 時に消えるが、念のため明示)
     REVOKE EXECUTE ON FUNCTION public.admin_update_opponent_deck_name_ja(uuid, text) FROM authenticated;
     -- 関数本体を DROP (戻すと TS 側 supabase.rpc('admin_update_opponent_deck_name_ja', ...) は失敗するため、
     --   先に admin-actions.ts:142-155 を旧実装 (name_ja のみ UPDATE) に戻す deploy を完了させてから DROP すること)
     DROP FUNCTION IF EXISTS public.admin_update_opponent_deck_name_ja(uuid, text);
     ```
     ※ TS コード rollback と DB DROP の **順序** に注意: 新コードが本 RPC を呼ぶ状態で DROP すると admin 画面の和名編集が落ちる。先に main を旧コードに revert + production deploy 完了 → 次に DROP の順で実施する
   - **database.types.ts の rollback (P1 関連)**: `Database['public']['Functions']['admin_update_opponent_deck_name_ja']` 定義を削除した状態の types.ts を再 commit。`npx supabase gen types typescript --project-id <prod>` を rollback 後の DB に対して実行すれば自動で除外される

## 7. 実装順序 (PR レベル)

dev ブランチで以下の順序で実装する。1 PR にまとめる。**Codex 再レビュー P1 反映**: 新 RPC `admin_update_opponent_deck_name_ja` を TS が `supabase.rpc()` 経由で呼ぶため、`database.types.ts` の `Database['public']['Functions']` に同 RPC の Args/Returns を含めないと型付き Supabase client (`createClient<Database>()`) の typecheck / build が落ちる。types.ts の再生成には staging DB に新 RPC が既に存在する必要があるため、**migration の staging 適用 → types 再生成 → typecheck/build → commit/push** の順を厳守する。

1. **ローカルで TS 修正 + migration ファイル作成 (commit 前のローカル編集段階)**:
   - **TS 側 sanitize 追加**: `src/components/battle/BattleRecordForm.tsx` / `EditBattleModal.tsx` / `src/lib/actions/battle-actions.ts` / `admin-actions.ts` に `stripAllWhitespace` 適用 (§4.2 詳細)。EditBattleModal の memo API 呼び出しには `game` 引数追加 (§4.2 Codex P2 反映)
   - **`src/lib/actions/admin-actions.ts:142-155` を RPC 経由に書き換え**: `updateOpponentDeckNameJa()` の中身を `await supabase.rpc('admin_update_opponent_deck_name_ja', { p_id: id, p_name_ja: nameJa })` に変更 (§4.2 / §6.6 / Resolved Decisions [name再計算規則] 反映)
   - **`src/lib/pokepoke/limitless-sync.ts` の name_ja stripAllWhitespace 削除**: `cleanedNameJa` 生成を撤去し raw 翻訳結果のまま payload の `name_ja` に渡す (§4.2 Codex P1 反映)
   - **displayDeckName / getOpponentDeckNameMap 関連 20 ファイル一括撤去**: `src/lib/actions/opponent-deck-display.ts` 本体を削除し、19 callers から呼び出し・型 import・`opponentDeckNameMap?` props を一括削除 (§4.2 / Resolved Decisions [撤去戦略] / §13.1 確定済)
   - **migration ファイル作成**: `supabase/migrations/20260519000002_canonicalize_opponent_deck_name.sql` (§6.5 命名規則準拠)。含むもの: §6.1 Phase E1-E6 + Phase C7-C8 の全 step (衝突 battles merge / 衝突 manual 行 DELETE / Limitless 行 name 正規化 / manual 行 name 正規化 / battles.opponent_deck_name 正規化 / `apply_limitless_snapshot` CREATE OR REPLACE / 2 個の CHECK 制約 ADD) と **新規 RPC `admin_update_opponent_deck_name_ja` CREATE OR REPLACE + REVOKE/GRANT** (§6.6)
2. **staging DB に migration を適用** (本番 → staging 同期後 → migration apply):
   - 詳細手順は §8 [2] / `docs/runbooks/staging-data-sync.md` 参照
   - 適用後、staging に新 RPC `admin_update_opponent_deck_name_ja` と新 CHECK 制約が存在することを確認
   - §9.2 staging DB 検証 SQL を実行 (BEGIN/ROLLBACK ガード付き、`apply_limitless_snapshot` mock 検証は inactive 化副作用回避のため必ず transaction で囲む)
3. **`database.types.ts` を staging から再生成** (§11 必須タスク):
   - `npx supabase gen types typescript --project-id uqndrkaxmbfjuiociuns > src/lib/supabase/database.types.ts`
   - 期待 diff: `Database['public']['Functions']['admin_update_opponent_deck_name_ja']` が新規追加 (`Args: { p_id: string; p_name_ja: string }`, `Returns: Json`)
4. **lint / typecheck / build 検証** (§9.1):
   - `npm run lint` (lint error 0)
   - `npx tsc --noEmit` (型エラー 0、新 RPC 呼び出しが型補完で認識される)
   - `npx opennextjs-cloudflare build` (build パス)
   - `rg "displayDeckName|getOpponentDeckNameMap|OpponentDeckNameMap|opponentDeckNameMap" src/` で残存ゼロ確認 (Resolved Decisions [撤去戦略] 検証要件)
5. **commit / push origin dev** (Cloudflare preview に自動デプロイ):
   - 1 commit で TS 修正 + migration ファイル + 再生成 types.ts をまとめる (atomic)
6. **dev preview / staging 動作確認**:
   - `https://dev-duepure-tracker.jianrenzhongtian7.workers.dev` で §9.4 ユーザー実機確認:
     - 対戦記録入力 (全角空白除去) / 履歴 / 統計 / 統計詳細 URL / 連続戦グルーピング
     - **admin 画面の和名編集 3 系統** (正常系 / 衝突系 / 解除系、§9.4 Codex P2 反映)
   - §9.2 検証 SQL の結果が想定どおりか staging で再確認 (CHECK 制約存在 / battles 正規化 / 衝突 case 統合 / mock RPC 検証 BEGIN/ROLLBACK)
7. **ユーザー OK 指示後** (CLAUDE.md ルール: 本番反映の明示指示を待つ):
   - `git checkout main && git pull origin main && git merge dev && git push origin main` → Cloudflare production deploy (3〜5 分)
   - production DB バックアップ取得 (§6.7 step 1 pg_dump 手順)
   - production DB に migration 適用 (`npx supabase db push --include-all` 等。詳細手順は §8 [9] 参照)
   - production §9.3 検証 (§9.2 とほぼ同等、mock 検証は実行しない)
   - `git checkout dev` で dev に戻す
   - 実装後の報告書 `docs/reports/2026-05-19_opponent_deck_name_canonicalization.md` 作成
   - `MEMORY.md` の `project_remaining_tasks_after_2026_05_09.md` から本タスクを削除

## 8. Migration 順序 (staging / production)

**重要原則** (CLAUDE.md `feedback_db_migration_order` より):
> コード変更を伴う migration は main 本番反映後に db push する (dev/prod 共通DBのため)

本 plan は **コード変更を伴う migration**。さらに **Codex 再レビュー P1**: 新 RPC `admin_update_opponent_deck_name_ja` を TS が呼ぶため `database.types.ts` 再生成が必須で、再生成は staging に migration 適用後でないとできない。よって従来の「コード dev push → preview → staging migration」ではなく、**staging migration を types 再生成 / typecheck より前に倒す** 順序にする。

```
[1] dev ブランチで TS 修正 + migration ファイル作成 (ローカル編集、commit 前)
[2] staging DB に migration を適用
    → npm run staging:refresh (本番→staging データ同期、必要なら)
    → STAGING_DB_URL を環境変数に設定し
       npm_config_cache=/private/tmp/npm-cache npx supabase db push --db-url "$STAGING_DB_URL" --include-all
    → 適用結果を npm_config_cache=/private/tmp/npm-cache npx supabase migration list --db-url "$STAGING_DB_URL" で確認
    → staging に新 RPC admin_update_opponent_deck_name_ja と新 CHECK 制約が存在することを確認
    → §9.2 staging DB 検証 SQL を実行 (BEGIN/ROLLBACK ガード付き)
[3] database.types.ts を staging から再生成
    npx supabase gen types typescript --project-id uqndrkaxmbfjuiociuns > src/lib/supabase/database.types.ts
    git diff src/lib/supabase/database.types.ts で
    Database['public']['Functions']['admin_update_opponent_deck_name_ja'] の追加を確認
[4] lint / typecheck / build パス確認
    npm run lint && npx tsc --noEmit && npx opennextjs-cloudflare build
    rg "displayDeckName|getOpponentDeckNameMap|OpponentDeckNameMap|opponentDeckNameMap" src/ で残存ゼロ確認
[5] commit / push origin dev → Cloudflare preview deploy (3〜5 分)
    (TS 修正 + migration ファイル + 再生成 types.ts を 1 commit にまとめる)
[6] dev preview / staging で動作確認
    https://dev-duepure-tracker.jianrenzhongtian7.workers.dev で §9.4 実機確認 (admin 名編集 3 系統含む)
[7] ユーザー OK 指示
[8] main merge + push → Cloudflare production deploy (3〜5 分)
[9] production DB バックアップ → migration 適用
    pg_dump (§6.7 step 1) → 確認 → PROD_DB_URL で supabase db push --include-all
[10] production 動作確認 (§9.3)
```

### [8] と [9] の間 (production code deploy と production migration の gap) の注意

production の code は [8] で先に新コードに切り替わるが、production DB に migration が適用されるのは [9]。この **数分〜数十分のギャップ中** に admin が和名編集を行うと、新 RPC `admin_update_opponent_deck_name_ja` が production DB にまだ存在しないため、`supabase.rpc('admin_update_opponent_deck_name_ja', …)` 呼び出しが **PostgREST 404 (function does not exist) で失敗**する。

- **影響範囲**: admin 画面の「対面デッキ和名編集」のみ。一般ユーザーの対戦記録入力 / 履歴表示 / 統計画面 / 共有 / OGP は新 RPC を呼ばないため影響なし
- **緩和策**:
  1. [8] の production deploy 完了確認後、**直ちに [9] の migration apply を実施** (数分以内、ギャップを最小化)
  2. [8] を業務時間外 (深夜帯など admin 操作が発生しにくい時間帯) に実施
  3. admin に対し「[8]-[9] 完了アナウンスまで和名編集を控えてもらう」案内
- **検出**: admin 画面で和名編集を試みて「対面デッキ名が既に存在します」以外の不明エラー (PostgREST 404 系) が出たら gap 中の現象と判断 → [9] 完了後に再試行

### その他の [8]-[9] gap 中の差分 (admin RPC 以外)

- `apply_limitless_snapshot`: 新コード (slug primary) vs 旧 DB (name primary)
  - → ただし Limitless 同期は `LIMITLESS_HTML_SYNC_PAUSED=true` で停止中なので、cron / 管理者 UI からも実質呼ばれない。安全
- `updateOpponentDeckNameJa` 以外のフォーム入力 `stripAllWhitespace`: 新コードで空白なし保存、旧 DB は CHECK 制約なし
  - → 新入力は空白なしで保存される。旧データ (空白あり) はそのまま。CHECK 適用後に違反するが、[9] で全データ正規化後の状態で適用するので OK
- displayDeckName 撤去: 新コードは name をそのまま表示。旧 DB は battles に旧 name (英語など) が残るが、[8] と [9] の間でも旧表示が続くだけで破壊的変更ではない。[9] の正規化 UPDATE で全 battles が新 name に揃って初めて完全な表示一致になる

## 9. 検証手順

### 9.1 Claude が自前で実施 (実装時)

ローカル / dev preview で:

- `npm run lint` (新 / 修正コードで lint error 0)
- `npx opennextjs-cloudflare build` (build 通過)
- `npx tsc --noEmit` (型エラー 0)
- Supabase MCP で migration の dry-run SQL を実行 (staging で `BEGIN; … ROLLBACK;` で検証)
- 新 `apply_limitless_snapshot` を staging で mock payload と共に手動実行し、INSERT / UPDATE 経路の両方を確認
- staging DB に migration 適用後の検証 SQL (§9.2) を実行

### 9.2 staging DB 検証 SQL

migration 適用後に以下を実行し、想定どおりか確認:

```sql
-- 1. 全 opponent_deck_master.name が空白なしになっている
SELECT COUNT(*) FROM public.opponent_deck_master WHERE name ~ '[[:space:]　​-‍﻿]';  -- CHECK 制約 opponent_deck_master_name_no_whitespace_check と同一パターン
-- expect: 0

-- 2. CHECK 制約が存在する
SELECT conname FROM pg_constraint
WHERE conname IN (
  'opponent_deck_master_name_no_whitespace_check',
  'battles_opponent_deck_name_no_whitespace_check'
);
-- expect: 2 rows

-- 3. battles.opponent_deck_name が空白なし & master との不整合がない
SELECT COUNT(*) FROM public.battles WHERE opponent_deck_name ~ '[[:space:]　​-‍﻿]';  -- CHECK 制約 battles_opponent_deck_name_no_whitespace_check と同一パターン
-- expect: 0

-- 4. 既存 Limitless 由来 battles が新 name に揃っている
SELECT b.opponent_deck_name, m.name, COUNT(*)
FROM public.battles b
LEFT JOIN public.opponent_deck_master m
  ON m.name = b.opponent_deck_name
 AND m.format = b.format
 AND m.game_title = b.game_title
WHERE b.game_title = 'pokepoke'
GROUP BY b.opponent_deck_name, m.name
HAVING m.name IS NULL
LIMIT 30;
-- expect: free input のみ (例:「スイクンセグレイブ」), Limitless 英語名は 0 件

-- 5. 衝突 case (メガチルタリスexププリン) が 1 行に統合済み
SELECT id, name, source FROM public.opponent_deck_master
WHERE name = 'メガチルタリスexププリン'
  AND format = 'RANKED'
  AND game_title = 'pokepoke';
-- expect: 1 row (source = 'limitless')

-- 6. apply_limitless_snapshot のテスト呼び出し
-- ⚠️ apply_limitless_snapshot 内部の (2) inactive flagging 処理 (`UPDATE … SET is_active = false WHERE limitless_last_synced_at < p_synced_at`) により、
--    payload に含まれない既存 limitless 行が **すべて is_active=false になる副作用** がある。
--    1〜2 件の mock payload をそのまま呼ぶと staging の既存 52 行 (RANKED) / 52 行 (RANDOM) が一括 inactive 化される。
--    検証時は **必ず BEGIN; ... ROLLBACK;** で囲んで副作用を巻き戻すこと。
--    あるいは **full snapshot fixture** (staging に存在する全 limitless 行を再現する 52 行分 + テスト追加 1 件) を
--    payload に組み立てれば inactive 化を回避できるが、fixture 構築コストが高いので通常は BEGIN/ROLLBACK 推奨。
--
--    NOTE: BEGIN/ROLLBACK の場合、テストデータも自動で巻き戻るため明示 DELETE は不要。
--          ただし RAISE EXCEPTION で abort されたケースでは ROLLBACK が自動発生済なので psql 側で `ROLLBACK;` を打つだけで OK。

BEGIN;  -- ⚠️ 必須: inactive flagging 副作用を巻き戻す

-- a) 既存 slug → UPDATE 経路
SELECT public.apply_limitless_snapshot(
  'pokepoke', 'RANKED',
  '[{
    "name_en": "Mega Altaria ex Igglybuff",
    "name_ja": "メガチルタリスex ププリン",
    "share": 5.0, "count": 100, "wins": 50, "losses": 40, "ties": 10,
    "win_pct": 55.5, "icon_urls": [],
    "slug": "mega-altaria-ex-b1-igglybuff-a4a"
  }]'::jsonb,
  now()
);
-- expect: 既存行 UPDATE、新規 INSERT なし
-- expect: payload に含まれない残り 51 行は is_active=false に flip するが、ROLLBACK で巻き戻る

-- b) 新規 slug → INSERT 経路
SELECT public.apply_limitless_snapshot(
  'pokepoke', 'RANKED',
  '[{
    "name_en": "Test New Deck ex",
    "name_ja": "テスト 新規 デッキex",
    "share": 0.1, "count": 5, "wins": 3, "losses": 2, "ties": 0,
    "win_pct": 60.0, "icon_urls": [],
    "slug": "test-new-deck-ex-test01"
  }]'::jsonb,
  now()
);
SELECT name, name_ja FROM public.opponent_deck_master
WHERE limitless_deck_slug = 'test-new-deck-ex-test01';
-- expect: name = 'テスト新規デッキex' (空白なし), name_ja = 'テスト 新規 デッキex' (空白あり)

ROLLBACK;  -- ⚠️ 必須: テストデータと inactive flip をすべて巻き戻す

-- 7. detection / stats RPC の sanity check
-- get_personal_opponent_deck_stats_range の実シグネチャは (p_start_date date, p_end_date date, p_format text)。
-- user_id は auth.uid() で内部解決され、game_title は p_format='RANKED' で pokepoke にスコープされる
-- (format コードのゲーム間重複なし前提、CLAUDE.md マルチゲーム対応設計 §RPC のゲームスコープ分離方針)。
-- 認証ユーザーとして psql で実行できないため、Supabase SQL Editor の Authenticated mode
-- もしくは TypeScript 経由 (supabase.rpc(...)) で実行する。
SELECT * FROM public.get_personal_opponent_deck_stats_range(
  '2026-01-01'::date, '2026-05-19'::date, 'RANKED'
) LIMIT 5;
-- expect: deck_name 列が空白なし日本語で返ってくる (RETURNS TABLE の列名は opponent_deck_name ではなく deck_name)
```

### 9.3 production DB 検証

staging と同じ §9.2 を production に対しても実行。差分:
- 6 (apply_limitless_snapshot mock 呼び出し) は **本番では実行しない** (テストデータが混入するため、staging のみで検証)
- 代わりに `recalculate_opponent_decks('RANKED', 'pokepoke')` を 1 回手動実行して category 再計算が走るか確認

### 9.4 ユーザー必須 (実機ブラウザ)

dev preview (`https://dev-duepure-tracker.jianrenzhongtian7.workers.dev`) で以下:

- 対戦記録の自由入力で「テスト　デッキ」(全角スペース含む) を入力 → 保存後に履歴で「テストデッキ」と表示される
- 統計画面の対面デッキ一覧で、旧 Limitless 英語名 (例「Mega Altaria ex Igglybuff」) が日本語空白なし (「メガチルタリスexププリン」) で表示される
- 統計詳細画面の URL `/pokepoke/stats/opponent/メガチルタリスexププリン` がエラーなく表示される
- admin 画面の対面デッキ追加で「テスト デッキ」を入力 → 「テストデッキ」で保存される
- 対戦履歴の「同じデッキで連続戦」グルーピングが正しく動く
- **(Codex 再レビュー P2 / §4.2 P1 改修対応) admin 画面で既存対面デッキの `name_ja` を編集**:
  - **正常系**: 例えば pokepoke RANKED の Limitless 由来行 `name_ja = "メガチルタリスex ププリン"` を `"テスト 編集 名"` に変更 → 保存成功後、(a) 該当 master 行の canonical `name` が `テスト編集名` (空白なし) になっていること、(b) 統計画面の対面デッキ一覧で同行が `テスト編集名` で表示されること、(c) 該当デッキを対戦相手にした既存 battles の履歴一覧でも `テスト編集名` で表示されること、(d) 統計詳細 URL `/pokepoke/stats/opponent/テスト編集名` がエラーなく表示されること、(e) admin 画面の `name_ja_is_manual` フラグが true になっていることを確認
  - **衝突系**: 同じ format/game_title 内の他行と canonical `name` が衝突する `name_ja` (例: 別行と stripAllWhitespace 結果が同じになる値) を編集して保存 → `RAISE EXCEPTION 'name collision: ...'` 由来のエラーが UI に表示され、保存が失敗 (DB 側は元の状態のまま、battles も変動なし) することを確認
  - **解除系**: `name_ja` を空文字に編集して保存 → `name_ja=null` / `name_ja_is_manual=false` になり、canonical `name` は変動しないこと (manual override 解除のみ) を確認

## 10. risks / トレードオフ

1. **既存 share URL の互換性**: `/[game]/stats/opponent/{old英語名}` への直リンクが 404 になる
   - 対策: 既知の許容事項。実装後の周知のみ。
2. **OGP 画像のキャッシュ**: Discord 等にシェア済みの OGP 画像内に古い対面デッキ名が残る
   - 対策: 既知の許容事項。Cloudflare / Discord 側のキャッシュ TTL 経過後に新画像に置換される。
3. **apply_limitless_snapshot 案 C 採用時の battles 同期 UPDATE のコスト**:
   - 現行 production の battles 件数は 422 件 (dm+pokepoke 合計)。Limitless 同期 1 回あたりの UPDATE 想定件数は 0〜数件で軽量。
   - 案 C は実装複雑度が増すが、将来 battles が増えても per-format で WHERE 句が絞り込まれるため線形オーダー。
4. **dm 側で `category=auto` 由来行が将来発生する場合の挙動**:
   - dm/ND は `management_mode='auto'` だが `trg_battles_auto_add_opponent_deck` trigger が `source='manual'` (DEFAULT) で trigger 由来行を生成する想定。現状 0 件。
   - 新仕様で `auto_add_opponent_deck(p_deck_name, …)` を呼ぶ際、`p_deck_name` は battles.opponent_deck_name (空白なし) になるので衝突なし。
5. **`apply_limitless_snapshot` の name 再計算ポリシー**: Resolved Decisions [name再計算規則] / §13.2 で確定済 (案 C: 毎回再計算 + battles 同期 UPDATE + admin 手動優先 + 衝突時 abort + error)。
6. **`displayDeckName` 撤去戦略**: Resolved Decisions [撤去戦略] / §13.1 で確定済 (本PRで完全撤去、no-op 互換シムは残さない)。

## 11. database.types.ts の再生成 (Codex 再レビュー P1 反映、必須タスク)

本 PR では新規 RPC **`admin_update_opponent_deck_name_ja(p_id uuid, p_name_ja text) RETURNS jsonb`** を追加するため (§6.6)、`src/lib/supabase/database.types.ts` の `Database['public']['Functions']` に同 RPC の `Args` / `Returns` 定義を追加する必要がある。`updateOpponentDeckNameJa()` (admin-actions.ts) からは `supabase.rpc('admin_update_opponent_deck_name_ja', { p_id, p_name_ja })` の形で型付き Supabase client (`createClient<Database>()`) 経由で呼ぶため、**database.types.ts に Functions 定義が無いと TypeScript build / typecheck が落ちる**。

なお `opponent_deck_master` テーブル自身のカラム構成は変更しない (name / name_ja / name_en / name_ja_is_manual / source 等は既存) ため、Tables 部分の再生成は最小差分になる見込み。ただし `apply_limitless_snapshot` の引数型 signature も `(p_game_title, p_format, p_rows, p_synced_at)` で変わらないが、内部実装の SECURITY DEFINER 改修は型に影響しないことを確認しておく。

**手順:**
```bash
# staging migration 適用後 (admin_update_opponent_deck_name_ja RPC が staging に存在する状態) に実行
npx supabase gen types typescript --project-id uqndrkaxmbfjuiociuns > src/lib/supabase/database.types.ts
git diff src/lib/supabase/database.types.ts
```

**期待される diff (最小):**
- `Database['public']['Functions']['admin_update_opponent_deck_name_ja']` が新規追加される
  - `Args: { p_id: string; p_name_ja: string }`
  - `Returns: Json` (RPC は `jsonb` を返す)
- それ以外の Tables / Views / Functions 既存定義は変動なし (もしあれば内容確認して commit に含める)

**完了条件:**
- [ ] staging migration 適用 (admin_update_opponent_deck_name_ja を含む新 migration) → types 再生成
- [ ] `npx tsc --noEmit` で型エラーゼロ
- [ ] `npm run lint` パス
- [ ] `npx opennextjs-cloudflare build` パス
- [ ] `updateOpponentDeckNameJa()` の `supabase.rpc('admin_update_opponent_deck_name_ja', ...)` 呼び出しが型補完で正しく認識される

※ production migration 適用後にも production の types を取って再 diff し、staging / production の Functions 定義が一致していることを確認 (両 DB に同 RPC が定義されている前提)。

## 12. ファイル変更行数の見積もり

| 区分 | ファイル数 | 想定行数 |
|---|---|---|
| 新規 migration | 1 | 200〜250 行 (CREATE OR REPLACE FUNCTION 含む) |
| TS sanitize 追加 | 4 | 各 1〜3 行 (合計 10 行未満) |
| displayDeckName 撤去 | 12 | 各 1〜5 行 (合計 30〜60 行) |
| 実装後の報告書 | 1 | 200〜400 行 |

→ 単一 PR で完結する規模。

## 13. scope 外論点 (escalate 候補)

### 13.1 displayDeckName / getOpponentDeckNameMap の撤去戦略

→ **確定 (Resolved Decisions [撤去戦略] 参照)**: **(a) 本 PR で完全撤去** を採用。`src/lib/actions/opponent-deck-display.ts` を削除し、全 caller から `displayDeckName` / `getOpponentDeckNameMap` / `OpponentDeckNameMap` / `opponentDeckNameMap` 呼び出し・型 import・props 受け渡しを一括削除する。no-op 互換シム残し (旧案 b) や撤去せず放置 (旧案 c) は採用しない。詳細は plan ファイル末尾 `## Resolved Decisions` セクション参照。

### 13.2 apply_limitless_snapshot の name 再計算ポリシー

選択肢:
- **(A) 毎回再計算 + battles 同期 UPDATE なし**: 翻訳辞書改善時に新 Limitless 行 name が変動、過去 battles は旧 name で残る (整合性が破れるが、新規 battles から新 name で記録される)
- **(B) 既存行不変、新規 INSERT のみ計算**: battles 整合性は確実に保たれるが、翻訳辞書改善が反映されない (admin 手動 rename が必要)
- **(C) 毎回再計算 + battles 同期 UPDATE** (推奨): 一貫性最優先。実装コストは案 A より +20〜30 行程度

→ **確定 (Resolved Decisions 参照)**: 案 C を採用。さらに `name_ja_is_manual = true` の行は admin 手動編集を優先 (computed_name = stripAllWhitespace(<既存 name_ja>))。computed_name が他行 name と衝突した場合は `RAISE EXCEPTION` で transaction 全体を rollback し、`mark_limitless_sync_error` でエラー内容を記録する。詳細は本ファイル末尾 `## Resolved Decisions` セクション参照。

### 13.3 衝突 case の merge 方針

選択肢:
- **(i) manual 行削除 + battles 統合** (推奨、§6.2 採用): Limitless 行を残し、manual 行と紐づく battles 2 件を Limitless 由来正規化 name に向ける
- **(ii) manual 行を別名にリネーム**: 例「メガチルタリスexププリン (manual)」など。データ重複が残るが既存履歴を厳密に保持

→ (i) を推奨。確認のみ。

### 13.4 既存 free input battles の扱い

dm/ND の「あ」x26, 「い」x6, 「g」x1 などのテスト/誤入力データ:
- 案 (i): そのまま `stripAllWhitespace` のみ適用 (元データ保持)
- 案 (ii): migration 内で削除

→ (i) を推奨 (誤入力もユーザーの履歴の一部、削除は別 PR で意図的に行う)。

### 13.5 translateDeckName が null を返す Limitless 行の扱い

現状は `name_ja=null` で `name=英語` だが、本 plan 適用後は `name=stripAllWhitespace(name_en)` (英語空白なし) になる。日本語名フォールバックがないので、admin が手動で `name_ja` を埋めるまでは英語空白なしのままユーザーに見える。

選択肢:
- **(I) 英語空白なしで表示** (推奨): 翻訳辞書が pokemon-names.json で網羅されている前提、null フォールバックは稀。
- **(II) 翻訳失敗時は admin に通知**: cron / sync 終了時に翻訳失敗件数を log に出力 (現状も `markError` で部分対応)

→ (I) で良いが、明示確認したい。

### 13.6 詳細統計 URL の互換性

`/pokepoke/stats/opponent/Mega Altaria ex Igglybuff` のような直リンクは migration 後 404 になる。share / Discord 投稿の互換維持はしない (許容事項として §1 に明記)。

ただし 301 redirect 等で旧名 → 新名を救う実装は技術的には可能 (`opponent_deck_master.name_en` で逆引き)。

→ 不要 (許容事項) と判断するが、念のため明示確認。

### 13.7 認可・RLS 検査

`apply_limitless_snapshot` は SECURITY DEFINER で service_role 経由実行。新仕様で SECURITY 設定を変更しない。RLS 影響なし。

## 14. 想定外の発見 (実装着手前に追加調査が必要な場合)

- pokepoke/RANDOM の battles 件数が 0 件 → migration 検証上問題なし
- `auto_add_opponent_deck` trigger 由来行 (実態は `source='manual'`、§5.2 参照) が 0 件 → trigger 経路の検証は staging で mock 投入して行う
- 衝突 case が 1 件のみ → migration の DELETE 対象も 1 行のみ、複雑な merge ロジック不要
- `quality_scoring_rules` / `detection_alerts` 等の関連テーブルに `opponent_deck_name` 文字列カラムなし → 影響範囲限定

これらは現時点で追加調査不要。

## 15. 完了条件

- [ ] dev ブランチで TS 修正 + migration ファイル commit / push
- [ ] Cloudflare preview deploy 確認
- [ ] staging DB に migration 適用 + §9.2 検証 SQL pass
- [ ] dev preview で §9.4 ユーザー実機確認 → OK 指示
- [ ] main merge + push → production deploy
- [ ] production DB バックアップ取得 → migration 適用
- [ ] production §9.3 検証
- [ ] 実装後の報告書 `docs/reports/2026-05-19_opponent_deck_name_canonicalization.md` 作成
- [ ] `MEMORY.md` の `project_remaining_tasks_after_2026_05_09.md` から本タスクを削除

## Resolved Decisions

`/review-plan-loop` 経由でユーザーが確定した判断事項。`§5.4`, `§6.4`, `§13.2` の記述はこの決定に従って読み替えること (本文の文言が未追従の場合は決定優先)。

- **[name再計算規則] (§5.4 / §13.2)** apply_limitless_snapshot の name 再計算で、admin が name_ja を手動編集 (`name_ja_is_manual=true`) した行についても canonical key `name` を Limitless payload 由来で上書きしますか? → **Admin手動を優先** を採用。
  - 理由: name はアプリ内正式名として扱う方針なので、admin が name_ja を手動編集している場合はその編集を正式名への補正意図とみなす。
  - 実装要件: `name_ja_is_manual = true` の行では `computed_name := stripAllWhitespace(<既存行の name_ja>)` を採用 (Limitless payload の name_ja は無視)。`name_ja_is_manual = false` の行は payload の `name_ja` (なければ `name_en`) を source として `computed_name` を算出。
  - 運用補足: admin が Limitless payload の翻訳に戻したい場合は、手動 name_ja をクリアして `name_ja_is_manual = false` に戻せば次回 sync で payload 由来の `name_ja` / `name` に追従する。
  - **admin 即時反映 (Codex review P1)**: admin 画面で `updateOpponentDeckNameJa(id, nameJa)` が呼ばれた時点で、`apply_limitless_snapshot` を待たずに canonical key `name` も `stripAllWhitespace(nameJa)` で **即時更新**する。実装は **SECURITY DEFINER RPC `admin_update_opponent_deck_name_ja(p_id, p_name_ja)`** を新規追加し (詳細 §6.6)、admin 判定 / `opponent_deck_master` 更新 / 衝突 pre-check / `battles.opponent_deck_name` 同期 UPDATE を 1 transaction で完結させる (Codex 再レビュー P1: クライアント側 RLS では battles の他ユーザー行を UPDATE できないため、RLS bypass の SECURITY DEFINER RPC が必須)。TS 側 `updateOpponentDeckNameJa()` は本 RPC を呼ぶだけのラッパーになる。衝突時は RPC が `RAISE EXCEPTION 'name collision: ...'` で reject、TS 側でメッセージを UI に表示。これにより Limitless 同期が停止中 (`LIMITLESS_HTML_SYNC_PAUSED=true`) でも canonical name が即座に揃う。

- **[衝突時挙動] (§5.4 / §13.2)** apply_limitless_snapshot 内で Limitless 翻訳改善により行の computed_name が他の既存 (manual or 別 limitless) 行 name と衝突した場合の挙動はどうしますか? → **全体 abort + error** を採用。
  - 理由: computed_name の衝突はアプリ内正式名としての同一性が曖昧になった状態。部分 skip で同期成功扱いにするより、全体を失敗させて admin が手動解消する方が安全。衝突は稀と想定。
  - 実装要件:
    - apply_limitless_snapshot は衝突検出時に `RAISE EXCEPTION` で例外を投げ、transaction 全体を rollback する (自動 merge は行わない)
    - 例外メッセージには **衝突した computed_name** / **incoming `name_en` / `slug`** / **既存衝突行の `id` / `source` / `name_en`** を含める
    - 呼び出し側 (`src/lib/pokepoke/limitless-sync.ts`) は既存の `mark_limitless_sync_error` RPC 経由でエラー内容を `opponent_deck_settings` に記録し、admin 画面で原因把握できるようにする
    - `apply_limitless_snapshot` の擬似コード (§6.4) には、name UPDATE 前に collision pre-check (`SELECT 1 FROM opponent_deck_master WHERE name = computed_name AND format = p_format AND game_title = p_game_title AND id <> existing_id`) を追加し、ヒットしたら exception を投げる節を含める

- **[撤去戦略] (§5.6 / §13.1)** displayDeckName / getOpponentDeckNameMap の撤去戦略をどうしますか? → **本PRで完全撤去** を採用。
  - 理由: 今回の設計では name がアプリ内正式名になり、name_ja は元データ/翻訳ラベル扱いになるため、displayDeckName / getOpponentDeckNameMap の表示変換ロジックを残すと設計意図が曖昧になる。後続 PR で掃除するより本 PR で移行を完結させる。
  - 実装要件:
    - `src/lib/actions/opponent-deck-display.ts` を **削除** (no-op 互換シムも残さない)
    - `displayDeckName` / `getOpponentDeckNameMap` / `OpponentDeckNameMap` 型 import / `opponentDeckNameMap` props を **全 caller から削除** (§4.2 の表示系撤去ファイル一覧で網羅した 19 ファイル: stats 系 7 [OpponentDeckStatsSection / TrendChart / TrendHeatmap / MatchupTable / EncounterDonutChart / MatchupCard / TuningStatsSection] + battle 系 6 [BattleHistoryList / BattleIntervalModal / OpponentDeckSelector / BattleTabsView / BattleRecordForm / EditBattleModal] + pokepoke pages 4 [stats/page / stats/opponent/[deckName]/page / stats/deck/[deckName]/page / battle/page] + decks 系 2 [DeckList.tsx / pokepoke/decks/page.tsx])、加えて削除対象 `src/lib/actions/opponent-deck-display.ts` 本体 1 ファイルで計 20 ファイルが影響対象
    - 表示は基本的に `name` をそのまま使う (name 統一後は空白なし日本語名なので追加変換不要)
    - 管理画面など `name_ja` / `name_en` を補助情報として表示する箇所は必要に応じて残す (`admin/opponent-decks` 配下のみ想定、本 PR では既存表示を保持)
  - 検証要件:
    - 最後に `rg "displayDeckName|getOpponentDeckNameMap|OpponentDeckNameMap|opponentDeckNameMap"` で関連シンボルが残っていないことを確認 (検証 §9.1 に追加項目として組み込む)
    - `npm run lint` / `npx opennextjs-cloudflare build` / `npx tsc --noEmit` で型エラー・ビルドエラーゼロを確認
    - dev preview の主要画面 (対戦記録入力・履歴・統計・admin・デッキ管理) で表示崩れがないか実機確認 (§9.4 ユーザー必須項目に組み込む)
