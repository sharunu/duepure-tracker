-- profiles に is_admin 追加
ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

-- 対面デッキマスターテーブル
CREATE TABLE opponent_deck_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE opponent_deck_master ENABLE ROW LEVEL SECURITY;

-- 全認証ユーザー読み取り可
CREATE POLICY "Authenticated users can read decks"
  ON opponent_deck_master FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 管理者のみ書き込み可
CREATE POLICY "Admins can insert" ON opponent_deck_master FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update" ON opponent_deck_master FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete" ON opponent_deck_master FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- get_opponent_deck_suggestions() をマスターテーブル参照に置き換え
CREATE OR REPLACE FUNCTION get_opponent_deck_suggestions()
RETURNS TABLE(deck_name text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT m.name FROM public.opponent_deck_master m
  WHERE m.is_active = true
  ORDER BY m.sort_order ASC, m.name ASC;
END;
$$;
