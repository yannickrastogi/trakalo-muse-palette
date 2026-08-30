# TRAKALOG — Brief Seeker (Future Feature)

> **Document créé le :** 13 avril 2026
> **Objectif :** Scanner automatiquement les briefs ouverts (sync, placements, labels), matcher avec le catalogue, préparer des pitches personnalisés prêts à envoyer.
> **Statut :** Planifié — après Smart Brief Matching + Artist Seeker
> **Vision :** L'utilisateur dort, Trakalog travaille. Le matin, une inbox de pitches prêts à approuver.

---

## Résumé logique — Faisabilité & ROI

### Pourquoi c'est viable

Un seul placement sync obtenu grâce au Brief Seeker (typiquement 2 000$ à 50 000$) rembourse des années de coûts d'infrastructure. C'est le ratio effort/reward le plus élevé de tout Trakalog.

### Les 4 niveaux d'automatisation

**Phase 1 — MVP (5-10$/mois)** — Faisable immédiatement
L'utilisateur colle lui-même un brief dans Trakalog. Trakalog fait le matching + écrit l'email. Pas de scan auto. Économise 30-60 minutes par brief. Coût : ~0.05$ par brief en tokens Claude.

**Phase 2 — Semi-auto (30-40$/mois)** — Faisable sous 2 mois
Un cron scanne 2x/jour Twitter + 2-3 sites de briefs. Claude parse, extrait les critères, lance le matching. L'utilisateur voit les résultats le matin.

**Phase 3 — Full auto (70-100$/mois)** — Quand Trakalog a des users payants
Toutes les sources connectées, Gmail MCP pour les briefs par email, feedback loop. Volume de briefs élevé.

**Phase 4 — Premium (300-500$/mois)** — Quand Trakalog génère du revenu
Abonnements aux plateformes payantes (Taxi.com, Music Gateway). Briefs exclusifs.

### Risque principal
Le scraping peut casser quand les sites changent. C'est pour ça que la Phase 1 (copié-collé manuel) est essentielle — elle marche toujours et valide le concept avant d'investir dans l'automatisation.

### ROI attendu
- Un placement sync moyen : 2 000$ - 50 000$
- Coût annuel Phase 1 : ~60-120$
- **Un seul placement rembourse 10+ années de coûts Phase 1**
- Même en Phase 4 (~2 400$/an), un seul placement moyen est rentable

---

## Vision

Le problème : les opportunités de placement (sync briefs, label briefs, who's looking lists) sont dispersées sur des dizaines de plateformes. Les producteurs passent des heures à chercher, matcher manuellement leurs tracks, écrire des emails personnalisés. La plupart des briefs expirent avant qu'ils aient eu le temps de répondre.

**Brief Seeker** automatise tout le pipeline : veille → matching → rédaction → approbation.

---

## Pipeline complet — Les 4 agents en chaîne

```
AGENT 1 — Brief Hunter (veille automatique)
  Scanne les sources de briefs toutes les 12h
  Extrait : description du brief, genre/mood/tempo demandé, deadline, contact, budget estimé
    ↓
AGENT 2 — Smart Brief Matching (déjà planifié)
  Compare chaque brief avec le sonic_dna + user_metadata du catalogue
  Score de matching 0-100% pour chaque track
  Sélectionne les 1-3 meilleurs tracks par brief
    ↓
AGENT 3 — Pitch Writer
  Écrit un email personnalisé pour chaque match
  Utilise : nom du contact, contexte du brief, pourquoi CE track est parfait
  Tone professionnel mais humain, pas générique
  Inclut : lien Trakalog shared link vers le track
    ↓
AGENT 4 — Pitch Inbox (interface utilisateur)
  Le matin, l'utilisateur ouvre Trakalog
  Il voit une liste de pitches prêts : brief → track → email → contact
  Pour chaque pitch : Approve (envoie) / Edit (modifier l'email) / Dismiss
```

---

## Sources de briefs

### Plateformes de sync (priorité haute)
- **Musicbed** — briefs ouverts pour pub, film, TV
- **Songtradr** — marketplace sync avec briefs publics
- **Music Gateway** — briefs sync + placements
- **Marmoset** — briefs curatés (plus exclusif)
- **Disco.ac** — briefs partagés (concurrent direct → avantage compétitif)
- **Taxi.com** — listings A&R et briefs industrie
- **BroadJam** — opportunités de placement

### Who's Looking Lists (labels & publishers)
- **Music Connection Magazine** — publisher/label briefs mensuels
- **SongLink / Tunefind** — placements recherchés pour séries/films
- **Film Music Network** — briefs superviseurs musicaux

### Réseaux sociaux & forums
- **Twitter/X** — hashtags #SyncBrief #MusicBrief #LookingForMusic #MusicSupervisor
- **Reddit** — r/musicindustry, r/WeAreTheMusicMakers (briefs communautaires)
- **LinkedIn** — posts de music supervisors et A&R

### Emails & newsletters
- **Sync newsletters** (à s'abonner) : briefs envoyés directement
- **Possibilité d'intégrer Gmail** via MCP pour parser les briefs reçus par email

### API vs Scraping

| Source | Méthode | Fiabilité | Coût |
|--------|---------|-----------|------|
| Songtradr | API (si disponible) ou scraping | Haute | Gratuit |
| Musicbed | Scraping page briefs | Moyenne | Gratuit |
| Music Gateway | API | Haute | Abonnement (~20$/mois) |
| Twitter/X | API v2 | Haute | Gratuit (basic) |
| Taxi.com | Scraping membre | Haute | Abonnement (~300$/an) |
| Gmail newsletters | MCP Gmail | Haute | Gratuit |

---

## Architecture technique

### Agent 1 — Brief Hunter

```
Service Railway ou Supabase Edge Function (cron toutes les 12h)

POST /scan-briefs
Response: {
  briefs: [
    {
      id: "uuid",
      source: "Songtradr",
      title: "Upbeat pop for Nike campaign",
      description: "Looking for energetic, positive pop tracks...",
      requirements: {
        genres: ["pop", "dance pop"],
        mood: ["energetic", "uplifting", "positive"],
        bpm_range: [110, 130],
        vocal: "female preferred",
        duration: "30s-60s edit available",
        instrumental: false,
        language: "English",
        explicit: false
      },
      budget: "$5,000 - $15,000",
      deadline: "2026-05-01",
      contact: {
        name: "Sarah Johnson",
        email: "sarah@musicagency.com",
        role: "Music Supervisor",
        company: "Creative Music Agency"
      },
      url: "https://songtradr.com/brief/xyz",
      scanned_at: "2026-04-13T06:00:00Z"
    }
  ]
}
```

### Agent 2 — Smart Brief Matching (existant, à connecter)

```
Pour chaque brief, l'agent :
1. Convertit les requirements en critères de recherche sonic_dna
2. Cherche dans le catalogue : BPM range, mood match, genre match, vocal/instrumental
3. Score chaque track de 0-100%
4. Retourne les top 1-3 tracks avec raison du match

Input: brief.requirements + catalogue sonic_dna
Output: [{ track_id, score, match_reasons, gap_analysis }]
```

### Agent 3 — Pitch Writer

```
Pour chaque match brief→track, Claude écrit un email personnalisé :

Input: {
  contact: { name, role, company },
  brief: { title, description, requirements },
  track: { title, artist, sonic_dna, shared_link_url },
  match: { score, reasons }
}

Output: {
  subject: "Re: Nike Campaign Brief — Perfect match from [Artist]",
  body: "Hi Sarah,\n\nI came across your brief for the Nike campaign...",
  tone: "professional_warm"
}

Règles de rédaction :
- Jamais générique ("I think this would be a great fit")
- Toujours spécifique ("The 8-second instrumental intro is ideal for the brand reveal")
- Mentionner un détail du brief pour montrer qu'on l'a lu
- Court (max 150 mots)
- Inclure le shared link Trakalog
- Sign off avec le nom du workspace owner
```

### Agent 4 — Pitch Inbox (Frontend)

```
Nouvelle page dans Trakalog : "Pitch Inbox" ou "Opportunities"

Interface :
┌─────────────────────────────────────────────────────┐
│ 🎯 3 new opportunities found this morning           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Nike Campaign — Upbeat Pop                          │
│ via Songtradr · Budget $5-15K · Deadline May 1      │
│ Match: "Summer Vibes" (92%) — BPM & mood aligned    │
│                                                     │
│ [Preview Email]  [✓ Approve & Send]  [✏️ Edit]  [✕] │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Netflix Series "Dark Waters" — Atmospheric Score     │
│ via Musicbed · Budget $2-8K · Deadline Apr 28        │
│ Match: "Midnight Run" (87%) — Dark, minimal, no vox │
│                                                     │
│ [Preview Email]  [✓ Approve & Send]  [✏️ Edit]  [✕] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Actions utilisateur sur chaque opportunité :
- **Preview Email** : voir l'email rédigé par l'agent dans un modal
- **Approve & Send** : envoie l'email via Resend (noreply@trakalog.com, reply-to workspace owner)
- **Edit** : ouvrir l'email dans un éditeur, modifier, puis envoyer
- **Dismiss** : marquer comme non pertinent (feedback pour améliorer le matching)
- **Snooze** : remettre à plus tard

---

## Table DB — briefs

```sql
briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  source text NOT NULL,              -- "songtradr", "musicbed", "twitter", etc.
  source_url text,
  title text NOT NULL,
  description text,
  requirements jsonb,                -- { genres, mood, bpm_range, vocal, etc. }
  budget text,
  deadline timestamptz,
  contact_name text,
  contact_email text,
  contact_role text,
  contact_company text,
  status text DEFAULT 'new',         -- new, matched, pitched, dismissed, expired
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
)

brief_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES briefs(id),
  track_id uuid REFERENCES tracks(id),
  match_score integer,               -- 0-100
  match_reasons text[],
  gap_analysis text,
  draft_subject text,
  draft_body text,
  status text DEFAULT 'draft',       -- draft, approved, sent, dismissed
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

---

## Phases d'implémentation détaillées

### Phase 1 — MVP manuel (~3-4 semaines) — 5-10$/mois
- L'utilisateur colle un brief (texte) dans Trakalog
- Smart Brief Matching trouve les tracks
- Pitch Writer rédige l'email
- L'utilisateur approuve et envoie
- Pas de scan automatique — input manuel uniquement
- **Valeur immédiate :** économise 30-60 minutes par brief

### Phase 2 — Scan semi-auto (~3-4 semaines) — 30-40$/mois
- Scanner 2-3 sources (Songtradr, Twitter #SyncBrief)
- Cron toutes les 12h
- Pitch Inbox avec les résultats
- Notifications : "3 new briefs match your catalog"
- **Valeur :** l'utilisateur ne rate plus de briefs

### Phase 3 — Full auto (~4-6 semaines) — 70-100$/mois
- Toutes les sources de briefs connectées
- Gmail MCP pour parser les briefs reçus par email
- Learning : les dismiss améliorent le matching (feedback loop)
- Stats : taux d'acceptation, revenus générés par les pitches
- **Valeur :** machine à placements autonome

### Phase 4 — Premium — 300-500$/mois
- Intégration Taxi.com, Music Gateway (abonnements)
- Briefs exclusifs via partenariats
- "Priority pitching" — être le premier à répondre à un brief
- **Valeur :** accès à des opportunités invisibles au public

---

## Coûts estimés détaillés

### Phase 1 (MVP)

| Poste | Coût mensuel |
|-------|-------------|
| Claude API (matching + rédaction email) | ~5-10$ |
| Resend (envoi emails) | Déjà payé |
| **Total Phase 1** | **~5-10$/mois** |

### Phase 2 (Semi-auto)

| Poste | Coût mensuel |
|-------|-------------|
| Claude API (scan + matching + emails) | ~20-30$ |
| Proxies (scraping léger) | ~10$ |
| Railway (cron agent) | Déjà payé |
| **Total Phase 2** | **~30-40$/mois** |

### Phase 3 (Full auto)

| Poste | Coût mensuel |
|-------|-------------|
| Claude API (volume élevé) | ~50-80$ |
| Proxies | ~20$ |
| **Total Phase 3** | **~70-100$/mois** |

### Phase 4 (Premium)

| Poste | Coût mensuel |
|-------|-------------|
| Taxi.com | ~25$ (300$/an) |
| Music Gateway | ~20$ |
| Claude API | ~80$ |
| Proxies | ~20$ |
| **Total Phase 4** | **~145-200$/mois** |

---

## Intégration avec les autres agents

```
Brief Seeker ←→ Smart Brief Matching ←→ Sonic DNA Profiler
      ↓                                        ↑
Artist Seeker ──────────────────────────────────┘
      ↓
Pitch Writer → Pitch Inbox → Send via Resend
      ↓
Session Replay Analyst (feedback: le contact a écouté ? combien de temps ?)
      ↓
Catalog Awakener (un vieux track matche un nouveau brief → alerte)
```

**Le cercle vertueux :**
1. Brief Seeker trouve un brief
2. Smart Brief Matching trouve le track parfait grâce au Sonic DNA
3. Pitch Writer écrit l'email parfait
4. L'email contient un shared link Trakalog (watermarké, trackable)
5. Session Replay Analyst voit que le contact a écouté 3 fois le chorus
6. Si le track est placé → revenus → Ghost Revenue Hunter s'assure que tout est collecté
7. Le succès améliore le scoring pour les futurs briefs

---

## Le vrai avantage compétitif

Personne ne fait ça end-to-end. Les outils existants font UNE partie :
- Songtradr/Musicbed : listing de briefs (pas de matching intelligent)
- Taxi.com : briefs + soumission (pas d'analyse audio)
- DISCO : catalogue + partage (pas de pitch automatique)

**Trakalog serait le premier à faire : veille → matching → rédaction → envoi → tracking → collecte.** C'est un full-stack pitch automation.

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Scraping bloqué par les plateformes | Commencer par Phase 1 (manuel), valider le concept d'abord |
| Qualité des emails générés | Human-in-the-loop (approve/edit), jamais d'envoi auto sans approbation |
| Spam perception | Max 3-5 pitches/jour par contact, respect des deadlines |
| Briefs expirés | Vérifier deadline avant matching, priorité aux urgents |
| Contact emails invalides | Vérification email (MX check) avant envoi |
| Trop de briefs non pertinents | Feedback dismiss améliore le filtre progressivement |
| Sites changent leur structure | Phase 1 (manuel) fonctionne toujours comme fallback |

---

## Dépendances

- **Smart Brief Matching** ⏳ (prochaine priorité — nécessaire avant Brief Seeker)
- **Sonic DNA Profiler** ✅ (déjà implémenté)
- **Pitch system Trakalog** ✅ (déjà implémenté — send-pitch-email Edge Function)
- **Shared Links** ✅ (déjà implémenté — watermarked, trackable)
- **Resend** ✅ (déjà configuré)
- **Session Replay / Engagement tracking** ✅ (heatmaps en cours)

---

*Ce document est vivant. Il sera mis à jour au fur et à mesure du développement.*
