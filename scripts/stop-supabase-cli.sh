#!/bin/bash
set -e

# Stop Supabase CLI local development stack
cd "$(dirname "$0")/.."

echo "Stopping Supabase CLI local stack..."

# Stop Supabase using npx (local installation)
npx supabase stop

echo "Supabase CLI services stopped."
