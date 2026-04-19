-- Stage 1c: 書き込み系 RPC を game_title 対応に更新
-- 読み込み専用 RPC（get_*_stats_range 等）は format コードがゲーム間で重複しないため
-- format フィルタのみで正しくスコープできる。ここでは変更しない。
-- 変更対象: auto_add_opponent_deck / recalculate_opponent_decks /
--         run_daily_opponent_deck_batch / sync_team_membership

-- 1. auto_add_opponent_deck: p_game_title DEFAULT 'dm' を末尾追加
CREATE OR REPLACE FUNCTION auto_add_opponent_deck(
  p_deck_name text,
  p_format text,
  p_game_title text DEFAULT 'dm'
)
RETURNS void AS $func$
DECLARE
  v_mode text;
  v_max_sort integer;
BEGIN
  -- 管理モード取得
  SELECT management_mode INTO v_mode
  FROM opponent_deck_settings
  WHERE format = p_format AND game_title = p_game_title;

  -- 既存デッキ更新: autoモードなら is_active も true に
  UPDATE opponent_deck_master
  SET last_used_at = now(),
      is_active = CASE WHEN v_mode = 'auto' THEN true ELSE is_active END
  WHERE name = p_deck_name
    AND format = p_format
    AND game_title = p_game_title;

  IF FOUND THEN RETURN; END IF;

  -- 新規追加
  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM opponent_deck_master
  WHERE format = p_format AND game_title = p_game_title;

  IF v_mode = 'auto' THEN
    INSERT INTO opponent_deck_master (name, format, game_title, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, p_game_title, 'other', true, v_max_sort + 10, now());
  ELSE
    INSERT INTO opponent_deck_master (name, format, game_title, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, p_game_title, 'other', false, v_max_sort + 10, now());
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. recalculate_opponent_decks: p_game_title DEFAULT 'dm' を追加
CREATE OR REPLACE FUNCTION recalculate_opponent_decks(
  p_format text,
  p_game_title text DEFAULT 'dm'
)
RETURNS void AS $func$
DECLARE
  v_settings record;
  v_total_battles bigint;
  v_total_bonus bigint;
  v_denominator bigint;
  v_start_date timestamptz;
BEGIN
  SELECT * INTO v_settings
  FROM opponent_deck_settings
  WHERE format = p_format AND game_title = p_game_title;

  IF v_settings IS NULL THEN RETURN; END IF;
  IF v_settings.management_mode <> 'auto' THEN RETURN; END IF;

  v_start_date := now() - (v_settings.usage_period_days || ' days')::interval;

  SELECT COUNT(*) INTO v_total_battles
  FROM battles
  WHERE format = p_format
    AND game_title = p_game_title
    AND fought_at >= v_start_date;

  SELECT COALESCE(SUM(admin_bonus_count), 0) INTO v_total_bonus
  FROM opponent_deck_master
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
    FROM opponent_deck_master odm
    LEFT JOIN (
      SELECT opponent_deck_name, COUNT(*) AS cnt
      FROM battles
      WHERE format = p_format
        AND game_title = p_game_title
        AND fought_at >= v_start_date
      GROUP BY opponent_deck_name
    ) bc ON bc.opponent_deck_name = odm.name
    WHERE odm.format = p_format
      AND odm.game_title = p_game_title
      AND odm.is_active = true
  )
  UPDATE opponent_deck_master odm
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
    FROM opponent_deck_master odm
    LEFT JOIN (
      SELECT opponent_deck_name, COUNT(*) AS cnt
      FROM battles
      WHERE format = p_format
        AND game_title = p_game_title
        AND fought_at >= v_start_date
      GROUP BY opponent_deck_name
    ) bc ON bc.opponent_deck_name = odm.name
    WHERE odm.format = p_format
      AND odm.game_title = p_game_title
      AND odm.is_active = true
  )
  UPDATE opponent_deck_master odm
  SET sort_order = r.new_order
  FROM ranked r
  WHERE odm.id = r.id;

  UPDATE opponent_deck_master
  SET is_active = false
  WHERE format = p_format
    AND game_title = p_game_title
    AND is_active = true
    AND last_used_at IS NOT NULL
    AND last_used_at < now() - (v_settings.disable_period_days || ' days')::interval;

  UPDATE opponent_deck_master
  SET is_active = false
  WHERE format = p_format
    AND game_title = p_game_title
    AND is_active = true
    AND last_used_at IS NULL
    AND created_at < now() - (v_settings.disable_period_days || ' days')::interval;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. run_daily_opponent_deck_batch: 全ゲーム分を実行
CREATE OR REPLACE FUNCTION run_daily_opponent_deck_batch()
RETURNS void AS $func$
BEGIN
  -- デュエプレ
  PERFORM recalculate_opponent_decks('AD', 'dm');
  PERFORM recalculate_opponent_decks('ND', 'dm');
  -- ポケポケ
  PERFORM recalculate_opponent_decks('RANKED', 'pokepoke');
  PERFORM recalculate_opponent_decks('RANDOM', 'pokepoke');
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. sync_team_membership: p_game_title DEFAULT 'dm' を追加、ON CONFLICT を新UNIQUEキーに変更
CREATE OR REPLACE FUNCTION sync_team_membership(
  p_user_id uuid,
  p_discord_username text,
  p_guilds jsonb,
  p_game_title text DEFAULT 'dm'
)
RETURNS void AS $func$
DECLARE
  g jsonb;
  v_team_id uuid;
BEGIN
  FOR g IN SELECT * FROM jsonb_array_elements(p_guilds) LOOP
    INSERT INTO teams (discord_guild_id, name, icon_url, game_title)
    VALUES (g->>'id', g->>'name', g->>'icon', p_game_title)
    ON CONFLICT (discord_guild_id, game_title) DO UPDATE SET
      name = EXCLUDED.name,
      icon_url = EXCLUDED.icon_url,
      updated_at = now()
    RETURNING id INTO v_team_id;

    INSERT INTO team_members (team_id, user_id, discord_username)
    VALUES (v_team_id, p_user_id, p_discord_username)
    ON CONFLICT (team_id, user_id) DO UPDATE SET
      discord_username = EXCLUDED.discord_username;
  END LOOP;

  -- このユーザーの当該ゲームでの未所属チームを削除
  DELETE FROM team_members
  WHERE user_id = p_user_id
    AND team_id IN (
      SELECT t.id FROM teams t
      WHERE t.game_title = p_game_title
    )
    AND team_id NOT IN (
      SELECT t.id FROM teams t
      WHERE t.game_title = p_game_title
        AND t.discord_guild_id IN (SELECT g2->>'id' FROM jsonb_array_elements(p_guilds) g2)
    );
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
