# TRAKALOG — Track Versioning

> **Created:** April 13, 2026
> **Last Updated:** September 2, 2026
> **Status:** ✅ **Implemented** (this document began life as a spec while the feature was
> planned; it has been reconciled against the shipped implementation)
> **Owner:** Ishan
> **Related:** [TRACK_MANAGEMENT.md](TRACK_MANAGEMENT.md), [SHARING_SYSTEM.md](SHARING_SYSTEM.md), [RPCS.md](../DEVELOPMENT/RPCS.md)

---

## Vision

A track passes through several versions: demo → V1 → V2 → radio edit → clean → final master.
A user should be able to upload those versions under the same track, compare them A/B at the
same timecode, and choose which one is the "active" version used for pitches and shared links.

---

## Key principles

1. **One track = one work.** Shared metadata (title, artist, splits, lyrics, cover, mood,
   genre) stays on the parent track.
2. **Each version owns its audio data:** audio file, waveform, Sonic DNA, duration, notes.
3. **Auto-naming:** the first version is "V1", subsequent ones "V2", "V3"… The user can rename.
4. **One active version:** the one used in pitches, shared links and the default player. Any
   version can become active.
5. **A/B switching:** in TrackDetail, the user can flip between versions at the same timecode
   for instant comparison.

---

## Database

### `public.track_versions` — as shipped

```sql
CREATE TABLE public.track_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    version_name text DEFAULT 'V1'::text NOT NULL,
    audio_url text,               -- original audio (storage path)
    audio_preview_url text,       -- compressed MP3 preview
    waveform_data jsonb,          -- waveform for this version
    sonic_dna jsonb,              -- Sonic DNA for this version
    duration_sec numeric,
    is_active boolean DEFAULT false,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    chapters jsonb DEFAULT '[]'::jsonb
);
```

Constraints and indexes actually present:

```sql
ALTER TABLE ONLY public.track_versions
    ADD CONSTRAINT track_versions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.track_versions
    ADD CONSTRAINT track_versions_track_id_fkey
    FOREIGN KEY (track_id) REFERENCES public.tracks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.track_versions
    ADD CONSTRAINT track_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id);

CREATE INDEX idx_track_versions_active
    ON public.track_versions USING btree (track_id) WHERE (is_active = true);
CREATE INDEX idx_track_versions_created_by
    ON public.track_versions USING btree (created_by);
```

Two differences from the original spec, both deliberate:

- **The spec's `UNIQUE (track_id, is_active)` constraint was never created — and it was wrong.**
  A unique constraint on that pair would permit only *one inactive* version per track, which is
  the opposite of what is needed. Single-active is enforced in
  `set_track_version_active` instead, and the partial index
  `WHERE is_active = true` makes looking up the active version cheap.
- **`chapters jsonb` was added** and is not in the spec. Chapter markers are per-version,
  because a radio edit's structure differs from the original's.

### Columns on `tracks`

```sql
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS has_versions boolean DEFAULT false;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS version_count integer DEFAULT 1;
```

Both shipped.

### Backfilling existing tracks

```sql
INSERT INTO track_versions (track_id, version_number, version_name, audio_url,
                            audio_preview_url, waveform_data, sonic_dna, duration_sec,
                            is_active, created_by)
SELECT id, 1, 'V1', audio_url, audio_preview_url, waveform_data, sonic_dna, duration_sec,
       true, uploaded_by
FROM tracks
WHERE audio_url IS NOT NULL;

UPDATE tracks SET has_versions = true, version_count = 1 WHERE audio_url IS NOT NULL;
```

---

## RPCs

All are `SECURITY DEFINER` and take `_user_id` first. Note that every one of them also takes
`_workspace_id` — the authorization check needs it, and passing the track id alone is not
enough.

| RPC | Signature | Returns |
|---|---|---|
| `add_track_version` | `(_user_id, _track_id, _workspace_id, _version_name, _audio_url, _audio_preview_url, _waveform_data, _sonic_dna, _duration_sec, _notes)` — plus a trailing `_file_size_bytes bigint DEFAULT NULL` | `uuid` |
| `set_track_version_active` | `(_user_id, _track_id, _workspace_id, _version_id)` | `void` |
| `delete_track_version` | `(_user_id, _version_id, _track_id, _workspace_id)` | `void` |
| `update_track_version_notes` | `(_user_id, _version_id, _track_id, _workspace_id, _notes)` | `void` |
| `update_track_version_chapters` | `(_user_id, _version_id, _track_id, _workspace_id, _chapters)` | `void` |
| `update_track_version_waveform` | `(_user_id, _version_id, _track_id, _workspace_id, _waveform_data, _duration_sec)` | `void` |

---

## UX — TrackDetail

### Version selector (under the title, above the player)

```
┌──────────────────────────────────────────────────┐
│  Naughty Gyal                                     │
│  Arjun K. x Ayu Shy x Banx & Ranx                │
│                                                   │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌───────┐ │
│  │ V1  │  │ V2  │  │ V3  │  │ V4★ │  │  + ▲  │ │
│  └─────┘  └─────┘  └─────┘  └─────┘  └───────┘ │
│                                                   │
│  ★ = active version (used for pitches)           │
│  + = Upload New Version                           │
│  ▲ = Set as Active (on the selected version)     │
└──────────────────────────────────────────────────┘
```

Implemented by `src/components/VersionSelector.tsx`.

### Version tab behaviour

- **Click a version:** loads its waveform and audio into the player. If the track was playing,
  playback continues at the same timecode (A/B switch).
- **★** on the active version: shows which one feeds pitches and shared links.
- **Double-click the name:** rename the version (free text).
- **"+" button:** opens a file picker to upload a new version. Auto-named "V[N+1]".
- **Right-click or the "…" menu** on a version:
  - "Set as Active" → this version becomes the default
  - "Download" → download this audio file
  - "Delete Version" → not permitted on the last remaining version
  - "View Notes" → open/edit this version's notes

### A/B comparison

Switching version during playback:

1. The player records the current timecode (e.g. 1:34)
2. Loads the new version's audio
3. Seeks to the same timecode (1:34)
4. Resumes immediately
5. The waveform updates to the new version's
6. Seamless — like an A/B in a DAW

The audio swap is `swapAudioSource(rawStoragePath, { playWhenReady })` on
`AudioPlayerContext`. It preserves the current timecode and play state, and takes a raw storage
path inside the `tracks` bucket. **The caller is responsible for ensuring the swap targets the
same logical track** — `currentTrack` deliberately stays unchanged, so pointing it at an
unrelated file would silently desynchronise the UI from the audio.

### Per-version notes

Each version has a small notes field, reachable via a 📝 icon beside the version name. Clicking
opens an inline input. Examples: "Mixed by Jean", "Added guitar bridge", "Clean version, no
explicit", "Final master".

---

## UX — Catalog list

If a track has more than one version, the catalog row shows a discreet badge — "V4" or
"4 versions" in `text-2xs` beside the title. On hover: "4 versions — V4 is active".

---

## UX — Upload

### Initial upload

- The track is created normally
- A `track_versions` row is created automatically with `version_name = 'V1'`,
  `is_active = true`
- `audio_url` is stored **both** in `track_versions` and on `tracks`, for backward
  compatibility

### Uploading a new version from TrackDetail

1. Click "+" in the version selector
2. File picker opens (WAV, MP3, FLAC, AIFF)
3. The file uploads to storage alongside the track, suffixed:
   `{workspace_id}/{track_id}_v{N}.{ext}`
4. A new `track_versions` row is created:
   - `version_number = max(version_number) + 1`
   - `version_name = 'V' || version_number`
   - `is_active = false` — uploading never silently changes which version ships
5. Sonic DNA runs automatically on the new version
6. MP3 preview compression, fire-and-forget
7. Toast: "Version V3 uploaded — Sonic DNA analysis in progress…"
8. The new version appears in the tabs

---

## Shared links and pitches

- Shared links and pitches **always** use the active version (`is_active = true`)
- Changing the active version repoints existing shared links at the new one
- The shared-link recipient sees only the active version — never the others
- To share a specific non-active version, create a shared link from that version's "…" menu

On `SharedLinkPage` the player loads the active version's audio, and watermarking applies to
it — the watermark is per *(link, visitor)*, so switching the active version produces a new
cache entry but the same payload for that visitor.

---

## Sonic DNA

Each version carries its own Sonic DNA, because analysis genuinely differs:

- BPM can differ (a faster remix)
- Structure can differ (a radio edit without the bridge)
- The energy curve differs

`tracks.sonic_dna` mirrors the **active** version's. When the active version changes,
`set_track_version_active` copies the new version's `sonic_dna` — along with `audio_url`,
`audio_preview_url`, `waveform_data` and `duration_sec` — up onto the parent track. That
denormalisation is what lets the catalog, Smart A&R and shared links read a single row without
joining `track_versions`.

---

## Smart A&R matching

Matching uses the active version's Sonic DNA, but can also scan the others:

- "V2 of this track matches this brief better than V1 (92% vs 78%)"
- Suggestion: "Switch to V2 as active for better brief matching"

---

## Set-as-active flow

1. The user clicks "Set as Active" on a version
2. `set_track_version_active(_user_id, _track_id, _workspace_id, _version_id)`:
   - clears `is_active` on every version of the track
   - sets `is_active = true` on the chosen one
   - copies `audio_url`, `audio_preview_url`, `waveform_data`, `sonic_dna` and `duration_sec`
     up onto `tracks`
3. Toast: "V3 is now the active version"
4. Existing shared links follow automatically

Doing all three steps inside one `SECURITY DEFINER` function is what keeps them atomic — done
from the client as three separate statements, a failure between them would leave a track with
no active version, or with the parent row describing a different version than the active one.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Backward compatibility | Automatic backfill of existing tracks + `audio_url` retained on the parent track |
| Storage cost | Each version is a full audio file — versions multiply storage against `plan_limits.storage_bytes_max` |
| Broken shared links | The active version is always the source of truth for shared links |
| User confusion | The ★ marks the active version unambiguously |
| A/B player performance | Preload the next version in the background on hover |

---

## Dependencies

- **Sonic DNA Profiler** ✅ implemented — runs per version
- **Shared Links** ✅ implemented — points at the active version
- **Storage** ✅ configured
- **Smart A&R matching** ⏳ cross-version scanning still outstanding

---

*This document is living, and will be updated as the feature evolves.*
