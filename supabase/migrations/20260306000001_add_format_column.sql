-- Add format column to decks, battles, opponent_deck_master
ALTER TABLE decks ADD COLUMN format text NOT NULL DEFAULT 'ND' CHECK (format IN ('AD', 'ND'));
ALTER TABLE battles ADD COLUMN format text NOT NULL DEFAULT 'ND' CHECK (format IN ('AD', 'ND'));
ALTER TABLE opponent_deck_master ADD COLUMN format text NOT NULL DEFAULT 'ND' CHECK (format IN ('AD', 'ND'));

-- Drop old unique constraint and add new one with format
ALTER TABLE opponent_deck_master DROP CONSTRAINT IF EXISTS opponent_deck_master_name_key;
ALTER TABLE opponent_deck_master ADD CONSTRAINT opponent_deck_master_name_format_key UNIQUE (name, format);

-- Add indexes
CREATE INDEX idx_battles_format ON battles (format);
CREATE INDEX idx_decks_format ON decks (format);

-- Update get_opponent_deck_suggestions to accept format parameter
CREATE OR REPLACE FUNCTION get_opponent_deck_suggestions(p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text) AS $$
BEGIN
  RETURN QUERY
  SELECT odm.name AS deck_name
  FROM opponent_deck_master odm
  WHERE odm.is_active = true
    AND odm.format = p_format
  ORDER BY odm.sort_order ASC, odm.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_environment_deck_shares to accept format parameter
CREATE OR REPLACE FUNCTION get_environment_deck_shares(p_days integer DEFAULT 7, p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, battle_count bigint, share_pct numeric) AS $$
BEGIN
  RETURN QUERY
  WITH recent AS (
    SELECT
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS deck,
      COUNT(*) AS cnt
    FROM battles b
    WHERE b.fought_at >= NOW() - (p_days || ' days')::interval
      AND b.format = p_format
    GROUP BY deck
  ),
  total AS (
    SELECT SUM(cnt) AS total_cnt FROM recent
  )
  SELECT
    r.deck AS deck_name,
    r.cnt AS battle_count,
    ROUND(r.cnt * 100.0 / NULLIF(t.total_cnt, 0), 1) AS share_pct
  FROM recent r, total t
  ORDER BY r.cnt DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
