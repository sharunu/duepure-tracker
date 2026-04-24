-- Phase 1: 一般公開前セキュリティ修正（非破壊＝追加のみ）
--
-- 本 migration は以下を追加する:
--   1. profiles 用 RPC 4 本（update_my_display_name / sync_my_x_connection / clear_my_x_connection / admin_update_user_stage）
--   2. discord_oauth_states テーブル（Discord OAuth の短命 nonce 保管、RLS 有効・policy 未作成・service_role のみ操作）
--   3. is_team_member の SET search_path = '' + public. 修飾版への上書き（Team RPC 再定義より前に配置）
--   4. Team RPC 8 本の CREATE OR REPLACE で is_team_member ガード + SET search_path = '' + public. 修飾
--   5. share-images storage policy を user_id prefix 要求版に追加（旧 policy 併存で非破壊）
--
-- Phase 2 の破壊的 migration（profiles UPDATE policy 削除、REVOKE UPDATE、share-images 旧 policy 削除）は
-- supabase/pending/20260424000002_security_hardening_restrictive.sql に別置し、Phase 1 コードが main 反映後に
-- 手動で supabase/migrations/ に移動して適用する。

-- =============================================================================
-- 1. profiles 用 RPC 4 本
-- =============================================================================

-- 1-1. update_my_display_name
CREATE OR REPLACE FUNCTION public.update_my_display_name(p_display_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET display_name = p_display_name WHERE id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.update_my_display_name(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_display_name(text) TO authenticated;

-- 1-2. sync_my_x_connection（auth.identities から読み取る＝クライアント入力不信）
-- provider_id 列は新しい Supabase（Auth v2.125.0+）では独立列、古い環境では identity_data 内 JSON のみ。
-- to_jsonb(i) 経由で schema-agnostic に読み取る（plan R-5/N-2 対応）
CREATE OR REPLACE FUNCTION public.sync_my_x_connection()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_x_user_id text;
  v_x_username text;
BEGIN
  SELECT
    COALESCE(to_jsonb(i)->>'provider_id', i.identity_data->>'provider_id', i.id::text),
    COALESCE(i.identity_data->>'user_name', i.identity_data->>'preferred_username')
  INTO v_x_user_id, v_x_username
  FROM auth.identities i
  WHERE i.user_id = auth.uid() AND i.provider = 'twitter'
  ORDER BY i.last_sign_in_at DESC NULLS LAST
  LIMIT 1;

  IF v_x_username IS NULL OR v_x_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET x_user_id = v_x_user_id, x_username = v_x_username
  WHERE id = auth.uid();
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.sync_my_x_connection() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_x_connection() TO authenticated;

-- 1-3. clear_my_x_connection
CREATE OR REPLACE FUNCTION public.clear_my_x_connection()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET x_user_id = NULL, x_username = NULL WHERE id = auth.uid();
END; $$;
REVOKE ALL ON FUNCTION public.clear_my_x_connection() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_my_x_connection() TO authenticated;

-- 1-4. admin_update_user_stage
CREATE OR REPLACE FUNCTION public.admin_update_user_stage(p_user_id uuid, p_new_stage int, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_from_stage int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_caller AND is_admin = true) THEN
    RAISE EXCEPTION 'admin required' USING ERRCODE='42501';
  END IF;
  SELECT stage INTO v_from_stage FROM public.profiles WHERE id = p_user_id;
  UPDATE public.profiles SET stage = p_new_stage WHERE id = p_user_id;
  INSERT INTO public.user_stage_history(user_id, from_stage, to_stage, reason, changed_by)
  VALUES (p_user_id, COALESCE(v_from_stage, 2), p_new_stage, p_reason, v_caller);
END; $$;
REVOKE ALL ON FUNCTION public.admin_update_user_stage(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_stage(uuid, int, text) TO authenticated;

-- =============================================================================
-- 2. discord_oauth_states テーブル
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.discord_oauth_states (
  nonce uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
CREATE INDEX IF NOT EXISTS discord_oauth_states_user_id_idx ON public.discord_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS discord_oauth_states_expires_at_idx ON public.discord_oauth_states(expires_at);

ALTER TABLE public.discord_oauth_states ENABLE ROW LEVEL SECURITY;

-- 意図: authenticated / anon は RLS + 権限二重で拒否、service_role key 経由のみ操作。
-- policy を作成しない＝RLS 有効 + policy 未作成で authenticated/anon はデフォルト拒否。
REVOKE ALL ON public.discord_oauth_states FROM PUBLIC, anon, authenticated;

-- service_role は RLS bypass するが Postgres テーブル権限は環境差があるため明示 GRANT。
-- delete().select() を使うため SELECT も必要。
GRANT SELECT, INSERT, DELETE ON public.discord_oauth_states TO service_role;

-- =============================================================================
-- 3. is_team_member 上書き（Team RPC 再定義より先）
-- =============================================================================
-- 現行は SET search_path なし・未修飾 team_members 参照。
-- Team RPC 側に SET search_path = '' を入れると被呼出関数内の未修飾名が解決できないため、
-- ここで public. 修飾版に上書きする。hidden_at IS NULL フィルタは意図的に付けない
-- （hidden_at は「自分の表示から非表示」個人設定で team 脱退ではないため、現行セマンティクス保持）
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id
  );
$$;

-- SECURITY DEFINER 関数は既定で PUBLIC EXECUTE が付く。
-- anon からの membership oracle 利用（任意 team_id/user_id を投げて所属判定）を防ぐ。
REVOKE ALL ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;

-- =============================================================================
-- 4. Team RPC 8 本の所属ガード + search_path ハードニング
-- =============================================================================
-- 本体は最新定義（20260422000001_pokepoke_draw.sql / 20260408000001_remove_normalization.sql /
-- 20260406000004_team_hidden.sql の該当関数）から転記。シグネチャ完全一致。
-- 追加点: 先頭に is_team_member ガード、SET search_path = ''、テーブル参照を public. 修飾。

-- 4-1. get_team_my_deck_stats_range
CREATE OR REPLACE FUNCTION public.get_team_my_deck_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  ),
  battle_data AS (
    SELECT b.my_deck_name AS my_deck, b.result
    FROM public.battles b
    WHERE b.user_id IN (SELECT m.user_id FROM members m)
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
      AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
      AND b.format = p_format
  ),
  agg AS (
    SELECT my_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'loss') AS l,
      COUNT(*) FILTER (WHERE result = 'draw') AS d,
      COUNT(*) AS t
    FROM battle_data GROUP BY my_deck
  )
  SELECT a.my_deck, a.w, a.l, a.d, a.t,
    CASE WHEN (a.w + a.l) = 0 THEN NULL
         ELSE ROUND(a.w * 100.0 / (a.w + a.l), 0) END
  FROM agg a ORDER BY a.t DESC;
END;
$$;

-- 4-2. get_team_opponent_deck_stats_range
CREATE OR REPLACE FUNCTION public.get_team_opponent_deck_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  deck_name text, wins bigint, losses bigint, draws bigint, total bigint, win_rate numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  ),
  battle_data AS (
    SELECT
      b.opponent_deck_name AS opp_deck,
      b.result
    FROM public.battles b
    WHERE b.user_id IN (SELECT m.user_id FROM members m)
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
      AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
      AND b.format = p_format
  ),
  agg AS (
    SELECT opp_deck,
      COUNT(*) FILTER (WHERE result = 'win') AS w,
      COUNT(*) FILTER (WHERE result = 'loss') AS l,
      COUNT(*) FILTER (WHERE result = 'draw') AS d,
      COUNT(*) AS t
    FROM battle_data GROUP BY opp_deck
  )
  SELECT a.opp_deck, a.w, a.l, a.d, a.t,
    CASE WHEN (a.w + a.l) = 0 THEN NULL
         ELSE ROUND(a.w * 100.0 / (a.w + a.l), 0) END
  FROM agg a ORDER BY a.t DESC;
END;
$$;

-- 4-3. get_team_deck_detail_stats
CREATE OR REPLACE FUNCTION public.get_team_deck_detail_stats(
  p_team_id uuid,
  p_deck_name text,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint,
  tuning_name text
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
  SELECT
    b.opponent_deck_name AS opponent_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'loss') AS losses,
    COUNT(*) FILTER (WHERE b.result = 'draw') AS draws,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'first') AS first_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'second') AS second_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_draws,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total,
    COALESCE(b.tuning_name, '指定なし') AS tuning_name
  FROM public.battles b
  WHERE b.my_deck_name = p_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.opponent_deck_name, COALESCE(b.tuning_name, '指定なし')
  ORDER BY COUNT(*) DESC;
END;
$$;

-- 4-4. get_team_opponent_deck_detail_stats
CREATE OR REPLACE FUNCTION public.get_team_opponent_deck_detail_stats(
  p_team_id uuid,
  p_opponent_deck_name text,
  p_format text DEFAULT 'AD',
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, draws bigint, total bigint,
  first_wins bigint, first_losses bigint, first_draws bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_draws bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint, unknown_total bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
  SELECT
    b.my_deck_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'loss') AS losses,
    COUNT(*) FILTER (WHERE b.result = 'draw') AS draws,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'first') AS first_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND b.turn_order = 'second') AS second_draws,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'loss' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.result = 'draw' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_draws,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM public.battles b
  WHERE b.opponent_deck_name = p_opponent_deck_name
    AND b.format = p_format
    AND b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY b.my_deck_name
  ORDER BY COUNT(*) DESC;
END;
$$;

-- 4-5. get_team_turn_order_stats_range
CREATE OR REPLACE FUNCTION public.get_team_turn_order_stats_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  first_wins bigint, first_losses bigint, first_draws bigint,
  second_wins bigint, second_losses bigint, second_draws bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_draws bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  )
  SELECT
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order = 'first' AND b.result = 'draw'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order = 'second' AND b.result = 'draw'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'win'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'loss'),
    COUNT(*) FILTER (WHERE b.turn_order IS NULL AND b.result = 'draw')
  FROM public.battles b
  WHERE b.user_id IN (SELECT m.user_id FROM members m)
    AND (p_user_id IS NULL OR b.user_id = p_user_id)
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
    AND b.format = p_format;
END;
$$;

-- 4-6. get_team_member_summaries
CREATE OR REPLACE FUNCTION public.get_team_member_summaries(p_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  discord_username text,
  wins bigint,
  losses bigint,
  draws bigint,
  total bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    tm.user_id,
    tm.discord_username,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'win'), 0) AS wins,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'loss'), 0) AS losses,
    COALESCE(COUNT(*) FILTER (WHERE b.result = 'draw'), 0) AS draws,
    COALESCE(COUNT(b.id), 0) AS total
  FROM public.team_members tm
  LEFT JOIN public.battles b ON b.user_id = tm.user_id
  WHERE tm.team_id = p_team_id
    AND tm.hidden_at IS NULL
  GROUP BY tm.user_id, tm.discord_username
  ORDER BY COALESCE(COUNT(b.id), 0) DESC;
END;
$$;

-- 4-7. get_team_deck_trend_range（最新は 20260408000001_remove_normalization.sql:300）
CREATE OR REPLACE FUNCTION public.get_team_deck_trend_range(
  p_team_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_format text DEFAULT 'AD'
)
RETURNS TABLE (
  period_start date, deck_name text, battle_count bigint, share_pct numeric
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH members AS (
    SELECT tm.user_id FROM public.team_members tm WHERE tm.team_id = p_team_id AND tm.hidden_at IS NULL
  ),
  daily AS (
    SELECT b.fought_at::date AS d,
      b.opponent_deck_name AS deck,
      COUNT(*) AS cnt
    FROM public.battles b
    WHERE b.user_id IN (SELECT m.user_id FROM members m)
      AND (p_user_id IS NULL OR b.user_id = p_user_id)
      AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
      AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
      AND b.format = p_format
    GROUP BY d, deck
  ),
  daily_total AS (
    SELECT d, SUM(cnt) AS total_cnt FROM daily GROUP BY d
  )
  SELECT dl.d, dl.deck, dl.cnt,
    ROUND(dl.cnt * 100.0 / NULLIF(dt.total_cnt, 0), 1)
  FROM daily dl JOIN daily_total dt ON dt.d = dl.d
  ORDER BY dl.d ASC, dl.cnt DESC;
END;
$$;

-- 4-8. get_team_members（最新は 20260406000004_team_hidden.sql:13）
CREATE OR REPLACE FUNCTION public.get_team_members(p_team_id uuid)
RETURNS TABLE (user_id uuid, discord_username text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT tm.user_id, tm.discord_username
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id
    AND tm.hidden_at IS NULL
  ORDER BY tm.joined_at;
END;
$$;

-- =============================================================================
-- 5. share-images storage policy（追加のみ、旧 policy は Phase 2 で削除）
-- =============================================================================

CREATE POLICY "Users can upload own share images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'share-images'
              AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own share images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'share-images'
         AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'share-images'
              AND (storage.foldername(name))[1] = auth.uid()::text);
