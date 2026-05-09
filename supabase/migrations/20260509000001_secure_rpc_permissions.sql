-- 公開ブロッカー: 主要 SECURITY DEFINER RPC を「PUBLIC EXECUTE が付いたまま」状態から塞ぐ。
--
-- 背景:
--   apply_limitless_snapshot / mark_limitless_sync_error / calculate_quality_score /
--   run_quality_scoring / run_detection_scan / detect_extreme_winrate /
--   detect_rapid_input / detect_repetitive_pattern は SECURITY DEFINER で作成され
--   PUBLIC EXECUTE が暗黙付与されたままになっており、Supabase REST 経由で誰でも直接実行できた。
--   書き換え系・全ユーザー集計系・他ユーザー情報取得系を含むため公開前に塞ぐ。
--
-- 設計方針 (ユーザー合意):
--   1. 関数所有者経由の内部呼び出しを使い、HTTP/REST から弾きつつ pg_cron は従来通り動かす。
--   2. auth.uid() IS NULL を bypass 条件にしない (anon でも NULL になり得る)。
--      service_role bypass は auth.role() = 'service_role' のみで判定する。
--   3. 既存ハードニング migration (20260426005408 / 20260426050849) と同じ
--      "_*_internal + 公開 wrapper" パターンに揃える。
--   4. cron は "cron_run_*" 専用 wrapper を経由させ、wrapper は誰にも GRANT しない。
--      pg_cron 自体は postgres ロールで動くため EXECUTE 権限は不要。
--   5. 全 SECURITY DEFINER 関数を SET search_path = '' + public. 修飾で再作成。
--
-- 公開呼び出し元:
--   - admin UI: src/lib/actions/admin-actions.ts (anon key + ユーザーセッションで RPC 呼び)
--   - cron: 既存 schedule (daily-quality-scoring / daily-detection-scan) を cron wrapper に差し替え
--   - service-role 経路: src/app/api/internal/detection-scan/route.ts (X-Internal-Key 認証)
--   - limitless 同期: src/lib/pokepoke/limitless-sync.ts (service-role client)


-- =============================================================================
-- 1. Limitless 系: service_role 限定 + search_path hardening
-- =============================================================================

-- 1-1. apply_limitless_snapshot
CREATE OR REPLACE FUNCTION public.apply_limitless_snapshot(
  p_game_title text,
  p_format text,
  p_rows jsonb,
  p_synced_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_settings record;
  v_row jsonb;
  v_count int := 0;
BEGIN
  SELECT * INTO v_settings
  FROM public.opponent_deck_settings
  WHERE game_title = p_game_title AND format = p_format;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'settings row not found for game_title=%, format=%', p_game_title, p_format;
  END IF;

  -- (1) upsert: name_en を内部キーとして保存。name_ja は手動編集済みなら既存値を保持
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.opponent_deck_master (
      game_title, format, name, name_en, name_ja, name_ja_is_manual,
      category, is_active, sort_order, source,
      limitless_share, limitless_count, limitless_wins,
      limitless_losses, limitless_ties, limitless_win_pct,
      limitless_icon_urls, limitless_deck_slug, limitless_last_synced_at
    ) VALUES (
      p_game_title, p_format, v_row->>'name_en', v_row->>'name_en', v_row->>'name_ja', false,
      'other', true, 0, 'limitless',
      NULLIF(v_row->>'share','')::numeric,
      NULLIF(v_row->>'count','')::int,
      NULLIF(v_row->>'wins','')::int,
      NULLIF(v_row->>'losses','')::int,
      NULLIF(v_row->>'ties','')::int,
      NULLIF(v_row->>'win_pct','')::numeric,
      CASE WHEN jsonb_typeof(v_row->'icon_urls') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(v_row->'icon_urls'))
           ELSE NULL END,
      v_row->>'slug',
      p_synced_at
    )
    ON CONFLICT (name, format, game_title) DO UPDATE SET
      source = 'limitless',
      name_en = EXCLUDED.name_en,
      name_ja = CASE
                  WHEN public.opponent_deck_master.name_ja_is_manual THEN public.opponent_deck_master.name_ja
                  ELSE EXCLUDED.name_ja
                END,
      limitless_share = EXCLUDED.limitless_share,
      limitless_count = EXCLUDED.limitless_count,
      limitless_wins = EXCLUDED.limitless_wins,
      limitless_losses = EXCLUDED.limitless_losses,
      limitless_ties = EXCLUDED.limitless_ties,
      limitless_win_pct = EXCLUDED.limitless_win_pct,
      limitless_icon_urls = EXCLUDED.limitless_icon_urls,
      limitless_deck_slug = EXCLUDED.limitless_deck_slug,
      limitless_last_synced_at = EXCLUDED.limitless_last_synced_at,
      is_active = true;
    v_count := v_count + 1;
  END LOOP;

  -- (2) 今回スナップショットに含まれなかった既存 limitless 行は is_active=false に
  UPDATE public.opponent_deck_master
  SET is_active = false
  WHERE game_title = p_game_title
    AND format = p_format
    AND source = 'limitless'
    AND (limitless_last_synced_at IS NULL OR limitless_last_synced_at < p_synced_at);

  -- (3) classification_method に応じて category を更新
  IF v_settings.classification_method = 'threshold' THEN
    UPDATE public.opponent_deck_master
    SET category = CASE
      WHEN limitless_share >= v_settings.major_threshold THEN 'major'
      WHEN limitless_share >= v_settings.minor_threshold THEN 'minor'
      ELSE 'other'
    END
    WHERE game_title = p_game_title
      AND format = p_format
      AND source = 'limitless'
      AND is_active = true;
  ELSE
    -- fixed_count: share 降順で並べ、上位 N を major、次 M を minor
    WITH ranked AS (
      SELECT id,
        ROW_NUMBER() OVER (
          ORDER BY limitless_share DESC NULLS LAST, name_en ASC
        ) AS rn
      FROM public.opponent_deck_master
      WHERE game_title = p_game_title
        AND format = p_format
        AND source = 'limitless'
        AND is_active = true
    )
    UPDATE public.opponent_deck_master odm
    SET category = CASE
      WHEN r.rn <= v_settings.major_fixed_count THEN 'major'
      WHEN r.rn <= v_settings.major_fixed_count + v_settings.minor_fixed_count THEN 'minor'
      ELSE 'other'
    END
    FROM ranked r
    WHERE odm.id = r.id;
  END IF;

  -- (4) sort_order を category 順 → share 降順で振り直す
  WITH rs AS (
    SELECT id,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE category WHEN 'major' THEN 0 WHEN 'minor' THEN 1 ELSE 2 END,
          limitless_share DESC NULLS LAST,
          name_en ASC
      ) AS new_order
    FROM public.opponent_deck_master
    WHERE game_title = p_game_title
      AND format = p_format
      AND source = 'limitless'
      AND is_active = true
  )
  UPDATE public.opponent_deck_master odm
  SET sort_order = rs.new_order
  FROM rs
  WHERE odm.id = rs.id;

  -- (5) settings 側の同期状態を更新
  UPDATE public.opponent_deck_settings
  SET limitless_last_synced_at = p_synced_at,
      limitless_last_sync_status = 'ok',
      limitless_last_sync_message = NULL,
      updated_at = now()
  WHERE game_title = p_game_title AND format = p_format;

  RETURN jsonb_build_object('count', v_count, 'synced_at', p_synced_at);
END;
$func$;
REVOKE ALL ON FUNCTION public.apply_limitless_snapshot(text, text, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_limitless_snapshot(text, text, jsonb, timestamptz)
  TO service_role;

-- 1-2. mark_limitless_sync_error
CREATE OR REPLACE FUNCTION public.mark_limitless_sync_error(
  p_game_title text,
  p_format text,
  p_status text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
  UPDATE public.opponent_deck_settings
  SET limitless_last_sync_status = p_status,
      limitless_last_sync_message = p_message,
      updated_at = now()
  WHERE game_title = p_game_title AND format = p_format;
END;
$func$;
REVOKE ALL ON FUNCTION public.mark_limitless_sync_error(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_limitless_sync_error(text, text, text, text)
  TO service_role;


-- =============================================================================
-- 2. Detection 検出関数 3 つ: service_role 限定 + search_path hardening
--    _run_detection_scan_internal の中から所有者ロール権限で呼ばれるため、
--    EXECUTE が service_role only でも内部呼び出しは通る。
-- =============================================================================

-- 2-1. detect_extreme_winrate (最新本体: 20260424000003 + stage 1,2,3 対応)
CREATE OR REPLACE FUNCTION public.detect_extreme_winrate(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_days integer := (p_params->>'period_days')::integer;
  v_min_battles integer := (p_params->>'min_battles')::integer;
  v_max_winrate numeric := (p_params->>'max_winrate')::numeric;
  v_min_winrate numeric := (p_params->>'min_winrate')::numeric;
BEGIN
  RETURN QUERY
  SELECT
    b.user_id,
    'extreme_winrate'::text AS rule_key,
    jsonb_build_object(
      'total_battles', COUNT(*),
      'wins', COUNT(*) FILTER (WHERE b.result = 'win'),
      'win_rate', ROUND(COUNT(*) FILTER (WHERE b.result = 'win') * 1.0 / COUNT(*), 4),
      'period_days', v_period_days
    ) AS details
  FROM public.battles b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE p.stage IN (1, 2, 3)
    AND b.fought_at >= (now() - (v_period_days || ' days')::interval)
    AND NOT EXISTS (
      SELECT 1 FROM public.detection_alerts da
      WHERE da.user_id = b.user_id
        AND da.rule_key = 'extreme_winrate'
        AND da.is_resolved = false
    )
  GROUP BY b.user_id
  HAVING COUNT(*) >= v_min_battles
    AND (
      COUNT(*) FILTER (WHERE b.result = 'win') * 1.0 / COUNT(*) >= v_max_winrate
      OR COUNT(*) FILTER (WHERE b.result = 'win') * 1.0 / COUNT(*) <= v_min_winrate
    );
END;
$$;
REVOKE ALL ON FUNCTION public.detect_extreme_winrate(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_extreme_winrate(jsonb) TO service_role;

-- 2-2. detect_rapid_input (最新本体: 20260424000004 + sliding window)
CREATE OR REPLACE FUNCTION public.detect_rapid_input(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window_hours integer := (p_params->>'window_hours')::integer;
  v_max_battles integer := (p_params->>'max_battles')::integer;
  v_period_hours integer := COALESCE((p_params->>'period_hours')::integer, 24);
BEGIN
  -- Safety: period must cover at least one full window
  v_period_hours := GREATEST(v_period_hours, v_window_hours);

  RETURN QUERY
  WITH windowed AS (
    SELECT
      b.user_id,
      b.fought_at,
      COUNT(*) OVER (
        PARTITION BY b.user_id
        ORDER BY b.fought_at
        RANGE BETWEEN make_interval(hours => v_window_hours) PRECEDING AND CURRENT ROW
      ) AS window_count
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.stage IN (1, 2, 3)
      AND b.fought_at >= now() - make_interval(hours => v_period_hours)
      AND NOT EXISTS (
        SELECT 1 FROM public.detection_alerts da
        WHERE da.user_id = b.user_id
          AND da.rule_key = 'rapid_input'
          AND da.is_resolved = false
      )
  )
  SELECT DISTINCT ON (w.user_id)
    w.user_id,
    'rapid_input'::text AS rule_key,
    jsonb_build_object(
      'peak_window_end', w.fought_at,
      'peak_window_count', w.window_count,
      'window_hours', v_window_hours,
      'period_hours', v_period_hours,
      'threshold', v_max_battles
    ) AS details
  FROM windowed w
  WHERE w.window_count >= v_max_battles
  ORDER BY w.user_id, w.window_count DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.detect_rapid_input(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_rapid_input(jsonb) TO service_role;

-- 2-3. detect_repetitive_pattern (最新本体: 20260424000004 + period_days)
CREATE OR REPLACE FUNCTION public.detect_repetitive_pattern(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_consecutive integer := (p_params->>'max_consecutive')::integer;
  v_period_days integer := COALESCE((p_params->>'period_days')::integer, 1);
BEGIN
  RETURN QUERY
  WITH numbered AS (
    SELECT
      b.user_id,
      b.opponent_deck_name,
      b.result,
      b.fought_at,
      ROW_NUMBER() OVER (PARTITION BY b.user_id ORDER BY b.fought_at) -
      ROW_NUMBER() OVER (PARTITION BY b.user_id, b.opponent_deck_name, b.result ORDER BY b.fought_at) AS grp
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.stage IN (1, 2, 3)
      AND b.fought_at >= now() - make_interval(days => v_period_days)
      AND NOT EXISTS (
        SELECT 1 FROM public.detection_alerts da
        WHERE da.user_id = b.user_id
          AND da.rule_key = 'repetitive_pattern'
          AND da.is_resolved = false
      )
  ),
  streaks AS (
    SELECT
      n.user_id,
      n.opponent_deck_name,
      n.result,
      COUNT(*) AS streak_len
    FROM numbered n
    GROUP BY n.user_id, n.opponent_deck_name, n.result, n.grp
    HAVING COUNT(*) >= v_max_consecutive
  )
  SELECT
    s.user_id,
    'repetitive_pattern'::text AS rule_key,
    jsonb_build_object(
      'opponent_deck', s.opponent_deck_name,
      'result', s.result,
      'consecutive_count', s.streak_len,
      'threshold', v_max_consecutive,
      'period_days', v_period_days
    ) AS details
  FROM streaks s;
END;
$$;
REVOKE ALL ON FUNCTION public.detect_repetitive_pattern(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.detect_repetitive_pattern(jsonb) TO service_role;


-- =============================================================================
-- 3. Quality scoring 系: 5 関数構造 (internal / 公開 wrapper / cron wrapper)
-- =============================================================================

-- 3-1. _calculate_quality_score_internal (private)
CREATE OR REPLACE FUNCTION public._calculate_quality_score_internal(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  rule record;
  v_score integer := 0;
  v_breakdown jsonb := '{}';
  v_profile record;
  v_matches boolean;
  v_battle_count bigint;
  v_win_count bigint;
  v_admin_bonus integer;
  v_rate numeric;
BEGIN
  -- プロフィール取得（ゲストは対象外）
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id AND is_guest = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('total_score', 0, 'breakdown', '{}'::jsonb, 'eligible', false);
  END IF;

  -- 有効なルールをループ
  FOR rule IN SELECT * FROM public.quality_scoring_rules WHERE is_enabled = true LOOP
    v_matches := false;

    CASE rule.rule_key

      WHEN 'x_linked' THEN
        v_matches := v_profile.x_user_id IS NOT NULL;

      WHEN 'discord_linked' THEN
        SELECT EXISTS (SELECT 1 FROM public.discord_connections WHERE user_id = p_user_id) INTO v_matches;

      WHEN 'throwaway_suspect' THEN
        v_matches := v_profile.created_at > now() - ((rule.params->>'max_days')::integer || ' days')::interval;

      WHEN 'long_term_user' THEN
        v_matches := v_profile.created_at <= now() - ((rule.params->>'min_days')::integer || ' days')::interval;

      WHEN 'recent_battles' THEN
        SELECT COUNT(*) INTO v_battle_count
        FROM public.battles
        WHERE user_id = p_user_id
          AND fought_at >= now() - ((rule.params->>'period_days')::integer || ' days')::interval;
        v_matches := v_battle_count >= (rule.params->>'min_battles')::integer;

      WHEN 'opponent_diversity' THEN
        WITH last_n AS (
          SELECT opponent_deck_name
          FROM public.battles
          WHERE user_id = p_user_id
          ORDER BY fought_at DESC
          LIMIT (rule.params->>'last_n_battles')::integer
        )
        SELECT COUNT(DISTINCT opponent_deck_name) INTO v_battle_count FROM last_n;
        v_matches := v_battle_count >= (rule.params->>'min_distinct')::integer;

      WHEN 'normal_winrate' THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE result = 'win')
        INTO v_battle_count, v_win_count
        FROM public.battles WHERE user_id = p_user_id;
        IF v_battle_count >= (rule.params->>'min_battles')::integer THEN
          v_rate := v_win_count * 100.0 / v_battle_count;
          v_matches := v_rate >= (rule.params->>'min_rate')::numeric
                   AND v_rate <= (rule.params->>'max_rate')::numeric;
        END IF;

      WHEN 'normal_input_pace' THEN
        SELECT COUNT(*) INTO v_battle_count
        FROM public.battles
        WHERE user_id = p_user_id
          AND fought_at >= now() - ((rule.params->>'window_hours')::integer || ' hours')::interval;
        v_matches := v_battle_count >= (rule.params->>'min_battles')::integer
                 AND v_battle_count <= (rule.params->>'max_battles')::integer;

      WHEN 'unresolved_alerts' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.detection_alerts
          WHERE user_id = p_user_id AND is_resolved = false
        ) INTO v_matches;

      WHEN 'extreme_winrate_q' THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE result = 'win')
        INTO v_battle_count, v_win_count
        FROM public.battles WHERE user_id = p_user_id;
        IF v_battle_count >= (rule.params->>'min_battles')::integer THEN
          v_rate := v_win_count * 100.0 / v_battle_count;
          v_matches := v_rate > (rule.params->>'high_rate')::numeric
                    OR v_rate < (rule.params->>'low_rate')::numeric;
        END IF;

      WHEN 'repetitive_pattern_q' THEN
        WITH numbered AS (
          SELECT
            opponent_deck_name, result, fought_at,
            ROW_NUMBER() OVER (ORDER BY fought_at) -
            ROW_NUMBER() OVER (PARTITION BY opponent_deck_name, result ORDER BY fought_at) AS grp
          FROM public.battles WHERE user_id = p_user_id
        ),
        streaks AS (
          SELECT COUNT(*) AS streak_len
          FROM numbered
          GROUP BY opponent_deck_name, result, grp
          HAVING COUNT(*) >= (rule.params->>'max_consecutive')::integer
        )
        SELECT EXISTS (SELECT 1 FROM streaks) INTO v_matches;

      WHEN 'excessive_input' THEN
        SELECT COUNT(*) INTO v_battle_count
        FROM public.battles
        WHERE user_id = p_user_id
          AND fought_at >= now() - ((rule.params->>'window_hours')::integer || ' hours')::interval;
        v_matches := v_battle_count >= (rule.params->>'max_battles')::integer;

      ELSE
        v_matches := false;

    END CASE;

    IF v_matches THEN
      v_score := v_score + rule.score;
      v_breakdown := v_breakdown || jsonb_build_object(rule.rule_key, rule.score);
    END IF;
  END LOOP;

  -- 管理者ボーナス加算
  SELECT score INTO v_admin_bonus FROM public.quality_admin_bonus WHERE user_id = p_user_id;
  IF v_admin_bonus IS NOT NULL THEN
    v_score := v_score + v_admin_bonus;
    v_breakdown := v_breakdown || jsonb_build_object('admin_bonus', v_admin_bonus);
  END IF;

  RETURN jsonb_build_object('total_score', v_score, 'breakdown', v_breakdown, 'eligible', true);
END;
$$;
REVOKE ALL ON FUNCTION public._calculate_quality_score_internal(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- 3-2. calculate_quality_score (admin UI 公開 wrapper)
CREATE OR REPLACE FUNCTION public.calculate_quality_score(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    )
  ) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN public._calculate_quality_score_internal(p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_quality_score(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_quality_score(uuid) TO authenticated, service_role;

-- 3-3. _run_quality_scoring_internal (private)
CREATE OR REPLACE FUNCTION public._run_quality_scoring_internal(p_auto_update boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user record;
  v_result jsonb;
  v_total integer;
  v_threshold integer;
  v_promoted integer := 0;
  v_demoted integer := 0;
  v_calculated integer := 0;
BEGIN
  -- 閾値取得
  SELECT (value#>>'{}')::integer INTO v_threshold
  FROM public.quality_scoring_settings WHERE key = 'threshold';
  IF v_threshold IS NULL THEN v_threshold := 40; END IF;

  FOR v_user IN
    SELECT id, stage FROM public.profiles WHERE is_guest = false
  LOOP
    v_result := public._calculate_quality_score_internal(v_user.id);

    IF (v_result->>'eligible')::boolean THEN
      v_total := (v_result->>'total_score')::integer;

      -- スナップショットを upsert
      INSERT INTO public.quality_score_snapshots (user_id, total_score, breakdown, calculated_at)
      VALUES (v_user.id, v_total, v_result->'breakdown', now())
      ON CONFLICT (user_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        breakdown = EXCLUDED.breakdown,
        calculated_at = EXCLUDED.calculated_at;

      v_calculated := v_calculated + 1;

      -- ステージ自動遷移
      IF p_auto_update THEN
        IF v_total >= v_threshold AND v_user.stage = 2 THEN
          UPDATE public.profiles SET stage = 1 WHERE id = v_user.id;
          INSERT INTO public.user_stage_history (user_id, from_stage, to_stage, reason, changed_by)
          VALUES (v_user.id, 2, 1, '品質スコア自動昇格 (score=' || v_total || ', threshold=' || v_threshold || ')', v_user.id);
          v_promoted := v_promoted + 1;
        ELSIF v_total < v_threshold AND v_user.stage = 1 THEN
          UPDATE public.profiles SET stage = 2 WHERE id = v_user.id;
          INSERT INTO public.user_stage_history (user_id, from_stage, to_stage, reason, changed_by)
          VALUES (v_user.id, 1, 2, '品質スコア自動降格 (score=' || v_total || ', threshold=' || v_threshold || ')', v_user.id);
          v_demoted := v_demoted + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'calculated', v_calculated,
    'promoted', v_promoted,
    'demoted', v_demoted,
    'threshold', v_threshold
  );
END;
$$;
REVOKE ALL ON FUNCTION public._run_quality_scoring_internal(boolean)
  FROM PUBLIC, anon, authenticated, service_role;

-- 3-4. run_quality_scoring (admin UI 公開 wrapper)
CREATE OR REPLACE FUNCTION public.run_quality_scoring(p_auto_update boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    )
  ) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN public._run_quality_scoring_internal(p_auto_update);
END;
$$;
REVOKE ALL ON FUNCTION public.run_quality_scoring(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_quality_scoring(boolean) TO authenticated, service_role;

-- 3-5. cron_run_quality_scoring (cron wrapper)
CREATE OR REPLACE FUNCTION public.cron_run_quality_scoring()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public._run_quality_scoring_internal(true);
END;
$$;
REVOKE ALL ON FUNCTION public.cron_run_quality_scoring()
  FROM PUBLIC, anon, authenticated, service_role;
-- pg_cron は所有者ロールで実行されるため EXECUTE 権限不要


-- =============================================================================
-- 4. Detection scan 系: 4 関数構造 (internal / 公開 wrapper / cron wrapper)
-- =============================================================================

-- 4-1. _run_detection_scan_internal (private)
CREATE OR REPLACE FUNCTION public._run_detection_scan_internal()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  total_alerts integer := 0;
  v_row_count integer;
  rule record;
BEGIN
  FOR rule IN SELECT * FROM public.detection_rules WHERE is_enabled = true LOOP
    CASE rule.rule_key
      WHEN 'extreme_winrate' THEN
        INSERT INTO public.detection_alerts (user_id, rule_key, details)
        SELECT * FROM public.detect_extreme_winrate(rule.params);
      WHEN 'rapid_input' THEN
        INSERT INTO public.detection_alerts (user_id, rule_key, details)
        SELECT * FROM public.detect_rapid_input(rule.params);
      WHEN 'repetitive_pattern' THEN
        INSERT INTO public.detection_alerts (user_id, rule_key, details)
        SELECT * FROM public.detect_repetitive_pattern(rule.params);
    END CASE;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    total_alerts := total_alerts + v_row_count;
  END LOOP;
  RETURN total_alerts;
END;
$$;
REVOKE ALL ON FUNCTION public._run_detection_scan_internal()
  FROM PUBLIC, anon, authenticated, service_role;

-- 4-2. run_detection_scan (admin UI 公開 wrapper)
CREATE OR REPLACE FUNCTION public.run_detection_scan()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (
      auth.uid() IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
    )
  ) THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;
  RETURN public._run_detection_scan_internal();
END;
$$;
REVOKE ALL ON FUNCTION public.run_detection_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_detection_scan() TO authenticated, service_role;

-- 4-3. cron_run_detection_scan (cron wrapper)
CREATE OR REPLACE FUNCTION public.cron_run_detection_scan()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public._run_detection_scan_internal();
END;
$$;
REVOKE ALL ON FUNCTION public.cron_run_detection_scan()
  FROM PUBLIC, anon, authenticated, service_role;


-- =============================================================================
-- 5. pg_cron schedule の差し替え
--    既存の daily-quality-scoring / daily-detection-scan は run_*  を直接呼んでいたが、
--    admin check 込みの公開 wrapper は cron からは通らない (auth.uid() IS NULL かつ
--    auth.role() != 'service_role') ため、cron 専用 wrapper に切り替える。
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-quality-scoring') THEN
    PERFORM cron.unschedule('daily-quality-scoring');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-detection-scan') THEN
    PERFORM cron.unschedule('daily-detection-scan');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-quality-scoring',
  '15 19 * * *',
  $$SELECT public.cron_run_quality_scoring()$$
);

SELECT cron.schedule(
  'daily-detection-scan',
  '30 19 * * *',
  $$SELECT public.cron_run_detection_scan()$$
);
