# TRAKALOG — Billing & Payment System (Stripe)

> **Document créé le :** 22 avril 2026
> **Mis à jour le :** 20 mai 2026 (v3.1 — Smart A&R Starter 10→15, descriptions Stripe vendeuses, honnêteté Sonic DNA)
> **Objectif :** Spec complète du système de paiement Trakalog — plans, pricing, AI credits, beta passes, implémentation Stripe.
> **Statut :** Prêt à implémenter
> **Priorité :** Bloquant pour le beta launch

---

## 1. Philosophie Pricing

### Positionnement
Trakalog se positionne **contre Postal.music** (concurrent direct le plus proche) et **contre Disco.ac** (positioning premium historique). Notre stratégie :

- **Bat Postal Artist ($8) sur la valeur** : Starter à $10 avec Sonic DNA + watermarking + splits + Smart A&R inclus (Postal ne les a pas)
- **Bat Postal Plus ($20) sur la valeur** : Pro à $25 avec multi-workspace + leak tracing + branding custom
- **Égale Postal Pro ($45) au centime sur le prix brut** : Business à $45 avec 10x plus de features (AI agents, illimité)
- **Plus généreux que Disco** : 10x plus de valeur incluse à chaque tier sans add-ons cachés

**Message clé :** *"At every tier, Trakalog includes features Postal locks behind their $45/month plan — for less or the same price."*

### Benchmarks concurrents (mai 2026)

| Plateforme | Free | Entrée | Mid | Pro/Enterprise | Add-ons |
|---|---|---|---|---|---|
| **Postal.music** | $0 (25 tracks, 500 MB) | Artist $8/mo (unlimited tracks) | Plus $20/mo | Pro $45/mo (avec watermark) | Sales-led pour multi-seats |
| **Disco.ac** | — | $10/mois (500 tracks) | $15/mois (1K) | $25/mois + custom | Watermark +$, Discovery Suite +$10/mois |
| **DropCue** | — | $5/mois | $15/mois | $599 lifetime | Tout inclus |
| **Music Gateway** | — | £5/mois | £15/mois | £25/mois | Sync rep commission 20-25% |
| **Trakalog (v3)** | **$0** (10 tracks, 1.5 GB) | **$10/mois** | **$25/mois** | **$45/mois** | **AI Credits uniquement** |

### Coûts réels par utilisateur (post-migration Cloudflare R2)

Cloudflare R2 = **zero egress fees** + storage à **$0.015/GB/mois**. Migration prévue avant le launch public, ce qui transforme drastiquement les marges (notamment sur Pro et Business).

**Coûts fixes infrastructure (amortis sur tous les users) :**

| Poste | Coût mensuel |
|---|---|
| Supabase Pro (DB + Auth + Edge Functions) | $25 |
| Railway (Sonic DNA + Watermark service) | $10 |
| Vercel Pro (hébergement frontend) | $20 |
| Resend (base 50K emails) | $20 |
| Domain + Cloudflare DNS | $2 |
| **Total fixes** | **$77/mois** |

Répartis sur 500 users payants → **~$0.15/user en coûts fixes** (négligeable).

**Coûts variables Cloudflare R2 :**
- Storage : $0.015/GB/mois
- Egress : **$0** (la killer feature)
- Operations (R/W) : négligeable
- Claude API (Smart A&R via Groq Llama) : ~$0.05/query
- Whisper transcription : ~$0.02/track
- Resend additional : $0.0004/email
- Stripe : 2.9% + $0.30 par transaction (USD)

---

## 2. Architecture des abonnements (CRITIQUE — lire avant tout)

### Principe fondamental : Le plan vit sur l'USER, pas sur le workspace

**Un user = une subscription = un plan.** Le plan suit l'utilisateur partout, peu importe combien de workspaces il a, ou dans combien de workspaces il est invité.

### Pourquoi cette architecture ?

- Un user Pro peut créer plusieurs workspaces (un perso, un client Eliot, un client Sarah) → tous bénéficient de ses features de plan
- Un user Free peut être invité comme Editor dans un workspace Pro de quelqu'un d'autre → il a accès au workspace MAIS ses propres limites (uploads, pitches, Smart A&R) restent celles de son plan Free
- Plus simple à facturer, plus simple à expliquer, plus juste commercialement

### Règle des limites — Deux types de checks

| Type de limite | Qui paie / qui consomme | Exemples |
|---|---|---|
| **Capacité personnelle** | L'**utilisateur qui exécute l'action** | Uploads (tracks count + storage), pitches envoyés, Smart A&R queries, exports |
| **Features de workspace** | Le **owner du workspace** | Watermarking, branding custom, catalog sharing, QR studio, members_max, workspaces_max |

### Exemple concret

Scénario : Yannick (Pro) crée le workspace "Studio XYZ" et invite Eliot (Free) comme Editor.

| Action | Résultat |
|---|---|
| Yannick uploade dans XYZ | ✅ Compte sur son quota Pro (1000 tracks, 400 GB) |
| Eliot uploade dans XYZ | ✅ Compte sur son quota Free (10 tracks, 1.5 GB) — pas sur celui de Yannick |
| Le workspace XYZ contient 1010 tracks au total | ✅ Pas de limite globale workspace, somme des quotas individuels |
| Eliot voit/écoute tous les tracks de XYZ | ✅ Permissions workspace (Editor) le permettent |
| Eliot lance un Smart A&R query | ❌ Bloqué — son plan Free a 0 query/mois |
| Eliot envoie un pitch depuis XYZ | ❌ Bloqué — son plan Free a 0 pitch/mois |
| XYZ a du watermarking | ✅ Yannick (owner) est Pro → la feature est active sur le workspace |
| XYZ a branding custom | ✅ Yannick (owner) est Pro → branding actif |
| Eliot peut accéder aux stems | ❌ Bloqué — son plan Free n'a pas la feature stems (grisé avec upgrade prompt) |

### Conséquence sur le marketing

La pricing page doit être claire : **"X tracks que TU uploades"**, pas "X tracks dans ton workspace". Ça évite les malentendus et met l'accent sur la responsabilité individuelle.

---

## 3. Plans d'abonnement

### Free — $0/mois

**Objectif :** Acquisition. Laisser les gens goûter le produit et devenir accros. Convertir les utilisateurs "Save to Trakalog" depuis les shared links.

| Feature | Limite |
|---|---|
| **Tracks (uploads personnels)** | **10 max** |
| **Storage personnel** | **1.5 GB** |
| **Stems (upload, accès, gestion)** | ❌ **Grisé avec upgrade prompt** |
| Sonic DNA auto-analysis | ✅ Inclus |
| Shared links | 1 (branding Trakalog, pas custom) |
| Player + lyrics | ✅ |
| Watermarking | ❌ |
| Pitch emails | ❌ 0/mois |
| Smart A&R | ❌ 0 queries/mois |
| Branding custom | ❌ |
| Workspaces | 1 |
| Membres par workspace | 1 (owner uniquement) |
| Splits & signatures | ❌ |
| Contacts | 10 max |
| Radio | ❌ |
| Export contacts | ❌ |
| Leak tracing | ❌ |
| Catalog sharing | ❌ |
| QR code studio | ❌ |
| API access | ❌ |
| AI Credits achat | ❌ Pas disponible sur Free |

**Le Free est volontairement frustrant** — 10 tracks, pas de branding, pas de pitch, pas de stems. Juste assez pour tester et vouloir plus. C'est un teaser, pas un produit. **10 tracks (vs Postal Free à 25) reste compétitif** car compensé par : Sonic DNA réel, watermarking preview, et la qualité de l'UI.

---

### Starter — $10/mois ($90/an = $7.50/mois équiv, économie 25%)

**Cible :** Artiste solo, beatmaker, songwriter indépendant.
**vs Postal Artist ($8/mois)** : on est +$2 plus cher mais on offre **10x plus de features** (Sonic DNA, watermarking, splits, Smart A&R inclus — que Postal n'a pas).

| Feature | Limite |
|---|---|
| **Tracks (uploads personnels)** | **100** |
| **Storage personnel** | **40 GB** |
| **Stems** | ✅ Inclus |
| Sonic DNA auto-analysis | ✅ Inclus |
| Shared links | ✅ Illimités (password, expiration) |
| Watermarking invisible | ✅ Inclus |
| Leak tracing | ✅ Inclus |
| Branding custom | ✅ (hero, logo, couleur, socials) |
| Pitch emails | 15/mois |
| Smart A&R queries | 15/mois |
| Splits & signatures | ✅ |
| Contacts | ✅ Illimités |
| Radio | ✅ |
| Export contacts | ❌ |
| Workspaces | 1 |
| Membres par workspace | 1 (owner) |
| Catalog sharing | ❌ |
| QR code studio | ❌ |
| API access | ❌ |
| AI Credits achat | ✅ Disponible |

---

### Pro — $25/mois ($225/an = $18.75/mois équiv, économie 25%) ⭐ Plan star

**Cible :** Producteur actif, petit label, manager. **80% des revenus attendus.**
**vs Postal Plus ($20/mois)** : on est +$5 plus cher mais on offre multi-workspace + 5 membres + leak tracing + Smart A&R 50 queries (Postal Plus n'a aucune de ces features).

| Feature | Limite |
|---|---|
| **Tracks (uploads personnels)** | **1 000** |
| **Storage personnel** | **400 GB** |
| **Stems** | ✅ Inclus |
| Sonic DNA auto-analysis | ✅ Inclus |
| Shared links | ✅ Illimités |
| Watermarking invisible | ✅ Inclus |
| Leak tracing | ✅ Inclus |
| Branding custom | ✅ |
| Pitch emails | ✅ Illimités |
| Smart A&R queries | 50/mois |
| Splits & signatures | ✅ |
| Contacts | ✅ Illimités |
| Radio | ✅ |
| Export contacts | ✅ (PDF/CSV/XLSX) |
| Workspaces | 5 |
| Membres par workspace | 5 |
| Catalog sharing | ✅ |
| QR code studio | ✅ |
| API access | ✅ (quand disponible) |
| AI Credits achat | ✅ Disponible |

**Pourquoi c'est le plan star :** Le saut de $10 à $25 (2.5x le prix) donne 10x la valeur (1000 tracks vs 100, pitches illimités, 5 workspaces, 5 membres, catalog sharing, QR studio). Le "decoy effect" rend ce plan évident.

---

### Business — $45/mois ($405/an = $33.75/mois équiv, économie 25%)

**Cible :** Label, publisher, agence sync.
**vs Postal Pro ($45/mois)** : on **égale leur prix au centime**, mais on offre AI agents (Brief Seeker, Artist Seeker), multi-workspace illimité, support prioritaire — features qui n'existent pas chez Postal.

| Feature | Limite |
|---|---|
| **Tracks (uploads personnels)** | ✅ **Illimités** |
| **Storage personnel** | **2 TB inclus**, +$0.02/GB au-delà |
| **Stems** | ✅ Inclus |
| Sonic DNA auto-analysis | ✅ Inclus |
| Shared links | ✅ Illimités |
| Watermarking invisible | ✅ Inclus |
| Leak tracing | ✅ Inclus |
| Branding custom | ✅ |
| Pitch emails | ✅ Illimités |
| Smart A&R queries | ✅ Illimités |
| Splits & signatures | ✅ |
| Contacts | ✅ Illimités |
| Radio | ✅ |
| Export contacts | ✅ |
| Workspaces | ✅ Illimités |
| Membres par workspace | ✅ Illimités |
| Catalog sharing | ✅ |
| QR code studio | ✅ |
| API access | ✅ |
| Brief Seeker | ✅ (quand disponible) |
| Artist Seeker | ✅ (quand disponible) |
| Support prioritaire | ✅ |
| AI Credits achat | ✅ Disponible |

**Le Business à $45 égale Postal Pro mais offre 10x plus** — argument marketing clair sans guerre des prix.

---

## 4. Tableau récapitulatif des plans

| Plan | Prix mensuel | Prix annuel | Tracks | Storage | Stems | Pitches/mois | Smart A&R/mois | Workspaces | Membres |
|---|---|---|---|---|---|---|---|---|---|
| Free | $0 | — | 10 | 1.5 GB | ❌ | 0 | 0 | 1 | 1 |
| Starter | $10 | $90 | 100 | 40 GB | ✅ | 15 | 15 | 1 | 1 |
| Pro | $25 | $225 | 1000 | 400 GB | ✅ | ∞ | 50 | 5 | 5 |
| Business | $45 | $405 | ∞ | 2 TB | ✅ | ∞ | ∞ | ∞ | ∞ |

**Note storage** : la limite storage est calculée pour couvrir confortablement les WAV + stems associés. Hypothèse moyenne : ~320 MB par track total (1 master + 3 stems en moyenne). Free n'a pas de stems donc 1.5 GB suffit largement pour 10 tracks WAV (~1 GB). Cloudflare R2 (zero egress) rend ces limites soutenables côté coûts.

---

## 5. Marges nettes détaillées (post-Cloudflare R2)

Calculs basés sur un usage moyen estimé par plan, avec coûts variables Cloudflare R2 + Claude API + Whisper + Resend + Stripe + coûts fixes répartis sur 500 users payants.

### Starter — $10/mois

**Usage moyen estimé :** 50 tracks (5 GB), 200 streams/mois, 8 Smart A&R queries, 8 pitches, 3 transcriptions.

| Poste | Coût |
|---|---|
| Storage R2 (5 GB × $0.015) | $0.075 |
| Egress R2 (200 streams ~1 GB) | $0 |
| Smart A&R (8 × $0.05) | $0.40 |
| Whisper (3 × $0.02) | $0.06 |
| Resend (8 emails) | $0.003 |
| Stripe (2.9% + $0.30 sur $10) | $0.59 |
| Coûts fixes répartis | $0.15 |
| **Total coûts** | **~$1.28/mois** |

**Revenue net :** $10 - $1.28 = **$8.72/mois** → **Marge nette 87.2%**

**Annuel ($90) :** économie Stripe de ~$4/an → marge nette annuelle ~**89%**

---

### Pro — $25/mois ⭐

**Usage moyen estimé :** 400 tracks (48 GB), 1500 streams/mois, 25 Smart A&R, 40 pitches, 10 transcriptions.

| Poste | Coût |
|---|---|
| Storage R2 (48 GB × $0.015) | $0.72 |
| Egress R2 | $0 |
| Smart A&R (25 × $0.05) | $1.25 |
| Whisper (10 × $0.02) | $0.20 |
| Resend (40 emails) | $0.016 |
| Stripe (2.9% + $0.30 sur $25) | $1.03 |
| Coûts fixes répartis | $0.15 |
| **Total coûts** | **~$3.37/mois** |

**Revenue net :** $25 - $3.37 = **$21.63/mois** → **Marge nette 86.5%**

**Annuel ($225) :** économie Stripe ~$5/an → marge nette annuelle ~**85%**

---

### Business — $45/mois

**Usage moyen estimé :** 2000 tracks (240 GB), 5000 streams/mois, 150 Smart A&R, 100 pitches, 30 transcriptions.

| Poste | Coût |
|---|---|
| Storage R2 (240 GB × $0.015) | $3.60 |
| Egress R2 | $0 |
| Smart A&R (150 × $0.05) | $7.50 |
| Whisper (30 × $0.02) | $0.60 |
| Resend (100 emails) | $0.04 |
| Stripe (2.9% + $0.30 sur $45) | $1.61 |
| Coûts fixes répartis | $0.15 |
| **Total coûts** | **~$13.50/mois** |

**Revenue net :** $45 - $13.50 = **$31.50/mois** → **Marge nette 70%**

**Annuel ($405) :** économie Stripe ~$6.50/an → marge nette annuelle ~**62%**

---

### Synthèse marges nettes

| Plan | Prix mensuel | Marge nette mensuelle | Prix annuel | Marge nette annuelle |
|---|---|---|---|---|
| **Starter** | $10 | **87.2%** ($8.72) | $90 | **88%** ($79.26) |
| **Pro** | $25 | **86.5%** ($21.63) | $225 | **85%** ($191.59) |
| **Business** | $45 | **70%** ($31.50) | $405 | **62%** ($251.50) |

**Verdict CTO :** marges **excellentes** sur Starter et Pro (>85%), **bonnes** sur Business (70% mensuel, 62% annuel). Cloudflare R2 transforme drastiquement la rentabilité du Pro (qui était à 50-60% sur Supabase).

**Pour rappel — coûts pré-Cloudflare R2 (Supabase actuel) :**
- Pro : marge nette ~55-60% (vs 86% post-R2)
- Business : marge nette ~45-50% (vs 70% post-R2)

**La migration Cloudflare R2 est donc CRITIQUE avant le launch public.**

---

## 6. AI Credits (add-on, plans payants uniquement)

### Principe
Les features IA ont un coût variable (API Groq, Claude). Au lieu de tout inclure en illimité, chaque plan a un quota de base. Les power users achètent des packs de crédits supplémentaires.

**Free n'a pas accès à l'achat de crédits** — il faut au minimum un plan Starter.

### Packs disponibles

| Pack | Prix | Prix/crédit | Coût réel Trakalog | Marge brute |
|---|---|---|---|---|
| 25 crédits | $5 | $0.20 | ~$0.25 total (~$0.01/crédit) | **95%** |
| 100 crédits | $15 | $0.15 | ~$1.00 total | **93%** |

**Note** : un pack 500 crédits ($50) pourrait être ajouté post-launch si l'usage le justifie (power users Pro qui dépassent régulièrement leur quota). Pour le launch, on garde 2 packs pour simplifier le choix utilisateur.

### Utilisation des crédits

| Action | Crédits consommés |
|---|---|
| 1 Smart A&R query | 1 crédit |
| 1 transcription lyrics (Whisper) | 1 crédit |
| 1 re-analyse Sonic DNA | 1 crédit |
| 1 Brief Seeker scan | 2 crédits |
| 1 Artist Seeker search | 2 crédits |
| 1 génération de stems (Demucs, futur) | 5 crédits |

### Comportement
- Les crédits du plan de base se rechargent chaque mois (ne s'accumulent pas, reset au renouvellement Stripe)
- Les crédits achetés en pack n'expirent jamais
- Ordre de consommation : **d'abord** le quota mensuel du plan, **ensuite** les crédits achetés
- Quand tout est épuisé → message "Buy more credits" avec lien vers l'achat
- Notification à 80% du quota mensuel : "You have 2 Smart A&R queries left this month"

---

## 7. Billing annuel vs mensuel (25% off sur l'annuel)

| Plan | Mensuel | Annuel total | Annuel/mois équiv | Économie |
|---|---|---|---|---|
| Starter | $10 | **$90** | $7.50 | 25% |
| Pro | $25 | **$225** | $18.75 | 25% |
| Business | $45 | **$405** | $33.75 | 25% |

- **Pousser l'annuel** sur la pricing page (afficher le prix annuel par défaut, toggle pour mensuel)
- Badge "Save 25%" sur l'option annuelle
- Cash upfront + 12 mois de rétention garantie

**Pourquoi 25% (pas 20%) :** Cloudflare R2 nous donne des marges supérieures à 85% sur Starter et Pro, donc on peut se permettre un push annuel plus agressif sans casser la rentabilité.

---

## 8. Descriptions Stripe (prêtes à coller)

Descriptions vendeuses + **honnêtes** (basées uniquement sur les features livrées). À utiliser tels quels dans Stripe Dashboard.

### Trakalog Starter — $10/mo

```
Built for solo artists, beatmakers, and indie songwriters who treat their catalog like a business.

✓ 100 tracks · 40 GB storage · stems included
✓ Sonic DNA: Automatic BPM & key detection + audio fingerprinting that powers Smart A&R matching
✓ Invisible audio watermarking with leak tracing — know who shared what
✓ Unlimited password-protected shared links with custom branding
✓ Splits & digital signatures — never lose a co-write again
✓ Smart A&R: AI-powered track matching for briefs (15 queries/month)
✓ 15 pitch emails per month
✓ Solo workspace fully branded with your hero image, logo & colors

Manage your catalog like a pro — without the price tag.
```

### Trakalog Pro — $25/mo

```
For active producers, small labels, and managers ready to scale.

Everything in Starter, plus:
✓ 1000 tracks · 400 GB storage
✓ Unlimited pitch emails (no monthly cap)
✓ 50 Smart A&R queries per month
✓ 5 workspaces — manage multiple artists, projects, or clients
✓ 5 team members per workspace with granular permissions
✓ Catalog sharing — let labels & managers pitch your tracks under their brand
✓ QR Studio — collect splits & signatures from collaborators in seconds
✓ Export contacts (PDF, CSV, XLSX)
✓ API access

The smart choice for catalog managers who think like a label.
```

### Trakalog Business — $45/mo

```
For labels, publishers, and sync agencies that move serious volume.

Everything in Pro, plus:
✓ Unlimited tracks & 2 TB storage
✓ Unlimited Smart A&R queries
✓ Unlimited workspaces & team members
✓ Priority support with direct line to our team
✓ Custom onboarding for your team

Built to scale with your entire roster.
```

### Trakalog Credits — 25 Pack — $5 (one-time)

```
25 AI credits to power Smart A&R queries, lyrics transcriptions, and Sonic DNA re-analyses.

✓ Use anytime, never expires
✓ 1 credit = 1 Smart A&R query or 1 lyrics transcription
✓ Add-on for Starter, Pro, and Business plans

Top up when inspiration strikes.
```

### Trakalog Credits — 100 Pack — $15 (one-time)

```
100 AI credits to fuel your most active months.

✓ Best value (save 25% vs the 25-pack)
✓ Use anytime, never expires
✓ Works across Smart A&R, lyrics transcriptions, and Sonic DNA re-analyses

Stay ahead without thinking about quotas.
```

### Note : pack 500 crédits — NOT shipped at launch

Le pack 500 crédits ($50) **n'est PAS inclus dans le launch initial**. Décision du 20 mai 2026 pour simplifier le choix utilisateur (2 packs > 3 packs en termes de conversion).

À réévaluer post-launch si l'usage le justifie. Spec de référence pour future implémentation :
- **Prix** : $50 one-time
- **Crédits** : 500
- **Prix/crédit** : $0.10 (50% off vs 25-pack)
- **Marge brute** : 90% (~$5 coût réel)
- **Cible** : labels Business + power users Pro qui consomment massivement
- **Description Stripe (préparée pour usage futur)** :

```
500 AI credits for power users and small teams.

✓ Best price per credit (save 50% vs the 25-pack)
✓ Use anytime, never expires
✓ Perfect for labels running multiple campaigns or A&R-heavy workflows

Bulk-buy and forget about it.
```

### Notes pour audit marketing pré-launch

À revoir avant le launch public :
- Les descriptions seront aussi affichées sur le checkout Stripe — relire avec un œil "premier contact client"
- Considérer d'ajouter des social proofs / témoignages si disponibles
- Tester les descriptions en A/B sur la pricing page Trakalog (qu'on contrôle mieux que Stripe)
- Vérifier que les emojis ✓ s'affichent bien dans tous les contextes Stripe (checkout, factures, customer portal)

---

## 8b. ⚠️ Honnêteté produit — Sonic DNA (note interne CRITIQUE)

**À ne PAS vendre dans les descriptions Stripe ou pricing page tant que ce n'est pas réellement livré et fiable :**

| Feature | Status réel | Vendable ? |
|---|---|---|
| **Mood detection automatique** | ❌ **Retiré de l'UI** (inexact en mineur — produit "dark" sur tracks joyeux) | ❌ **NE PAS vendre** |
| **Détection de structure automatique** | ❌ Retirée (résultats incohérents — tout "chorus" sur tracks high-energy) | ❌ NE PAS vendre |
| **BPM detection** | ✅ Fiable (Essentia + heuristique 80-180) | ✅ OK |
| **Key detection** | ✅ Fiable (24 clés) | ✅ OK |
| **Audio fingerprinting (energy, valence, brightness, warmth, etc.)** | ✅ Stocké en jsonb, usage **backend uniquement** pour Smart A&R | ✅ OK mais "powers Smart A&R" pas "displayed to user" |
| **Sections waveform** | ✅ Mais **manuel** (double-clic user) | ✅ OK comme "manual sections" |
| **Smart A&R matching** | ✅ Utilise le Sonic DNA en backend (BPM + key + audio fingerprint + user metadata) | ✅ OK à vendre |
| **User mood tags manuels** | ✅ 19 presets + custom tags | ✅ OK comme "custom mood tags" |

### Formulations à éviter
- ❌ "Sonic DNA auto-analysis (BPM, key, mood, energy)"
- ❌ "AI-powered mood detection"
- ❌ "Automatic mood tagging"
- ❌ "Auto-detected song structure"

### Formulations correctes
- ✅ **"Sonic DNA: Automatic BPM & key detection + audio fingerprinting that powers Smart A&R matching"** ← format recommandé (réintroduit la marque "Sonic DNA" comme catégorie tout en restant honnête sur ce qui est livré)
- ✅ "Automatic BPM & key detection"
- ✅ "Audio fingerprinting that powers Smart A&R matching"
- ✅ "Smart A&R: AI-powered track matching for briefs"
- ✅ "Custom mood tags you control (19 presets + your own)"
- ✅ "Manual waveform sections (Intro, Verse, Chorus, Drop...)"

**Règle d'or :** "Sonic DNA" peut être utilisé comme **nom de catégorie/marque** dans les descriptions vendeuses, MAIS doit toujours être suivi d'une explication concrète de ce qu'il fait vraiment (BPM, key, audio fingerprinting). Jamais "Sonic DNA" tout seul ou avec mention de mood/structure auto.

### Si on réactive le mood detection un jour
Quand l'algorithme sera corrigé (détection plus fiable sur les tracks en mineur), on pourra réactiver l'affichage UI et ajouter "mood detection" aux descriptions Stripe. Pour l'instant, **toute mention de mood auto est mensongère et doit être évitée**.

---



## 9. Politique commerciale

### Stripe Tax (day one)
Stripe Tax est activé dès le lancement. Calcul automatique de la TVA/sales tax selon la localisation du client. Pas de surprise, conformité automatique dans tous les pays supportés.

### 7-day money-back guarantee
Tout nouveau client peut demander un remboursement complet dans les 7 jours suivant son premier paiement, sans justification. Gère le risque d'achat impulsif et inspire confiance.

### 21-day dunning (Smart Retries Stripe)
En cas d'échec de paiement (carte expirée, fonds insuffisants), Stripe Smart Retries tente automatiquement le paiement plusieurs fois sur 21 jours. Pendant ce délai :
- Le user garde son accès à toutes les features de son plan
- Email automatique d'alerte après chaque échec
- Bouton "Update payment method" visible dans Settings → Billing

Après 21 jours sans paiement → downgrade automatique vers Free.

### Pas de Free Trial Pro initial
Décision : on **n'active pas** de free trial Pro de 14 jours au lancement. Le Free tier sert déjà à tester le produit. Un trial complique la logique de billing et le suivi des conversions. Réévaluable post-launch si conversion < 5%.

### Devise USD
Pricing en USD sur un compte Stripe canadien (Yannick Rastogi Productions Inc.). Stripe convertit en CAD pour les payouts. Permet de viser le marché international (US + Europe) sans surcoût de positioning.

---

## 10. Beta Passes (système de comptes gratuits)

### Objectif
Distribuer manuellement des accès gratuits à des beta testers, influenceurs, partenaires, amis, presse, etc. — sans passer par Stripe.

### Types de pass

| Type | Durée | Plan accordé |
|---|---|---|
| **Lifetime** | Permanent | Pro (par défaut, configurable) |
| **Annual** | 12 mois | Pro (par défaut, configurable) |
| **Monthly** | 1 mois (renouvelable manuellement) | Starter, Pro ou Business |

### Comment ça marche

1. **Admin (Yannick) crée un beta pass** dans l'admin dashboard :
   - Email du destinataire (clé d'identification)
   - Type de pass (lifetime / annual / monthly)
   - Plan accordé (starter / pro / business)
   - Notes internes (ex: "Eliot — beta tester depuis mars")

2. **Le système envoie un email** au destinataire avec un message personnalisé et un lien d'inscription/connexion.

3. **Quand le destinataire crée son compte** (ou se connecte) avec cet email :
   - Le trigger d'auto-création de subscription détecte le pass actif
   - Au lieu de créer une subscription Free, il crée directement une subscription avec le plan accordé
   - `beta_pass_id` est lié à la subscription
   - Le pass passe en status `redeemed`

4. **Pendant la validité du pass** :
   - L'user a accès à toutes les features du plan accordé
   - Pas de Stripe customer/subscription créé (ne coûte rien)
   - Affiché dans Settings → Billing : "You're on a Beta Pro pass — Lifetime"

5. **À l'expiration** (annual/monthly) :
   - Email d'alerte envoyé 7 jours avant expiration
   - Email à l'expiration : "Your beta pass has expired. Continue with a paid plan or downgrade to Free."
   - Downgrade automatique vers Free si pas d'action

### Admin UI (dans Admin Dashboard)

Page "Beta Passes" avec :
- Liste des pass actifs / redeemed / expirés / revoked
- Bouton "Create beta pass" → formulaire
- Filtres : par type, par status, par date
- Actions : revoke, extend (rajouter du temps), resend email
- Stats : total émis, % redeemed, % expiré

---

## 11. Schéma Base de Données

### Table `subscriptions` (NOUVELLE — user-based)

```sql
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'business')),
  billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  subscription_status text DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'incomplete', 'trialing', 'paused')),
  
  -- Stripe IDs
  stripe_customer_id text,
  stripe_subscription_id text,
  
  -- Billing periods
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  trial_ends_at timestamptz,
  
  -- AI Credits
  ai_credits_purchased integer DEFAULT 0,        -- jamais expire
  ai_credits_monthly_used integer DEFAULT 0,     -- reset à chaque renouvellement
  ai_credits_reset_at timestamptz,
  
  -- Usage counters (denormalized for fast checks)
  tracks_uploaded_count integer DEFAULT 0,
  storage_bytes_used bigint DEFAULT 0,
  pitches_sent_this_month integer DEFAULT 0,
  smart_ar_queries_this_month integer DEFAULT 0,
  
  -- Beta pass reference
  beta_pass_id uuid REFERENCES beta_passes(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Table `beta_passes` (NOUVELLE)

```sql
CREATE TABLE public.beta_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  pass_type text NOT NULL CHECK (pass_type IN ('lifetime', 'annual', 'monthly')),
  plan_granted text NOT NULL DEFAULT 'pro' CHECK (plan_granted IN ('starter', 'pro', 'business')),
  granted_by uuid REFERENCES auth.users(id),
  redeemed_by uuid REFERENCES auth.users(id),
  redeemed_at timestamptz,
  expires_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### Table `credit_purchases` (NOUVELLE)

```sql
CREATE TABLE public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  created_at timestamptz DEFAULT now()
);
```

### Trigger : auto-create subscription au signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_pass record;
BEGIN
  -- Check if user has an active beta pass
  SELECT * INTO v_active_pass
  FROM public.beta_passes
  WHERE email = NEW.email AND status = 'active'
  LIMIT 1;

  IF v_active_pass IS NOT NULL THEN
    -- Create subscription with the granted plan
    INSERT INTO public.subscriptions (
      user_id, plan, subscription_status, beta_pass_id,
      current_period_end
    )
    VALUES (
      NEW.id,
      v_active_pass.plan_granted,
      'active',
      v_active_pass.id,
      v_active_pass.expires_at
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Mark pass as redeemed
    UPDATE public.beta_passes
    SET redeemed_by = NEW.id, redeemed_at = now(), status = 'redeemed'
    WHERE id = v_active_pass.id;
  ELSE
    -- Create default Free subscription
    INSERT INTO public.subscriptions (user_id, plan, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();
```

### Trigger : sync usage counters (tracks_uploaded_count + storage_bytes_used)

À chaque INSERT/DELETE sur `tracks`, met à jour les compteurs dans `subscriptions` pour l'uploader. Permet des checks rapides sans agréger les tracks en live.

### RPC : `check_upload_allowed(file_size_bytes)`

Vérifie en une seule fonction si l'user peut uploader :
1. Tracks count < plan.tracks_max
2. Storage_bytes_used + file_size_bytes < plan.storage_max

Retourne JSON `{ allowed: boolean, reason?: string, current?: number, max?: number, plan?: string }`.

### RPC : `get_my_subscription()`

Retourne la subscription complète de l'user authentifié (utilisée par le frontend pour afficher le plan, les compteurs, les crédits, etc.).

### Colonnes à ajouter sur `tracks`

```sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS file_size_bytes bigint DEFAULT 0;
```

Nécessaire pour le check storage. À backfiller depuis Supabase Storage metadata pour les tracks existants.

### Note sur `workspaces`

**Aucune colonne `plan` n'est ajoutée sur `workspaces`.** Les features workspace-level (watermarking, branding, catalog_sharing, qr_studio, members_max) sont déterminées en runtime via une lookup sur la subscription du **owner du workspace** : `workspaces.owner_id → subscriptions.user_id → subscriptions.plan`.

Pour éviter les jointures à chaque check, on peut éventuellement ajouter une colonne dénormalisée `owner_plan_cached` mise à jour par trigger quand l'owner change de plan — mais à décider à l'implémentation selon les besoins de perf.

---

## 12. Limites par plan (config TypeScript)

```typescript
// src/lib/plans.ts

export const PLAN_LIMITS = {
  free: {
    // Uploads
    tracks_max: 10,
    storage_max_bytes: 1_610_612_736,        // 1.5 GB
    
    // Actions
    pitches_max_monthly: 0,
    smart_ar_queries_monthly: 0,
    shared_links_max: 1,
    contacts_max: 10,
    
    // Workspace features
    workspaces_max: 1,
    members_max: 1,
    
    // Feature flags
    stems_enabled: false,                    // GRISÉ avec upgrade prompt
    watermarking: false,
    leak_tracing: false,
    branding: false,
    splits: false,
    radio: false,
    export_contacts: false,
    catalog_sharing: false,
    qr_studio: false,
    api_access: false,
    custom_branding_on_shared_links: false,
    
    // AI Credits
    ai_credits_purchase_enabled: false,
  },
  starter: {
    tracks_max: 100,
    storage_max_bytes: 42_949_672_960,       // 40 GB
    pitches_max_monthly: 15,
    smart_ar_queries_monthly: 15,
    shared_links_max: -1,                    // -1 = illimité
    contacts_max: -1,
    workspaces_max: 1,
    members_max: 1,
    stems_enabled: true,
    watermarking: true,
    leak_tracing: true,
    branding: true,
    splits: true,
    radio: true,
    export_contacts: false,
    catalog_sharing: false,
    qr_studio: false,
    api_access: false,
    custom_branding_on_shared_links: true,
    ai_credits_purchase_enabled: true,
  },
  pro: {
    tracks_max: 1000,
    storage_max_bytes: 429_496_729_600,      // 400 GB
    pitches_max_monthly: -1,
    smart_ar_queries_monthly: 50,
    shared_links_max: -1,
    contacts_max: -1,
    workspaces_max: 5,
    members_max: 5,
    stems_enabled: true,
    watermarking: true,
    leak_tracing: true,
    branding: true,
    splits: true,
    radio: true,
    export_contacts: true,
    catalog_sharing: true,
    qr_studio: true,
    api_access: true,
    custom_branding_on_shared_links: true,
    ai_credits_purchase_enabled: true,
  },
  business: {
    tracks_max: -1,
    storage_max_bytes: 2_199_023_255_552,    // 2 TB
    pitches_max_monthly: -1,
    smart_ar_queries_monthly: -1,
    shared_links_max: -1,
    contacts_max: -1,
    workspaces_max: -1,
    members_max: -1,
    stems_enabled: true,
    watermarking: true,
    leak_tracing: true,
    branding: true,
    splits: true,
    radio: true,
    export_contacts: true,
    catalog_sharing: true,
    qr_studio: true,
    api_access: true,
    custom_branding_on_shared_links: true,
    ai_credits_purchase_enabled: true,
  },
};
```

---

## 13. Architecture Stripe

### Produits Stripe à créer (en mode TEST d'abord)

```
Products:
  - trakalog_starter
    - Price: $10/month (recurring)
    - Price: $90/year (recurring)
  - trakalog_pro
    - Price: $25/month (recurring)
    - Price: $225/year (recurring)
  - trakalog_business
    - Price: $45/month (recurring)
    - Price: $405/year (recurring)
  - trakalog_credits_25
    - Price: $5 (one-time)
  - trakalog_credits_100
    - Price: $15 (one-time)
  - trakalog_credits_500
    - Price: $50 (one-time)
```

### Configuration Stripe

- **Stripe Tax** : activé day one
- **Customer Portal** : activé avec changement de plan, changement de cycle, mise à jour CB, annulation, factures
- **Smart Retries** : activé (21 jours)
- **Tax IDs** : collecte activée pour les business
- **Devise** : USD (compte canadien acceptant paiements USD)

### Flow d'abonnement

```
User clique "Upgrade" sur la pricing page
  → create-checkout-session Edge Function (avec user_id et price_id)
    → Stripe Checkout Session (hosted)
      → Paiement CB / Apple Pay / Google Pay
        → Webhook Stripe → stripe-webhook Edge Function
          → Met à jour subscriptions.plan
          → Met à jour subscriptions.stripe_customer_id, stripe_subscription_id
          → Met à jour subscriptions.current_period_start/end
          → Reset ai_credits_monthly_used = 0
          → Audit log + notification
  → Redirect vers app.trakalog.com/settings?billing=success
```

### Flow d'achat de crédits

```
User clique "Buy 100 credits" dans Settings → Billing
  → create-checkout-session (mode: one-time, product: credits_100)
    → Stripe Checkout Session
      → Paiement
        → Webhook Stripe → stripe-webhook
          → Incrémente subscriptions.ai_credits_purchased += 100
          → Insert credit_purchases (user_id, amount, price_cents, stripe_payment_intent_id)
          → Audit log
  → Toast "100 credits added to your account"
```

### Flow de gestion (portail client)

```
User clique "Manage Subscription" dans Settings → Billing
  → create-portal-session Edge Function
    → Stripe Customer Portal
      → Changer de plan / cycle / CB / annuler / voir factures
        → Webhooks Stripe notifient les changements
          → stripe-webhook met à jour subscriptions en DB
```

### Edge Functions à créer

| Fonction | Rôle |
|---|---|
| **stripe-webhook** | Reçoit les événements Stripe, met à jour la DB |
| **create-checkout-session** | Crée une session Checkout pour abonnement ou crédits |
| **create-portal-session** | Crée une session Customer Portal pour gestion |

### Événements Stripe à gérer dans le webhook

| Événement | Action |
|---|---|
| `checkout.session.completed` | Mode subscription : update plan. Mode payment : add credits. |
| `customer.subscription.created` | Set stripe_subscription_id, current_period_start/end |
| `customer.subscription.updated` | Update plan, billing_cycle, status |
| `customer.subscription.deleted` | Downgrade vers free, set canceled_at |
| `invoice.paid` | Renew period, reset ai_credits_monthly_used |
| `invoice.payment_failed` | Set subscription_status = 'past_due', send email |

### Secrets Supabase à ajouter

```
STRIPE_SECRET_KEY        — clé secrète Stripe (sk_test_* ou sk_live_*)
STRIPE_WEBHOOK_SECRET    — secret pour vérifier les webhooks
STRIPE_PUBLISHABLE_KEY   — clé publique (aussi dans le frontend via VITE_STRIPE_PUBLISHABLE_KEY)
```

---

## 14. Frontend — Pages et composants

### Pricing Page (`/pricing`)
- 4 colonnes : Free / Starter / Pro (highlighted) / Business
- Toggle mensuel/annuel (annuel par défaut, badge "Save 25%")
- Feature comparison table en dessous
- CTA "Get Started" (Free) / "Upgrade" (payants) par plan
- Si déjà abonné → le plan actuel a un badge "Current Plan"
- Section Stripe Tax notice : "Prices exclude tax — calculated at checkout"
- Section comparative vs Postal : "Why pay $45 elsewhere for less?"

### Settings → Billing (nouvelle section)
- **Plan actuel** + statut (avec icône verte/rouge)
- **Prochaine facturation** (date + montant)
- Bouton **"Change Plan"** → pricing page
- Bouton **"Manage Subscription"** → Stripe Customer Portal
- **Usage actuel** :
  - "X/100 tracks used"
  - "X/40 GB storage used" (barre de progression)
  - "X/15 Smart A&R queries this month"
  - "X/15 pitches sent this month"
- **AI Credits** : solde actuel (monthly remaining + purchased) + bouton "Buy Credits"
- **Historique des factures** (via Stripe Portal)

### Pricing Page — Stems Free section
Sur la colonne Free, afficher "Stems" avec une croix grisée et un mini tooltip "Stems are available from Starter plan" pour expliquer la limitation.

### Upgrade Prompts contextuels (dans l'app)

| Trigger | Modal |
|---|---|
| Upload 11ème track sur Free | "Upgrade to Starter to upload up to 100 tracks" |
| Essayer de pitcher sur Free | "Upgrade to Starter to send pitches" |
| Cliquer sur l'onglet Stems (Free) | "Stems are available from Starter — Upgrade to unlock" |
| 16ème Smart A&R query du mois (Starter) | "You've used all your Smart A&R queries. Buy credits or upgrade to Pro" |
| Essayer de créer un 2ème workspace (Free/Starter) | "Upgrade to Pro for up to 5 workspaces" |
| Essayer d'inviter un membre (Free/Starter) | "Upgrade to Pro to invite team members" |
| Storage à 90% | Banner "You're at 36 GB / 40 GB. Upgrade to Pro for 400 GB" |

### Credit Balance Display
- Dans le header (icône cerveau) ou dans Smart A&R : "X queries remaining this month"
- Dans Settings → Billing : solde complet (monthly + purchased séparés)
- Low credit warning : notification quand < 20% du quota mensuel

---

## 15. Enforcement des limites

### Côté frontend (UX)
- Vérifier les limites **AVANT** l'action (pas après l'upload)
- Afficher un compteur sur les pages concernées ("3/100 tracks")
- Griser les boutons des features non incluses dans le plan (avec tooltip "Upgrade to unlock")
- Modal d'upgrade avec comparatif ciblé

### Côté backend (sécurité — RPCs et Edge Functions)
Les RPCs et Edge Functions critiques doivent vérifier les limites :

| Action | Check |
|---|---|
| `insert_track` (RPC) | `check_upload_allowed(file_size)` → tracks_count + storage |
| `insert_stem` (nouveau check à ajouter) | Vérifier `stems_enabled` sur le plan de l'uploader |
| `create_pitch` (RPC) | Vérifier `pitches_sent_this_month` < plan.pitches_max_monthly |
| `create_workspace_with_member` (RPC) | Vérifier `workspaces_count` < plan.workspaces_max |
| Smart A&R Edge Function | Vérifier crédits disponibles (monthly OU purchased > 0) |
| Add member RPC | Vérifier `members_count` < plan.members_max sur le workspace |

Si la limite est atteinte → retourner une erreur structurée :
```json
{
  "error": "plan_limit_reached",
  "limit_type": "tracks" | "storage" | "pitches" | ...,
  "current": 10,
  "max": 10,
  "plan": "free",
  "upgrade_to": "starter"
}
```

Le frontend catch cette erreur et affiche le modal d'upgrade approprié.

### Reset mensuel des quotas
- Géré par le webhook Stripe `invoice.paid` : à chaque renouvellement, reset `ai_credits_monthly_used = 0`, `pitches_sent_this_month = 0`, `smart_ar_queries_this_month = 0`
- Pour les users Free : reset par cron mensuel (pg_cron) ou trigger sur `ai_credits_reset_at`

---

## 16. Migration des utilisateurs existants

### Beta users (avant le launch Stripe)
Tous les comptes créés avant la mise en prod de Stripe reçoivent automatiquement un **Beta Pass Lifetime Pro** :
- Au moment du déploiement, script SQL qui crée un beta_pass `pass_type='lifetime'`, `plan_granted='pro'` pour chaque user existant
- Le trigger d'inscription rétroactif (à exécuter manuellement) lie ces passes à leurs subscriptions
- Message dans Settings → Billing : "You're on the Beta Pro Lifetime — all Pro features unlocked forever. Thank you for testing Trakalog!"

### Nouveaux comptes (après le launch Stripe)
- Inscription → plan Free automatique
- Onboarding mentionne les plans payants mais **pas de trial automatique** (cf. section 8)
- Le user upgrade quand il veut via Settings → Billing

---

## 17. Phases d'implémentation

### Phase 1 — Setup DB + Stripe (1-2 sessions)
1. Migration SQL : tables `subscriptions`, `beta_passes`, `credit_purchases`
2. Trigger `handle_new_user_subscription` + backfill users existants
3. Trigger `sync_subscription_usage` sur `tracks`
4. RPCs : `get_my_subscription`, `check_upload_allowed`
5. Colonne `file_size_bytes` sur `tracks` + backfill
6. Création Products + Prices Stripe (mode test) avec nouveaux prix $10/$25/$45
7. Activation Stripe Tax + Customer Portal + Smart Retries

### Phase 2 — Edge Functions Stripe (1 session)
8. Edge Function `create-checkout-session`
9. Edge Function `create-portal-session`
10. Edge Function `stripe-webhook` (avec tous les événements)
11. Configuration des secrets Supabase
12. Test du flow end-to-end en mode test

### Phase 3 — Frontend Billing (1-2 sessions)
13. Fichier `src/lib/plans.ts` avec `PLAN_LIMITS`
14. Page `/pricing` (4 colonnes, toggle annuel/mensuel)
15. Section "Billing" dans Settings (plan actuel, usage, manage, buy credits)
16. Boutons Upgrade → Stripe Checkout
17. Boutons Manage → Stripe Portal

### Phase 4 — Enforcement (1-2 sessions)
18. Mise à jour des RPCs critiques (insert_track, create_pitch, etc.)
19. Compteurs dans le frontend
20. Modals d'upgrade contextuels quand limite atteinte
21. Grisage UI des features non incluses (Stems, etc.)
22. Storage usage bar + warnings

### Phase 5 — Beta Passes (1 session)
23. Page admin "Beta Passes" (création, liste, revoke, extend)
24. Email envoyé au destinataire
25. Email d'alerte avant expiration (cron)
26. Script de migration des beta users existants → Lifetime Pro passes

### Phase 6 — Migration Cloudflare R2 (CRITIQUE avant launch public)
27. Setup compte Cloudflare R2
28. Migration des buckets Supabase Storage → R2 (tracks, stems, covers)
29. Update Edge Functions pour utiliser R2 SDK
30. Mise à jour des signed URLs (R2 + Cloudflare Workers pour auth)
31. Test exhaustif streaming + uploads + downloads
32. **Sans cette migration, les marges Pro/Business sont 30-40% inférieures**

### Phase 7 — Go Live (1 session)
33. Passer Stripe en mode production
34. Test du flow complet end-to-end en production avec une vraie CB
35. Activer le 7-day money-back guarantee dans les CGU
36. Communication aux beta users (email de bienvenue Lifetime Pro)

---

## 18. Risques et mitigations

| Risque | Mitigation |
|---|---|
| User contourne les limites frontend | Enforcement côté RPC (backend) — impossible à contourner |
| Webhook Stripe échoue | Retry automatique Stripe (jusqu'à 3 jours) + logs dans audit_logs + alerte admin |
| User annule et veut garder ses tracks | Les tracks restent accessibles en lecture seule sur Free, mais pas de nouvelles uploads au-delà de 10 + 1.5 GB |
| Downgrade avec plus de tracks que la limite | Les tracks existants restent, mais bloque les nouveaux uploads tant que count > limite |
| Abus du Beta Pass | 1 pass par email, status `redeemed` une fois utilisé, admin peut revoke |
| Double charge | Stripe gère nativement la déduplication des webhooks |
| Storage limit dépassé entre 2 sync triggers | Le check `check_upload_allowed` fait un live check avant upload, pas juste le compteur cached |
| User invité Free qui consomme trop le workspace Pro du owner | Impossible : chaque user a ses propres quotas, pas de pool partagé |
| Free user qui crée 50 comptes pour bypass | Email verification obligatoire + détection de patterns (futur) |
| Postal baisse ses prix après notre launch | Marges nettes confortables (85%+) nous permettent de baisser de $2-3 sans casser le business |
| Migration Cloudflare R2 cassée | Tests exhaustifs en staging avant migration prod + rollback plan documenté |

---

## 19. KPIs à tracker (dans Admin Dashboard)

- **MRR** (Monthly Recurring Revenue) — total et par plan
- **ARR** (Annual Recurring Revenue)
- **ARPU** (Average Revenue Per User)
- **Conversion Free → Paid** (cible : 5-10%)
- **Conversion Starter → Pro** (cible : 20-30%)
- **Plan distribution** (% Free / Starter / Pro / Business)
- **Churn rate** mensuel (cible : < 5%)
- **AI Credits achetés / mois** (revenue additionnel)
- **LTV** (Lifetime Value = ARPU / Churn Rate)
- **CAC** (Customer Acquisition Cost — quand tu fais du marketing)
- **Beta Pass redemption rate** (% des pass envoyés effectivement utilisés)
- **Storage usage moyen par plan** (pour valider que les limites sont confortables)
- **Trial / Money-back refund rate** (cible : < 3%)
- **Marge nette par plan** (validation post-Cloudflare R2)

---

## 20. Décisions figées (changelog v3.1)

### Changements v3 → v3.1 (20 mai 2026, post-réflexion descriptions)

1. **Smart A&R Starter passé de 10 → 15 queries/mois** : matche les 15 pitches inclus (logique "1 query Smart A&R = 1 pitch potentiel"). Coût additionnel négligeable (~$0.15/user/mois), marge nette ajustée 88.7% → 87.2% (toujours excellente).
2. **Section 8 ajoutée : Descriptions Stripe vendeuses** prêtes à coller dans le Dashboard Stripe (5 descriptions au launch — 3 plans + 2 packs crédits, descriptions condensées <500 caractères pour limite Stripe).
3. **Section 8b ajoutée : Honnêteté produit Sonic DNA** — note interne CRITIQUE sur ce qu'il est honnête de vendre vs ce qui a été retiré de l'UI (mood detection auto, détection de structure auto). À relire avant tout audit marketing.
4. **API access retiré des descriptions Stripe** : pas encore implémenté, on ne le vend pas. La feature reste prévue pour le Business tier (et potentiellement Pro). À ajouter aux descriptions le jour de la livraison.
5. **Pack 500 crédits NOT shipped at launch** : décision simplification UX (2 packs > 3 packs pour la conversion). Spec préservée pour ajout post-launch si l'usage le justifie.
6. **Sonic DNA gardé comme marque produit** : format vendeur retenu = "Sonic DNA: Automatic BPM & key detection + audio fingerprinting that powers Smart A&R matching" (marque + explication honnête).

### Changements v2 → v3 (20 mai 2026, post-analyse Postal)

Cette section résume **les changements par rapport à la v2** du doc, validés en session du 20 mai 2026 après analyse compétitive Postal :

### Changements de pricing
1. **Free passé de 5 → 10 tracks** : matcher psychologiquement Postal Free (25 tracks) sans aller jusqu'à 25
2. **Free storage passé de 1 GB → 1.5 GB** : éviter la frustration à exactement 10 tracks WAV à 100 MB
3. **Starter passé de $14 → $10/mois** : battre Postal Artist ($8) sur la valeur (+$2 mais 10x plus de features)
4. **Pro passé de $29 → $25/mois** : battre Postal Plus ($20) sur la valeur (+$5 mais features majeures)
5. **Business passé de $59 → $45/mois** : égaler Postal Pro ($45) au centime, avec 10x plus de features
6. **Annuel passé de 20% off → 25% off** : push plus agressif, justifié par marges nettes 85%+ post-R2
   - Starter annuel : $132 → **$90** ($7.50/mois équiv)
   - Pro annuel : $276 → **$225** ($18.75/mois équiv)
   - Business annuel : $564 → **$405** ($33.75/mois équiv)

### Ajouts
7. **Section 5 "Marges nettes détaillées (post-Cloudflare R2)"** : calculs complets par plan, mensuel et annuel
8. **Phase 6 "Migration Cloudflare R2"** ajoutée comme critique avant launch public (passe les marges Pro/Business de 50-60% à 70-86%)
9. **Comparatif Postal explicite** dans chaque description de plan
10. **Risque "Postal baisse ses prix"** ajouté avec mitigation
11. **KPI "Marge nette par plan"** ajouté pour validation post-R2

### Maintenu de v2
- Architecture user-based (`subscriptions.user_id`)
- Stems = feature premium grisée sur Free
- Règle double check upload (tracks count + storage)
- Beta Passes système complet (Lifetime / Annual / Monthly)
- Stripe Tax day one
- 7-day money-back guarantee
- 21-day Smart Retries dunning
- Pas de Free Trial Pro
- Beta users existants → Lifetime Pro Beta Pass
- AI Credits packs ($5/$15/$50 pour 25/100/500) — inchangé

---

*Ce document est la source de vérité v3 pour l'implémentation du billing Trakalog. Toute décision contradictoire avec ce doc doit déclencher une mise à jour explicite (v4, v5, etc.).*
