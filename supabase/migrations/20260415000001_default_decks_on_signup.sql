-- Auto-register major decks for new users on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Create profile (existing behavior)
  INSERT INTO public.profiles (id, display_name, is_guest)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.is_anonymous
  );

  -- Auto-register major decks for new non-guest users
  IF NOT NEW.is_anonymous THEN
    INSERT INTO public.decks (user_id, name, format, sort_order)
    SELECT NEW.id, odm.name, odm.format, odm.sort_order
    FROM public.opponent_deck_master odm
    WHERE odm.category = 'major' AND odm.is_active = true
    ORDER BY odm.format, odm.sort_order;
  END IF;

  RETURN NEW;
END;
$$;
