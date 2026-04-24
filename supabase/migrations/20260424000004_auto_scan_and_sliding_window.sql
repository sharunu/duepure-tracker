-- Auto-scan scheduling + rapid_input sliding window + repetitive_pattern period filter.
-- See supabase/rollback/20260424000004_rollback.sql for rollback procedure.

-- ============================================================
-- 1. detect_rapid_input: true sliding window using RANGE BETWEEN
-- ============================================================
CREATE OR REPLACE FUNCTION detect_rapid_input(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
AS $$
DECLARE
  v_window_hours integer := (p_params->>'window_hours')::integer;
  v_max_battles integer := (p_params->>'max_battles')::integer;
  v_period_hours integer := COALESCE((p_params->>'period_hours')::integer, 24);
BEGIN
  -- Safety: period must cover at least one full window, otherwise the sliding
  -- count for the earliest battles in range would miss prior battles.
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
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
    WHERE p.stage IN (1, 2, 3)
      AND b.fought_at >= now() - make_interval(hours => v_period_hours)
      AND NOT EXISTS (
        SELECT 1 FROM detection_alerts da
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. detect_repetitive_pattern: add period_days filter
-- ============================================================
CREATE OR REPLACE FUNCTION detect_repetitive_pattern(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
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
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
    WHERE p.stage IN (1, 2, 3)
      AND b.fought_at >= now() - make_interval(days => v_period_days)
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
      'threshold', v_max_consecutive,
      'period_days', v_period_days
    ) AS details
  FROM streaks s;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. Seed new params into existing detection_rules
-- ============================================================
UPDATE detection_rules
  SET params = params || '{"period_hours": 24}'::jsonb,
      updated_at = now()
  WHERE rule_key = 'rapid_input'
    AND NOT (params ? 'period_hours');

UPDATE detection_rules
  SET params = params || '{"period_days": 1}'::jsonb,
      updated_at = now()
  WHERE rule_key = 'repetitive_pattern'
    AND NOT (params ? 'period_days');

-- ============================================================
-- 4. pg_cron schedules (idempotent)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-quality-scoring') THEN
    PERFORM cron.unschedule('daily-quality-scoring');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-detection-scan') THEN
    PERFORM cron.unschedule('daily-detection-scan');
  END IF;
END $$;

-- 04:15 JST (19:15 UTC) — run quality scoring with auto stage promotion/demotion
SELECT cron.schedule(
  'daily-quality-scoring',
  '15 19 * * *',
  $$SELECT run_quality_scoring(true)$$
);

-- 04:30 JST (19:30 UTC) — run detection scan after stages are finalized
SELECT cron.schedule(
  'daily-detection-scan',
  '30 19 * * *',
  $$SELECT run_detection_scan()$$
);
