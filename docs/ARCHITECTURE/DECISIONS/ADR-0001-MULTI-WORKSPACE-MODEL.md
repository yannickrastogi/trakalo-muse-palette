# ADR-0001: Multi-Workspace Model

> **Status:** Accepted  
> **Date:** March 26, 2026  
> **Author:** Yannick Rastogi  
> **Supersedes:** None  
> **Related:** [01 - Vision & Overview](../01-VISION_AND_OVERVIEW.md), [02 - System Architecture](../02-SYSTEM_ARCHITECTURE.md)

---

## Context

### The Problem

Trakalog serves users who wear multiple hats in the music industry:

- **Independent artists** managing their own catalog
- **Producers** working with multiple artists/clients
- **Managers** overseeing multiple artists' catalogs
- **Labels** managing a roster of artists

A **single-workspace-per-account** model (like most SaaS applications) would force these users to:
- Create separate accounts for each project/artist
- Manage multiple logins and credentials
- Switch between accounts constantly
- Lose the ability to see aggregated analytics across their work

This creates **friction** and makes Trakalog **less useful** for its target audience.

### Industry Context

The music industry operates with clear **identity boundaries**:
- Each artist has their own catalog
- Each label has its own roster
- Each project may have its own branding, team, and workflow

These identities need to be **isolated** from each other (for security, permissions, and organization) while still being **accessible** from a single account.

### Existing Solutions

Other tools in the space typically use one of these approaches:

1. **Single workspace** (SoundCloud, Dropbox) - No support for multiple identities
2. **Teams/Organizations** (Google Workspace, Slack) - Hierarchical but not suited for freelancers
3. **Multiple accounts** (GitHub) - Forces users to switch contexts manually

None of these perfectly fit the music industry's workflow.

---

## Decision

**Adopt a multi-workspace model where each user can own and belong to multiple workspaces, with a workspace switcher for navigation.**

### Core Principles

1. **One account, multiple workspaces** - Users sign up once and can create/join multiple workspaces
2. **Isolated data** - Each workspace has its own catalog, team, settings, and branding
3. **Unified experience** - Users see all their workspaces in one place with a switcher
4. **Personal workspace first** - Every user gets a personal workspace automatically
5. **Flexible permissions** - Users can have different access levels in different workspaces

### Implementation

- **Table structure:** `workspaces` table with `created_by` user
- **Membership:** `workspace_members` many-to-many table linking users to workspaces
- **Data isolation:** All content tables include `workspace_id` foreign key
- **Context:** `WorkspaceContext` in React manages current workspace state
- **Switcher:** `WorkspaceSwitcher` component in the sidebar for navigation

---

## Alternatives Considered

### Option 1: Single Workspace per Account

**Pros:**
- Simpler architecture and permissions
- Easier to understand for new users
- Less database complexity
- Standard SaaS pattern

**Cons:**
- ❌ Forces producers/managers to create multiple accounts
- ❌ No way to aggregate analytics across all work
- ❌ Poor fit for music industry workflow
- ❌ User friction when switching between projects

**Why Not Chosen:** Doesn't serve the primary use case. The music industry's multi-identity nature makes this impractical.

### Option 2: Teams/Organizations Hierarchy

**Pros:**
- Familiar pattern (Slack, Google Workspace)
- Clear ownership hierarchy
- Good for enterprise customers

**Cons:**
- ❌ Doesn't fit freelancers managing multiple independent artists
- ❌ Complex permission inheritance
- ❌ Assumes hierarchical structure that doesn't exist in music
- ❌ Over-engineered for solo creators

**Why Not Chosen:** The music industry doesn't have a natural hierarchy. A label isn't "above" an artist in a way that requires nested permissions.

### Option 3: Project-Based Model (like GitHub)

**Pros:**
- Familiar to developers
- Good for collaborative work

**Cons:**
- ❌ Projects are typically smaller scope than workspaces
- ❌ Doesn't handle branding and identity well
- ❌ Permissions model is repository-focused, not team-focused

**Why Not Chosen:** Music catalogs are more like "organizations" than "repositories" - they have branding, teams, and ongoing workflows.

### Option 4: Custom Multi-Tenancy

**Pros:**
- Maximum flexibility
- Complete data isolation
- Enterprise-grade

**Cons:**
- ❌ Extremely complex to implement
- ❌ Overkill for current needs
- ❌ High maintenance burden
- ❌ Longer development time

**Why Not Chosen:** Supabase's built-in multi-tenancy (via RLS and workspace_id filtering) provides sufficient isolation without the complexity.

---

## Consequences

### Positive

✅ **Better user experience** - Users can manage all their work in one place

✅ **Industry-aligned** - Matches how music professionals actually work

✅ **Flexibility** - Supports solo creators, managers, labels, and everything in between

✅ **Scalability** - Users can grow from one workspace to many as their needs expand

✅ **Data isolation** - Each workspace's data is naturally separated (via workspace_id)

✅ **Branding support** - Each workspace can have its own identity (logo, colors, hero image)

✅ **Team management** - Each workspace can have its own team with independent permissions

### Negative

⚠️ **Complexity** - More complex than single-workspace architecture

- Additional tables (workspace_members, catalog_shares)
- More complex RLS policies
- Workspace context management in React
- Switcher UI/UX considerations

⚠️ **Resource usage** - Each workspace consumes resources (storage, track quotas)

- User-based quotas solve this (quotas follow the user, not the workspace)
- Billing is more complex to calculate

⚠️ **Discovery complexity** - Users need to understand the workspace concept

- Mitigated by good onboarding
- Personal workspace created automatically
- Clear switcher UI

⚠️ **Cross-workspace features** - Some features need to work across workspaces

- Catalog sharing between workspaces
- Aggregated analytics views
- Team member management across workspaces

---

## Implementation Details

### Database Schema

```sql
-- Workspaces table
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_personal boolean NOT NULL DEFAULT false,
  -- Branding fields
  hero_image_url text,
  logo_url text,
  brand_color text,
  -- Social links
  social_instagram text,
  social_tiktok text,
  social_youtube text,
  social_facebook text,
  social_x text
);

-- Workspace members (many-to-many)
CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'viewer' CHECK (access_level IN ('viewer', 'editor', 'admin')),
  professional_title text,
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
```

### React Context

```typescript
// WorkspaceContext.tsx
interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (workspaceId: string) => void;
  loading: boolean;
  error: Error | null;
}

// Manages current workspace state and switching
```

### Workspace Switcher Component

```tsx
// WorkspaceSwitcher.tsx
function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace();
  
  return (
    <Select value={currentWorkspace?.id} onValueChange={switchWorkspace}>
      {workspaces.map(ws => (
        <SelectItem key={ws.id} value={ws.id}>
          {ws.logo_url && <Avatar src={ws.logo_url} />}
          {ws.name}
          {ws.is_personal && <Badge>Personal</Badge>}
        </SelectItem>
      ))}
    </Select>
  );
}
```

### Automatic Personal Workspace

```typescript
// On user signup in AuthContext.tsx
async function handleNewUser(user: User) {
  // Create personal workspace automatically
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      name: `${user.first_name || 'My'} Workspace`,
      created_by: user.id,
      is_personal: true
    })
    .select()
    .single();
  
  // Add user as owner
  await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      access_level: 'admin',
      professional_title: user.professional_title || 'Artist'
    });
}
```

---

## Success Metrics

The multi-workspace model will be considered successful if:

1. **Adoption:** 80%+ of power users (producers, managers, labels) create multiple workspaces
2. **Satisfaction:** High user satisfaction with workspace switching experience
3. **Efficiency:** Users can switch between workspaces in ≤2 clicks
4. **Discoverability:** 90%+ of users understand the workspace concept within first week

---

## Future Considerations

### Cross-Workspace Features

Potential future enhancements:

1. **Aggregated dashboard** - View analytics across all workspaces
2. **Bulk operations** - Perform actions across multiple workspaces
3. **Workspace groups** - Organize workspaces into folders/categories
4. **Shared team members** - Easily add the same person to multiple workspaces

### Scaling

At scale, consider:

1. **Workspace limits** - Maximum number of workspaces per user (currently 15 for Pro/Business)
2. **Performance** - Ensure RLS policies scale with many workspaces
3. **Organization** - Additional tools for managing many workspaces

---

## References

- [TRAKALOG_ARCHITECTURE.md](../../../TRAKALOG_ARCHITECTURE.md) - Original French architecture document
- [PRODUCT_AND_UX_OVERVIEW.md](../PRODUCT_AND_UX_OVERVIEW.md) - Product and UX overview
- [Supabase Row-Level Security](https://supabase.com/docs/guides/auth/row-level-security) - RLS implementation
- [Multi-tenant SaaS patterns](https://martinfowler.com/articles/saas-ubiquity.html) - Industry patterns

---

## Appendix: Migration Notes

### From Single Workspace

If migrating from a single-workspace model:

1. Create `workspaces` and `workspace_members` tables
2. Backfill existing data with workspace_id
3. Create personal workspaces for all existing users
4. Update all RLS policies to filter by workspace_id
5. Implement workspace switcher in UI

### Testing

Key test scenarios:

- User with multiple workspaces can switch between them
- Data is properly isolated between workspaces
- Personal workspace is created on signup
- Workspace branding is applied correctly
- Permissions work correctly per workspace

---

## Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 (documented) / March 26, 2026 (decision) |
| **Version** | 1.0.0 |
| **Status** | Accepted |
| **Implementation Date** | March 2026 |
| **Last Review** | August 11, 2026 |
| **Next Review** | February 11, 2027 |

---

*This ADR documents a foundational architectural decision that shapes Trakalog's entire design. The decision was made early in the product's lifecycle and has proven to be the right choice for the target audience.*