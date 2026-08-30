# ADR-0002: Seat-Based Billing Model

> **Status:** Accepted  
> **Date:** August 11, 2026  
> **Author:** Ishan  
> **Supersedes:** None

---

## Context

Trakalog needed a billing model that aligns with how music industry professionals collaborate. The platform serves teams working on pre-release music catalogs, where multiple individuals (A&R managers, producers, label representatives, artists) need access to shared workspaces.

### Problem Statement
When designing the billing system, we considered several approaches:

1. **Per-workspace billing:** Charge based on the number of workspaces
2. **Per-track billing:** Charge based on the number of tracks stored
3. **Storage-based billing:** Charge based on total storage used
4. **Seat-based billing:** Charge based on the number of users (seats) in the organization

The music industry operates with teams of varying sizes. A solo artist might need just one workspace, while a label could have 50+ team members across multiple workspaces. Per-workspace or per-track models don't account for team size, leading to either overcharging (many users in few workspaces) or undercharging (few users in many workspaces).

### Constraints
- Must accommodate teams of any size (1 to 100+ members)
- Must support multiple workspaces per organization
- Must be predictable and easy to understand for budgeting
- Must scale with team growth
- Must allow for different permission levels within a team

---

## Decision

**We chose a Seat-Based Billing model where organizations pay per user seat, with tiered plans offering different numbers of included seats and workspace limits.**

### Implementation

1. **Seat Definition:** Each unique user email counts as one seat
2. **Workspace Access:** A seat grants access to all workspaces the user is invited to
3. **Tier Structure:**
   - **Starter:** Limited seats, limited workspaces
   - **Professional:** More seats, more workspaces
   - **Business:** Many seats, many workspaces
   - **Enterprise:** Custom seats and workspaces
4. **Overage Handling:** Additional seats billed pro-rated beyond plan limits
5. **Permission Granularity:** Each seat can have different roles (Owner, Admin, Editor, Viewer) within different workspaces

### Billing Mechanics

- **Monthly Billing:** Subscriptions billed monthly
- **Seat Counting:** Active users with access to at least one workspace
- **Plan Upgrades:** Instant upgrade with prorated charges
- **Plan Downgrades:** Applied at next billing cycle
- **Usage Quotas:** Plan limits on tracks, storage, Smart A&R queries, etc.

---

## Alternatives Considered

### Option 1: Per-Workspace Billing

**Pros:**
- Simple to understand and implement
- Aligns with workspace creation
- Easy to isolate costs per project

**Cons:**
- Doesn't scale with team size (many users in one workspace = same cost)
- Encourages workspace sprawl (create more workspaces to avoid seat limits)
- Hard to predict costs for growing teams
- Doesn't reflect actual usage (empty workspace costs same as active one)

**Why Not Chosen:** Doesn't align with how teams actually work. A label with 50 team members working on 10 workspaces would pay the same as a solo artist with 1 workspace and 1 user.

### Option 2: Per-Track Billing

**Pros:**
- Directly tied to value (tracks = assets being managed)
- Scales with usage
- Easy to understand for music industry

**Cons:**
- Doesn't account for team collaboration
- Penalizes power users with large catalogs
- Hard to predict costs (varies with upload activity)
- Doesn't reflect team size or workflow complexity

**Why Not Chosen:** Music catalogs vary greatly in size, and billing per track would make the platform prohibitively expensive for established labels while being cheap for new artists. Doesn't account for the collaborative nature of the platform.

### Option 3: Storage-Based Billing

**Pros:**
- Directly tied to resource consumption
- Common in cloud services
- Scales predictably with usage

**Cons:**
- Hard to predict (depends on audio file sizes, formats)
- Doesn't account for team size or collaboration features
- Audio files vary in size (WAV vs MP3, length, quality)
- Doesn't reflect value of features like Smart A&R, watermarking

**Why Not Chosen:** Storage costs are relatively low compared to the value of the platform's features. This model would undercharge for the collaborative and AI features while overemphasizing raw storage.

### Option 4: Hybrid Billing (Seats + Storage)

**Pros:**
- Captures both team size and usage
- More revenue streams
- Better cost alignment

**Cons:**
- Complex for customers to understand
- Hard to predict total costs
- Two variables to manage and optimize
- Potential for sticker shock with usage spikes

**Why Not Chosen:** Adds complexity without clear benefit. The seat-based model with usage quotas (tracks, storage, AI queries) provides the predictability of seat billing while still controlling resource usage.

---

## Consequences

### Positive

1. **Scalability:** Model scales naturally with team growth
2. **Predictability:** Customers can easily budget (known number of seats)
3. **Team-Friendly:** Accommodates organizations of any size
4. **Flexibility:** Users can be added/removed as needed
5. **Alignment:** Cost aligns with value (more collaborators = more value from platform)
6. **Simplicity:** Easy to understand and explain

### Negative

1. **Inactive Users:** Seats count even for inactive users (must be managed)
2. **Sharing Cost:** Sharing catalogs with external collaborators counts against seats
3. **Workspace Limits:** Need to balance seat counts with workspace limits per plan
4. **Admin Overhead:** Organizations need to manage user access and remove inactive users

### Mitigations

1. **Seat Management Tools:** Provide admin dashboard for managing seats
2. **Inactive User Detection:** Flag users who haven't logged in for X days
3. **Grace Periods:** Allow temporary overage without immediate billing
4. **Usage Analytics:** Help customers optimize seat usage
5. **Plan Flexibility:** Multiple plan tiers to fit different organization sizes

---

## References

- [TRAKALOG_BILLING.md](../../FEATURES/TRAKALOG_BILLING.md) - Complete billing system documentation
- [07 - Deployment Architecture](../07-DEPLOYMENT_ARCHITECTURE.md) - Infrastructure supporting billing
- [Stripe Documentation](https://stripe.com/docs/billing) - Payment processing integration

---

## Appendix: Implementation Notes

### Database Schema

```sql
-- subscriptions table tracks seat usage
ALTER TABLE subscriptions ADD COLUMN seats_used INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN seats_included INTEGER DEFAULT 1;

-- plans table defines seat limits
ALTER TABLE plans ADD COLUMN seats_included INTEGER;
ALTER TABLE plans ADD COLUMN seats_max INTEGER;
```

### Enforcement

Seat counting implemented via:
- Stripe webhook handlers for subscription changes
- Periodic sync jobs to count active users
- RLS policies to enforce workspace access limits

### Migration Path

Initial plans (as of August 2026):
- **Starter:** 3 seats, 2 workspaces
- **Professional:** 10 seats, 10 workspaces  
- **Business:** 50 seats, 50 workspaces
- **Enterprise:** 200+ seats, 200+ workspaces

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

*This ADR is a living document and may be updated as the billing model evolves.*
