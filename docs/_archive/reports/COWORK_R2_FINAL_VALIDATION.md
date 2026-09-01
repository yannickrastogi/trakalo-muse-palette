# COWOK — R2 Migration Phase 5 — Final Functional Validation

**Validation date:** 2026-06-14 16:23 UTC
**Validator:** Cowork (EF-layer + browser, prod app.trakalog.com)
**Supabase project:** xhmeitivkclbeziqavxw · **Vercel:** trakalo-muse-palette (team yannickrastogis-projects)

---

## ⚠️ Premise discrepancy to flag first

The mission assumed a merge pushed "a few minutes ago" with an ongoing Vercel auto-deploy.
**In reality, the production deployment carrying commit 65e7133 has been READY since 2026-06-09 21:38:39 UTC — 5 days ago.**
No build in progress, no more recent production deployment. The Step 1 success criterion (READY + commit ≥ 65e7133) is satisfied, but the "15 min post-deploy monitoring" window is expired (see Step 6).

---

## 1. Pre-flight Vercel

| Field | Value |
|---|---|
| Deployment | dpl_4r8gd7u8nyHKMqGzzpsok2pZzwj6 |
| Target | production |
| State | READY ✅ |
| Commit | 65e7133 (65e7133c585416a24453a16dee8c266abb24facb) ✅ exact match |
| Branch | main |
| Message | feat(r2): Phase 5 — route 100% frontend audio reads through Edge Functions |
| Ready timestamp | 2026-06-09 21:38:39 UTC (⚠️ J-5) |
| Rollback candidate | yes (isRollbackCandidate: true) |

---

## 2. Before/after URLs table by path

| Path | Before Phase 5 | After (measured today) | EF | Status | ✅ |
|---|---|---|---|---|---|
| In-app player (track) | …supabase.co/storage/v1/… | …r2.cloudflarestorage.com/trakalog-tracks/… | get-audio-url v22 | 200 | ✅ |
| PersistentPlayer (switch) | …supabase.co/storage/… | …r2.cloudflarestorage.com/trakalog-tracks/… (SWOOP) | get-audio-url v22 | 200 | ✅ |
| Stems / covers / documents | …supabase.co/storage/… | …r2.cloudflarestorage.com/trakalog-stems / -covers /… | get-storage-url v1 | 200 | ✅ |
| Shared link (watermark) | …supabase.co/storage/… | …r2.cloudflarestorage.com/trakalog-watermarked/… (R2 direct, 990 ms) | get-watermarked-audio v18 | 200 | ✅ |

R2 host: 98dfdbe6c0f7841eb91593b8af3eea71.r2.cloudflarestorage.com
Final shared link URL = R2 direct (no Railway proxy; watermark already cached in R2, no cold-start).

---

## 3. Browser test results (✅ / ⚠️)

Step 2 — In-app player ("SOS- (NCT v2)"): ✅ Yannick logged in · ✅ /tracks (32) · ✅ get-audio-url 200 · ✅ R2 URL trakalog-tracks · ⚠️ audible playback NOT verifiable (harness media guard, proven blocked identically by MP3 public — no regression).
Step 3 — PersistentPlayer switch (SWOOP): ✅ get-audio-url 200, R2 · ⚠️ same harness limitation.
Step 4 — Stems (get-storage-url, 1st prod usage): ✅ EF v1 ACTIVE · ✅ {bucket,key} → 200 R2 (trakalog-stems/covers) · ✅ security: traversal/null-byte/bucket-out-of-whitelist → 400 · ⚠️ 0 stems in target workspace → real download not exercised.
Step 5 — Shared link /share/e4ak2kdwtdjd: ✅ gate displayed · ✅ filled+submitted (authorization Yannick: Test Validation / validation@trakalog.com / Trakalog Internal QA) · ⚠️ Role "Other" non-existent → left empty · ✅ content loaded · ✅ log-link-access/event 200, play logged · ✅ get-watermarked-audio 200 → R2 trakalog-watermarked · ⚠️ audible playback blocked by harness.

---

## 4. Monitoring Edge Functions

Scope: deploy J-5 → "15 min" window expired. Snapshot of most recent EF logs (dominated by this validation). All codes explained.

| Function | Ver | POST 200 | POST 4xx | 5xx | p95 | Critical errors |
|---|---|---|---|---|---|---|
| get-audio-url | 22 | 6 | 2 | 0 | ~2008 ms | none |
| get-storage-url | 1 | 3 | 6 | 0 | ~1017 ms | none |
| get-watermarked-audio | 18 | 1 | 4 | 0 | ~823 ms | none |
| analyze-sonic-dna | 29 | 0 | 0 | 0 | — | none |
| transcribe-lyrics | 21 | 0 | 0 | 0 | — | none |

4xx = 100% induced by validation (schema probes + security tests).
5xx=0 · AccessDenied=0 · SignatureDoesNotMatch=0 · R2 unauthorized=0 · 429=0 · path traversal blocked (400) ✅.

---

## 5. Final verdict

✅ R2 migration validated functionally at Edge Function / storage routing level.
The 3 read functions serve exclusively R2 URLs (tracks, stems, covers, watermarked), 200 systematic, 0 critical error, get-storage-url security operational, shared-link flow end-to-end on the server side.

⚠️ Reservations (no production regression):
1. Audible playback not verified end-to-end (harness media guard, domain-agnostic). 206 R2 under real playback not captured → confirm via manual human test.
2. Step 4 with no real stem (EF/routing proven nonetheless).
3. Gate without Role "Other" option.
4. Temporal premise: deploy J-5.

Conclusion: nothing blocking. Phase 5 objective reached and verified at EF level; only audible confirmation remains to be done by a human.

---

## 6. Post-migration recommendations

1. Human confirmation (5 min) — listen to 1 track in-app + 1 shared link watermarked.
2. 2-week soak before cleanup Supabase Storage (data = source of truth, rclone copy not move).
3. Revoke the Supabase S3 key rclone-phase3-migration — AFTER soak + audible confirmation.
4. Preserved rollback: tag pre-r2-phase5-20260609-165913 + Supabase Storage intact + isRollbackCandidate:true.

---

No push performed. No data deleted. No permissions modified.
