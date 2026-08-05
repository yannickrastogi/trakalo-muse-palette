# Trakalog — Groq Usage, Costs & Scaling

**Architecture note · August 5, 2026 · Status: FACTUAL (audited against `main`)**

Audience: engineering. This documents every place Trakalog calls Groq, what each call
actually costs, what guardrails exist today, and where the model breaks under scale.

---

## 1. Where Groq is used

Exactly **two** Edge Functions call Groq. Nothing else in the codebase touches it.

| Edge Function | Groq endpoint | Model | Trigger |
|---|---|---|---|
| `smart-ar` | `/openai/v1/chat/completions` | `llama-3.3-70b-versatile` | User submits an A&R brief |
| `transcribe-lyrics` | `/openai/v1/audio/transcriptions` | `whisper-large-v3` | Fire-and-forget on upload, or manual re-run |

**Common misconception to correct:** Sonic DNA (BPM, key, valence/arousal, spectral
brightness/warmth, intro clearance) is **not** a Groq workload. It runs on a self-hosted
Railway service using Essentia. Its output is *consumed* by the Smart A&R prompt, which is
why the two are often conflated. Same for audio watermarking (audiowmark on Railway).

A single `GROQ_API_KEY` secret serves both functions.

---

## 2. Groq pricing (as of August 2026)

| Model | Rate |
|---|---|
| `llama-3.3-70b-versatile` | $0.59 / 1M input tokens · $0.79 / 1M output tokens |
| `whisper-large-v3` | $0.111 per hour of audio |
| `whisper-large-v3-turbo` (not used) | $0.04 per hour of audio |

Groq's Batch API offers 50% off for non-interactive workloads. We do not use it. See §7.

---

## 3. `smart-ar` — cost model

### How the prompt is built

1. A fixed system prompt (~750 tokens) describing A&R matching rules, how to read the
   internal Sonic DNA fields, and how to weight user-provided tags.
2. **The entire catalog**, one line per track: id (UUID), title, artist, genre, BPM, key,
   mood, voice/gender, duration, plus — when the catalog is ≤40 tracks — status, featuring
   and language. Then the Sonic DNA block, then up to 30 sanitized tags.
3. The user's brief (hard-capped at 2 000 characters).

Catalogs above 40 tracks automatically drop three metadata fields per line. That is the
**only** size-adaptive behaviour in the function.

> **There is no cap on the number of tracks sent to the model.** The `.limit(500)` in the
> file applies only to the `marketplace` mode (public catalog). In `personal` mode the
> query is `select … where workspace_id = $1` with no limit, plus every track shared in via
> `catalog_shares`, deduplicated. Whatever the user owns, the model receives.

Roughly **~100 tokens per track**, dominated by the UUID and the tag block. Output is
~45 tokens per returned track plus ~60 tokens of envelope.

### Cost per query

| Catalog size | Input tokens | Cost per query (10 tracks returned) |
|---|---|---|
| 50 | ~5 750 | **$0.004** |
| 200 | ~20 750 | **$0.013** |
| 500 | ~50 750 | **$0.030** |
| 1 000 | ~100 750 | **$0.060** |
| 1 270 | ~128 000 | **hard failure — see §6.1** |

### Guardrails in place

Refusals are ordered narrowest → widest, and every one of them fires **before** the paid
model call:

1. IP rate limit — 20 / hour
2. Plan quota — `check_smart_ar_quota()`, returns HTTP 402 `plan_limit_reached`
3. Per-user anti-loop — 100 / hour
4. Platform fuse — 3 000 / 24h across all users

The monthly counter is incremented via `increment_smart_ar_usage()` **after** a successful
query, so failed calls are not billed to the user.

---

## 4. `transcribe-lyrics` — cost model

### Flow

1. Download the original WAV master via a signed URL. **If it exceeds 25 MB, discard it and
   re-download the MP3 preview instead.**
2. If the track's language is unknown, run a **first Whisper pass on the leading 90 seconds**
   purely to detect the language.
3. Run the **full pass** with that language forced (prevents mid-song language drift).
4. Filter the result on `no_speech_prob`, `avg_logprob` and `compression_ratio` — returns
   empty rather than hallucinating on instrumentals.

Steps 2 and 3 mean an unknown-language track costs **two** Groq calls, not one.

### Cost per track

At $0.111/hour, with our production average duration of 163 s (2:43):

| Case | Audio billed | Cost |
|---|---|---|
| Language known (from `tracks.language`) | 2:43 | **$0.0050** |
| Language unknown (detection + full pass) | 1:30 + 2:43 | **$0.0078** |
| Worst case in production today (6:40) | 1:30 + 6:40 | **$0.0151** |

Call it **~$0.01 per track**. This is genuinely negligible per unit — the risk is volume,
not unit price.

### Guardrails in place

1. IP rate limit — 10 / hour
2. Plan feature flag — `plan_limits.features.lyrics_transcription` (Starter and above)
3. Per-user-per-track — 5 / hour
4. Per-track globally — 3 / 24h
5. Per-user — 500 / 24h
6. Platform fuse — 2 000 / 24h

There is deliberately **no monthly quota**: transcription is an included feature, and it is
already bounded by the plan's track limit. The guards exist to stop hammering, not to meter.

---

## 5. What we have actually spent

Production numbers as of August 5, 2026: 197 tracks across 8 workspaces, largest workspace
65 tracks, 172 tracks with transcribed lyrics, 1 Smart A&R query this billing period.

| Workload | Volume to date | Estimated spend |
|---|---|---|
| Transcription | 172 tracks × ~$0.008 | **~$1.38** |
| Smart A&R | low double digits × ~$0.005 | **< $0.10** |
| **Total lifetime** | | **≈ $1.50** |

Groq is not currently a cost line. Everything below is about what happens when it becomes one.

---

## 6. Scaling challenges

### 6.1 The 128k context wall — the real blocker

`llama-3.3-70b-versatile` has a 128 000-token context window. At ~100 tokens per track, the
prompt saturates around **1 250 tracks**.

Our Business plan sells **5 000 tracks**. A Business customer who fills their catalog will
get an HTTP 400 from Groq, not a degraded result. Smart A&R simply stops working for exactly
the customers paying the most.

This is not a distant problem — it is a hard failure at 25% of a sold quota, and there is no
code path that degrades gracefully.

**Action required:** verify whether PostgREST `max-rows` is configured on this project. If it
is unset (Supabase's default), nothing truncates the SELECT and the wall is real at ~1 250
tracks. If it is set to 1 000, we have an accidental ceiling nobody chose, which silently
drops tracks from matching without telling the user. Both outcomes need fixing; the fix is
the same (see §7.2).

### 6.2 Margin compression on Business

Business is $45/month and includes 500 Smart A&R queries.

| Customer catalog | Cost per query | 500 queries |
|---|---|---|
| 200 tracks | $0.013 | $6.50 |
| 500 tracks | $0.030 | $15.00 |
| 1 000 tracks | $0.060 | **$30.00** |

A Business customer with a large catalog who uses their full quota consumes **two thirds of
their subscription price in Groq inference alone** — before R2 storage, Railway, or Supabase.

The AI Credits add-on is healthier: $5 / 25 credits = $0.20 revenue per query against $0.06
cost at 1 000 tracks, ~70% margin. But margin narrows as catalogs grow, and credits never
expire, so a credit bought today may be redeemed against a much larger catalog in two years.

### 6.3 Circuit breakers are calibrated in requests, not dollars

The platform fuse allows 3 000 Smart A&R queries per 24h. That was sized against today's
catalogs. At 1 000 tracks per query it authorizes **$180/day — roughly $5 400/month** of
Groq spend before anything trips. The transcription fuse (2 000/24h) is tamer at ~$20/day,
but it too was sized on short tracks.

Both fuses count *requests*. Cost scales with *catalog size* and *audio duration*. The two
are decoupled, which means the fuses do not actually bound spend.

### 6.4 No token accounting

Groq returns `usage.prompt_tokens` and `usage.completion_tokens` on every completion. We
discard both. Every figure in this document is a model, not a measurement — we currently
cannot answer "what did Groq cost us last month, and who drove it" from our own data.

### 6.5 Wasted master download in transcription

The function downloads the full WAV master, checks `blob.size > 25 MB`, and on failure
re-downloads the MP3 preview. A 3-minute 48kHz/24-bit WAV is ~50 MB, so for most real masters
**the large download always happens and is always thrown away**.

R2 has no egress fees, so this costs no money — but it costs latency and, more importantly,
Edge Function memory. Supabase Edge Functions are memory-bounded; buffering a large WAV into
a Blob is an OOM vector on longer masters. Checking `Content-Length` via a HEAD request before
downloading eliminates it entirely.

### 6.6 Single-vendor dependency

Both AI features are hard-wired to Groq's URLs and model names, inline in the Edge Functions.
Groq's corporate situation changed materially in December 2025 (NVIDIA licensing deal); the
platform is operating normally, but we have zero abstraction and no fallback. If Groq
deprecates `llama-3.3-70b-versatile` or changes pricing, we edit and redeploy two functions
under time pressure.

We already solved this shape of problem once — storage goes through a `getStorageProvider()`
abstraction with a `STORAGE_PROVIDER` env var. AI inference deserves the same treatment.

---

## 7. Recommendations, in priority order

### 7.1 Log token usage — immediate, ~30 minutes

Persist `usage.prompt_tokens`, `usage.completion_tokens`, model name and catalog size on
every Smart A&R call; persist billed audio seconds on every transcription. Nothing else on
this list can be prioritized properly until we are measuring instead of estimating.

### 7.2 Pre-filter the catalog before the LLM — before any customer exceeds 500 tracks

Extract structured constraints from the brief (genre, BPM range, vocal/instrumental, language,
sync tags), filter in SQL, and send the model a capped shortlist (~300 tracks). This fixes
§6.1 and §6.2 in one change, caps worst-case cost per query at roughly $0.02 regardless of
catalog size, and very likely **improves** match quality — a model ranking 300 pre-qualified
tracks outperforms one ranking 1 000 mixed ones.

This is also the exact primitive Similarity Search (pgvector embeddings) needs, so it is not
throwaway work. Sequencing it before the vector work is the right call.

### 7.3 Make the circuit breakers cost-based

Replace or supplement the request-count fuses with a rolling spend ceiling, using the data
from §7.1. A fuse that does not bound dollars is not a fuse.

### 7.4 Evaluate `whisper-large-v3-turbo`

$0.04/hour versus $0.111/hour — a 64% reduction. Turbo is weaker on accented and heavily
processed vocals, which is precisely our workload, so this needs a real A/B on a sample of
production tracks before adopting. Worth measuring, not worth assuming.

Cheaper still: use turbo for the 90-second **language detection** pass (where accuracy demands
are trivial) and keep large-v3 for the full pass. That is a safe, immediate 30% cut on
unknown-language tracks with no quality risk.

### 7.5 Investigate the Batch API for transcription

Transcription is already fire-and-forget on upload — the user is not waiting on it. That makes
it a textbook Batch API candidate at 50% off. Confirm Groq's Batch API supports the audio
transcription endpoint before planning around it; the discount is documented for chat
completions and we have not verified audio coverage.

### 7.6 Abstract the provider

Introduce an `_shared/ai.ts` mirroring `getStorageProvider()`, with model names and endpoints
behind env vars. Low effort now, high value the day pricing or availability changes.

---

## 8. Reference

| Item | Value |
|---|---|
| Supabase project | `xhmeitivkclbeziqavxw` |
| Functions | `supabase/functions/smart-ar/index.ts`, `supabase/functions/transcribe-lyrics/index.ts` |
| Secret | `GROQ_API_KEY` (single key, both functions) |
| Related | `docs/TRAKALOG_BILLING.md` (quotas, AI Credits), `docs/TRAKALOG_ARCHITECTURE.md` |
| Not Groq | Sonic DNA (Railway/Essentia), watermarking (Railway/audiowmark) |

> Edge Functions require a manual `supabase functions deploy <name>` after every push. A
> stale deployed version is a recurring failure mode on this project — always confirm the
> deploy, not just the commit.
