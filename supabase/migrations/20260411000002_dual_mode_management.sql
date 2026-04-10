-- === 1-1. 設定テーブル作成 ===
CREATE TABLE opponent_deck_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  format text NOT NULL UNIQUE CHECK (format IN ('AD', 'ND')),
  management_mode text NOT NULL DEFAULT 'admin' CHECK (management_mode IN ('admin', 'auto')),
  major_threshold numeric NOT NULL DEFAULT 3.0,
  minor_threshold numeric NOT NULL DEFAULT 1.0,
  usage_period_days integer NOT NULL DEFAULT 14,
  disable_period_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO opponent_deck_settings (format) VALUES ('AD'), ('ND');

ALTER TABLE opponent_deck_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read settings"
  ON opponent_deck_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings"
  ON opponent_deck_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- === 1-2. opponent_deck_master にカラム追加 ===
ALTER TABLE opponent_deck_master
  ADD COLUMN admin_bonus_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_used_at timestamptz;

-- === 1-3. バッチ処理関数 ===
CREATE OR REPLACE FUNCTION recalculate_opponent_decks(p_format text)
RETURNS void AS $$
DECLARE
  v_settings record;
  v_total_battles bigint;
  v_total_bonus bigint;
  v_denominator bigint;
  v_start_date timestamptz;
BEGIN
  SELECT * INTO v_settings
  FROM opponent_deck_settings WHERE format = p_format;

  IF v_settings IS NULL THEN RETURN; END IF;
  IF v_settings.management_mode <> 'auto' THEN RETURN; END IF;

  v_start_date := now() - (v_settings.usage_period_days || ' days')::interval;

  SELECT COUNT(*) INTO v_total_battles
  FROM battles
  WHERE format = p_format AND fought_at >= v_start_date;

  SELECT COALESCE(SUM(admin_bonus_count), 0) INTO v_total_bonus
  FROM opponent_deck_master
  WHERE format = p_format AND is_active = true;

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
      WHERE format = p_format AND fought_at >= v_start_date
      GROUP BY opponent_deck_name
    ) bc ON bc.opponent_deck_name = odm.name
    WHERE odm.format = p_format AND odm.is_active = true
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
      WHERE format = p_format AND fought_at >= v_start_date
      GROUP BY opponent_deck_name
    ) bc ON bc.opponent_deck_name = odm.name
    WHERE odm.format = p_format AND odm.is_active = true
  )
  UPDATE opponent_deck_master odm
  SET sort_order = r.new_order
  FROM ranked r
  WHERE odm.id = r.id;

  UPDATE opponent_deck_master
  SET is_active = false
  WHERE format = p_format
    AND is_active = true
    AND last_used_at IS NOT NULL
    AND last_used_at < now() - (v_settings.disable_period_days || ' days')::interval;

  UPDATE opponent_deck_master
  SET is_active = false
  WHERE format = p_format
    AND is_active = true
    AND last_used_at IS NULL
    AND created_at < now() - (v_settings.disable_period_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === 1-4. 日次バッチ用ラッパー関数 ===
CREATE OR REPLACE FUNCTION run_daily_opponent_deck_batch()
RETURNS void AS $$
BEGIN
  PERFORM recalculate_opponent_decks('AD');
  PERFORM recalculate_opponent_decks('ND');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === 1-5. pg_cron設定 ===
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'daily-opponent-deck-recalc',
  '0 19 * * *',
  $$SELECT run_daily_opponent_deck_batch()$$
);

-- === 1-6. 未登録デッキ自動追加関数 ===
CREATE OR REPLACE FUNCTION auto_add_opponent_deck(
  p_deck_name text, p_format text
)
RETURNS void AS $$
DECLARE
  v_mode text;
  v_max_sort integer;
BEGIN
  UPDATE opponent_deck_master
  SET last_used_at = now()
  WHERE name = p_deck_name AND format = p_format;

  IF FOUND THEN RETURN; END IF;

  SELECT management_mode INTO v_mode
  FROM opponent_deck_settings WHERE format = p_format;

  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM opponent_deck_master WHERE format = p_format;

  IF v_mode = 'auto' THEN
    INSERT INTO opponent_deck_master (name, format, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, 'other', true, v_max_sort + 10, now());
  ELSE
    INSERT INTO opponent_deck_master (name, format, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, 'other', false, v_max_sort + 10, now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
