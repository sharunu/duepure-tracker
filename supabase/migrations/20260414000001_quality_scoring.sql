-- ============================================================
-- 品質スコアリングシステム
-- ============================================================

-- 1. スコアリングルール定義
CREATE TABLE quality_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  score integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ユーザー別スコアスナップショット
CREATE TABLE quality_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_score integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. 管理者ボーナス
CREATE TABLE quality_admin_bonus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  score integer NOT NULL DEFAULT 0,
  memo text,
  granted_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. グローバル設定
CREATE TABLE quality_scoring_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE quality_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_score_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_admin_bonus ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_scoring_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_manage_quality_rules ON quality_scoring_rules
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY admin_manage_quality_snapshots ON quality_score_snapshots
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ユーザーは自分のスコアのみ閲覧可能
CREATE POLICY user_read_own_quality_snapshot ON quality_score_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY admin_manage_quality_bonus ON quality_admin_bonus
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY admin_manage_quality_settings ON quality_scoring_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- ============================================================
-- 初期ルールデータ
-- ============================================================
INSERT INTO quality_scoring_rules (rule_key, display_name, description, category, params, score) VALUES
('x_linked',            'X連携済み',            'Xアカウントが連携されている',                     'account_trust',   '{}', 5),
('discord_linked',      'Discord連携済み',      'Discordアカウントが連携されている',                'account_trust',   '{}', 5),
('throwaway_suspect',   '捨てアカウント疑い',   'アカウント作成から指定日数以内',                   'account_trust',   '{"max_days": 7}', -10),
('long_term_user',      '長期利用ユーザー',     'アカウント作成から指定日数以上経過',               'account_trust',   '{"min_days": 90}', 5),
('recent_battles',      '直近の活動量',         '直近の指定期間内に一定数以上の対戦',               'activity',        '{"period_days": 30, "min_battles": 50}', 10),
('opponent_diversity',  '対面デッキ多様性',     '直近N戦で一定種類以上の対面デッキ',               'data_quality',    '{"last_n_battles": 100, "min_distinct": 5}', 5),
('normal_winrate',      '適正な勝率',           '一定戦数以上かつ勝率が正常範囲内',               'behavior_plus',   '{"min_battles": 50, "min_rate": 20, "max_rate": 80}', 15),
('normal_input_pace',   '適正な入力ペース',     '直近の指定時間内に適切な数の対戦入力',           'behavior_plus',   '{"window_hours": 24, "min_battles": 3, "max_battles": 30}', 10),
('unresolved_alerts',   '未解決アラートあり',   '未解決のdetection_alertsが存在する',              'behavior_minus',  '{}', -20),
('extreme_winrate_q',   '極端な勝率',           '一定戦数以上で勝率が異常範囲',                   'behavior_minus',  '{"min_battles": 50, "high_rate": 95, "low_rate": 5}', -15),
('repetitive_pattern_q','反復パターン',         '同一対面+同一結果が連続',                         'behavior_minus',  '{"max_consecutive": 10}', -10),
('excessive_input',     '過度な入力',           '短時間に大量の対戦入力',                           'behavior_minus',  '{"window_hours": 1, "max_battles": 15}', -10);

-- 初期設定（閾値）
INSERT INTO quality_scoring_settings (key, value) VALUES
('threshold', '40');

-- ============================================================
-- DB関数: 単一ユーザーのスコア計算
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_quality_score(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  rule record;
  v_score integer := 0;
  v_breakdown jsonb := '{}';
  v_profile record;
  v_matches boolean;
  v_battle_count bigint;
  v_win_count bigint;
  v_admin_bonus integer;
  v_rate numeric;
BEGIN
  -- プロフィール取得（ゲストは対象外）
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id AND is_guest = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('total_score', 0, 'breakdown', '{}', 'eligible', false);
  END IF;

  -- 有効なルールをループ
  FOR rule IN SELECT * FROM quality_scoring_rules WHERE is_enabled = true LOOP
    v_matches := false;

    CASE rule.rule_key

      WHEN 'x_linked' THEN
        v_matches := v_profile.x_user_id IS NOT NULL;

      WHEN 'discord_linked' THEN
        SELECT EXISTS (SELECT 1 FROM discord_connections WHERE user_id = p_user_id) INTO v_matches;

      WHEN 'throwaway_suspect' THEN
        v_matches := v_profile.created_at > now() - ((rule.params->>'max_days')::integer || ' days')::interval;

      WHEN 'long_term_user' THEN
        v_matches := v_profile.created_at <= now() - ((rule.params->>'min_days')::integer || ' days')::interval;

      WHEN 'recent_battles' THEN
        SELECT COUNT(*) INTO v_battle_count
        FROM battles
        WHERE user_id = p_user_id
          AND fought_at >= now() - ((rule.params->>'period_days')::integer || ' days')::interval;
        v_matches := v_battle_count >= (rule.params->>'min_battles')::integer;

      WHEN 'opponent_diversity' THEN
        WITH last_n AS (
          SELECT opponent_deck_name
          FROM battles
          WHERE user_id = p_user_id
          ORDER BY fought_at DESC
          LIMIT (rule.params->>'last_n_battles')::integer
        )
        SELECT COUNT(DISTINCT opponent_deck_name) INTO v_battle_count FROM last_n;
        v_matches := v_battle_count >= (rule.params->>'min_distinct')::integer;

      WHEN 'normal_winrate' THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE result = 'win')
        INTO v_battle_count, v_win_count
        FROM battles WHERE user_id = p_user_id;
        IF v_battle_count >= (rule.params->>'min_battles')::integer THEN
          v_rate := v_win_count * 100.0 / v_battle_count;
          v_matches := v_rate >= (rule.params->>'min_rate')::numeric
                   AND v_rate <= (rule.params->>'max_rate')::numeric;
        END IF;

      WHEN 'normal_input_pace' THEN
        SELECT COUNT(*) INTO v_battle_count
        FROM battles
        WHERE user_id = p_user_id
          AND fought_at >= now() - ((rule.params->>'window_hours')::integer || ' hours')::interval;
        v_matches := v_battle_count >= (rule.params->>'min_battles')::integer
                 AND v_battle_count <= (rule.params->>'max_battles')::integer;

      WHEN 'unresolved_alerts' THEN
        SELECT EXISTS (
          SELECT 1 FROM detection_alerts
          WHERE user_id = p_user_id AND is_resolved = false
        ) INTO v_matches;

      WHEN 'extreme_winrate_q' THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE result = 'win')
        INTO v_battle_count, v_win_count
        FROM battles WHERE user_id = p_user_id;
        IF v_battle_count >= (rule.params->>'min_battles')::integer THEN
          v_rate := v_win_count * 100.0 / v_battle_count;
          v_matches := v_rate > (rule.params->>'high_rate')::numeric
                    OR v_rate < (rule.params->>'low_rate')::numeric;
        END IF;

      WHEN 'repetitive_pattern_q' THEN
        WITH numbered AS (
          SELECT
            opponent_deck_name, result, fought_at,
            ROW_NUMBER() OVER (ORDER BY fought_at) -
            ROW_NUMBER() OVER (PARTITION BY opponent_deck_name, result ORDER BY fought_at) AS grp
          FROM battles WHERE user_id = p_user_id
        ),
        streaks AS (
          SELECT COUNT(*) AS streak_len
          FROM numbered
          GROUP BY opponent_deck_name, result, grp
          HAVING COUNT(*) >= (rule.params->>'max_consecutive')::integer
        )
        SELECT EXISTS (SELECT 1 FROM streaks) INTO v_matches;

      WHEN 'excessive_input' THEN
        SELECT COUNT(*) INTO v_battle_count
        FROM battles
        WHERE user_id = p_user_id
          AND fought_at >= now() - ((rule.params->>'window_hours')::integer || ' hours')::interval;
        v_matches := v_battle_count >= (rule.params->>'max_battles')::integer;

      ELSE
        v_matches := false;

    END CASE;

    IF v_matches THEN
      v_score := v_score + rule.score;
      v_breakdown := v_breakdown || jsonb_build_object(rule.rule_key, rule.score);
    END IF;
  END LOOP;

  -- 管理者ボーナス加算
  SELECT score INTO v_admin_bonus FROM quality_admin_bonus WHERE user_id = p_user_id;
  IF v_admin_bonus IS NOT NULL THEN
    v_score := v_score + v_admin_bonus;
    v_breakdown := v_breakdown || jsonb_build_object('admin_bonus', v_admin_bonus);
  END IF;

  RETURN jsonb_build_object('total_score', v_score, 'breakdown', v_breakdown, 'eligible', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- DB関数: 全ユーザー一括スコア計算 + ステージ自動遷移
-- ============================================================
CREATE OR REPLACE FUNCTION run_quality_scoring(p_auto_update boolean DEFAULT true)
RETURNS jsonb AS $$
DECLARE
  v_user record;
  v_result jsonb;
  v_total integer;
  v_threshold integer;
  v_promoted integer := 0;
  v_demoted integer := 0;
  v_calculated integer := 0;
BEGIN
  -- 閾値取得
  SELECT (value#>>'{}')::integer INTO v_threshold
  FROM quality_scoring_settings WHERE key = 'threshold';
  IF v_threshold IS NULL THEN v_threshold := 40; END IF;

  FOR v_user IN
    SELECT id, stage FROM profiles WHERE is_guest = false
  LOOP
    v_result := calculate_quality_score(v_user.id);

    IF (v_result->>'eligible')::boolean THEN
      v_total := (v_result->>'total_score')::integer;

      -- スナップショットをupsert
      INSERT INTO quality_score_snapshots (user_id, total_score, breakdown, calculated_at)
      VALUES (v_user.id, v_total, v_result->'breakdown', now())
      ON CONFLICT (user_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        breakdown = EXCLUDED.breakdown,
        calculated_at = EXCLUDED.calculated_at;

      v_calculated := v_calculated + 1;

      -- ステージ自動遷移
      IF p_auto_update THEN
        IF v_total >= v_threshold AND v_user.stage = 2 THEN
          -- 昇格: 一般 → 優良
          UPDATE profiles SET stage = 1 WHERE id = v_user.id;
          INSERT INTO user_stage_history (user_id, from_stage, to_stage, reason, changed_by)
          VALUES (v_user.id, 2, 1, '品質スコア自動昇格 (score=' || v_total || ', threshold=' || v_threshold || ')', v_user.id);
          v_promoted := v_promoted + 1;
        ELSIF v_total < v_threshold AND v_user.stage = 1 THEN
          -- 降格: 優良 → 一般
          UPDATE profiles SET stage = 2 WHERE id = v_user.id;
          INSERT INTO user_stage_history (user_id, from_stage, to_stage, reason, changed_by)
          VALUES (v_user.id, 1, 2, '品質スコア自動降格 (score=' || v_total || ', threshold=' || v_threshold || ')', v_user.id);
          v_demoted := v_demoted + 1;
        END IF;
        -- stage 3, 4 は対象外
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'calculated', v_calculated,
    'promoted', v_promoted,
    'demoted', v_demoted,
    'threshold', v_threshold
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
