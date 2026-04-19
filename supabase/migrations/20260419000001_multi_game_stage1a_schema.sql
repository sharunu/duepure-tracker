-- Stage 1a: 列追加・新UNIQUE・format CHECK撤廃・インデックス・opponent_deck_settings seed
-- Stage 1 の一部。旧UNIQUE は維持し、Stage 2 で削除。

-- A. ゲーム軸カラム追加
ALTER TABLE decks                  ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE battles                ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE deck_tunings           ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE opponent_deck_master   ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE opponent_deck_settings ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE shares                 ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE teams                  ADD COLUMN game_title text NOT NULL DEFAULT 'dm';
ALTER TABLE discord_connections    ADD COLUMN game_title text NOT NULL DEFAULT 'dm';

-- detection_alerts はバックフィル → NOT NULL
ALTER TABLE detection_alerts ADD COLUMN game_title text;
UPDATE detection_alerts SET game_title = 'dm' WHERE game_title IS NULL;
ALTER TABLE detection_alerts ALTER COLUMN game_title SET NOT NULL;
ALTER TABLE detection_alerts ALTER COLUMN game_title SET DEFAULT 'dm';

-- B. 新 UNIQUE を追加（旧は Stage 2 で削除）
ALTER TABLE discord_connections  ADD CONSTRAINT discord_connections_user_game_unique    UNIQUE (user_id, game_title);
ALTER TABLE discord_connections  ADD CONSTRAINT discord_connections_discord_game_unique UNIQUE (discord_id, game_title);
ALTER TABLE teams                ADD CONSTRAINT teams_guild_game_unique                 UNIQUE (discord_guild_id, game_title);
ALTER TABLE opponent_deck_master ADD CONSTRAINT opponent_deck_master_name_format_game_unique UNIQUE (name, format, game_title);
ALTER TABLE opponent_deck_settings ADD CONSTRAINT opponent_deck_settings_format_game_unique   UNIQUE (format, game_title);

-- C. format CHECK 4テーブル全撤廃（ポケポケの RANKED/RANDOM 受入のため）
ALTER TABLE decks                  DROP CONSTRAINT IF EXISTS decks_format_check;
ALTER TABLE battles                DROP CONSTRAINT IF EXISTS battles_format_check;
ALTER TABLE opponent_deck_master   DROP CONSTRAINT IF EXISTS opponent_deck_master_format_check;
ALTER TABLE opponent_deck_settings DROP CONSTRAINT IF EXISTS opponent_deck_settings_format_check;

-- D. opponent_deck_settings にポケポケ行追加（RPC が JOIN するため必須）
INSERT INTO opponent_deck_settings (format, game_title) VALUES
  ('RANKED', 'pokepoke'), ('RANDOM', 'pokepoke')
ON CONFLICT (format, game_title) DO NOTHING;

-- E. インデックス
CREATE INDEX IF NOT EXISTS decks_user_game_idx    ON decks (user_id, game_title);
CREATE INDEX IF NOT EXISTS battles_user_game_idx  ON battles (user_id, game_title, fought_at DESC);
CREATE INDEX IF NOT EXISTS teams_guild_game_idx   ON teams (discord_guild_id, game_title);
CREATE INDEX IF NOT EXISTS alerts_game_idx        ON detection_alerts (game_title, created_at DESC);
