# Coding Standards

> **Status:** Draft  
> **Version:** 1.0.0  
> **Created:** August 18, 2026  
> **Last Updated:** September 2, 2026  
> **Owner:** Ishan  
> **Related:** [02 - System Architecture](../ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md), [04 - Component Architecture](../ARCHITECTURE/04-COMPONENT_ARCHITECTURE.md)

---

## Abstract

This document establishes the coding standards, conventions, and best practices for Trakalog's frontend development. These standards ensure consistency, maintainability, and quality across the codebase.

---

## 1. Language & Framework Standards

### 1.1 TypeScript

**Version:** 5.8.3

#### Configuration

TypeScript configuration is split across three files:
- `tsconfig.json` - Base configuration with path aliases
- `tsconfig.app.json` - Application-specific settings (React, DOM)
- `tsconfig.node.json` - Node.js environment settings

#### Type Safety Rules

| Rule | Configuration | Rationale |
|------|--------------|-----------|
| `strict` | `false` | Gradual migration to strict mode |
| `noImplicitAny` | `false` | Allow implicit any for flexibility |
| `strictNullChecks` | `false` | Null/undefined not strictly checked |
| `skipLibCheck` | `true` | Skip library type checking for speed |
| `noUnusedLocals` | `false` | Allow unused local variables |
| `noUnusedParameters` | `false` | Allow unused function parameters |

**Path Aliases:**
```json
{
  "@/*": ["./src/*"]
}
```

#### Best Practices

1. **Explicit Types:** Prefer explicit type annotations for function parameters and return types
2. **Interfaces vs Types:** Use `interface` for object shapes, `type` for unions and complex types
3. **Generics:** Use generics for reusable component props and utility functions
4. **Type Assertions:** Avoid `as` assertions; prefer type guards
5. **Utility Types:** Leverage TypeScript's utility types (`Partial`, `Pick`, `Omit`, etc.)

```typescript
// ✅ Preferred
interface Track {
  id: string;
  title: string;
  artists: string[];
}

function getTrack(id: string): Promise<Track> { ... }

// ❌ Avoid
function getTrack(id: any): any { ... }
```

### 1.2 React 18

**Version:** 18.3.x

#### Component Patterns

**Function Components:** All components use function components with TypeScript

```typescript
interface Props {
  track: Track;
  onPlay: () => void;
  className?: string;
}

export function TrackCard({ track, onPlay, className }: Props) {
  return (
    <div className={cn("group", className)} onClick={onPlay}>
      <p>{track.title}</p>
    </div>
  );
}
```

**Component Structure:**

`src/components/` is largely **flat** — roughly 60 `.tsx` files at the top level — with four
subdirectories:

```
components/
├── <~60 flat component files>   # ShareModal.tsx, TrackTable.tsx, ...
├── ui/                          # shadcn/ui primitives (41 files)
├── admin/                       # Admin console components
├── onboarding/                  # Onboarding flow components
└── visual/                      # Decorative/animated components
```

Grouping the flat files into feature folders would be an improvement, but it is not the
current layout — do not assume `audio/`, `sharing/`, `layout/` or `common/` exist.

**Naming Conventions:**
- PascalCase for component files (`ShareModal.tsx`)
- PascalCase for component names (`ShareModal`)
- kebab-case for CSS classes (`track-card`, `player-controls`)

**Props:**
- Use `interface` for component props
- Destructure props in parameter list
- Use `className` prop for styling extensibility
- Forward refs using `React.forwardRef` when needed

### 1.3 Tailwind CSS

**Version:** 3.4.17

#### Configuration

**Theme Extension (`tailwind.config.ts`):**
- Custom color palette using CSS variables (HSL-based)
- Custom font families (Sora, Inter, JetBrains Mono)
- Custom animations (accordion, shimmer, pulse-glow)
- Custom border radius using CSS variables

#### Class Organization

**Utility-First:** Use Tailwind's utility classes directly

```typescript
// ✅ Preferred
<div className="flex items-center justify-between p-4 bg-background rounded-lg">

// ❌ Avoid
<div className="flexbox-container">
```

**Common Patterns:**
- `cn()` utility from `clsx` + `tailwind-merge` for conditional classes
- Use CSS variables for theming (`bg-background`, `text-foreground`)
- Dark mode via `dark:` prefix (class-based)

```typescript
import { cn } from "@/lib/utils";

export function Button({ variant, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm",
        "font-medium transition-colors focus-visible:outline-none",
        "disabled:opacity-50 disabled:pointer-events-none",
        variant === "primary" && "bg-primary text-primary-foreground",
        className
      )}
      {...props}
    />
  );
}
```

**Custom Styles:**
- Add custom styles in `src/index.css`
- Use `@layer` directives for organization
- Keyframes defined in Tailwind config for animations

### 1.4 shadcn/ui Component Library

Trakalog uses **shadcn/ui** as the primary component library, built on Radix UI primitives.

**Installed Components:**
- Accordion, Alert Dialog, Avatar, Checkbox, Collapsible
- Context Menu, Dialog, Dropdown Menu, Hover Card
- Input, Label, Menubar, Navigation Menu, Popover
- Progress, Radio Group, Scroll Area, Select
- Separator, Slider, Slot, Switch, Tabs
- Toast, Toggle, Toggle Group, Tooltip

**Installed primitives** — `src/components/ui/` holds 41 files:

```
accordion  alert  alert-dialog  aspect-ratio  avatar  badge  breadcrumb  button
calendar  card  checkbox  collapsible  command  dialog  drawer  dropdown-menu
form  input  label  popover  progress  radio-group  resizable  scroll-area
select  separator  sheet  sidebar  skeleton  slider  sonner  switch  table
tabs  textarea  toast  toaster  toggle  toggle-group  tooltip  use-toast
```

**Usage Pattern:**
```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
```

---

## 2. Code Organization

### 2.1 Directory Structure

```
src/
├── App.tsx           # Root component: providers + routing
├── main.tsx          # React entry point
├── assets/           # Static assets (images, fonts)
├── components/       # React components (~60 flat files + 4 subdirs)
│   ├── ui/          # shadcn/ui primitives (41 files)
│   ├── admin/       # Admin console components
│   ├── onboarding/  # Onboarding flow components
│   └── visual/      # Decorative/animated components
├── config/          # Application configuration
│   └── features.ts  # Feature flags
├── contexts/        # React Context providers (15 files)
│   ├── AuthContext.tsx
│   ├── RoleContext.tsx
│   ├── TrackContext.tsx
│   ├── WorkspaceContext.tsx
│   ├── SharedLinksContext.tsx
│   └── ...
├── hooks/           # Custom React hooks (9 files)
│   ├── useWorkspaceSeats.ts
│   ├── useContactSuggestions.ts
│   ├── useTrackCompleteness.ts
│   ├── use-toast.ts
│   └── ...
├── i18n/           # Internationalization
│   ├── locales/     # Translation files (8 languages)
│   └── index.ts    # i18next configuration
├── integrations/    # External service integrations
│   └── supabase/
│       ├── client.ts
│       └── constants.ts
├── lib/            # Utility libraries and business logic
│   ├── audio.ts
│   ├── audio-analysis.ts
│   ├── analytics.ts
│   ├── constants.ts
│   └── ...
├── pages/           # Page components (routes, 32 files + admin/)
│   ├── TrackDetail.tsx
│   ├── SharedLinkPage.tsx
│   ├── SharedLinks.tsx
│   ├── Onboarding.tsx
│   └── ...
├── test/           # Test utilities
│   ├── setup.ts
│   └── example.test.ts
└── types/          # TypeScript type definitions
    ├── lamejs.d.ts
    └── workspace.ts
```

### 2.2 File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TrackCard.tsx` |
| Hooks | `use` prefix, camelCase | `useWorkspaceSeats.ts` |
| Utilities | kebab-case | `audio-analysis.ts` |
| Types | PascalCase | `workspace.ts` in `src/types/` |
| Pages | PascalCase | `TrackDetail.tsx` |
| Constants | SCREAMING_SNAKE_CASE | `constants.ts` (exported as `MAX_FILE_SIZE`) |

### 2.3 Import Paths

Use absolute imports with `@/` alias:

```typescript
// ✅ Preferred
import { Button } from "@/components/ui/button";
import { useTrack } from "@/hooks/useTrack";
import { Track } from "@/types";

// ❌ Avoid
import { Button } from "../../components/ui/button";
```

---

## 3. State Management

### 3.1 React Context

**Primary Pattern:** React Context for global state

**Available Contexts:**
- `AuthContext` - Authentication state
- `RoleContext` - User permissions and roles
- `WorkspaceContext` - Current workspace information
- `TrackContext` - Track-related state
- `AudioPlayerContext` - Audio playback state
- `EngagementContext` - Engagement analytics

**Usage Pattern:**
```typescript
import { useWorkspace } from "@/contexts/WorkspaceContext";

function TrackList() {
  const { workspace, isLoading } = useWorkspace();
  
  if (isLoading) return <LoadingSpinner />;
  
  return (
    <div>
      {workspace.tracks.map(track => (
        <TrackCard key={track.id} track={track} />
      ))}
    </div>
  );
}
```

### 3.2 React Query (@tanstack/react-query)

**Primary Data Fetching:** React Query for server state management

**Key Patterns:**
- Use `useQuery` for GET requests
- Use `useMutation` for POST/PUT/DELETE
- Query keys follow array pattern: `['tracks', workspaceId]`
- Stale-while-revalidate for background updates

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function useTracks(workspaceId: string) {
  return useQuery({
    queryKey: ['tracks', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tracks')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

### 3.3 Local State

- Use React's `useState` for simple local state
- Use `useReducer` for complex local state
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to children

---

## 4. Business Logic Organization

### 4.1 Library Functions (`src/lib/`)

Business logic and utility functions are organized in the `lib/` directory:

| File | Purpose |
|------|---------|
| `audio.ts` | Core audio processing utilities |
| `audio-analysis.ts` | Sonic DNA and audio feature extraction |
| `audio-compression.ts` | MP3 compression and format conversion |
| `analytics.ts` | Page view tracking for public pages |
| `constants.ts` | Application-wide constants |
| `contact-export.ts` | Contact data export functionality |
| `crossfadePlayer.ts` | Crossfading audio player implementation |
| `detectCollaboratorsFromText.ts` | AI-assisted collaborator detection |
| `safeStorage.ts` | Safe storage access with fallbacks |
| `social-urls.ts` | Social media URL generation |
| `split-utils.ts` | Split calculation utilities |
| `tagsVocabulary.ts` | Tag vocabulary and validation |
| `theme.ts` | Theme configuration |
| `utils.ts` | General utility functions (includes `cn()`) |
| `whitelist.ts` | Email domain whitelisting |

**Function Naming:**
- Use verb phrases: `generateShareLink()`, `validateTrackMetadata()`
- Use `get` prefix for retrieval: `getTrackById()`, `getAudioDuration()`
- Use `is`/`has`/`can` prefix for booleans: `isValidISRC()`, `hasAudio()`, `canUpload()`

### 4.2 Error Handling

**Async Error Handling:**
```typescript
// ✅ Preferred - try/catch with user feedback
async function loadTrack(id: string) {
  try {
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to load track:', error);
    toast.error('Failed to load track');
    return null;
  }
}

// ✅ For fire-and-forget operations (no user feedback)
async function trackAnalytics(event: AnalyticsEvent) {
  try {
    await fetch('/api/analytics', { method: 'POST', body: JSON.stringify(event) });
  } catch {
    // Fail silently
  }
}
```

---

## 5. Formatting & Linting

### 5.1 ESLint

**Version:** 9.32.0

**Configuration:** `eslint.config.js`

**Plugins:**
- `@eslint/js` - Core ESLint rules
- `typescript-eslint` - TypeScript-specific rules
- `eslint-plugin-react-hooks` - React Hooks rules
- `eslint-plugin-react-refresh` - React Refresh rules

**Rules:**
```javascript
{
  "@typescript-eslint/no-unused-vars": "off",
  "react-refresh/only-export-components": ["warn", { allowConstantExport: true }]
}
```

**Scripts:**
```bash
npm run lint          # Run ESLint
```

### 5.2 Code Formatting

- Use **Biome** or **Prettier** for formatting (not currently configured)
- 2-space indentation
- Single quotes for strings
- Trailing commas for multi-line objects/arrays
- Semicolons at end of statements

```typescript
// ✅ Preferred
const track = {
  id: 'abc-123',
  title: 'My Track',
  artists: ['Artist One', 'Artist Two'],
};

// ❌ Avoid
const track = {
  id: "abc-123",
  title: "My Track",
  artists: ["Artist One", "Artist Two"]
}
```

---

## 6. Git Standards

### 6.1 Commit Messages

Use **Conventional Commits** format:

```
type(scope): subject

body

footer
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

**Examples:**
```bash
feat(tracks): add batch upload support
fix(audio): correct watermark extraction logic
refs(components): update Button component props
docs: add CODING_STANDARDS.md
docs: update ARCHITECTURE/02-SYSTEM_ARCHITECTURE.md
chore(deps): update react-query to v5
```

### 6.2 Branch Naming

- Use `kebab-case` for branch names
- Prefix with type: `feat/`, `fix/`, `docs/`, `chore/`
- Include issue number if applicable: `feat/track-upload-#123`

---

## 7. Security Best Practices

### 7.1 Environment Variables

- **Never** commit secrets to version control
- Use `.env.local` for local overrides
- The frontend reads **no** environment variables — there is no `.env.local.example`, and `src/` contains no `import.meta.env`. Supabase config is hardcoded in `src/integrations/supabase/constants.ts`
- Edge Function secrets are a separate matter: those are read with `Deno.env.get()` server-side and set via `supabase secrets set`

### 7.2 Sensitive Data

- Never log sensitive information (API keys, tokens, user data)
- Use `console.error` sparingly in production
- Strip sensitive data from error objects before logging

### 7.3 API Calls

- Always use HTTPS
- Validate responses
- Handle errors gracefully
- Use Supabase RPC functions over direct table access when possible

---

## 8. Performance Best Practices

### 8.1 React Performance

- Use `React.memo` for expensive pure components
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed to children
- Use `React.lazy` for code-splitting large components
- Avoid inline arrow functions in render

### 8.2 Data Fetching

- Use React Query's `staleTime` and `cacheTime` appropriately
- Implement pagination for large datasets
- Use optimistic updates for mutations when possible

---

## 9. Testing Conventions

See [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) for detailed testing guidelines.

---

## 10. File Templates

### Component Template

```typescript
import { type ReactNode } from "react";

interface Props {
  // Define props here
}

export function ComponentName({ /* destructure props */ }: Props) {
  return (
    <div>
      {/* Component implementation */}
    </div>
  );
}
```

### Hook Template

```typescript
import { useState, useEffect } from "react";

export function useHookName(params: ParamsType) {
  const [state, setState] = useState<StateType>(initialState);

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  return {
    state,
    setState,
    // Other returned values
  };
}
```

---

## 11. Accessibility

- Use semantic HTML elements
- Add `alt` text for images
- Use `aria-` attributes when needed
- Ensure keyboard navigation works
- Use proper contrast ratios

---

## Appendix A: Quick Reference

| Task | Command/Location |
|------|------------------|
| Run linter | `npm run lint` |
| Run tests | `npm run test` |
| Run tests (watch) | `npm run test:watch` |
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| TypeScript config | `tsconfig.app.json` |
| ESLint config | `eslint.config.js` |
| Tailwind config | `tailwind.config.ts` |

---

## Appendix B: Document Metadata

| Property | Value |
|----------|-------|
| **Created** | August 18, 2026 |
| **Version** | 1.0.0 |
| **Owner** | Ishan |
| **Status** | Draft |
| **Phase** | 3 (Operations) |
| **Effort** | 3h |
