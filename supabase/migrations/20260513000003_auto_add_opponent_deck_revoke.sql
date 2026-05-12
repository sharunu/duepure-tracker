-- PR6 Phase 6c (Phase 2 hardening): auto_add_opponent_deck() の body 簡素化 + authenticated REVOKE
--
-- Phase 6a で trigger を追加し、Phase 6b で client 側の rpc 呼び出しを削除した。
-- 本 Phase は trigger 経由のみで呼ばれる前提に倒すため authenticated EXECUTE を REVOKE する。
-- 同時に旧 client 経路前提の auth.uid() 系チェックを body から削除する
-- (battles INSERT の RLS WITH CHECK で既に認証 + 所有者 + format/game 整合が保証されている)。

-- 1. auto_add_opponent_deck 本体: trigger context 前提で簡素化
CREATE OR REPLACE FUNCTION public.auto_add_opponent_deck(
  p_deck_name text,
  p_format text,
  p_game_title text DEFAULT 'dm'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
  v_mode text;
  v_max_sort integer;
BEGIN
  IF p_deck_name IS NULL OR length(trim(p_deck_name)) = 0 OR length(p_deck_name) > 80 THEN
    RETURN; -- 不正名はサイレントに skip (battle INSERT は通っているため例外で巻き戻したくない)
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.opponent_deck_settings s
    WHERE s.format = p_format AND s.game_title = p_game_title
  ) THEN
    RETURN; -- format/game 不整合もサイレント skip (RLS WITH CHECK で battle 側が既に保証)
  END IF;

  SELECT management_mode INTO v_mode
  FROM public.opponent_deck_settings
  WHERE format = p_format AND game_title = p_game_title;

  UPDATE public.opponent_deck_master
  SET last_used_at = now(),
      is_active = CASE WHEN v_mode = 'auto' THEN true ELSE is_active END
  WHERE name = p_deck_name
    AND format = p_format
    AND game_title = p_game_title;
  IF FOUND THEN RETURN; END IF;

  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort
  FROM public.opponent_deck_master
  WHERE format = p_format AND game_title = p_game_title;

  IF v_mode = 'auto' THEN
    INSERT INTO public.opponent_deck_master (name, format, game_title, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, p_game_title, 'other', true, v_max_sort + 10, now());
  ELSE
    INSERT INTO public.opponent_deck_master (name, format, game_title, category, is_active, sort_order, last_used_at)
    VALUES (p_deck_name, p_format, p_game_title, 'other', false, v_max_sort + 10, now());
  END IF;
END;
$func$;

-- 2. authenticated からの直 EXECUTE を REVOKE (trigger のみが呼べる)
REVOKE EXECUTE ON FUNCTION public.auto_add_opponent_deck(text, text, text) FROM authenticated;
-- service_role 経由 (admin tooling 等) は将来必要になった時に明示 GRANT。今回は付与なし。
