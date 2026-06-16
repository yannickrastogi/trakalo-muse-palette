# SQL migration — Track ratings (1–5 étoiles par membre)

> **À copier-coller dans Supabase SQL Editor (jamais auto-exécuté côté Claude).**
> Bloc unique, idempotent. Les `DROP FUNCTION` sont obligatoires (signatures peuvent changer).

```sql
-- ─── Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.track_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (track_id, workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_track_ratings_workspace ON public.track_ratings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_track_ratings_track ON public.track_ratings(track_id);

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE public.track_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read ratings in their workspaces" ON public.track_ratings;
CREATE POLICY "members read ratings in their workspaces"
  ON public.track_ratings FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
    )
  );

-- WRITE paths go exclusively via the SECURITY DEFINER RPCs below
-- (no INSERT/UPDATE/DELETE policy = denied by RLS for clients).

-- ─── Upsert RPC ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.upsert_track_rating(uuid, uuid, uuid, integer);

CREATE OR REPLACE FUNCTION public.upsert_track_rating(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid,
  _rating integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
BEGIN
  IF _rating < 1 OR _rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  IF NOT public.has_workspace_access_level(_user_id, _workspace_id, 'viewer') THEN
    RAISE EXCEPTION 'Not a workspace member' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tracks WHERE id = _track_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'Track not in workspace' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.track_ratings (track_id, workspace_id, user_id, rating, updated_at)
  VALUES (_track_id, _workspace_id, _user_id, _rating, now())
  ON CONFLICT (track_id, workspace_id, user_id)
  DO UPDATE SET rating = EXCLUDED.rating, updated_at = now();
END;
$func$;

GRANT EXECUTE ON FUNCTION public.upsert_track_rating(uuid, uuid, uuid, integer) TO authenticated;

-- ─── Get stats RPC (optional convenience for TrackDetail single-track refresh) ──
DROP FUNCTION IF EXISTS public.get_track_rating_stats(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_track_rating_stats(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $func$
DECLARE
  _avg numeric;
  _count integer;
  _my_rating integer;
BEGIN
  IF NOT public.has_workspace_access_level(_user_id, _workspace_id, 'viewer') THEN
    RAISE EXCEPTION 'Not a workspace member' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*)
  INTO _avg, _count
  FROM public.track_ratings
  WHERE track_id = _track_id AND workspace_id = _workspace_id;

  SELECT rating INTO _my_rating
  FROM public.track_ratings
  WHERE track_id = _track_id AND workspace_id = _workspace_id AND user_id = _user_id;

  RETURN json_build_object(
    'average', COALESCE(_avg, 0),
    'count', COALESCE(_count, 0),
    'my_rating', _my_rating
  );
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_track_rating_stats(uuid, uuid, uuid) TO authenticated;
```

## Smoke test

```sql
SELECT public.upsert_track_rating(
  '<user_uuid>'::uuid,
  '<track_uuid>'::uuid,
  '<workspace_uuid>'::uuid,
  4
);

SELECT public.get_track_rating_stats(
  '<user_uuid>'::uuid,
  '<track_uuid>'::uuid,
  '<workspace_uuid>'::uuid
);
-- → { "average": 4.0, "count": 1, "my_rating": 4 }

-- Vérifie aussi un SELECT direct (RLS doit autoriser les membres du workspace)
SELECT track_id, rating FROM public.track_ratings WHERE workspace_id = '<workspace_uuid>'::uuid;
```

## Rollback

```sql
DROP FUNCTION IF EXISTS public.upsert_track_rating(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_track_rating_stats(uuid, uuid, uuid);
DROP TABLE IF EXISTS public.track_ratings;
```
