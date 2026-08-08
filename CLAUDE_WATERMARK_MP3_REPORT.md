# Watermark MP3 Encoding — Report

## Objective
Reduce the watermarked file size (uncompressed WAV → MP3 192 kbps) to:
- ~10x less R2 storage
- "Preparing your secure copy": 30-60 s → 5-10 s
- Less mobile RAM, faster playback

**Critical:** the robustness of the audiowmark watermark must be validated after MP3 via `audiowmark get` (otherwise leak tracing breaks).

---

## 1. Localized Railway code

- `services/watermark/Dockerfile` — Ubuntu 24.04 image + audiowmark compiled from source
- `services/watermark/index.js` — Express server (POST /encode, POST /decode, GET /health)
- `services/watermark/package.json` — deps: express, cors, multer, uuid
- `services/watermark/README.md` — Railway deploy doc

Consuming Edge Function: `supabase/functions/get-watermarked-audio/index.ts`

---

## 2. Dockerfile — diff

Added **`ffmpeg`** to the apt-get install list:

```diff
     libmpg123-dev \
+    ffmpeg \
     git \
```

`libmp3lame` is delivered natively by the ffmpeg Ubuntu 24.04 package.

---

## 3. Node code — diff (POST /encode)

### a. Helpers added
- `execFileP(cmd, args, options)` — promise wrapper on `execFile`
- `parseAudiowmarkPayload(stdout)` — extracts the detected payload from the `audiowmark get` output

### b. CORS modified
```diff
   cors({
     origin: (origin, callback) => { ... },
+    exposedHeaders: ["X-Watermark-Format"],
   })
```

### c. /encode — rewritten pipeline

```
1. audiowmark add inputPath wavOutputPath payload   (timeout 80s)
   → fallback if fail: 500 error
2. cleanup inputPath
3. ffmpeg -i wav -c:a libmp3lame -b:a 192k mp3      (timeout 40s)
4. audiowmark get mp3OutputPath                     (timeout 30s)
   → parse detected payload
   → if !match or !payload: log + fallback WAV
5. if useMp3: res.download(mp3, "watermarked.mp3") + X-Watermark-Format: mp3
   else: res.download(wav, "watermarked.wav") + X-Watermark-Format: wav
```

The payload is compared `toLowerCase()` (hex insensitive). Cleanup covers all 4 paths (success-mp3, fallback-wav, timeout, error).

---

## 4. EF get-watermarked-audio — diff

### a. Cache lookup — .mp3 / .wav cohabitation

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

No legacy `.wav` is removed. Preference for `.mp3` (faster to serve).

### b. Upload — extension choice via X-Watermark-Format

```diff
+ const wmFormat = (wmResponse.headers.get("X-Watermark-Format") || "").toLowerCase();
+ const isMp3 = wmFormat === "mp3";
+ const watermarkedPath = isMp3 ? mp3Path : wavPath;
+ const contentType = isMp3 ? "audio/mpeg" : "audio/wav";
  await storage.upload("watermarked", watermarkedPath, watermarkedBuffer, contentType);
```

---

## 5. Local validation

### Syntax checks
```bash
node --check services/watermark/index.js                  # ✅ OK
deno check supabase/functions/get-watermarked-audio/index.ts  # ✅ OK
npm run build                                              # ✅ OK (4.18s)
```

### Manual Docker test (recommended before deploy)
```bash
cd services/watermark
docker build -t watermark-mp3 .
docker run -p 3000:3000 -e WATERMARK_API_KEY=test -e ALLOWED_ORIGINS=http://localhost watermark-mp3

# In another terminal, with a test .wav
curl -X POST http://localhost:3000/encode \
  -H "x-api-key: test" \
  -H "Content-Type: application/json" \
  -d '{"source_url":"https://example.com/test.wav","payload":"abc123def456abc123def456abc123de"}' \
  -o out.bin -D headers.txt

cat headers.txt | grep -i x-watermark-format   # → expect "X-Watermark-Format: mp3"
file out.bin                                    # → expect "MPEG ADTS, layer III, v1, 192 kbps"
ls -lh out.bin                                  # → expect ~3-6 MB for a 3 min file
```

---

## 6. Railway deploy procedure

The Railway service is deployed via **GitHub auto-deploy**.

Three steps:
1. **Merge to main** → Railway detects the push and rebuilds the Docker image
2. **Docker build** takes ~3-5 min (compiling audiowmark from source + installing ffmpeg)
3. **Promote** : Railway swaps the service after health check `GET /health` OK

URL: `https://trakalo-muse-palette-production.up.railway.app`

If Railway is NOT connected to GitHub:
```bash
cd services/watermark
railway up    # from the services/watermark folder
```

The Supabase EF `get-watermarked-audio` must also be redeployed:
```bash
supabase functions deploy get-watermarked-audio
```

---

## 7. Post-deploy test

### Smoke test from Railway
```bash
curl https://trakalo-muse-palette-production.up.railway.app/health
# → {"status":"ok","version":"1.0.0"}
```

### Full pipeline smoke test
1. Open a shared link in a fresh browser (cookies cleared)
2. Enter email/name at the gate screen
3. Observe "Preparing your secure copy"
   - **Before** : 30-60 s, ~40 MB file
   - **After** : 5-10 s, ~3-6 MB file
4. Verify browser playback

### Leak tracing validation (CRITICAL)
1. Download the watermarked MP3 from the shared link
2. Upload it to Railway's `/decode` :
   ```bash
   curl -X POST https://trakalo-muse-palette-production.up.railway.app/decode \
     -H "x-api-key: $WATERMARK_API_KEY" \
     -F "audio=@watermarked.mp3"
   ```
3. **The detected payload must match** the one stored in `watermark_payloads.hash_hex`
4. If it doesn't match → MP3 robustness is at issue → disable MP3 (rollback)

### Logs to monitor
- `[watermark] MP3 validation FAILED — expected=..., detected=...` → frequency?
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

### Safe cohabitation
- Legacy `.wav` in R2 remain served as long as they exist
- New uploads are `.mp3`
- No migration needed — gradual soak

---

## 9. Security review — findings (pre-existing, out of scope)

The security review identified **pre-existing** issues not introduced by these MP3 changes. To be addressed in separate PRs:

| Severity | File | Issue |
|---|---|---|
| HIGH | `services/watermark/index.js` | `downloadToFile` follows redirects without SSRF whitelist |
| HIGH | EF `get-watermarked-audio` | `visitor_email` not validated (format + length) |
| MEDIUM | EF `get-watermarked-audio` | `storage_path` not passed to `isValidStoragePath()` |
| MEDIUM | EF `get-watermarked-audio` | No timeout AbortSignal on the Railway fetch |
| LOW | EF `get-watermarked-audio` | Double `createClient(service_role)` |

The MP3 changes themselves are clean: payload validated strict hex, paths via uuid, ffmpeg args without user input, exhaustive cleanup on all paths, WAV fallback guaranteed.

---

## 10. Expected gain

| Metric | Before (WAV) | After (MP3 192k) | Gain |
|---|---|---|---|
| File size (3 min track) | ~37-62 MB | ~3-6 MB | **10x** |
| "Preparing" time | 30-60 s | 5-10 s | **~6x** |
| R2 watermarked storage | 100% | ~10% | **90% saved** |
| Bandwidth R2 → fan | same | -90% | **same** |
| Leak tracing | OK | OK (validated) | **preserved** |