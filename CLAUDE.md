# CLAUDE.md — Trakalog (source de vérité)

> À jour : 30 juin 2026. Ce fichier est lu au début de chaque session Claude Code.
> Le mettre à jour après chaque session majeure.

---

## Qui je suis

Yannick Rastogi, fondateur solo + CTO de **Trakalog**. Je travaille **en français**. Tu es mon CTO IA.

**Communication :** direct, concis, step-by-step. Pas de blabla, va à l'essentiel. Explique le "pourquoi" seulement quand c'est important. Pour les décisions importantes : options + ta reco claire.

---

## Le projet

**Trakalog** = SaaS premium de gestion de catalogue musical **pré-release** pour producteurs, artistes, labels, A&R, superviseurs musicaux et pros du sync.

**Positionnement :** « le système nerveux du catalogue intelligent ». Disco stocke et partage (= Dropbox pour la musique) ; Trakalog **protège, analyse, connecte et fait travailler** le catalogue. Différenciateurs : watermarking invisible + leak tracing, splits/signatures, Sonic DNA, Smart A&R, sécurité enterprise, tout-inclus.

---

## Stack technique

- **Frontend :** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion → **Vercel** (app.trakalog.com)
- **Backend :** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Storage :** Cloudflare R2 (egress gratuit, $0.015/Go/mois)
- **Microservices Railway :** `services/watermark` (audiowmark) + `sonic-dna-service` (Essentia/librosa)
- **IA :** Groq (Whisper + Llama 3.3 70B), Claude (Haiku/Sonnet — Maestro à venir)
- **Email :** Resend (noreply@trakalog.com)
- **Billing :** Stripe (mode test)

---

## Infrastructure (valeurs réelles)

| Élément | Valeur |
|---|---|
| Supabase project ID | `xhmeitivkclbeziqavxw` |
| Repo GitHub | `github.com/yannickrastogi/trakalo-muse-palette` |
| Chemin local | `~/Desktop/DEV/trakalog-app/` |
| R2 account ID | `98dfdbe6c0f7841eb91593b8af3eea71` |
| R2 buckets | `trakalog-tracks`, `trakalog-covers`, `trakalog-stems`, `trakalog-watermarked`, `trakalog-documents` |
| Railway watermark | `services/watermark/` (Ubuntu 24.04 + audiowmark 0.6.5 + ffmpeg + Express) |
| Railway sonic-dna | `sonic-dna-service/` (Python + Essentia/librosa) |
| Env vars frontend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |

Railway redéploie automatiquement sur push GitHub. CLI Railway non installé localement → confirmer les builds dans le dashboard.

---

## ⚙️ Workflow obligatoire (à respecter à chaque fois)

### 1. Cowork audit D'ABORD
Diagnostic + validation SQL en conversation Cowork **avant** tout prompt Claude Code. Claude Code génère parfois du SQL/logique subtilement faux — toujours valider en amont.

### 2. Structure de prompt Claude Code (ordre strict)
1. **Explorer agent (Haiku)** — diagnostiquer/cartographier les fichiers, ne rien changer
2. **Fix steps**
3. **Reviewer agent (Sonnet)** — vérifier les régressions
4. **`/security-review` — AU PREMIER PLAN, JAMAIS en background / sous-tâche** (les agents security en background ne rendent jamais la main → blocage récurrent)
5. `git add . && git commit -m '...' && git push`
6. `supabase functions deploy <name>` si une Edge Function a été modifiée

### 3. Format
- **1 prompt = 1 seul bloc copiable** (jamais éclaté)
- Chaque prompt inclut les **3 règles** :
  1. Ne pas toucher au code qui marche déjà
  2. Code sécurisé (pas d'XSS/eval, RPC SECURITY DEFINER pour les writes DB)
  3. Tout doit encore marcher après les changements
- **Commit + push toujours inclus** dans la séquence (ne jamais l'oublier)

### 4. Labels d'exécution (sans exception)
- `Terminal` — terminal Mac direct
- `Cowork` — conversation Cowork
- `Claude Code` — Claude Code CLI

---

## Conventions SQL

- **Jamais `$$`** → toujours `$func$ ... $func$` ; pour les DROP : `$drop$ ... $drop$`
- **`apply_migration` (via Supabase MCP) préféré** à copier du SQL dans le terminal (risque de troncature/corruption — confirmé plusieurs fois)
- Dropper les fonctions via **boucle `pg_proc`** avant recreate (PostgreSQL identifie les overloads par types de params, pas par noms → un rename ou un nouvel ordre de params crée un doublon)
- **Jamais auto-exécuter du SQL en prod sans validation.** Bloc copiable unique pour exécution manuelle dans Supabase SQL Editor, un seul bloc à la fois en cas d'erreur
- Fonctions de garde présentes en base : `assert_caller(_user_id uuid)` (anti-usurpation) et `require_workspace_access_level(_user_id, _workspace_id, _min_level text)`
- Enums : **cast explicite** dans les RPC (`_status::track_status`, `'active'::link_status`)

---

## Migrations SQL — règle absolue

Le repo décrit la production. Une baseline a été posée le 2 août 2026
(`supabase/migrations/20260626144305_baseline_prod.sql`) après une dérive totale :
65 migrations appliquées en prod sans aucun fichier correspondant dans le repo.
Cette dérive a coûté 3 bugs bloquants (inscription cassée, page /invite en crash,
rating impossible à enregistrer).

RÈGLE : toute modification de la base de données produit un fichier de migration
versionné dans `supabase/migrations/`, sans exception.

- Nom de fichier obligatoire : `<timestamp 14 chiffres>_description.sql`
  (ex. `20260802143000_add_deletion_scheduled_at.sql`).
  Un préfixe à 8 chiffres ou absent = fichier ignoré par le CLI. 14 des 20 anciens
  fichiers étaient dans ce cas et n'ont jamais rien appliqué.
- Quand du SQL est appliqué via le MCP Supabase (`apply_migration`), le MÊME SQL doit être
  déposé dans `supabase/migrations/` dans le même lot. Appliquer sans versionner reconstitue
  la dette.
- `supabase/migrations/_archive/` contient l'historique : les 20 anciens fichiers et les
  65 migrations extraites de la production. C'est de la documentation, à ne jamais rejouer
  et à ne pas modifier.
- Ne jamais éditer la baseline. Toute évolution du schéma passe par une nouvelle migration.

---

## Learnings critiques

### Watermarking (CORRIGÉ — l'ancien learning était faux)
- **audiowmark strength 10+ survit à la compression MP3/Opus/AAC dès 128 kbps** (prouvé empiriquement sur Ubuntu 24.04 = l'OS de Railway). Strength 12 donne de la marge pour la re-compression d'un fichier fuité.
- Les **copies de livraison watermarkées sont servies en MP3 128k** (~10-15× plus légères que le WAV). Le **WAV master reste intact** dans `trakalog-tracks` ; seules les copies du bucket `trakalog-watermarked` sont compressées.
- Le `/decode` Railway parse la sortie d'audiowmark 0.6.5 : le 2e token est un **timestamp** (`0:00`) ou `all`, **pas** un entier. Regex : `/^pattern\s+\S+\s+([0-9a-f]{32})\s+([\d.]+)/i`. Seuil de détection : score ≥ 1.0 (vrai watermark ~1.5, bruit ~0.2).
- Dérivations : nom de fichier cache = `SHA-256(link_id_email_storage_path)` ; payload audiowmark = `SHA-256("lid_{link_id}_v_{email}").substring(0,32)` = `watermark_payloads.hash_hex`.

### Auth / session
- **Ne JAMAIS écrire dans la clé Supabase native** — laisser Supabase gérer sa persistence (`persistSession: true`)
- `autoRefreshToken: false` au niveau module, démarré manuellement seulement si session valide
- Pages publiques (SharedLink, Studio, Sign, AcceptInvitation…) : **zéro GoTrueClient**, fetch REST direct, import depuis `constants.ts`
- `ensureSession()` (refreshSession → getSession → backup localStorage) **avant** de lire `user.id`. `auth.uid()` peut retourner NULL sur sessions instables.

### RLS / sécurité
- Tout insert/update sur tables protégées par RLS → **RPC SECURITY DEFINER** avec `_user_id` explicite
- Rate limiting sur toutes les Edge Functions
- Suppressions sensibles (audit, leak traces) → RPC **admin-only** via `require_workspace_access_level(..., 'admin')`

### Scope discipline
- **Toucher UNIQUEMENT ce qui est strictement nécessaire.** Jamais refactor, nettoyer ou simplifier ce qui n'est pas demandé. Jamais changer du code qui marche.

---

## Gotchas data shape (cause de bugs réels)

- **`tracks.genre` = `text[]`** (array, pas string !). Collecter les genres : flatten tous les arrays → dedupe → trier. Filtrer : `Array.includes`, pas `===`.
- `contacts.pro` = `text[]` ; `contacts.stage_name` existe
- Splits : JSONB `roles[]` (+ rétrocompat `role` string), `pros[]` (+ rétrocompat)
- Enums tracks : `track_status` (available/on_hold/released), `track_type`, `track_gender`, `document_status` (draft/pending/signed)
- `insert_track` : metadata (written_by, etc.) sauvée via follow-up `update_track`, pas en params directs

---

## Edge Functions clés

| Fonction | Rôle |
|---|---|
| `get-watermarked-audio` | encode la copie watermarkée MP3 128k (player + download), cache par visiteur |
| `get-audio-url` | preview/playback non-watermarké (bucket tracks) |
| `trace-leak` | décode le watermark, résout l'IP du leaker, insère dans `leak_traces` |
| `analyze-sonic-dna` | analyse audio à l'upload |
| `smart-ar` | matching catalogue ↔ brief (Groq) |
| `transcribe-lyrics` | Whisper |
| `send-*` | emails (pitch, invitation, signatures…) via Resend |

Edge Functions = redéploiement manuel après push : `supabase functions deploy <name>`.

---

## Suivi / follow-ups connus

- **Trakalog Pack ZIP download sert encore l'audio brut non-watermarké** → trou de traçabilité, à fixer (même logique que le download single).
- **Lifecycle policy R2** : purge des copies `watermarked` non-accédées > 90j, à activer quand le bucket dépasse ~10 Go. Pas urgent (coût négligeable). Safe : une copie est reconstructible à l'identique, le leak tracing dépend de `watermark_payloads`, pas du fichier caché.
- **Billing** : `docs/TRAKALOG_BILLING.md` à resync — nouveau modèle **user-based** ($10/$25/$45), seats différenciés par access level (viewers gratuits dès Pro), Trakalog Access browse = Business / opt-in = Pro. En cours.

---

## Docs de référence (repo)

`docs/TRAKALOG_BILLING.md`, `TRAKALOG_MAESTRO.md`, `TRAKALOG_DROP.md`, `TRACK_VERSIONING.md`, `ISRC_GENERATION.md`, `DDEX_PRO_EXPORTS.md`, `TRAKALOG_ADMIN_DASHBOARD.md`, `ARTIST_SEEKER.md`, `BRIEF_SEEKER.md`, `ONBOARDING.md`, `TRAKALOG_AI_AGENTS_VISION.md`, `TRAKALOG_ARCHITECTURE.md`.

---

## Setup Claude Code

CLAUDE.md (ce fichier) + skills (supabase-rpc, edge-function, react-component, shared-link, security, UI UX Pro Max) + hooks (typecheck auto, blocker de commandes dangereuses) + 2 subagents (explorer/Haiku, reviewer/Sonnet).
