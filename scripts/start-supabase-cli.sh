#!/bin/bash
set -e

# Start Supabase CLI local development stack
cd "$(dirname "$0")/.."

echo "Starting Supabase CLI local stack..."
echo "This will start PostgreSQL, API, Auth, Storage, and Studio services."
echo ""

# Start Supabase using npx (local installation)
echo "Starting Supabase services..."
npx supabase start

echo ""
echo "Supabase CLI is now running!"
echo "- API URL: http://localhost:54321"
echo "- Studio URL: http://localhost:54323"
echo "- DB URL: postgresql://postgres.postgres@localhost:54322/postgres"
echo ""
echo "Anon key (for .env.local):"
echo "  Run 'npx supabase status' to get your anon key"
echo ""
echo "Your app should connect to: http://localhost:54321"
