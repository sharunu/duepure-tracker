-- Remove deprecated quality scoring rules and let premium users trigger detection alerts.

DELETE FROM quality_scoring_rules
WHERE rule_key IN ('recent_battles', 'normal_input_pace', 'excessive_input');

UPDATE quality_score_snapshots
SET
  total_score = total_score
    - COALESCE((breakdown->>'recent_battles')::integer, 0)
    - COALESCE((breakdown->>'normal_input_pace')::integer, 0)
    - COALESCE((breakdown->>'excessive_input')::integer, 0),
  breakdown = breakdown - 'recent_battles' - 'normal_input_pace' - 'excessive_input',
  calculated_at = now()
WHERE breakdown ?| ARRAY['recent_battles', 'normal_input_pace', 'excessive_input'];

-- detect_extreme_winrate: include stage 1 (premium) users, while keeping stage 4 excluded.
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
  WHERE p.stage IN (1, 2, 3)
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

-- detect_rapid_input: include stage 1 (premium) users, preserving the window_hours fix.
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

-- detect_repetitive_pattern: include stage 1 (premium) users, while keeping stage 4 excluded.
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
