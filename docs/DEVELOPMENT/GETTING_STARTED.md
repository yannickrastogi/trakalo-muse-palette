# Getting Started with Trakalog Development

> **Status:** Stable  
> **Version:** 1.0.0  
> **Created:** August 11, 2026  
> **Last Updated:** August 11, 2026  
> **Owner:** Ishan  
> **Related:** [Running the App Locally](../Running%20the%20App%20Locally.md), [TRAKALOG_DEV_STAGING_SETUP.md](../PLANS/TRAKALOG_DEV_STAGING_SETUP.md)

---

## 🚀 Quick Start

Get Trakalog running on your local machine in minutes.

### For Most Developers (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/yannickrastogi/trakalo-muse-palette.git
cd trakalog-muse-palette

# 2. Install dependencies (includes Supabase CLI)
npm install

# 3. Start local Supabase stack
npm run db:start

# 4. In a new terminal, start the app
npm run dev
```

**That's it!** Your app will be available at:
- **App:** `http://localhost:5173`
- **Supabase Studio:** `http://localhost:54323`

### Already Set Up?

If you've done this before, just run:

```bash
npm run db:start    # Terminal 1: Start Supabase
npm run dev        # Terminal 2: Start development server
```

---

## 📋 Prerequisites

### Required Software

| Software | Version | Purpose | Install Guide |
|----------|---------|---------|--------------|
| **Node.js** | 24.16.0+ | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **npm** | 11.13.0+ | Package manager | Included with Node.js |
| **Docker Desktop** | Latest | Supabase container runtime | [docker.com](https://www.docker.com/) |
| **Git** | Latest | Version control | [git-scm.com](https://git-scm.com/) |

### Verify Installation

```bash
# Check Node.js version
node --version
# Expected: v24.16.0 or higher

# Check npm version
npm --version
# Expected: 11.13.0 or higher

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
nvm install 24.16.0
nvm use 24.16.0
```

---

## 🏗️ Detailed Setup Guide

### Step 1: Clone the Repository

```bash
# Clone via HTTPS
git clone https://github.com/yannickrastogi/trakalo-muse-palette.git
cd trakalog-muse-palette

# Or via SSH (if you have SSH keys configured)
git clone git@github.com:yannickrastogi/trakalo-muse-palette.git
cd trakalog-muse-palette
```

### Step 2: Install Dependencies

```bash
# Install all npm dependencies
npm install

# This installs:
# - React, TypeScript, Vite, Tailwind, and all UI dependencies
# - Supabase CLI (as dev dependency)
# - Testing frameworks (Vitest, React Testing Library)
# - All other project dependencies
```

**Expected Output:**
```
added 150 packages in 2m
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
npm run db:start
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

### Step 5: Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# Get your local Supabase credentials
npx supabase status

# Edit .env.local with the actual values
# The file should look like:
```

**Edit `.env.local`:**
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-local-key...

# Optional overrides for development
NEXT_PUBLIC_R2_PUBLIC_URL=http://localhost:54321
```

**Find Your Anon Key:**
```bash
# Method 1: From supabase status
npx supabase status

# Method 2: From Studio
# Open http://localhost:54323 → Settings → API → Project API keys
```

### Step 6: Start the Development Server

```bash
# In a new terminal (keep Supabase running in the first terminal)
npm run dev
```

**Expected Output:**
```
  VITE v5.4.19  ready in 1200ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
  ➜  press h + enter to show help
```

**Open in Browser:**
- App: [http://localhost:5173](http://localhost:5173)
- Supabase Studio: [http://localhost:54323](http://localhost:54323)

---

## 📁 Project Structure Overview

```
trakalog-muse-palette/
├── src/                          # Source code
│   ├── App.tsx                   # Main app entry and routing
│   ├── main.tsx                  # React entry point
│   ├── /components/              # Reusable UI components
│   │   └── /ui/                  # shadcn/ui primitives
│   ├── /pages/                   # Page-level components (routes)
│   ├── /contexts/                # React Context providers
│   ├── /hooks/                   # Custom React hooks
│   ├── /lib/                     # Utility libraries
│   ├── /integrations/            # External service integrations
│   │   └── /supabase/            # Supabase client setup
│   ├── /config/                  # Application configuration
│   ├── /types/                   # TypeScript types
│   └── /i18n/                    # Internationalization files
│
├── supabase/                     # Supabase backend
│   ├── config.toml               # Supabase project configuration
│   ├── /functions/               # Edge Functions
│   ├── /migrations/             # Database migrations
│   └── /snippets/                # SQL snippets
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

### Database Scripts

| Script | Description | Usage |
|--------|-------------|-------|
| `npm run db:start` | Start Supabase CLI services | Local database, API, Auth, Studio |
| `npm run db:stop` | Stop Supabase CLI services | Stops containers, preserves data |
| `npm run db:reset` | Reset local database | ⚠️ **Wipes all data** |
| `npm run db:check` | Check for schema drift | Compare local vs remote |

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
cd trakalog-muse-palette
npm install
npm run db:start
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
npm run db:start    # If not already running
npm run dev        # Start development server

# Make changes, test locally
# Commit frequently with descriptive messages

# End of day
# Supabase continues running for tomorrow
# Or: npm run db:stop to save resources
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

# Run specific test file
npm test src/components/TrackCard.test.tsx
```

### Resetting Your Environment

```bash
# Soft reset (stop services, keep data)
npm run db:stop

# Hard reset (wipe everything, start fresh)
npm run db:stop
npm run db:reset
npm run db:start

# Reinstall dependencies (if package.json changed)
rm -rf node_modules package-lock.json
npm install
```

---

## 🌐 Accessing the Application

### Local Development URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Trakalog App** | `http://localhost:5173` | Main application |
| **Supabase Studio** | `http://localhost:54323` | Database management UI |
| **REST API** | `http://localhost:54321/rest/v1/` | Supabase REST API endpoint |
| **Auth API** | `http://localhost:54321/auth/v1/` | Authentication endpoint |
| **Storage API** | `http://localhost:54321/storage/v1/` | File storage endpoint |

### Creating Your First Account

1. Open [http://localhost:5173](http://localhost:5173)
2. Click "Sign Up" or "Create Account"
3. Use email/password or Google OAuth
4. A personal workspace will be created automatically
5. You're ready to start uploading tracks!

---

## 🔧 Configuration Files

### `.env.local`

Local environment variables (gitignored).

```bash
# Supabase configuration (required for local development)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key

# Optional: R2 configuration for local development
NEXT_PUBLIC_R2_PUBLIC_URL=http://localhost:54321

# Optional: Feature flags override
NEXT_PUBLIC_PITCH_ENABLED=false
NEXT_PUBLIC_APPROVALS_ENABLED=false
```

### `.env.local.example`

Template for `.env.local`. Copy this file to create your local configuration:

```bash
cp .env.local.example .env.local
```

### `src/integrations/supabase/constants.ts`

Production fallback configuration. If no `.env.local` is provided, the app falls back to production URLs and keys.

```typescript
// Production Supabase configuration (fallback)
export const SUPABASE_URL = 'https://xhmeitivkclbeziqavxw.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'production-key';

// Local development takes precedence from .env.local
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY;
```

---

## 🛠️ Development Tools

### Supabase CLI

Installed automatically as a dev dependency. Use `npx supabase` to run commands.

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

**Solution:**
```bash
# Supabase CLI is installed as a dev dependency
npm install

# Then use npx to run it
npx supabase status
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
npm run db:start
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
npm run db:start
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
1. Edit `/src/config/features.ts`
2. Change the flag to `true`
3. The feature will be available immediately (no restart needed)

### Environment-Specific Configuration

Use different configurations for local, staging, and production:

```typescript
// In your code
if (import.meta.env.DEV) {
  // Local development
  console.log('Running in development mode');
} else {
  // Production
  console.log('Running in production mode');
}
```

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

- **[RPCS.md](../RPCS.md)** - Database functions reference
- **[TRAKALOG_BILLING.md](../TRAKALOG_BILLING.md)** - Billing system
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
| **Related Documents** | [Running the App Locally](../Running%20the%20App%20Locally.md), [Dev/Staging Setup](../PLANS/TRAKALOG_DEV_STAGING_SETUP.md) |

---

*This document synthesizes and updates the existing [Running the App Locally](../Running%20the%20App%20Locally.md) guide with additional information for new developers.*