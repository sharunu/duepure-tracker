-- チューニングテーブル
CREATE TABLE deck_tunings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deck_tunings_deck_id ON deck_tunings(deck_id);
ALTER TABLE deck_tunings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own deck tunings"
  ON deck_tunings FOR ALL
  USING (EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_tunings.deck_id AND decks.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_tunings.deck_id AND decks.user_id = auth.uid()));

-- battlesにtuning_id追加
ALTER TABLE battles ADD COLUMN tuning_id uuid REFERENCES deck_tunings(id) ON DELETE SET NULL;
CREATE INDEX idx_battles_tuning_id ON battles(tuning_id);
