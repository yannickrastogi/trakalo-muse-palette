# TRAKALOG

## Projet
SaaS premium de gestion de catalogue musical pré-release.

## Stack
- React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Framer Motion
- Supabase (PostgreSQL + Auth + Storage)
- Vercel (déploiement)

## Architecture
- src/contexts/ : contextes React (Auth, Workspace, Track, AudioPlayer, etc.)
- src/components/ : composants UI
- src/pages/ : pages/routes
- src/integrations/supabase/ : client Supabase

## Règles
- Un seul Audio() global via AudioPlayerContext — jamais de lecteur audio local
- Toutes les données viennent de Supabase — pas de mock data
- Pas de backticks dans les template literals quand on copie du code (utiliser la concaténation +)
- Les fichiers audio vont dans le bucket "tracks", les stems dans "stems", les covers dans "covers"

## Supabase
- URL: https://xhmeitivkclbeziqavxw.supabase.co
- 13 tables, 12 ENUMs, RLS activé
- Buckets Storage: tracks (privé), stems (privé), covers (public)
