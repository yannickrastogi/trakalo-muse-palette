# Archived Reports

> **Status:** Archive — historical record, not maintained  
> **Audience:** anyone tracing why a past fix was made

These are one-off diagnostic and fix reports produced during development, moved here from the
repository root on September 2, 2026. They describe the state of the system **at the time they
were written** and are not kept in sync with the code. Treat them as history: useful for
understanding a past decision, never as a description of current behaviour.

For current documentation see the [main documentation index](../../INDEX.md).

| Report | Title |
|---|---|
| [CLAUDE_ARTIST_ALIASES_SQL.md](CLAUDE_ARTIST_ALIASES_SQL.md) | SQL migration — Artist Aliases |
| [CLAUDE_CHAPTERS_SHARED_LINK_SQL.md](CLAUDE_CHAPTERS_SHARED_LINK_SQL.md) | SQL migration — Add `chapters` to shared-link RPCs |
| [CLAUDE_CONTACTS_DEDUP_SQL.md](CLAUDE_CONTACTS_DEDUP_SQL.md) | CONTACTS — Dedup + locking + bulk delete (manual SQL) |
| [CLAUDE_FIX_REPORT.md](CLAUDE_FIX_REPORT.md) | CLAUDE — Fix P0/P1 from COWORK_AUDIT_REPORT |
| [CLAUDE_FIX_REPORT_PLAYLIST.md](CLAUDE_FIX_REPORT_PLAYLIST.md) | CLAUDE — Playlist share + workspace branding fix (P0 follow-up) |
| [CLAUDE_PITCH_FIX_SQL.md](CLAUDE_PITCH_FIX_SQL.md) | CLAUDE — Pitch Fix SQL |
| [CLAUDE_PRODUCTION_STAGE_FIX_SQL.md](CLAUDE_PRODUCTION_STAGE_FIX_SQL.md) | Fix — `production_stage` was not persisting via `update_track` |
| [CLAUDE_PRODUCTION_STAGE_SQL.md](CLAUDE_PRODUCTION_STAGE_SQL.md) | SQL migration — Add `production_stage` to tracks |
| [CLAUDE_QR_POLICY_DROP.md](CLAUDE_QR_POLICY_DROP.md) | Dropping the permissive anon SELECT policy on `tracks` (QR studio) |
| [CLAUDE_R2_PHASE2_REPORT.md](CLAUDE_R2_PHASE2_REPORT.md) | R2 Migration — Phase 2 Report |
| [CLAUDE_R2_PHASE5_REPORT.md](CLAUDE_R2_PHASE5_REPORT.md) | R2 Migration — Phase 5 Report (Frontend routing through Edge Functions) |
| [CLAUDE_SECURITY_ASSERT_CALLER.md](CLAUDE_SECURITY_ASSERT_CALLER.md) | 🔐 SECURITY — `assert_caller` on critical RPCs + neutralizing `legacy_v0` |
| [CLAUDE_SIGNATURE_RLS_FIX_SQL.md](CLAUDE_SIGNATURE_RLS_FIX_SQL.md) | SQL — Close the PII leak on `signature_requests` |
| [CLAUDE_TRACK_RATING_SQL.md](CLAUDE_TRACK_RATING_SQL.md) | SQL migration — Track ratings (1–5 stars per member) |
| [CLAUDE_VERSION_CHAPTERS_SQL.md](CLAUDE_VERSION_CHAPTERS_SQL.md) | Versioning chapters — SQL to execute in Supabase SQL Editor |
| [CLAUDE_VIDEO_SHARED_LINK_SQL.md](CLAUDE_VIDEO_SHARED_LINK_SQL.md) | SQL migration — Expose video fields on shared-link RPCs |
| [CLAUDE_WATERMARK_FIX_REPORT.md](CLAUDE_WATERMARK_FIX_REPORT.md) | CLAUDE_WATERMARK_FIX_REPORT — P0 shared link "Preparing your secure copy" hang |
| [CLAUDE_WATERMARK_MP3_REPORT.md](CLAUDE_WATERMARK_MP3_REPORT.md) | Watermark MP3 Encoding — Report |
| [COWORK_AUDIT_REPORT.md](COWORK_AUDIT_REPORT.md) | COWORK — FULL TRAKALOG AUDIT |
| [COWORK_PLAYLIST_FIX_REPORT.md](COWORK_PLAYLIST_FIX_REPORT.md) | COWOK_PLAYLIST_FIX_REPORT — Playlist share "No track data available" |
| [COWORK_R2_FINAL_VALIDATION.md](COWORK_R2_FINAL_VALIDATION.md) | COWOK — R2 Migration Phase 5 — Final Functional Validation |
| [COWORK_REPORT.md](COWORK_REPORT.md) | COWOK — TRAKALOG SESSION REPORT |
| [COWORK_REPORT_BUG03.md](COWORK_REPORT_BUG03.md) | COWOK BUG-03 FIX — Report |
| [COWORK_TRACK_DETAIL_FIX_REPORT.md](COWORK_TRACK_DETAIL_FIX_REPORT.md) | COWOK_TRACK_DETAIL_FIX_REPORT — Track Details: title/artist do not persist |
| [COWORK_VALIDATION_REPORT.md](COWORK_VALIDATION_REPORT.md) | COWOK_VALIDATION_REPORT — Validation P1-07 (invitations) + P0-05 (waitlist) |
| [DIAGNOSTIC_PLAYLIST_FINAL.md](DIAGNOSTIC_PLAYLIST_FINAL.md) | DIAGNOSTIC_PLAYLIST_FINAL — Playlist share "No track data available" (post-fix SQL) |

---

*26 archived reports.*
