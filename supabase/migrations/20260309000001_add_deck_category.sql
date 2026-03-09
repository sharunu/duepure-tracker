ALTER TABLE opponent_deck_master
  ADD COLUMN category text NOT NULL DEFAULT 'major'
  CHECK (category IN ('major', 'other'));

DROP FUNCTION IF EXISTS get_opponent_deck_suggestions(text);
CREATE FUNCTION get_opponent_deck_suggestions(p_format text DEFAULT 'AD')
RETURNS TABLE (deck_name text, deck_category text) AS $$
BEGIN
  RETURN QUERY
  SELECT odm.name AS deck_name, odm.category AS deck_category
  FROM opponent_deck_master odm
  WHERE odm.is_active = true AND odm.format = p_format
  ORDER BY odm.sort_order ASC, odm.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
