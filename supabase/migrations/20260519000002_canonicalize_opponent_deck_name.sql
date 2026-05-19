-- 対面デッキ名 (opponent_deck_master.name) を「アプリ内正式名: 空白なし日本語名」に統一する。
-- 詳細設計は docs/plans/2026-05-19_opponent_deck_name_canonicalization.md 参照。
--
-- 改修内容:
--   1. Phase E1-E5: 既存データの正規化 (衝突 case 統合 + name 空白削除 + battles 同期)
--   2. Phase E6: apply_limitless_snapshot を slug primary + name_en fallback + admin 手動優先 + collision pre-check 仕様で CREATE OR REPLACE
--   3. 新規 RPC admin_update_opponent_deck_name_ja: admin 画面の和名編集を 1 transaction で完結 (canonical name 更新 + 衝突 check + battles 同期 UPDATE)
--   4. Phase C7-C8: 空白禁止 CHECK 制約追加
--
-- Resolved Decisions:
--   - [name再計算規則] Admin 手動優先 (name_ja_is_manual=true なら既存 name_ja から computed_name 算出、payload を無視)
--   - [衝突時挙動] 全体 abort + error (RAISE EXCEPTION で transaction rollback、自動 merge しない)
--   - [撤去戦略] displayDeckName / getOpponentDeckNameMap / OpponentDeckNameMap を本 PR で完全撤去 (TS 側のみ、本 migration は DB のみ)

BEGIN;

-- =============================================================================
-- Phase E1: 衝突 case の事前 battles merge
--   pokepoke/RANKED の「メガチルタリスexププリン」 (manual / 既存空白なし日本語)
--   と「Mega Altaria ex Igglybuff」 (limitless 英語名) は同一デッキ。
--   battles 計 5 件 (manual 由来 2 件 + 英語名 3 件) を新 canonical name
--   「メガチルタリスexププリン」(stripAllWhitespace(name_ja=「メガチルタリスex ププリン」)) に統合。
-- =============================================================================

UPDATE public.battles
SET opponent_deck_name = 'メガチルタリスexププリン'
WHERE game_title = 'pokepoke'
  AND format = 'RANKED'
  AND opponent_deck_name IN ('メガチルタリスexププリン', 'Mega Altaria ex Igglybuff');

-- =============================================================================
-- Phase E2: 衝突 manual 行を先に DELETE
--   Phase E3 の Limitless 行 name UPDATE が UNIQUE (name, format, game_title)
--   と衝突しないよう、ここで manual 行 (id を name + format + game_title + source
--   で安全に特定) を削除。
-- =============================================================================

DELETE FROM public.opponent_deck_master
WHERE name = 'メガチルタリスexププリン'
  AND format = 'RANKED'
  AND game_title = 'pokepoke'
  AND source = 'manual';

-- =============================================================================
-- Phase E3: Limitless 由来行の name を canonical 形式に正規化
--   name = stripAllWhitespace(name_ja) を基本とし、name_ja が NULL の行は
--   stripAllWhitespace(name_en) にフォールバック。
-- =============================================================================

UPDATE public.opponent_deck_master
SET name = regexp_replace(COALESCE(name_ja, name_en), '[[:space:]　​-‍﻿]', '', 'g')
WHERE source = 'limitless';

-- =============================================================================
-- Phase E4: manual 由来行の name を正規化 (空白を含む行のみ更新)
--   現状 pokepoke/RANKED の「アローラキュウコンex シザリガー」(半角スペース含)
--   1 件のみが該当。dm 側の manual 行はすべて元から空白なし。
-- =============================================================================

UPDATE public.opponent_deck_master
SET name = regexp_replace(name, '[[:space:]　​-‍﻿]', '', 'g')
WHERE source = 'manual'
  AND name ~ '[[:space:]　​-‍﻿]';

-- =============================================================================
-- Phase E5: battles.opponent_deck_name を全体正規化
--   優先順位:
--     1. master の name_en と一致 (Limitless 英語名で保存された battles) → master.name (日本語空白なし)
--     2. master の name と直接一致 → そのまま (Phase E3/E4 後の master.name で OK)
--     3. どちらも該当しない自由入力 → stripAllWhitespace のみ適用
-- =============================================================================

WITH new_names AS (
  SELECT
    b.id AS battle_id,
    COALESCE(
      m_name_en.new_name,
      m_name.new_name,
      regexp_replace(b.opponent_deck_name, '[[:space:]　​-‍﻿]', '', 'g')
    ) AS new_opponent_deck_name
  FROM public.battles b
  -- master の name_en (= 英語名) で照合 (Limitless 由来 battles の英語名→日本語名 migration)
  LEFT JOIN (
    SELECT format, game_title, name_en, name AS new_name
    FROM public.opponent_deck_master
    WHERE source = 'limitless'
      AND name_en IS NOT NULL
  ) m_name_en
    ON m_name_en.format = b.format
   AND m_name_en.game_title = b.game_title
   AND m_name_en.name_en = b.opponent_deck_name
  -- master.name で直接照合 (manual / 既存日本語名)
  LEFT JOIN (
    SELECT format, game_title, name, name AS new_name
    FROM public.opponent_deck_master
  ) m_name
    ON m_name.format = b.format
   AND m_name.game_title = b.game_title
   AND m_name.name = regexp_replace(b.opponent_deck_name, '[[:space:]　​-‍﻿]', '', 'g')
)
UPDATE public.battles b
SET opponent_deck_name = nn.new_opponent_deck_name
FROM new_names nn
WHERE nn.battle_id = b.id
  AND b.opponent_deck_name <> nn.new_opponent_deck_name;

-- =============================================================================
-- Phase E6: apply_limitless_snapshot を新仕様で CREATE OR REPLACE
--   - 照合キー: limitless_deck_slug (primary) → name_en (fallback)
--   - name 算出: name_ja_is_manual=true の行は admin 手動優先
--   - collision pre-check: computed_name が他行 name と衝突したら全体 abort
--   - battles 同期 UPDATE: name 変動時 (old_name <> new_name) に旧 name / name_en
--     両方を新 name に統一
--   - 防御パターン: NULLIF / jsonb_typeof / category='other' 保持
--   - SECURITY DEFINER / SET search_path / REVOKE+GRANT は現行 20260509000001 1-1 を踏襲
-- =============================================================================

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
  v_existing_id uuid;
  v_old_name text;
  v_computed_name text;
  v_count int := 0;
  v_name_changes jsonb := '[]'::jsonb;  -- {old_name, new_name, name_en} の累積
BEGIN
  -- 設定取得
  SELECT * INTO v_settings
  FROM public.opponent_deck_settings
  WHERE game_title = p_game_title AND format = p_format;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'settings row not found for game_title=%, format=%', p_game_title, p_format;
  END IF;

  -- (1) Limitless snapshot を 1 行ずつ処理
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    -- step 1: slug 一致で既存検索
    SELECT id INTO v_existing_id
    FROM public.opponent_deck_master
    WHERE format = p_format
      AND game_title = p_game_title
      AND limitless_deck_slug = v_row->>'slug';

    -- step 2: なければ name_en で再検索 (slug 変動時の救済)
    IF v_existing_id IS NULL THEN
      SELECT id INTO v_existing_id
      FROM public.opponent_deck_master
      WHERE format = p_format
        AND game_title = p_game_title
        AND source = 'limitless'
        AND name_en = v_row->>'name_en';
    END IF;

    -- step 3: 新 name 算出 (Resolved Decisions §5.4 準拠)
    --   name_ja_is_manual = true の行: 既存 name_ja から算出 (admin 手動を優先、payload 無視)
    --   それ以外: payload の name_ja (なければ name_en) から算出
    IF v_existing_id IS NOT NULL THEN
      SELECT
        CASE
          WHEN name_ja_is_manual
            THEN regexp_replace(COALESCE(name_ja, name_en), '[[:space:]　​-‍﻿]', '', 'g')
          ELSE regexp_replace(COALESCE(v_row->>'name_ja', v_row->>'name_en'), '[[:space:]　​-‍﻿]', '', 'g')
        END
      INTO v_computed_name
      FROM public.opponent_deck_master
      WHERE id = v_existing_id;
    ELSE
      v_computed_name := regexp_replace(
        COALESCE(v_row->>'name_ja', v_row->>'name_en'),
        '[[:space:]　​-‍﻿]', '', 'g'
      );
    END IF;

    -- step 4: collision pre-check (Resolved Decisions §13.2 準拠)
    --   computed_name が同 (format, game_title) 内の他行 name と衝突したら全体 abort
    IF EXISTS (
      SELECT 1 FROM public.opponent_deck_master
      WHERE name = v_computed_name
        AND format = p_format
        AND game_title = p_game_title
        AND (v_existing_id IS NULL OR id <> v_existing_id)
    ) THEN
      RAISE EXCEPTION
        'apply_limitless_snapshot name collision: computed_name=%, incoming name_en=%, slug=%, existing_id=%',
        v_computed_name, v_row->>'name_en', v_row->>'slug',
        (SELECT id::text || ' (source=' || source || ', name_en=' || COALESCE(name_en, '') || ')'
         FROM public.opponent_deck_master
         WHERE name = v_computed_name AND format = p_format AND game_title = p_game_title
           AND (v_existing_id IS NULL OR id <> v_existing_id) LIMIT 1);
    END IF;

    -- step 5: UPSERT
    IF v_existing_id IS NOT NULL THEN
      -- UPDATE 前に旧 name を保持 (battles 同期用)
      SELECT name INTO v_old_name
      FROM public.opponent_deck_master
      WHERE id = v_existing_id;

      UPDATE public.opponent_deck_master
      SET
        name = v_computed_name,
        name_ja = CASE WHEN name_ja_is_manual THEN name_ja ELSE v_row->>'name_ja' END,
        name_en = v_row->>'name_en',
        limitless_deck_slug = v_row->>'slug',
        limitless_share = NULLIF(v_row->>'share','')::numeric,
        limitless_count = NULLIF(v_row->>'count','')::int,
        limitless_wins = NULLIF(v_row->>'wins','')::int,
        limitless_losses = NULLIF(v_row->>'losses','')::int,
        limitless_ties = NULLIF(v_row->>'ties','')::int,
        limitless_win_pct = NULLIF(v_row->>'win_pct','')::numeric,
        limitless_icon_urls = CASE WHEN jsonb_typeof(v_row->'icon_urls') = 'array'
             THEN ARRAY(SELECT jsonb_array_elements_text(v_row->'icon_urls'))
             ELSE NULL END,
        limitless_last_synced_at = p_synced_at,
        is_active = TRUE
      WHERE id = v_existing_id;

      -- name 変動を v_name_changes に追加 (battles 同期 UPDATE で利用)
      IF v_old_name IS NOT NULL AND v_old_name <> v_computed_name THEN
        v_name_changes := v_name_changes || jsonb_build_array(
          jsonb_build_object(
            'old_name', v_old_name,
            'new_name', v_computed_name,
            'name_en', v_row->>'name_en'
          )
        );
      END IF;
    ELSE
      INSERT INTO public.opponent_deck_master (
        game_title, format, name, name_en, name_ja, name_ja_is_manual,
        category, is_active, sort_order, source,
        limitless_share, limitless_count, limitless_wins,
        limitless_losses, limitless_ties, limitless_win_pct,
        limitless_icon_urls, limitless_deck_slug, limitless_last_synced_at
      ) VALUES (
        p_game_title, p_format, v_computed_name, v_row->>'name_en', v_row->>'name_ja', false,
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
      );

      -- 新規 INSERT も name_en で battles 同期対象に含める (英語名で残った battles を救済)
      v_name_changes := v_name_changes || jsonb_build_array(
        jsonb_build_object(
          'old_name', NULL,
          'new_name', v_computed_name,
          'name_en', v_row->>'name_en'
        )
      );
    END IF;

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

  -- (6) §5.4 案 C: name 変動時 battles を同期 UPDATE
  --   v_name_changes (UPSERT loop で蓄積した {old_name, new_name, name_en}) を使い、
  --   battles.opponent_deck_name が旧 name または name_en で残っている行を新 name に揃える。
  WITH name_map AS (
    SELECT
      (x->>'old_name') AS old_name,
      (x->>'new_name') AS new_name,
      (x->>'name_en')  AS name_en
    FROM jsonb_array_elements(v_name_changes) AS x
  )
  UPDATE public.battles b
  SET opponent_deck_name = nm.new_name
  FROM name_map nm
  WHERE b.format = p_format
    AND b.game_title = p_game_title
    AND (
      (nm.old_name IS NOT NULL AND b.opponent_deck_name = nm.old_name)
      OR (nm.name_en IS NOT NULL AND b.opponent_deck_name = nm.name_en)
    )
    AND b.opponent_deck_name <> nm.new_name;

  RETURN jsonb_build_object('count', v_count, 'synced_at', p_synced_at);
END;
$func$;

REVOKE ALL ON FUNCTION public.apply_limitless_snapshot(text, text, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_limitless_snapshot(text, text, jsonb, timestamptz)
  TO service_role;

-- =============================================================================
-- 新規 RPC: admin_update_opponent_deck_name_ja
--   admin 画面の「対面デッキ和名編集」用。クライアント側 (anon key + RLS) では
--   battles の他ユーザー行を UPDATE できないため、SECURITY DEFINER で RLS bypass。
--   admin 判定 + canonical name 更新 + 衝突 pre-check + battles 同期 UPDATE を
--   1 transaction で完結。
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_opponent_deck_name_ja(
  p_id uuid,
  p_name_ja text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_old_name text;
  v_format text;
  v_game_title text;
  v_trimmed text;
  v_computed_name text;
  v_battles_synced int := 0;
BEGIN
  -- (1) admin 判定: profiles.is_admin = true でない呼び出しは reject
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'forbidden: admin role required (uid=%)', auth.uid();
  END IF;

  -- (2) 既存行取得 (FOR UPDATE で同時更新を排他)
  SELECT name, format, game_title
  INTO v_old_name, v_format, v_game_title
  FROM public.opponent_deck_master
  WHERE id = p_id
  FOR UPDATE;

  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'opponent_deck_master row not found: id=%', p_id;
  END IF;

  -- (3) name_ja 正規化 (Codex 補足: null 防御で coalesce 経由)
  v_trimmed := trim(coalesce(p_name_ja, ''));

  IF v_trimmed = '' THEN
    -- manual override 解除: name_ja=null / name_ja_is_manual=false にし、name は不変
    UPDATE public.opponent_deck_master
    SET name_ja = NULL,
        name_ja_is_manual = false
    WHERE id = p_id;
    RETURN jsonb_build_object('updated_name', v_old_name, 'battles_synced', 0, 'cleared', true);
  END IF;

  -- (4) computed_name 算出 (TS stripAllWhitespace と同等パターン)
  v_computed_name := regexp_replace(v_trimmed, '[[:space:]　​-‍﻿]', '', 'g');

  IF v_computed_name = '' THEN
    RAISE EXCEPTION 'name_ja contains only whitespace, computed_name would be empty';
  END IF;

  -- (5) 衝突 pre-check
  IF EXISTS (
    SELECT 1 FROM public.opponent_deck_master
    WHERE name = v_computed_name
      AND format = v_format
      AND game_title = v_game_title
      AND id <> p_id
  ) THEN
    RAISE EXCEPTION
      'name collision: computed_name=%, existing_id=%',
      v_computed_name,
      (SELECT id::text || ' (source=' || source || ', name_en=' || COALESCE(name_en, '') || ')'
       FROM public.opponent_deck_master
       WHERE name = v_computed_name AND format = v_format AND game_title = v_game_title AND id <> p_id
       LIMIT 1);
  END IF;

  -- (6) opponent_deck_master 更新
  UPDATE public.opponent_deck_master
  SET name = v_computed_name,
      name_ja = v_trimmed,
      name_ja_is_manual = true
  WHERE id = p_id;

  -- (7) battles 同期 UPDATE (旧 name <> 新 name のみ)
  IF v_old_name IS NOT NULL AND v_old_name <> v_computed_name THEN
    WITH updated AS (
      UPDATE public.battles
      SET opponent_deck_name = v_computed_name
      WHERE format = v_format
        AND game_title = v_game_title
        AND opponent_deck_name = v_old_name
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_battles_synced FROM updated;
  END IF;

  RETURN jsonb_build_object(
    'updated_name', v_computed_name,
    'old_name', v_old_name,
    'battles_synced', v_battles_synced,
    'cleared', false
  );
END;
$func$;

REVOKE ALL ON FUNCTION public.admin_update_opponent_deck_name_ja(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_opponent_deck_name_ja(uuid, text)
  TO authenticated;

-- =============================================================================
-- Phase C7: opponent_deck_master.name の空白禁止 CHECK
-- =============================================================================

ALTER TABLE public.opponent_deck_master
  ADD CONSTRAINT opponent_deck_master_name_no_whitespace_check
  CHECK (name !~ '[[:space:]　​-‍﻿]');

-- =============================================================================
-- Phase C8: battles.opponent_deck_name の空白禁止 CHECK
-- =============================================================================

ALTER TABLE public.battles
  ADD CONSTRAINT battles_opponent_deck_name_no_whitespace_check
  CHECK (opponent_deck_name !~ '[[:space:]　​-‍﻿]');

COMMIT;
