-- 2026-05-18 #2 Phase B: shares.user_id FK を ON DELETE SET NULL → ON DELETE CASCADE に変更
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
--
-- Preflight 確認済 (2026-05-18):
--   - FK 名: shares_user_id_fkey (prod / staging 共通)
--   - 既存 orphan (user_id IS NULL): 0 件 (両環境)
--   - service_role DELETE 権限: あり (両環境)
--   - shares 件数: prod 58 / staging 6
--
-- Rollback: supabase/rollback/20260518000001_rollback.sql (適用しない、緊急用)

ALTER TABLE public.shares
  DROP CONSTRAINT shares_user_id_fkey;

ALTER TABLE public.shares
  ADD CONSTRAINT shares_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
