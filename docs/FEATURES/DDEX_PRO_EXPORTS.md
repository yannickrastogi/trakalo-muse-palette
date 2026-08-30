# TRAKALOG — DDEX & PRO Exports (Feature Spec)

> **Document créé le :** 17 mai 2026
> **Objectif :** Exporter les metadata Trakalog vers les formats industriels (PROs, neighbouring rights, mechanical, DDEX) pour permettre la déclaration et la collecte des royalties.
> **Statut :** URGENT — gap critique vs Sound Credit (28 formats supportés)
> **Priorité :** Avant le launch public (au moins Priority 1)
> **Dépendance :** ISRC Generation (cf. ISRC_GENERATION.md)

---

## Vision

Sans capacité d'export industriel, Trakalog reste un outil de stockage et pitching. Pour devenir **le système nerveux du catalogue**, il faut que les données Trakalog alimentent directement les sociétés qui collectent l'argent :

- **PROs** (BMI, ASCAP, SOCAN, SACEM…) pour les droits de performance → **les songwriters et compositeurs**
- **Neighbouring Rights** (SoundExchange, PPL, ADAMI…) pour les performers et master owners
- **Mechanical** (The MLC, MRP…) pour les droits mécaniques (streaming, downloads)
- **DDEX** pour les échanges techniques avec distributors/DSPs

Sound Credit a 28 formats. Trakalog doit au minimum couvrir les **5 formats prioritaires** pour ne pas perdre les labels et producteurs sérieux.

---

## Trois familles de droits (rappel)

| Famille | Couvre | Identifiant | Sociétés clés |
|---------|--------|-------------|---------------|
| **Performing Rights** | Songwriters & compositeurs (la chanson) | ISWC | BMI, ASCAP, SOCAN, SACEM, PRS |
| **Neighbouring Rights** | Performers & master owners (l'enregistrement) | ISRC | SoundExchange, PPL, ADAMI, SCPP |
| **Mechanical Rights** | Reproduction (streaming + downloads) | ISWC + ISRC | The MLC (US), MRP, MCPS |

**Conséquence pour Trakalog :** chaque track doit avoir ISRC (recording) ET ISWC (composition) pour être complètement déclarable.

---

## Formats à supporter — Priorisation

### Priority 1 — Launch (MUST HAVE)

| Format | Type | Couverture | Format de fichier |
|--------|------|-----------|-------------------|
| **BMI Works Registration** | Performing | USA | CSV ou XML |
| **ASCAP Works Registration (ACE)** | Performing | USA | CSV |
| **SOCAN Works Registration** | Performing | Canada | CSV |
| **SoundExchange ISRC Repertoire** | Neighbouring | USA | CSV |
| **The MLC Bulk Upload** | Mechanical | USA | CSV |

Ces 5 formats couvrent **80% des besoins des users US/Canadiens** (la majorité du marché cible).

### Priority 2 — Post-launch (3 mois après)

| Format | Type | Couverture |
|--------|------|-----------|
| **DDEX RIN** | Session data | International (DDEX standard) |
| **PPL Repertoire** | Neighbouring | UK |
| **SACEM Declaration** | Performing | France |
| **SESAC Works** | Performing | USA |
| **Generic Split Sheet PDF** | Legal | International |

### Priority 3 — Enterprise (6 mois+, plan Business)

| Format | Type | Couverture |
|--------|------|-----------|
| **DDEX ERN** | Distribution | International (Spotify/Apple livraisons) |
| **GEMA** | Performing | Allemagne |
| **JASRAC** | Performing | Japon |
| **SUISA** | Performing | Suisse |
| **Warner Music Label Copy** | Label | Custom |
| **The Orchard Metadata** | Distribution | Custom |
| **AllMusic Metadata** | Discovery | Custom |

---

## Données nécessaires (et état actuel Trakalog)

### Identifiants

| Champ | Description | Statut Trakalog |
|-------|-------------|----------------|
| **ISRC** | Recording ID | ⏳ Spec rédigée (ISRC_GENERATION.md) |
| **ISWC** | Composition ID | ❌ À implémenter |
| **IPI/CAE** | Composer/Publisher ID | ✅ `splits.ipi` + `contacts.ipi` |
| **IPN** | Performer ID | ❌ À ajouter (rare, optionnel) |
| **ISNI** | Creator ID | ❌ À ajouter (futur, cf. Sound Credit) |

### Métadonnées track (déjà en DB Trakalog)

| Champ | Source Trakalog |
|-------|-----------------|
| Title | `tracks.title` |
| Artist | `tracks.artist` |
| Featured artists | `tracks.featuring` |
| Duration | `tracks.duration_sec` |
| Genre | `tracks.genre` |
| Language | `tracks.language` |
| Release date | `tracks.release_date` |
| Album | `tracks.album` |
| Label | `tracks.labels[]` |
| Publisher | `tracks.publishers[]` |
| Explicit | `tracks.explicit` |
| Copyright | `tracks.copyright` |

### Crédits & splits (déjà en DB Trakalog)

| Champ | Source |
|-------|--------|
| Songwriter | `splits` avec role `Songwriter` |
| Producer | `splits` avec role `Producer` |
| Performer | `splits` avec role `Artist` |
| Musician | `splits` avec role `Musician` |
| PRO membership | `splits.pros[]` |
| IPI | `splits.ipi` |
| Publisher | `splits.publisher` |
| Share % | `splits.share` |
| Stage name | `splits.stage_name` |

### Ce qui manque
- **ISWC** generation/storage
- **Master ownership** (qui possède le master — souvent != songwriter)
- **Release territory** (pour les exports geo-spécifiques)
- **Recording date & studio** (pour DDEX RIN)
- **Recording engineer** (pour DDEX RIN — déjà partial via splits Mix/Mastering Engineer)

---

## DB Schema — Ajouts

### Colonnes tracks

```sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS iswc text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS recording_date date;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS recording_location text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS master_owner text;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS p_line text;  -- ℗ 2026 Yannick Rastogi Productions
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS c_line text;  -- © 2026 Yannick Rastogi Productions
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS release_territory text DEFAULT 'WW';

CREATE INDEX IF NOT EXISTS idx_tracks_iswc ON tracks(iswc) WHERE iswc IS NOT NULL;
```

### Nouvelle table : `export_history`

Tracker tous les exports pour audit + éviter les doublons de soumissions :

```sql
CREATE TABLE IF NOT EXISTS export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  user_id uuid REFERENCES auth.users(id),
  export_type text NOT NULL,  -- 'bmi_works', 'ascap_ace', 'socan', 'soundexchange', 'mlc', 'ddex_rin'
  track_ids uuid[] NOT NULL,
  file_path text,             -- path dans Storage si le fichier est conservé
  file_format text,           -- 'csv', 'xml', 'xlsx'
  track_count integer NOT NULL,
  status text DEFAULT 'completed',  -- completed, failed
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_export_history_workspace ON export_history(workspace_id, created_at DESC);
```

### Nouvelle table : `iswc_counters` (similaire à ISRC)

Si Trakalog génère aussi les ISWC :

```sql
-- Format ISWC : T-XXX.XXX.XXX-C
-- T = constant
-- XXX.XXX.XXX = 9-digit sequence
-- C = check digit (modulo 10)

CREATE TABLE IF NOT EXISTS iswc_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_code text NOT NULL,  -- attribué par CISAC
  last_sequence bigint NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);
```

**Note ISWC :** contrairement à l'ISRC, l'ISWC est attribué par les PROs (BMI, ASCAP, SOCAN) lors de la registration de l'œuvre, pas par le titulaire. **Trakalog ne peut pas générer d'ISWC en autonomie.** L'user devra l'entrer manuellement après registration, OU Trakalog facilite la registration et récupère l'ISWC.

**Décision recommandée :** Phase 1 = stockage manuel de l'ISWC. Phase 2 (futur) = intégration API ASCAP/BMI pour récupération automatique.

---

## Format des exports — Spécifications détaillées (Priority 1)

### 1. BMI Works Registration

**Format :** CSV
**Encodage :** UTF-8
**Délimiteur :** Virgule
**Quoting :** Double-quotes pour les champs avec virgule

**Colonnes (BMI standard) :**

```csv
Work Title,Alternate Title,ISWC,Duration,Performer,Writer Name,Writer IPI,Writer Role,Writer Share %,Publisher Name,Publisher IPI,Publisher Share %,Recording Artist,ISRC,Release Date
```

**Exemple :**
```csv
"Naughty Gyal","","",212,"Arjun K.","Yannick Rastogi","00123456789","Composer/Author",50.00,"YR Publishing","00987654321",50.00,"Arjun K. x Ayu Shy","CATRK2600042","2026-06-01"
```

**Règles :**
- Une ligne par writer (donc plusieurs lignes par track si plusieurs writers)
- Le total des Writer Share % doit = 100 par track
- ISWC optionnel à la première registration
- IPI obligatoire pour chaque writer
- Writer Role : "Composer/Author" pour songwriter, "Composer" pour compositeur instrumental

### 2. ASCAP Works Registration (ACE)

**Format :** CSV
**Encodage :** UTF-8

**Colonnes (ASCAP ACE) :**

```csv
Title,Duration,Writers,Writer IPIs,Writer Shares,Publishers,Publisher IPIs,Publisher Shares,ISWC,ISRC,Performer,Album,Release Date
```

**Différence avec BMI :** un seul ligne par track, writers séparés par pipe `|`.

**Exemple :**
```csv
"Naughty Gyal",212,"Yannick Rastogi|Arjun K.","00123456789|00111222333",50.00|50.00,"YR Publishing","00987654321",100.00,,"CATRK2600042","Arjun K.","Album Name","2026-06-01"
```

### 3. SOCAN Works Registration

**Format :** CSV
**Encodage :** UTF-8

**Colonnes (SOCAN) :**

```csv
Title,Duration,Writer Name,Writer IPI,Writer Affiliation,Writer Share,Publisher Name,Publisher IPI,Publisher Affiliation,Publisher Share,ISWC,Performer
```

**Règles :**
- Affiliation = SOCAN, BMI, ASCAP, etc. (selon le membership de chaque writer)
- Multi-writer = multiple lignes
- Pour les Canadians : Affiliation = "SOCAN"

### 4. SoundExchange ISRC Repertoire

**Format :** CSV
**Encodage :** UTF-8

**Couvre :** les performers et master owners pour les revenus de digital performance (Pandora, SiriusXM, webcasts).

**Colonnes (SoundExchange) :**

```csv
ISRC,Title,Featured Artist,Label,P-Line,Release Year,Master Owner,Master Owner IPN,Performer Name,Performer Role,Performer Share %
```

**Règles :**
- ISRC **obligatoire** (refusé sans ISRC)
- Performer Role : "Featured Artist", "Non-Featured Artist" (background vocals, session musicians)
- Featured artists : 45% du master par défaut
- Non-featured : 5%
- Master Owner : 50% (souvent le label ou l'artiste principal)

### 5. The MLC Bulk Upload

**Format :** CSV (DDEX-aligned)
**Encodage :** UTF-8

**Couvre :** mechanical royalties US (streaming + downloads).

**Colonnes (The MLC) :**

```csv
Musical Work Title,Alternative Title,ISWC,Songwriter Name,Songwriter IPI,Songwriter Role,Songwriter Share,Publisher Name,Publisher IPI,Publisher Share,Sound Recording Title,ISRC,Recording Artist,Duration,Album,Release Date,P-Line,Label
```

**Note :** The MLC accepte aussi le format DDEX Musical Works Portfolio Notification (MWPN) - XML standard plus complet.

---

## Edge Function : `export-pro-format`

```typescript
// supabase/functions/export-pro-format/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ExportRequest {
  workspace_id: string;
  track_ids: string[];
  format: 'bmi' | 'ascap' | 'socan' | 'soundexchange' | 'mlc';
  user_id: string;
}

serve(async (req) => {
  // ... auth + rate limiting + UUID validation
  
  const { workspace_id, track_ids, format, user_id } = await req.json();
  
  // 1. Fetch tracks + splits via RPC SECURITY DEFINER
  const tracks = await fetchTracksWithSplits(workspace_id, track_ids, user_id);
  
  // 2. Validate pre-export (ISRC, IPI, etc.)
  const validation = validateForFormat(tracks, format);
  if (validation.errors.length > 0) {
    return new Response(JSON.stringify({ 
      success: false, 
      errors: validation.errors 
    }), { status: 400 });
  }
  
  // 3. Build CSV/XML
  let content: string;
  switch (format) {
    case 'bmi': content = buildBmiCsv(tracks); break;
    case 'ascap': content = buildAscapCsv(tracks); break;
    case 'socan': content = buildSocanCsv(tracks); break;
    case 'soundexchange': content = buildSoundExchangeCsv(tracks); break;
    case 'mlc': content = buildMlcCsv(tracks); break;
  }
  
  // 4. Log dans export_history
  await logExport(workspace_id, user_id, format, track_ids, content);
  
  // 5. Return CSV as download
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trakalog_${format}_${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
});
```

---

## Validation pré-export

Avant chaque export, vérifier :

| Champ | BMI | ASCAP | SOCAN | SoundExchange | MLC |
|-------|-----|-------|-------|---------------|-----|
| Title | ✅ | ✅ | ✅ | ✅ | ✅ |
| Duration | ✅ | ✅ | ✅ | ✅ | ✅ |
| ISRC | optional | optional | optional | **REQUIRED** | ✅ |
| ISWC | optional | optional | optional | — | optional |
| Writer + IPI | **REQUIRED** | **REQUIRED** | **REQUIRED** | — | **REQUIRED** |
| Writer Shares total = 100% | ✅ | ✅ | ✅ | — | ✅ |
| Publisher info | optional | optional | optional | — | recommended |
| Performer | recommended | recommended | — | **REQUIRED** | recommended |
| Release date | recommended | recommended | — | **REQUIRED** | recommended |
| P-Line | — | — | — | **REQUIRED** | **REQUIRED** |

**Comportement UI :**
- Tracks invalides affichés en rouge dans la liste avec icône ⚠️
- Tooltip explicite : "Missing IPI for Yannick Rastogi"
- Bouton "Fix missing fields" → ouvre une modal de complétion rapide
- Bouton Export grisé tant qu'il reste des tracks invalides (ou autorise l'export partiel des tracks valides)

---

## UX

### Nouvelle page : Workspace Settings → Exports

```
┌────────────────────────────────────────────────────────────────┐
│ Exports                                                          │
│ ────────────────────────────────────────                        │
│                                                                  │
│ Export your catalog to industry-standard formats for PROs,      │
│ neighbouring rights organizations, and mechanical licensing.    │
│                                                                  │
│ ┌──── Performing Rights ──────────────────────────────────┐    │
│ │ 🎼 BMI Works Registration         [Export]              │    │
│ │ 🎼 ASCAP ACE Works                [Export]              │    │
│ │ 🎼 SOCAN Works Registration       [Export]              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌──── Neighbouring Rights ────────────────────────────────┐    │
│ │ 📻 SoundExchange ISRC Repertoire  [Export]              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌──── Mechanical Rights ──────────────────────────────────┐    │
│ │ 💿 The MLC Bulk Upload            [Export]              │    │
│ └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│ ┌──── Export History ─────────────────────────────────────┐    │
│ │ May 17, 2026 — BMI Works (12 tracks)         [Download] │    │
│ │ May 10, 2026 — SoundExchange (8 tracks)      [Download] │    │
│ └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────┘
```

### Modal Export (ex: BMI)

```
┌─────────────────────────────────────────────────────────┐
│ Export to BMI Works Registration                         │
│ ─────────────────────────────────                       │
│                                                          │
│ Select tracks to export:                                 │
│                                                          │
│ [✓] All tracks (24)                                      │
│ [ ] Recent tracks (last 30 days)                         │
│ [ ] Custom selection                                     │
│                                                          │
│ ⚠️  3 tracks have missing data:                          │
│    • "Track A" — Missing writer IPI                      │
│    • "Track B" — Missing duration                        │
│    • "Track C" — Writer shares ≠ 100%                    │
│                                                          │
│ [ Fix missing fields ] [ Export valid tracks only (21) ] │
│                                                          │
│                       [ Cancel ]    [ Export 24 tracks ] │
└─────────────────────────────────────────────────────────┘
```

### Bouton "Export" sur TrackDetail

Sur un track individuel, dropdown "Export → [Format]" pour exporter ce track seul.

---

## Permissions par plan

| Feature | Free | Starter | Pro | Business |
|---------|:----:|:-------:|:---:|:--------:|
| ISRC Generation (1 clic) | ❌ | ✅ | ✅ | ✅ |
| ISWC stockage | ❌ | ✅ | ✅ | ✅ |
| Export BMI/ASCAP/SOCAN | ❌ | 5/mois | ✅ illimité | ✅ illimité |
| Export SoundExchange | ❌ | 5/mois | ✅ illimité | ✅ illimité |
| Export The MLC | ❌ | ❌ | ✅ | ✅ |
| Export DDEX RIN/ERN | ❌ | ❌ | ❌ | ✅ |
| Export PPL/SACEM/SESAC | ❌ | ❌ | ❌ | ✅ |
| Custom Registrant Code | ❌ | ❌ | ✅ | ✅ |
| Export History | — | 30 days | 1 year | Unlimited |

---

## Phases d'implémentation

### Phase 1 — Foundations (~2 sessions)
1. Colonnes DB : iswc, recording_date, master_owner, p_line, c_line, release_territory
2. Table `export_history`
3. UI dans Workspace Settings → Exports (vide pour l'instant, juste l'écran)
4. Validation pre-export helper (TypeScript shared module)
5. Modal "Fix missing fields" générique

### Phase 2 — Performing Rights (~2 sessions)
6. Edge Function `export-pro-format` (skeleton)
7. CSV builder BMI
8. CSV builder ASCAP
9. CSV builder SOCAN
10. Tests sur catalogue réel

### Phase 3 — Neighbouring + Mechanical (~1-2 sessions)
11. CSV builder SoundExchange
12. CSV builder The MLC
13. Validation ISRC required pour SoundExchange/MLC

### Phase 4 — Polish + History (~1 session)
14. Export History UI (liste + redownload)
15. Audit logs sur chaque export
16. Bouton Export rapide sur TrackDetail (track individuel)
17. Documentation user

### Phase 5 — Post-launch (3-6 mois)
18. DDEX RIN (XML, plus complexe — utiliser librairie xmlbuilder2 ou fast-xml-parser)
19. PPL, SACEM, SESAC
20. DDEX ERN (Business plan uniquement)

**Total Priority 1 : 6-8 sessions Claude Code**

---

## Coûts

| Poste | Coût |
|-------|------|
| Aucune API externe (génération locale) | Gratuit |
| Storage des exports historiques (CSV ~10KB chacun) | Négligeable |
| Compute Edge Function | Inclus dans plan Supabase |
| **Total** | **0 $** |

**Avantage compétitif :** Sound Credit fait payer ces exports dans des plans premium. Trakalog peut les offrir dès le Starter avec quota (5/mois) puis illimité en Pro — différenciateur fort.

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Format CSV refusé par le PRO (mauvais headers) | Tester chaque format avec un compte BMI/ASCAP/SOCAN réel avant launch |
| User soumet le même track 2 fois | Export history affiche les doublons + warning "Already exported on [date]" |
| Splits invalides (total ≠ 100%) | Validation pré-export bloque, redirige vers la correction |
| IPI manquant | Modal Fix Missing Fields propose l'auto-completion via Contacts |
| Évolution des formats par les PROs | Versioning des templates + monitoring annuel |
| Différences UK/Europe non couvertes Priority 1 | Documentation claire : "Priority 1 covers US + Canada. International coming soon." |

---

## Référence des formats

- **BMI Works Registration Guide** — bmi.com/creators/registration
- **ASCAP ACE Submission** — ascap.com/help/ace-title-search
- **SOCAN Works Notification** — socan.com/works/notification
- **SoundExchange ISRC Repertoire** — soundexchange.com/performer-rights
- **The MLC Bulk Upload Guide** — themlc.com/bulk-upload
- **DDEX Standards** — ddex.net/standards

---

## Dépendances

- **ISRC Generation** ⏳ (cf. ISRC_GENERATION.md — prérequis pour SoundExchange + MLC)
- **Splits system multi-rôle, multi-PRO** ✅ (déjà implémenté)
- **Contacts.ipi** ✅ (déjà implémenté)
- **Edge Function infrastructure** ✅ (déjà en place)
- **Plan-based enforcement** ⏳ (cf. TRAKALOG_BILLING.md)

---

## Notes stratégiques

1. **Cibler les indé d'abord :** la majorité des labels établis ont déjà leurs outils (Songspace, RoyaltyShare). Le marché de Trakalog = les producteurs/labels en croissance qui ne sont pas équipés. Pour eux, **avoir BMI/ASCAP/SOCAN + SoundExchange + MLC = couvrir 95% de leurs besoins** avec un seul outil.

2. **Marketing :** "Send your catalog to BMI, ASCAP, SOCAN, SoundExchange, and The MLC — in one click. From the same place you manage your tracks." Message direct, killer feature pour le pricing.

3. **Trust building :** afficher les logos BMI/ASCAP/SOCAN/SoundExchange/MLC sur la landing page (comme Sound Credit avec Warner/SoundExchange/MLC). Même sans partenariat officiel, ce sont des standards publics.

4. **Future moat :** une fois les exports Priority 1 en place, le step suivant = **intégration API directe** (pas juste CSV export). ASCAP a une API ACE, BMI a un portal. Si Trakalog peut soumettre directement et récupérer les confirmations, c'est un step au-dessus de Sound Credit.

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
