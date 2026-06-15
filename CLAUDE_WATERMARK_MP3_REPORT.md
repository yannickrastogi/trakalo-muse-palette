# Watermark MP3 Encoding — Report

## Objectif
Réduire la taille du fichier watermarké (WAV non compressé → MP3 192 kbps) pour :
- ~10x moins de stockage R2
- "Preparing your secure copy" : 30-60 s → 5-10 s
- Moins de RAM mobile, playback plus rapide

**Critique** : la robustesse du watermark audiowmark doit être validée après MP3 via `audiowmark get` (sinon leak tracing cassé).

---

## 1. Code Railway localisé

- `services/watermark/Dockerfile` — image Ubuntu 24.04 + audiowmark compilé from source
- `services/watermark/index.js` — Express server (POST /encode, POST /decode, GET /health)
- `services/watermark/package.json` — deps : express, cors, multer, uuid
- `services/watermark/README.md` — doc deploy Railway

Edge Function consommatrice : `supabase/functions/get-watermarked-audio/index.ts`

---

## 2. Dockerfile — diff

Ajout de **`ffmpeg`** à la liste apt-get install :

```diff
     libmpg123-dev \
+    ffmpeg \
     git \
```

`libmp3lame` est livré nativement par le paquet ffmpeg Ubuntu 24.04.

---

## 3. Code Node — diff (POST /encode)

### a. Helpers ajoutés
- `execFileP(cmd, args, options)` — promise wrapper sur `execFile`
- `parseAudiowmarkPayload(stdout)` — extrait le payload détecté depuis la sortie `audiowmark get`

### b. CORS modifié
```diff
   cors({
     origin: (origin, callback) => { ... },
+    exposedHeaders: ["X-Watermark-Format"],
   })
```

### c. /encode — pipeline réécrit

```
1. audiowmark add inputPath wavOutputPath payload   (timeout 80s)
   → fallback si fail : 500 error
2. cleanup inputPath
3. ffmpeg -i wav -c:a libmp3lame -b:a 192k mp3      (timeout 40s)
4. audiowmark get mp3OutputPath                     (timeout 30s)
   → parse payload détecté
   → si !match ou !payload : log + fallback WAV
5. if useMp3: res.download(mp3, "watermarked.mp3") + X-Watermark-Format: mp3
   else: res.download(wav, "watermarked.wav") + X-Watermark-Format: wav
```

Le payload est comparé `toLowerCase()` (hex insensitive). Cleanup couvre les 4 chemins (success-mp3, fallback-wav, timeout, error).

---

## 4. EF get-watermarked-audio — diff

### a. Cache lookup — cohabitation .mp3 / .wav

```diff
- const watermarkedPath = `${cacheKey}.wav`;
- if (await storage.exists("watermarked", watermarkedPath)) { ... }
+ const mp3Path = `${cacheKey}.mp3`;
+ const wavPath = `${cacheKey}.wav`;
+ for (const cached of [mp3Path, wavPath]) {
+   if (await storage.exists("watermarked", cached)) {
+     return createSignedUrl(cached);
+   }
+ }
```

Aucun `.wav` legacy n'est supprimé. Préférence au `.mp3` (plus rapide à servir).

### b. Upload — choix extension via X-Watermark-Format

```diff
+ const wmFormat = (wmResponse.headers.get("X-Watermark-Format") || "").toLowerCase();
+ const isMp3 = wmFormat === "mp3";
+ const watermarkedPath = isMp3 ? mp3Path : wavPath;
+ const contentType = isMp3 ? "audio/mpeg" : "audio/wav";
  await storage.upload("watermarked", watermarkedPath, watermarkedBuffer, contentType);
```

---

## 5. Validation locale

### Syntax checks
```bash
node --check services/watermark/index.js                  # ✅ OK
deno check supabase/functions/get-watermarked-audio/index.ts  # ✅ OK
npm run build                                              # ✅ OK (4.18s)
```

### Test manuel Docker (recommandé avant deploy)
```bash
cd services/watermark
docker build -t watermark-mp3 .
docker run -p 3000:3000 -e WATERMARK_API_KEY=test -e ALLOWED_ORIGINS=http://localhost watermark-mp3

# Dans un autre terminal, avec un .wav test
curl -X POST http://localhost:3000/encode \
  -H "x-api-key: test" \
  -H "Content-Type: application/json" \
  -d '{"source_url":"https://example.com/test.wav","payload":"abc123def456abc123def456abc123de"}' \
  -o out.bin -D headers.txt

cat headers.txt | grep -i x-watermark-format   # → expect "X-Watermark-Format: mp3"
file out.bin                                    # → expect "MPEG ADTS, layer III, v1, 192 kbps"
ls -lh out.bin                                  # → expect ~3-6 MB pour un fichier 3 min
```

---

## 6. Procédure de deploy Railway

Le service Railway est déployé via **GitHub auto-deploy**.

Trois étapes :
1. **Merge sur main** → Railway détecte le push et rebuild l'image Docker
2. **Build Docker** prend ~3-5 min (compilation audiowmark from source + install ffmpeg)
3. **Promote** : Railway swap le service après health check `GET /health` OK

URL : `https://trakalo-muse-palette-production.up.railway.app`

Si Railway n'est PAS connecté à GitHub :
```bash
cd services/watermark
railway up    # depuis le dossier services/watermark
```

L'EF Supabase `get-watermarked-audio` doit aussi être redéployée :
```bash
supabase functions deploy get-watermarked-audio
```

---

## 7. Test post-deploy

### Smoke test côté Railway
```bash
curl https://trakalo-muse-palette-production.up.railway.app/health
# → {"status":"ok","version":"1.0.0"}
```

### Smoke test pipeline complet
1. Ouvrir un shared link dans un navigateur fresh (cookie effacé)
2. Saisir email/nom au gate screen
3. Observer le "Preparing your secure copy"
   - **Avant** : 30-60 s, fichier ~40 MB
   - **Après** : 5-10 s, fichier ~3-6 MB
4. Vérifier playback browser

### Validation leak tracing (CRITIQUE)
1. Download le fichier MP3 watermarké depuis le shared link
2. Upload-le sur `/decode` de Railway :
   ```bash
   curl -X POST https://trakalo-muse-palette-production.up.railway.app/decode \
     -H "x-api-key: $WATERMARK_API_KEY" \
     -F "audio=@watermarked.mp3"
   ```
3. **Le payload détecté doit matcher** celui stocké dans `watermark_payloads.hash_hex`
4. Si ça ne matche pas → la robustesse MP3 est en cause → désactiver MP3 (rollback)

### Logs à surveiller
- `[watermark] MP3 validation FAILED — expected=..., detected=...` → fréquence ?
- Cache hit ratio (R2 hits .mp3 vs miss)

---

## 8. Rollback

### Option A — Hot rollback Railway
```bash
# Via Railway dashboard → Deployments → revert to previous
```

### Option B — Code rollback (git)
```bash
git revert <merge-commit>
git push origin main   # triggers Railway redeploy
```

### Cohabitation safe
- Les `.wav` legacy dans R2 restent servis tant qu'ils existent
- Les nouveaux uploads sont `.mp3`
- Pas de migration nécessaire — soak progressif

---

## 9. Security review — findings (pré-existants, hors scope)

La security review a identifié des problèmes **pré-existants** non introduits par ces changements MP3. À traiter dans des PR séparés :

| Sévérité | Fichier | Issue |
|---|---|---|
| HIGH | `services/watermark/index.js` | `downloadToFile` suit les redirects sans whitelist SSRF |
| HIGH | EF `get-watermarked-audio` | `visitor_email` non validé (format + length) |
| MEDIUM | EF `get-watermarked-audio` | `storage_path` pas passé à `isValidStoragePath()` |
| MEDIUM | EF `get-watermarked-audio` | Pas de timeout AbortSignal sur le fetch Railway |
| LOW | EF `get-watermarked-audio` | Double `createClient(service_role)` |

Les changements MP3 eux-mêmes sont propres : payload validé hex strict, paths via uuid, ffmpeg args sans user input, cleanup exhaustif sur tous les chemins, fallback WAV garanti.

---

## 10. Gain attendu

| Métrique | Avant (WAV) | Après (MP3 192k) | Gain |
|---|---|---|---|
| Taille fichier (track 3 min) | ~37-62 MB | ~3-6 MB | **10x** |
| Temps "Preparing" | 30-60 s | 5-10 s | **~6x** |
| Storage R2 watermarked | 100% | ~10% | **90% économisé** |
| Bandwidth R2 → fan | idem | -90% | **idem** |
| Leak tracing | OK | OK (validé) | **préservé** |
