-- 2026-05-18 #2 Phase B rollback: shares.user_id FK を ON DELETE CASCADE → ON DELETE SET NULL に戻す
--
-- 使い方: 緊急時のみ手動で apply_migration / psql で適用する
--   (supabase/rollback/ ディレクトリは supabase db push の対象外なので自動適用されない)
--
-- ロールバック後の挙動:
--   - deleteUser 時に shares 行が連鎖削除されなくなる (user_id が NULL に置換される)
--   - ただし src/app/api/account/delete/route.ts の Phase A 修正 (route 内の明示 DELETE) が
--     残っていれば、新規アカウント削除フローでは shares は引き続き削除される
--   - 完全に元の状態に戻すには route.ts も同時に revert する必要あり

ALTER TABLE public.shares
  DROP CONSTRAINT shares_user_id_fkey;

ALTER TABLE public.shares
  ADD CONSTRAINT shares_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
