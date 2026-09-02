# TRAKALOG — Migration Storage Supabase → Cloudflare R2

> **Document créé le :** 17 mai 2026
> **Objectif :** Migrer tous les fichiers audio (tracks, stems, watermarked) de Supabase Storage vers Cloudflare R2 pour réduire les coûts d'environ 85-90% et permettre un egress illimité gratuit.
> **Statut :** Prêt à implémenter — à exécuter après Stripe/Billing
> **Durée estimée :** 5-7 jours dev
> **Risque :** Moyen (touche au cœur du système audio) — faire sur une branche dédiée avec tests end-to-end

---

## 1. Pourquoi cette migration

### Le problème actuel
Supabase Storage est conçu pour des fichiers transactionnels (avatars, attachments), pas pour des catalogues musicaux de plusieurs TB. À l'échelle Trakalog (audio WAV + stems + previews + watermarked per-visitor), les coûts deviennent prohibitifs très vite.

| Métrique | Supabase Storage | Cloudflare R2 |
|---|---|---|
| Storage | ~$0.021/GB ($21/TB) | $0.015/GB ($15/TB) |
| Egress | $0.09/GB après 250 GB | **$0 — illimité** |
| Free tier | Inclus dans le plan Pro ($25/mois) | 10 GB storage + 1M class A + 10M class B ops |
| Class A ops (uploads, list) | Inclus | $4.50 / 1M |
| Class B ops (downloads, head) | Inclus | $0.36 / 1M |
| Compatibilité S3 | Partielle | ✅ Complète |
| CDN intégré | Non | ✅ Cloudflare network (300+ POPs) |

### Le gain à 1000 users payants
- 600 Starter × 20 GB + 350 Pro × 80 GB + 50 Business × 300 GB = **~55 TB stockés**
- Supabase : ~$1 150/mois storage + plusieurs centaines de $/mois d'egress
- R2 : **~$825/mois storage + $0 egress**
- **Économie : $400-700/mois minimum, scaling linéaire**

### Pourquoi R2 (et pas B2)
- **Simplicité** : un seul provider, un seul SDK, une seule facture
- **Tu utilises déjà Cloudflare** pour le DNS (trakalog.com)
- **Egress gratuit nativement** sans config Bandwidth Alliance
- **S3-compatible complet** : si jamais tu migres vers B2 plus tard, c'est trivial (changer endpoint + credentials)
- **Custom domain natif** : tu peux servir tes fichiers sous `audio.trakalog.com` avec HTTPS auto

---

## 2. Architecture cible

```
┌─────────────────────────────────────────────────────────────┐
│                     UTILISATEUR / LISTENER                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│             CLOUDFLARE CDN (300+ edges worldwide)           │
│             audio.trakalog.com (custom domain)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (signed URL ou access key)
┌─────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE R2 BUCKETS                     │
│                                                             │
│   ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│   │ trakalog-      │  │ trakalog-      │  │ trakalog-    │ │
│   │ tracks         │  │ stems          │  │ watermarked  │ │
│   │ (audio orig)   │  │ (stems audio)  │  │ (cache WM)   │ │
│   └────────────────┘  └────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ (signed PUT URLs)
                              │
┌─────────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTIONS                        │
│                                                             │
│  - get-audio-url       (génère signed URL R2 pour lecture)  │
│  - get-upload-url      (génère signed URL R2 pour upload)   │
│  - get-watermarked-audio (cache R2 + Railway watermark)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  SUPABASE POSTGRES (inchangé)               │
│         tracks.audio_url, stems.url, watermark_payloads     │
└─────────────────────────────────────────────────────────────┘
```

### Ce qui reste sur Supabase Storage
- **Covers art** (volume faible, ~50KB par image, accès fréquent mais small egress)
- **Documents PDF** (paperwork, signed PDFs — usage modéré)
- **Avatars utilisateurs** (volume négligeable)

### Ce qui migre vers R2
- **Audio originaux** (WAV, FLAC, MP3, AIFF, M4A, OGG) — bucket `trakalog-tracks`
- **Audio previews** (MP3 128kbps compressés) — bucket `trakalog-tracks` (sous-dossier `previews/`)
- **Stems** (multi-fichiers par track) — bucket `trakalog-stems`
- **Audio watermarkés** (cache per-visitor) — bucket `trakalog-watermarked`

---

## 3. Setup Cloudflare R2 (Phase 0 — préparation)

### 3.1 Activer R2 sur ton compte Cloudflare
1. Dashboard Cloudflare → R2 → "Purchase R2"
2. Activer (carte requise, free tier généreux jusqu'à 10 GB)
3. Settings → R2 → Manage R2 API Tokens → "Create API Token"
4. Permissions : **Object Read & Write**
5. Specify bucket : Apply to all buckets (ou créer un token par bucket pour granularité)
6. TTL : forever (ou rotation 90 jours selon ta préférence)
7. **Noter** : Access Key ID, Secret Access Key, Endpoint URL (format `https://<account_id>.r2.cloudflarestorage.com`)

### 3.2 Créer les buckets
Via le dashboard R2, créer 3 buckets :

```
trakalog-tracks       (audio originaux + previews)
trakalog-stems        (stems multi-fichiers)
trakalog-watermarked  (cache audio watermarkés)
```

Pour chaque bucket :
- Region : **Automatic** (Cloudflare optimise selon les listeners)
- Settings → Public Access : **Disabled** (on utilise des signed URLs uniquement)
- Settings → CORS : à configurer après (voir section 3.4)

### 3.3 Configurer le custom domain (optionnel mais recommandé)
1. Bucket `trakalog-tracks` → Settings → Custom Domains → "Connect Domain"
2. Entrer `audio.trakalog.com`
3. Cloudflare crée automatiquement le CNAME + certificat SSL
4. Attendre ~5 minutes pour propagation

**Note** : ce custom domain ne sert que pour la perception du branding dans les URLs. Les signed URLs fonctionnent quand même via le domaine R2 standard.

### 3.4 Configurer CORS sur les buckets
Pour permettre les uploads directs depuis le navigateur Trakalog. Via Wrangler CLI ou le dashboard :

```json
[
  {
    "AllowedOrigins": [
      "https://app.trakalog.com",
      "https://trakalog.com",
      "http://localhost:5173",
      "http://localhost:8080"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Appliquer ce CORS sur les 3 buckets.

### 3.5 Ajouter les secrets Supabase

Dans Supabase Dashboard → Project Settings → Edge Functions → Secrets, ajouter :

```
R2_ACCOUNT_ID=<ton_account_id>
R2_ACCESS_KEY_ID=<access_key_créée_étape_3.1>
R2_SECRET_ACCESS_KEY=<secret_créé_étape_3.1>
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://audio.trakalog.com  (ou laisser vide si pas de custom domain)
R2_BUCKET_TRACKS=trakalog-tracks
R2_BUCKET_STEMS=trakalog-stems
R2_BUCKET_WATERMARKED=trakalog-watermarked
```

---

## 4. Code — Helper R2 partagé

### 4.1 Créer le helper Edge Function `_shared/r2.ts`

Ce module gère toutes les opérations R2 (signed URLs upload/download, S3 v4 signing) sans dépendance externe lourde.

```typescript
// supabase/functions/_shared/r2.ts

import { createHmac, createHash } from "https://deno.land/std@0.224.0/node/crypto.ts";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
}

function getR2Config(): R2Config {
  return {
    accountId: Deno.env.get("R2_ACCOUNT_ID")!,
    accessKeyId: Deno.env.get("R2_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("R2_SECRET_ACCESS_KEY")!,
    endpoint: Deno.env.get("R2_ENDPOINT")!,
  };
}

/**
 * Génère une signed URL pour télécharger un fichier depuis R2
 * Compatible AWS Signature V4 (R2 implémente le standard S3)
 *
 * @param bucket - Nom du bucket R2
 * @param key - Chemin du fichier dans le bucket
 * @param expiresInSeconds - Durée de validité (défaut 300s = 5 min)
 */
export async function getSignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  return signRequest(bucket, key, "GET", expiresInSeconds);
}

/**
 * Génère une signed URL pour uploader un fichier vers R2
 */
export async function getSignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresInSeconds = 3600
): Promise<string> {
  return signRequest(bucket, key, "PUT", expiresInSeconds, contentType);
}

/**
 * Supprime un fichier de R2 (server-side, pas de signed URL)
 */
export async function deleteR2Object(bucket: string, key: string): Promise<boolean> {
  const config = getR2Config();
  const url = `${config.endpoint}/${bucket}/${key}`;
  const signedUrl = await signRequest(bucket, key, "DELETE", 300);

  const response = await fetch(signedUrl, { method: "DELETE" });
  return response.ok || response.status === 404;
}

/**
 * AWS Signature V4 — implémentation simplifiée pour R2
 * R2 utilise la région "auto"
 */
async function signRequest(
  bucket: string,
  key: string,
  method: "GET" | "PUT" | "DELETE",
  expiresInSeconds: number,
  contentType?: string
): Promise<string> {
  const config = getR2Config();
  const region = "auto";
  const service = "s3";

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const host = new URL(config.endpoint).host;
  const canonicalUri = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;

  const credential = `${config.accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expiresInSeconds.toString(),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  // Derive signing key
  const kDate = createHmac("sha256", `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  return `${config.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Construit l'URL publique d'un fichier (via custom domain si configuré)
 * À utiliser uniquement pour les fichiers qui doivent rester accessibles longtemps
 * Pour les fichiers protégés, toujours utiliser getSignedDownloadUrl
 */
export function getPublicUrl(bucket: string, key: string): string {
  const customDomain = Deno.env.get("R2_PUBLIC_URL");
  if (customDomain && bucket === Deno.env.get("R2_BUCKET_TRACKS")) {
    return `${customDomain}/${key}`;
  }
  const config = getR2Config();
  return `${config.endpoint}/${bucket}/${key}`;
}
```

### 4.2 Pattern de stockage des paths dans la DB

Pour éviter les confusions, on adopte une convention claire dans les colonnes `audio_url` :

**Avant (Supabase Storage) :**
```
tracks.audio_url = "tracks/workspace_xxx/track_yyy.wav"
```

**Après (R2) :**
```
tracks.audio_url = "r2://trakalog-tracks/workspace_xxx/track_yyy.wav"
```

Le préfixe `r2://` permet de détecter facilement dans le code si le fichier est sur R2 ou encore sur Supabase Storage (pendant la phase de migration progressive).

---

## 5. Edge Functions — Modifications

### 5.1 `get-audio-url` (modifié)

Cette Edge Function génère les signed URLs pour la lecture audio. Elle doit maintenant supporter R2 en priorité, avec fallback Supabase Storage le temps de la migration.

```typescript
// supabase/functions/get-audio-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { isValidUUID } from "../_shared/validation.ts";
import { getSignedDownloadUrl } from "../_shared/r2.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateLimitOk = await checkRateLimit(`get-audio-url:${clientIp}`, 60, 60);
    if (!rateLimitOk) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { track_id, version } = await req.json();
    if (!isValidUUID(track_id)) {
      return new Response(JSON.stringify({ error: "Invalid track_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch audio_url from DB
    const { data: track, error } = await supabase
      .from("tracks")
      .select("audio_url, audio_preview_url")
      .eq("id", track_id)
      .single();

    if (error || !track) {
      console.error("Track not found:", error);
      return new Response(JSON.stringify({ error: "Track not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = version === "preview" ? track.audio_preview_url : track.audio_url;
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Audio not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let signedUrl: string;

    // Detect storage backend by URL prefix
    if (targetUrl.startsWith("r2://")) {
      // R2 storage: "r2://bucket-name/path/to/file"
      const path = targetUrl.replace("r2://", "");
      const [bucket, ...keyParts] = path.split("/");
      const key = keyParts.join("/");
      signedUrl = await getSignedDownloadUrl(bucket, key, 300);
    } else {
      // Supabase Storage (legacy, pendant migration)
      const { data, error: signErr } = await supabase.storage
        .from("tracks")
        .createSignedUrl(targetUrl, 300);
      if (signErr || !data?.signedUrl) {
        console.error("Supabase signing error:", signErr);
        return new Response(JSON.stringify({ error: "Failed to generate audio URL" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      signedUrl = data.signedUrl;
    }

    return new Response(JSON.stringify({ url: signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-audio-url error:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 5.2 `get-upload-url` (NOUVEAU)

Nouvelle Edge Function qui génère une signed URL pour upload direct depuis le navigateur vers R2 (bypass du backend = upload rapide et pas de limite de taille Edge Function).

```typescript
// supabase/functions/get-upload-url/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { isValidUUID, isValidStoragePath } from "../_shared/validation.ts";
import { getSignedUploadUrl } from "../_shared/r2.ts";

const ALLOWED_AUDIO_TYPES = [
  "audio/wav", "audio/wave", "audio/x-wav",
  "audio/mpeg", "audio/mp3",
  "audio/flac", "audio/x-flac",
  "audio/aiff", "audio/x-aiff",
  "audio/m4a", "audio/x-m4a", "audio/mp4",
  "audio/ogg", "audio/vorbis",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateLimitOk = await checkRateLimit(`get-upload-url:${clientIp}`, 30, 60);
    if (!rateLimitOk) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspace_id, track_id, file_name, content_type, file_size, bucket_type } = await req.json();

    if (!isValidUUID(workspace_id) || !isValidUUID(track_id)) {
      return new Response(JSON.stringify({ error: "Invalid workspace_id or track_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_AUDIO_TYPES.includes(content_type)) {
      return new Response(JSON.stringify({ error: "Unsupported audio format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file_size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "File too large (max 50MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user has access to the workspace (RLS bypass via service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isMember } = await supabase.rpc("is_workspace_member", {
      _user_id: user.id,
      _workspace_id: workspace_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Construct R2 key
    const cleanFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const key = `${workspace_id}/${track_id}_${timestamp}_${cleanFileName}`;

    if (!isValidStoragePath(key)) {
      return new Response(JSON.stringify({ error: "Invalid file path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine bucket
    let bucket: string;
    switch (bucket_type) {
      case "track":
        bucket = Deno.env.get("R2_BUCKET_TRACKS")!;
        break;
      case "stem":
        bucket = Deno.env.get("R2_BUCKET_STEMS")!;
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid bucket_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const uploadUrl = await getSignedUploadUrl(bucket, key, content_type, 3600);
    const storagePath = `r2://${bucket}/${key}`;

    return new Response(
      JSON.stringify({
        upload_url: uploadUrl,
        storage_path: storagePath,
        expires_in: 3600,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-upload-url error:", err instanceof Error ? err.message : String(err));
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### 5.3 `get-watermarked-audio` (modifié)

L'Edge Function existante doit maintenant lire/écrire le cache watermarké sur R2 au lieu de Supabase Storage.

```typescript
// supabase/functions/get-watermarked-audio/index.ts (extrait modifié)

import { getSignedDownloadUrl, getSignedUploadUrl } from "../_shared/r2.ts";

// ... (auth, rate limit, validation comme avant)

const watermarkBucket = Deno.env.get("R2_BUCKET_WATERMARKED")!;
const cacheKey = `${linkId}/${visitorEmailHash}.mp3`;

// 1. Check if watermarked version already cached on R2
const checkUrl = await getSignedDownloadUrl(watermarkBucket, cacheKey, 60);
const headResp = await fetch(checkUrl, { method: "HEAD" });

if (headResp.ok) {
  // Cache hit: return signed URL for streaming
  const playUrl = await getSignedDownloadUrl(watermarkBucket, cacheKey, 300);
  return new Response(JSON.stringify({ url: playUrl }), { ... });
}

// 2. Cache miss: get original audio URL, send to Railway watermark service
const originalUrl = await getSignedDownloadUrl(tracksBucket, originalKey, 300);

const wmResponse = await fetch(`${Deno.env.get("WATERMARK_API_URL")}/encode`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": Deno.env.get("WATERMARK_API_KEY")!,
  },
  body: JSON.stringify({
    source_url: originalUrl,
    payload: payloadHex,
  }),
});

const wmBuffer = await wmResponse.arrayBuffer();

// 3. Upload watermarked file to R2 cache
const uploadUrl = await getSignedUploadUrl(watermarkBucket, cacheKey, "audio/mpeg", 600);
await fetch(uploadUrl, {
  method: "PUT",
  body: wmBuffer,
  headers: { "Content-Type": "audio/mpeg" },
});

// 4. Return signed URL pour streaming
const playUrl = await getSignedDownloadUrl(watermarkBucket, cacheKey, 300);
return new Response(JSON.stringify({ url: playUrl }), { ... });
```

---

## 6. Frontend — Modifications

### 6.1 Upload flow (UploadTrackModal.tsx)

**Avant (Supabase Storage) :**
```typescript
const { data, error } = await supabase.storage
  .from("tracks")
  .upload(`${workspaceId}/${fileName}`, file);
```

**Après (R2 via signed URL) :**
```typescript
// 1. Demander une signed URL d'upload à l'Edge Function
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/get-upload-url`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session?.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      track_id: newTrackId,
      file_name: file.name,
      content_type: file.type,
      file_size: file.size,
      bucket_type: "track",
    }),
  }
);

const { upload_url, storage_path } = await response.json();

// 2. Upload direct du navigateur vers R2 (pas de passage par le backend)
const uploadResp = await fetch(upload_url, {
  method: "PUT",
  body: file,
  headers: {
    "Content-Type": file.type,
  },
});

if (!uploadResp.ok) throw new Error("Upload failed");

// 3. Insérer le track avec storage_path = "r2://trakalog-tracks/..."
const { error } = await supabase.rpc("insert_track", {
  _workspace_id: workspaceId,
  _audio_url: storage_path,
  // ... autres params
});
```

### 6.2 Lecture audio (AudioPlayerContext, MiniWaveform, etc.)

**Pas de changement frontend** — le code appelle déjà `get-audio-url` Edge Function qui retourne une signed URL. L'Edge Function gère R2 ou Supabase Storage de manière transparente selon le préfixe `r2://`.

### 6.3 Progress bar pour les uploads

Comme l'upload est direct vers R2, on peut utiliser XHR pour avoir le progress (impossible avec fetch). Code helper :

```typescript
function uploadToR2WithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}
```

---

## 7. RPCs DB — Pas de changement nécessaire

Les RPCs existantes (`insert_track`, `update_track`, `insert_track_document`, etc.) acceptent déjà un `_audio_url text`. On y stocke simplement la nouvelle forme `r2://bucket/key` au lieu du chemin Supabase Storage. **Aucune modification SQL nécessaire.**

---

## 8. Migration des fichiers existants

### 8.1 Stratégie : migration progressive en background

On ne migre pas tout d'un coup. Stratégie en 3 étapes :

1. **Phase A** : nouveaux uploads vont directement sur R2 (cutover du code)
2. **Phase B** : script de migration qui copie les fichiers existants Supabase → R2 en background, met à jour les `audio_url` dans la DB en mode `r2://...`
3. **Phase C** : après vérification, suppression des fichiers Supabase Storage (gain immédiat sur ta facture)

### 8.2 Script de migration

```typescript
// scripts/migrate-storage-to-r2.ts
// À exécuter une fois après le cutover du code

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function migrateTracks() {
  // Fetch all tracks still on Supabase Storage (no r2:// prefix)
  const { data: tracks } = await supabase
    .from("tracks")
    .select("id, workspace_id, audio_url, audio_preview_url")
    .not("audio_url", "like", "r2://%");

  console.log(`Found ${tracks?.length || 0} tracks to migrate`);

  for (const track of tracks || []) {
    try {
      // 1. Download from Supabase Storage
      if (track.audio_url) {
        const { data: blob, error } = await supabase.storage
          .from("tracks")
          .download(track.audio_url);

        if (error || !blob) {
          console.error(`Skipped ${track.id}: download failed`, error);
          continue;
        }

        // 2. Upload to R2
        const key = `${track.workspace_id}/${track.id}.${getExtension(track.audio_url)}`;
        const buffer = await blob.arrayBuffer();

        await r2Client.send(
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_TRACKS!,
            Key: key,
            Body: new Uint8Array(buffer),
            ContentType: blob.type || "audio/wav",
          })
        );

        // 3. Update DB with new path
        const newPath = `r2://${process.env.R2_BUCKET_TRACKS}/${key}`;
        await supabase
          .from("tracks")
          .update({ audio_url: newPath })
          .eq("id", track.id);

        console.log(`✓ Migrated track ${track.id}`);
      }

      // Same for audio_preview_url
      if (track.audio_preview_url && !track.audio_preview_url.startsWith("r2://")) {
        const { data: blob } = await supabase.storage
          .from("tracks")
          .download(track.audio_preview_url);

        if (blob) {
          const previewKey = `previews/${track.workspace_id}/${track.id}.mp3`;
          const buffer = await blob.arrayBuffer();
          await r2Client.send(
            new PutObjectCommand({
              Bucket: process.env.R2_BUCKET_TRACKS!,
              Key: previewKey,
              Body: new Uint8Array(buffer),
              ContentType: "audio/mpeg",
            })
          );
          const newPreviewPath = `r2://${process.env.R2_BUCKET_TRACKS}/${previewKey}`;
          await supabase
            .from("tracks")
            .update({ audio_preview_url: newPreviewPath })
            .eq("id", track.id);
          console.log(`✓ Migrated preview ${track.id}`);
        }
      }
    } catch (err) {
      console.error(`Error migrating ${track.id}:`, err);
    }

    // Throttle to avoid overwhelming Supabase
    await new Promise((r) => setTimeout(r, 100));
  }

  console.log("Migration complete");
}

async function migrateStems() {
  const { data: stems } = await supabase
    .from("stems")
    .select("id, workspace_id, track_id, url")
    .not("url", "like", "r2://%");

  console.log(`Found ${stems?.length || 0} stems to migrate`);

  for (const stem of stems || []) {
    try {
      const { data: blob } = await supabase.storage
        .from("stems")
        .download(stem.url);

      if (!blob) continue;

      const key = `${stem.workspace_id}/${stem.track_id}/${stem.id}.${getExtension(stem.url)}`;
      const buffer = await blob.arrayBuffer();

      await r2Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_STEMS!,
          Key: key,
          Body: new Uint8Array(buffer),
          ContentType: blob.type || "audio/wav",
        })
      );

      await supabase
        .from("stems")
        .update({ url: `r2://${process.env.R2_BUCKET_STEMS}/${key}` })
        .eq("id", stem.id);

      console.log(`✓ Migrated stem ${stem.id}`);
      await new Promise((r) => setTimeout(r, 50));
    } catch (err) {
      console.error(`Error migrating stem ${stem.id}:`, err);
    }
  }
}

function getExtension(path: string): string {
  return path.split(".").pop() || "wav";
}

async function main() {
  await migrateTracks();
  await migrateStems();
}

main().catch(console.error);
```

### 8.3 Exécution

```bash
# Sur ta machine locale ou un serveur temporaire
npm install @aws-sdk/client-s3 @supabase/supabase-js
export R2_ACCOUNT_ID=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
export R2_BUCKET_TRACKS=trakalog-tracks
export R2_BUCKET_STEMS=trakalog-stems
export SUPABASE_URL=https://xhmeitivkclbeziqavxw.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service_role_key>

npx tsx scripts/migrate-storage-to-r2.ts
```

### 8.4 Vérification post-migration

```sql
-- Combien de tracks encore sur Supabase Storage ?
SELECT COUNT(*) FROM tracks WHERE audio_url NOT LIKE 'r2://%';

-- Combien sur R2 ?
SELECT COUNT(*) FROM tracks WHERE audio_url LIKE 'r2://%';

-- Pareil pour stems
SELECT COUNT(*) FROM stems WHERE url NOT LIKE 'r2://%';
SELECT COUNT(*) FROM stems WHERE url LIKE 'r2://%';
```

Quand tout est à 100% sur R2 et que tu as testé que la lecture audio fonctionne pour des tracks anciens et nouveaux, **alors seulement** tu peux supprimer les fichiers Supabase Storage :

```typescript
// Script de cleanup Supabase Storage
const { data: files } = await supabase.storage.from("tracks").list();
for (const file of files || []) {
  await supabase.storage.from("tracks").remove([file.name]);
}
```

⚠️ **Ne supprimer Supabase Storage qu'après une semaine de vérification end-to-end.**

---

## 9. Phases d'implémentation

### Phase 1 — Setup (1 jour)
1. Activer R2 sur Cloudflare, créer les 3 buckets
2. Générer API token, configurer CORS
3. Setup custom domain `audio.trakalog.com` (optionnel)
4. Ajouter les secrets dans Supabase
5. Tester manuellement un upload/download avec curl

### Phase 2 — Code helpers (1-2 jours)
1. Créer `_shared/r2.ts` (signature V4, signed URLs)
2. Tester localement avec un script Deno simple
3. Déployer le helper

### Phase 3 — Edge Functions (2-3 jours)
1. Créer `get-upload-url` (nouvelle)
2. Modifier `get-audio-url` (support R2 + fallback Supabase)
3. Modifier `get-watermarked-audio` (cache R2)
4. Tests end-to-end avec Postman/curl

### Phase 4 — Frontend (2-3 jours)
1. Modifier `UploadTrackModal.tsx` (signed URL upload + XHR progress)
2. Modifier `StemsTab.tsx` (upload stems via R2)
3. Vérifier que tous les players audio fonctionnent (rien à changer normalement)
4. Tests upload/download de tous les formats supportés
5. Tests sur mobile + tous les navigateurs

### Phase 5 — Cutover (1 jour)
1. Merge la branche dev → main
2. Déployer Edge Functions
3. Déployer frontend Vercel
4. Tester avec un track de prod
5. Monitor logs pendant 24h

### Phase 6 — Migration des données (1 jour + background)
1. Run script de migration
2. Monitoring (tableau de bord SQL pour suivre % migré)
3. Vérification end-to-end sur 10 anciens tracks aléatoires
4. Une semaine de vérification → cleanup Supabase Storage

### Phase 7 — Optimisations futures (optionnel)
1. Multipart upload pour les très gros fichiers (>5 MB)
2. Lifecycle policies R2 (archivage automatique des watermarked >30 jours)
3. R2 Event Notifications pour trigger des actions automatiques

---

## 10. Pricing recalculé après migration

### Plan Free (3 tracks ≈ 150 MB)
- Storage : $0.002/user/mois
- Egress : $0
- **Marge brute storage : ~99.99%**

### Plan Starter ($14/mois, 100 tracks ≈ 5 GB)

> ⚠️ **Tarifs périmés.** Les montants $14 / $29 / $59 cités dans cette section correspondent à l'ancien pricing workspace-based, **abandonné**. Le pricing en vigueur est celui de `docs/FEATURES/TRAKALOG_BILLING.md` v5.0 : Starter $10, Pro $25, Business $45 (mensuel). Cette section n'a pas été recalculée — lire les ratios, pas les montants.

- Storage : $0.075/user/mois
- Egress : $0
- **Marge brute storage : 99.5%**

### Plan Pro ($29/mois, 1000 tracks ≈ 50 GB)
- Storage : $0.75/user/mois
- Egress : $0
- **Marge brute storage : 97%**

### Plan Business ($59/mois, ~300 GB moyenne)
- Storage : $4.50/user/mois
- Egress : $0
- **Marge brute storage : 92%**

### Possibilité stratégique
Avec ces marges, tu pourrais offrir des quotas plus généreux pour battre Sound Credit en marketing :
- Starter : 500 GB au lieu de 100 tracks (coût $7.50/user, marge 46% — ok mais serré)
- **Mieux** : Starter garde 100 tracks (justifié par les features, pas le storage), mais **annonce "500 GB inclus"** au lieu de "100 tracks" pour que ce soit lisible. Tu sais que les users dépasseront rarement 50 GB.
- Pro : annoncer "2 TB" au lieu de "1000 tracks" → coût $30/user au pire cas, marge encore positive
- Business : annoncer "10 TB" → couvre 95% des cas même pour les labels

---

## 11. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Bug signature V4 dans `_shared/r2.ts` | Moyenne | Élevé | Tests unitaires avant déploiement, fallback Supabase Storage si erreur |
| Migration interrompue à mi-chemin | Moyenne | Moyen | Script idempotent (skip si déjà `r2://`), monitoring SQL |
| Listener qui charge le track pendant la migration | Faible | Faible | Edge Function `get-audio-url` détecte automatiquement le backend |
| CORS misconfigured | Élevée au début | Moyen | Tester avec curl avant d'intégrer frontend |
| Custom domain SSL pas propagé | Faible | Faible | Fallback sur le domaine R2 standard |
| Quota R2 dépassé (compte free) | Moyenne | Faible | R2 ne coupe pas le service, facture juste le dépassement |
| Suppression accidentelle Supabase Storage | Moyenne | Très élevé | **Une semaine de vérification avant cleanup. Backup avant de supprimer.** |
| Watermarking cache rate dropping | Faible | Moyen | Logs Edge Function `get-watermarked-audio` pour monitorer cache hit rate |

---

## 12. Checklist post-migration

- [ ] Tous les uploads frontend vont sur R2
- [ ] Tous les downloads frontend lisent depuis R2 (via signed URL)
- [ ] Watermarking cache sur R2 fonctionne
- [ ] Stems uploadent et lisent depuis R2
- [ ] 100% des tracks DB ont `audio_url` avec préfixe `r2://`
- [ ] 100% des stems DB ont `url` avec préfixe `r2://`
- [ ] Test de lecture sur 10 tracks anciens migrés (random sample)
- [ ] Test de lecture sur 5 tracks nouveaux uploadés post-cutover
- [ ] Test du watermarking sur un shared link
- [ ] Test du Trakalog Pack ZIP (téléchargement multi-fichiers)
- [ ] Test mobile iOS + Android
- [ ] Test Firefox + Chrome + Safari
- [ ] Logs Edge Functions vérifiés (pas d'erreurs récurrentes)
- [ ] Facture Cloudflare estimée vs facture Supabase précédente
- [ ] Cleanup Supabase Storage tracks (après 7 jours de vérif)
- [ ] Cleanup Supabase Storage stems (après 7 jours de vérif)
- [ ] Cleanup Supabase Storage watermarked (après 7 jours de vérif)
- [ ] Documentation mise à jour : `TRAKALOG_ARCHITECTURE.md` section stack technique

---

## 13. Dépendances avec le reste du projet

### Bloque sur
- **Aucune dépendance** technique — peut se faire en parallèle d'autres features
- **Recommandation** : faire après Stripe/Billing pour ne pas mélanger les priorités

### Impacte
- **Genesis Protocol** : les Origin Prints incluront des hashes calculés sur les fichiers R2 (pas de problème, les hashes sont identiques que le fichier soit sur Supabase ou R2)
- **Track Versioning** : versions multiples = plus de storage, donc R2 devient encore plus rentable
- **Brief Seeker / Artist Seeker** : pas d'impact direct
- **Admin Dashboard** : ajouter un widget "Storage used per workspace" qui query R2 via leur API

### Ne touche pas
- Auth, RLS, RPCs SECURITY DEFINER
- Smart A&R, Sonic DNA (continuent à lire les fichiers via signed URLs)
- Watermarking Railway service (lit l'audio via URL, peu importe le backend)
- Stripe / Billing

---

## 14. Notes techniques importantes

### Signed URLs durée
- **GET (lecture)** : 300s (5 min) — assez pour démarrer une lecture et la finir
- **PUT (upload)** : 3600s (1h) — assez pour uploader un gros WAV
- **DELETE** : 300s — usage rare, server-side uniquement

### Cache HTTP côté Cloudflare
Les signed URLs ne sont **pas cachées** par Cloudflare (chaque URL est unique grâce à la signature). C'est voulu : chaque écoute = une signed URL fraîche, audit possible, expiration courte.

Si plus tard tu veux mettre du cache pour les previews publiques (Sonic DNA Radio, par exemple), tu peux utiliser le custom domain `audio.trakalog.com` avec un path public dédié, qui sera caché par Cloudflare automatiquement.

### Multipart upload (>5 MB)
R2 supporte les multipart uploads via le SDK S3. Pour les fichiers >5 MB, tu peux uploader en chunks parallèles = upload beaucoup plus rapide. À implémenter en Phase 7 si tu veux optimiser l'UX d'upload pour les gros WAV (50 MB).

### Object lifecycle
R2 supporte les lifecycle rules. À envisager :
- Supprimer les fichiers du bucket `trakalog-watermarked` après 30 jours d'inactivité (cache jamais accédé = inutile)
- Garder forever les buckets `trakalog-tracks` et `trakalog-stems` (catalogue user, ne pas toucher)

### Compatibilité S3
R2 est compatible AWS Signature V4. N'importe quel SDK S3 fonctionne :
- `@aws-sdk/client-s3` (Node.js, à utiliser dans le script de migration)
- `boto3` (Python)
- `aws-sdk` (Go, Rust, etc.)

Le helper `_shared/r2.ts` qu'on écrit fait la signature en pure JS sans dépendance pour minimiser le bundle Edge Function.

---

*Ce document est vivant. Il sera mis à jour pendant et après la migration.*
