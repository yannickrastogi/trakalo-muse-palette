# TRAKALOG — ISRC Generation (Feature Spec)

> **Document créé le :** 17 mai 2026
> **Objectif :** Permettre la génération automatique de codes ISRC pour chaque track, en 1 clic, conforme à la norme ISO 3901.
> **Statut :** URGENT — gap critique vs Sound Credit pour les labels/producteurs sérieux
> **Priorité :** Avant le launch public

---

## Vision

L'ISRC (International Standard Recording Code) est l'identifiant universel d'un enregistrement sonore. Sans ISRC, un track ne peut pas être correctement tracké par les PROs, SoundExchange, les DSPs (Spotify, Apple Music), ni les services de neighbouring rights. C'est une exigence non-négociable pour quiconque veut être payé professionnellement.

Sound Credit l'offre dès leur plan Essential Unlimited à $6/mois. **C'est table-stakes industrie.**

Trakalog doit permettre :
1. **Génération en 1 clic** depuis TrackDetail
2. **Bulk generation** pour les catalogues existants
3. **Override manuel** (entrer un ISRC déjà attribué ailleurs)
4. **Validation** du format et unicité

---

## Format ISRC (ISO 3901)

```
CC-XXX-YY-NNNNN  (avec tirets pour affichage)
CCXXXYYNNNNN     (12 caractères sans tirets, format stockage)
```

| Segment | Chars | Description | Exemple |
|---------|-------|-------------|---------|
| **CC** | 2 | Country Code (ISO 3166-1 alpha-2) | `CA` (Canada), `US`, `FR`, `GB` |
| **XXX** | 3 | Registrant Code (alphanumérique) | `ABC` (attribué par agence nationale) |
| **YY** | 2 | Year of reference (2 derniers chiffres) | `26` (pour 2026) |
| **NNNNN** | 5 | Designation Code (séquentiel) | `00001`, `00002`, ... |

**Exemple complet :** `CA-ABC-26-00001` → premier track enregistré en 2026 par le registrant ABC au Canada.

---

## Obtention du Registrant Code

C'est **le défi principal**. Le registrant code est délivré par les agences nationales :

| Pays | Agence | Coût | URL |
|------|--------|------|-----|
| Canada | Connect Music Licensing | Gratuit | connectmusic.com |
| USA | RIAA / USISRC | Gratuit | usisrc.org |
| France | SCPP | Gratuit pour membres | scpp.fr |
| UK | PPL | Gratuit pour membres | ppluk.com |
| Allemagne | IFPI Germany | Gratuit pour membres | ifpi.de |
| International | IFPI | Variable | ifpi.org |

### Stratégie Trakalog : modèle hybride

**Option A — Trakalog Managed (par défaut, pour la majorité) :**
- Trakalog obtient son propre registrant code (via Yannick Rastogi Productions Inc., entité canadienne → `CA-XXX`)
- Trakalog alloue les ISRCs séquentiellement aux users
- Tous les tracks générés en Free/Starter utilisent ce pool
- Avantage : l'user n'a rien à faire
- Inconvénient : tous les tracks portent le même registrant code Trakalog

**Option B — Bring Your Own Registrant (pros/labels) :**
- L'user entre son propre Registrant Code dans Workspace Settings
- Trakalog l'utilise pour générer les ISRCs de ce workspace
- Avantage : le label garde son identité dans l'ISRC
- Inconvénient : nécessite que l'user ait son propre code

**Décision recommandée :** Hybride
- Free/Starter → Option A (registrant Trakalog)
- Pro/Business → Option A par défaut + possibilité d'ajouter son propre registrant code (Option B)

---

## DB Schema

### Nouvelles colonnes sur `workspaces`

```sql
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS isrc_country_code text DEFAULT 'CA';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS isrc_registrant_code text;
-- NULL = utilise le registrant code Trakalog par défaut
-- text = registrant code custom du workspace (Pro/Business)
```

### Nouvelles colonnes sur `tracks`

```sql
-- ISRC déjà présent dans tracks.isrc (text) — à vérifier
-- Ajouter colonnes auxiliaires pour traçabilité :
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_generated boolean DEFAULT false;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_generated_at timestamptz;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_year integer;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS isrc_designation integer;

-- Index pour cherche les ISRCs déjà attribués
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(isrc) WHERE isrc IS NOT NULL;

-- Contrainte d'unicité globale sur l'ISRC
ALTER TABLE tracks ADD CONSTRAINT unique_isrc UNIQUE (isrc);
```

### Nouvelle table : `isrc_counters`

Tracker le compteur séquentiel par (country, registrant, year) pour éviter les collisions :

```sql
CREATE TABLE IF NOT EXISTS isrc_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  registrant_code text NOT NULL,
  year integer NOT NULL,
  last_designation integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_counter_per_year UNIQUE (country_code, registrant_code, year)
);

-- Index
CREATE INDEX idx_isrc_counters_lookup ON isrc_counters(country_code, registrant_code, year);
```

### Variables d'environnement Supabase

```
TRAKALOG_ISRC_COUNTRY_CODE=CA
TRAKALOG_ISRC_REGISTRANT_CODE=XXX  # À obtenir via Connect Music Licensing
```

---

## RPC — `generate_isrc`

```sql
CREATE OR REPLACE FUNCTION generate_isrc(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country_code text;
  v_registrant_code text;
  v_year integer;
  v_designation integer;
  v_isrc text;
  v_existing_isrc text;
BEGIN
  -- 1. Vérifier que l'user a accès au workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id 
      AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- 2. Vérifier que le track n'a pas déjà un ISRC
  SELECT isrc INTO v_existing_isrc FROM tracks WHERE id = _track_id;
  IF v_existing_isrc IS NOT NULL AND v_existing_isrc != '' THEN
    RAISE EXCEPTION 'Track already has an ISRC: %', v_existing_isrc;
  END IF;
  
  -- 3. Récupérer country + registrant (workspace ou défaut Trakalog)
  SELECT 
    COALESCE(NULLIF(isrc_country_code, ''), 'CA'),
    COALESCE(NULLIF(isrc_registrant_code, ''), current_setting('app.trakalog_isrc_registrant', true))
  INTO v_country_code, v_registrant_code
  FROM workspaces WHERE id = _workspace_id;
  
  IF v_registrant_code IS NULL THEN
    RAISE EXCEPTION 'No registrant code configured';
  END IF;
  
  -- 4. Récupérer/incrémenter le compteur pour cette année
  v_year := EXTRACT(YEAR FROM now())::integer;
  
  INSERT INTO isrc_counters (country_code, registrant_code, year, last_designation)
  VALUES (v_country_code, v_registrant_code, v_year, 1)
  ON CONFLICT (country_code, registrant_code, year)
  DO UPDATE SET 
    last_designation = isrc_counters.last_designation + 1,
    updated_at = now()
  RETURNING last_designation INTO v_designation;
  
  -- 5. Construire l'ISRC (sans tirets, 12 chars)
  v_isrc := v_country_code 
         || v_registrant_code 
         || LPAD((v_year % 100)::text, 2, '0')
         || LPAD(v_designation::text, 5, '0');
  
  -- 6. Sauver sur le track
  UPDATE tracks 
  SET isrc = v_isrc,
      isrc_generated = true,
      isrc_generated_at = now(),
      isrc_year = v_year,
      isrc_designation = v_designation
  WHERE id = _track_id;
  
  -- 7. Audit log
  PERFORM write_audit_log(_user_id, _workspace_id, 'track.isrc_generated', 'track', _track_id::text, 
    jsonb_build_object('isrc', v_isrc), NULL);
  
  RETURN v_isrc;
END;
$$;
```

### RPC — `set_track_isrc_manual`

Permet à l'user d'entrer manuellement un ISRC existant :

```sql
CREATE OR REPLACE FUNCTION set_track_isrc_manual(
  _user_id uuid,
  _track_id uuid,
  _workspace_id uuid,
  _isrc text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validation format (12 chars, alphanum)
  IF NOT _isrc ~ '^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$' THEN
    RAISE EXCEPTION 'Invalid ISRC format. Expected: CCXXXYYNNNNN (12 chars)';
  END IF;
  
  -- Vérifier accès workspace (Editor/Admin)
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members 
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND access_level IN ('editor', 'admin')
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Vérifier unicité globale
  IF EXISTS (SELECT 1 FROM tracks WHERE isrc = _isrc AND id != _track_id) THEN
    RAISE EXCEPTION 'ISRC already used on another track';
  END IF;
  
  UPDATE tracks 
  SET isrc = _isrc, 
      isrc_generated = false  -- manuel, pas généré
  WHERE id = _track_id;
END;
$$;
```

---

## UX

### Sur TrackDetail (track sans ISRC)

```
┌─────────────────────────────────────────────┐
│ Track Metadata                              │
│ ──────────────────────────────              │
│ ISRC: [empty]                               │
│                                             │
│ ┌─────────────────────┐ ┌────────────────┐ │
│ │ ⚡ Generate ISRC    │ │ ✏️ Enter Manual│ │
│ └─────────────────────┘ └────────────────┘ │
└─────────────────────────────────────────────┘
```

### Sur TrackDetail (track avec ISRC)

```
┌─────────────────────────────────────────────┐
│ ISRC: CA-TRK-26-00042  ✓ Generated          │
│ 📋 Copy                                      │
└─────────────────────────────────────────────┘
```

### Modal "Enter Manual ISRC"

- Input avec masque `CC-XXX-YY-NNNNN`
- Validation format en temps réel
- Tooltip : "If your track already has an ISRC from your label or distributor, enter it here."

### Bulk Generation (Workspace Settings)

- Page : Settings → Catalog → Generate ISRCs
- Liste des tracks sans ISRC avec checkbox
- Bouton "Generate ISRCs for X selected tracks"
- Progress bar pendant la génération
- Toast : "X ISRCs generated"

### Settings → Workspace → ISRC Configuration (Pro/Business uniquement)

```
ISRC Configuration

Country Code: [CA ▼]
Registrant Code: [_____] (optional)

ℹ️ Leave empty to use Trakalog's default registrant code.
   To use your own, obtain a code from Connect Music Licensing 
   (Canada) or your national agency.

[ Save ]
```

---

## Validation & Edge Cases

### Validation pré-génération
- Track existe et appartient au workspace
- User a permission Editor ou Admin
- Track n'a pas déjà d'ISRC (ou confirmation pour override)
- Workspace a un registrant code configuré

### Edge cases
- **Track supprimé après génération** : l'ISRC reste réservé dans `isrc_counters` (jamais réutilisé — c'est la norme ISO)
- **Doublon ISRC** : contrainte UNIQUE empêche l'insertion, message clair à l'user
- **Année roulante** : compteur reset automatiquement chaque nouvelle année
- **Format invalide à l'import** : refuser, expliquer le format attendu

### Politique : pas de réutilisation
Une fois un ISRC attribué, il ne doit JAMAIS être réutilisé sur un autre track, même si le track original est supprimé. C'est la règle ISO 3901. Le compteur `last_designation` n'est jamais décrémenté.

---

## Affichage de l'ISRC

### Où l'ISRC doit apparaître
- TrackDetail (section Metadata)
- Edit Track modal
- Metadata PDF (Trakalog Pack)
- Shared Link Page (section Credits si visible)
- Exports DDEX/PRO (cf. DDEX_PRO_EXPORTS.md)
- Stems Pack metadata

### Format d'affichage
- **Avec tirets** dans l'UI pour lisibilité : `CA-TRK-26-00042`
- **Sans tirets** en stockage et exports : `CATRK2600042`
- Helper functions : `formatIsrcWithDashes(isrc)`, `stripIsrcDashes(isrc)`

---

## Phases d'implémentation

### Phase 1 — Setup (~1 session)
1. Obtenir le Registrant Code Trakalog via Connect Music Licensing (Canada)
2. Créer les colonnes DB + table `isrc_counters`
3. Configurer les variables d'environnement Supabase
4. RPC `generate_isrc` + RPC `set_track_isrc_manual`

### Phase 2 — UX TrackDetail (~1 session)
5. Bouton "Generate ISRC" sur TrackDetail
6. Modal "Enter Manual ISRC"
7. Affichage formaté avec tirets + bouton Copy
8. Validation format côté frontend

### Phase 3 — Bulk + Configuration (~1 session)
9. Bulk Generation dans Workspace Settings
10. Configuration du Registrant Code custom (Pro/Business)
11. Affichage ISRC dans Metadata PDF, exports, shared links

### Phase 4 — Polish (~0.5 session)
12. Audit logs détaillés
13. Tests unitaires sur le format
14. Documentation user (Guide Trakalog)

**Total estimé : 3-4 sessions Claude Code**

---

## Coûts

| Poste | Coût |
|------|------|
| Obtention Registrant Code (Connect Music Licensing) | Gratuit |
| Maintenance annuelle | Gratuit (Canada) |
| Compteur DB (1 ligne par registrant/year) | Négligeable |
| **Total** | **0 $** |

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Pas de registrant code obtenu à temps | Démarcher Connect Music Licensing **avant** le launch (process ~2-4 semaines) |
| User attribue un ISRC déjà utilisé ailleurs | Contrainte UNIQUE en DB + validation REST avant insertion |
| Confusion sur le format (avec/sans tirets) | Helpers de formatage cohérents partout |
| User Pro veut son propre registrant code mais ne l'a pas | UI explicite : "Leave empty to use Trakalog's default" |
| Track supprimé puis ISRC réutilisé accidentellement | Compteur jamais décrémenté, soft-delete des tracks |

---

## Intégration avec DDEX/PRO Exports

L'ISRC est **obligatoire** pour la plupart des exports :
- **SoundExchange** : ISRC required
- **The MLC** : ISRC fortement recommandé
- **DDEX ERN** : ISRC required
- **DDEX RIN** : ISRC required
- **BMI/ASCAP/SOCAN** : ISRC pour les enregistrements (ISWC pour les compositions)

**Conséquence :** avant d'exporter vers ces services, vérifier que tous les tracks sélectionnés ont un ISRC. Sinon, proposer "Generate ISRCs for X tracks now?".

---

## Dépendances

- **Yannick Rastogi Productions Inc.** ✅ (entité canadienne existante)
- **Connect Music Licensing account** ⏳ (à créer)
- **Registrant Code Trakalog** ⏳ (à obtenir, ~2-4 semaines)
- **Track table & RPCs** ✅ (déjà en place)

---

## Standard de référence

- **ISO 3901:2019** — Information and documentation — International Standard Recording Code (ISRC)
- **IFPI ISRC Handbook 2021** — ifpi.org/wp-content/uploads/2021/02/ISRC_Handbook.pdf

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
