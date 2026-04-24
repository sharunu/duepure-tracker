-- ROLLBACK for supabase/migrations/20260424000004_auto_scan_and_sliding_window.sql
--
-- THIS FILE IS NOT AUTO-APPLIED. `supabase db push` only picks up files under
-- supabase/migrations/. Run the SQL below manually in the Supabase SQL Editor
-- (or `psql`) when a rollback is required.
--
-- Expected effect after running this script:
--   * daily-quality-scoring / daily-detection-scan cron jobs are unscheduled
--   * detect_rapid_input and detect_repetitive_pattern revert to the
--     definitions from migration 20260424000003
--   * period_hours / period_days keys are stripped from detection_rules.params
--
-- NOTE: This does NOT roll back daily-opponent-deck-recalc (predates this
-- migration) and does NOT touch detect_extreme_winrate (not changed in 000004).

-- ------------------------------------------------------------
-- 1. Unschedule cron jobs added in 000004
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-quality-scoring') THEN
    PERFORM cron.unschedule('daily-quality-scoring');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-detection-scan') THEN
    PERFORM cron.unschedule('daily-detection-scan');
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. Restore function definitions from 20260424000003
-- ------------------------------------------------------------
-- ⚠️  Only detect_rapid_input and detect_repetitive_pattern below.
--     DO NOT paste detect_extreme_winrate here — it was not modified by
--     20260424000004, so restoring it would be a no-op at best and could
--     clobber any unrelated future change.

-- 2-a. detect_rapid_input (copy of 20260424000003:56-96)
CREATE OR REPLACE FUNCTION detect_rapid_input(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
AS $$
DECLARE
  v_window_hours integer := (p_params->>'window_hours')::integer;
  v_max_battles integer := (p_params->>'max_battles')::integer;
  v_window_seconds integer := v_window_hours * 3600;
BEGIN
  RETURN QUERY
  WITH window_counts AS (
    SELECT
      b.user_id,
      to_timestamp(
        floor(extract(epoch from b.fought_at) / v_window_seconds) * v_window_seconds
      ) AS window_start,
      COUNT(*) AS cnt
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
    WHERE p.stage IN (1, 2, 3)
      AND b.fought_at >= now() - make_interval(hours => GREATEST(v_window_hours * 3, 24))
      AND NOT EXISTS (
        SELECT 1 FROM detection_alerts da
        WHERE da.user_id = b.user_id
          AND da.rule_key = 'rapid_input'
          AND da.is_resolved = false
      )
    GROUP BY b.user_id, floor(extract(epoch from b.fought_at) / v_window_seconds)
  )
  SELECT
    wc.user_id,
    'rapid_input'::text AS rule_key,
    jsonb_build_object(
      'window_start', wc.window_start,
      'window_hours', v_window_hours,
      'battle_count', wc.cnt,
      'threshold', v_max_battles
    ) AS details
  FROM window_counts wc
  WHERE wc.cnt >= v_max_battles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2-b. detect_repetitive_pattern (copy of 20260424000003:99-145)
CREATE OR REPLACE FUNCTION detect_repetitive_pattern(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
AS $$
DECLARE
  v_max_consecutive integer := (p_params->>'max_consecutive')::integer;
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
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
    WHERE p.stage IN (1, 2, 3)
      AND NOT EXISTS (
        SELECT 1 FROM detection_alerts da
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
      'threshold', v_max_consecutive
    ) AS details
  FROM streaks s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- 3. Strip new params keys
-- ------------------------------------------------------------
UPDATE detection_rules
  SET params = params - 'period_hours',
      updated_at = now()
  WHERE rule_key = 'rapid_input';

UPDATE detection_rules
  SET params = params - 'period_days',
      updated_at = now()
  WHERE rule_key = 'repetitive_pattern';
