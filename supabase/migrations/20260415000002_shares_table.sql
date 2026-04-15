-- shares table for OGP image generation
CREATE TABLE shares (
  id text PRIMARY KEY,
  share_type text NOT NULL CHECK (share_type IN ('stats', 'deck', 'opponent')),
  share_data jsonb NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shares_created_at ON shares(created_at);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shares"
  ON shares FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create own shares"
  ON shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);
