# COWOK_VALIDATION_REPORT — Validation P1-07 (invitations) + P0-05 (waitlist)

**Date:** 2026-06-07 · **Main:** `4af495d` · **Project:** `xhmeitivkclbeziqavxw` · **Mode:** test + diagnostic, no fix applied

---

## Verdicts

| Fix | Verdict | Summary |
|---|---|---|
| **P0-05 waitlist** | ❌ **KO — P0 broken in prod** | Every signup returns 500: the function inserts a `source` column that doesn't exist in the `waitlist` table. |
| **P1-07 invitations** | 🟡 **Code validated, e2e not tested** | Code review + Edge Function: logic correct (auto-whitelist auth email + live session). e2e test blocked: requires Yannick login. |

---

## P0-05 — Waitlist signup ❌ BROKEN

### Root cause
The `waitlist` table has columns: `id, email, created_at, invited_at, invitation_sent_by`. **There is no `source` column.**
The Edge Function `add-to-waitlist` always does:
```js
const source = typeof body.source === "string" ? body.source.slice(0, 64) : "landing";
const insertPayload = { email };
if (source) insertPayload.source = source;   // ← source is ALWAYS "landing"
await supabaseAdmin.from("waitlist").insert(insertPayload);
```
`source` is always truthy (default `"landing"`) → the insert carries a non-existent column → PostgREST rejects → caught and hidden in `500 {"error":"Could not save your email"}`. On the front, `LandingPage.tsx` displays the toast "Something went wrong". **No visitor can sign up for the waitlist.**

### Evidence (end-to-end test, IP Cowork, from www.trakalog.com)

Identical request to `LandingPage.tsx` (POST `/functions/v1/add-to-waitlist`, apikey + Bearer anon):

| Test | Payload | Status | Body |
|---|---|---|---|
| Valid email | `cowork-test-002@trakalog.com` | **500** | `{"error":"Could not save your email"}` |
| Same email (should be duplicate→200) | same | **500** | `{"error":"Could not save your email"}` (never inserted, therefore never "duplicate") |
| Invalid email | `not-an-email` | 400 | `{"error":"Invalid email"}` ✅ validation OK |

Edge Function logs (verbatim) confirm: `POST | 500 | .../add-to-waitlist` (×2) + `POST | 400` + `OPTIONS | 200`.
DB check: `SELECT count(*) FROM waitlist WHERE email LIKE 'cowork-%'` → **0** (nothing inserted, no test data to clean).

### What works in P0-05
- ✅ **CORS:** `OPTIONS` → 200, origins allowlisted (`getCorsHeaders` / `rejectInvalidOrigin`).
- ✅ **Email validation:** malformed email → 400.
- ✅ **Rate limit:** burst of 6 requests from the same IP → 5 pass the barrier then **429** (`check_rate_limit` `add-to-waitlist:<ip>`, 5/900s). Observed: `[500,500,500,429,429,429]` (3 previous requests in the window + 3 new = switch at the 6th).
- ❌ **Insert:** the only broken step — but it breaks 100% of real signups.

### Recommended fix (NOT applied — to validate with you)
Two options, **Option A recommended** (least risky, no DDL):

- **Option A — remove `source` from the Edge Function payload** (`add-to-waitlist/index.ts`). `source` is stored nowhere anyway:
  ```diff
  -    const source = typeof body.source === "string" ? body.source.slice(0, 64) : "landing";
       ...
  -    const insertPayload: Record<string, unknown> = { email };
  -    if (source) insertPayload.source = source;
  +    const insertPayload: Record<string, unknown> = { email };
       const { error: insertErr } = await supabaseAdmin.from("waitlist").insert(insertPayload);
  ```
  Edge Function redeploy only, zero migration.

- **Option B — add the column** if you want to track provenance:
  ```sql
  ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS source text DEFAULT 'landing';
  ```
  (to execute in the SQL Editor; the current code would work as-is after that).

Recommendation: **Option A** now to unblock the launch, Option B later if provenance analytics becomes useful.

---

## P1-07 — Invitation login loop 🟡 Code validated, e2e to finish

### DB state (before test)
- `whitelisted_emails`: 10 entries (test accounts + known betas).
- `invitations` workspace Banx & Ranx Test: 0 (global table: 3 invitations, all old).

### Code review + Edge Function (deployed v19)
The fix logic is **correct**:

1. **`AcceptInvitation.tsx`** uses `useAuth().session` live (l.55, `var { session: authSession } = useAuth()`) — no more manual parsing of `localStorage.trakalog_session_backup` (source of the old loop). `handleAccept` sends `{ token, user_id: session.user.id }` to the function. "Sign up" redirects to `/auth?invite=<token>`.
2. **Edge Function `accept-invitation`** (step 6, the core of fix P1-07/BUG-02):
   ```js
   const { data: authUser } = await supabase.auth.admin.getUserById(userId);
   const authEmail = authUser?.user?.email?.toLowerCase().trim();
   if (authEmail) {
     await supabase.from("whitelisted_emails").upsert({ email: authEmail }, { onConflict: "email" });
   }
   ```
   → whitelists the **real** auth email (not `invitation.email`), which breaks the loop when the user signs up with an email different from the invited one. Plus: checks status `pending`, expiration, upsert `workspace_members`, marking `accepted`, rate limit 10/h, CORS/origin.

### Why e2e not completed
The end-to-end test (invite → accept with a 2nd Google account → verify no loop) **requires your login** on app.trakalog.com and a 2nd test Google account. Conforming to the rules (no credentials at Cowork), I couldn't run it. The static review reveals no defect, but doesn't replace runtime validation of the absence of a loop.

### To finish (you, 5 min)
1. Login app.trakalog.com → Settings → Members → invite a test email.
2. Retrieve the token: `SELECT token, email, status FROM invitations WHERE workspace_id='38007e8a-605b-4852-8c5a-73f3bc5c827c' ORDER BY created_at DESC LIMIT 1;`
3. Open `/invite/<token>` in private browsing, "Accept", login with a different account.
4. Verify: `SELECT * FROM whitelisted_emails WHERE email='<email_of_auth_account>'` (should appear) ; invitation `status='accepted'` ; logout/login of the same account → no loop.

---

## Bugs found

| # | Severity | Bug | Status |
|---|---|---|---|
| 1 | **P0** | `add-to-waitlist` inserts `source` (non-existent column) → all waitlist signups fail in 500 | Documented, **fix proposed not applied** (Option A) |

## Recommendations
1. **Apply the waitlist fix (Option A) as priority** — it's blocking for the pre-launch: the public landing captures no leads currently.
2. **Post-deployment smoke test Edge Functions:** a simple POST validates + assert 200 would have caught this bug (3rd incident of the same type: RPC/function that passes deployment but breaks at execution). To add to the deployment workflow.
3. **Partially unmask errors in staging:** the `console.error("[add-to-waitlist] insert failed:", insertErr)` is well present server-side — verify that these logs are monitored (they would have shown the `source` column error).
4. **Finalize the e2e test P1-07** on Yannick's side (procedure above) before checking the fix as validated.
