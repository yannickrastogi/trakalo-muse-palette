# ADR-0008: Dual Audience Architecture

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog serves two fundamentally different types of users who interact with the platform in distinct ways. Understanding and designing for these audiences was critical for building the right product and business model.

### Problem Statement

We identified two primary user groups:

1. **Account Holders:** Users who create accounts, upload tracks, manage workspaces, and pay for the service
2. **Link Recipients:** External users who receive shared links and access content without creating accounts

The challenge was how to design the architecture to serve both audiences effectively:

- Account Holders need full CRUD capabilities, workspace management, billing, settings
- Link Recipients need read-only access, minimal friction, no account creation
- Both need to interact with the same underlying content (tracks, playlists)
- Access control must be strict (link recipients can only see what's shared with them)
- The business model must accommodate both (subscriptions for account holders, no cost for link recipients)

### Constraints

- Must support unlimited link recipients without marginal cost
- Must not require link recipients to create accounts
- Must maintain strict access controls between audiences
- Must provide different UI/UX for each audience
- Must support the same audio playback for both
- Must enable tracking of link recipient activity

---

## Decision

**We implemented a Dual Audience Architecture with distinct code paths, authentication models, and user experiences for Account Holders vs Link Recipients, while sharing the same underlying data and infrastructure.**

### Implementation

1. **Authentication Model:**
   - **Account Holders:** Standard email/password or OAuth authentication
   - **Link Recipients:** No authentication required, but email capture for watermarking
   - **Session Model:** JWT for account holders, temporary session for link recipients

2. **Routing:**
   - **Account Routes:** `/app/*`, `/dashboard/*`, `/workspace/*`, etc.
   - **Link Routes:** `/share/*` (public, no auth required)
   - **Public Routes:** `/`, `/about`, `/pricing`, etc.

3. **Code Organization:**
   ```
   src/
   ├── pages/
   │   ├── App.tsx           # Main app shell (account holders)
   │   ├── Dashboard.tsx     # Account holder dashboard
   │   ├── Share/
   │   │   └── [slug].tsx    # Shared link page (link recipients)
   │   └── ...
   ├── components/
   │   ├── account/          # Account holder components
   │   └── shared/           # Link recipient components
   └── contexts/
       ├── AuthContext.tsx   # Account holder auth
       └── LinkContext.tsx   # Link recipient context
   ```

4. **Data Access:**
   - **Account Holders:** Full database access via RLS policies based on user ID
   - **Link Recipients:** Restricted access via RLS policies based on link token and visitor email
   - **Shared Data:** Same tracks table, different access patterns

5. **Feature Availability:**
   | Feature | Account Holders | Link Recipients |
   |---------|-----------------|-----------------|
   | Upload Tracks | ✅ | ❌ |
   | Edit Tracks | ✅ | ❌ |
   | Create Workspaces | ✅ | ❌ |
   | Manage Splits | ✅ | ❌ |
   | View Tracks | ✅ | ✅ (limited) |
   | Play Audio | ✅ | ✅ (watermarked) |
   | Download | ✅ | ✅ (watermarked) |
   | Search | ✅ | ❌ |
   | Create Playlists | ✅ | ❌ |
   | Export | ✅ | ❌ |

6. **Watermarking:**
   - Account Holders: Access original, unwatermarked audio
   - Link Recipients: Always receive watermarked audio with their email embedded

---

## Alternatives Considered

### Option 1: Single Audience with Permissions

**Approach:** Treat link recipients as limited users with read-only permissions

**Pros:**
- **Simpler:** Single code path, single authentication model
- **Consistent:** Same UI patterns for everyone
- **Reuse:** Can reuse most components

**Cons:**
- **Friction:** Requires link recipients to create accounts
- **Cost:** Each link recipient counts as a user (costs scale with audience)
- **Complex Permissions:** Hard to manage fine-grained access for temporary users
- **Poor UX:** Link recipients don't want to create accounts
- **Conversion Barrier:** Reduces virality and sharing

**Why Not Chosen:** Requiring accounts for link recipients would dramatically reduce the platform's usefulness. The music industry shares tracks liberally; requiring account creation would be a non-starter.

### Option 2: Completely Separate Applications

**Approach:** Build two separate applications (web app for account holders, separate site for link recipients)

**Pros:**
- **Clear Separation:** No risk of feature bleed between audiences
- **Optimized:** Each app can be perfectly tailored to its audience
- **Scalable:** Can scale link recipient app independently

**Cons:**
- **Duplication:** Significant code duplication
- **Maintenance:** Must maintain two separate codebases
- **Inconsistency:** Hard to keep UI/UX consistent
- **Complexity:** Data synchronization between apps
- **Cost:** Higher infrastructure costs

**Why Not Chosen:** The duplication and maintenance overhead outweigh the benefits. A single codebase with careful separation provides better maintainability.

### Option 3: Progressive Enhancement

**Approach:** Same application, but progressively enable features based on authentication state

**Pros:**
- **Single Codebase:** Maximum code reuse
- **Flexible:** Easy to add/remove features
- **Gradual:** Users can "upgrade" to full features

**Cons:**
- **Complex Conditions:** Feature flags everywhere, hard to maintain
- **Security Risk:** Easy to accidentally expose account-only features
- **UX Confusion:** Link recipients might see disabled features
- **Performance:** Unused code still loaded for link recipients

**Why Not Chosen:** The security implications are significant. It's too easy to accidentally expose account-only features to link recipients. Clear separation is safer.

### Option 4: Third-Party Link Hosting

**Approach:** Use a third-party service for link sharing (like Dropbox, WeTransfer)

**Pros:**
- **No Build:** No need to build link recipient features
- **Proven:** Use established, tested platforms
- **Cost Effective:** Third-party handles the scale

**Cons:**
- **No Control:** Can't customize the experience
- **No Watermarking:** Can't implement our core leak protection
- **No Analytics:** Can't track link recipient activity
- **Branding:** Third-party branding on shared content
- **Cost:** May be expensive at scale
- **Integration:** Hard to integrate with our data model

**Why Not Chosen:** Our core value proposition is leak protection via watermarking. Using a third-party service would prevent us from implementing this. The link sharing experience is a key differentiator.

---

## Consequences

### Positive

1. **Frictionless Sharing:** Link recipients can access content without creating accounts
2. **Cost Scalability:** Link recipient traffic doesn't increase infrastructure costs proportionally
3. **Clear Value Prop:** Account holders pay for the ability to share, not for each recipient
4. **Watermarking:** Per-visitor watermarking enables leak tracing
5. **Security:** Strict separation reduces risk of data leaks
6. **Analytics:** Can track link recipient behavior for insights
7. **Conversion Path:** Link recipients can be converted to account holders

### Negative

1. **Code Complexity:** Must maintain separate code paths for each audience
2. **Testing Overhead:** Need to test both audience flows
3. **Feature Parity:** Hard to keep both experiences polished
4. **Context Switching:** Developers need to think about both audiences
5. **State Management:** Different authentication models complicate state management

### Mitigations

1. **Shared Components:** Reuse UI components where possible (audio player, track cards)
2. **Clear Separation:** Keep audience-specific code in separate directories
3. **Type Safety:** Use TypeScript to enforce audience-specific types and props
4. **Documentation:** Clearly document which features are available to which audience
5. **Testing Strategy:** Separate test suites for each audience
6. **Code Review:** Enforce audience checks in code reviews

---

## References

- [04 - Component Architecture](../04-COMPONENT_ARCHITECTURE.md) - Frontend component organization
- [06 - Security Architecture](../06-SECURITY_ARCHITECTURE.md) - Authentication and authorization details
- [FEATURES/SHARING_SYSTEM.md](../../FEATURES/SHARING_SYSTEM.md) - Link sharing implementation
- [FEATURES/WATERMARKING.md](../../FEATURES/WATERMARKING.md) - Watermarking for link recipients

---

## Appendix: Implementation Notes

### Route Structure

```
/
├── app/                    # Account holder routes
│   ├── dashboard          # Main dashboard
│   ├── workspace/:id      # Workspace management
│   ├── tracks             # Track management
│   └── settings           # User settings
│
├── share/                 # Link recipient routes
│   └── :slug              # Shared link access
│
├── auth/                  # Authentication routes
│   ├── login
│   ├── register
│   └── reset-password
│
└── (public)              # Public routes
    ├── /                  # Landing page
    ├── pricing
    └── about
```

### Authentication Flow

**Account Holders:**
```
User → Login → JWT created → AuthContext populated → Access protected routes
```

**Link Recipients:**
```
User → Access /share/:slug → Link token validated → LinkContext populated → Access link content
```

### RLS Policies

**Account Holders:**
```sql
-- Workspace members can access their workspace's tracks
CREATE POLICY workspace_members_access_tracks
ON tracks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = tracks.workspace_id
    AND user_id = auth.uid()
  )
)
```

**Link Recipients:**
```sql
-- Link recipients can access tracks shared via their link
CREATE POLICY link_recipients_access_tracks
ON tracks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM shared_links
    WHERE id = current_setting('request.link_id')
    AND (track_id = tracks.id OR playlist_id IN (
      SELECT id FROM playlists WHERE workspace_id = tracks.workspace_id
    ))
    AND status = 'active'
    AND watermarking_enabled = true
  )
)
```

### Shared Components

Components that work for both audiences:
- `AudioPlayer` - Audio playback (watermarked for link recipients)
- `TrackCard` - Track display (limited info for link recipients)
- `TrackTable` - Track listing
- `PlaylistView` - Playlist display
- `Waveform` - Audio waveform visualization

### Audience-Specific Components

**Account Holders Only:**
- `TrackUpload` - Upload new tracks
- `WorkspaceSettings` - Manage workspace
- `SplitsEditor` - Edit track splits
- `UserSettings` - Manage account
- `BillingDashboard` - View/subscribe to plans

**Link Recipients Only:**
- `EmailGate` - Email capture for watermarking
- `LinkHeader` - Shared link information
- `ProtectedAudioPlayer` - Audio player with watermarking
- `LinkExpiryNotice` - Show when link will expire

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

*This ADR is a living document and may be updated as our audience model evolves.*
