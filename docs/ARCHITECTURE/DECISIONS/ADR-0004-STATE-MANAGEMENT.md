# ADR-0004: React Query Over Redux

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog is a React-based single-page application that requires robust state management for handling server data (tracks, workspaces, users), client state (UI state, forms), and derived state (filters, selections). With a complex data model and realtime updates, choosing the right state management library was critical for performance, maintainability, and developer experience.

### Problem Statement

We needed to manage several types of state:

1. **Server State:** Data from the database (tracks, workspaces, users, etc.)
2. **Client State:** UI state, form state, local preferences
3. **Derived State:** Filtered lists, computed values, aggregations
4. **Realtime State:** Live updates from Supabase realtime channels

The application has:
- Complex data relationships (tracks in workspaces, users in workspaces)
- Frequent data fetching and updates
- Need for optimistic updates
- Multiple users collaborating in realtime
- Offline support requirements

### Constraints

- Must work with React 18+ and TypeScript
- Must support Suspense and concurrent features
- Must be maintainable by small team
- Must handle complex cache invalidation
- Must support realtime updates
- Must be performant with large datasets

---

## Decision

**We chose React Query (TanStack Query) for server state management, with React Context for client state and derived state.**

### Implementation

1. **React Query for Server State:**
   - All database queries use React Query
   - Automatic caching, background updates, stale-while-revalidate
   - Built-in support for Suspense and error handling
   - Query invalidation on mutations

2. **Custom Hooks for Domains:**
   - `useTrack()` - Track queries and mutations
   - `useWorkspace()` - Workspace queries and mutations  
   - `useAuth()` - Authentication state
   - `useUser()` - User profile and settings
   - `usePlaylist()` - Playlist queries and mutations

3. **Query Client Configuration:**
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
         retry: 1,
         refetchOnWindowFocus: false,
       },
     },
   })
   ```

4. **Mutation Pattern:**
   - Optimistic updates for better UX
   - Automatic cache invalidation
   - Error handling and rollback

5. **Context for Client State:**
   - AuthContext for authentication state
   - WorkspaceContext for active workspace
   - TrackContext for selected track
   - AudioPlayerContext for playback state
   - UIContext for modal, sidebar, theme state

---

## Alternatives Considered

### Option 1: Redux Toolkit

**Pros:**
- **Mature:** Industry standard, battle-tested
- **DevTools:** Excellent debugging tools
- **Middleware:** Rich ecosystem (RTK Query, Redux Persist)
- **Pattern Established:** Well-documented patterns and best practices
- **TypeScript Support:** Good TypeScript integration

**Cons:**
- **Boilerplate:** Requires significant boilerplate code
- **Learning Curve:** Steep learning curve for new developers
- **Overkill:** Too heavy for our use case
- **Normalization:** Requires manual normalization of relational data
- **Realtime Complexity:** Handling realtime updates is complex
- **Performance:** Can have performance issues with frequent updates

**Why Not Chosen:** React Query provides 80% of what we need with 20% of the code. Redux would have added significant complexity without clear benefit for our data model (which is primarily server-driven with some client state).

### Option 2: Apollo Client (GraphQL)

**Pros:**
- **GraphQL:** Efficient data fetching, single request for multiple resources
- **Caching:** Built-in normalized caching
- **Realtime:** Subscription support
- **DevTools:** Apollo DevTools

**Cons:**
- **Backend Requirement:** Would need GraphQL backend (Supabase doesn't have native GraphQL)
- **Overhead:** GraphQL schema definition and maintenance
- **Complexity:** More complex than REST for simple queries
- **Supabase Integration:** Would need custom integration layer
- **Learning Curve:** GraphQL has its own learning curve

**Why Not Chosen:** Supabase provides a PostgREST API that works perfectly with REST. Adding GraphQL would have required building and maintaining a GraphQL layer on top of Supabase, adding unnecessary complexity.

### Option 3: SWR

**Pros:**
- **Simple:** Very simple API, easy to learn
- **Lightweight:** Minimal overhead
- **React-Optimized:** Built for React by Vercel
- **Good Performance:** Efficient revalidation

**Cons:**
- **Feature Limited:** Fewer features than React Query
- **No Mutations:** No built-in mutation support
- **No Query Client:** Can't pre-fetch or manage cache programmatically as easily
- **No DevTools:** Limited debugging capabilities
- **No Built-in Retry:** Must implement retry logic manually

**Why Not Chosen:** While SWR is excellent and we considered it, React Query provides more features out of the box (mutations, query client, devtools, pagination helpers) that we need for a complex application.

### Option 4: Zustand

**Pros:**
- **Simple:** Minimal API, easy to learn
- **Lightweight:** Small bundle size
- **Flexible:** Can handle both server and client state
- **No Providers:** No context providers needed
- **Good Performance:** Optimized for performance

**Cons:**
- **No Server State Features:** No built-in data fetching, caching, retries
- **Manual Implementation:** Must build server state features manually
- **Less Structure:** Too flexible can lead to inconsistent patterns
- **No Suspense:** Limited Suspense support
- **No DevTools:** Limited debugging

**Why Not Chosen:** Zustand is excellent for client state but doesn't provide the server state features we need (caching, retries, background updates). We would have needed to combine it with something else anyway.

### Option 5: Jotai + Urql

**Pros:**
- **Atomic State:** Fine-grained state management
- **Flexible:** Can compose atoms for complex state
- **Urql:** Lightweight GraphQL client
- **TypeScript First:** Excellent TypeScript support

**Cons:**
- **Complexity:** Atomic model can be hard to understand
- **Boilerplate:** Requires defining many atoms
- **Same GraphQL Issues:** Urql has same backend requirements as Apollo
- **Less Common:** Smaller ecosystem and community

**Why Not Chosen:** While interesting, the atomic model doesn't align as well with our component hierarchy, and we'd still face the GraphQL backend issue.

---

## Consequences

### Positive

1. **Productivity:** Reduced boilerplate by ~70% compared to Redux
2. **Performance:** Automatic caching and background updates improve UX
3. **Realtime:** Easy integration with Supabase realtime via query invalidation
4. **TypeScript:** Excellent TypeScript support with type inference
5. **Suspense:** Built-in support for React 18 concurrent features
6. **DevTools:** React Query DevTools for debugging
7. **Optimistic Updates:** Easy to implement for better perceived performance
8. **Cache Management:** Fine-grained cache control (per-query or global)

### Negative

1. **Learning Curve:** Team needs to learn React Query patterns
2. **Query Key Management:** Must carefully design query keys for cache invalidation
3. **Bundle Size:** Adds ~12KB min+gzip (acceptable)
4. **Memory Usage:** Caches can use significant memory (managed via cacheTime)
5. **Context Usage:** Still need Context for client state (not a full replacement)

### Mitigations

1. **Documentation:** Create internal patterns documentation
2. **Query Key Conventions:** Establish consistent query key patterns
3. **Cache Configuration:** Tune cacheTime and staleTime based on use case
4. **Code Organization:** Organize hooks by domain for maintainability
5. **Performance Monitoring:** Track bundle size and memory usage

---

## References

- [React Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [SWR Documentation](https://swr.vercel.app/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [04 - Component Architecture](../04-COMPONENT_ARCHITECTURE.md) - Frontend architecture details

---

## Appendix: Implementation Notes

### Query Key Patterns

```typescript
// Simple query
const { data: track } = useQuery({
  queryKey: ['tracks', trackId],
  queryFn: () => fetchTrack(trackId),
})

// Query with dependencies
const { data: workspaceTracks } = useQuery({
  queryKey: ['tracks', 'workspace', workspaceId, filters],
  queryFn: () => fetchWorkspaceTracks(workspaceId, filters),
})

// Paginated query
const { data: tracksPage } = useQuery({
  queryKey: ['tracks', 'workspace', workspaceId, page, pageSize],
  queryFn: () => fetchTracksPage(workspaceId, page, pageSize),
})
```

### Mutation Pattern

```typescript
const mutation = useMutation({
  mutationFn: updateTrack,
  onMutate: async (newTrack) => {
    // Cancel ongoing queries
    await queryClient.cancelQueries({ queryKey: ['tracks', newTrack.id] })
    
    // Snapshot previous value
    const previousTrack = queryClient.getQueryData(['tracks', newTrack.id])
    
    // Optimistic update
    queryClient.setQueryData(['tracks', newTrack.id], newTrack)
    
    return { previousTrack }
  },
  onError: (err, newTrack, context) => {
    // Rollback on error
    queryClient.setQueryData(['tracks', newTrack.id], context.previousTrack)
  },
  onSettled: () => {
    // Invalidate cache
    queryClient.invalidateQueries({ queryKey: ['tracks'] })
  },
})
```

### Context Pattern

```typescript
// AuthContext.tsx
const AuthContext = createContext<AuthContextType>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  
  return (
    <AuthContext.Provider value={{ session, user, setSession, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

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

*This ADR is a living document and may be updated as our state management needs evolve.*
