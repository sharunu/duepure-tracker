-- Fix: detect_rapid_input が window_hours パラメータを無視していた問題を修正
-- date_trunc('hour') の固定1時間バケットを、window_hours に応じた可変サイズバケットに変更

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
    WHERE p.stage IN (2, 3)
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
