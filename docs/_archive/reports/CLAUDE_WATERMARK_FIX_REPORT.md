# CLAUDE_WATERMARK_FIX_REPORT — P0 shared link "Preparing your secure copy" hang

**Branch:** `claude/fix-watermark-decode-error-handling-20260615-1431`
**Commit:** `0090233` · **Rollback tag:** `pre-watermark-fix-20260615-143105`
**Base:** `main` @ `46db817` (untouched — NOT merged)
**Scope:** frontend only (`src/pages/SharedLinkPage.tsx`, `src/lib/audio.ts`). No Edge Functions, no Railway, no `STORAGE_PROVIDER` change.

---

## 0. Important correction to the prior diagnosis

The previous diagnostic (COWORK_WATERMARK_BUG_V3.md) hypothesized the hang came from a **Web Audio `decodeAudioData`** path called callback-style without `.catch`. **Reading the actual source proved that wrong:**

- The shared-link player plays audio with a **native HTML5 `<audio>` element** (`new Audio()` in `SharedLinkPage.tsx`), not Web Audio. The watermarked URL is assigned to `audio.src` and played directly.
- The 4 `decodeAudioData` call sites (`waveformGenerator.ts`, `audio-compression.ts`, `audio-analysis.ts`, `mp3Encoder.ts`) are **upload-time analysis utilities** — they are NOT on the shared-link playback path. They're already promise/await (not callback-style). Left untouched to keep this P0 focused (optional follow-up: add `catch` for cleaner upload UX).

**Real root cause of the hang:** the shared-link `<audio>` element had **no `error` event listener and no load timeout**. `audioLoading` (which gates the "Preparing your secure copy" UI) is only cleared by the `play`/`canplay` events. When the watermarked media failed to *load/play*, none of those events fired and nothing cleared `audioLoading` → the spinner stayed forever, with no error surfaced and no fallback. (The pre-existing `.catch` only covered the watermark *fetch*, not the media-element load.)

---

## 1. Components modified

| File | Lines | Change |
|---|---|---|
| `src/pages/SharedLinkPage.tsx` | +~130 | Error listener + load watchdog + `handleWatermarkFailover()` recovery + `watermarkError` state + fallback-to-original + error UI + `[watermark-audio]` logs |
| `src/lib/audio.ts` | +11 | `[audio-lib]` structured error logging in `callEdgeFunction` (status + content-type/length, host-only) |

Diff stat: `2 files changed, 135 insertions(+), 12 deletions(-)`.

---

## 2. Before → After

**Before**
- `<audio>` had listeners for `timeupdate/loadedmetadata/ended/play/pause/waiting/canplay` — but **no `error`**.
- Watermark fetch failure → fell back to original audio (OK). But watermarked **media-load** failure → `audioLoading` never cleared → "Preparing your secure copy" **infinite**, silent, no fallback.

**After**
- **`error` listener** on the `<audio>` element → routes to `handleWatermarkFailover()`.
- **25s load watchdog** armed after each `audio.src` assignment → catches silent stalls (no `error`, no `canplay`).
- **`handleWatermarkFailover(context)`**: clears the watchdog; logs `[watermark-audio] <context> code=… message=… host=<hostname> watermarked=<bool>`; if the **watermarked** stream was the one that failed and an original URL exists → switches `audio.src` to the original and plays (audio stays listenable, `watermarkError="fallback"`); otherwise stops the spinner and sets `watermarkError="error"`. Guarded by `watermarkActiveRef` so it cannot loop.
- **`audioLoading` is now cleared on every failure path** (no-URL, fetch `.catch`, media `error`, watchdog, `play()` rejection, fallback `play()` rejection).
- **UI**: "Preparing…" now hides as soon as `watermarkError` is set; a new block shows **"Protection unavailable — Playing the original audio instead."** (fallback) or **"Playback failed — Couldn't load this track, please try again."** (hard error). Both playlist and single-track views.
- **Logging**: `[watermark-audio]` (player) and `[audio-lib]` (EF errors in `audio.ts`). **URLs are logged hostname-only — the signed query string / token is never logged.**
- **Cleanup**: the unmount handler removes the `error` listener *before* clearing `audio.src` (so teardown doesn't trigger failover) and clears the watchdog.

Validation: `npx tsc --noEmit` → clean (exit 0). `vite build` → clean (4165 modules, exit 0; SharedLinkPage chunk emitted). Reviewed by a second agent against 7 criteria (loading always cleared, native-audio fallback intact, no unhandled rejection, no re-entrancy loop, no token in logs, hook/closure correctness, watchdog always cleared) — all PASS.

---

## 3. Post-deploy test procedure (shared link)

1. Push the branch (see §5), merge to `main`, let Vercel auto-deploy.
2. Open `app.trakalog.com/share/e4ak2kdwtdjd` (private window). **Open DevTools → Console + Network BEFORE clicking PLAY.**
3. Pass the gate, click **PLAY**. Then observe:
   - **The spinner must NOT hang.** Within seconds (or ≤25s worst case) it resolves to either playing audio, a "Protection unavailable / Playing original" notice (audio plays), or a "Playback failed" notice — never an infinite "Preparing".
   - **Console** shows the real failure (if any) with prefix **`[watermark-audio]`**, e.g.
     `[watermark-audio] audio element error event code=4 message=… host=98dfdbe6….r2.cloudflarestorage.com watermarked=true`
     or `[audio-lib] get-watermarked-audio HTTP 5xx …`.
   - **Network**: inspect the `r2.cloudflarestorage.com` request — status + response headers (incl. `Access-Control-Allow-Origin`).
4. **This console output is the point of the fix**: it reveals the true remaining root cause (e.g. `MediaError code=4 MEDIA_ERR_SRC_NOT_SUPPORTED`, a decode/format issue, a CORS gap, or a network error) so the complementary fix can be made (e.g. re-encode watermark to MP3/AAC, custom R2 domain, etc.).

---

## 4. What this fix does and does not do

- **Does**: guarantees the player never hangs on "Preparing"; keeps audio playable via fallback to the original; surfaces the real error in the console + UI; adds structured logging across the player and `lib/audio.ts`.
- **Does not**: change *why* the watermarked media may fail to load (that's revealed by the new logs). If the logs show a decode/format issue, the likely complementary fix is server-side: re-encode the watermarked output (Railway) from 37–62 MB WAV to MP3/AAC — out of scope here (frontend-only, and Railway is a separate repo).

---

## 5. To do (Yannick)

- `git push -u origin claude/fix-watermark-decode-error-handling-20260615-1431` **from your machine** (the Cowork sandbox has no GitHub push credentials; the commit is already in your local repo on the branch).
- Open PR / merge to `main` → Vercel deploy → run §3.
- Paste the `[watermark-audio]` console line back so we can pinpoint and fix the underlying media failure.

*No prod change. main not merged. Original Supabase-era code is in the Edge Functions (not this repo's frontend) and was not touched.*
