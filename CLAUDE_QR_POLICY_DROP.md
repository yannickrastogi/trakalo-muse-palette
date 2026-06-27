# Retrait de la policy anon SELECT permissive sur `tracks` (QR studio)

> À exécuter **après** :
> 1. déploiement du frontend (StudioSession utilise maintenant la RPC `get_track_by_qr_token`)
> 2. création de la RPC (`supabase/migrations/20260627_get_track_by_qr_token.sql`)
>
> ⚠️ Bloc à copier dans **Supabase SQL Editor** — ne pas auto-exécuter.

---

## ⚠️ Important — la policy n'est pas versionnée dans le repo

Le nom `anon_read_track_by_qr` est une **hypothèse**. La policy réelle qui
laissait l'anon lire `tracks.eq(qr_token)` n'existe pas sous ce nom dans le
repo (cf. `docs/RLS_AUDIT_2026-05-10.md` — plusieurs policies anon ne sont pas
versionnées). **Lister les policies réelles AVANT de dropper.**

### 1. Lister les policies anon SELECT sur `tracks`

```sql
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'tracks'
  AND 'anon' = ANY (roles)
ORDER BY policyname;
```

### 2. Dropper UNIQUEMENT la policy permissive QR

```sql
-- Nom hypothétique (no-op si absent) :
DROP POLICY IF EXISTS "anon_read_track_by_qr" ON public.tracks;

-- Si l'étape 1 révèle un autre nom (ex: "Anyone can read tracks",
-- "anon_read_tracks", "tracks_anon_select"...), le dropper explicitement :
-- DROP POLICY IF EXISTS "<nom_reel_trouvé>" ON public.tracks;
```

### 3. NE PAS dropper la policy légitime shared link

> 🚫 **Conserver** `anon_read_tracks_via_shared_link`
> (`supabase/migrations/20260315_shared_link_anon_rls.sql`) — elle est
> nécessaire à SharedLinkPage et reste correctement scopée via `shared_links`.
> La supprimer casserait les pages publiques de partage.

### 4. Vérification

```sql
-- Après drop, l'anon ne doit plus avoir de SELECT large sur tracks.
-- Seule "anon_read_tracks_via_shared_link" doit rester (scopée).
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tracks' AND 'anon' = ANY (roles);
```

Le flux QR studio continue de fonctionner via la RPC SECURITY DEFINER
`get_track_by_qr_token` (5 champs exposés, scopés au token), sans avoir besoin
d'une policy anon SELECT sur la table.
