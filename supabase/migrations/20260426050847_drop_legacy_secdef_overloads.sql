-- 旧 SECURITY DEFINER overload の DROP (致命的脆弱性の即時封鎖)
--
-- 背景: PostgreSQL は引数シグネチャが違う `CREATE OR REPLACE FUNCTION` を別 overload として
-- 共存させる。20260426005408_secdef_search_path.sql (第 1 ラウンドの SECDEF 再設計) は最新
-- シグネチャだけを REVOKE / GRANT しているため、旧 overload は search_path 未固定 + Supabase の
-- デフォルト権限のまま残存している。
--
-- 特に旧 sync_team_membership(uuid, text, jsonb) は authenticated 経由で p_user_id を任意に
-- 渡せる成り済まし口。本 migration で完全に DROP する。
--
-- ⚠️ db push 前の確認 (Studio で 0 件確認、ユーザー指示待ち):
--   SELECT n.nspname, p.proname, pg_get_function_arguments(p.oid)
--   FROM pg_depend d
--   JOIN pg_proc p ON d.refobjid = p.oid
--   JOIN pg_namespace n ON p.pronamespace = n.oid
--   WHERE p.proname IN ('sync_team_membership','auto_add_opponent_deck','recalculate_opponent_decks')
--     AND pg_get_function_arguments(p.oid) IN
--       ('p_user_id uuid, p_discord_username text, p_guilds jsonb',
--        'p_deck_name text, p_format text',
--        'p_format text');
-- → 依存先が出たら DROP を中断して個別対応。0 件なら適用 OK。

DROP FUNCTION IF EXISTS public.sync_team_membership(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.auto_add_opponent_deck(text, text);
DROP FUNCTION IF EXISTS public.recalculate_opponent_decks(text);

-- 適用後の検証 (Studio で実行):
--   SELECT proname, pg_get_function_arguments(oid)
--   FROM pg_proc
--   WHERE proname IN ('sync_team_membership','auto_add_opponent_deck','recalculate_opponent_decks');
-- → 各関数の overload が新シグネチャ 1 本だけになっていることを確認。
