-- category: 'other' → 'minor' にリネームし、新しい 'other' カテゴリを追加

-- 1. 既存CHECK制約を削除
ALTER TABLE opponent_deck_master DROP CONSTRAINT opponent_deck_master_category_check;

-- 2. 既存 'other' → 'minor' にリネーム
UPDATE opponent_deck_master SET category = 'minor' WHERE category = 'other';

-- 3. 新しい3値CHECK制約を追加
ALTER TABLE opponent_deck_master
  ADD CONSTRAINT opponent_deck_master_category_check
  CHECK (category IN ('major', 'minor', 'other'));

-- 4. RPC関数を再作成
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
