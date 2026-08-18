# Trakalog Architecture Documentation Plan

**Created:** August 11, 2026  
**Status:** PLANNING PHASE  
**Request:** Complete architecture documentation for Trakalog application  
**Branch:** ishan/translated-docs (active translation work in progress)

---

## Executive Summary

Trakalog is a pre-release music catalog management platform that protects, analyzes, connects, and activates unreleased music. The application features a sophisticated multi-workspace architecture, invisible audio watermarking, AI-powered A&R matching, and a unique dual-audience model (account holders vs. link recipients).

**Current State:** Partial documentation exists with some French documents, recent English translations, and focused technical deep-dives (GROQ usage, billing). A comprehensive, unified architecture documentation set is missing.

**Goal:** Create a complete, maintainable architecture documentation set that serves as the single source of truth for developers, onboarding, and system design decisions.

---

## 1. Documentation Strategy

### 1.1 Guiding Principles

1. **Single Source of Truth** - Each concept documented in exactly one place
2. **Hierarchical Navigation** - From high-level vision to implementation details
3. **Developer-First** - Written for engineers making technical decisions
4. **Living Documents** - Versioned, dated, with clear ownership
5. **Diagrams as Code** - Use Mermaid diagrams for architecture visuals
6. **Cross-Reference** - Heavy linking between related documents
7. **Status Indicators** - Clear labeling of what's current, deprecated, or planned

### 1.2 Audience Matrix

| Document Type | New Developer | Existing Engineer | Architect | DevOps | Product Manager |
|---------------|---------------|-------------------|-----------|--------|------------------|
| Architecture Overview | Essential | Reference | Own | | Essential |
| Detailed Component Docs | As needed | Essential | Essential | | |
| Operational Docs | Familiar | Reference | | Essential | |
| Decision Records | Context | Essential | Essential | Context | |

### 1.3 Language Strategy

**Primary:** English (all new docs)  
**Secondary:** French translations maintained where existing docs exist  
**Decision:** New comprehensive docs written in English first, with French translations as follow-up work.

---

## 2. Documentation Structure

### 2.1 Directory Hierarchy

```
docs/
├── ARCHITECTURE/                    # Core architecture documentation
│   ├── INDEX.md                    # Architecture documentation landing page
│   ├── 01-VISION_AND_OVERVIEW.md    # High-level product vision & architecture
│   ├── 02-SYSTEM_ARCHITECTURE.md    # Technical architecture layers
│   ├── 03-DATA_ARCHITECTURE.md      # Database schema, relationships, data flow
│   ├── 04-COMPONENT_ARCHITECTURE.md  # React component hierarchy & state management
│   ├── 05-SERVICE_ARCHITECTURE.md   # External services & integrations
│   ├── 06-SECURITY_ARCHITECTURE.md  # RLS, authentication, data protection
│   ├── 07-DEPLOYMENT_ARCHITECTURE.md # Infrastructure & deployment topology
│   └── DECISIONS/                  # Architecture Decision Records (ADRs)
│       ├── ADR-0001-multi-workspace-model.md
│       ├── ADR-0002-seat-based-billing.md
│       └── INDEX.md
│
├── DEVELOPMENT/                    # Development guides
│   ├── GETTING_STARTED.md          # Local development setup
│   ├── CODING_STANDARDS.md         # Style guides, best practices
│   ├── TESTING_STRATEGY.md         # Testing approach & frameworks
│   └── API_REFERENCE.md             # API endpoints & contracts
│
├── OPERATIONS/                     # Operational documentation
│   ├── MONITORING.md                # Logging, metrics, alerting
│   ├── PERFORMANCE.md               # Performance optimization
│   └── COST_OPTIMIZATION.md         # Cloud costs, usage tracking
│
└── FEATURES/                        # Feature-specific documentation
    ├── TRACK_MANAGEMENT.md          # Upload, metadata, versioning
    ├── SHARING_SYSTEM.md            # Shared links, catalog sharing
    ├── SMART_AR.md                  # AI matching architecture
    └── WATERMARKING.md              # Audio watermarking & leak tracing
```

---

## 3. Priority Matrix

### 3.1 Phase 1: Foundation (Week 1-2) - BLOCKING

**Goal:** Establish core architecture documentation that answers "how does this work?"

| # | Document | Description | Effort | Status |
|---|----------|-------------|--------|--------|
| 1 | ARCHITECTURE/INDEX.md | Architecture docs landing page | 2h | Pending |
| 2 | ARCHITECTURE/01-VISION_AND_OVERVIEW.md | Unified vision (merge existing) | 4h | Pending |
| 3 | ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md | Technical architecture layers | 8h | Pending |
| 4 | ARCHITECTURE/03-DATA_ARCHITECTURE.md | Database schema & relationships | 6h | Pending |
| 5 | DEVELOPMENT/GETTING_STARTED.md | Consolidated setup guide | 2h | Pending |

**Phase 1 Deliverable:** Basic architecture understanding for any new developer

### 3.2 Phase 2: Depth (Week 3-4) - HIGH PRIORITY

**Goal:** Deep-dive into each major system component

| # | Document | Description | Effort | Status |
|---|----------|-------------|--------|--------|
| 6 | ARCHITECTURE/04-COMPONENT_ARCHITECTURE.md | React component tree & state | 6h | Pending |
| 7 | ARCHITECTURE/05-SERVICE_ARCHITECTURE.md | External service integrations | 4h | Pending |
| 8 | ARCHITECTURE/06-SECURITY_ARCHITECTURE.md | RLS, auth flows, data isolation | 4h | Pending |
| 9 | ARCHITECTURE/07-DEPLOYMENT_ARCHITECTURE.md | Infrastructure & deployment | 3h | Pending |
| 10 | FEATURES/TRACK_MANAGEMENT.md | Upload pipeline & audio processing | 4h | Pending |
| 11 | FEATURES/SHARING_SYSTEM.md | Shared links & catalog sharing | 3h | Pending |

**Phase 2 Deliverable:** Complete technical reference for all major systems

### 3.3 Phase 3: Operations (Week 5) - MEDIUM PRIORITY

**Goal:** Operational excellence and maintenance documentation

| # | Document | Description | Effort | Status |
|---|----------|-------------|--------|--------|
| 12 | DEVELOPMENT/CODING_STANDARDS.md | TypeScript, React, Tailwind conventions | 3h | Pending |
| 13 | DEVELOPMENT/TESTING_STRATEGY.md | Vitest, React Testing Library patterns | 3h | Pending |
| 14 | OPERATIONS/MONITORING.md | Logging setup, error tracking, metrics | 3h | Pending |
| 15 | OPERATIONS/COST_OPTIMIZATION.md | Cloud cost analysis & optimization | 4h | Pending |

### 3.4 Phase 4: Polish (Week 6+) - NICE TO HAVE

**Goal:** Advanced documentation and continuous improvement

| # | Document | Description | Effort | Status |
|---|----------|-------------|--------|--------|
| 16 | FEATURES/SMART_AR.md | AI architecture, Groq integration | 4h | Pending |
| 17 | FEATURES/WATERMARKING.md | Audiowmark service, tracing system | 3h | Pending |
| 18 | FEATURES/SPLITS_AND_SIGNATURES.md | Split calculation, signature flow | 3h | Pending |
| 19 | ARCHITECTURE/DECISIONS/ADR-*.md | Major architectural decisions | 4h | Pending |

---

## 4. Document Specifications

### 4.1 Template: Architecture Documents

Each architecture document includes:
- Frontmatter with status, version, date, owner
- Abstract/summary
- Clear section hierarchy
- Mermaid diagrams for architecture
- Cross-references to related docs
- Appendix with FAQs/troubleshooting

### 4.2 Template: ADR (Architecture Decision Record)

Standard ADR format with:
- Status (Proposed/Approved/Deprecated/Superceded)
- Context and problem statement
- Decision and alternatives considered
- Consequences (positive and negative)
- References

---

## 5. Content Outline by Document

### 5.1 ARCHITECTURE/01-VISION_AND_OVERVIEW.md
- Executive Summary (pitch, differentiators, users)
- Product Vision (problem space, value prop, long-term vision)
- Dual Audience Model (account holders vs link recipients)
- Core Features Overview (track mgmt, sharing, AI, protection)
- Architecture Principles (design philosophies, constraints)

### 5.2 ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md
- System Components Overview (frontend, backend, service, storage layers)
- Technology Stack (React, Supabase, Railway, R2, Groq, Resend, Stripe, Vercel, Cloudflare)
- Data Flow Architecture (user request, audio processing, AI processing flows)
- Communication Patterns (frontend-backend, service-to-service, event-driven)
- High-Level Diagrams (system context, component interaction)

### 5.3 ARCHITECTURE/03-DATA_ARCHITECTURE.md
- Database Schema Overview (Supabase project, table organization)
- Entity Relationships (all major entity relationships)
- Core Tables Deep Dive (workspaces, tracks, users, members, shared_links, catalog_shares, splits, signatures, watermark_payloads)
- Row-Level Security (policy overview, key policies by table)
- Storage Buckets (tracks, covers, stems, documents)

### 5.4 ARCHITECTURE/04-COMPONENT_ARCHITECTURE.md
- Application Shell (App.tsx, provider hierarchy, routing)
- Component Hierarchy (page-level, feature, UI primitives)
- State Management (contexts, React Query, local vs global)
- Key Contexts (Auth, Workspace, Role, Track, AudioPlayer, etc.)
- Routing Structure (public, auth, protected, admin routes)

### 5.5 FEATURE DOCUMENTS
Each feature document includes:
- Feature Overview (purpose, user journey, key components)
- Architecture (component diagram, data flow, state management)
- Implementation Details (key files, algorithms, edge cases)
- Integration Points (with other features, external services)
- Configuration (feature flags, env vars, permissions)
- Troubleshooting (common issues, debugging tips)

---

## 6. Implementation Plan

### Week 1: Foundation & Research
- **Mon-Tue:** Study existing docs, map source code, identify patterns
- **Wed-Thu:** Write INDEX.md, 01-VISION, 02-SYSTEM_ARCHITECTURE
- **Fri:** Review Phase 1 docs, create diagrams, setup tooling

### Week 2: Core Architecture
- **Mon-Tue:** Complete 03-DATA_ARCHITECTURE, 04-COMPONENT_ARCHITECTURE
- **Wed-Thu:** Write 05-SERVICE_ARCHITECTURE, feature docs
- **Fri:** Review Phase 1 & 2, begin ADRs

### Week 3: Deep Dives & Operations
- **Mon-Wed:** Complete remaining feature docs, write security/deployment
- **Thu-Fri:** Operations docs, ADR documentation

### Week 4: Polish & Review
- **Mon-Wed:** Complete Phase 3 & 4 documents
- **Thu-Fri:** Full review, add cross-references, finalize

### Ongoing: Maintenance
- Monthly documentation review meetings
- Update docs with major architectural changes
- Maintain ADR log for significant decisions

---

## 7. Quality Assurance

### 7.1 Review Process
1. Self-Review (author checks completeness, accuracy, clarity)
2. Peer Review (technical accuracy)
3. Architecture Review (design decisions and patterns)
4. Final Sign-off (documentation owner)

### 7.2 Validation Checklist
- [ ] All code references accurate
- [ ] All diagrams render correctly
- [ ] All cross-references use correct paths
- [ ] No sensitive information exposed
- [ ] Documentation matches current codebase
- [ ] Version and date metadata complete
- [ ] Links work, terminology consistent

### 7.3 Tools & Automation
- Markdown linting
- Link checking script
- Code reference validation
- Mermaid diagram syntax checking

---

## 8. Success Criteria

### Phase 1 (Week 2)
- [ ] New developer understands system architecture within 2 hours
- [ ] Major system components documented at high level
- [ ] Documentation infrastructure established

### Phase 2 (Week 4)
- [ ] Any feature can be understood by reading its documentation
- [ ] All external integrations documented
- [ ] Security architecture clearly explained
- [ ] 80% of common developer questions answerable by docs

### Overall Success
- [ ] Documentation is single source of truth for architecture
- [ ] New features include documentation as part of DoD
- [ ] Documentation review part of PR process
- [ ] Team values documentation as asset, not overhead

---

## 9. Open Questions

1. **API Documentation:** OpenAPI/Swagger format or keep conceptual?
   - *Recommendation:* Start conceptual, add OpenAPI later

2. **Component Depth:** Document every component or just major ones?
   - *Recommendation:* Major components and patterns only

3. **Translations:** Maintain French translations of all new docs?
   - *Recommendation:* English first, French as separate effort

4. **Hosting:** Where to host documentation?
   - *Recommendation:* In repo (/docs/) with GitHub Pages

---

## 10. Existing Documentation Inventory

### Current Architecture Docs
- `/TRAKALOG_ARCHITECTURE.md` - French high-level architecture (233 lines)
- `/docs/ARCHITECTURE/PRODUCT_AND_UX_OVERVIEW.md` - English product overview (313 lines)
- `/docs/ARCHITECTURE/GROQ_USAGE_AND_COSTS.md` - Groq usage deep-dive (280 lines)

### Feature Documentation (15+ docs)
- Billing, RPCs, Auth Patterns, RLS Guides (3 phases), ISRC, DDEX, Versioning
- Onboarding, Brief Seeker, Artist Seeker, Signal, Drop, Storage Migration

### Operational Docs
- Running App Locally, Dev/Staging Setup, Frontend Fetching Audit

### Notes
- Many French documents need translation
- Some may be outdated or superseded
- Need to audit existing docs for accuracy

---

## 11. Key ADRs to Document

1. ADR-0001: Multi-workspace model
2. ADR-0002: Seat-based billing
3. ADR-0003: Supabase over Firebase/custom backend
4. ADR-0004: React Query over Redux
5. ADR-0005: R2 over S3
6. ADR-0006: Groq for AI
7. ADR-0007: Invisible watermarking approach
8. ADR-0008: Dual audience architecture
9. ADR-0009: Feature flags approach
10. ADR-0010: shadcn/ui component library

---

## 12. Tools & Infrastructure Needed

- [ ] Full codebase access (Available)
- [ ] Supabase project access (for schema verification)
- [ ] Railway project access (for service understanding)
- [ ] Vercel project access (for deployment understanding)
- [ ] Documentation tooling (scripts for validation)

---

*Document created: August 11, 2026*  
*Plan status: Ready for review and execution*

#### 1.1 Delete Docker-specific files
- DELETE: `docker-compose.yml`
- DELETE: `scripts/start-supabase.sh`
- DELETE: `scripts/stop-supabase.sh` 
- DELETE: `scripts/wait-for-supabase.sh`
- DELETE: `supabase/init/001-init.sql`

#### 1.2 Clean up package.json
- Remove `concurrently` from devDependencies
- Revert scripts section:
  - `dev`: `vite` (original)
  - Remove `dev:supabase`, `dev:app`
  - Remove `db:start`, `db:stop`, `db:reset`

### Phase 2: Update Supabase Client

#### 2.1 Simplify client.ts
- Revert to original `createClient(url, key, options)` call
- Remove the PostgreSQL connection string detection logic
- Remove conditional logic for connection types

### Phase 3: Add Supabase CLI Support

#### 3.1 Create new scripts
- CREATE: `scripts/start-supabase-cli.sh` - Wrapper for `supabase start`
- CREATE: `scripts/stop-supabase-cli.sh` - Wrapper for `supabase stop`

#### 3.2 Update package.json with CLI scripts
```json
"scripts": {
  "dev": "vite",
  "db:start": "bash scripts/start-supabase-cli.sh",
  "db:stop": "bash scripts/stop-supabase-cli.sh",
  "db:reset": "supabase db reset"
}
```

#### 3.3 Update .env.local.example
```
# Local Supabase CLI Development
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key-here
```

### Phase 4: Update Documentation

#### 4.1 Rewrite docs/Running the App Locally.md
- Remove all Docker-specific instructions
- Add Supabase CLI installation and setup
- Document `supabase start` workflow
- Update environment variables
- Update verification commands
- Update troubleshooting section

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `docker-compose.yml` | DELETE | Remove Docker config |
| `scripts/start-supabase.sh` | DELETE | Remove Docker start script |
| `scripts/stop-supabase.sh` | DELETE | Remove Docker stop script |
| `scripts/wait-for-supabase.sh` | DELETE | Remove Docker wait script |
| `supabase/init/001-init.sql` | DELETE | Remove init SQL |
| `src/integrations/supabase/constants.ts` | KEEP | Env var support is useful |
| `src/integrations/supabase/client.ts` | MODIFY | Revert to HTTP/HTTPS only |
| `package.json` | MODIFY | Remove concurrently, revert scripts |
| `.env.local.example` | MODIFY | Update for Supabase CLI |
| `scripts/start-supabase-cli.sh` | CREATE | Supabase CLI start wrapper |
| `scripts/stop-supabase-cli.sh` | CREATE | Supabase CLI stop wrapper |
| `docs/Running the App Locally.md` | MODIFY | Rewrite for Supabase CLI |

## Risk Mitigation

- All Docker changes are removed cleanly
- Environment variable fallback to production remains intact
- No changes to production code paths
- Supabase CLI is officially maintained by Supabase
- Existing scripts (`check-schema-drift.sh`, etc.) remain unchanged

## Dependencies

**New dependencies:** None (Supabase CLI is installed globally via npm)

**Removed dependencies:**
- `concurrently` (no longer needed)

## Execution Workflow

### First-time setup:
```bash
# Install Supabase CLI globally
npm install -g supabase

# Initialize Supabase in project (if not already done)
supabase init

# Start local Supabase stack
npm run db:start

# In a new terminal, start the app
npm run dev
```

### Or simply:
```bash
npm install
npm run db:start
npm run dev
```

### Cleanup:
```bash
npm run db:stop          # Stops Supabase services
supabase db reset       # Resets database (optional)
```

## Notes

- Supabase CLI automatically manages all services (PostgreSQL, API, Auth, Studio)
- Local Supabase runs on port 54321 (API), 54322 (DB), 54323 (Studio)
- The anon key is generated automatically by `supabase start`
- Studio is available at http://localhost:54323

## Next Steps

Awaiting user approval to proceed with implementation.
