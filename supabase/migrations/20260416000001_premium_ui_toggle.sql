-- ============================================================
-- 優良ユーザーUI表示トグル設定
-- ============================================================

-- 設定追加
INSERT INTO quality_scoring_settings (key, value) VALUES
('premium_ui_visible', 'true')
ON CONFLICT (key) DO NOTHING;

-- 一般ユーザーがpremium_ui_visible設定を読み取れるようにする
CREATE POLICY user_read_premium_ui_setting ON quality_scoring_settings
  FOR SELECT USING (key = 'premium_ui_visible');
