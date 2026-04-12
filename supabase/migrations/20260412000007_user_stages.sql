-- ステージカラム追加
ALTER TABLE profiles ADD COLUMN stage integer NOT NULL DEFAULT 2;
ALTER TABLE profiles ADD CONSTRAINT profiles_stage_check CHECK (stage BETWEEN 1 AND 4);

-- ステージ変更履歴
CREATE TABLE user_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_stage integer NOT NULL,
  to_stage integer NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 検知ルール
CREATE TABLE detection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  params jsonb NOT NULL DEFAULT '{}',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 検知アラート
CREATE TABLE detection_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  details jsonb,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE detection_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_manage_stage_history ON user_stage_history
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY admin_manage_detection_rules ON detection_rules
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY admin_manage_detection_alerts ON detection_alerts
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 初期検知ルール
INSERT INTO detection_rules (rule_key, display_name, description, params) VALUES
(
  'extreme_winrate',
  '極端な勝率',
  '一定期間の勝率が閾値を超えた場合に検知',
  '{"period_days": 30, "min_battles": 20, "max_winrate": 0.95, "min_winrate": 0.05}'
),
(
  'rapid_input',
  '短時間大量入力',
  '短時間に大量の戦績が記録された場合に検知',
  '{"window_hours": 1, "max_battles": 15}'
),
(
  'repetitive_pattern',
  '同一結果の連続',
  '同一対面に同一結果が連続で記録された場合に検知',
  '{"max_consecutive": 10}'
);
