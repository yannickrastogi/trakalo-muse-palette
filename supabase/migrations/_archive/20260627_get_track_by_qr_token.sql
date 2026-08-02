-- ─────────────────────────────────────────────────────────────────────
-- get_track_by_qr_token — lecture anon minimale d'un track via son QR token
-- ─────────────────────────────────────────────────────────────────────
-- Contexte :
--   StudioSession.tsx (page publique QR studio) lisait directement
--   public.tracks via un client anon :
--       anon.from("tracks").select(...).eq("qr_token", token)
--   Cela nécessitait une policy anon SELECT permissive sur `tracks`
--   exposant *toutes* les colonnes (splits, lyrics, audio urls, etc.).
--
-- Fix :
--   RPC SECURITY DEFINER qui ne retourne QUE les 5 champs nécessaires à
--   l'écran d'accueil studio, scopée au token. L'unguessability du
--   qr_token reste la barrière d'accès (cohérent avec le reste du flux QR).
--   La RPC permet ensuite de retirer la policy anon SELECT large sur tracks
--   (voir CLAUDE_QR_POLICY_DROP.md).
--
-- À COPIER dans Supabase SQL Editor (ne pas auto-exécuter).
-- ─────────────────────────────────────────────────────────────────────

-- DROP explicite d'abord (signature peut différer d'une version précédente)
DROP FUNCTION IF EXISTS public.get_track_by_qr_token(text);

CREATE OR REPLACE FUNCTION public.get_track_by_qr_token(_qr_token text)
RETURNS TABLE (
  id           uuid,
  title        text,
  artist       text,
  cover_url    text,
  workspace_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT t.id, t.title, t.artist, t.cover_url, t.workspace_id
  FROM public.tracks t
  WHERE _qr_token IS NOT NULL
    AND _qr_token <> ''
    AND t.qr_token = _qr_token
  LIMIT 1;
$func$;

-- L'anon (page publique) et l'authenticated (cas "Sign In") peuvent exécuter.
REVOKE ALL ON FUNCTION public.get_track_by_qr_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_track_by_qr_token(text) TO anon, authenticated;
