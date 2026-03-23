# Code Quality Skill — Architecture & Best Practices

## Architecture React
- Feature-based structure : un dossier par feature, pas par type de fichier
- Context pour le state global, useState pour le state local
- Custom hooks pour la logique réutilisable
- Composants < 300 lignes — splitter si plus grand
- Pas de business logic dans les composants JSX — extraire dans des hooks ou utils

## TypeScript
- Strict mode toujours activé
- Pas de any, as any, ou @ts-ignore
- Interfaces pour les props, types pour les unions
- Enums seulement quand nécessaire — préférer les union types

## Patterns obligatoires
- Error boundaries autour des sections critiques
- Loading states pour chaque fetch (skeleton ou spinner)
- Empty states avec CTA (pas juste "No data")
- Optimistic updates quand possible (update UI avant confirmation serveur)
- Debounce sur les inputs de recherche (300ms)
- Memoization (useMemo, useCallback) seulement quand mesuré nécessaire

## Naming conventions
- Composants : PascalCase (TrackDetail.tsx)
- Hooks : camelCase avec use prefix (useAudioPlayer.ts)
- Utils : camelCase (formatDuration.ts)
- Constants : UPPER_SNAKE_CASE (DEFAULT_COVER)
- Types/Interfaces : PascalCase avec suffixe descriptif (TrackData, PitchStatus)
- CSS classes : kebab-case via Tailwind

## Base de données (Supabase/PostgreSQL)
- Tables : snake_case pluriel (tracks, shared_links)
- Colonnes : snake_case (created_at, workspace_id)
- RLS activé sur CHAQUE table sans exception
- Indexes sur les colonnes utilisées dans WHERE et JOIN
- Foreign keys avec ON DELETE CASCADE ou SET NULL (jamais orphelins)
- Timestamps toujours en timestamptz (pas timestamp)

## Edge Functions (Deno)
- Valider tous les inputs (type, format, longueur)
- Utiliser le service role seulement quand nécessaire
- CORS restreint aux domaines autorisés
- Rate limiting sur les endpoints sensibles
- Logs structurés pour le debugging
- Retourner des erreurs explicites (pas juste 500)

## Git
- Commits atomiques : 1 feature ou 1 fix par commit
- Messages descriptifs : "feat: add X" / "fix: resolve Y" / "perf: optimize Z"
- Jamais de "fix stuff" ou "update"
- Branch main toujours deployable

## Performance
- Images : WebP, lazy loading, srcset pour responsive
- Code splitting : dynamic import pour les gros modules
- Bundle < 500KB par chunk idéalement
- Pas de n+1 queries (batch les requêtes)
- Signed URLs avec cache côté client
- Service Worker pour le caching si PWA

## Sécurité
- Jamais de secrets côté client
- Hasher les passwords (PBKDF2 ou bcrypt)
- Tokens crypto-random (pas Math.random)
- Sanitizer les inputs utilisateur
- CORS strict
- CSP headers si possible
