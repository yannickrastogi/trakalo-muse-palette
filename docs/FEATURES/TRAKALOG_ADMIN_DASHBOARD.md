# TRAKALOG — Admin Dashboard (Feature Spec)

> **Document créé le :** 25 avril 2026
> **Objectif :** Dashboard administrateur complet pour gérer, monitorer et comprendre l'utilisation de Trakalog à l'échelle de dizaines de milliers d'utilisateurs.
> **Statut :** Spec prête — À implémenter après Billing/Stripe
> **Priorité :** Post-beta launch

---

## Vision

Le Admin Dashboard est le **centre de commande** de Trakalog pour le fondateur et l'équipe ops. Il doit répondre à 3 questions en moins de 5 secondes :

1. **Comment va le business ?** (MRR, users, churn, growth)
2. **Comment va le produit ?** (uploads, pitches, engagement, features utilisées)
3. **Quelque chose est cassé ?** (erreurs, Edge Functions down, storage plein)

Pensé pour scaler de 10 à 100 000 utilisateurs sans refactoring.

---

## 1. Accès & Sécurité

### Route
- `/admin` — protégée, accessible uniquement aux admins Trakalog
- Pas dans le sidebar utilisateur — accessible via URL directe ou menu profil (visible seulement si admin)

### Authentification
- Colonne `is_platform_admin boolean DEFAULT false` sur la table `profiles` ou `auth.users` metadata
- Middleware côté frontend : si `!user.is_platform_admin` → redirect vers `/dashboard`
- Double vérification côté RPC : toutes les RPCs admin vérifient `is_platform_admin` avant d'exécuter

### Impersonation (Se connecter en tant que)
- Bouton "View as user" sur chaque fiche utilisateur
- Crée une session read-only avec le contexte de l'utilisateur
- Badge rouge "ADMIN VIEW — [User Name]" en haut de l'écran
- Bouton "Exit Admin View" pour revenir
- Aucune action destructive possible en mode impersonation
- Log dans audit_logs : `admin.impersonate`

---

## 2. Structure des pages

### 2.1 — Overview (page d'accueil `/admin`)

Le tableau de bord principal. Tout ce qui compte en un coup d'œil.

#### KPIs en haut (cards)

| KPI | Calcul | Sous-texte |
|---|---|---|
| Total Users | COUNT(auth.users) | +X this week / +X this month |
| Active Users (MAU) | Users avec au moins 1 action dans les 30 derniers jours | % du total |
| Active Users (WAU) | Idem sur 7 jours | % du total |
| Active Users (DAU) | Idem sur 24h | % du total |
| Total Tracks | COUNT(tracks) | +X this week |
| Total Storage Used | SUM(file sizes) across all buckets | X GB / limite plan |
| MRR | SUM(plan prices actifs) | +X% vs mois précédent |
| ARR | MRR × 12 | Projection annuelle |
| Paying Users | COUNT(workspaces WHERE plan != 'free') | % conversion free→paid |
| Churn Rate | Users qui ont downgrade/cancel ce mois / total paying début du mois | Tendance ↑↓ |
| ARPU | MRR / Paying Users | Tendance ↑↓ |
| LTV | ARPU / Churn Rate | Estimation |

#### Graphiques

1. **User Growth** — Line chart : signups cumulés par jour/semaine/mois (toggle). Ligne séparée pour free vs paid.
2. **MRR Growth** — Line chart : MRR par mois, avec breakdown par plan (Starter/Pro/Business)
3. **Tracks Uploaded** — Bar chart : tracks uploadés par jour/semaine
4. **Feature Usage** — Horizontal bar chart : % d'utilisateurs qui utilisent chaque feature (pitches, shared links, Smart A&R, splits, stems, playlists, radio, QR studio, branding)
5. **Plan Distribution** — Donut chart : répartition Free / Starter / Pro / Business
6. **Top 10 Workspaces** — Table : les 10 workspaces avec le plus de tracks, avec nom, plan, tracks count, dernière activité

#### Alertes (en haut, dismissable)

- "X users signed up but never uploaded a track" (onboarding drop-off)
- "Edge Function X a un taux d'erreur > 5% dans les dernières 24h"
- "Storage usage approaching plan limit for X workspaces"
- "X paying users haven't logged in for 30+ days" (churn risk)
- "X free trial expiring in 3 days"

---

### 2.2 — Users (`/admin/users`)

#### Liste de tous les utilisateurs

Colonnes :
- Avatar + Nom complet
- Email
- Date d'inscription
- Dernière connexion
- Plan actif (badge coloré)
- Nombre de workspaces
- Nombre total de tracks
- Nombre de pitches envoyés
- Statut : Active / Inactive (30 jours) / Churned

Fonctionnalités :
- **Recherche** par nom ou email
- **Filtres** : plan (Free/Starter/Pro/Business), statut (Active/Inactive/Churned), date d'inscription (range)
- **Tri** : par date d'inscription, dernière activité, nombre de tracks, plan
- **Export** : CSV de la liste filtrée
- **Pagination** : 50 users par page, lazy-load

#### Fiche utilisateur (clic sur un user)

Page détail avec :

**Infos générales**
- Avatar, nom, email, date d'inscription, dernière connexion
- Auth provider (email/Google)
- 2FA activé oui/non
- IP de dernière connexion

**Workspaces**
- Liste de tous ses workspaces avec : nom, plan, tracks count, membres count, branding (thumbnail)
- Clic sur un workspace → détail du workspace

**Activité récente** (timeline)
- Les 50 dernières actions : upload track, send pitch, create shared link, invite member, etc.
- Avec timestamp et détails

**Engagement**
- Graphique d'activité des 30 derniers jours (heatmap ou bar chart)
- Sessions par semaine
- Features les plus utilisées

**Billing**
- Plan actuel, date de début, prochaine facturation
- Historique des paiements (via Stripe)
- AI Credits : solde, historique d'utilisation
- Bouton "View in Stripe" → ouvre le Stripe Dashboard sur ce customer

**Actions admin**
- "View as user" (impersonation)
- "Send email" (ouvre un composer)
- "Upgrade/Downgrade plan" (override admin, avec log dans audit_logs)
- "Disable account" (soft delete, pas de suppression définitive)
- "Reset password" (envoie un email de reset)

---

### 2.3 — Workspaces (`/admin/workspaces`)

#### Liste de tous les workspaces

Colonnes :
- Logo (thumbnail) + Nom
- Owner (nom + email)
- Plan
- Tracks count
- Members count
- Storage used
- Dernière activité
- Created at

Fonctionnalités : recherche, filtres (plan, tracks range, active/inactive), tri, export CSV

#### Fiche workspace (clic)

**Infos**
- Nom, slug, owner, plan, date de création
- Branding : hero image, logo, brand color (preview)
- Social links

**Catalogue**
- Nombre total de tracks
- Répartition par status (Available / On Hold / Released)
- Répartition par genre (pie chart)
- Top 10 tracks les plus écoutées (plays via shared links)
- Storage utilisé (audio + covers + stems + documents)

**Membres**
- Liste des membres avec : nom, email, rôle (access level), titre professionnel, date d'ajout
- Invitations en attente

**Activité**
- Pitches envoyés (count + derniers 10)
- Shared links créés (count + derniers 10 avec stats de plays)
- Catalog shares actifs (vers quels workspaces)

**Contacts**
- Nombre total de contacts
- Top 10 contacts les plus engagés (qui ont le plus écouté)
- Export CSV

---

### 2.4 — Tracks (`/admin/tracks`)

#### Vue globale

KPIs :
- Total tracks sur la plateforme
- Tracks uploadés aujourd'hui / cette semaine / ce mois
- Taille moyenne par track
- Répartition par format (WAV/MP3/FLAC/AIFF)
- Répartition par genre
- % avec Sonic DNA complété
- % avec lyrics
- % avec splits définis
- % avec stems uploadés

#### Recherche de tracks

- Recherche par titre, artiste, ISRC
- Filtres : genre, BPM range, key, status, has_lyrics, has_splits, has_stems
- Clic sur un track → infos complètes (metadata, splits, sonic DNA, engagement)

---

### 2.5 — Engagement & Analytics (`/admin/analytics`)

#### Shared Links Analytics

- Total shared links créés
- Total plays (all time)
- Plays par jour (line chart)
- Top 10 shared links les plus écoutés
- Taux de complétion (% d'écoute moyenne)
- Gate screen conversion : % de visitors qui remplissent le formulaire
- Downloads : total, par type (original, preview, pack)

#### Pitch Analytics

- Total pitches envoyés
- Taux d'ouverture (% de pitches ouverts par le recipient)
- Taux d'écoute (% de pitches où le recipient a écouté au moins 1 track)
- Pitches par jour/semaine (bar chart)
- Top 10 pitchers (users qui envoient le plus de pitches)

#### Smart A&R Analytics

- Total queries
- Queries par jour
- Coût Groq estimé
- Temps de réponse moyen
- % de queries avec résultats

#### Sonic DNA Analytics

- Total analyses complétées
- Analyses par jour
- Taux de succès (% sans erreur)
- Temps de traitement moyen
- Coût Railway estimé

---

### 2.6 — Billing & Revenue (`/admin/billing`)

#### Revenue Dashboard

- **MRR actuel** avec breakdown par plan
- **MRR Growth** : graphique mensuel
- **New MRR** : revenus des nouveaux abonnés ce mois
- **Expansion MRR** : upgrades (Starter→Pro, Pro→Business)
- **Contraction MRR** : downgrades
- **Churned MRR** : annulations
- **Net MRR** : New + Expansion - Contraction - Churned

#### Plan Distribution

- Nombre d'users par plan (table + donut chart)
- Conversion funnel : Free → Trial → Starter → Pro → Business
- Churn par plan (quel plan a le plus de churn)

#### AI Credits

- Total crédits achetés (revenus supplémentaires)
- Crédits achetés par mois
- Top acheteurs de crédits
- Utilisation moyenne de crédits par user

#### Stripe Integration

- Lien direct vers le Stripe Dashboard
- Webhook status : derniers events reçus, erreurs
- Invoices récentes

---

### 2.7 — Infrastructure & Health (`/admin/health`)

#### Edge Functions Status

| Fonction | Status | Invocations/24h | Erreurs/24h | Taux erreur | Temps moyen | Rate limits hit |
|---|---|---|---|---|---|---|
| smart-ar | ✅ | 245 | 3 | 1.2% | 2.3s | 0 |
| analyze-sonic-dna | ⚠️ | 89 | 12 | 13.5% | 8.1s | 2 |
| ... | ... | ... | ... | ... | ... | ... |

Source : Supabase Edge Functions logs (API ou scraping du dashboard)

#### Storage

- Usage total par bucket (tracks, covers, stems, documents, watermarked, branding, avatars)
- Croissance par mois
- Top 10 workspaces par storage

#### Database

- Nombre de rows par table principale
- Croissance des tables par mois
- Queries les plus lentes (si accessible via pg_stat_statements)

#### External Services

- Railway (Sonic DNA + Watermark) : status, uptime, coût mensuel
- Groq : usage, coût estimé
- Resend : emails envoyés, taux de delivery, bounces
- Vercel : déploiements récents, build time

---

### 2.8 — Audit Logs (`/admin/audit`)

- Tous les events de la table `audit_logs`
- Filtres : action type, user, resource, date range
- Actions loggées : login, logout, track.upload, track.delete, pitch.send, shared_link.create, member.invite, plan.upgrade, plan.downgrade, admin.impersonate, etc.
- Export CSV

---

### 2.9 — Notifications Admin (`/admin/notifications`)

Notifications push/email pour l'admin quand :

- **Nouveau signup** : "New user: [Name] ([email])" — email digest quotidien
- **Nouveau paying user** : "🎉 [Name] upgraded to [Plan]!" — notification immédiate
- **Churn** : "[Name] cancelled [Plan]" — notification immédiate
- **Milestone** : "🎯 100 users reached!" / "🎯 $1K MRR reached!"
- **Erreur critique** : "⚠️ Edge Function [name] error rate > 10%"
- **Storage alert** : "⚠️ Workspace [name] approaching storage limit"

Canaux de notification :
- In-app (badge sur l'icône admin dans le menu)
- Email digest (quotidien, configurable)
- Slack webhook (optionnel, futur)

---

## 3. Architecture Technique

### Tables DB

```sql
-- Flag admin sur les profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_platform_admin boolean DEFAULT false;

-- Table pour les métriques agrégées (cache pour ne pas recalculer à chaque page load)
CREATE TABLE IF NOT EXISTS admin_metrics_cache (
  id text PRIMARY KEY,
  value jsonb NOT NULL,
  computed_at timestamptz DEFAULT now()
);

-- Table pour les notifications admin
CREATE TABLE IF NOT EXISTS admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL, -- 'new_signup', 'new_paying', 'churn', 'milestone', 'error', 'storage_alert'
  title text NOT NULL,
  body text,
  metadata jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index pour les requêtes admin fréquentes
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at);
CREATE INDEX IF NOT EXISTS idx_tracks_workspace_id ON tracks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_plan ON workspaces(plan);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
```

### RPCs Admin (toutes SECURITY DEFINER + check is_platform_admin)

```sql
-- Métriques globales
admin_get_overview_stats(_admin_id uuid) → jsonb
admin_get_user_growth(_admin_id uuid, _period text) → jsonb
admin_get_revenue_stats(_admin_id uuid) → jsonb

-- Users
admin_list_users(_admin_id uuid, _page int, _per_page int, _search text, _plan text, _status text) → SETOF jsonb
admin_get_user_detail(_admin_id uuid, _target_user_id uuid) → jsonb
admin_get_user_activity(_admin_id uuid, _target_user_id uuid, _limit int) → SETOF jsonb

-- Workspaces
admin_list_workspaces(_admin_id uuid, _page int, _per_page int, _search text) → SETOF jsonb
admin_get_workspace_detail(_admin_id uuid, _workspace_id uuid) → jsonb

-- Tracks
admin_get_track_stats(_admin_id uuid) → jsonb
admin_search_tracks(_admin_id uuid, _query text, _filters jsonb) → SETOF jsonb

-- Engagement
admin_get_engagement_stats(_admin_id uuid, _period text) → jsonb
admin_get_top_shared_links(_admin_id uuid, _limit int) → SETOF jsonb

-- Actions
admin_disable_user(_admin_id uuid, _target_user_id uuid) → void
admin_override_plan(_admin_id uuid, _workspace_id uuid, _plan text) → void
```

### Frontend

- Route group `/admin/*` dans App.tsx
- Guard component `AdminRoute` qui vérifie `is_platform_admin`
- Lazy-loaded (React.lazy) — ne charge PAS le code admin pour les users normaux
- Composants charts : recharts (déjà dans package.json, pas encore utilisé — parfait)
- Pagination côté serveur (pas de fetch de 10K users en mémoire)
- Refresh automatique des KPIs toutes les 5 minutes
- Cache local des métriques lourdes (admin_metrics_cache)

### Cron Job — Métriques agrégées

Un Edge Function `compute-admin-metrics` qui tourne toutes les heures :
- Calcule les KPIs lourds (MRR, churn, MAU, feature usage)
- Stocke dans `admin_metrics_cache`
- Le dashboard lit depuis le cache au lieu de calculer en live
- Les métriques légères (count users, count tracks) restent en live

---

## 4. Phases d'implémentation

### Phase 1 — MVP (~2-3 sessions)
1. Colonne `is_platform_admin` + guard route
2. Page Overview avec KPIs basiques (counts en live, pas de cache)
3. Liste Users avec recherche + filtres
4. Fiche User basique (infos + workspaces + tracks count)
5. recharts pour 2-3 graphiques (user growth, tracks uploaded)

### Phase 2 — Billing & Analytics (~2 sessions)
6. Intégration Stripe Dashboard (MRR, plan distribution)
7. Page Engagement (shared links plays, pitch stats)
8. Page Workspaces avec détails
9. Notifications admin (new signup, new paying, churn)

### Phase 3 — Intelligence (~2 sessions)
10. Feature usage analytics (quelles features sont utilisées)
11. Churn prediction (users inactifs depuis X jours)
12. Onboarding funnel (où les users drop off)
13. Cron job métriques agrégées
14. Export CSV sur toutes les listes

### Phase 4 — Ops (~1-2 sessions)
15. Edge Functions health dashboard
16. Storage monitoring
17. Audit logs viewer
18. Impersonation
19. Admin actions (disable user, override plan)

---

## 5. Notifications Admin — Détail

### Triggers automatiques

| Event | Notification | Canal |
|---|---|---|
| Nouveau signup | "[Name] just signed up" | Email digest |
| Upload first track | "[Name] uploaded their first track" | Email digest |
| Upgrade plan | "🎉 [Name] upgraded to [Plan]! MRR +$X" | Email immédiat |
| Downgrade/cancel | "⚠️ [Name] cancelled [Plan]. MRR -$X" | Email immédiat |
| 7 jours inactif (paying) | "[Name] ([Plan]) hasn't logged in for 7 days" | Email digest |
| 30 jours inactif (paying) | "🚨 [Name] ([Plan]) inactive for 30 days — churn risk" | Email immédiat |
| Milestone | "🎯 [X] users reached!" | Email immédiat |
| Edge Function erreur > 10% | "⚠️ [Function] error rate: [X]% in last hour" | Email immédiat |
| Storage > 80% d'un workspace | "Storage warning: [Workspace] at [X]% capacity" | Email digest |

### Email digest quotidien (6h du matin)

```
📊 Trakalog Daily Report — April 25, 2026

USERS
  New signups: 12 (+3 vs yesterday)
  Active today: 45
  Total: 1,234

REVENUE
  MRR: $4,567 (+$87)
  New subscriptions: 3 (2× Pro, 1× Starter)
  Cancellations: 1 (Starter)

CONTENT
  Tracks uploaded: 67
  Pitches sent: 23
  Shared links created: 34

ALERTS
  ⚠️ 5 paying users inactive > 7 days
  ⚠️ Edge Function smart-ar: 3 errors in last 24h
```

---

## 6. Scalabilité

### 10-100 users (beta)
- Toutes les queries en live (COUNT, SELECT)
- Pas besoin de cache
- Recharts côté client suffit

### 100-1,000 users
- Ajouter `admin_metrics_cache` pour les KPIs lourds
- Pagination serveur sur toutes les listes
- Index DB sur les colonnes fréquemment filtrées

### 1,000-10,000 users
- Cron job hourly pour les métriques
- Matérialized views pour les agrégations lourdes (tracks par genre, plays par jour)
- Pagination curseur au lieu d'offset
- Considérer un data warehouse séparé (BigQuery, ClickHouse) pour les analytics lourdes

### 10,000-100,000 users
- Data warehouse obligatoire
- Event streaming (Kafka ou équivalent) pour les métriques temps réel
- Dashboard admin séparé du frontend principal (sous-domaine admin.trakalog.com)
- Rate limiting côté admin (même les admins ne doivent pas pouvoir lancer 100 exports CSV simultanés)

---

## 7. Stack recommandé

| Composant | Outil | Raison |
|---|---|---|
| Charts | recharts (déjà installé) | Léger, React natif |
| Tables | @tanstack/react-table | Pagination, tri, filtres, virtualisation |
| Date range picker | react-day-picker (déjà dans shadcn) | Cohérent avec le design system |
| Export CSV | csv-stringify ou natif | Léger |
| Email digest | Resend (déjà configuré) | Même infra |
| Cron | Supabase pg_cron ou Edge Function scheduled | Pas de serveur supplémentaire |
| Impersonation | JWT custom claim ou session swap | Sécurisé |

---

## Dépendances

- **Billing/Stripe** ⏳ (nécessaire pour les métriques revenue)
- **audit_logs** ✅ (table déjà créée)
- **recharts** ✅ (déjà dans package.json)
- **Resend** ✅ (déjà configuré pour les emails)
- **Edge Functions** ✅ (infrastructure déjà en place)

---

*Ce document est la source de vérité pour l'implémentation du Admin Dashboard Trakalog.*
