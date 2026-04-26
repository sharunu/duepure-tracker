-- 旧 SECDEF overload (get_environment_deck_shares / get_opponent_deck_suggestions) の DROP
--
-- 背景: 20260426050849_secdef_search_path_phase2.sql で公開 RPC 11 本に search_path = '' を入れた後、
-- pg_proc を確認したところ以下の旧 overload が残存していた:
--   - public.get_environment_deck_shares(p_days integer DEFAULT 7)
--     → 旧版。opponent_deck_normalized 列を参照、'その他' グループ化、format フィルタなし。
--       opponent_deck_normalized は 20260408000001_remove_normalization で廃止された旧設計。
--   - public.get_opponent_deck_suggestions()
--     → 旧版。引数なし、name 1 列のみ返却。新版は (p_format text) で deck_name, deck_category を返却。
--
-- これらはクライアントから直接呼ばれていない (battle-actions.ts / stats-actions.ts は引数付きで
-- 新 overload に解決される) が、Postgres の overload 機構で残存しており、authenticated に
-- 自動 GRANT されている可能性 + 古いカラム参照で壊れる仕様のため、DROP で完全に取り除く。

DROP FUNCTION IF EXISTS public.get_environment_deck_shares(integer);
DROP FUNCTION IF EXISTS public.get_opponent_deck_suggestions();

-- 適用後の検証 (Studio で実行):
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc
--   WHERE proname IN ('get_environment_deck_shares', 'get_opponent_deck_suggestions')
--   ORDER BY proname;
-- → 各関数の overload が新シグネチャ 1 本だけになっていることを確認
