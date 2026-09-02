# ADR-0007: Invisible Audio Watermarking Approach

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog's core value proposition includes protecting pre-release music from leaks. When shared tracks are accessed by external parties (A&R reps, collaborators, label executives), we need to ensure that any leaked audio can be traced back to the source. This requires embedding traceable identifiers into audio files without degrading audio quality.

### Problem Statement

We considered several approaches for leak protection:

1. **Visible Watermarks:** Overlay audio with spoken identifiers
2. **DRM:** Digital Rights Management with encryption
3. **Metadata Watermarks:** Embed identifiers in file metadata (ID3 tags)
4. **Audio Fingerprinting:** Generate unique fingerprints for detection
5. **Invisible Watermarks:** Embed inaudible identifiers in audio spectrum
6. **Download-Only Watermarks:** Only watermark downloaded files, not streaming

Our requirements:
- **Inaudibility:** Watermark must not be perceptible to human listeners
- **Traceability:** Must uniquely identify the visitor who accessed the file
- **Robustness:** Must survive common audio transformations (MP3 compression, EQ, volume changes)
- **Per-Visitor:** Each visitor should get a unique watermark
- **Real-time:** Watermarking should be fast enough for streaming
- **Cost-Effective:** Should not significantly increase costs

### Constraints

- Audio quality is paramount (pre-release masters)
- Must work with standard audio formats (WAV, MP3)
- Must integrate with our Supabase/Railway infrastructure
- Must handle files up to 500MB
- Must be legally defensible for leak tracing

---

## Decision

**We chose invisible audio watermarking using [audiowmark](https://github.com/swesterfeld/audiowmark), with a per-visitor unique payload embedded at strength 10, encoded to 320kbps MP3 for distribution.**

### Implementation

1. **Watermarking Library:** audiowmark (open-source, industry-tested)
   - **Algorithm:** Spread-spectrum watermarking in the audio frequency domain
   - **Strength:** 10 (default, inaudible for most content)
   - **Detection Threshold:** 1.0 (confidence >1.0 = watermark detected)

2. **Payload Format:**
   - Format: `sl_[link_id]_[visitor_email_hash]`
   - Length: 32 hex characters (128 bits)
   - Example: `sl_abc123def456_vis789xyz012`

3. **Processing Pipeline:**
   - Original: WAV or MP3 master (unwatermarked, stored securely)
   - Watermark: Embed payload into audio spectrum
   - Verify: Confirm watermark can be decoded
   - Convert: Encode to MP3 320kbps
   - Re-verify: Confirm watermark survives MP3 compression
   - Cache: Store watermarked MP3 in R2

4. **Delivery:**
   - **Streaming:** Watermarked MP3 served via signed URLs
   - **Download:** the same watermarked MP3 320kbps artefact as playback -- one encode, cached per visitor
   - **No Original:** Never serve unwatermarked audio from shared links

5. **Per-Visitor:**
   - Each visitor email = unique watermark payload
   - Same track for different visitors = different watermarked files
   - Cache key includes visitor email for uniqueness

---

## Alternatives Considered

### Option 1: Visible Watermarks (Spoken IDs)

**Pros:**
- **Simple:** Easy to implement
- **Hard to Remove:** Can't edit out without obvious artifacts
- **No Quality Loss:** Original audio unchanged

**Cons:**
- **Poor UX:** Ruins listening experience
- **Not Industry Standard:** Professionals won't accept audible tags
- **Easy to Bypass:** Can be edited out with audio tools
- **Not Scalable:** Doesn't work for thousands of visitors

**Why Not Chosen:** Inaudibility is a hard requirement for pre-release music. Visible watermarks would make the platform unusable for professional music industry use.

### Option 2: DRM (Encryption)

**Pros:**
- **Strong Protection:** Very hard to remove
- **Control:** Can revoke access to encrypted files
- **Industry Standard:** Used by streaming platforms

**Cons:**
- **Complex:** Requires specialized players and infrastructure
- **Platform Lock-in:** Users must use our player
- **No Standard:** No universal DRM for audio (unlike video)
- **Poor UX:** Can't use standard audio players
- **Cost:** Expensive to implement and maintain
- **Performance:** Adds latency, buffering issues

**Why Not Chosen:** DRM doesn't align with how the music industry works. Professionals need to use their preferred DAWs, players, and tools. DRM would prevent this.

### Option 3: Metadata Watermarks (ID3 Tags)

**Pros:**
- **Simple:** Easy to implement
- **Non-Destructive:** Doesn't modify audio data
- **Standard:** Works with all audio formats

**Cons:**
- **Easily Removed:** Trivial to strip with any audio tool
- **Not Robust:** Doesn't survive format conversion
- **Limited Space:** Can't store much data
- **Not Invisible:** Not truly embedded in audio

**Why Not Chosen:** ID3 tags are the first thing to be stripped when files are shared. They provide no real protection.

### Option 4: Audio Fingerprinting

**Pros:**
- **No Modification:** Doesn't alter original audio
- **Database Matching:** Can identify files by acoustic fingerprint
- **Industry Tools:** Services like Shazam, Audible Magic

**Cons:**
- **No Source Identification:** Can identify the track, but not WHO leaked it
- **Database Required:** Need to maintain fingerprint database
- **False Positives:** Potential for mismatches
- **No Per-Visitor:** Can't uniquely identify each download

**Why Not Chosen:** Fingerprinting solves a different problem (identifying tracks), not tracing leaks to specific individuals. We need per-visitor traceability.

### Option 5: Download-Only Watermarks

**Pros:**
- **Streaming Performance:** No watermarking latency for streaming
- **Simpler:** Only watermark when downloading

**Cons:**
- **Not Comprehensive:** Streamed audio can be recorded
- **Loophole:** Users can screen-record streaming audio
- **Incomplete Protection:** Doesn't protect all use cases

**Why Not Chosen:** If users can stream unwatermarked audio, they can capture it. The watermark must be on ALL accessed audio, including streaming.

### Option 6: Commercial Watermarking Services

**Pros:**
- **Proven:** Tested at scale
- **Robust:** Sophisticated algorithms
- **Supported:** Vendor maintenance and updates

**Cons:**
- **Cost:** Expensive at scale
- **Vendor Lock-in:** Hard to switch providers
- **Latency:** External service adds delay
- **Custom Integration:** Need to integrate with their API

**Why Not Chosen:** audiowmark provides sufficient robustness for our needs, and self-hosting gives us control and lower costs.

---

## Consequences

### Positive

1. **Inaudible:** Strength 10 watermarks are imperceptible in tests
2. **Traceable:** Each leak can be traced to specific visitor
3. **Robust:** survives the 320kbps MP3 encode -- detection threshold is a score of 1.0, and a real watermark scores around 1.5 against roughly 0.2 for noise
4. **Per-Visitor:** Unique payload for each visitor enables precise tracing
5. **Open Source:** No vendor lock-in, can audit the algorithm
6. **Self-Hosted:** Full control over the watermarking service
7. **Cost-Effective:** No per-file watermarking costs

### Negative

1. **Processing Time:** Watermarking adds 20-120s latency for first access
2. **Storage Overhead:** Watermarked files stored separately (3x storage)
3. **MP3 Limitations:** Watermark may not survive aggressive compression (<128kbps)
4. **Detection Required:** Need to run detection to trace leaks
5. **False Negatives:** Very quiet passages may have lower confidence
6. **File Size:** MP3 320kbps chosen over 128kbps for robustness, so delivery copies are roughly 7-10 MB for a 3-minute track rather than 2.5-3.5 MB

### Mitigations

1. **Caching:** Cache watermarked files per visitor to avoid reprocessing
2. **Storage Optimization:** delivery copies are cached per visitor in the `watermarked` bucket and reused, so each (link, visitor, track) triple is encoded once
3. **Async Processing:** Background job queue prevents blocking
4. **Verification:** Always verify watermark after compression
5. **Confidence Monitoring:** Track detection confidence and alert on low values
6. **Fallback:** If watermark fails, refuse to serve audio (never serve unwatermarked)

---

## References

- [audiowmark GitHub](https://github.com/swesterfeld/audiowmark)
- [audiowmark Paper](https://arxiv.org/abs/2008.11664) - Technical details of the algorithm
- [FEATURES/WATERMARKING.md](../../FEATURES/WATERMARKING.md) - Complete watermarking feature documentation
- [CLAUDE_WATERMARK_MP3_REPORT.md](../../_archive/reports/CLAUDE_WATERMARK_MP3_REPORT.md) - MP3 compression testing
- [services/watermark/README.md](../../../services/watermark/README.md) - Watermark service documentation

---

## Appendix: Implementation Notes

### audiowmark Configuration

```javascript
// services/watermark/index.js
const WM_STRENGTH = "10"  // Default, inaudible
const MP3_BITRATE = "320k"  // High quality for watermark survival
const WM_DETECT_THRESHOLD = 1.0  // Minimum confidence for detection

// Timeouts for processing steps
const ADD_TIMEOUT_MS = 110000    // Watermark addition
const FFMPEG_TIMEOUT_MS = 60000   // MP3 conversion
const VERIFY_TIMEOUT_MS = 60000   // Watermark verification
const ENCODE_GLOBAL_TIMEOUT_MS = 240000  // Total encode timeout
```

### Watermark Service Endpoints

```
POST /encode
- Input: Audio file (WAV/MP3) + payload string
- Output: Watermarked WAV file
- Verification: Automatically verify watermark can be decoded

POST /decode
- Input: Watermarked audio file
- Output: Extracted payload + confidence score
- Format: { payload: string, confidence: number }

GET /health
- Returns service status and worker availability
```

### Watermark Verification

```bash
# Encode a test file
# The payload must be exactly 32 hex characters (128 bits); the service rejects
# anything else with /^[0-9a-f]{32}$/i.
audiowmark add --strength 10 input.wav output.wav 0123456789abcdef0123456789abcdef

# Verify watermark
audiowmark get output.wav
# Output: pattern  0:00 test_payload_123456 1.530 0.279 CLIP-B
#                      ^ payload        ^ confidence

# Convert to MP3
ffmpeg -i output.wav -b:a 320k output.mp3

# Verify watermark survives MP3
audiowmark get output.mp3
# Confidence should remain > 1.0
```

### Confidence Scores

| Source | Confidence Range | Interpretation |
|--------|------------------|----------------|
| Genuine Watermark | 1.2 - 2.0+ | Clear watermark detected |
| Weak Watermark | 1.0 - 1.2 | Watermark present but weak |
| Noise | 0.2 - 0.5 | Background noise, no watermark |
| Clean Audio | 0.1 - 0.3 | No watermark present |

### Detection Threshold

- **Threshold:** 1.0 (configurable via `WM_DETECT_THRESHOLD`)
- **Strategy:** If confidence > 1.0, watermark is considered present
- **Robustness:** At strength 10, genuine watermarks typically score 1.5-2.0+

### Edge Cases

1. **Very Quiet Passages:** Watermark confidence may drop in near-silent sections
   - **Mitigation:** audiowmark spreads watermark across entire file

2. **Highly Compressed Audio:** Aggressive MP3 compression (<128kbps) may reduce confidence
   - **Mitigation:** Use 320kbps for streaming, 128kbps for downloads (both verified)

3. **Audio Processing:** Heavy EQ, compression, or effects may affect watermark
   - **Mitigation:** Watermark is designed to survive common processing

4. **Short Files:** Files <1 second may not have enough data for watermark
   - **Mitigation:** Skip watermarking for very short files, or pad with silence

### Leak Tracing Workflow

1. **Leak Detected:** Find leaked audio file in the wild
2. **Download:** Obtain a copy of the leaked file
3. **Decode:** Run `audiowmark get leaked_file.mp3`
4. **Extract Payload:** Get the embedded payload (e.g., `sl_abc123_def456`)
5. **Lookup:** Parse payload to get `link_id` and `visitor_email_hash`
6. **Identify:** Query database for the shared link and visitor
7. **Take Action:** Contact the visitor or take appropriate action

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 1.0.0 |
| **Status** | Accepted |
| **Owner** | Ishan |
| **Last Review** | August 18, 2026 |
| **Next Review** | August 11, 2027 |

---

*This ADR is a living document and may be updated as our watermarking approach evolves.*
