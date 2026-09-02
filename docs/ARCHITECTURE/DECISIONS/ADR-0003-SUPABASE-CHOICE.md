# ADR-0003: Supabase Over Custom Backend

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

When building Trakalog's backend, we needed a scalable, maintainable solution for authentication, database, realtime updates, and file storage. As a pre-release startup with limited engineering resources, the choice of backend technology was critical for rapid development and long-term maintainability.

### Problem Statement

We evaluated several backend approaches:

1. **Custom Node.js/Express Backend:** Build everything from scratch
2. **Firebase:** Google's BaaS (Backend as a Service) offering
3. **Supabase:** Open-source Firebase alternative
4. **Serverless Functions:** AWS Lambda / Vercel Functions only

The music industry requires robust features:
- User authentication and authorization
- Complex data relationships (workspaces, tracks, users, splits, signatures)
- Realtime collaboration (multiple users in same workspace)
- File storage for audio, covers, documents
- Row-level security for data isolation
- Scalability to handle audio processing workloads

### Constraints

- Small engineering team (1-2 developers initially)
- Need to launch MVP quickly (weeks, not months)
- Must support complex data model with proper access controls
- Must handle audio file storage and processing
- Must be cost-effective at low scale but scalable to high scale
- Open-source preferred for transparency and control

---

## Decision

**We chose Supabase as our primary backend platform, using it for authentication, database (PostgreSQL), realtime subscriptions, and storage.**

### Implementation

1. **Core Services Used:**
   - **Supabase Auth:** User authentication with JWT
   - **PostgreSQL Database:** All application data
   - **Realtime:** available via WebSockets (not currently used — see Current Usage)
   - **Storage:** File storage for audio, covers, stems, documents
   - **Edge Functions:** Serverless compute for custom logic

2. **Architecture Pattern:**
   - Frontend (React/Vite) → Supabase Client → Supabase Services
   - Edge Functions for custom business logic (Groq integration, watermarking orchestration)
   - Railway services for heavy processing (Sonic DNA, watermark encoding)

3. **Data Model:**
   - Single PostgreSQL database with proper schema design
   - Row-Level Security (RLS) for all tables
   - Complex JSON fields for flexible data (splits, metadata)

4. **File Storage:**
   - Supabase Storage for some buckets
   - R2 Cloud Storage for production (via Supabase or direct)
   - Signed URLs for secure access

---

## Alternatives Considered

### Option 1: Custom Node.js/Express Backend

**Pros:**
- Full control over all aspects
- No vendor lock-in
- Can optimize for specific use cases
- No third-party dependencies

**Cons:**
- **Time to market:** Months to build auth, database layer, file storage
- **Maintenance burden:** Must maintain security, scalability, reliability
- **Feature completeness:** Would lack realtime, advanced auth features initially
- **Security risk:** Custom auth implementation is error-prone
- **Resource intensive:** Requires dedicated backend developer

**Why Not Chosen:** As a small team with aggressive timeline, building everything custom would have delayed launch by 3-6 months and required dedicated backend expertise.

### Option 2: Firebase

**Pros:**
- Google-backed, proven at scale
- Comprehensive feature set (Auth, Firestore, Storage, Functions)
- Good documentation and ecosystem
- Realtime updates built-in
- Easy to get started

**Cons:**
- **Vendor lock-in:** Google Cloud Platform ecosystem
- **Firestore limitations:** NoSQL model doesn't fit our relational data well
- **Cost:** Can become expensive at scale
- **Closed source:** Less transparency into implementation
- **Cold starts:** Functions have latency issues
- **Limited PostgreSQL:** Firestore is document-based, not relational

**Why Not Chosen:** Our data model is highly relational (tracks belong to workspaces, users belong to workspaces, complex permissions). Firestore's document model would have required significant data modeling compromises and denormalization.

### Option 3: Serverless Functions Only

**Pros:**
- Pay-per-use pricing
- Auto-scaling
- No server management
- Can use any backend service

**Cons:**
- **Orchestration complexity:** Managing multiple services is complex
- **Cold starts:** Latency for infrequent operations
- **State management:** Hard to manage sessions, WebSocket connections
- **Cost predictability:** Can be hard to estimate at scale
- **No built-in database:** Would still need database service

**Why Not Chosen:** While we do use serverless functions (Supabase Edge Functions, Railway), we need a unified backend service for core functionality. Pure serverless would have been too fragmented.

### Option 4: Vercel + PlanetScale

**Pros:**
- Modern stack (Next.js, PlanetScale MySQL)
- Good developer experience
- Scalable

**Cons:**
- **MySQL limitations:** No JSON type, less flexible than PostgreSQL
- **Separate auth:** Would need NextAuth or similar
- **Storage:** Would need separate solution
- **Realtime:** Would need separate WebSocket solution
- **Less integrated:** Multiple services to manage

**Why Not Chosen:** Supabase provides a more integrated solution with all needed services in one place.

---

## Consequences

### Positive

1. **Rapid Development:** Reduced backend development time from months to days
2. **Feature Richness:** auth, database, storage and Edge Functions out of the box, with realtime available if needed
3. **PostgreSQL:** Full relational database with JSON support
4. **Optionality:** built-in realtime remains available for collaborative features without adding a vendor
5. **Open Source:** Can self-host if needed, transparent implementation
6. **RLS:** Fine-grained access control without custom middleware
7. **Ecosystem:** Good TypeScript support, growing community
8. **Edge Functions:** Serverless compute for custom logic

### Negative

1. **Vendor Lock-in:** Migrating away from Supabase would be significant work
2. **Service Limits:** Must work within Supabase's scaling limits
3. **Cost:** Can become expensive at scale (but predictable)
4. **Cold Starts:** Edge Functions have cold start latency
5. **Feature Gaps:** Some features require custom implementation (rate limiting, complex queries)
6. **Multi-Provider Complexity:** Using Supabase + R2 + Railway adds orchestration complexity

### Mitigations

1. **Abstraction Layer:** Supabase client abstraction allows potential migration
2. **Multi-Provider Strategy:** Use Supabase for what it's good at, other services for specialized needs
3. **Cost Monitoring:** Track usage and costs regularly
4. **Caching:** Implement caching to reduce Edge Function cold starts
5. **Custom Functions:** Build custom logic in Edge Functions when Supabase features are insufficient

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [02 - System Architecture](../02-SYSTEM_ARCHITECTURE.md) - Complete system overview
- [03 - Data Architecture](../03-DATA_ARCHITECTURE.md) - Database schema and RLS policies
- [07 - Deployment Architecture](../07-DEPLOYMENT_ARCHITECTURE.md) - Infrastructure details

---

## Appendix: Implementation Notes

### Key Supabase Features Used

```javascript
// Authentication
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
await supabase.auth.signInWithPassword({ email, password })

// Database -- almost always through a SECURITY DEFINER RPC, not a direct table read.
// `auth.uid()` can return NULL on an unstable session, so writes and sensitive reads
// pass an explicit _user_id and let the function assert the caller.
const { data, error } = await supabase.rpc('get_workspace_tracks', {
  _workspace_id: workspaceId,
});

// Storage
const { data, error: upErr } = await supabase
  .storage
  .from('covers')
  .upload(`track-${id}.jpg`, file);
```

In `src/` there are ~169 `supabase.rpc(...)` call sites against ~12 `supabase.from(...)`.
The RPC-first rule is described in [ARCHITECTURE/AUTH_PATTERNS.md](../AUTH_PATTERNS.md).

**Realtime is not used.** Supabase Realtime was part of why the platform was attractive, but
no `supabase.channel(...)` subscription exists in the codebase — data is refetched
explicitly (see [ADR-0004](ADR-0004-STATE-MANAGEMENT.md)). It remains available if
collaborative features need it later.

### Migration Path

If we ever need to migrate from Supabase:
1. PostgreSQL database can be migrated to any PostgreSQL provider
2. Auth can be replaced with custom JWT implementation
3. Storage can be migrated to R2 or S3
4. Realtime can be replaced with custom WebSocket solution
5. Edge Functions can be deployed to Vercel or Railway

### Current Usage

| Service | Usage | Notes |
|---------|-------|-------|
| Auth | All user authentication | JWT-based |
| Database | All application data | PostgreSQL; version not pinned in the repo |
| Storage | Covers, documents, audio | Provider-switchable — see [ADR-0005](ADR-0005-R2-STORAGE.md) |
| Realtime | **Not used** | No `channel()` subscription exists in `src/` |
| Edge Functions | Custom logic | 34 functions under `supabase/functions/` |

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

*This ADR is a living document and may be updated as our backend needs evolve.*
