-- Stage 2: 旧UNIQUE制約を削除（main へ新コードが反映され、本番動作確認後に適用）
-- 新コード（onConflict: "user_id,game_title" / sync_team_membership ON CONFLICT
-- (discord_guild_id, game_title)) が main で稼働していることを確認してから適用すること。

ALTER TABLE discord_connections    DROP CONSTRAINT IF EXISTS discord_connections_user_id_key;
ALTER TABLE discord_connections    DROP CONSTRAINT IF EXISTS discord_connections_discord_id_key;
ALTER TABLE teams                  DROP CONSTRAINT IF EXISTS teams_discord_guild_id_key;
ALTER TABLE opponent_deck_master   DROP CONSTRAINT IF EXISTS opponent_deck_master_name_format_key;
ALTER TABLE opponent_deck_settings DROP CONSTRAINT IF EXISTS opponent_deck_settings_format_key;
