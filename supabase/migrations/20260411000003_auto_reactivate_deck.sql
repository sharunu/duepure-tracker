-- autoモードで無効デッキが再使用された場合に自動再有効化するよう修正
CREATE OR REPLACE FUNCTION auto_add_opponent_deck(
  p_deck_name text, p_format text
)
RETURNS void AS $$
DECLARE
  v_mode text;
  v_max_sort integer;
BEGIN
  -- 管理モード取得（既存デッキ判定の前に移動）
  SELECT management_mode INTO v_mode
  FROM opponent_deck_settings WHERE format = p_format;

  -- 既存デッキ更新: autoモードなら is_active も true に
  UPDATE opponent_deck_master
  SET last_used_at = now(),
      is_active = CASE WHEN v_mode = 'auto' THEN true ELSE is_active END
  WHERE name = p_deck_name AND format = p_format;

  IF FOUND THEN RETURN; END IF;

  -- 存在しない場合: 新規追加
  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM opponent_deck_master WHERE format = p_format;

  IF v_mode = 'auto' THEN
    INSERT INTO opponent_deck_master (name, format, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, 'other', true, v_max_sort + 10, now());
  ELSE
    INSERT INTO opponent_deck_master (name, format, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, 'other', false, v_max_sort + 10, now());
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
