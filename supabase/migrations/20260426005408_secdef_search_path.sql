-- SECURITY DEFINER 関数の search_path 固定 + 権限再設計
--
-- 背景: is_admin_user / auto_add_opponent_deck / recalculate_opponent_decks /
-- run_daily_opponent_deck_batch / sync_team_membership は SECURITY DEFINER だが
-- SET search_path = '' 未設定で、検索パス汚染による権限昇格の足場になり得た。
-- また現状は authenticated に GRANT がデフォルト付与されており、p_user_id を引数に持つ
-- sync_team_membership などに対しては成り済まし攻撃の経路が残っていた。
--
-- 本 migration での変更点:
-- 1. 全関数を SET search_path = '' + public. プレフィックス で書き直す。
-- 2. recalculate_opponent_decks の本体ロジックを非公開 helper
--    `_recalculate_opponent_decks_internal(p_format, p_game_title)` に分離。
--    公開関数は admin check 後 helper を呼ぶラッパに変更。
--    `run_daily_opponent_deck_batch` は helper を直接呼ぶように差し替え
--    (cron 経路で auth.uid() が NULL になり admin only で落ちるのを回避)。
-- 3. auto_add_opponent_deck は auth.uid() / 入力長 / format-game の事前検証を追加。
-- 4. GRANT を関数別に明示再設計:
--    - is_admin_user / auto_add_opponent_deck / recalculate_opponent_decks → authenticated
--    - _recalculate_opponent_decks_internal / run_daily_opponent_deck_batch /
--      sync_team_membership → service_role のみ

-- =============================================================================
-- 1. is_admin_user (search_path 固定 + public.profiles 修飾)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- =============================================================================
-- 2. auto_add_opponent_deck (入力検証強化 + search_path 固定)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_add_opponent_deck(
  p_deck_name text,
  p_format text,
  p_game_title text DEFAULT 'dm'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_mode text;
  v_max_sort integer;
BEGIN
  -- 入力検証: 認証済み・空文字 / 長すぎを拒否・format/game の組が登録済みであること
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE='42501';
  END IF;
  IF p_deck_name IS NULL OR length(trim(p_deck_name)) = 0 OR length(p_deck_name) > 80 THEN
    RAISE EXCEPTION 'invalid deck name' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.opponent_deck_settings s
    WHERE s.format = p_format AND s.game_title = p_game_title
  ) THEN
    RAISE EXCEPTION 'unknown format/game combination' USING ERRCODE='22023';
  END IF;

  -- 管理モード取得
  SELECT management_mode INTO v_mode
  FROM public.opponent_deck_settings
  WHERE format = p_format AND game_title = p_game_title;

  -- 既存デッキ更新: auto モードなら is_active も true に
  UPDATE public.opponent_deck_master
  SET last_used_at = now(),
      is_active = CASE WHEN v_mode = 'auto' THEN true ELSE is_active END
  WHERE name = p_deck_name
    AND format = p_format
    AND game_title = p_game_title;

  IF FOUND THEN RETURN; END IF;

  -- 新規追加
  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM public.opponent_deck_master
  WHERE format = p_format AND game_title = p_game_title;

  IF v_mode = 'auto' THEN
    INSERT INTO public.opponent_deck_master (name, format, game_title, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, p_game_title, 'other', true, v_max_sort + 10, now());
  ELSE
    INSERT INTO public.opponent_deck_master (name, format, game_title, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, p_game_title, 'other', false, v_max_sort + 10, now());
  END IF;
END;
$func$;
REVOKE ALL ON FUNCTION public.auto_add_opponent_deck(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_add_opponent_deck(text, text, text) TO authenticated;

-- =============================================================================
-- 3. _recalculate_opponent_decks_internal: 非公開 helper (実ロジック本体)
--    公開ラッパ recalculate_opponent_decks と日次バッチの両方から呼ばれる。
-- =============================================================================
CREATE OR REPLACE FUNCTION public._recalculate_opponent_decks_internal(
  p_format text,
  p_game_title text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_settings record;
  v_total_battles bigint;
  v_total_bonus bigint;
  v_denominator bigint;
  v_start_date timestamptz;
BEGIN
  SELECT * INTO v_settings
  FROM public.opponent_deck_settings
  WHERE format = p_format AND game_title = p_game_title;

  IF v_settings IS NULL THEN RETURN; END IF;
  IF v_settings.management_mode <> 'auto' THEN RETURN; END IF;

  v_start_date := now() - (v_settings.usage_period_days || ' days')::interval;

  SELECT COUNT(*) INTO v_total_battles
  FROM public.battles
  WHERE format = p_format
    AND game_title = p_game_title
    AND fought_at >= v_start_date;

  SELECT COALESCE(SUM(admin_bonus_count), 0) INTO v_total_bonus
  FROM public.opponent_deck_master
  WHERE format = p_format
    AND game_title = p_game_title
    AND is_active = true;

  v_denominator := v_total_battles + v_total_bonus;

  IF v_denominator = 0 THEN RETURN; END IF;

  WITH deck_usage AS (
    SELECT
      odm.id,
      odm.admin_bonus_count,
      COALESCE(bc.cnt, 0) AS battle_count,
      (COALESCE(bc.cnt, 0) + odm.admin_bonus_count) * 100.0 / v_denominator AS usage_rate
    FROM public.opponent_deck_master odm
    LEFT JOIN (
      SELECT opponent_deck_name, COUNT(*) AS cnt
      FROM public.battles
      WHERE format = p_format
        AND game_title = p_game_title
        AND fought_at >= v_start_date
      GROUP BY opponent_deck_name
    ) bc ON bc.opponent_deck_name = odm.name
    WHERE odm.format = p_format
      AND odm.game_title = p_game_title
      AND odm.is_active = true
  )
  UPDATE public.opponent_deck_master odm
  SET category = CASE
    WHEN du.usage_rate >= v_settings.major_threshold THEN 'major'
    WHEN du.usage_rate >= v_settings.minor_threshold THEN 'minor'
    ELSE 'other'
  END
  FROM deck_usage du
  WHERE odm.id = du.id;

  WITH ranked AS (
    SELECT
      odm.id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE odm.category WHEN 'major' THEN 0 WHEN 'minor' THEN 1 ELSE 2 END,
          (COALESCE(bc.cnt, 0) + odm.admin_bonus_count) DESC,
          odm.name ASC
      ) AS new_order
    FROM public.opponent_deck_master odm
    LEFT JOIN (
      SELECT opponent_deck_name, COUNT(*) AS cnt
      FROM public.battles
      WHERE format = p_format
        AND game_title = p_game_title
        AND fought_at >= v_start_date
      GROUP BY opponent_deck_name
    ) bc ON bc.opponent_deck_name = odm.name
    WHERE odm.format = p_format
      AND odm.game_title = p_game_title
      AND odm.is_active = true
  )
  UPDATE public.opponent_deck_master odm
  SET sort_order = r.new_order
  FROM ranked r
  WHERE odm.id = r.id;

  UPDATE public.opponent_deck_master
  SET is_active = false
  WHERE format = p_format
    AND game_title = p_game_title
    AND is_active = true
    AND last_used_at IS NOT NULL
    AND last_used_at < now() - (v_settings.disable_period_days || ' days')::interval;

  UPDATE public.opponent_deck_master
  SET is_active = false
  WHERE format = p_format
    AND game_title = p_game_title
    AND is_active = true
    AND last_used_at IS NULL
    AND created_at < now() - (v_settings.disable_period_days || ' days')::interval;
END;
$func$;
REVOKE ALL ON FUNCTION public._recalculate_opponent_decks_internal(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._recalculate_opponent_decks_internal(text, text) TO service_role;

-- =============================================================================
-- 4. recalculate_opponent_decks: 公開ラッパ (admin check 後 helper を呼ぶ)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_opponent_decks(
  p_format text,
  p_game_title text DEFAULT 'dm'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE='42501';
  END IF;
  PERFORM public._recalculate_opponent_decks_internal(p_format, p_game_title);
END;
$func$;
REVOKE ALL ON FUNCTION public.recalculate_opponent_decks(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_opponent_decks(text, text) TO authenticated;

-- =============================================================================
-- 5. run_daily_opponent_deck_batch: helper を直接呼ぶ (admin check 不要)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.run_daily_opponent_deck_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  -- デュエプレ
  PERFORM public._recalculate_opponent_decks_internal('AD', 'dm');
  PERFORM public._recalculate_opponent_decks_internal('ND', 'dm');
  -- ポケポケ
  PERFORM public._recalculate_opponent_decks_internal('RANKED', 'pokepoke');
  PERFORM public._recalculate_opponent_decks_internal('RANDOM', 'pokepoke');
END;
$func$;
REVOKE ALL ON FUNCTION public.run_daily_opponent_deck_batch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_opponent_deck_batch() TO service_role;

-- =============================================================================
-- 6. sync_team_membership (search_path 固定 + public. 修飾)
--    p_user_id を外部から受け取るため authenticated には開けない (service_role のみ)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_team_membership(
  p_user_id uuid,
  p_discord_username text,
  p_guilds jsonb,
  p_game_title text DEFAULT 'dm'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  g jsonb;
  v_team_id uuid;
BEGIN
  FOR g IN SELECT * FROM jsonb_array_elements(p_guilds) LOOP
    INSERT INTO public.teams (discord_guild_id, name, icon_url, game_title)
    VALUES (g->>'id', g->>'name', g->>'icon', p_game_title)
    ON CONFLICT (discord_guild_id, game_title) DO UPDATE SET
      name = EXCLUDED.name,
      icon_url = EXCLUDED.icon_url,
      updated_at = now()
    RETURNING id INTO v_team_id;

    INSERT INTO public.team_members (team_id, user_id, discord_username)
    VALUES (v_team_id, p_user_id, p_discord_username)
    ON CONFLICT (team_id, user_id) DO UPDATE SET
      discord_username = EXCLUDED.discord_username;
  END LOOP;

  -- このユーザーの当該ゲームでの未所属チームを削除
  DELETE FROM public.team_members
  WHERE user_id = p_user_id
    AND team_id IN (
      SELECT t.id FROM public.teams t
      WHERE t.game_title = p_game_title
    )
    AND team_id NOT IN (
      SELECT t.id FROM public.teams t
      WHERE t.game_title = p_game_title
        AND t.discord_guild_id IN (SELECT g2->>'id' FROM jsonb_array_elements(p_guilds) g2)
    );
END;
$func$;
REVOKE ALL ON FUNCTION public.sync_team_membership(uuid, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_team_membership(uuid, text, jsonb, text) TO service_role;
