# TRAKALOG — Brief Seeker (Future Feature)

> **Created:** April 13, 2026
> **Last Updated:** September 2, 2026 (translated to English)
> **Goal:** Automatically scan open briefs (sync, placements, labels), match them against the
> catalog, and prepare personalised, ready-to-send pitches.
> **Status:** 📋 **Planned — nothing implemented.** Sequenced after Smart Brief Matching and
> Artist Seeker. Verified September 2, 2026: no `briefs` or `brief_matches` table exists, and
> there is no Brief Hunter service.
> **Vision:** the user sleeps, Trakalog works. In the morning, an inbox of pitches to approve.

---

## Executive summary — feasibility and ROI

### Why this is viable

A single sync placement won through Brief Seeker — typically $2,000 to $50,000 — pays for years
of infrastructure. It is the highest effort-to-reward ratio anywhere in Trakalog.

### The four levels of automation

**Phase 1 — MVP ($5-10/month)** — feasible immediately.
The user pastes a brief into Trakalog themselves. Trakalog does the matching and writes the
email. No automatic scanning. Saves 30-60 minutes per brief. Cost: ~$0.05 per brief in Claude
tokens.

**Phase 2 — Semi-automatic ($30-40/month)** — feasible within two months.
A cron scans Twitter and 2-3 brief sites twice a day. Claude parses them, extracts the
criteria, runs the matching. The user sees results in the morning.

**Phase 3 — Fully automatic ($70-100/month)** — once Trakalog has paying users.
Every source connected, Gmail MCP for briefs arriving by email, a feedback loop. High brief
volume.

**Phase 4 — Premium ($300-500/month)** — once Trakalog generates revenue.
Subscriptions to paid platforms (Taxi.com, Music Gateway). Exclusive briefs.

### Principal risk

Scraping breaks when sites change. That is exactly why Phase 1 — manual copy-paste — is
essential: it always works, and it validates the concept before any investment in automation.

### Expected ROI

- An average sync placement: $2,000-$50,000
- Phase 1 annual cost: ~$60-120
- **A single placement repays 10+ years of Phase 1 costs**
- Even at Phase 4 (~$2,400/year), one average placement is profitable

---

## Vision

The problem: placement opportunities — sync briefs, label briefs, "who's looking" lists — are
scattered across dozens of platforms. Producers spend hours searching, manually matching their
tracks, and writing personalised emails. Most briefs expire before they get round to replying.

**Brief Seeker** automates the whole pipeline: monitoring → matching → drafting → approval.

---

## Full pipeline — four agents in a chain

```
AGENT 1 — Brief Hunter (automatic monitoring)
  Scans brief sources every 12h
  Extracts: brief description, requested genre/mood/tempo, deadline, contact, estimated budget
    ↓
AGENT 2 — Smart Brief Matching (already planned)
  Compares each brief against the catalog's sonic_dna + user_metadata
  Scores each track 0-100%
  Selects the best 1-3 tracks per brief
    ↓
AGENT 3 — Pitch Writer
  Writes a personalised email for each match
  Uses: contact name, brief context, why THIS track fits
  Professional but human tone, never generic
  Includes: a Trakalog shared link to the track
    ↓
AGENT 4 — Pitch Inbox (user interface)
  In the morning the user opens Trakalog
  They see a list of ready pitches: brief → track → email → contact
  For each: Approve (send) / Edit (adjust the email) / Dismiss
```

---

## Brief sources

### Sync platforms (high priority)
- **Musicbed** — open briefs for advertising, film, TV
- **Songtradr** — sync marketplace with public briefs
- **Music Gateway** — sync briefs and placements
- **Marmoset** — curated briefs, more exclusive
- **Disco.ac** — shared briefs (a direct competitor → competitive advantage)
- **Taxi.com** — A&R listings and industry briefs
- **BroadJam** — placement opportunities

### "Who's looking" lists (labels and publishers)
- **Music Connection Magazine** — monthly publisher/label briefs
- **SongLink / Tunefind** — placements sought for series and films
- **Film Music Network** — music supervisor briefs

### Social networks and forums
- **Twitter/X** — hashtags #SyncBrief #MusicBrief #LookingForMusic #MusicSupervisor
- **Reddit** — r/musicindustry, r/WeAreTheMusicMakers (community briefs)
- **LinkedIn** — posts from music supervisors and A&R

### Emails and newsletters
- **Sync newsletters** (to subscribe to): briefs delivered directly
- **Possible Gmail integration** via MCP, to parse briefs received by email

### API vs scraping

| Source | Method | Reliability | Cost |
|---|---|---|---|
| Songtradr | API if available, else scraping | High | Free |
| Musicbed | Scrape the briefs page | Medium | Free |
| Music Gateway | API | High | Subscription (~$20/month) |
| Twitter/X | API v2 | High | Free (basic) |
| Taxi.com | Member-area scraping | High | Subscription (~$300/year) |
| Gmail newsletters | Gmail MCP | High | Free |

---

## Technical architecture

### Agent 1 — Brief Hunter

```
Railway service or Supabase Edge Function (cron every 12h)

POST /scan-briefs
Response: {
  briefs: [
    {
      id: "uuid",
      source: "Songtradr",
      title: "Upbeat pop for Nike campaign",
      description: "Looking for energetic, positive pop tracks...",
      requirements: {
        genres: ["pop", "dance pop"],
        mood: ["energetic", "uplifting", "positive"],
        bpm_range: [110, 130],
        vocal: "female preferred",
        duration: "30s-60s edit available",
        instrumental: false,
        language: "English",
        explicit: false
      },
      budget: "$5,000 - $15,000",
      deadline: "2026-05-01",
      contact: {
        name: "Sarah Johnson",
        email: "sarah@musicagency.com",
        role: "Music Supervisor",
        company: "Creative Music Agency"
      },
      url: "https://songtradr.com/brief/xyz",
      scanned_at: "2026-04-13T06:00:00Z"
    }
  ]
}
```

### Agent 2 — Smart Brief Matching (exists, to be connected)

```
For each brief the agent:
1. Converts the requirements into sonic_dna search criteria
2. Searches the catalog: BPM range, mood match, genre match, vocal/instrumental
3. Scores each track 0-100%
4. Returns the top 1-3 tracks with the reason for the match

Input:  brief.requirements + catalog sonic_dna
Output: [{ track_id, score, match_reasons, gap_analysis }]
```

### Agent 3 — Pitch Writer

```
For each brief→track match, Claude writes a personalised email:

Input: {
  contact: { name, role, company },
  brief:   { title, description, requirements },
  track:   { title, artist, sonic_dna, shared_link_url },
  match:   { score, reasons }
}

Output: {
  subject: "Re: Nike Campaign Brief — Perfect match from [Artist]",
  body: "Hi Sarah,\n\nI came across your brief for the Nike campaign...",
  tone: "professional_warm"
}

Drafting rules:
- Never generic ("I think this would be a great fit")
- Always specific ("The 8-second instrumental intro is ideal for the brand reveal")
- Mention a detail from the brief to prove it was read
- Short — 150 words maximum
- Include the Trakalog shared link
- Sign off with the workspace owner's name
```

### Agent 4 — Pitch Inbox (frontend)

```
New page in Trakalog: "Pitch Inbox" or "Opportunities"

┌─────────────────────────────────────────────────────┐
│ 🎯 3 new opportunities found this morning           │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Nike Campaign — Upbeat Pop                          │
│ via Songtradr · Budget $5-15K · Deadline May 1      │
│ Match: "Summer Vibes" (92%) — BPM & mood aligned    │
│                                                     │
│ [Preview Email]  [✓ Approve & Send]  [✏️ Edit]  [✕] │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Netflix Series "Dark Waters" — Atmospheric Score     │
│ via Musicbed · Budget $2-8K · Deadline Apr 28        │
│ Match: "Midnight Run" (87%) — Dark, minimal, no vox │
│                                                     │
│ [Preview Email]  [✓ Approve & Send]  [✏️ Edit]  [✕] │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### User actions on each opportunity

- **Preview Email** — view the agent's draft in a modal
- **Approve & Send** — send via Resend (from `noreply@trakalog.com`, reply-to the workspace
  owner)
- **Edit** — open the email in an editor, adjust, then send
- **Dismiss** — mark as irrelevant (feedback that improves matching)
- **Snooze** — defer

---

## Database tables

```sql
briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  source text NOT NULL,              -- "songtradr", "musicbed", "twitter", etc.
  source_url text,
  title text NOT NULL,
  description text,
  requirements jsonb,                -- { genres, mood, bpm_range, vocal, etc. }
  budget text,
  deadline timestamptz,
  contact_name text,
  contact_email text,
  contact_role text,
  contact_company text,
  status text DEFAULT 'new',         -- new, matched, pitched, dismissed, expired
  scanned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
)

brief_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid REFERENCES briefs(id),
  track_id uuid REFERENCES tracks(id),
  match_score integer,               -- 0-100
  match_reasons text[],
  gap_analysis text,
  draft_subject text,
  draft_body text,
  status text DEFAULT 'draft',       -- draft, approved, sent, dismissed
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
)
```

---

## Implementation phases

### Phase 1 — Manual MVP (~3-4 weeks) — $5-10/month
- The user pastes a brief (as text) into Trakalog
- Smart Brief Matching finds the tracks
- Pitch Writer drafts the email
- The user approves and sends
- No automatic scanning — manual input only
- **Immediate value:** saves 30-60 minutes per brief

### Phase 2 — Semi-automatic scanning (~3-4 weeks) — $30-40/month
- Scan 2-3 sources (Songtradr, Twitter #SyncBrief)
- Cron every 12h
- Pitch Inbox with the results
- Notifications: "3 new briefs match your catalog"
- **Value:** the user stops missing briefs

### Phase 3 — Full automation (~4-6 weeks) — $70-100/month
- Every brief source connected
- Gmail MCP to parse briefs received by email
- Learning: dismissals improve matching (feedback loop)
- Stats: acceptance rate, revenue generated by pitches
- **Value:** an autonomous placement machine

### Phase 4 — Premium — $300-500/month
- Taxi.com and Music Gateway integrations (subscriptions)
- Exclusive briefs through partnerships
- "Priority pitching" — being first to answer a brief
- **Value:** access to opportunities invisible to the public

---

## Estimated costs

### Phase 1 (MVP)

| Item | Monthly cost |
|---|---|
| Claude API (matching + email drafting) | ~$5-10 |
| Resend (sending) | Already paid |
| **Phase 1 total** | **~$5-10/month** |

### Phase 2 (semi-automatic)

| Item | Monthly cost |
|---|---|
| Claude API (scan + matching + emails) | ~$20-30 |
| Proxies (light scraping) | ~$10 |
| Railway (cron agent) | Already paid |
| **Phase 2 total** | **~$30-40/month** |

### Phase 3 (full automation)

| Item | Monthly cost |
|---|---|
| Claude API (high volume) | ~$50-80 |
| Proxies | ~$20 |
| **Phase 3 total** | **~$70-100/month** |

### Phase 4 (premium)

| Item | Monthly cost |
|---|---|
| Taxi.com | ~$25 ($300/year) |
| Music Gateway | ~$20 |
| Claude API | ~$80 |
| Proxies | ~$20 |
| **Phase 4 total** | **~$145-200/month** |

---

## Integration with the other agents

```
Brief Seeker ←→ Smart Brief Matching ←→ Sonic DNA Profiler
      ↓                                        ↑
Artist Seeker ──────────────────────────────────┘
      ↓
Pitch Writer → Pitch Inbox → Send via Resend
      ↓
Session Replay Analyst (feedback: did the contact listen? for how long?)
      ↓
Catalog Awakener (an old track matches a new brief → alert)
```

**The virtuous circle:**

1. Brief Seeker finds a brief
2. Smart Brief Matching finds the perfect track through Sonic DNA
3. Pitch Writer writes the perfect email
4. The email carries a Trakalog shared link — watermarked and trackable
5. Session Replay Analyst sees the contact replayed the chorus three times
6. If the track is placed → revenue → Ghost Revenue Hunter ensures it is all collected
7. Success improves scoring for future briefs

---

## The real competitive advantage

Nobody does this end to end. Existing tools each do one part:

- Songtradr/Musicbed: brief listings, no intelligent matching
- Taxi.com: briefs and submission, no audio analysis
- DISCO: catalog and sharing, no automatic pitching

**Trakalog would be the first to run monitoring → matching → drafting → sending → tracking →
collection.** Full-stack pitch automation.

---

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scraping blocked by the platforms | Start with Phase 1 (manual) and validate the concept first |
| Quality of generated emails | Human in the loop (approve/edit); never auto-send without approval |
| Perceived as spam | Maximum 3-5 pitches/day per contact, respect deadlines |
| Expired briefs | Check the deadline before matching, prioritise the urgent ones |
| Invalid contact emails | Email verification (MX check) before sending |
| Too many irrelevant briefs | Dismiss feedback progressively sharpens the filter |
| Sites change structure | Phase 1 (manual) always works as a fallback |

---

## Dependencies

- **Smart Brief Matching** ⏳ next priority — required before Brief Seeker
- **Sonic DNA Profiler** ✅ implemented
- **Trakalog pitch system** ⚠️ built (`send-pitch-email` Edge Function, `create_pitch` RPC,
  `pitches` table) but **currently hidden** behind `FEATURES.PITCH_ENABLED`, which is `false`.
  The flag has to be flipped before Brief Seeker can deliver anything.
- **Shared Links** ✅ implemented — watermarked and trackable
- **Resend** ✅ configured
- **Session Replay / engagement tracking** ✅ `link_events` records view/play/download per
  visitor

---

*This document is living, and will be updated as development proceeds.*
