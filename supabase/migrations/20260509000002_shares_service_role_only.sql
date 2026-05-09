-- shares テーブルの読み取りを service_role 経由のみに絞る。
--
-- 背景:
--   shares テーブルの SELECT POLICY が `USING (true)` で anon/authenticated 共に
--   全件 dump 可能だった (`supabase.from('shares').select('*')` が REST 経由で通る)。
--   share_data には個人の戦績情報が含まれる。
--
-- 設計方針:
--   - /share/[id] と /api/og/[id] は server-side service-role client で読み取るよう変更
--     (src/app/share/[id]/page.tsx / src/app/api/og/[id]/route.tsx)
--   - INSERT POLICY (auth.uid() = user_id) は維持。ShareModal からの認証ユーザー INSERT は機能継続。
--
-- service_role の SELECT 維持: anon/authenticated だけ REVOKE し、service_role には明示 GRANT
-- (既に持っていても冪等)。

DROP POLICY IF EXISTS "Anyone can read shares" ON public.shares;

REVOKE SELECT ON public.shares FROM anon, authenticated;
GRANT SELECT ON public.shares TO service_role;

-- INSERT POLICY "Authenticated users can create own shares" (auth.uid() = user_id) は維持
