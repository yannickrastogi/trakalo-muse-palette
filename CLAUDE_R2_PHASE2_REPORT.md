# R2 Migration — Phase 2 Report

> **Branche** : `claude/r2-phase2-storage-abstraction-20260608-1752`
> **Tag de rollback** : `pre-r2-phase2-20260608-175217`
> **Date** : 2026-06-08
> **Cutover** : ❌ AUCUN. `STORAGE_PROVIDER=supabase` reste le default. Zéro changement runtime.

---

## TL;DR

✅ **Storage abstraction layer en place** : `supabase/functions/_shared/storage.ts` expose une interface `StorageProvider` uniforme avec 2 implémentations (Supabase Storage par default, Cloudflare R2 via feature flag).

✅ **4 Edge Functions adaptées** pour passer par l'abstraction au lieu d'appeler `supabase.storage.from(...)` directement. Code Supabase original conservé en commentaires inline pour rollback rapide.

✅ **Tests R2 30/30 passent** : upload + signed URL GET + download + exists + delete sur les 5 buckets R2 réels (trakalog-tracks, trakalog-stems, trakalog-watermarked, trakalog-covers, trakalog-documents). AWS Signature V4 pur Deno validé en condition réelle.

✅ **Zéro régression attendue** en prod tant que `STORAGE_PROVIDER=supabase` (default).

✅ **Aucun secret commité** : R2 credentials uniquement dans `.env.local` (gitignored). Le code lit tout depuis `Deno.env.get(...)`.

---

## 1. Architecture du wrapper

### Interface publique

`supabase/functions/_shared/storage.ts` expose :

```typescript
export type BucketName = "tracks" | "stems" | "watermarked" | "covers" | "documents";

export interface StorageProvider {
  createSignedUrl(bucket: BucketName, key: string, expiresInSec?: number): Promise<string>;
  upload(bucket: BucketName, key: string, body: Uint8Array | ArrayBuffer | Blob, contentType?: string): Promise<void>;
  download(bucket: BucketName, key: string): Promise<Uint8Array>;
  delete(bucket: BucketName, key: string): Promise<void>;
  exists(bucket: BucketName, key: string): Promise<boolean>;
  readonly name: "supabase" | "r2";
}

export function getStorageProvider(): StorageProvider;
```

### Factory

`getStorageProvider()` lit `STORAGE_PROVIDER` (`Deno.env.get`) :
- `"supabase"` (default) → `SupabaseStorageProvider`
- `"r2"` → `R2StorageProvider`

### `SupabaseStorageProvider`

Wrap minimal autour du client `@supabase/supabase-js@2` créé avec `SERVICE_ROLE_KEY`. Tous les arguments existants conservés (`upsert: false` sur upload, expiry par défaut 300s, etc.). Lance des `Error` standard avec messages préfixés `[storage:supabase]`.

### `R2StorageProvider`

Implémentation pure Deno :
- AWS Signature V4 via Web Crypto API uniquement (HMAC-SHA256, SHA-256, importKey, sign)
- Path-style addressing : `/{bucket}/{key}` (compatible R2)
- Encoding RFC 3986 strict (encodeURIComponent + post-processing des 5 caractères `[!'()*]`)
- Encoding per-segment du path (préserve les `/` entre segments, encode `/` *dans* un segment → bloque le path traversal au niveau HTTP)
- `UNSIGNED-PAYLOAD` pour les PUT (évite de hasher le body up-front sur de gros WAV)
- Région `auto`, service `s3`, agrégateur OpenTimestamps non utilisé ici
- Mapping logique → physique des buckets via env vars `R2_BUCKET_{TRACKS,STEMS,WATERMARKED,COVERS,DOCUMENTS}`

Lance des `Error` standard avec messages préfixés `[storage:r2]`.

### Env vars requises au runtime R2

| Variable | Exemple | Rôle |
|---|---|---|
| `STORAGE_PROVIDER` | `r2` ou `supabase` | Toggle factory. Default `supabase`. |
| `R2_ENDPOINT` | `https://98dfdbe6c0f7841eb91593b8af3eea71.r2.cloudflarestorage.com` | Endpoint S3-compatible R2 |
| `R2_ACCESS_KEY_ID` | (32 hex chars) | Access key R2 |
| `R2_SECRET_ACCESS_KEY` | (64 hex chars) | Secret key R2 |
| `R2_BUCKET_TRACKS` | `trakalog-tracks` | Mapping logical→physical |
| `R2_BUCKET_STEMS` | `trakalog-stems` | id. |
| `R2_BUCKET_WATERMARKED` | `trakalog-watermarked` | id. |
| `R2_BUCKET_COVERS` | `trakalog-covers` | id. |
| `R2_BUCKET_DOCUMENTS` | `trakalog-documents` | id. |

`R2_ACCOUNT_ID` n'est **pas** utilisé directement par le code (l'endpoint le contient déjà). Mais on le push quand même dans les secrets Supabase pour traçabilité.

---

## 2. Edge Functions modifiées

Code Supabase original conservé en commentaires inline (préfixe `// Legacy Supabase-direct call (kept ...)`) pour permettre un rollback ligne-à-ligne sans `git revert`.

| Fichier | Diff | Calls storage adaptés |
|---|---|---|
| `supabase/functions/get-audio-url/index.ts` | +13 / -9 | 1× `createSignedUrl("tracks", path, 300)` |
| `supabase/functions/get-watermarked-audio/index.ts` | +46 / -28 | 1× `exists("watermarked", path)` + 1× `createSignedUrl("watermarked", path, 300)` cache hit + 1× `createSignedUrl("tracks", path, 60)` + 1× `upload("watermarked", path, buf, "audio/wav")` + 1× `createSignedUrl("watermarked", path, 300)` |
| `supabase/functions/analyze-sonic-dna/index.ts` | +12 / -8 | 1× `createSignedUrl("tracks", path, 600)` |
| `supabase/functions/transcribe-lyrics/index.ts` | +15 / -7 | 1× `createSignedUrl("tracks", path, 3600)` dans helper `fetchViaSignedUrl` |

**Frontend (`src/`) : 0 modification.** Décision Option A du brief — les uploads frontend (StemsTab, UploadTrackModal) restent sur Supabase pour Phase 2. Bascule en Phase 3 quand on créera l'Edge Function `get-upload-url` qui retourne une signed PUT URL R2.

**Fichier annexe** : `deno.lock` créé par le premier `deno check`. Sans secret. Safe à commit.

---

## 3. Scripts de test

### `scripts/test-r2-standalone.ts` (exécuté ✅)

Test R2 pur (pas besoin de SUPABASE_SERVICE_ROLE_KEY) — valide la V4 signing contre les 5 buckets R2 réels.

```bash
deno run -A --env-file=.env.local scripts/test-r2-standalone.ts
```

**Résultat** : 30/30 tests passent (6 tests × 5 buckets : exists-pre / upload / exists-post / signed URL GET / download / delete + exists-false).

### `scripts/test-r2-parity.ts` (prêt, pas exécuté localement)

Test de parité Supabase ↔ R2 — nécessite `SUPABASE_SERVICE_ROLE_KEY` (secret prod). Yannick peut le lancer si besoin :

```bash
export SUPABASE_URL=https://xhmeitivkclbeziqavxw.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<secret prod>
deno run -A --env-file=.env.local scripts/test-r2-parity.ts
```

Compare byte-à-byte upload/download via les deux providers pour la même clé.

---

## 4. ⚠️ Commandes à exécuter par Yannick (secrets Supabase)

**À FAIRE avant de pouvoir basculer en R2 en Phase 4.** Pour la Phase 2, **aucune action obligatoire** — le default `supabase` fonctionne sans ces secrets.

Si tu veux préparer R2 dès maintenant (recommandé — secrets cachés, switch trivial en Phase 4) :

```bash
# 1. Charger les credentials depuis .env.local sans les afficher dans l'historique
set -a; source .env.local; set +a

# 2. Push les secrets R2 vers Supabase (project ref: xhmeitivkclbeziqavxw)
supabase secrets set \
  R2_ACCOUNT_ID="$R2_ACCOUNT_ID" \
  R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  R2_ENDPOINT="$R2_ENDPOINT" \
  R2_BUCKET_TRACKS="$R2_BUCKET_TRACKS" \
  R2_BUCKET_STEMS="$R2_BUCKET_STEMS" \
  R2_BUCKET_WATERMARKED="$R2_BUCKET_WATERMARKED" \
  R2_BUCKET_COVERS="$R2_BUCKET_COVERS" \
  R2_BUCKET_DOCUMENTS="$R2_BUCKET_DOCUMENTS" \
  --project-ref xhmeitivkclbeziqavxw

# 3. Vérifier (ne montre pas les valeurs, juste les noms)
supabase secrets list --project-ref xhmeitivkclbeziqavxw | grep R2_

# 4. (Optionnel, pour explicite) Forcer STORAGE_PROVIDER=supabase par défaut
supabase secrets set STORAGE_PROVIDER=supabase --project-ref xhmeitivkclbeziqavxw
```

**Note** : `unset` après pour purger tes variables shell :
```bash
unset R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT \
      R2_BUCKET_TRACKS R2_BUCKET_STEMS R2_BUCKET_WATERMARKED \
      R2_BUCKET_COVERS R2_BUCKET_DOCUMENTS
```

---

## 5. Procédure de déploiement Phase 2 (recommandée)

1. **Merge la branche sur main** (PR review) → CI build clean attendue (déjà vérifié localement)
2. **Redeploy les 4 Edge Functions modifiées** :
   ```bash
   supabase functions deploy get-audio-url --project-ref xhmeitivkclbeziqavxw
   supabase functions deploy get-watermarked-audio --project-ref xhmeitivkclbeziqavxw
   supabase functions deploy analyze-sonic-dna --project-ref xhmeitivkclbeziqavxw
   supabase functions deploy transcribe-lyrics --project-ref xhmeitivkclbeziqavxw
   ```
3. **Smoke test prod** (cf. section 6) — comportement doit être identique à avant.
4. (Optionnel mais recommandé) **Push les secrets R2** (cf. section 4) → prépare la Phase 4 sans rien casser.

---

## 6. Procédure de smoke test post-deploy

### Test 1 — Lecture audio (player utilisateur connecté)

```bash
curl -X POST 'https://xhmeitivkclbeziqavxw.supabase.co/functions/v1/get-audio-url' \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" \
  -d '{"track_id":"<UUID-DUN-TRACK-REEL>","quality":"preview"}'
```

Attendu : `{ "url": "https://xhmeitivkclbeziqavxw.supabase.co/storage/v1/object/sign/tracks/..." }`. URL valable 300s.

### Test 2 — Watermarking (shared link)

Ouvrir un shared link existant (ex: `https://app.trakalog.com/share/<slug>`), entrer un email visiteur, jouer un track → l'audio doit streamer normalement. Vérifier dans le tab Network qu'un appel `/functions/v1/get-watermarked-audio` retourne 200 avec un signed URL valide.

### Test 3 — Sonic DNA (upload + analyse)

Uploader un nouveau track depuis l'UI → l'analyse Sonic DNA doit compléter normalement (BPM + key remplis automatiquement dans la fiche track).

### Test 4 — Transcription lyrics

Sur un track existant, cliquer "Auto-transcribe lyrics" → les lyrics doivent apparaître avec le marker `[auto-transcribed]`.

**Critère de succès** : 4/4 tests identiques au comportement pré-Phase-2.

---

## 7. Procédure de switch vers R2 (Phase 4 — pas maintenant)

Quand la migration data Phase 3 sera complète (rclone Supabase → R2 + DB paths mis à jour si nécessaire) :

```bash
# 1. Vérifier que tous les secrets R2 sont en place
supabase secrets list --project-ref xhmeitivkclbeziqavxw | grep R2_

# 2. Switch (instantané)
supabase secrets set STORAGE_PROVIDER=r2 --project-ref xhmeitivkclbeziqavxw

# 3. Redeploy les 4 Edge Functions pour qu'elles relisent la nouvelle valeur
supabase functions deploy get-audio-url --project-ref xhmeitivkclbeziqavxw
supabase functions deploy get-watermarked-audio --project-ref xhmeitivkclbeziqavxw
supabase functions deploy analyze-sonic-dna --project-ref xhmeitivkclbeziqavxw
supabase functions deploy transcribe-lyrics --project-ref xhmeitivkclbeziqavxw

# 4. Smoke test (cf section 6) sur 1 track récent et 1 track historique
# 5. Monitorer les logs Edge Functions 30 min
```

---

## 8. Procédure de rollback

### Rollback Phase 4 → Phase 2 (R2 cassé, retour Supabase)

```bash
supabase secrets set STORAGE_PROVIDER=supabase --project-ref xhmeitivkclbeziqavxw
supabase functions deploy get-audio-url --project-ref xhmeitivkclbeziqavxw
supabase functions deploy get-watermarked-audio --project-ref xhmeitivkclbeziqavxw
supabase functions deploy analyze-sonic-dna --project-ref xhmeitivkclbeziqavxw
supabase functions deploy transcribe-lyrics --project-ref xhmeitivkclbeziqavxw
```

Effet immédiat — la prochaine invocation des Edge Functions relira `STORAGE_PROVIDER=supabase` et utilisera `SupabaseStorageProvider`.

### Rollback Phase 2 → main (abstraction qui casse)

```bash
git checkout main
git reset --hard pre-r2-phase2-20260608-175217   # tag posé en début de mission
# Redeploy les 4 Edge Functions
```

Ou via UI : revert le merge commit sur GitHub.

---

## 9. Risques résiduels & dette pour Phase 3/4

(Issus de la revue Sonnet)

1. **`get-watermarked-audio` ligne 48** : le strip URL Supabase (`/object/sign/tracks/...`) ne reconnaît pas le format R2. Si en Phase 4 le frontend passe un format différent (ex: `r2://trakalog-tracks/...`), ce check passera silencieusement. **À adresser en Phase 3** avant le cutover : soit on garde le format relatif (path nu) en DB et tout passe par l'abstraction (recommandé), soit on étend le strip pour matcher `r2://` aussi.

2. **`transcribe-lyrics` ligne 232** : le catch outer expose `err.message` au client. Bug pré-existant, hors-scope de cette PR — à corriger indépendamment.

3. **`SupabaseStorageProvider.exists()`** : pas de HEAD natif, simulé via `createSignedUrl`. Faux négatif possible si signing échoue alors que le fichier existe. Comportement identique à avant. `R2StorageProvider.exists()` fait un vrai HEAD — donc Phase 4 corrige ça automatiquement.

4. **`getR2Config()` réévalué à chaque appel** : micro-overhead négligeable. Pas d'urgence.

5. **Frontend uploads (StemsTab)** : restent sur Supabase Storage en Phase 2. Phase 3 doit créer `get-upload-url` Edge Function qui retourne signed PUT URL R2, puis adapter StemsTab.

---

## 10. Checklist commit

- [x] `deno check` clean sur 5 fichiers Deno (storage.ts + 4 EFs)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` clean
- [x] Tests R2 standalone : 30/30 passent
- [x] Reviewer agent : 0 blocker
- [x] Scan secrets dans le diff : 0 leak
- [x] `.env.local` gitignored confirmé
- [x] Aucun frontend modifié (zéro risque côté client)

---

**Phase 2 livrée.** Prête à merger sur main. Phase 3 = migration data Supabase → R2. Phase 4 = switch `STORAGE_PROVIDER=r2`.
