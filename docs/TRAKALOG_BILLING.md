# TRAKALOG — Billing & Payment System (Stripe)

> **Document créé le :** 22 avril 2026
> **Objectif :** Spec complète du système de paiement Trakalog — plans, pricing, tokens, implémentation Stripe.
> **Statut :** Prêt à implémenter
> **Priorité :** Bloquant pour le beta launch

---

## 1. Philosophie Pricing

### Positionnement
Trakalog se positionne **contre le coût TOTAL de Disco** (plan + add-ons), pas contre leur prix de base.

Un utilisateur Disco qui veut watermarking + AI discovery + analytics paie : $25 (Pro) + $10 (Discovery Suite) + watermarking = **$35-45/mois**.

**Message clé :** *"Everything Disco charges extra for is included in every Trakalog plan."*

### Benchmarks concurrents

| Plateforme | Entrée | Mid | Pro/Enterprise | Add-ons |
|---|---|---|---|---|
| Disco.ac | $10/mois (500 tracks) | $15/mois (1K) | $25/mois + custom | Watermark +$/mois, Discovery Suite +$10/mois |
| DropCue | $5/mois | $15/mois | $599 lifetime | Tout inclus |
| Music Gateway | £5/mois | £15/mois | £25/mois | Sync rep commission 20-25% |
| Songspace | ~$10/mois | ~$20/mois | Custom | — |
| **Trakalog** | **$14/mois** | **$29/mois** | **$59/mois** | **AI Credits uniquement** |

### Coûts réels par utilisateur (marges 90-95%)

| Poste | Coût/user/mois |
|---|---|
| Supabase Storage (50 tracks ~2GB) | ~$0.04 |
| Supabase Storage (500 tracks ~20GB) | ~$0.42 |
| Supabase Storage (2000+ tracks ~100GB) | ~$2.10 |
| Supabase Bandwidth (streaming) | ~$0.10-0.50 |
| Groq/AI (Smart A&R query) | ~$0.01/query |
| Railway (Sonic DNA + Watermark) | ~$10/mois fixe total |
| Vercel + Resend + Cloudflare | ~$20/mois fixe total |

---

## 2. Plans d'abonnement

### Free — $0/mois

**Objectif :** Acquisition. Laisser les gens goûter le produit et devenir accros. Convertir les utilisateurs "Save to Trakalog" depuis les shared links.

| Feature | Limite |
|---|---|
| Tracks | 3 max |
| Sonic DNA auto-analysis | ✅ Inclus |
| Shared links | 1 (branding Trakalog, pas custom) |
| Player + lyrics | ✅ |
| Watermarking | ❌ |
| Pitch emails | ❌ |
| Smart A&R | ❌ |
| Branding custom | ❌ |
| Workspaces | 1 |
| Membres | 1 (owner) |
| Splits & signatures | ❌ |
| Contacts | 10 max |
| Radio | ❌ |
| Export contacts | ❌ |
| Leak tracing | ❌ |
| Catalog sharing | ❌ |
| QR code studio | ❌ |
| API access | ❌ |

**Le Free est volontairement frustrant** — 3 tracks, pas de branding, pas de pitch. Juste assez pour tester et vouloir plus.

---

### Starter — $14/mois ($11/mois annuel = $132/an)

**Cible :** Artiste solo, beatmaker, songwriter indépendant.

| Feature | Limite |
|---|---|
| Tracks | 100 |
| Sonic DNA auto-analysis | ✅ Inclus |
| Shared links | ✅ Illimités (password, expiration) |
| Watermarking invisible | ✅ Inclus |
| Leak tracing | ✅ Inclus |
| Branding custom | ✅ (hero, logo, couleur, socials) |
| Pitch emails | 15/mois |
| Smart A&R queries | 10/mois |
| Splits & signatures | ✅ |
| Contacts | ✅ Illimités |
| Radio | ✅ |
| Export contacts | ❌ |
| Workspaces | 1 |
| Membres | 1 (owner) |
| Catalog sharing | ❌ |
| QR code studio | ❌ |
| API access | ❌ |
| AI Credits achat | ✅ Disponible |

---

### Pro — $29/mois ($23/mois annuel = $276/an) ⭐ Plan star

**Cible :** Producteur actif, petit label, manager. **80% des revenus attendus.**

| Feature | Limite |
|---|---|
| Tracks | 1 000 |
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

**Pourquoi c'est le plan star :** Le saut de $14 à $29 (2x le prix) donne 10x la valeur (1000 tracks vs 100, pitches illimités, 5 workspaces, 5 membres, catalog sharing, QR studio). Le "decoy effect" rend ce plan évident.

---

### Business — $59/mois ($47/mois annuel = $564/an)

**Cible :** Label, publisher, agence sync.

| Feature | Limite |
|---|---|
| Tracks | ✅ Illimités |
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
| Membres | ✅ Illimités |
| Catalog sharing | ✅ |
| QR code studio | ✅ |
| API access | ✅ |
| Brief Seeker | ✅ (quand disponible) |
| Artist Seeker | ✅ (quand disponible) |
| Support prioritaire | ✅ |
| AI Credits achat | ✅ Disponible |

**Le Business à $59 ancre la perception** — il rend le Pro à $29 "abordable" par comparaison.

---

## 3. AI Credits (add-on, tous plans)

### Principe
Les features IA ont un coût variable (API Groq, Claude). Au lieu de tout inclure en illimité, chaque plan a un quota de base. Les power users achètent des packs de crédits supplémentaires.

### Packs disponibles

| Pack | Prix | Prix/crédit | Coût réel Trakalog | Marge brute |
|---|---|---|---|---|
| 25 crédits | $5 | $0.20 | ~$0.25 total (~$0.01/crédit) | **95%** |
| 100 crédits | $15 | $0.15 | ~$1.00 total | **93%** |
| 500 crédits | $50 | $0.10 | ~$5.00 total | **90%** |

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
- Les crédits du plan de base se rechargent chaque mois (ne s'accumulent pas)
- Les crédits achetés en pack n'expirent jamais
- Quand le quota mensuel est épuisé → utilise les crédits achetés
- Quand tout est épuisé → message "Buy more credits" avec lien vers l'achat
- Notification à 80% du quota mensuel : "You have 2 Smart A&R queries left this month"

---

## 4. Billing annuel vs mensuel

| Plan | Mensuel | Annuel/mois | Annuel total | Économie |
|---|---|---|---|---|
| Starter | $14 | $11 | $132 | 21% |
| Pro | $29 | $23 | $276 | 21% |
| Business | $59 | $47 | $564 | 20% |

- **Pousser l'annuel** sur la pricing page (afficher le prix annuel par défaut, toggle pour mensuel)
- Badge "Save 20%" sur l'option annuelle
- Cash upfront + 12 mois de rétention garantie

---

## 5. Comparatif pour le client (pricing page)

### Trakalog Pro ($29/mois) vs la concurrence

| Feature | Disco ($35+/mois effectif) | DropCue ($15) | Trakalog Pro ($29) |
|---|---|---|---|
| Tracks | 1K | Illimité | 1K |
| Watermarking | Add-on payant | ❌ | ✅ Inclus |
| AI tagging/search | +$10/mois extra | ❌ | ✅ Inclus |
| Smart A&R matching | ❌ | ❌ | ✅ 50 queries/mois |
| Leak tracing | ❌ | ❌ | ✅ Inclus |
| Splits + signatures | ❌ | ❌ | ✅ Inclus |
| QR code studio | QR basique | ❌ | ✅ Inclus |
| Multi-workspace | ❌ | ❌ | ✅ 5 |
| Membres équipe | 1 | 1 | 5 |
| Engagement tracking | Add-on | Inclus | ✅ Inclus |
| Branding custom | ✅ | ✅ | ✅ Inclus |

**$29/mois tout inclus vs $35+/mois avec add-ons chez Disco.**

---

## 6. Architecture Stripe

### Produits Stripe à créer

```
Products:
  - trakalog_starter
    - Price: $14/month (recurring)
    - Price: $132/year (recurring)
  - trakalog_pro
    - Price: $29/month (recurring)
    - Price: $276/year (recurring)
  - trakalog_business
    - Price: $59/month (recurring)
    - Price: $564/year (recurring)
  - trakalog_credits_25
    - Price: $5 (one-time)
  - trakalog_credits_100
    - Price: $15 (one-time)
  - trakalog_credits_500
    - Price: $50 (one-time)
```

### Flow d'abonnement

```
User clique "Upgrade" sur la pricing page
  → Stripe Checkout Session (hosted par Stripe)
    → Paiement CB / Apple Pay / Google Pay
      → Webhook Stripe → Edge Function "stripe-webhook"
        → Met à jour workspace.plan en DB
        → Met à jour workspace.plan_limits (tracks_max, pitches_max, etc.)
        → Set workspace.subscription_id, subscription_status
        → Si premier abonnement → audit log + notification
  → Redirect vers app.trakalog.com/settings?billing=success
```

### Flow d'achat de crédits

```
User clique "Buy 100 credits"
  → Stripe Checkout Session (one-time payment)
    → Paiement
      → Webhook Stripe → Edge Function "stripe-webhook"
        → Incrémente workspace.ai_credits += 100 en DB
        → Audit log
  → Toast "100 credits added to your account"
```

### Flow de gestion (portail client)

```
User clique "Manage Subscription" dans Settings → Billing
  → Stripe Customer Portal (hosted par Stripe)
    → Changer de plan (upgrade/downgrade)
    → Changer de cycle (mensuel ↔ annuel)
    → Mettre à jour la carte
    → Annuler l'abonnement
    → Voir les factures
  → Webhooks Stripe notifient les changements
```

### Tables DB

```sql
-- Ajout de colonnes sur workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS billing_cycle text DEFAULT 'monthly';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_started_at timestamptz;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_credits integer DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_credits_monthly_used integer DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS ai_credits_reset_at timestamptz;

-- Table pour l'historique des achats de crédits
CREATE TABLE IF NOT EXISTS credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  user_id uuid REFERENCES auth.users(id),
  amount integer NOT NULL,
  price_cents integer NOT NULL,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now()
);
```

### Limites par plan (config)

```typescript
const PLAN_LIMITS = {
  free: {
    tracks_max: 3,
    pitches_max: 0,
    smart_ar_queries: 0,
    workspaces_max: 1,
    members_max: 1,
    contacts_max: 10,
    shared_links_max: 1,
    watermarking: false,
    leak_tracing: false,
    branding: false,
    splits: false,
    radio: false,
    export_contacts: false,
    catalog_sharing: false,
    qr_studio: false,
    api_access: false,
  },
  starter: {
    tracks_max: 100,
    pitches_max: 15,
    smart_ar_queries: 10,
    workspaces_max: 1,
    members_max: 1,
    contacts_max: -1, // illimité
    shared_links_max: -1,
    watermarking: true,
    leak_tracing: true,
    branding: true,
    splits: true,
    radio: true,
    export_contacts: false,
    catalog_sharing: false,
    qr_studio: false,
    api_access: false,
  },
  pro: {
    tracks_max: 1000,
    pitches_max: -1,
    smart_ar_queries: 50,
    workspaces_max: 5,
    members_max: 5,
    contacts_max: -1,
    shared_links_max: -1,
    watermarking: true,
    leak_tracing: true,
    branding: true,
    splits: true,
    radio: true,
    export_contacts: true,
    catalog_sharing: true,
    qr_studio: true,
    api_access: true,
  },
  business: {
    tracks_max: -1,
    pitches_max: -1,
    smart_ar_queries: -1,
    workspaces_max: -1,
    members_max: -1,
    contacts_max: -1,
    shared_links_max: -1,
    watermarking: true,
    leak_tracing: true,
    branding: true,
    splits: true,
    radio: true,
    export_contacts: true,
    catalog_sharing: true,
    qr_studio: true,
    api_access: true,
  },
};
```

### Edge Functions Stripe

```
stripe-webhook (NOUVEAU)
  - Écoute les événements : checkout.session.completed, customer.subscription.updated,
    customer.subscription.deleted, invoice.paid, invoice.payment_failed
  - Met à jour workspace.plan, subscription_status, ai_credits
  - Gère les upgrades, downgrades, annulations, renouvellements
  - Gère les achats de crédits one-time

create-checkout-session (NOUVEAU)
  - Crée une Stripe Checkout Session pour abonnement ou achat de crédits
  - Paramètres : workspace_id, price_id, billing_cycle
  - Retourne : session URL

create-portal-session (NOUVEAU)
  - Crée une Stripe Customer Portal Session
  - Paramètres : workspace_id
  - Retourne : portal URL
```

### Secrets Supabase à ajouter

```
STRIPE_SECRET_KEY — clé secrète Stripe
STRIPE_WEBHOOK_SECRET — secret pour vérifier les webhooks
STRIPE_PUBLISHABLE_KEY — clé publique (aussi dans le frontend via env var)
```

---

## 7. Frontend — Pages et composants

### Pricing Page (nouvelle page /pricing ou modal)
- 4 colonnes : Free / Starter / Pro (highlighted) / Business
- Toggle mensuel/annuel (annuel par défaut, badge "Save 20%")
- Feature comparison table
- CTA "Get Started" / "Upgrade" par plan
- Si déjà abonné → le plan actuel a un badge "Current Plan"

### Settings → Billing (nouvelle section)
- Plan actuel + statut
- Prochaine facturation (date + montant)
- Bouton "Change Plan" → pricing page
- Bouton "Manage Subscription" → Stripe Customer Portal
- Usage actuel : "X/100 tracks used", "X/10 Smart A&R queries this month"
- AI Credits : solde actuel + bouton "Buy Credits"
- Historique des factures (via Stripe Portal)

### Upgrade Prompts (dans l'app)
- Quand l'utilisateur atteint une limite → modal "Upgrade to unlock"
- Exemples :
  - Upload 4ème track sur Free → "Upgrade to Starter to upload up to 100 tracks"
  - Essayer de pitcher sur Free → "Upgrade to Starter to send pitches"
  - 11ème Smart A&R query du mois sur Starter → "You've used all your Smart A&R queries. Buy credits or upgrade to Pro"
  - Essayer de créer un 2ème workspace sur Starter → "Upgrade to Pro for up to 5 workspaces"

### Credit Balance Display
- Dans le header ou dans Smart A&R : "X queries remaining this month"
- Dans Settings → Billing : solde complet (monthly + purchased)
- Low credit warning : notification quand < 20% du quota mensuel

---

## 8. Enforcement des limites

### Côté frontend (UX)
- Vérifier les limites AVANT l'action (pas après)
- Afficher un compteur sur les pages concernées ("3/100 tracks")
- Griser les boutons des features non incluses dans le plan
- Modal d'upgrade avec comparatif ciblé

### Côté backend (sécurité — RPCs)
- Les RPCs critiques doivent vérifier les limites du plan :
  - `insert_track` → vérifier tracks_count < plan_limits.tracks_max
  - `create_pitch` → vérifier pitches_count < plan_limits.pitches_max
  - `create_workspace_with_member` → vérifier workspaces_count < plan_limits.workspaces_max
  - Smart A&R Edge Function → vérifier ai_credits_monthly_used < plan_limits.smart_ar_queries OU ai_credits > 0
- Si la limite est atteinte → retourner une erreur explicite ("plan_limit_reached")
- Le frontend catch cette erreur et affiche le modal d'upgrade

### Reset mensuel des quotas
- Cron ou trigger : au début de chaque cycle de facturation, reset `ai_credits_monthly_used = 0`
- Géré par le webhook Stripe `invoice.paid` (chaque renouvellement = reset)

---

## 9. Migration des utilisateurs existants

### Beta users (avant le launch Stripe)
- Tous les comptes existants → plan **Pro** gratuit pendant 30 jours (ou la durée de la beta)
- Message : "You're on the Beta Pro plan — all features unlocked. After beta, choose a plan."
- Après la beta → downgrade automatique vers Free, email de rappel pour upgrader

### Nouveau compte (après le launch Stripe)
- Création → plan Free automatique
- Onboarding → mention du Free Trial Pro ("Try Pro free for 14 days")
- Après 14 jours → downgrade vers Free si pas d'upgrade

---

## 10. Phases d'implémentation

### Phase 1 — Setup Stripe (~1-2 sessions)
1. Créer compte Stripe (mode test)
2. Créer les 6 Products + 9 Prices dans Stripe Dashboard
3. Configurer le Customer Portal
4. Ajouter les colonnes DB (plan, stripe_customer_id, etc.)
5. Créer les 3 Edge Functions (webhook, checkout, portal)
6. Configurer les secrets Supabase

### Phase 2 — Frontend Billing (~1-2 sessions)
7. Page Pricing (4 plans, toggle annuel/mensuel)
8. Settings → Billing (plan actuel, usage, manage, buy credits)
9. Boutons Upgrade → Stripe Checkout
10. Boutons Manage → Stripe Portal
11. Intégration webhooks (mise à jour plan en DB)

### Phase 3 — Enforcement des limites (~1-2 sessions)
12. Vérification limites dans les RPCs
13. Compteurs dans le frontend
14. Modals d'upgrade quand limite atteinte
15. Low credit warnings

### Phase 4 — Go Live (~1 session)
16. Passer Stripe en mode production
17. Tester le flow complet (inscription → upgrade → paiement → features débloquées)
18. Migrer les beta users
19. Activer le 14-day Pro trial pour les nouveaux comptes

---

## 11. Risques et mitigations

| Risque | Mitigation |
|---|---|
| User contourne les limites frontend | Enforcement côté RPC (backend) — impossible à contourner |
| Webhook Stripe échoue | Retry automatique Stripe (jusqu'à 3 jours) + logs dans audit_logs |
| User annule et veut garder ses tracks | Les tracks restent accessibles en lecture seule sur Free, mais pas de nouvelles uploads au-delà de 3 |
| Downgrade avec plus de tracks que la limite | Les tracks existants restent, mais pas de nouvel upload tant que le count est au-dessus de la limite |
| Abus du Free trial Pro | 1 seul trial par email/workspace, vérifié côté DB |
| Double charge | Stripe gère nativement la déduplication des webhooks |

---

## 12. KPIs à tracker

- **MRR** (Monthly Recurring Revenue)
- **ARPU** (Average Revenue Per User)
- **Conversion Free → Paid** (cible : 5-10%)
- **Plan distribution** (% Starter vs Pro vs Business)
- **Churn rate** mensuel (cible : < 5%)
- **AI Credits achetés / mois** (revenue additionnel)
- **LTV** (Lifetime Value = ARPU / Churn Rate)
- **CAC** (Customer Acquisition Cost — quand tu fais du marketing)

---

*Ce document est la source de vérité pour l'implémentation du billing Trakalog. À utiliser dans une conversation dédiée avec Claude.*
