# 🔐 SECURITY — `assert_caller` sur RPCs critiques + neutralisation des `legacy_v0`

> **⚠️ NE PAS auto-exécuter.** Ce fichier est en `.md` exprès (pas `.sql`) pour ne PAS être pické par `supabase db push`.
> **À exécuter manuellement** dans **Supabase SQL Editor** (un seul copier-coller du bloc « PARTIE A→C »).
> Généré par Claude Code à partir des définitions **live** (`pg_get_functiondef`), pas des migrations (la plupart des RPCs n'y sont pas).

---

## 🧠 Ce que fait ce fichier (et pourquoi il dévie du brief)

### 1. `assert_caller(_user_id)` sur les 15 RPCs critiques — ✅ comme demandé

Les RPCs critiques vérifient déjà les permissions **mais contre `_user_id`** (ex. `require_workspace_access_level(_user_id, …)`, `is_platform_admin(_user_id)`, `owner_id = _user_id`). Aucune ne vérifie que **`_user_id = auth.uid()`**.

**→ Faille :** un utilisateur authentifié peut passer l'UUID d'un **admin/owner** dans `_user_id` et passer tous les contrôles (usurpation d'identité). `assert_caller` (1ʳᵉ ligne) ferme ça.

### 2. `legacy_v0` — 🔁 **REVOKE au lieu de DROP** (déviation assumée — « ne rien casser »)

Le brief demandait de **DROP toutes les `*_legacy_v0`**. **Diagnostic live : c'est impossible sans tout casser.**

| Fait vérifié en DB | Conséquence |
|---|---|
| **27 des 30** `legacy_v0` sont **appelées en interne** par leur wrapper (`PERFORM/RETURN public.x_legacy_v0(...)`). Le wrapper ajoute le guard, puis **délègue le vrai travail** au legacy. | Les DROP casseraient `delete_track`, `create_pitch`, `create_shared_link`, `update_contact`, `insert_track_document`, `save_track_to_trakalog`, … (27 write-paths prod). |
| **Toutes** les `legacy_v0` ont `authenticated=X` (EXECUTE direct) **et aucun guard** dans leur corps. | **C'est ça, la vraie faille** : `authenticated` peut appeler `delete_track_legacy_v0(<uuid_admin>, <track_id>)` en direct et **court-circuiter le wrapper**. |
| Le front + edge functions n'appellent **que les wrappers** (`grep _legacy_v0` sur `src/` + `supabase/functions/` = vide). | On peut retirer l'EXECUTE direct sans rien casser côté app. |
| **3 seulement** sont **orphelines** (appelées par aucun wrapper ni l'app) : `insert_stem_legacy_v0`, `remove_workspace_member_legacy_v0`, `update_member_role_legacy_v0`. | Celles-là → **DROP** réel, safe. |

**→ Remédiation correcte :**
- **DROP** les 3 orphelines (code mort).
- **REVOKE EXECUTE … FROM PUBLIC, anon, authenticated** sur les 27 restantes → plus appelables directement par un client, mais le wrapper (SECURITY DEFINER, owner `postgres`) continue de les appeler en interne. **Zéro régression, faille fermée.**

> Si tu veux quand même le DROP littéral des 27 : il faut d'abord inliner chaque corps legacy dans son wrapper. Gros chantier, à part. Le REVOKE obtient le même résultat sécurité immédiatement.

---

## ▶️ PARTIE A → C — bloc unique à exécuter

```sql
-- =====================================================================
-- PARTIE A — DROP des 3 legacy_v0 réellement orphelines (code mort, no guard)
-- =====================================================================
DROP FUNCTION IF EXISTS public.insert_stem_legacy_v0(uuid, uuid, text, text, bigint, text);
DROP FUNCTION IF EXISTS public.remove_workspace_member_legacy_v0(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.update_member_role_legacy_v0(uuid, uuid, uuid, text, text);

-- =====================================================================
-- PARTIE B — REVOKE EXECUTE direct sur TOUTES les legacy_v0 restantes
-- Les wrappers (SECURITY DEFINER, owner postgres) continuent de les appeler.
-- =====================================================================
DO $rev$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE '%\_legacy\_v0' ESCAPE '\'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', r.sig);
  END LOOP;
END;
$rev$;

-- =====================================================================
-- PARTIE C — assert_caller(_user_id) en 1ʳᵉ ligne des 15 RPCs critiques
-- Corps identiques aux définitions live, seule la ligne PERFORM est ajoutée.
-- =====================================================================

-- 1) delete_workspace -------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_workspace(_user_id uuid, _workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not the owner of this workspace';
  END IF;

  IF EXISTS (SELECT 1 FROM workspaces WHERE id = _workspace_id AND is_personal = true) THEN
    RAISE EXCEPTION 'Cannot delete personal workspace';
  END IF;

  DELETE FROM workspace_members WHERE workspace_id = _workspace_id;
  DELETE FROM user_roles WHERE workspace_id = _workspace_id;
  DELETE FROM workspaces WHERE id = _workspace_id;
END;
$function$;

-- 2) delete_track -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_track(_user_id uuid, _track_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_workspace_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);

  SELECT workspace_id INTO v_workspace_id FROM public.tracks WHERE id = _track_id;
  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Track % not found', _track_id;
  END IF;

  PERFORM public.require_workspace_access_level(_user_id, v_workspace_id, 'admin');

  -- Délégation au body original (préservé dans _legacy_v0)
  PERFORM public.delete_track_legacy_v0(_user_id, _track_id);
END;
$function$;

-- 3) update_member_role ----------------------------------------------
CREATE OR REPLACE FUNCTION public.update_member_role(_user_id uuid, _member_user_id uuid, _workspace_id uuid, _access_level text, _professional_title text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');

  -- Validation des nouvelles valeurs autorisées
  IF _access_level IS NOT NULL AND _access_level NOT IN ('viewer', 'pitcher', 'editor', 'admin') THEN
    RAISE EXCEPTION 'Invalid access level: %', _access_level;
  END IF;

  -- Update direct (court-circuite la sync user_roles legacy qui crashe sur
  -- les nouvelles valeurs editor/pitcher inconnues de l'enum app_role).
  IF _access_level IS NOT NULL THEN
    UPDATE public.workspace_members
    SET access_level = _access_level
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  END IF;

  IF _professional_title IS NOT NULL THEN
    UPDATE public.workspace_members
    SET professional_title = NULLIF(btrim(_professional_title), '')
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  END IF;

  -- Note : on n'appelle PAS legacy_v0 ici puisque la sync user_roles est
  -- volontairement skippée. Si la prod legacy a un audit_log, la perte
  -- est acceptable (Phase 3 ré-implémentera l'audit côté workspace_members).
END;
$function$;

-- 4) remove_workspace_member -----------------------------------------
CREATE OR REPLACE FUNCTION public.remove_workspace_member(_user_id uuid, _member_user_id uuid, _workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'admin');

  -- DELETE direct sur workspace_members (skip le legacy qui peut planter
  -- sur user_roles sync).
  DELETE FROM public.workspace_members
  WHERE user_id = _member_user_id AND workspace_id = _workspace_id;

  -- Cleanup de la ligne user_roles résiduelle (si la table existe encore).
  -- Wrappé dans un BEGIN/EXCEPTION pour ne pas casser si user_roles est
  -- déjà droppée (Phase 3).
  BEGIN
    DELETE FROM public.user_roles
    WHERE user_id = _member_user_id AND workspace_id = _workspace_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END;
$function$;

-- 5) add_to_whitelist -------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_to_whitelist(_user_id uuid, _email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO public.whitelisted_emails (email)
  VALUES (lower(_email))
  ON CONFLICT (email) DO NOTHING;
END;
$function$;

-- 6) get_admin_overview ----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_overview(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE _result json;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT json_build_object(
    'waitlist', json_build_object(
      'total', (SELECT COUNT(*) FROM public.waitlist),
      'last_7d', (SELECT COUNT(*) FROM public.waitlist WHERE created_at > now() - interval '7 days'),
      'last_24h', (SELECT COUNT(*) FROM public.waitlist WHERE created_at > now() - interval '24 hours'),
      'invited', (SELECT COUNT(*) FROM public.waitlist WHERE invited_at IS NOT NULL),
      'pending', (SELECT COUNT(*) FROM public.waitlist WHERE invited_at IS NULL)
    ),
    'users', json_build_object('total', (SELECT COUNT(*) FROM auth.users WHERE deleted_at IS NULL)),
    'workspaces', json_build_object('total', (SELECT COUNT(*) FROM public.workspaces)),
    'tracks', json_build_object('total', (SELECT COUNT(*) FROM public.tracks)),
    'contacts', json_build_object('total', (SELECT COUNT(*) FROM public.contacts)),
    'plays', json_build_object(
      'total', (SELECT COUNT(*) FROM public.link_events WHERE event_type = 'play'),
      'last_7d', (SELECT COUNT(*) FROM public.link_events WHERE event_type = 'play' AND created_at > now() - interval '7 days')
    )
  ) INTO _result;
  RETURN _result;
END;
$function$;

-- 7) list_all_users ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_all_users(_user_id uuid, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _search text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE _result json; _total int;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(*) INTO _total
  FROM auth.users u
  WHERE u.deleted_at IS NULL
    AND (_search IS NULL OR _search = ''
         OR lower(coalesce(u.email, '')) LIKE '%' || lower(_search) || '%'
         OR lower(coalesce(u.raw_user_meta_data->>'full_name', '')) LIKE '%' || lower(_search) || '%');

  SELECT json_build_object(
    'total', _total,
    'rows', COALESCE(json_agg(row_to_json(t)), '[]'::json)
  )
  INTO _result
  FROM (
    SELECT
      u.id,
      u.email,
      u.raw_user_meta_data->>'full_name' AS full_name,
      u.raw_user_meta_data->>'avatar_url' AS avatar_url,
      u.created_at,
      u.last_sign_in_at,
      u.email_confirmed_at IS NOT NULL AS email_confirmed,
      (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_banned,
      EXISTS (
        SELECT 1 FROM auth.mfa_factors mf
        WHERE mf.user_id = u.id AND mf.status = 'verified'
      ) AS has_2fa,
      (SELECT COUNT(*) FROM public.workspace_members wm WHERE wm.user_id = u.id) AS workspaces_count,
      (SELECT COUNT(*) FROM public.tracks t WHERE t.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = u.id
      )) AS tracks_in_workspaces,
      (SELECT COUNT(*) FROM public.pitches p WHERE p.workspace_id IN (
        SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = u.id
      )) AS pitches_in_workspaces
    FROM auth.users u
    WHERE u.deleted_at IS NULL
      AND (_search IS NULL OR _search = ''
           OR lower(coalesce(u.email, '')) LIKE '%' || lower(_search) || '%'
           OR lower(coalesce(u.raw_user_meta_data->>'full_name', '')) LIKE '%' || lower(_search) || '%')
    ORDER BY u.created_at DESC
    LIMIT _limit OFFSET _offset
  ) t;

  RETURN _result;
END;
$function$;

-- 8) list_all_contacts ------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_all_contacts(_user_id uuid, _limit integer DEFAULT 50, _offset integer DEFAULT 0, _search text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _result json; _total int;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT public.is_platform_admin(_user_id) THEN
    RAISE EXCEPTION 'Forbidden: not a platform admin' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(*) INTO _total
  FROM public.contacts c
  WHERE _search IS NULL OR _search = ''
     OR lower(coalesce(c.first_name, '')) LIKE '%' || lower(_search) || '%'
     OR lower(coalesce(c.last_name, '')) LIKE '%' || lower(_search) || '%'
     OR lower(coalesce(c.email, '')) LIKE '%' || lower(_search) || '%'
     OR lower(coalesce(c.company, '')) LIKE '%' || lower(_search) || '%';

  SELECT json_build_object(
    'total', _total,
    'rows', COALESCE(json_agg(row_to_json(t)), '[]'::json)
  )
  INTO _result
  FROM (
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.stage_name,
      c.email,
      c.role,
      c.company,
      c.phone,
      c.pro,
      c.ipi,
      c.publisher,
      c.created_at,
      w.name AS workspace_name,
      w.id AS workspace_id
    FROM public.contacts c
    LEFT JOIN public.workspaces w ON w.id = c.workspace_id
    WHERE _search IS NULL OR _search = ''
       OR lower(coalesce(c.first_name, '')) LIKE '%' || lower(_search) || '%'
       OR lower(coalesce(c.last_name, '')) LIKE '%' || lower(_search) || '%'
       OR lower(coalesce(c.email, '')) LIKE '%' || lower(_search) || '%'
       OR lower(coalesce(c.company, '')) LIKE '%' || lower(_search) || '%'
    ORDER BY c.created_at DESC
    LIMIT _limit OFFSET _offset
  ) t;

  RETURN _result;
END;
$function$;

-- 9) insert_track -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_track(_user_id uuid, _workspace_id uuid, _title text, _artist text DEFAULT NULL::text, _featuring text DEFAULT NULL::text, _type text DEFAULT NULL::text, _status text DEFAULT NULL::text, _bpm numeric DEFAULT NULL::numeric, _key text DEFAULT NULL::text, _duration_sec numeric DEFAULT NULL::numeric, _genre text[] DEFAULT NULL::text[], _mood text[] DEFAULT '{}'::text[], _language text DEFAULT NULL::text, _gender text DEFAULT NULL::text, _labels text[] DEFAULT '{}'::text[], _publishers text[] DEFAULT '{}'::text[], _audio_url text DEFAULT NULL::text, _audio_preview_url text DEFAULT NULL::text, _cover_art_url text DEFAULT NULL::text, _lyrics text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _splits jsonb DEFAULT '[]'::jsonb, _isrc text DEFAULT NULL::text, _waveform_data jsonb DEFAULT NULL::jsonb, _released_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_track_id uuid;
BEGIN
  PERFORM public.assert_caller(_user_id);

  -- Phase 2 access_level check
  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  INSERT INTO public.tracks (
    workspace_id, uploaded_by, title, artist, featuring,
    track_type, status, bpm, key, duration_sec,
    genre, mood, language, gender,
    labels, publishers,
    audio_url, audio_preview_url, cover_url,
    lyrics, notes, splits, isrc, waveform_data, released_at
  ) VALUES (
    _workspace_id, _user_id, _title, _artist, _featuring,
    COALESCE(_type::public.track_type, 'song'),
    COALESCE(_status::public.track_status, 'available'),
    _bpm, _key, _duration_sec,
    NULLIF(_genre, '{}'::text[]),
    COALESCE(_mood, '{}'::text[]),
    _language,
    NULLIF(_gender, '')::public.track_gender,
    COALESCE(_labels, '{}'::text[]),
    COALESCE(_publishers, '{}'::text[]),
    _audio_url, _audio_preview_url, _cover_art_url,
    _lyrics, _notes, COALESCE(_splits, '[]'::jsonb), _isrc, _waveform_data, _released_at
  )
  RETURNING id INTO new_track_id;

  RETURN new_track_id;
END;
$function$;

-- 10) delete_contacts -------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_contacts(_user_id uuid, _workspace_id uuid, _ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  DELETE FROM contacts
  WHERE id = ANY(_ids)
    AND workspace_id = _workspace_id;
END;
$function$;

-- 11) set_track_marketplace_public -----------------------------------
CREATE OR REPLACE FUNCTION public.set_track_marketplace_public(_user_id uuid, _track_id uuid, _workspace_id uuid, _public boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM tracks WHERE id = _track_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE tracks SET
    is_marketplace_public = _public,
    marketplace_published_at = CASE WHEN _public THEN now() ELSE NULL END
  WHERE id = _track_id;
END;
$function$;

-- 12) create_pitch ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_pitch(_user_id uuid, _workspace_id uuid, _recipient_name text, _recipient_email text DEFAULT NULL::text, _recipient_company text DEFAULT ''::text, _subject text DEFAULT ''::text, _message text DEFAULT NULL::text, _track_ids uuid[] DEFAULT '{}'::uuid[], _status text DEFAULT 'draft'::text, _sent_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');

  RETURN public.create_pitch_legacy_v0(
    _user_id, _workspace_id, _recipient_name, _recipient_email,
    _recipient_company, _subject, _message, _track_ids,
    _status, _sent_at
  );
END;
$function$;

-- 13) create_shared_link ---------------------------------------------
CREATE OR REPLACE FUNCTION public.create_shared_link(_user_id uuid, _workspace_id uuid, _share_type text, _track_id uuid DEFAULT NULL::uuid, _playlist_id uuid DEFAULT NULL::uuid, _link_name text DEFAULT ''::text, _link_slug text DEFAULT ''::text, _link_type text DEFAULT 'public'::text, _password_hash text DEFAULT NULL::text, _message text DEFAULT NULL::text, _allow_download boolean DEFAULT false, _allow_save boolean DEFAULT true, _download_quality text DEFAULT NULL::text, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _pack_items text DEFAULT NULL::text, _watermarking_enabled boolean DEFAULT true, _gate_screen_enabled boolean DEFAULT true)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  PERFORM public.require_workspace_access_level(_user_id, _workspace_id, 'pitcher');
  RETURN public.create_shared_link_legacy_v0(
    _user_id, _workspace_id, _share_type, _track_id, _playlist_id,
    _link_name, _link_slug, _link_type, _password_hash, _message,
    _allow_download, _allow_save, _download_quality, _expires_at, _pack_items,
    _watermarking_enabled, _gate_screen_enabled
  );
END;
$function$;

-- 14) update_workspace_branding --------------------------------------
CREATE OR REPLACE FUNCTION public.update_workspace_branding(_user_id uuid, _workspace_id uuid, _hero_image_url text DEFAULT NULL::text, _logo_url text DEFAULT NULL::text, _brand_color text DEFAULT NULL::text, _hero_position numeric DEFAULT NULL::numeric, _hero_focal_point text DEFAULT NULL::text, _social_instagram text DEFAULT NULL::text, _social_tiktok text DEFAULT NULL::text, _social_youtube text DEFAULT NULL::text, _social_facebook text DEFAULT NULL::text, _social_x text DEFAULT NULL::text, _social_website text DEFAULT NULL::text, _bio text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
    AND access_level = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not an admin of this workspace';
  END IF;
  UPDATE workspaces SET
    hero_image_url = COALESCE(_hero_image_url, hero_image_url),
    logo_url = COALESCE(_logo_url, logo_url),
    brand_color = COALESCE(_brand_color, brand_color),
    hero_position = COALESCE(_hero_position, hero_position),
    hero_focal_point = COALESCE(_hero_focal_point, hero_focal_point),
    social_instagram = COALESCE(_social_instagram, social_instagram),
    social_tiktok = COALESCE(_social_tiktok, social_tiktok),
    social_youtube = COALESCE(_social_youtube, social_youtube),
    social_facebook = COALESCE(_social_facebook, social_facebook),
    social_x = COALESCE(_social_x, social_x),
    social_website = COALESCE(_social_website, social_website),
    bio = COALESCE(_bio, bio)
  WHERE id = _workspace_id;
END;
$function$;

-- 15) delete_track_version -------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_track_version(_user_id uuid, _version_id uuid, _track_id uuid, _workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE _count integer;
BEGIN
  PERFORM public.assert_caller(_user_id);

  IF NOT EXISTS (
    SELECT 1 FROM tracks WHERE id = _track_id AND workspace_id = _workspace_id
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  SELECT COUNT(*) INTO _count FROM track_versions WHERE track_id = _track_id;
  IF _count <= 1 THEN
    RAISE EXCEPTION 'cannot_delete_last_version';
  END IF;
  IF EXISTS (SELECT 1 FROM track_versions WHERE id = _version_id AND is_active = true) THEN
    RAISE EXCEPTION 'cannot_delete_active_version';
  END IF;
  DELETE FROM track_versions WHERE id = _version_id AND track_id = _track_id;
  UPDATE tracks SET version_count = _count - 1 WHERE id = _track_id;
END;
$function$;
```

---

## ✅ Vérification (read-only — à exécuter après le bloc ci-dessus)

```sql
-- 1) Les 15 wrappers contiennent bien assert_caller ?
SELECT proname,
       (pg_get_functiondef(oid) ILIKE '%assert\_caller(\_user\_id)%' ESCAPE '\') AS guarded
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('delete_workspace','delete_track','update_member_role','remove_workspace_member',
                  'add_to_whitelist','get_admin_overview','list_all_users','list_all_contacts',
                  'insert_track','delete_contacts','set_track_marketplace_public','create_pitch',
                  'create_shared_link','update_workspace_branding','delete_track_version')
ORDER BY guarded, proname;   -- attendu : 15 lignes, toutes guarded = true

-- 2) Les 3 orphelines sont bien supprimées ?
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('insert_stem_legacy_v0','remove_workspace_member_legacy_v0','update_member_role_legacy_v0');
-- attendu : 0 ligne

-- 3) Plus aucune legacy_v0 n'est appelable par authenticated/PUBLIC ?
SELECT proname, coalesce(array_to_string(proacl, ' | '), '(PUBLIC)') AS acl
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname LIKE '%\_legacy\_v0' ESCAPE '\'
ORDER BY proname;
-- attendu : aucune ligne ne doit contenir 'authenticated=X' ni un grant PUBLIC ('=X/...')
-- (seuls postgres / service_role doivent rester)
```

---

## 📋 Récap

- **15** RPCs critiques durcies avec `assert_caller(_user_id)` (anti-usurpation `auth.uid()`).
- **3** `legacy_v0` orphelines **droppées** (code mort).
- **27** `legacy_v0` encore déléguées : **EXECUTE direct révoqué** (anon/authenticated/PUBLIC) → bypass impossible, wrappers intacts.
- **Aucune** signature de fonction modifiée → **zéro** changement frontend (pas de `tsc`).
- Edge Functions : aucune modifiée → **pas de redeploy**.
