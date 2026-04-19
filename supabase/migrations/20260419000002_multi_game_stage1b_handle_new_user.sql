-- Stage 1b: handle_new_user() 更新 — 既存ロジック維持＋ game_title='dm' 限定
-- 既存 20260415000001_default_decks_on_signup.sql の実装を踏襲し、major デッキ
-- 自動作成を デュエプレ (game_title='dm') のみに限定する。
-- display_name / is_guest / is_anonymous 分岐 / sort_order / SECURITY DEFINER /
-- search_path = '' / public. プレフィックス は全て完全保持。

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- 既存: profile 作成（display_name / is_guest を保持）
  INSERT INTO public.profiles (id, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.is_anonymous
  );

  -- 既存: ゲストでなければ major デッキ自動作成（game_title='dm' 限定）
  IF NOT NEW.is_anonymous THEN
    INSERT INTO public.decks (user_id, name, format, game_title, sort_order)
    SELECT NEW.id, odm.name, odm.format, odm.game_title, odm.sort_order
    FROM public.opponent_deck_master odm
    WHERE odm.category = 'major'
      AND odm.is_active = true
      AND odm.game_title = 'dm'
    ORDER BY odm.format, odm.sort_order;
  END IF;

  RETURN NEW;
END;
$$;
