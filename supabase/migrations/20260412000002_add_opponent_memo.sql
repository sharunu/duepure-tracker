-- Add opponent_memo column for recording opponent deck list notes
ALTER TABLE battles ADD COLUMN IF NOT EXISTS opponent_memo text;
