# TRAKALOG — Billing & Payment System (Stripe)

> **Document créé le :** 22 avril 2026
> **Mis à jour le :** 20 mai 2026 (v2 — alignement architecture user-based + storage limits + stems gating)
> **Objectif :** Spec complète du système de paiement Trakalog — plans, pricing, AI credits, beta passes, implémentation Stripe.
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

Avec **Cloudflare R2** (migration prévue), le storage devient zero-egress et le coût drop drastiquement. Les chiffres ci-dessous reflètent Supabase actuel ; R2 fera mieux.

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
| Eliot uploade dans XYZ | ✅ Compte sur son quota Free (5 tracks, 2 GB) — pas sur celui de Yannick |
| Le workspace XYZ contient 1003 tracks au total | ✅ Pas de limite globale workspace, somme des quotas individuels |
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
| **Tracks (uploads personnels)** | **5 max** |
| **Storage personnel** | **1 GB** |
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

**Le Free est volontairement frustrant** — 5 tracks, pas de branding, pas de pitch, pas de stems. Juste assez pour tester et vouloir plus. C'est un teaser, pas un produit.

---

### Starter — $14/mois ($11/mois annuel = $132/an)

**Cible :** Artiste solo, beatmaker, songwriter indépendant.

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
| Smart A&R queries | 10/mois |
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

### Pro — $29/mois ($23/mois annuel = $276/an) ⭐ Plan star

**Cible :** Producteur actif, petit label, manager. **80% des revenus attendus.**

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

**Pourquoi c'est le plan star :** Le saut de $14 à $29 (2x le prix) donne 10x la valeur (1000 tracks vs 100, pitches illimités, 5 workspaces, 5 membres, catalog sharing, QR studio). Le "decoy effect" rend ce plan évident.

---

### Business — $59/mois ($47/mois annuel = $564/an)

**Cible :** Label, publisher, agence sync.

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

**Le Business à $59 ancre la perception** — il rend le Pro à $29 "abordable" par comparaison.

---

## 4. Tableau récapitulatif des plans

| Plan | Prix | Tracks | Storage | Stems | Pitches/mois | Smart A&R/mois | Shared links | Workspaces | Membres |
|---|---|---|---|---|---|---|---|---|---|
| Free | $0 | 5 | 1 GB | ❌ | 0 | 0 | 1 (no branding) | 1 | 1 |
| Starter | $14 | 100 | 40 GB | ✅ | 15 | 10 | ∞ | 1 | 1 |
| Pro | $29 | 1000 | 400 GB | ✅ | ∞ | 50 | ∞ | 5 | 5 |
| Business | $59 | ∞ | 2 TB inclus | ✅ | ∞ | ∞ | ∞ | ∞ | ∞ |

**Note storage** : la limite storage est calculée pour couvrir confortablement les WAV + stems associés. Hypothèse moyenne : ~320 MB par track total (1 master + 3 stems en moyenne). Free n'a pas de stems donc 1 GB suffit largement pour 5 tracks WAV (~500 MB). Cloudflare R2 (zero egress) rend ces limites soutenables côté coûts.

---

## 5. AI Credits (add-on, plans payants uniquement)

### Principe
Les features IA ont un coût variable (API Groq, Claude). Au lieu de tout inclure en illimité, chaque plan a un quota de base. Les power users achètent des packs de crédits supplémentaires.

**Free n'a pas accès à l'achat de crédits** — il faut au minimum un plan Starter.

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
- Les crédits du plan de base se rechargent chaque mois (ne s'accumulent pas, reset au renouvellement Stripe)
- Les crédits achetés en pack n'expirent jamais
- Ordre de consommation : **d'abord** le quota mensuel du plan, **ensuite** les crédits achetés
- Quand tout est épuisé → message "Buy more credits" avec lien vers l'achat
- Notification à 80% du quota mensuel : "You have 2 Smart A&R queries left this month"

---

## 6. Billing annuel vs mensuel

| Plan | Mensuel | Annuel/mois | Annuel total | Économie |
|---|---|---|---|---|
| Starter | $14 | $11 | $132 | 21% |
| Pro | $29 | $23 | $276 | 21% |
| Business | $59 | $47 | $564 | 20% |

- **Pousser l'annuel** sur la pricing page (afficher le prix annuel par défaut, toggle pour mensuel)
- Badge "Save 20%" sur l'option annuelle
- Cash upfront + 12 mois de rétention garantie

---

## 7. Politique commerciale

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

---

## 8. Beta Passes (système de comptes gratuits)

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

### Tables DB

Voir section "Schéma Base de Données" plus bas.

---

## 9. Schéma Base de Données

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

## 10. Limites par plan (config TypeScript)

```typescript
// src/lib/plans.ts

export const PLAN_LIMITS = {
  free: {
    // Uploads
    tracks_max: 5,
    storage_max_bytes: 1_073_741_824,        // 1 GB
    
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
    smart_ar_queries_monthly: 10,
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

## 11. Architecture Stripe

### Produits Stripe à créer (en mode TEST d'abord)

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

### Configuration Stripe

- **Stripe Tax** : activé day one
- **Customer Portal** : activé avec changement de plan, changement de cycle, mise à jour CB, annulation, factures
- **Smart Retries** : activé (21 jours)
- **Tax IDs** : collecte activée pour les business

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

## 12. Frontend — Pages et composants

### Pricing Page (`/pricing`)
- 4 colonnes : Free / Starter / Pro (highlighted) / Business
- Toggle mensuel/annuel (annuel par défaut, badge "Save 20%")
- Feature comparison table en dessous
- CTA "Get Started" (Free) / "Upgrade" (payants) par plan
- Si déjà abonné → le plan actuel a un badge "Current Plan"
- Section Stripe Tax notice : "Prices exclude tax — calculated at checkout"

### Settings → Billing (nouvelle section)
- **Plan actuel** + statut (avec icône verte/rouge)
- **Prochaine facturation** (date + montant)
- Bouton **"Change Plan"** → pricing page
- Bouton **"Manage Subscription"** → Stripe Customer Portal
- **Usage actuel** :
  - "X/100 tracks used"
  - "X/40 GB storage used" (barre de progression)
  - "X/10 Smart A&R queries this month"
  - "X/15 pitches sent this month"
- **AI Credits** : solde actuel (monthly remaining + purchased) + bouton "Buy Credits"
- **Historique des factures** (via Stripe Portal)

### Pricing Page — Stems Free section
Sur la colonne Free, afficher "Stems" avec une croix grisée et un mini tooltip "Stems are available from Starter plan" pour expliquer la limitation.

### Upgrade Prompts contextuels (dans l'app)

| Trigger | Modal |
|---|---|
| Upload 6ème track sur Free | "Upgrade to Starter to upload up to 100 tracks" |
| Essayer de pitcher sur Free | "Upgrade to Starter to send pitches" |
| Cliquer sur l'onglet Stems (Free) | "Stems are available from Starter — Upgrade to unlock" |
| 11ème Smart A&R query du mois (Starter) | "You've used all your Smart A&R queries. Buy credits or upgrade to Pro" |
| Essayer de créer un 2ème workspace (Free/Starter) | "Upgrade to Pro for up to 5 workspaces" |
| Essayer d'inviter un membre (Free/Starter) | "Upgrade to Pro to invite team members" |
| Storage à 90% | Banner "You're at 36 GB / 40 GB. Upgrade to Pro for 400 GB" |

### Credit Balance Display
- Dans le header (icône cerveau) ou dans Smart A&R : "X queries remaining this month"
- Dans Settings → Billing : solde complet (monthly + purchased séparés)
- Low credit warning : notification quand < 20% du quota mensuel

---

## 13. Enforcement des limites

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
  "current": 5,
  "max": 5,
  "plan": "free",
  "upgrade_to": "starter"
}
```

Le frontend catch cette erreur et affiche le modal d'upgrade approprié.

### Reset mensuel des quotas
- Géré par le webhook Stripe `invoice.paid` : à chaque renouvellement, reset `ai_credits_monthly_used = 0`, `pitches_sent_this_month = 0`, `smart_ar_queries_this_month = 0`
- Pour les users Free : reset par cron mensuel (pg_cron) ou trigger sur `ai_credits_reset_at`

---

## 14. Migration des utilisateurs existants

### Beta users (avant le launch Stripe)
Tous les comptes créés avant la mise en prod de Stripe reçoivent automatiquement un **Beta Pass Lifetime Pro** :
- Au moment du déploiement, script SQL qui crée un beta_pass `pass_type='lifetime'`, `plan_granted='pro'` pour chaque user existant
- Le trigger d'inscription rétroactif (à exécuter manuellement) lie ces passes à leurs subscriptions
- Message dans Settings → Billing : "You're on the Beta Pro Lifetime — all Pro features unlocked forever. Thank you for testing Trakalog!"

### Nouveaux comptes (après le launch Stripe)
- Inscription → plan Free automatique
- Onboarding mentionne les plans payants mais **pas de trial automatique** (cf. section 7)
- Le user upgrade quand il veut via Settings → Billing

---

## 15. Phases d'implémentation

### Phase 1 — Setup DB + Stripe (1-2 sessions)
1. Migration SQL : tables `subscriptions`, `beta_passes`, `credit_purchases`
2. Trigger `handle_new_user_subscription` + backfill users existants
3. Trigger `sync_subscription_usage` sur `tracks`
4. RPCs : `get_my_subscription`, `check_upload_allowed`
5. Colonne `file_size_bytes` sur `tracks` + backfill
6. Création Products + Prices Stripe (mode test)
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

### Phase 6 — Go Live (1 session)
27. Passer Stripe en mode production
28. Test du flow complet end-to-end en production avec une vraie CB
29. Activer le 7-day money-back guarantee dans les CGU
30. Communication aux beta users (email de bienvenue Lifetime Pro)

---

## 16. Risques et mitigations

| Risque | Mitigation |
|---|---|
| User contourne les limites frontend | Enforcement côté RPC (backend) — impossible à contourner |
| Webhook Stripe échoue | Retry automatique Stripe (jusqu'à 3 jours) + logs dans audit_logs + alerte admin |
| User annule et veut garder ses tracks | Les tracks restent accessibles en lecture seule sur Free, mais pas de nouvelles uploads au-delà de 5 + 1 GB |
| Downgrade avec plus de tracks que la limite | Les tracks existants restent, mais bloque les nouveaux uploads tant que count > limite |
| Abus du Beta Pass | 1 pass par email, status `redeemed` une fois utilisé, admin peut revoke |
| Double charge | Stripe gère nativement la déduplication des webhooks |
| Storage limit dépassé entre 2 sync triggers | Le check `check_upload_allowed` fait un live check avant upload, pas juste le compteur cached |
| User invité Free qui consomme trop le workspace Pro du owner | Impossible : chaque user a ses propres quotas, pas de pool partagé |
| Free user qui crée 50 comptes pour bypass | Email verification obligatoire + détection de patterns (futur) |

---

## 17. KPIs à tracker (dans Admin Dashboard)

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

---

## 18. Décisions figées (changelog v2)

Cette section résume **les changements par rapport à la v1** du doc, validés en session du 20 mai 2026 :

1. **Architecture user-based** : plan vit sur `subscriptions.user_id`, pas sur `workspaces.plan` (changement majeur)
2. **Free = 5 tracks** (était 3) — décision après débat sur 5 vs 7 vs 10, retenu 5 pour optimiser la conversion
3. **Storage limits** ajoutées comme safety net : 1 GB / 40 GB / 400 GB / 2 TB (Free réduit car pas de stems)
4. **Stems = feature premium** : grisé sur Free avec upgrade prompt
5. **Règle double check upload** : quota perso (tracks count + storage) de l'uploader, pas du workspace owner
6. **Pas de plafond workspace global** : un workspace peut accumuler la somme des quotas de ses membres
7. **Tracks restent dans le workspace** quand l'invité part (le owner ne perd rien)
8. **Downgrade gracieux** : tracks existants restent visibles, bloque seulement les nouveaux uploads
9. **Beta Passes** ajoutés au système (table + admin UI + flow d'enrollment automatique)
10. **Stripe Tax** activé day one
11. **7-day money-back guarantee** ajouté
12. **21-day dunning** via Stripe Smart Retries
13. **Pas de Free Trial Pro initial** au lancement (réévaluable post-launch)
14. **Beta users existants** → tous Lifetime Pro Beta Pass au déploiement

---

*Ce document est la source de vérité v2 pour l'implémentation du billing Trakalog. Toute décision contradictoire avec ce doc doit déclencher une mise à jour explicite (v3, v4, etc.).*
