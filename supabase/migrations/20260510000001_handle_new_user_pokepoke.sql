-- handle_new_user(): major デッキ自動作成を pokepoke にも拡張
-- 20260419000002 の実装を踏襲し game_title フィルタのみ拡張
-- SECURITY DEFINER / SET search_path = '' / public. プレフィックス を完全維持
-- 前提:
--   - opponent_deck_settings に pokepoke/RANKED, pokepoke/RANDOM が pre-seed 済
--     (20260419000001:34) → decks INSERT 時の EXISTS 深層防御 (20260426050848) を通過
--   - opponent_deck_master の pokepoke major active 行は LimitLess sync で動的投入
--     (migration 上は 0 件) → 検証は手動 INSERT 1 行で行う
-- 注意: handle_new_user は signup trigger でアプリ上の選択ゲームを知らないため、
--       新規 non-anonymous ユーザー全員に dm + pokepoke の major デッキが両方作られる

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.is_anonymous
  );

  IF NOT NEW.is_anonymous THEN
    INSERT INTO public.decks (user_id, name, format, game_title, sort_order)
    SELECT NEW.id, odm.name, odm.format, odm.game_title, odm.sort_order
    FROM public.opponent_deck_master odm
    WHERE odm.category = 'major'
      AND odm.is_active = true
      AND odm.game_title IN ('dm', 'pokepoke')
    ORDER BY odm.game_title, odm.format, odm.sort_order;
  END IF;

  RETURN NEW;
END;
$$;

-- Phase A (20260509000004) で REVOKE 済の権限状態を migration に明文化
-- CREATE OR REPLACE は通常権限を維持するが、SECURITY DEFINER 関数なので暗黙挙動に依存しない
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
