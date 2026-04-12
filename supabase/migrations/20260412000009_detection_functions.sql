-- 1. detect_extreme_winrate
CREATE OR REPLACE FUNCTION detect_extreme_winrate(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
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
  FROM battles b
  JOIN profiles p ON p.id = b.user_id
  WHERE p.stage IN (2, 3)
    AND b.fought_at >= (now() - (v_period_days || ' days')::interval)
    AND NOT EXISTS (
      SELECT 1 FROM detection_alerts da
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. detect_rapid_input
CREATE OR REPLACE FUNCTION detect_rapid_input(p_params jsonb)
RETURNS TABLE (user_id uuid, rule_key text, details jsonb)
AS $$
DECLARE
  v_window_hours integer := (p_params->>'window_hours')::integer;
  v_max_battles integer := (p_params->>'max_battles')::integer;
BEGIN
  RETURN QUERY
  WITH hourly_counts AS (
    SELECT
      b.user_id,
      date_trunc('hour', b.fought_at) AS hour_start,
      COUNT(*) AS cnt
    FROM battles b
    JOIN profiles p ON p.id = b.user_id
    WHERE p.stage IN (2, 3)
      AND b.fought_at >= now() - interval '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM detection_alerts da
        WHERE da.user_id = b.user_id
          AND da.rule_key = 'rapid_input'
          AND da.is_resolved = false
      )
    GROUP BY b.user_id, date_trunc('hour', b.fought_at)
  )
  SELECT
    hc.user_id,
    'rapid_input'::text AS rule_key,
    jsonb_build_object(
      'hour_start', hc.hour_start,
      'battle_count', hc.cnt,
      'threshold', v_max_battles
    ) AS details
  FROM hourly_counts hc
  WHERE hc.cnt >= v_max_battles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. detect_repetitive_pattern
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
    WHERE p.stage IN (2, 3)
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

-- 4. run_detection_scan (wrapper)
CREATE OR REPLACE FUNCTION run_detection_scan()
RETURNS integer AS $$
DECLARE
  total_alerts integer := 0;
  v_row_count integer;
  rule record;
BEGIN
  FOR rule IN SELECT * FROM detection_rules WHERE is_enabled = true LOOP
    CASE rule.rule_key
      WHEN 'extreme_winrate' THEN
        INSERT INTO detection_alerts (user_id, rule_key, details)
        SELECT * FROM detect_extreme_winrate(rule.params);
      WHEN 'rapid_input' THEN
        INSERT INTO detection_alerts (user_id, rule_key, details)
        SELECT * FROM detect_rapid_input(rule.params);
      WHEN 'repetitive_pattern' THEN
        INSERT INTO detection_alerts (user_id, rule_key, details)
        SELECT * FROM detect_repetitive_pattern(rule.params);
    END CASE;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    total_alerts := total_alerts + v_row_count;
  END LOOP;
  RETURN total_alerts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
