-- ============================================
-- profiles
-- ============================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  is_guest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- decks
-- ============================================
CREATE TABLE decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_decks_user_id ON decks(user_id);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own decks"
  ON decks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- battles
-- ============================================
CREATE TABLE battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  my_deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  opponent_deck_name text NOT NULL,
  opponent_deck_normalized text,
  result text NOT NULL CHECK (result IN ('win', 'loss')),
  turn_order text CHECK (turn_order IN ('first', 'second')),
  fought_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_battles_user_id ON battles(user_id);
CREATE INDEX idx_battles_fought_at ON battles(fought_at DESC);
CREATE INDEX idx_battles_my_deck_id ON battles(my_deck_id);

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own battles"
  ON battles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- deck_name_candidates (normalization)
-- ============================================
CREATE TABLE deck_name_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_name text NOT NULL,
  compare_to text NOT NULL,
  status text NOT NULL DEFAULT 'voting' CHECK (status IN ('voting', 'merged', 'rejected')),
  same_count integer NOT NULL DEFAULT 0,
  diff_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(raw_name, compare_to)
);

ALTER TABLE deck_name_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated non-guest can view candidates"
  ON deck_name_candidates FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_guest = false
    )
  );

-- ============================================
-- normalization_votes
-- ============================================
CREATE TABLE normalization_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES deck_name_candidates(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('same', 'different')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, candidate_id)
);

ALTER TABLE normalization_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own votes"
  ON normalization_votes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Non-guest users can insert votes"
  ON normalization_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_guest = false
    )
  );

-- ============================================
-- normalization_results (cache)
-- ============================================
CREATE TABLE normalization_results (
  raw_name text PRIMARY KEY,
  canonical_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE normalization_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read normalization results"
  ON normalization_results FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================
-- DB Functions
-- ============================================

-- 1. Environment deck shares (public via security definer)
CREATE OR REPLACE FUNCTION get_environment_deck_shares(
  p_days integer DEFAULT 7
)
RETURNS TABLE(deck_name text, battle_count bigint, share_pct numeric)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_total bigint;
  v_threshold numeric := 3.0;
BEGIN
  -- Count only non-guest battles
  SELECT COUNT(*) INTO v_total
  FROM public.battles b
  JOIN public.profiles p ON p.id = b.user_id
  WHERE p.is_guest = false
    AND b.fought_at >= now() - (p_days || ' days')::interval;

  IF v_total = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH deck_counts AS (
    SELECT
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS dn,
      COUNT(*) AS cnt
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.is_guest = false
      AND b.fought_at >= now() - (p_days || ' days')::interval
    GROUP BY dn
  ),
  with_pct AS (
    SELECT dn, cnt, ROUND(cnt * 100.0 / v_total, 1) AS pct
    FROM deck_counts
  )
  SELECT
    CASE WHEN pct >= v_threshold THEN dn ELSE 'その他' END AS deck_name,
    SUM(cnt)::bigint AS battle_count,
    ROUND(SUM(pct), 1) AS share_pct
  FROM with_pct
  GROUP BY CASE WHEN pct >= v_threshold THEN dn ELSE 'その他' END
  ORDER BY share_pct DESC;
END;
$$;

-- 2. Opponent deck suggestions (top decks by usage)
CREATE OR REPLACE FUNCTION get_opponent_deck_suggestions()
RETURNS TABLE(deck_name text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH deck_counts AS (
    SELECT
      COALESCE(b.opponent_deck_normalized, b.opponent_deck_name) AS dn,
      COUNT(*) AS cnt
    FROM public.battles b
    JOIN public.profiles p ON p.id = b.user_id
    WHERE p.is_guest = false
      AND b.fought_at >= now() - interval '14 days'
    GROUP BY dn
  ),
  total AS (
    SELECT SUM(cnt) AS total_cnt FROM deck_counts
  )
  SELECT dc.dn AS deck_name
  FROM deck_counts dc, total t
  WHERE dc.cnt * 100.0 / NULLIF(t.total_cnt, 0) >= 3.0
  ORDER BY dc.cnt DESC;
END;
$$;

-- 3. Submit normalization vote + threshold check
CREATE OR REPLACE FUNCTION submit_normalization_vote(
  p_candidate_id uuid,
  p_vote text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_candidate record;
  v_total integer;
  v_same_pct numeric;
BEGIN
  -- Check non-guest
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND is_guest = false) THEN
    RAISE EXCEPTION 'Guest users cannot vote';
  END IF;

  -- Insert vote
  INSERT INTO public.normalization_votes (user_id, candidate_id, vote)
  VALUES (v_user_id, p_candidate_id, p_vote)
  ON CONFLICT (user_id, candidate_id) DO NOTHING;

  -- Update counts
  UPDATE public.deck_name_candidates
  SET
    same_count = (SELECT COUNT(*) FROM public.normalization_votes WHERE candidate_id = p_candidate_id AND vote = 'same'),
    diff_count = (SELECT COUNT(*) FROM public.normalization_votes WHERE candidate_id = p_candidate_id AND vote = 'different')
  WHERE id = p_candidate_id
  RETURNING * INTO v_candidate;

  v_total := v_candidate.same_count + v_candidate.diff_count;

  -- Threshold: 75% agreement with at least 5 votes
  IF v_total >= 5 THEN
    v_same_pct := v_candidate.same_count * 100.0 / v_total;

    IF v_same_pct >= 75 THEN
      -- Merge: mark as merged and create normalization result
      UPDATE public.deck_name_candidates SET status = 'merged' WHERE id = p_candidate_id;

      INSERT INTO public.normalization_results (raw_name, canonical_name)
      VALUES (v_candidate.raw_name, v_candidate.compare_to)
      ON CONFLICT (raw_name) DO UPDATE SET canonical_name = EXCLUDED.canonical_name;

      -- Backfill battles
      UPDATE public.battles
      SET opponent_deck_normalized = v_candidate.compare_to
      WHERE opponent_deck_name = v_candidate.raw_name
        AND opponent_deck_normalized IS NULL;

      RETURN jsonb_build_object('status', 'merged', 'canonical', v_candidate.compare_to);
    ELSIF (100 - v_same_pct) >= 75 THEN
      -- Reject
      UPDATE public.deck_name_candidates SET status = 'rejected' WHERE id = p_candidate_id;
      RETURN jsonb_build_object('status', 'rejected');
    END IF;
  END IF;

  RETURN jsonb_build_object('status', 'voting', 'same', v_candidate.same_count, 'diff', v_candidate.diff_count);
END;
$$;

-- 4. Get pending vote for user (with 10-battle cooldown)
CREATE OR REPLACE FUNCTION get_pending_vote_for_user()
RETURNS TABLE(
  candidate_id uuid,
  raw_name text,
  compare_to text,
  same_count integer,
  diff_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_battle_count bigint;
  v_last_vote_at timestamptz;
  v_battles_since_vote bigint;
BEGIN
  -- Check non-guest
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND is_guest = false) THEN
    RETURN;
  END IF;

  -- Get last vote time
  SELECT MAX(nv.created_at) INTO v_last_vote_at
  FROM public.normalization_votes nv
  WHERE nv.user_id = v_user_id;

  -- Count battles since last vote (cooldown: 10 battles)
  IF v_last_vote_at IS NOT NULL THEN
    SELECT COUNT(*) INTO v_battles_since_vote
    FROM public.battles b
    WHERE b.user_id = v_user_id AND b.fought_at > v_last_vote_at;

    IF v_battles_since_vote < 10 THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    dnc.id AS candidate_id,
    dnc.raw_name,
    dnc.compare_to,
    dnc.same_count,
    dnc.diff_count
  FROM public.deck_name_candidates dnc
  WHERE dnc.status = 'voting'
    AND NOT EXISTS (
      SELECT 1 FROM public.normalization_votes nv
      WHERE nv.candidate_id = dnc.id AND nv.user_id = v_user_id
    )
  ORDER BY dnc.created_at ASC
  LIMIT 1;
END;
$$;
