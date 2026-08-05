# Trakalog — Product & UX Overview

**Architecture note · August 5, 2026 · Status: DESCRIPTIVE (audited against `main`)**

Audience: engineering onboarding. This explains what the app does, who uses it, and how the
main journeys run end to end — so that a change to any screen can be reasoned about in terms
of the workflow it sits in, not just the component it lives in.

Companion documents: `GROQ_USAGE_AND_COSTS.md` (AI features), `TRAKALOG_BILLING.md` (plans and
quotas), `docs/REPORTS/FRONTEND_FETCHING_AUDIT.md` (data-fetching state).

---

## 1. What the product is

Trakalog manages **unreleased** music catalogs. That single word drives most of the design.

Once a track is public, the industry has plenty of tooling. Before release, a track is a
confidential asset that has to be shared anyway — with A&Rs, supervisors, managers, labels,
mix engineers — and every share is a leak risk with no accountability. Trakalog's positioning:

> Disco is Dropbox for music. Trakalog is the nervous system: it protects, analyses, connects
> and activates the catalog.

Concretely, the differentiators are invisible audio watermarking with leak tracing, Sonic DNA
audio profiling, AI-assisted A&R matching, splits with digital signatures, and a share-link
experience built for the recipient rather than the sender.

---

## 2. The two audiences — the most important thing to understand

Almost every product and billing decision follows from this split.

| | **Account holders** | **Link recipients** |
|---|---|---|
| Who | Producers, beatmakers, artists, managers, labels | A&Rs, supervisors, collaborators, engineers |
| Account | Yes | **No — never** |
| Entry point | `app.trakalog.com`, logged in | A URL someone sent them |
| Billed | Yes, consumes a seat | **Never counted, unlimited** |
| Sees | Full app | One page, scoped to what was shared |

The free, unlimited channel is the **shared link**. Anyone who needs permanent catalog access
becomes a member and consumes a seat; anyone who needs to hear a track gets a link. An A&R
receives a track or a playlist by link and never signs up.

This means the recipient-facing surface (`/share/:slug`) is not a secondary screen — for most
people who ever touch Trakalog, **it is the entire product**. It carries the branding, the
watermarking, the feedback capture and the consent gate.

---

## 3. Personas and access levels

Inside a workspace, four access levels form a strict hierarchy. The matrix lives in
`src/contexts/RoleContext.tsx` and is mirrored server-side.

| Capability | Viewer | Pitcher* | Editor | Admin |
|---|:--:|:--:|:--:|:--:|
| View / play tracks | ✅ | ✅ | ✅ | ✅ |
| Upload tracks | — | ✅ | ✅ | ✅ |
| Edit any track | — | — | ✅ | ✅ |
| Edit own tracks | — | ✅ | ✅ | ✅ |
| Delete tracks | — | — | — | ✅ |
| Create / edit playlists | — | ✅ | ✅ | ✅ |
| Create shared links | — | ✅ | ✅ | ✅ |
| Manage splits | — | — | — | ✅ |
| Invite members / manage team | — | — | — | ✅ |
| Branding & workspace settings | — | — | — | ✅ |

\* **Pitcher is retired from the UI** (`PITCHER_ROLE_ENABLED: false`). It stays in the server
hierarchy and display maps so legacy members still render, but it is no longer offered in
role pickers.

Separately, members carry a **professional title** (Producer, Songwriter, Mix Engineer,
Mastering Engineer, Publisher, A&R, Manager, Musician, Assistant). This is display and credit
metadata — it does **not** grant permissions. New engineers routinely conflate the two.

---

## 4. Core objects — the mental model

- **Workspace** — the container. A user can own several (a personal one plus, say, one per
  artist they manage). Everything is scoped to a workspace. Each user gets a personal
  workspace automatically, always first in the switcher.
- **Track** — the unit. Audio + cover + metadata + credits + splits + tags + lyrics + Sonic DNA.
- **Stem** — component audio files attached to a track (drums, bass, vocals…).
- **Playlist** — an ordered selection of tracks, shareable as a unit.
- **Shared link** — a URL granting scoped, revocable access to a track, playlist, stem set, or
  pack. The product's primary output.
- **Contact** — a person in the workspace's address book: collaborators, recipients, industry
  contacts.
- **Catalog share** — a workspace-to-workspace grant, either of one track or a whole catalog.
  Shared-in tracks appear in the recipient workspace's catalog but stay governed by the source.

---

## 5. Information architecture

Authenticated app (sidebar order):

| Route | Screen | Notes |
|---|---|---|
| `/dashboard` | Overview, stats, quick actions | Landing after login |
| `/tracks` | Catalog — the main working surface | |
| `/track/:id` | Track detail | The deepest screen in the app |
| `/playlists`, `/playlist/:id` | Playlists | |
| `/stems` | Stems across the catalog | |
| `/smart-ar` | AI brief matching | Quota-metered |
| `/radio` | Continuous catalog playback | Shuffle / genre / mood / energy / chill |
| `/access` | Discovery & requests | Browse, brief mode, requests tabs |
| `/contacts` | Address book + artist aliases | |
| `/shared-links` | Manage every link issued | |
| `/team` | Members, invitations, roles | Admin |
| `/workspaces` | Multi-workspace management | |
| `/workspace-settings` | Branding, catalog sharing, leak tracing | Admin |
| `/settings`, `/settings/billing` | Profile, security (2FA), appearance, plan | |
| `/notifications` | Notification center | |
| `/guide` | In-app help | |

Public / unauthenticated (no account required):

| Route | Purpose |
|---|---|
| `/share/:slug` | **Recipient experience** — listen, comment, rate, download, save |
| `/shared/:linkId` | Stem-set access |
| `/studio/:token` | QR-scanned studio credit capture |
| `/sign/:token` | Split agreement signature |
| `/invite/:token` | Accept a workspace invitation |
| `/privacy`, `/terms` | Legal |

**Hidden behind flags** (`src/config/features.ts`): `/pitch` and `/approvals` redirect to
`/dashboard`. Pages, routes, RPCs, Edge Functions, contexts and translations all remain in
place — flipping the flag restores the section with no other change. Sharing is being
consolidated around shared links; the pitch pipeline is parked, not deleted.

The app runs in **8 languages** (en, fr, es, de, it, pt, ja, ko) via i18next.

---

## 6. Workflows

### W1 — Sign-up and onboarding

Email/password or Google OAuth → a personal workspace is created automatically → guided
onboarding with a welcome modal, a product tour, and a completion checklist (upload a track,
create a playlist, invite a member, issue a link).

Implementation note: workspace auto-creation happens in `WorkspaceContext`, **not** in
`Auth.tsx`. Moving it back causes a race condition that produces duplicate workspaces. This
has been fixed once; don't reintroduce it.

### W2 — Upload a track

Five steps: **Audio → Info → Stems → Splits → Review**. A "Quick Upload" path skips all of
them for bulk imports, extracting title and artist from the filename pattern
`artist - title.mp3`.

Metadata captured: title, artists, featuring, genres, BPM, key, mood, language, type
(song / instrumental / sample / acapella), status, tags (instruments, lyric themes, mood/feel,
tempo descriptor, sync tags, custom), credits by role, splits with percentages, publishers,
labels, ISRC, album, UPC, copyright, explicit flag, notes.

After upload, three jobs run fire-and-forget: MP3 preview compression, Sonic DNA analysis
(Railway/Essentia), and lyrics transcription (Groq Whisper, Starter and above).

A completeness bar nudges toward filling metadata — this is not cosmetic. Sparse metadata
degrades Smart A&R matching, so completeness is the mechanism that makes the AI features work.

### W3 — Share

From a track, playlist, or stem set. Four share types, and **the type determines watermarking**:

| Type | Contents | Watermarked |
|---|---|---|
| `track` | One track | **Always**, including "Download all" ZIP |
| `playlist` | An ordered set | **Always**, including ZIP |
| `stems` | Component files | Working material |
| `pack` | Final delivery / masters | **No — clean audio, by design** |

Watermarking depends on `share_type`, **never** on delivery format (file vs ZIP). Packs
deliver clean masters intentionally: they exist for final delivery, mastering, and label
handoff. This is a design decision, not a bug.

Per-link options: password protection, expiry date, download on/off, download quality,
"Save to Trakalog" on/off, watermarking on/off.

### W4 — The recipient experience (`/share/:slug`)

The most important screen in the product, and the one most engineers never open.

1. **Gate** — recipient identifies themselves (name, email, optional role and company). Where
   a password is set, it is verified server-side. The consent architecture separates two
   purposes: access plus watermarking/tracing (no consent needed) versus being added to the
   artist's contacts for future outreach (dedicated opt-in checkbox, unchecked by default,
   access never conditioned on it).
2. **Listen** — waveform player, section markers, sender's branding (logo, colour, hero image).
3. **React** — timecoded comments pinned to the waveform, star ratings.
4. **Take** — download if enabled, at the chosen quality. Watermarked per the table above.
5. **Save to Trakalog** — a recipient who *does* have an account can pull the track into their
   own workspace. This is the growth loop: the recipient side generates account holders.

Every audio file served is watermarked per recipient. The proof of tracing lives in
`watermark_payloads` (hash → recipient name and email), never in the file itself.

### W5 — Feedback loop

Comments and ratings from recipients flow back into the track detail view, alongside internal
team ratings (with a team average). The sender sees who listened, how long, what they said and
how they scored it — per link and per recipient.

### W6 — Splits, credits and signature

Splits are entered at upload or on the track detail. Two capture paths:

- **Studio QR** (`/studio/:token`) — an admin generates a QR code during a session; anyone in
  the room scans it, enters name and email, and is attached to the track's credits. No account
  needed. This is the friction-killer for the classic problem of credits never being written
  down at the time they're agreed.
- **Signature request** (`/sign/:token`) — collaborators receive a link, review the split
  agreement, and sign digitally. Signed agreements are stored and can be sent out as executed
  documents.

### W7 — Smart A&R

The user writes a brief in natural language ("uptempo dark trap for a car ad, female vocal,
120–140 BPM"). The system matches against the catalog using metadata, Sonic DNA (valence,
arousal, brightness, warmth, sync-readiness) and user-applied tags, then returns a ranked
selection with a plain-language reason per track and a suggested playlist name.

Metered per plan (2 lifetime on Free, 15/50/500 per month on paid), with AI Credits available
as a top-up. See `GROQ_USAGE_AND_COSTS.md` for the cost model and the scaling ceiling.

### W8 — Access (discovery)

Three tabs: **Browse** public catalog tracks, **Brief** mode, and **Requests**. Users can
request access to a track they find; the owner approves or declines. Search is quota-limited
per plan.

⚠️ Architecture constraint: Trakalog Access must **not** cross-reference workspace contacts.
The consent basis for a contact captured on a share link does not extend to discovery-side
outreach. This has to be designed before any code is written against it.

### W9 — Team and multi-workspace

Admins invite by email with an access level and a professional title. Invitees accept at
`/invite/:token`; if they have no account they create one first and are redirected back.

Catalog sharing works workspace-to-workspace: a single track or an entire catalog, revocable.
Shared-in tracks appear in the target catalog but remain governed by the source workspace —
splits, for example, stay editable only by the origin.

The workspace switcher is always visible; the personal workspace sorts first.

### W10 — Leak tracing

The payoff for watermarking. In workspace settings, an admin drops a leaked audio file; the
system extracts the watermark, resolves the hash against `watermark_payloads`, and returns the
recipient's name, email, the link used and the date. A report can be exported.

If no watermark is found the result is stated plainly ("audio appears clean") rather than
guessed at.

### W11 — Billing

Free / Starter / Pro / Business / Enterprise, USD, 25% annual discount. Quotas are
**user-based**: tracks, storage and Smart A&R follow the uploader across all their workspaces;
workspace features follow the owner's plan. Every member consumes a seat regardless of access
level; link recipients never do.

Checkout, webhook and customer portal run through Stripe. Server-side enforcement lives in
BEFORE INSERT triggers plus `plan_limits` as the source of truth — plans are not merely
cosmetic. See `TRAKALOG_BILLING.md`.

---

## 7. Cross-cutting behaviours

- **Persistent player** — audio survives navigation; the player stays docked while the user
  moves through the app.
- **Radio** — continuous playback of the catalog filtered by shuffle, genre, mood, energy or
  chill. An internal listening tool, not a distribution surface.
- **Bulk edit** — multi-select in the catalog for batch metadata changes.
- **Track versioning** — spec written, not yet built. Note for implementation: R2 retention
  locks mean each version must write a **new path**, never overwrite.
- **Notifications** — in-app centre plus transactional email via Resend.
- **Accessibility** — WCAG 2.1 AA work done: dynamic `lang`, alt text, `MotionConfig
  reducedMotion="user"`. Remaining gaps are the seek and volume sliders, deliberately left for
  last because they are the core of the listening experience.
- **Admin console** — separate app gated by hostname (`admin.trakalog.com`), authorised by an
  email allowlist in `is_platform_admin()`. Not part of the customer product.

---

## 8. Design principles worth knowing before changing anything

**The recipient never signs up.** Any feature that would require a recipient to create an
account to do something basic — hear a track, leave a comment, sign a split — is wrong by
construction.

**Watermarking follows intent, not format.** If you find code branching on "is this a ZIP",
that is a bug. It should branch on `share_type`.

**Metadata completeness is a product mechanism.** The nudges exist because Smart A&R, Sonic
DNA and future matching features are only as good as what was entered at upload.

**Product honesty in copy.** Automatic mood detection and structure detection were removed
because they were inaccurate — do not describe them in UI text or marketing. Sonic DNA is an
internal engine, not a user-facing section. The approved phrasing is "automatic BPM and key
detection plus audio fingerprinting that powers Smart A&R matching".

**Hidden ≠ deleted.** Pitch and Approvals are flagged off, fully intact underneath. Don't
garbage-collect them.
