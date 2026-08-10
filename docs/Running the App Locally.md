# Running the App Locally

This guide explains how to set up and run Trakalog-App locally using the official Supabase CLI, which provides a complete local development stack including REST API, Auth, Storage, and Studio.

---

## Prerequisites

- Node.js v24.16.0+
- npm v11.13.0+
- Docker Desktop running (Supabase CLI uses Docker internally)

---

## Quick Start

### First-time setup:

```bash
# Install app dependencies (includes Supabase CLI as dev dependency)
npm install

# Initialize Supabase in your project (one-time)
# If you get "file exists" error, the config is already initialized - skip this step
npx supabase init

# Start local Supabase stack
npm run db:start

# In a new terminal, start the app
npm run dev
```

Your app will be available at `http://localhost:5173` and Supabase Studio at `http://localhost:54323`.

### Everyday development:

```bash
# Start Supabase services
npm run db:start

# In a new terminal, start the app
npm run dev
```

---

## Manual Setup

If you prefer more control, you can start the components separately.

### 1. Install Supabase CLI

The Supabase CLI is installed as a local dev dependency, so no global installation is needed:

```bash
npm install
```

This installs Supabase CLI locally. Verify installation:
```bash
npx supabase --version
```

### 2. Initialize Supabase Project

If you haven't already initialized Supabase in your project:

```bash
npx supabase init
```

This creates a `supabase` directory with configuration files. **If you get a "file exists" error, the project is already initialized - skip this step.**

### 3. Start Supabase Services

```bash
npm run db:start
```

Or directly:
```bash
npx supabase start
```

This starts the following services:
- **PostgreSQL Database** on port `54322`
- **REST API** on port `54321`
- **Auth Service** on port `54321`
- **Storage Service** on port `54321`
- **Supabase Studio** on port `54323`

### 4. Configure Environment Variables

Get your local Supabase credentials:

```bash
npx supabase status
```

This will display your local configuration including the anon key. Copy the anon key and update your `.env.local` file:

```bash
cp .env.local.example .env.local
# Edit .env.local with your actual anon key
```

Your `.env.local` should look like:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-local-key...
```

### 5. Start the App

In a new terminal:

```bash
npm run dev
```

The Vite dev server will start on `http://localhost:5173`.

---

## Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Starts the Vite development server |
| `npm run db:start` | Starts Supabase CLI services |
| `npm run db:stop` | Stops Supabase CLI services |
| `npm run db:reset` | Resets the local Supabase database |
| `npm run db:check` | Checks for schema drift |
| `npm run build` | Builds the app for production |
| `npm run build:dev` | Builds with development mode |

---

## Environment Variables

The app uses environment variables for Supabase configuration, with production values as fallback.

### Local Development

When running locally with Supabase CLI, set these variables in `.env.local`:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key
```

Get your local anon key with:
```bash
supabase status
```

### Custom Configuration

Create a `.env.local` file (gitignored by default) based on `.env.local.example`:

```bash
cp .env.local.example .env.local
# Edit .env.local with your custom values
```

### Fallback to Production

If no environment variables are set, the app falls back to the production Supabase URL and key defined in `src/integrations/supabase/constants.ts`.

---

## Verification

| Check | Command |
|-------|---------|
| Supabase services running? | `npx supabase status` |
| Studio accessible? | Open `http://localhost:54323` |
| API accessible? | `curl http://localhost:54321/rest/v1/` |
| App running? | Open `http://localhost:5173` |
| Database accessible? | `npx supabase db psql` |

---

## Database Management

### Accessing the Database

Connect to your local PostgreSQL database:

```bash
supabase db psql
```

### Resetting the Database

To completely reset your local database (wipes all data):

```bash
npm run db:reset
```

Or directly:
```bash
npx supabase db reset
```

### Running Migrations

If you have database migrations in your `supabase/migrations` directory:

```bash
npx supabase db push
```

---

## Cleanup

To stop Supabase services without losing data:

```bash
npm run db:stop
```

Or directly:
```bash
npx supabase stop
```

To stop services **and** reset the database (start fresh):

```bash
npm run db:stop
npm run db:reset
npm run db:start
```

---

## Troubleshooting

### Supabase CLI Not Found

If you see errors related to Supabase CLI:

- Ensure dependencies are installed: `npm install`
- This installs Supabase CLI locally as a dev dependency

### Port Already in Use

If Supabase fails to start due to port conflicts:

- Stop the existing process: `npx supabase stop`
- Check for processes on ports 54321, 54322, 54323
- On macOS: `lsof -i :54321` then `kill <PID>`
- On Linux: `sudo netstat -tulnp | grep 54321`

### Connection Issues

If the app can't connect to Supabase:

1. Verify Supabase is running: `npx supabase status`
2. Verify the URL in `.env.local` is `http://localhost:54321` (not a PostgreSQL connection string)
3. Verify the anon key is correct
4. Check the browser console for CORS or connection errors

### Supabase CLI Hangs on Start

Try:
- Running `npx supabase stop` first, then `npx supabase start`
- Removing the `supabase` directory and re-initializing with `npx supabase init`
- Checking Docker Desktop is running (Supabase CLI uses Docker internally)

### Studio Login Issues

The local Studio may not require login. Try:
- Accessing `http://localhost:54323` directly
- Using the default credentials from `supabase status`

---

## Architecture Notes

- **REST API Required**: The browser-based Supabase client (`@supabase/supabase-js@2.x`) requires an HTTP/HTTPS REST API endpoint. It cannot connect directly to PostgreSQL.
- **Complete Stack**: Supabase CLI provides the full Supabase experience locally - PostgreSQL, REST API, Auth, Storage, and Studio.
- **Production Parity**: Local development mirrors the cloud experience, making it easier to test features before deployment.
- **Safety**: Production credentials remain as fallback but are NOT used when local Supabase runs (as long as environment variables are set).

---

## Supabase CLI Overview

The Supabase CLI is the official tool for local Supabase development. It provides:

- **Database**: PostgreSQL with all extensions
- **API**: RESTful API endpoint at `http://localhost:54321`
- **Auth**: Authentication service
- **Storage**: File storage service
- **Studio**: Web interface at `http://localhost:54323`
- **Realtime**: WebSocket subscriptions
- **Edge Functions**: Local function runtime

All services run in Docker containers managed by the CLI.

---

## See Also

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Client Configuration](../src/integrations/supabase/client.ts)
- [Supabase Constants](../src/integrations/supabase/constants.ts)
- [Package Scripts](../package.json)
- [Environment Variables Template](../.env.local.example)

---

*Last updated: 2026-08-09*
