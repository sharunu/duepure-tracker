-- discord_connections の OAuth token を anon/authenticated から読めなくする。
--
-- 背景:
--   discord_connections.access_token / refresh_token / token_expires_at は
--   table-level SELECT が authenticated に開かれていたため、自分の行 (RLS で絞られる) を
--   SELECT すれば token 列が返ってきていた。XSS や悪意ある client コードで
--   他人の token を奪う経路にはなり得ないが、自身のセッション流出の典型経路となる。
--
-- 設計方針:
--   - table-level SELECT を anon/authenticated から REVOKE。
--   - 安全列 (id, user_id, game_title, discord_id, discord_username, created_at, updated_at)
--     のみ column-level SELECT を authenticated に GRANT。
--   - access_token / refresh_token / token_expires_at は authenticated/anon から読めなくなる。
--   - service_role の SELECT を明示 GRANT (callback / refresh-guilds API は維持)。
--   - RLS POLICY (auth.uid() = user_id) は維持。読める列が GRANT で絞られるだけ。
--
-- 重要 (PostgreSQL 権限モデル):
--   table 全体の SELECT が GRANT 済みのままだと column-level 制限は無視されるため、
--   先に table-level を REVOKE してから column-level GRANT する必要がある。
--   この順序を守らないと token 列を読めるままになる。

-- 1. anon/authenticated の table-level SELECT を REVOKE
REVOKE SELECT ON public.discord_connections FROM anon, authenticated;

-- 2. 安全列のみ column-level SELECT を authenticated に GRANT
GRANT SELECT (
  id,
  user_id,
  game_title,
  discord_id,
  discord_username,
  created_at,
  updated_at
) ON public.discord_connections TO authenticated;

-- 3. service_role の全列 SELECT を明示 GRANT (callback / refresh-guilds 維持、冪等)
GRANT SELECT ON public.discord_connections TO service_role;

-- INSERT/UPDATE/DELETE は既存 RLS POLICY (auth.uid() = user_id) で制御。本 migration では変更しない。
