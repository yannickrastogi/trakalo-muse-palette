# Getting Started with Trakalog Development

> **Status:** Stable  
> **Version:** 1.1.0  
> **Created:** August 11, 2026  
> **Last Updated:** September 2, 2026  
> **Owner:** Ishan  
> **Related:** [TRAKALOG_DEV_STAGING_SETUP.md](../PLANS/TRAKALOG_DEV_STAGING_SETUP.md)

---

## 🚀 Quick Start

Get Trakalog running on your local machine in minutes.

### For Most Developers (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yannickrastogi/trakalo-muse-palette.git
cd trakalo-muse-palette

# 2. Install dependencies
npm install

# 3. Start the local Supabase stack (fetched on demand -- not a project dependency)
npx supabase start

# 4. In a new terminal, start the app
npm run dev
```

**That's it!** Your app will be available at:
- **App:** `http://localhost:8080`
- **Supabase Studio:** `http://localhost:54323`

### Already Set Up?

If you've done this before, just run:

```bash
npx supabase start   # Terminal 1: Start Supabase
npm run dev          # Terminal 2: Start development server
```

---

## 📋 Prerequisites

### Required Software

| Software | Version | Purpose | Install Guide |
|----------|---------|---------|--------------|
| **Node.js** | 20+ (developed on 24.x) | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **npm** | Bundled with Node | Package manager | Included with Node.js |
| **Docker Desktop** | Latest | Supabase container runtime | [docker.com](https://www.docker.com/) |
| **Git** | Latest | Version control | [git-scm.com](https://git-scm.com/) |

### Verify Installation

```bash
# Check Node.js version
node --version
# Node 20 or newer. Nothing in the repo pins a version -- there is no
# `engines` field in package.json and no .nvmrc -- so this is a convention,
# not something the tooling enforces.

# Check npm version
npm --version

# Check Docker is running
docker --version
docker ps
# Expected: Docker daemon running, no errors
```

### Troubleshooting Prerequisites

#### Docker Not Running

```bash
# macOS
open -a Docker

# Windows
# Open Docker Desktop from Start menu

# Linux
sudo systemctl start docker
```

#### Outdated Node.js

Use [nvm](https://github.com/nvm-sh/nvm) to install the correct version:

```bash
nvm install 24
nvm use 24
```

---

## 🏗️ Detailed Setup Guide

### Step 1: Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/yannickrastogi/trakalo-muse-palette.git
cd trakalo-muse-palette

# Or via SSH (if you have SSH keys configured)
git clone git@github.com:yannickrastogi/trakalo-muse-palette.git
cd trakalo-muse-palette
```

### Step 2: Install Dependencies

```bash
# Install all npm dependencies
npm install

# This installs:
# - React, TypeScript, Vite, Tailwind, and all UI dependencies
# - Testing frameworks (Vitest, React Testing Library)
# - All other project dependencies
#
# Note: the Supabase CLI is NOT a project dependency. Every `npx supabase`
# command below fetches it on demand, or uses a globally installed copy.
```

### Step 3: Initialize Supabase (One-Time Only)

```bash
# Check if already initialized
npx supabase status

# If you see "config file not found" or similar error:
npx supabase init

# If you see "file exists" error, Supabase is already initialized - skip this step
```

**What This Does:**
- Creates `supabase/` directory with configuration
- Sets up local database, API, Auth, and Storage
- Creates `supabase/config.toml` with function configurations

### Step 4: Start Supabase Services

```bash
npx supabase start
```

**This starts:**
- PostgreSQL Database on port `54322`
- REST API on port `54321`
- Auth Service on port `54321`
- Storage Service on port `54321`
- Supabase Studio on port `54323`

**Expected Output:**
```
Starting Supabase services...
Using db password: RandomPassword123
Starting studio...
Starting inbuilt dashboard...
API URL: http://localhost:54321
DB URL: postgres://postgres:RandomPassword123@localhost:54322/postgres
Studio URL: http://localhost:54323
```

### Step 5: Point the App at Your Local Supabase

> ⚠️ **Read this before you assume `.env.local` works.** It does not. The frontend
> reads **no environment variables at all** — there is not a single `import.meta.env`
> anywhere in `src/`. Supabase credentials are two hardcoded string literals in
> [`src/integrations/supabase/constants.ts`](../../src/integrations/supabase/constants.ts),
> and they point at **production**.
>
> A fresh clone therefore talks to the production database. Setting
> `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` in a `.env.local` file has
> no effect whatsoever — nothing reads them.

To work against your local stack, edit `constants.ts` directly:

```bash
# Get your local credentials
npx supabase status
```

```ts
// src/integrations/supabase/constants.ts
export const SUPABASE_URL = "http://localhost:54321";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...local anon key...";
```

**Do not commit that edit.** Before pushing, restore the production values:

```bash
git checkout src/integrations/supabase/constants.ts
```

**Find your local anon key:**
```bash
# Method 1: from supabase status
npx supabase status

# Method 2: from Studio
# Open http://localhost:54323 -> Settings -> API -> Project API keys
```

> **Worth fixing properly.** Reading these two values from `import.meta.env` with the
> current constants as fallback would make local development safe by default and
> remove the risk of committing a pointed-at-localhost build. Until that happens,
> the manual edit above is the only way to develop against a local database.

### Step 6: Start the Development Server

```bash
# In a new terminal (keep Supabase running in the first terminal)
npm run dev
```

**Expected Output:**
```
  VITE v5.4.19  ready in 1200ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: http://192.168.x.x:8080/
  ➜  press h + enter to show help
```

**Open in Browser:**
- App: [http://localhost:8080](http://localhost:8080)
- Supabase Studio: [http://localhost:54323](http://localhost:54323)

---

## 📁 Project Structure Overview

```
trakalo-muse-palette/
├── src/                          # Source code
│   ├── App.tsx                   # Main app entry and routing
│   ├── main.tsx                  # React entry point
│   ├── /components/              # Reusable UI components (flat, ~60 files)
│   │   ├── /ui/                  # shadcn/ui primitives
│   │   ├── /admin/               # Admin console components
│   │   ├── /onboarding/          # Onboarding flow components
│   │   └── /visual/              # Decorative/animated components
│   ├── /pages/                   # Page-level components (routes)
│   ├── /contexts/                # React Context providers
│   ├── /hooks/                   # Custom React hooks
│   ├── /lib/                     # Utility libraries
│   ├── /integrations/            # External service integrations
│   │   └── /supabase/            # Supabase client setup
│   ├── /config/                  # Application configuration (features.ts)
│   ├── /types/                   # TypeScript types (lamejs.d.ts, workspace.ts)
│   ├── /test/                    # Vitest setup and tests
│   └── /i18n/                    # index.ts + /locales/*.json (8 languages)
│
├── supabase/                     # Supabase backend
│   ├── config.toml               # Supabase project configuration
│   ├── /functions/               # Edge Functions
│   ├── /migrations/             # Database migrations
│   └── /snippets/                # SQL snippets (currently empty)
│
├── docs/                         # Documentation
│   └── ARCHITECTURE/             # Architecture documentation
│
├── services/                     # External services
│   └── watermark/                # Audio watermarking service
│
├── sonic-dna-service/            # Audio analysis service
│
├── package.json                  # Project dependencies and scripts
├── vite.config.ts               # Vite configuration
├── tsconfig.json                # TypeScript configuration
└── tailwind.config.ts           # Tailwind CSS configuration
```

---

## 🔧 Available npm Scripts

### Development Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run dev` | Start Vite development server | Development with HMR |
| `npm run build` | Build for production | Minified, optimized bundle |
| `npm run build:dev` | Build in development mode | Non-minified for debugging |
| `npm run preview` | Preview production build | Test built output locally |

### Database Commands

`db:check` is the only database-related **npm script**. Everything else goes through the
Supabase CLI directly via `npx` — the CLI is not a project dependency.

| Command | Description | Usage |
|--------|-------------|-------|
| `npx supabase start` | Start Supabase services | Local database, API, Auth, Studio |
| `npx supabase stop` | Stop Supabase services | Stops containers, preserves data |
| `npx supabase db reset` | Reset local database | ⚠️ **Wipes all local data** |
| `npm run db:check` | Check for schema drift | Compares prod migrations against `supabase/migrations/` |

### Testing Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run lint` | Run ESLint | Check code style |
| `npm test` | Run all tests once | Vitest test runner |
| `npm run test:watch` | Run tests in watch mode | Auto-reload on changes |

---

## 🎯 Development Workflows

### First-Time Developer

```bash
# Day 1: Initial setup
git clone https://github.com/yannickrastogi/trakalo-muse-palette.git
cd trakalo-muse-palette
npm install
npx supabase start
npm run dev

# Explore the codebase
# 1. Read ARCHITECTURE docs first
# 2. Check src/App.tsx for routing and provider hierarchy
# 3. Look at src/pages/ for main page components
# 4. Review src/contexts/ for state management
```

### Daily Development

```bash
# Start your day
npx supabase start    # If not already running
npm run dev        # Start development server

# Make changes, test locally
# Commit frequently with descriptive messages

# End of day
# Supabase continues running for tomorrow
# Or: npx supabase stop to save resources
```

### Working with Database

```bash
# Access PostgreSQL directly
npx supabase db psql

# Run SQL queries
SELECT * FROM tracks WHERE workspace_id = '...' LIMIT 10;

# Exit psql
\q
```

### Testing Changes

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npx eslint . --fix

# Run tests
npm test

# Run a specific test file
npm test src/test/example.test.ts
```

### Resetting Your Environment

```bash
# Soft reset (stop services, keep data)
npx supabase stop

# Hard reset (wipe everything, start fresh)
npx supabase stop
npx supabase db reset
npx supabase start

# Reinstall dependencies (if package.json changed)
rm -rf node_modules package-lock.json
npm install
```

---

## 🌐 Accessing the Application

### Local Development URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Trakalog App** | `http://localhost:8080` | Main application |
| **Supabase Studio** | `http://localhost:54323` | Database management UI |
| **REST API** | `http://localhost:54321/rest/v1/` | Supabase REST API endpoint |
| **Auth API** | `http://localhost:54321/auth/v1/` | Authentication endpoint |
| **Storage API** | `http://localhost:54321/storage/v1/` | File storage endpoint |

### Creating Your First Account

1. Open [http://localhost:8080](http://localhost:8080)
2. Click "Sign Up" or "Create Account"
3. Use email/password or Google OAuth
4. A personal workspace will be created automatically
5. You're ready to start uploading tracks!

---

## 🔧 Configuration Files

### `src/integrations/supabase/constants.ts` — the only Supabase config

This file **is** the configuration. It is not a fallback; it is the single source, and it
holds two plain string literals:

```typescript
export const SUPABASE_URL = "https://xhmeitivkclbeziqavxw.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

`src/integrations/supabase/client.ts` imports them directly. To develop against a local
stack, edit this file (see [Step 5](#step-5-point-the-app-at-your-local-supabase)) and
revert before committing.

### `.env.local` — not used by the frontend

There is **no `.env.local.example`** in the repo, and no `.env.local` you create will be
read: `src/` contains zero occurrences of `import.meta.env`. Variables such as
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, or anything prefixed `NEXT_PUBLIC_`
(a Next.js convention that Vite would ignore anyway) have no effect on this app.

Feature flags are likewise **compile-time constants**, not env vars — see
`src/config/features.ts`, which exports exactly three: `PITCH_ENABLED`,
`APPROVALS_ENABLED`, `PITCHER_ROLE_ENABLED`.

---

## 🛠️ Development Tools

### Supabase CLI

Not a project dependency. `npx supabase <cmd>` fetches the CLI on demand the first time you run it (or uses a globally installed copy if you have one).

```bash
# Check status of local services
npx supabase status

# View logs
npx supabase logs

# Run SQL directly
npx supabase db psql

# Reset database (wipes all data)
npx supabase db reset

# Apply migrations
npx supabase db push
```

### Supabase Studio

Web-based database management at `http://localhost:54323`.

**Features:**
- Browse and edit database tables
- Run SQL queries
- Manage authentication
- Configure storage
- View and test Edge Functions
- Monitor realtime subscriptions

### Vite Development Server

Fast, modern development server with:
- Hot Module Replacement (HMR)
- Fast refresh
- Optimized builds
- TypeScript support out of the box

---

## 🐛 Common Issues & Solutions

### Supabase CLI Not Found

**Error:** `command not found: supabase`

**Solution:** the CLI is not a project dependency, so there is no bare `supabase` binary
unless you installed one globally. Always invoke it through `npx`:

```bash
npx supabase status
```

Install it globally instead if you prefer a bare `supabase` command:
```bash
brew install supabase/tap/supabase
```

### Port Already in Use

**Error:** `Port 54321 is already in use`

**Solution:**
```bash
# Stop existing Supabase services
npx supabase stop

# Check for processes using the port (macOS)
lsof -i :54321

# Kill the process (replace PID with actual process ID)
kill <PID>

# Restart Supabase
npx supabase start
```

### Can't Connect to Supabase

**Error:** `Failed to fetch` or `Network error`

**Checklist:**

1. **Is Supabase running?**
   ```bash
   npx supabase status
   ```
   Should show all services as `RUNNING`

2. **Are environment variables correct?**
   ```bash
   cat .env.local
   ```
   Should have `VITE_SUPABASE_URL=http://localhost:54321`

3. **Is the anon key correct?**
   ```bash
   npx supabase status
   ```
   Copy the `anon` key and update `.env.local`

4. **Check browser console** for CORS errors or connection issues

### Docker Not Running

**Error:** `Cannot connect to the Docker daemon`

**Solution:**
```bash
# macOS
open -a Docker

# Windows
# Open Docker Desktop from Start menu

# Linux
sudo systemctl start docker

# Verify Docker is running
docker ps
```

### Supabase CLI Hangs on Start

**Error:** CLI starts but never completes

**Solution:**
```bash
# Stop any existing services
npx supabase stop

# Remove Supabase directory and re-initialize
rm -rf supabase
npx supabase init

# Start fresh
npx supabase start
```

### Studio Login Issues

**Issue:** Can't log in to Supabase Studio at `http://localhost:54323`

**Solution:**
- Local Studio may not require login
- Try accessing directly without logging in
- If login is required, use the credentials from `npx supabase status`

### Database Connection String Issues

**Important:** The browser-based Supabase client (`@supabase/supabase-js@2.x`) **only accepts HTTP/HTTPS URLs**, not PostgreSQL connection strings.

**❌ Wrong:**
```bash
VITE_SUPABASE_URL=postgresql://postgres:password@localhost:54322/postgres
```

**✅ Correct:**
```bash
VITE_SUPABASE_URL=http://localhost:54321
```

---

## 📊 Working with Features

### Feature Flags

Trakalog uses feature flags to control feature availability. Flags are defined in `/src/config/features.ts`:

```typescript
export const FEATURES = {
  PITCH_ENABLED: false,        // Pitch module disabled
  APPROVALS_ENABLED: false,    // Approvals module disabled
  SMART_AR_ENABLED: true,       // AI matching enabled
  WATERMARKING_ENABLED: true,  // Audio watermarking enabled
};
```

**To enable a feature:**
1. Edit `src/config/features.ts`
2. Change the flag to `true`
3. Vite's HMR picks the change up on save

These are **compile-time constants**, not runtime configuration — the value is baked into
the bundle at build time. There is no mechanism for toggling a flag in a deployed build;
changing one requires a rebuild and redeploy.

### Environment-Specific Configuration

There isn't any. The app reads no environment variables (`src/` contains no
`import.meta.env`), so local and production builds differ only in whatever you have edited
in `src/integrations/supabase/constants.ts` at build time.

---

## 🚀 Deploying Changes

### Local Testing Before Deployment

1. **Run all tests:**
   ```bash
   npm test
   ```

2. **Check for linting issues:**
   ```bash
   npm run lint
   ```

3. **Test manually:**
   - Upload a track
   - Create a shared link
   - Test the recipient experience
   - Try all major workflows

### Production Deployment

Trakalog uses **Vercel** for hosting with automatic deployment:

1. **Push to `main` branch:**
   ```bash
   git add .
git commit -m "feat: add new feature"
git push origin main
   ```

2. **Vercel automatically deploys** changes to production

3. **Monitor deployment:**
   - Check Vercel dashboard for build status
   - Review logs for any errors

---

## 📚 Learning Resources

### Essential Reading (Start Here)

1. **[01 - Vision & Overview](../ARCHITECTURE/01-VISION_AND_OVERVIEW.md)** - Understand what Trakalog is
2. **[02 - System Architecture](../ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md)** - Technical overview
3. **[03 - Data Architecture](../ARCHITECTURE/03-DATA_ARCHITECTURE.md)** - Database schema

### Technology Deep-Dives

- **[React Documentation](https://react.dev/)** - React fundamentals
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)** - TypeScript best practices
- **[Supabase Documentation](https://supabase.com/docs)** - Database and backend
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Utility-first styling
- **[Vite Documentation](https://vitejs.dev/guide/)** - Build tool

### Trakalog-Specific

- **[RPCS.md](RPCS.md)** - Database functions reference
- **[TRAKALOG_BILLING.md](../FEATURES/TRAKALOG_BILLING.md)** - Billing system
- **[PRODUCT_AND_UX_OVERVIEW.md](../ARCHITECTURE/PRODUCT_AND_UX_OVERVIEW.md)** - Product details
- **[GROQ_USAGE_AND_COSTS.md](../ARCHITECTURE/GROQ_USAGE_AND_COSTS.md)** - AI usage

---

## 🎓 Next Steps for New Developers

### Week 1: Orientation

1. ✅ **Set up your environment** (this guide)
2. **Read the architecture documentation**
   - [Vision & Overview](../ARCHITECTURE/01-VISION_AND_OVERVIEW.md)
   - [System Architecture](../ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md)
3. **Explore the codebase**
   - Trace a user action from UI to database
   - Understand the provider hierarchy in App.tsx
   - Follow a track from upload to display
4. **Make a small change**
   - Fix a typo in the UI
   - Add a console.log to trace data flow
   - Submit a PR with your change

### Week 2: Contribution

1. **Pick an issue** from the backlog
2. **Understand the code** around that issue
3. **Implement the fix/feature**
4. **Write tests** for your changes
5. **Submit a PR** with:
   - Clear description
   - Screenshots (if UI change)
   - Reference to issue
   - Documentation updates (if needed)

---

## 📞 Support & Help

### Getting Help

1. **Check this documentation** first
2. **Search the codebase** for similar patterns
3. **Ask in team channels** (Slack/Teams/Discord)
4. **Review existing PRs** for implementation examples

### Contributing to Documentation

Found an error or missing information?

1. **For typos:** Submit a PR with the fix
2. **For missing info:** Add it and reference the source
3. **For outdated info:** Update with `[!NOTE]` or `[!WARNING]`

---

## 🏷️ Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 11, 2026 |
| **Version** | 1.0.0 |
| **Owner** | Ishan |
| **Status** | Stable |
| **Next Review** | September 11, 2026 |
| **Related Documents** | [Dev/Staging Setup](../PLANS/TRAKALOG_DEV_STAGING_SETUP.md) |

---

*This document supersedes the older "Running the App Locally" guide, which has been removed.*