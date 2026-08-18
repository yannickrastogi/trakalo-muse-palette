# ADR-0009: Feature Flags Approach

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog is a rapidly evolving platform with new features being developed continuously. We needed a way to safely deploy and test new features without risking the stability of the production application. Feature flags allow us to merge code to main branch while controlling when features are visible and available to users.

### Problem Statement

Without feature flags, our deployment options were:

1. **Feature Branches:** Maintain long-lived feature branches until complete
2. **Direct to Production:** Deploy features directly to all users when merged
3. **Staging Only:** Test in staging, then big-bang deploy to production

All of these have issues:
- Feature branches create merge conflicts and divergence
- Direct to production is risky for untested features
- Staging doesn't catch real-world issues

We needed a way to:
- Deploy code continuously without feature branches
- Control feature visibility per user/workspace
- Test features in production with limited audience
- Gradually roll out features
- Quickly disable features if issues arise

### Constraints

- Must work with React/Vite frontend
- Must integrate with Supabase backend
- Must be type-safe (TypeScript)
- Must support different flag types (boolean, string, number)
- Must be configurable per environment (dev, staging, prod)
- Must be performable (no significant overhead)
- Must be auditable (who has which features enabled)

---

## Decision

**We implemented a centralized feature flag system with environment-based defaults, workspace-level overrides, and user-level testing capabilities.**

### Implementation

1. **Flag Definition:**
   ```typescript
   // src/config/features.ts
   export const FEATURES = {
     // Core features
     SMART_AR_ENABLED: true,
     WATERMARKING_ENABLED: true,
     SPLITS_SIGNATURES_ENABLED: true,
     
     // Beta features
     MARKETPLACE_MODE: false,
     ADVANCED_ANALYTICS: false,
     AI_TRANSLATION: false,
     
     // Experimental features
     NEW_UPLOAD_FLOW: false,
     DARK_MODE_V2: false,
   } as const
   
   export type FeatureKey = keyof typeof FEATURES
   export type FeatureFlags = typeof FEATURES
   ```

2. **Flag Service:**
   ```typescript
   // src/services/featureFlags.ts
   export class FeatureFlagService {
     private static instance: FeatureFlagService
     private flags: FeatureFlags
     private overrides: Map<string, Record<FeatureKey, boolean>>
     
     constructor(defaults: FeatureFlags) {
       this.flags = { ...defaults }
       this.overrides = new Map()
     }
     
     isEnabled(key: FeatureKey, workspaceId?: string, userId?: string): boolean {
       // Check user-level override
       if (userId && this.userOverrides.has(userId)) {
         const userFlags = this.userOverrides.get(userId)!
         if (key in userFlags) return userFlags[key]
       }
       
       // Check workspace-level override
       if (workspaceId && this.overrides.has(workspaceId)) {
         const workspaceFlags = this.overrides.get(workspaceId)!
         if (key in workspaceFlags) return workspaceFlags[key]
       }
       
       // Return default
       return this.flags[key]
     }
   }
   ```

3. **Hook for React Components:**
   ```typescript
   // src/hooks/useFeatureFlag.ts
   export function useFeatureFlag(key: FeatureKey, workspaceId?: string): boolean {
     const { workspace } = useWorkspace()
     const targetWorkspaceId = workspaceId || workspace?.id
     
     return FeatureFlagService.getInstance().isEnabled(key, targetWorkspaceId)
   }
   ```

4. **Database Storage:**
   - `workspace_feature_flags` table for workspace-level overrides
   - `user_feature_flags` table for user-level testing
   - Cached in memory for performance

5. **Admin Interface:**
   - Super-admin can enable/disable flags globally
   - Workspace owners can enable flags for their workspace
   - Support team can enable flags for specific users (testing)

---

## Alternatives Considered

### Option 1: Third-Party Feature Flag Service

**Services Considered:** LaunchDarkly, Flagsmith, Unleash, Firebase Remote Config

**Pros:**
- **Managed:** No infrastructure to maintain
- **Advanced Features:** A/B testing, gradual rollouts, analytics
- **Enterprise Ready:** SOC2, audit logs, team management
- **Scalable:** Handles high traffic

**Cons:**
- **Cost:** Expensive at scale ($10-100/month for startup plans)
- **Latency:** Additional network requests for flag checks
- **Vendor Lock-in:** Hard to migrate away
- **Overkill:** More features than we need
- **External Dependency:** Another service to manage and monitor

**Why Not Chosen:** For a startup, the cost and complexity of a third-party service isn't justified. Our needs are simple enough to build ourselves, and we want to avoid external dependencies where possible.

### Option 2: Environment Variables Only

**Approach:** Use different environment variables per deployment

**Pros:**
- **Simple:** Built into all platforms
- **Fast:** No additional lookups
- **Secure:** Can't be modified at runtime

**Cons:**
- **No Per-User Control:** Can't enable features for specific users
- **No Per-Workspace Control:** Can't enable features for specific workspaces
- **Static:** Can't change without redeploying
- **Hard to Manage:** Many environment variables to track
- **No UI:** No way to manage flags without code changes

**Why Not Chosen:** Too inflexible. We need the ability to enable features for specific users/workspaces without redeploying.

### Option 3: Configuration Files

**Approach:** Use JSON/TOML configuration files with different versions per environment

**Pros:**
- **Simple:** Easy to implement
- **Versioned:** Can track changes over time
- **Fast:** Loaded at startup

**Cons:**
- **Static:** Can't change without redeploying
- **No UI:** No admin interface
- **Hard to Override:** Can't easily override for specific users
- **Merge Conflicts:** Configuration file changes can conflict

**Why Not Chosen:** Similar limitations to environment variables. We need runtime configurability.

### Option 4: Feature Branches with Preview Deployments

**Approach:** Use GitHub branches + Vercel preview deployments for feature testing

**Pros:**
- **Isolated:** Features tested in complete isolation
- **No Flags:** No need for feature flag system
- **Realistic:** Full environment for testing

**Cons:**
- **Resource Intensive:** Each feature branch creates new deployment
- **Merge Complexity:** Long-lived branches create conflicts
- **Cost:** Preview deployments have costs
- **Not Production:** Can't test with real production data
- **Access Control:** Hard to limit who can access preview

**Why Not Chosen:** Preview deployments are useful for visual testing, but they don't solve the problem of gradual rollouts to production or A/B testing with real users.

---

## Consequences

### Positive

1. **Continuous Deployment:** Can merge feature code without enabling it
2. **Safe Rollouts:** Test features with limited audience
3. **Quick Rollback:** Can disable problematic features instantly
4. **A/B Testing:** Can enable features for different user groups
5. **Type Safety:** Full TypeScript support prevents flag name typos
6. **No Branches:** Avoid long-lived feature branches
7. **Auditability:** Can track which features are enabled where
8. **Flexibility:** Supports boolean, string, and numeric flags

### Negative

1. **Complexity:** Adds complexity to the codebase
2. **Maintenance:** Feature flag system itself needs maintenance
3. **Technical Debt:** Flags that are never removed ("zombie flags")
4. **Performance:** Slight overhead for flag checks
5. **Testing:** Need to test both flag states for each feature
6. **Documentation:** Need to document all flags and their purposes

### Mitigations

1. **Flag Lifecycle:** Enforce flag cleanup after feature is stable
2. **Performance:** Cache flag values, minimize lookups
3. **Testing:** Automated tests for both flag states
4. **Documentation:** Maintain a registry of all flags
5. **Cleanup Schedule:** Regular review to remove unused flags
6. **Monitoring:** Track flag usage and adoption

---

## References

- [04 - Component Architecture](../04-COMPONENT_ARCHITECTURE.md) - Frontend patterns including feature flags
- [07 - Deployment Architecture](../07-DEPLOYMENT_ARCHITECTURE.md) - CI/CD pipeline
- [Feature Flag Best Practices](https://featureflags.io/) - Industry guidelines

---

## Appendix: Implementation Notes

### Flag Types

```typescript
// Boolean flags (most common)
SMART_AR_ENABLED: boolean

// String flags (for configuration)
DEFAULT_LANGUAGE: 'en' | 'fr' | 'es'

// Numeric flags (for limits)
MAX_TRACKS_PER_UPLOAD: number

// JSON flags (for complex configuration)
AI_MODEL_CONFIG: {
  smartAr: string
  transcription: string
}
```

### Database Schema

```sql
-- Workspace-level feature flag overrides
CREATE TABLE workspace_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  flag_value BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, flag_key)
)

-- User-level feature flag overrides (for testing)
CREATE TABLE user_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  flag_value BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ,  -- For temporary testing access
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, flag_key)
)

-- Global feature flag overrides
CREATE TABLE global_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  flag_value BOOLEAN NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
```

### React Component Pattern

```typescript
// With feature flag check
function SmartARFeature() {
  const isEnabled = useFeatureFlag('SMART_AR_ENABLED')
  
  if (!isEnabled) {
    return <FeatureComingSoon name="Smart A&R" />
  }
  
  return <SmartAR />
}

// With fallback UI
function TrackUploadButton() {
  const isNewFlowEnabled = useFeatureFlag('NEW_UPLOAD_FLOW')
  
  return isNewFlowEnabled 
    ? <NewUploadButton />
    : <LegacyUploadButton />
}

// With workspace-specific flag
function WorkspaceSettings() {
  const { workspace } = useWorkspace()
  const isMarketplaceEnabled = useFeatureFlag('MARKETPLACE_MODE', workspace?.id)
  
  if (isMarketplaceEnabled) {
    return <MarketplaceSettings />
  }
  
  return <StandardSettings />
}
```

### Edge Function Pattern

```typescript
// supabase/functions/some-function/index.ts
import { FeatureFlagService } from '../../_shared/features.ts'

Deno.serve(async (req) => {
  const flagService = FeatureFlagService.getInstance()
  const userId = req.headers.get('x-user-id')
  
  if (!flagService.isEnabled('NEW_API_FORMAT', undefined, userId)) {
    // Legacy API format
    return handleLegacyRequest(req)
  }
  
  // New API format
  return handleNewRequest(req)
})
```

### Admin Interface

```typescript
// src/pages/Admin/FeatureFlags.tsx
function FeatureFlagsAdmin() {
  const [flags, setFlags] = useState<Record<FeatureKey, boolean>>()
  const [workspaceOverrides, setWorkspaceOverrides] = useState()
  const [userOverrides, setUserOverrides] = useState()
  
  const updateGlobalFlag = async (key: FeatureKey, value: boolean) => {
    await updateGlobalFeatureFlag(key, value)
    setFlags(prev => ({ ...prev, [key]: value }))
  }
  
  const updateWorkspaceFlag = async (workspaceId: string, key: FeatureKey, value: boolean) => {
    await updateWorkspaceFeatureFlag(workspaceId, key, value)
    setWorkspaceOverrides(prev => ({
      ...prev,
      [workspaceId]: { ...prev[workspaceId], [key]: value }
    }))
  }
  
  const enableForUser = async (userId: string, key: FeatureKey, hours: number = 24) => {
    await createUserFeatureFlag(userId, key, true, hours)
    setUserOverrides(prev => ({
      ...prev,
      [userId]: { ...prev[userId], [key]: true }
    }))
  }
  
  return (
    <div>
      <h1>Feature Flags</h1>
      
      <section>
        <h2>Global Flags</h2>
        {Object.entries(FEATURES).map(([key, defaultValue]) => (
          <FlagToggle
            key={key}
            flag={key}
            value={flags?.[key as FeatureKey] ?? defaultValue}
            onChange={(v) => updateGlobalFlag(key as FeatureKey, v)}
          />
        ))}
      </section>
      
      <section>
        <h2>Workspace Overrides</h2>
        <WorkspaceFlagTable 
          overrides={workspaceOverrides} 
          onUpdate={updateWorkspaceFlag}
        />
      </section>
      
      <section>
        <h2>User Testing Access</h2>
        <UserFlagManager 
          overrides={userOverrides}
          onEnable={enableForUser}
        />
      </section>
    </div>
  )
}
```

### Flag Registry

Maintain a registry document (`docs/FEATURE_FLAGS.md`) with:

| Flag | Type | Default | Description | Owner | Target Removal |
|------|------|---------|-------------|-------|-----------------|
| SMART_AR_ENABLED | boolean | true | Enable Smart A&R feature | Ishan | N/A (core feature) |
| WATERMARKING_ENABLED | boolean | true | Enable audio watermarking | Ishan | N/A (core feature) |
| MARKETPLACE_MODE | boolean | false | Enable marketplace discovery | Ishan | Q4 2026 |
| NEW_UPLOAD_FLOW | boolean | false | New upload UI/UX | Yannick | Q3 2026 |
| DARK_MODE_V2 | boolean | false | Redesigned dark mode | Ishan | Q3 2026 |

### Cleanup Process

1. **Identify Stable Features:** Features that have been in production for >30 days with no issues
2. **Remove Flag Checks:** Remove feature flag checks from code
3. **Remove Flag Definition:** Remove from FEATURES config
4. **Remove Database Entries:** Clean up flag overrides
5. **Update Documentation:** Remove from registry
6. **Verify:** Test that feature still works
7. **Communicate:** Notify team of flag removal

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

*This ADR is a living document and may be updated as our feature flag approach evolves.*
