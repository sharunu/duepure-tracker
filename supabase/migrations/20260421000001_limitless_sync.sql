-- LimitlessTCG 連携: opponent_deck_master / opponent_deck_settings 拡張 + apply_limitless_snapshot RPC
-- ポケポケ (game_title='pokepoke') のみ利用想定だが、スキーマ自体は他ゲームにも波及可能な汎用設計

-- === 1. opponent_deck_master 列追加 ===
ALTER TABLE opponent_deck_master
  ADD COLUMN source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','auto_battle','limitless')),
  ADD COLUMN name_en text,
  ADD COLUMN name_ja text,
  ADD COLUMN name_ja_is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN limitless_share numeric,
  ADD COLUMN limitless_count integer,
  ADD COLUMN limitless_wins integer,
  ADD COLUMN limitless_losses integer,
  ADD COLUMN limitless_ties integer,
  ADD COLUMN limitless_win_pct numeric,
  ADD COLUMN limitless_icon_urls text[],
  ADD COLUMN limitless_deck_slug text,
  ADD COLUMN limitless_last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS opponent_deck_master_source_idx
  ON opponent_deck_master (game_title, format, source);

-- === 2. opponent_deck_settings 列追加 + management_mode 拡張 ===
ALTER TABLE opponent_deck_settings
  ADD COLUMN classification_method text NOT NULL DEFAULT 'threshold'
    CHECK (classification_method IN ('threshold','fixed_count')),
  ADD COLUMN major_fixed_count integer NOT NULL DEFAULT 5,
  ADD COLUMN minor_fixed_count integer NOT NULL DEFAULT 10,
  ADD COLUMN limitless_last_synced_at timestamptz,
  ADD COLUMN limitless_last_sync_status text,
  ADD COLUMN limitless_last_sync_message text;

ALTER TABLE opponent_deck_settings
  DROP CONSTRAINT IF EXISTS opponent_deck_settings_management_mode_check;
ALTER TABLE opponent_deck_settings
  ADD CONSTRAINT opponent_deck_settings_management_mode_check
  CHECK (management_mode IN ('admin','auto','limitless'));

-- === 3. apply_limitless_snapshot RPC ===
-- p_rows: jsonb 配列、各要素は
--   { name_en, name_ja, share, count, wins, losses, ties, win_pct, icon_urls[], slug }
CREATE OR REPLACE FUNCTION apply_limitless_snapshot(
  p_game_title text,
  p_format text,
  p_rows jsonb,
  p_synced_at timestamptz DEFAULT now()
)
RETURNS jsonb AS $func$
DECLARE
  v_settings record;
  v_row jsonb;
  v_count int := 0;
BEGIN
  SELECT * INTO v_settings
  FROM opponent_deck_settings
  WHERE game_title = p_game_title AND format = p_format;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'settings row not found for game_title=%, format=%', p_game_title, p_format;
  END IF;

  -- (1) upsert: name_en を内部キーとして保存。name_ja は手動編集済みなら既存値を保持
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO opponent_deck_master (
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
                  WHEN opponent_deck_master.name_ja_is_manual THEN opponent_deck_master.name_ja
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
  UPDATE opponent_deck_master
  SET is_active = false
  WHERE game_title = p_game_title
    AND format = p_format
    AND source = 'limitless'
    AND (limitless_last_synced_at IS NULL OR limitless_last_synced_at < p_synced_at);

  -- (3) classification_method に応じて category を更新
  IF v_settings.classification_method = 'threshold' THEN
    UPDATE opponent_deck_master
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
      FROM opponent_deck_master
      WHERE game_title = p_game_title
        AND format = p_format
        AND source = 'limitless'
        AND is_active = true
    )
    UPDATE opponent_deck_master odm
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
    FROM opponent_deck_master
    WHERE game_title = p_game_title
      AND format = p_format
      AND source = 'limitless'
      AND is_active = true
  )
  UPDATE opponent_deck_master odm
  SET sort_order = rs.new_order
  FROM rs
  WHERE odm.id = rs.id;

  -- (5) settings 側の同期状態を更新
  UPDATE opponent_deck_settings
  SET limitless_last_synced_at = p_synced_at,
      limitless_last_sync_status = 'ok',
      limitless_last_sync_message = NULL,
      updated_at = now()
  WHERE game_title = p_game_title AND format = p_format;

  RETURN jsonb_build_object('count', v_count, 'synced_at', p_synced_at);
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- === 4. 同期エラー記録用 RPC ===
CREATE OR REPLACE FUNCTION mark_limitless_sync_error(
  p_game_title text,
  p_format text,
  p_status text,
  p_message text
)
RETURNS void AS $func$
BEGIN
  UPDATE opponent_deck_settings
  SET limitless_last_sync_status = p_status,
      limitless_last_sync_message = p_message,
      updated_at = now()
  WHERE game_title = p_game_title AND format = p_format;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
