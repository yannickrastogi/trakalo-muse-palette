# COWORK_TRACK_DETAIL_FIX_REPORT — Track Details : title/artist ne persistent pas

**Date** : 2026-06-07 · **Branche** : `cowork/fix-update-track-whitelist-20260607-2316` · **Tag** : `pre-update-track-fix-20260607-231603` · **Track test** : `f0c583a1` (SOS- NCT v2, workspace Banx & Ranx Test)

---

## 1. État avant fix — champ par champ

| Champ (front → clé payload) | Dans whitelist ? | Colonne réelle ? | Persistait ? | Pourquoi |
|---|---|---|---|---|
| title, artist, featuring, key, album, isrc, upc, copyright, notes, language | ✅ | ✅ | ❌ | UPDATE entier rollback (voir bug 1) |
| bpm | ✅ | ✅ | ✅ | sauvé par le 2e appel `{bpm,key,sonic_dna}` d'EditTrackModal (payload sans clé toxique) |
| genre (text[]) | ✅ | ✅ | ❌* | cast text[] OK (branche spéciale) mais rollback du batch |
| mood (text[]) | ✅ | ✅ | ❌ | **bug 1** : casté `::jsonb` sur colonne text[] → 42804 |
| labels (text[]) | ✅ | ✅ | ❌ | **bug 1** : idem — c'est LA clé qui faisait tout planter (toujours envoyée par EditTrackModal) |
| publishers (text[]) | ✅ | ✅ | ❌ | **bug 1** : idem |
| type (front envoie `track_type`) | ❌ (`'type'` listé, colonne inexistante) | ✅ `track_type` | ❌ | **bug 2** : droppé silencieusement par la whitelist |
| voice (front mappe → `gender`) | `'voice'` listé mais colonne inexistante | ✅ `gender` | ❌* | gender whitelisté OK, mais rollback du batch |
| lyrics | ✅ | ✅ | ✅ (seul) | l'appel `updateTrackLyrics` n'a pas de clé toxique |
| lyrics_segments | ❌ | ✅ | ❌ | **bug 3** : absent de la whitelist → karaoke segments perdus à chaque édition de lyrics |
| iswc | ❌ | ✅ | ❌ | **bug 3** : absent de la whitelist |
| status, explicit, released_at, credits, tags, splits, chapters, cover_url, audio*_url, waveform_data, sonic_dna, duration_sec, qr_token | ✅ | ✅ | ✅/❌* | OK seuls ; rollback si dans le même batch que labels/publishers/mood |

\* = la clé elle-même était correcte, mais tout batch contenant `labels`/`publishers`/`mood` (array JSON) échouait en bloc.

## 2. Cause racine

**Reproduction SQL exacte** (payload identique à EditTrackModal → TrackContext.updateTrack) :

```
ERROR 42804: column "labels" is of type text[] but expression is of type jsonb
QUERY: UPDATE public.tracks SET ... labels = '[]'::jsonb, publishers = '[]'::jsonb ...
```

Le builder dynamique de `update_track` castait **tout array JSON en `::jsonb`** ; seul `genre` avait une branche text[]. Or `mood`, `labels`, `publishers` sont aussi des colonnes `text[]`. EditTrackModal envoie **toujours** `labels` et `publishers` → chaque save plantait → rollback de TOUS les champs du batch (title, artist…). Le 2e appel séparé `{bpm, key, sonic_dna}` réussissait → illusion que "seul BPM marche". Le même crash touchait l'upload (stage 4 extended metadata d'UploadTrackModal : "Some metadata could not be saved").

Bugs secondaires : whitelist avec `'type'`/`'voice'` (colonnes inexistantes — `track_type`/`gender` sont les vraies) et sans `lyrics_segments`/`iswc` ; `released_at=''` non gardé.

## 3. SQL exécuté (traçabilité)

`CREATE OR REPLACE FUNCTION public.update_track(...)` — appliqué en prod via Supabase MCP le 2026-06-07. Changements :

1. `v_text_array_columns := ARRAY['genre','mood','labels','publishers']` — la branche text[] (ex-genre) généralisée aux 4 colonnes.
2. Whitelist : `'type'` → `'track_type'`, retrait de `'voice'`, ajout de `'lyrics_segments'` et `'iswc'`.
3. Garde `released_at = '' → NULL`.
4. Tout le reste (checks d'accès editor/pitcher, casts object/boolean/number, EXECUTE) inchangé.

SQL complet committé dans **`supabase/migrations/20260607_update_track_whitelist_v2.sql`** (enfin un fichier migration dans le repo). Grants vérifiés : ACL préservés par CREATE OR REPLACE (anon/authenticated/service_role X).

## 4. Diff code

**Aucun changement front nécessaire** : TrackContext envoie déjà les bonnes clés (`track_type`, `gender`, `lyrics_segments`). La branche feature ne contient que le fichier migration + ce rapport.

## 5. État après fix — tests effectués (SQL, via la RPC réelle)

| Test | Résultat |
|---|---|
| Payload exact EditTrackModal (21 clés, celui qui plantait) | ✅ succès |
| title + artist modifiés → relus | ✅ persistent |
| mood `["dark","energetic"]`, labels `["Test Label"]`, publishers `["Pub A","Pub B"]` (text[]) | ✅ persistent |
| genre `["pop","dance"]` (non-régression branche text[]) | ✅ persiste |
| track_type `"song"` (ex-droppé silencieusement) | ✅ persiste |
| lyrics_segments jsonb (ex-droppé) | ✅ persiste |
| iswc (ex-droppé) | ✅ persiste |
| Revert : track remis à l'état snapshot d'origine | ✅ vérifié |

**Restant à valider par Yannick dans l'UI** (login requis, non fait par Cowork) : passe rapide EditTrackModal → save → reload sur un track, et un upload complet avec "Skip Review" (le crash de l'extended metadata à l'upload est le même bug, donc devrait être réglé d'office).

## 6. Risques résiduels

1. **⚠️ Donnée de test** : le snapshot initial du track SOS- NCT v2 n'incluait pas `lyrics`/`lyrics_segments` ; mes tests ont fini avec ces champs à NULL. Si ce track avait des lyrics avant (peu probable — track de test quasi vide), elles sont perdues. À vérifier visuellement.
2. Les anciens saves échoués ne sont pas récupérables — les utilisateurs beta devront re-saisir les éditions perdues.
3. `status` : EditTrackModal n'envoie pas `status` (chemin séparé `updateTrackStatus` → OK testé par construction).
4. Pattern récurrent (3e RPC cassée par mismatch de types) : le smoke test post-migration recommandé dans les rapports précédents s'applique toujours.
5. La fonction garde le builder SQL dynamique (EXECUTE format) — sûr grâce à %I/%L + whitelist, mais toute nouvelle colonne tracks devra être ajoutée à `v_allowed_columns` (et à `v_text_array_columns` si text[]).
