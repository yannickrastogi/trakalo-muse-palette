# TRAKALOG — Billing & Payment System (Stripe)

> **Version :** 4.0 · **Réécrit le :** 20 juillet 2026
> **Remplace :** toutes les versions antérieures (l'ancien doc décrivait un pricing $14/$29/$59 workspace-based — **périmé**).
> **Statut :** Spécification validée, prête à implémenter.
> **Priorité :** Bloquant pré-launch.

> ⚠️ **Source de vérité.** Ce document prime sur toute mémoire ou ancienne version. Les prix, limites et le modèle de sièges ci-dessous sont **définitifs** (décisions du 20 juillet 2026). Ne pas recoder d'ancienne logique.

---

## 1. Architecture (à lire avant tout code)

**Abonnements user-based.** Un utilisateur = un abonnement (table `subscriptions`, clé `user_id`). Pas de plan au niveau du workspace.

- **Quotas personnels** (tracks, storage, Smart A&R) → suivent l'**uploader**. C'est le total du catalogue de l'utilisateur à travers *tous* ses workspaces, pas un cap par workspace.
- **Features workspace** (branding, watermarking, catalog sharing, sièges, nombre de workspaces) → suivent le **plan du owner** du workspace.
- Conséquence : un user Free invité dans un workspace Pro accède au workspace, mais reste limité par *ses propres* quotas Free pour ses uploads/actions.

**Modèle de sièges = « Figma pour catalogues musicaux ».** Le coût de Trakalog suit l'*action*, pas la présence (un viewer coûte ~0 ; un editor/admin qui upload + déclenche Sonic DNA/Smart A&R coûte du R2 + de l'AI). Donc le prix se calque sur les niveaux d'accès :

| Rôle d'accès | Facturation |
|---|---|
| **Viewer** | Gratuit, illimité (Pro/Business). Consulte, écoute. |
| **Pitcher / Editor / Admin** | = **1 siège actif**. C'est ce qui compte contre la limite du plan. |
| **Owner** | Compte comme 1 siège actif. |
| **Destinataire d'un lien partagé** | Jamais membre, jamais compté. |

> Le modèle « dual Personal + Team » à la GitHub a été **abandonné** (il ne colle pas à Trakalog — un collaborateur qui rejoint un label n'a pas de « vie perso » Trakalog parallèle). À ne pas ressortir.

---

## 2. Grille de prix

Tous les prix en **USD**. Rabais annuel **25 %**.

| | Free | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|---|
| **Mensuel** | $0 | $10 | $25 | $45 | Contact us |
| **Annuel** | — | $90 | $225 | $405 | Contact us |
| **Tracks** | 10 | 100 | 1 000 | 5 000 | Custom |
| **Storage** | 1,5 GB | 40 GB | 400 GB | 2 TB | Custom |
| **Playlists** | 1 | ∞ | ∞ | ∞ | ∞ |
| **Shared links** | 1 (branding Trakalog) | ∞ | ∞ | ∞ | ∞ |
| **Smart A&R** | 2 à vie | 15/mois | 50/mois | 500/mois | Custom |
| **Lyrics** | Affichage seul | Transcription auto | Transcription auto | Transcription auto | ✅ |
| **Workspaces** | 1 | 1 (solo) | 5 | 15 | Custom |
| **Sièges actifs** | — | solo strict | 5 inclus (owner+4) | 10 inclus (owner+9) | Custom |
| **Siège additionnel** | — | — | $10/siège/mois | $10/siège/mois | Custom |
| **Viewers gratuits** | — | — | ∞ | ∞ | ∞ |
| **Achat de crédits** | ❌ | ✅ | ✅ | ✅ | ✅ |

---

## 3. Cartes client (copy validée, EN)

### FREE — $0
*Get started — no credit card required.*
**For creators trying out Trakalog and sharing their first tracks.**

- **Catalog & storage** — 10 tracks · 1.5 GB storage · full metadata management (credits, genre, tags, BPM & key)
- **Sharing** — 1 playlist · 1 shared link (Trakalog branding) · password protection & expiry controls · 10 contacts
- **A&R intelligence** — 2 Smart A&R queries (lifetime) — try it once, on us
- **Sonic DNA** — automatic BPM & key detection + audio fingerprinting
- **Lyrics** — lyrics display
- **Trakalog Radio** — your own on-demand streaming platform for your catalog

**Not included — upgrade to Starter :** per-track stems · invisible watermarking & leak tracing · custom-branded links · automatic lyrics transcription · splits & digital signatures · QR Studio · unlimited playlists & shared links

---

### STARTER — $10/month
*billed monthly · or $90/year (save 25%)*
**For independent creators — solo artists, beatmakers, and songwriters managing their own catalog.**

- **Catalog & storage** — 100 tracks · 40 GB storage cap (tracks + stems + documents) · per-track stem storage · full metadata management (all standard music-industry credits, genre, tags, BPM & key, and more)
- **Sharing & distribution** — unlimited playlists · unlimited shared links · custom-branded links (logo, hero & colors) · password protection & expiry controls
- **Protection** — invisible audio watermarking · leak tracing
- **A&R intelligence** — 15 Smart A&R queries / month
- **Lyrics** — automatic lyrics transcription
- **Rights management** — splits & digital signatures · QR Studio (instant split signing with collaborators)
- **Contacts** — unlimited contacts · automatic contact capture
- **Trakalog Radio** — your own on-demand streaming platform for your catalog

**Not included — available in Pro :** multi-workspaces with multiple collaborators · cross-workspace catalog sharing · Trakalog Access (marketplace) · contact export (CSV / XLSX / PDF)

*Note : Starter = solo strict. Aucun membre invité dans le workspace (ni editor, ni pitcher, ni viewer). Le partage externe (liens) reste évidemment inclus.*

---

### PRO — $25/month
*billed monthly · or $225/year (save 25%)*
**For active producers, managers, and small labels running a catalog with a team.**

**Everything in Starter, plus —**

- **Scale** — 1,000 tracks · 400 GB storage cap (tracks + stems + documents) · 50 Smart A&R queries / month
- **Team & workspaces** — up to 5 workspaces · 5 active seats included (owner + 4) — editors, admins · unlimited free viewers · add active seats anytime — $10/seat/month
- **Collaboration & business** — cross-workspace catalog sharing · Trakalog Access — the marketplace: put your tracks in front of execs, and browse other creators' catalogs to find the song you need · contact export (CSV / XLSX / PDF)

**Not included — available in Business :** more tracks, workspaces & active seats · higher Smart A&R limits · priority support

---

### BUSINESS — $45/month
*billed monthly · or $405/year (save 25%)*
**For labels, publishers, and sync agencies managing large catalogs and teams.**

**Everything in Pro, plus —**

- **Scale** — 5,000 tracks · 2 TB storage cap (tracks + stems + documents) · 500 Smart A&R queries / month
- **Team & workspaces** — up to 15 workspaces · 10 active seats included (owner + 9) — editors, admins · unlimited free viewers · add active seats anytime — $10/seat/month
- **Support** — priority support

**Need more? → Enterprise (Contact us)** — SSO/SAML, custom limits, SLA, dedicated support

---

### ENTERPRISE — Contact us
Pas de prix Stripe. Colonne « Contact us » sur la pricing page. Pour les majors / gros catalogues (50k+ tracks).
Réservé : SSO/SAML, limites custom, SLA, CSM dédié, facturation sur PO. **Aucune de ces briques n'est construite** — c'est du sales-led, pas du self-serve.

---

## 4. Modèle de sièges (détail)

- **Free & Starter = solo.** Owner uniquement, aucun autre membre dans le workspace.
- **Pro & Business = équipe.** Owner + sièges actifs inclus + **viewers gratuits illimités**.
- **1 siège actif** = un membre Pitcher, Editor ou Admin (mappé sur les access levels existants : Viewer / Pitcher / Editor / Admin).
- **Owner** = 1 siège actif (compté dans les inclus).
- **Sièges additionnels** au-delà des inclus : **$10/siège/mois**, prix unique sur toute la plateforme (= le prix d'une licence Starter). Prorata natif Stripe à l'ajout/retrait.
- **Les limites (tracks, storage, Smart A&R) restent par utilisateur/workspace, pas par siège.** Un siège en plus = une personne de plus qui agit dans le pool existant, ça n'augmente pas les quotas. Un workspace trop gros pour son pool → trigger d'upgrade vers le tier au-dessus.

---

## 5. AI Credits (add-on)

Modèle volontairement **simple** :

- **1 crédit = 1 Smart A&R query** au-delà du quota mensuel du plan. C'est **la seule chose** que les crédits achètent aujourd'hui.
- **Packs :** 25 crédits **$5** · 100 crédits **$15**. *(Le pack 500 est reporté post-launch.)*
- **Les crédits achetés n'expirent jamais.**
- **Le quota mensuel Smart A&R** (15/50/500) **reset chaque mois** et ne s'accumule pas. Ordre de consommation : quota mensuel d'abord, puis crédits achetés.
- **Le Free ne peut pas acheter de crédits** (réservé aux plans payants). Après ses 2 queries à vie → mur → upgrade.
- Phrase de vente : *« Your plan includes your monthly Smart A&R matches. Need more? Top up with credits that never expire. »*

> Quand une nouvelle feature IA payante sortira (ex. génération de stems), on l'ajoutera **à ce moment-là** aux coûts en crédits. On ne liste rien qui n'existe pas.

**Transcription lyrics (Starter+, incluse, pas un coût crédit).** Whisper via Groq, ~$0.01/track → négligeable, et self-limiting (seules les tracks avec voix la déclenchent). Mais comme elle est déclenchée à la demande, elle **doit avoir un rate-limit anti-abus** (cf. §8bis) pour empêcher la re-transcription répétée de la même track.

---

## 6. Mécaniques de facturation

- **Rabais annuel :** 25 % (afficher l'annuel par défaut sur la pricing page, toggle mensuel, badge « Save 25% »).
- **Stripe Tax** activé dès le day one (TVA/sales tax auto selon la localisation).
- **7-day money-back guarantee** sur le premier paiement, sans justification.
- **Proration :** immédiate à l'upgrade, fin de cycle au downgrade.
- **Dunning :** Stripe Smart Retries sur 21 jours avant downgrade vers Free.
- **Beta Passes :** table `beta_passes` (accès à vie / annuel / mensuel par email, plan accordé, expiry). Le trigger `handle_new_user_subscription` crée la sub au bon plan à l'inscription si un pass actif existe pour l'email.
- **Downgrade avec dépassement :** les tracks/données existants restent en lecture ; pas de nouvel upload tant que le count dépasse la limite du nouveau plan.

---

## 7. Stripe — produits & prix

**Produits d'abonnement (recurring) :**
- `trakalog_starter` — $10/mo · $90/yr
- `trakalog_pro` — $25/mo · $225/yr
- `trakalog_business` — $45/mo · $405/yr

**Siège additionnel (recurring, quantité) :**
- `trakalog_seat_addon` — **$10/seat/mo** → **⚠️ à créer** (nouveau, issu de la décision du 20 juillet ; n'existait pas dans les 8 prix précédents)

**Crédits (one-time) :**
- `trakalog_credits_25` — $5
- `trakalog_credits_100` — $15

> Les 8 Price IDs déjà créés en mode test doivent être **vérifiés** contre cette grille ($10/$25/$45 + 2 packs). Ajouter le prix `trakalog_seat_addon`. Enterprise = pas de prix.

**Edge Functions à créer (aucune n'existe aujourd'hui) :**
- `stripe-webhook` — checkout.session.completed, customer.subscription.updated/deleted, invoice.paid (reset quota mensuel), invoice.payment_failed
- `create-checkout-session` — abo ou pack de crédits
- `create-portal-session` — Stripe Customer Portal

**Secrets Supabase :** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`.

---

## 8. État réel d'implémentation (scan DB du 20 juillet)

**En place ✅**
- Tables `subscriptions` (user-based, avec compteurs), `beta_passes`, `credit_purchases`.
- `handle_new_user_subscription` — attribue le plan à l'inscription (beta pass → plan accordé, sinon Free).
- `sync_subscription_usage` — maintient `tracks_uploaded_count` + `storage_bytes_used` à l'insert/delete de track.
- RLS : `subscriptions`/`credit_purchases` en SELECT-own uniquement → **le plan n'est pas falsifiable côté client**.

**Manquant ❌ (le vrai travail restant)**
1. **Aucune plomberie Stripe** (0 Edge Function, 0 stripe_customer). Aucun paiement possible aujourd'hui.
2. **Aucun enforcement de limites** dans les RPC (`insert_track`, `create_pitch`, `create_workspace_with_member`, EF `smart-ar`) → les plans sont cosmétiques tant que ce n'est pas codé.
3. **Compteurs `pitches_sent_this_month` et `smart_ar_queries_this_month` jamais incrémentés** → triggers/RPC à ajouter.
4. **Config des limites côté serveur** (source de vérité `plan → tracks_max/…`) à poser.
5. **Modèle de sièges** (viewer gratuit / pitcher-editor-admin = siège / add-on) : pas encore reflété dans le schéma — à concevoir.
6. **Détail :** trigger `prevent_client_plan_change` est branché sur `workspaces` (colonne `plan` legacy), pas sur `subscriptions` — à déplacer (non bloquant, la RLS protège déjà).

---

## 8bis. Garde-fous anti-abus (à installer AVEC l'enforcement)

> **Principe directeur :** tout quota ou action à coût variable doit avoir un **garde-fou anti-abus (rate-limit + cap)**, pas seulement une limite de plan. Une limite de plan empêche de dépasser son quota ; un rate-limit empêche de marteler une action pour nuire (coût, spam, DoS) même *dans* le quota.

À implémenter en même temps que l'enforcement Stripe :

1. **Rate-limit sur la transcription lyrics.** Déclenchée à la demande → empêcher la re-transcription répétée abusive de la même track (ex. cap X/track/jour + cooldown). Le coût unitaire est négligeable (~$0.01), mais un marteau 10 000× reste un vecteur d'abus.
2. **Rate-limit sur Smart A&R et toutes les actions IA**, y compris au-delà du quota mensuel / sur crédits achetés.
3. **Enforcement des limites de plan côté backend/RPC** : `insert_track` (tracks_max), `create_pitch` (pitches_max), `create_workspace_with_member` (workspaces_max), EF `smart-ar` (quota + crédits). Aujourd'hui : **aucun enforcement**, les plans sont cosmétiques. Erreur explicite `plan_limit_reached` → le front catch et affiche le modal d'upgrade.
4. **Brancher les compteurs** `pitches_sent_this_month` et `smart_ar_queries_this_month` (jamais incrémentés actuellement) — triggers/RPC. Reset mensuel via le webhook `invoice.paid`.
5. **Config des limites de plan** comme source de vérité serveur (table/fonction `plan_limits`), pas en dur côté front.
6. **Rate-limiting infra** déjà en place sur les Edge Functions (18/18) — vérifier que les EF payantes (smart-ar, transcribe-lyrics) l'appliquent bien par user.

---

## 9. Product honesty (à respecter dans toute la copy)

- **Pas** de mood detection ni d'auto structure detection dans le marketing (retirés de l'UI, inexacts).
- **Sonic DNA** = moteur interne. Formulation autorisée : *« Automatic BPM & key detection + audio fingerprinting that powers Smart A&R matching »*. Pas une section user-facing.
- **Pas d'API access** dans les plans (non construit).
- **Brief Seeker / Artist Seeker / génération de stems** : non construits → **absents des cartes**. À ajouter au lancement de chaque feature.
- **Enterprise** : SSO/SAML/SOC2/SLA non construits → sales-led uniquement.

---

## 10. Changelog vs ancienne version

- Prix : ~~$14/$29/$59~~ → **$10/$25/$45** (révisé après analyse Postal.music, 20 mai ; reconfirmé).
- Archi : ~~workspace-based~~ → **user-based**.
- Modèle équipe : ~~5 membres à plat~~ → **sièges actifs (Figma) + viewers gratuits + add-on $10**.
- Free : **10 tracks / 1,5 GB / 1 playlist / 1 lien / 2 Smart A&R à vie** ; pas d'achat de crédits.
- Starter : **solo strict** ; transcription lyrics ajoutée.
- AI Credits : ~~3 packs, multi-actions~~ → **2 packs, 1 crédit = 1 Smart A&R** uniquement.
- Rabais annuel : ~~21 %~~ → **25 %**.
- Enterprise : colonne « Contact us » (pas de prix Stripe).
