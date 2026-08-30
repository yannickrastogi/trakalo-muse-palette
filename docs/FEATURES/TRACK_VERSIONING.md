# TRAKALOG — Track Versioning (Feature Spec)

> **Document créé le :** 13 avril 2026
> **Objectif :** Permettre aux utilisateurs d'uploader et comparer plusieurs versions d'un même morceau.
> **Statut :** Planifié

---

## Vision

Un morceau passe par plusieurs versions : demo → V1 → V2 → radio edit → clean → master final. L'utilisateur doit pouvoir uploader ces versions sous le même track, les comparer en A/B au même timecode, et choisir laquelle est la version "active" utilisée pour les pitches et shared links.

---

## Principes clés

1. **Un track = une œuvre.** Les métadonnées partagées (titre, artiste, splits, lyrics, cover, mood, genre) restent sur le track parent.
2. **Chaque version a ses propres données audio** : fichier audio, waveform, Sonic DNA, durée, notes.
3. **Auto-naming** : la première version s'appelle "V1" (ou "Original"), les suivantes "V2", "V3", etc. L'utilisateur peut renommer.
4. **Une version active** : c'est celle utilisée dans les pitches, shared links et le player par défaut. N'importe quelle version peut devenir active.
5. **A/B switching** : dans TrackDetail, l'utilisateur peut basculer entre les versions au même timecode pour comparer instantanément.

---

## Structure DB

### Nouvelle table : track_versions

```sql
CREATE TABLE track_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  version_name text NOT NULL DEFAULT 'V1',
  audio_url text,                     -- fichier audio original (storage path)
  audio_preview_url text,             -- MP3 preview compressé
  waveform_data jsonb,                -- waveform propre à cette version
  sonic_dna jsonb,                    -- Sonic DNA propre à cette version
  duration_sec numeric,
  is_active boolean DEFAULT false,    -- la version utilisée pour pitches/shared links
  notes text,                         -- notes spécifiques ("ajouté guitare", "mix V2", etc.)
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  
  CONSTRAINT unique_active_per_track UNIQUE (track_id, is_active) 
    -- Note: cette contrainte ne marche que si on gère le toggle côté app
);

-- Index pour chercher la version active rapidement
CREATE INDEX idx_track_versions_active ON track_versions(track_id) WHERE is_active = true;

-- Contrainte : un seul is_active = true par track (géré côté application)
```

### Colonnes ajoutées sur tracks (optionnel)

```sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS has_versions boolean DEFAULT false;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS version_count integer DEFAULT 1;
```

---

## Migration des tracks existants

Quand la feature est activée, migrer chaque track existant :

```sql
INSERT INTO track_versions (track_id, version_number, version_name, audio_url, audio_preview_url, waveform_data, sonic_dna, duration_sec, is_active, created_by)
SELECT id, 1, 'V1', audio_url, audio_preview_url, waveform_data, sonic_dna, duration_sec, true, uploaded_by
FROM tracks
WHERE audio_url IS NOT NULL;

UPDATE tracks SET has_versions = true, version_count = 1 WHERE audio_url IS NOT NULL;
```

---

## UX — TrackDetail

### Sélecteur de versions (sous le titre, au-dessus du player)

```
┌──────────────────────────────────────────────────┐
│  Naughty Gyal                                     │
│  Arjun K. x Ayu Shy x Banx & Ranx               │
│                                                   │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌───────┐ │
│  │ V1  │  │ V2  │  │ V3  │  │ V4★ │  │  + ▲  │ │
│  └─────┘  └─────┘  └─────┘  └─────┘  └───────┘ │
│                                                   │
│  ★ = version active (utilisée pour pitches)      │
│  + = Upload New Version                           │
│  ▲ = Set as Active (sur la version sélectionnée) │
└──────────────────────────────────────────────────┘
```

### Comportement des tabs de version :
- **Clic sur une version** : charge sa waveform et son audio dans le player. Si le track était en lecture, continue au même timecode (A/B switch).
- **★ (étoile)** sur la version active : indique visuellement quelle version est utilisée pour les pitches/shared links.
- **Double-clic sur le nom** : renommer la version (texte libre).
- **Bouton "+"** : ouvre un file picker pour uploader une nouvelle version. Auto-nommée "V[N+1]".
- **Clic droit ou menu "..."** sur une version :
  - "Set as Active" → cette version devient la version par défaut
  - "Download" → télécharger ce fichier audio
  - "Delete Version" → supprimer (pas possible sur la dernière version restante)
  - "View Notes" → ouvrir/éditer les notes de cette version

### A/B Comparison

Quand l'utilisateur switch de version pendant la lecture :
1. Le player note le timecode actuel (ex: 1:34)
2. Charge le fichier audio de la nouvelle version
3. Seek au même timecode (1:34)
4. Continue la lecture immédiatement
5. La waveform se met à jour avec celle de la nouvelle version
6. Transition seamless — comme un A/B dans un DAW

### Notes par version

Chaque version a un petit champ "notes" accessible :
- Via un icône 📝 à côté du nom de la version
- Au clic, un petit input inline s'ouvre pour écrire/éditer
- Exemples : "Mix par Jean", "Ajouté bridge guitare", "Version clean sans explicit", "Master final"

---

## UX — Liste des tracks (catalogue)

### Indicateur de versions multiples

Dans la ligne du catalogue (TrackRow), si un track a plus d'une version :
- Afficher un petit badge ou indicateur : "V4" ou "4 versions" en text-2xs à côté du titre
- Discret mais informatif
- Au hover : tooltip "4 versions — V4 is active"

---

## UX — Upload

### Upload initial
- Le track est créé normalement
- Une entrée track_versions est créée automatiquement avec version_name "V1", is_active = true
- L'audio_url est stocké dans track_versions ET dans tracks (pour rétrocompatibilité)

### Upload nouvelle version (depuis TrackDetail)
1. Clic sur "+" dans le sélecteur de versions
2. File picker s'ouvre (WAV, MP3, FLAC, AIFF)
3. Le fichier est uploadé vers Storage dans le même dossier que le track, avec suffixe : `{workspace_id}/{track_id}_v{N}.{ext}`
4. Nouvelle entrée track_versions créée :
   - version_number = max(version_number) + 1
   - version_name = "V" + version_number
   - is_active = false (ne pas changer la version active automatiquement)
5. Sonic DNA se lance automatiquement sur la nouvelle version
6. Compression MP3 preview en fire-and-forget
7. Toast : "Version V3 uploaded — Sonic DNA analysis in progress..."
8. La nouvelle version apparaît dans les tabs

---

## Shared Links & Pitches

### Comportement
- Les shared links et pitches utilisent TOUJOURS la version active (is_active = true)
- Quand l'utilisateur change la version active, les shared links existants pointent vers la nouvelle version active
- Le recipient du shared link ne voit pas les autres versions — il écoute la version active uniquement
- Si l'utilisateur veut partager une version spécifique (pas l'active), il peut créer un shared link depuis le menu "..." de cette version

### SharedLinkPage
- Le player charge l'audio de la version active par défaut
- Le watermarking s'applique sur la version active

---

## Sonic DNA

Chaque version a son propre Sonic DNA :
- BPM peut différer entre versions (remix plus rapide, radio edit raccourci)
- Structure peut différer (radio edit sans bridge)
- Energy curve différente
- Le Sonic DNA du track parent (tracks.sonic_dna) = celui de la version active
- Quand on change la version active, tracks.sonic_dna est mis à jour avec le sonic_dna de la nouvelle version active

---

## Smart Brief Matching

Le matching utilise le Sonic DNA de la version active. Mais il peut aussi scanner les autres versions :
- "V2 de ce track matche mieux ce brief que V1 (score 92% vs 78%)"
- Suggestion : "Switch to V2 as active for better brief matching"

---

## Flow technique — Set as Active

1. L'utilisateur clique "Set as Active" sur une version
2. Frontend :
   - `UPDATE track_versions SET is_active = false WHERE track_id = X` (toutes les versions)
   - `UPDATE track_versions SET is_active = true WHERE id = version_id`
   - `UPDATE tracks SET audio_url = version.audio_url, audio_preview_url = version.audio_preview_url, waveform_data = version.waveform_data, sonic_dna = version.sonic_dna, duration_sec = version.duration_sec WHERE id = track_id`
3. Toast : "V3 is now the active version"
4. Les shared links existants pointent automatiquement vers la nouvelle version

---

## Phases d'implémentation

### Phase 1 — MVP (~2-3 semaines)
- Table track_versions + migration tracks existants
- Upload nouvelle version depuis TrackDetail
- Tabs de version dans TrackDetail
- Switch de version dans le player (chargement du bon fichier)
- Set as Active
- Sonic DNA par version
- Indicateur dans la liste du catalogue

### Phase 2 — Polish (~1-2 semaines)
- A/B switch seamless au même timecode
- Notes par version (inline edit)
- Renommer les versions (double-clic)
- Supprimer une version
- Shared link pour une version spécifique

### Phase 3 — Intelligence (~1 semaine)
- Smart Brief Matching scanne toutes les versions
- Suggestion de version optimale pour chaque brief
- Comparaison Sonic DNA entre versions (overlay des energy curves)

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Rétrocompatibilité | Migration automatique des tracks existants + garder audio_url sur le track parent |
| Storage space | Même pricing Supabase, pas de changement |
| Shared links cassés | La version active est toujours la source des shared links |
| Confusion utilisateur | L'étoile ★ indique clairement la version active |
| Performance player A/B | Preload la version suivante en background quand l'utilisateur hover |

---

## Dépendances

- **Sonic DNA Profiler** ✅ (déjà implémenté — tourne par version)
- **Shared Links** ✅ (déjà implémenté — pointe vers version active)
- **Storage Supabase** ✅ (déjà configuré)
- **Smart Brief Matching** ⏳ (bonus Phase 3)

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
