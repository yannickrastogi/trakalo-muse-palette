# ADR-0004: React Context for Server State

> **Status:** Accepted (describes what is implemented)
> **Date:** August 11, 2026 · **Revised:** September 2, 2026
> **Author:** Ishan
> **Supersedes:** the original ADR-0004, "React Query Over Redux"

---

## Context

Trakalog is a data-heavy SPA. Almost all of its state is **server state** — tracks, workspaces, playlists, contacts, shared links, team members — fetched from Supabase, cached client-side, and mutated by the user. Very little is genuinely local UI state.

The question was how to hold that state: a dedicated server-state library, a general-purpose store, or React's built-in primitives.

### Constraints

- React 18 + Vite SPA, no server-side rendering and therefore no request-scoped cache
- Data access goes through `SECURITY DEFINER` RPCs, not raw table reads — most fetches are one `supabase.rpc(...)` call returning a composed payload
- Workspace switching invalidates nearly everything at once
- Small team; the approach has to stay legible without specialist knowledge

---

## Decision

**Server state is held in React Context providers — one per domain — each owning its own `useState` cache and `useCallback` fetchers over `supabase.rpc(...)`.**

There are 15 such providers in `src/contexts/`:

`ApprovalContext` · `AudioPlayerContext` · `AuthContext` · `ContactsContext` · `EngagementContext` · `OnboardingContext` · `PitchContext` · `PlaylistContext` · `RadioPlayerContext` · `RoleContext` · `SharedLinksContext` · `TeamContext` · `TrackContext` · `TrackReviewContext` · `WorkspaceContext`

Each exposes a matching hook — `useTrack()`, `useWorkspace()`, `useAuth()`, `usePlaylists()`, `useSharedLinks()`, and so on — and they are nested inside `MainApp` in `src/App.tsx`.

The shape is consistent across providers:

```typescript
// src/contexts/TrackContext.tsx (abridged)
const [tracks, setTracks] = useState<TrackData[]>([]);
const [loading, setLoading] = useState(true);

const fetchTracks = useCallback(async () => {
  const [shares, shared] = await Promise.all([
    supabase.rpc("get_workspace_catalog_shares", { _workspace_id: activeWorkspace.id }),
    supabase.rpc("get_shared_workspace_tracks", { /* ... */ }),
  ]);
  // ...compose and set
}, [activeWorkspace]);

useEffect(() => { fetchTracks(); }, [fetchTracks]);
```

Refetching is explicit: a mutation calls its RPC and then re-runs the relevant fetcher, or updates local state directly.

### ⚠️ React Query is installed but unused

`@tanstack/react-query` (^5.83.0) is a dependency, and `App.tsx` mounts a `QueryClientProvider` with a default `new QueryClient()` around both `MainApp` and `AdminApp`.

**Nothing uses it.** There are zero `useQuery` and zero `useMutation` call sites in `src/`. The provider is inert scaffolding inherited from the project template.

This is a genuine loose end, not a documented design. See "Open Question" below.

---

## Alternatives Considered

### Option 1: React Query (TanStack Query)

**Pros:** purpose-built for server state — caching, deduplication, background refetch, stale-while-revalidate, optimistic updates with rollback, and request cancellation, all without hand-rolled `useState`/`useEffect`. Query-key invalidation would express "workspace changed, drop everything" in one line.

**Cons:** a paradigm to learn; query-key discipline is easy to get wrong; less obvious control flow than an explicit fetcher when debugging.

**Why not (currently) chosen:** it was *intended* — the dependency and provider were added — but adoption never happened, and the Context pattern was already established across the app. This remains the strongest candidate for a future migration.

### Option 2: Redux / Redux Toolkit

**Pros:** mature, predictable, excellent devtools, well-understood by many developers.

**Cons:** considerable boilerplate for what is overwhelmingly server state; RTK Query would be the relevant part, which puts it in the same category as Option 1 but heavier; global store shape becomes its own maintenance burden.

**Why Not Chosen:** the app has very little genuinely global *client* state. Redux would solve a problem Trakalog does not have while adding ceremony to every fetch.

### Option 3: Zustand / Jotai

**Pros:** minimal boilerplate; no provider nesting; good ergonomics for client state.

**Cons:** no built-in server-state semantics — caching, refetching and invalidation still have to be hand-written, so it does not actually replace what is needed here.

**Why Not Chosen:** it would move the same hand-rolled fetching into a different container without addressing the caching problem.

### Option 4: React Context (chosen)

**Pros:** zero dependencies; no new concepts; provider boundaries map cleanly onto domains; trivially debuggable — the fetch is right there in the file.

**Cons:** every cache concern is hand-rolled; no deduplication, so two consumers mounting together can issue the same RPC twice; no background revalidation; a context value change re-renders all consumers unless carefully memoised; nested providers grow deep.

---

## Consequences

### Positive

1. **No abstraction to learn.** A new contributor reads one file and understands how tracks are loaded.
2. **Domain boundaries are explicit** — each context owns one area, and the provider tree documents dependencies.
3. **Composed RPCs fit well.** Because a single RPC returns a fully-composed payload, much of what React Query's normalisation buys you is already handled server-side.
4. **No dependency risk** for the core data path.

### Negative

1. **Caching is manual and inconsistent.** Each context solves staleness its own way.
2. **No request deduplication.** Concurrent consumers can fire duplicate RPCs.
3. **Re-render breadth.** Any change to a context value re-renders every consumer that isn't individually memoised; `TrackContext` in particular is consumed widely.
4. **Provider nesting is deep** in `MainApp`, and ordering is load-bearing (`Auth` → `Workspace` → `Role` → the rest).
5. **Refetch-after-mutate is a convention, not a guarantee** — forgetting it leaves stale UI, with no framework-level safety net.
6. **Dead weight in the bundle** from the unused React Query dependency.

### Mitigations

1. `useCallback` / `useMemo` on context values to bound re-renders — already applied in the larger contexts.
2. Fetchers keyed on `activeWorkspace` so a workspace switch naturally invalidates.
3. `useRef` guards against duplicate in-flight fetches where it has mattered.

---

## Open Question

**Either adopt React Query or remove it.** The current state — dependency installed, provider mounted, zero usage — is the worst of both: bundle cost and an implied architecture that the code does not follow, which is exactly what made the original version of this ADR wrong.

Two coherent options:

1. **Remove it.** Delete `@tanstack/react-query` and the `QueryClientProvider` wrappers in `App.tsx`. Smallest change; commits to the Context pattern.
2. **Adopt it incrementally.** Keep the provider, migrate one context at a time — `ContactsContext` or `SharedLinksContext` are good first candidates, being read-mostly and self-contained — and keep the Context API as the public surface so consumers don't change.

Until one is chosen, treat React Context as the actual architecture.

---

## References

- `src/contexts/` — the 15 providers
- `src/App.tsx` — provider nesting and the unused `QueryClientProvider`
- [04 - Component Architecture](../04-COMPONENT_ARCHITECTURE.md) — where contexts sit in the tree
- [ARCHITECTURE/AUTH_PATTERNS.md](../AUTH_PATTERNS.md) — `AuthContext` session handling, which has constraints of its own
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 2.0.0 |
| **Status** | Accepted |
| **Owner** | Ishan |
| **Last Review** | September 2, 2026 |
| **Next Review** | March 2, 2027 |

---

*Revised September 2, 2026: the original was titled "React Query Over Redux" and stated that "all database queries use React Query". They do not — there are zero `useQuery`/`useMutation` call sites, and all server state flows through React Context. The ADR now records the implemented decision, keeps React Query as a considered alternative, and flags the unused dependency as an open question.*
