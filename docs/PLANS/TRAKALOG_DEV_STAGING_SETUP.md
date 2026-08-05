# Trakalog — Dev Database & Staging Environment

**Decision brief · August 5, 2026**

---

## Decision: Supabase Branching, not a second project

Verified: the `trakalog` organization is on the **Pro plan**, so branching is available.
Cost of one branch: **$0.0134/hour**, i.e. roughly **$10/month** if left running permanently.

A second, manually-managed Supabase project would not be cheaper (on Pro, every additional
project is billed as well) **and** it would drift mechanically — every migration would have to be
applied twice by hand. That is exactly the problem we just spent two days fixing with the
production baseline.

Branching builds the dev database **from `supabase/migrations/`**. This means the anti-drift rule
we wrote into `CLAUDE.md` becomes self-enforcing: if a migration is missing from the repo, the dev
branch breaks immediately and visibly.

---

## What branching does NOT cover

This is where the real scoping happens. A Supabase branch gives you a database and the Edge
Functions. Nothing else.

| Component | Branched automatically? | Decision |
|---|---|---|
| Postgres (schema) | Yes, from migrations | nothing to do |
| Edge Functions | Yes | nothing to do |
| **Data** | No — empty database | **seed required** — without `plan_limits`, nothing works |
| **Auth / Google OAuth** | No — different URL | add the staging URL in GCP + Supabase |
| **R2 (5 buckets)** | No | **5 separate `-dev` buckets, non-negotiable** |
| **Railway** (watermark + Sonic DNA) | No | second Railway environment |
| Stripe | No | keep test mode on staging, live mode on prod |
| Resend / Groq | No | same keys, shared quota, acceptable |

**The R2 point is the most important one.** The `trakalog-tracks`, `trakalog-stems` and
`trakalog-documents` buckets carry **90-day retention locks**. If staging writes into them, every
test file becomes undeletable for three months. Separate buckets from day one.

---

## Blocking prerequisite

**The migration queue must be empty before the branch is created.** A branch is built by replaying
`supabase/migrations/` against a fresh database. If the repo is not up to date, the resulting dev
database will not match production — which is precisely the bug we just eliminated.

Side benefit: creating the first branch is the **real validity test of the baseline**. If
`20260626144305_baseline_prod.sql` replays cleanly against a virgin database, the baseline is
sound. If it fails (missing extensions, dependency on `auth.users`, object ordering), we find out
on a disposable branch costing $0.01/hour instead of finding out on a day when we actually need it.

---

## Plan, in order

1. Empty the migration queue and verify `main` is clean
2. Enable branching (Supabase dashboard → connect the GitHub repo)
3. Create the `dev` Git branch and protect `main` (block direct pushes)
4. Create the persistent `dev` Supabase branch → **baseline validation test**
5. Write `supabase/seed.sql` (`plan_limits` + 1 workspace + 2 dummy tracks)
6. Vercel: point Preview environment variables at the branch, auto-deploy from `dev`
7. Google OAuth + Supabase Auth URLs: add the staging URL
8. R2: create the 5 `-dev` buckets · Railway: staging environment pointing at them
9. `CLAUDE.md`: new rule — no direct commits to `main`

**Total recurring cost: ~$15/month** (Supabase branch + Railway staging). Vercel Preview is free.

The existing 5 smoke-test suites become the promotion criterion from `dev` to `main`.

---

## Current infrastructure reference

| Item | Value |
|---|---|
| Supabase org | `trakalog` (`jnrllnwsrlgawxsxlfvb`) — Pro plan |
| Supabase production project | `xhmeitivkclbeziqavxw` (`trakalog-production`, us-east-1, Postgres 17.6) |
| Repo | `yannickrastogi/trakalo-muse-palette` |
| Baseline migration | `supabase/migrations/20260626144305_baseline_prod.sql` (41 tables, 186 functions, 103 policies, 12 enums, 19 triggers) |
| Hosting | Vercel, auto-deploy on push to `main` |
| Storage | Cloudflare R2, 5 buckets, 90-day retention locks on tracks/stems/documents |
| Async workers | Railway (audiowmark watermarking + Sonic DNA profiler) |
