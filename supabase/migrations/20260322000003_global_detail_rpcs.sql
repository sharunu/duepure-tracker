-- Global deck detail stats (by opponent, with turn order breakdown)
CREATE OR REPLACE FUNCTION get_global_deck_detail_stats(
  p_deck_name text, p_format text DEFAULT 'AD', p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  opponent_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS opponent_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'lose') AS losses,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'lose' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'lose' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'lose' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM battles b
  JOIN decks d ON d.id = b.my_deck_id
  WHERE d.name = p_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY COALESCE(b.opponent_deck_normalized, b.opponent_deck_name)
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Global opponent deck detail stats (by my deck, with turn order breakdown)
CREATE OR REPLACE FUNCTION get_global_opponent_deck_detail_stats(
  p_opponent_deck_name text, p_format text DEFAULT 'AD', p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  my_deck_name text,
  wins bigint, losses bigint, total bigint,
  first_wins bigint, first_losses bigint, first_total bigint,
  second_wins bigint, second_losses bigint, second_total bigint,
  unknown_wins bigint, unknown_losses bigint, unknown_total bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.name AS my_deck_name,
    COUNT(*) FILTER (WHERE b.result = 'win') AS wins,
    COUNT(*) FILTER (WHERE b.result = 'lose') AS losses,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'first') AS first_wins,
    COUNT(*) FILTER (WHERE b.result = 'lose' AND b.turn_order = 'first') AS first_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'first') AS first_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND b.turn_order = 'second') AS second_wins,
    COUNT(*) FILTER (WHERE b.result = 'lose' AND b.turn_order = 'second') AS second_losses,
    COUNT(*) FILTER (WHERE b.turn_order = 'second') AS second_total,
    COUNT(*) FILTER (WHERE b.result = 'win' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_wins,
    COUNT(*) FILTER (WHERE b.result = 'lose' AND (b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second'))) AS unknown_losses,
    COUNT(*) FILTER (WHERE b.turn_order IS NULL OR b.turn_order NOT IN ('first', 'second')) AS unknown_total
  FROM battles b
  JOIN decks d ON d.id = b.my_deck_id
  WHERE COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) = p_opponent_deck_name
    AND b.format = p_format
    AND (p_start_date IS NULL OR b.fought_at >= p_start_date)
    AND (p_end_date IS NULL OR b.fought_at < p_end_date + interval '1 day')
  GROUP BY d.name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
