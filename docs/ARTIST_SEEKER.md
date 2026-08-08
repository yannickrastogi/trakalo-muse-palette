# TRAKALOG — Artist Seeker (Future Feature)

> **Document created on:** April 13, 2026
> **Objective:** Scan internet and social networks to find active artists, match with user's catalog, maximize track placements.
> **Status:** Planned — after Smart Brief Matching

---

## Vision

The problem: producers and songwriters send beats and songs blindly via Instagram DM, not knowing if the artist is looking for that kind of sound. It's inefficient and frustrating.

**Artist Seeker** reverses the flow: instead of waiting for a brief, Trakalog proactively finds artists that match the user's catalog.

### Complete pipeline

```
User sets criteria (genre, followers min/max, region, monthly listeners)
  → Agent scans APIs (Spotify, YouTube, socials)
    → Filtered and enriched results
      → Claude summarizes each artist's profile (style, trends, likely needs)
        → Smart Brief Matching compares artist style with catalog
          → Track suggestions to pitch to each artist
            → User pitches directly from Trakalog
```

---

## Data sources

### Spotify API (free, rate limited)
- Monthly listeners
- Genres / sub-genres
- Popularity (score 0-100)
- Similar artists
- Recent releases (style analysis)
- Top tracks (tempo, key, mood analysis)
- Main markets (listening countries)
- **Access:** Free with Spotify Developer Account
- **Rate limit:** ~180 req/min with token

### YouTube Data API (free, 10,000 quota/day)
- Subscribers
- Total views and per video
- Recent videos (release frequency)
- Engagement (likes, comments)
- **Access:** Free with Google Cloud API key

### Instagram Graph API
- Followers
- Recent posts
- Engagement rate
- Bio (contact email sometimes)
- **Access:** Requires Meta Business Account
- **Limit:** Private accounts inaccessible

### TikTok API
- Followers
- Recent videos
- Sounds used (style insight)
- **Access:** Restrictive, requires developer approval
- **Alternative:** Lightweight scraping of public profiles

### Chartmetric / Songstats / Soundcharts (paid APIs)
- Aggregation of all sources above
- Historical data and trends
- Contact emails sometimes included
- Playlist tracking
- **Cost:** $500-2000/month depending on plan
- **Advantage:** Reliable, pre-cleaned data, stable API

---

## Technical architecture

### Agent Service (Railway or Edge Function)

```
POST /search-artists
Body: {
  genres: ["dancehall", "afrobeats"],
  monthly_listeners_min: 10000,
  monthly_listeners_max: 500000,
  region: "US",
  max_results: 20
}

Response: {
  artists: [
    {
      name: "Artist Name",
      spotify_id: "xxx",
      monthly_listeners: 125000,
      genres: ["dancehall", "afropop"],
      popularity: 45,
      recent_releases: [...],
      social_links: { instagram: "...", youtube: "...", tiktok: "..." },
      followers: { spotify: 80000, instagram: 45000, youtube: 12000 },
      summary: "Dancehall artist on the rise, based in Toronto...",
      style_analysis: {
        avg_bpm: 105,
        common_keys: ["C Min", "G Min"],
        mood: ["energetic", "tropical"],
        vocal_style: "female"
      },
      matching_tracks: [
        { track_id: "uuid", title: "Track Name", match_score: 87, reason: "BPM and mood aligned..." }
      ]
    }
  ]
}
```

### Data flow

1. **Spotify search:** `GET /v1/search?type=artist&genre=dancehall` → list of artists
2. **Enrichment:** for each artist → `GET /v1/artists/{id}` (stats) + `GET /v1/artists/{id}/top-tracks` (style)
3. **Style analysis:** extract average BPM, frequent keys, mood of top tracks via Spotify Audio Features
4. **Claude summary:** send profile to Claude for a human-style summary of style and likely needs
5. **Smart Brief Matching:** compare style_analysis with catalog's sonic_dna → score tracks
6. **Result:** list of artists with recommended tracks to pitch

### Trakalog integration

- **New menu:** "Artist Seeker" in header (next to Smart A&R)
- **Interface:** filters (genre, listeners, region) + results in cards
- **Each artist card:** photo, name, stats, summary, "View matching tracks" button
- **Click on artist:** opens detail with recommended tracks from catalog
- **Action:** "Pitch this track to [Artist]" → creates a pitch or opens pitch flow

---

## Implementation phases

### Phase 1 — MVP (Spotify only) — ~2-3 weeks
- Search artists via Spotify API
- Filters: genre, monthly listeners min/max, popularity
- Basic stats: monthly listeners, genres, popularity, recent releases
- Artist summary via Claude API
- Basic style analysis (average BPM, keys of top tracks via Spotify Audio Features)
- Matching with catalog via sonic_dna
- **Cost: ~$5-20/month** (Claude API for summaries)

### Phase 2 — Enrichment — ~2 weeks
- Add YouTube stats (subscribers, views)
- Scrape contact emails from bios (Instagram, YouTube, website)
- Search history (save interesting artists)
- "Watchlist": follow an artist and be notified of their new releases
- **Additional cost: negligible**

### Phase 3 — Scaling — if Trakalog takes off
- Chartmetric or Songstats integration (complete, historical data)
- Periodic automatic scan (cron): "New artists matching your catalog"
- Push notifications: "An artist matching 3 of your tracks just released a single"
- **Cost: $500-2000/month** (justifiable with Trakalog revenue)

---

## Estimated costs

### Phase 1 (MVP)

| Item | Monthly cost |
|-------|-------------|
| Spotify API | Free |
| Claude API (artist summaries) | ~$5-20 (depending on volume) |
| Railway (Agent service) | Already paid (~$5/month) |
| **Total Phase 1** | **~$5-20/month** |

### Phase 2

| Item | Monthly cost |
|-------|-------------|
| YouTube Data API | Free |
| Proxies (lightweight scraping) | ~$10-20 |
| **Total Phase 2** | **~$15-40/month** |

### Phase 3

| Item | Monthly cost |
|-------|-------------|
| Chartmetric API | $500-2000 |
| Infrastructure scaling | ~$20-50 |
| **Total Phase 3** | **~$520-2050/month** |

---

## The real competitive advantage

It's not artist search (anyone can search on Spotify). It's the **intelligent matching** between artist profile and catalog.

Knowing that "this artist makes 105 BPM dancehall in minor with female hooks, and you have 3 tracks in your catalog that match perfectly" — nobody else does that.

It's the combination **Sonic DNA + Smart Brief Matching + Artist Seeker** that creates the moat. Each component alone is useful, together they're unbeatable.

---

## Dependencies

- **Sonic DNA Profiler** ✅ (already implemented)
- **Smart Brief Matching** ⏳ (next priority)
- **Spotify Developer Account** (to be created)
- **YouTube API Key** (to be created via Google Cloud)

---

## Risks and mitigations

| Risk | Mitigation |
|--------|-----------|
| Spotify rate limits | Aggressive caching (24h), batch requests |
| Spotify TOS (scraping forbidden) | Use only official API |
| Incomplete social data | Start with Spotify only, enrich progressively |
| Matching quality | Sonic DNA + user metadata make matching reliable |
| High Chartmetric cost | Phase 3 only if revenue justifies it |

---

*This document is living. It will be updated as development progresses.*
