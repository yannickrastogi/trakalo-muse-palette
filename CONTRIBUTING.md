# Contributing to Trakalog

## Mandatory Rules for All Changes

### 1. Mobile-First Responsive Design
Every new component **MUST** be responsive using a mobile-first approach with Tailwind breakpoints:
- `sm` (640px) — small tablets
- `md` (768px) — tablets / small laptops
- `lg` (1024px) — desktops

**Default styles = mobile.** Use `sm:`, `md:`, `lg:` prefixes to add desktop enhancements.

### 2. Internationalization (i18n)
Every user-visible text **MUST** use i18next translation keys — no hardcoded strings.

```tsx
// ✅ Correct
const { t } = useTranslation();
<p>{t("myComponent.title")}</p>

// ❌ Wrong
<p>My Title</p>
```

Add keys to at minimum `en.json` and `fr.json` in `src/i18n/locales/`.

### 3. Modals & Drawers
On mobile (`< 768px`), every modal **MUST** be either:
- **Full-screen** (drawer from bottom), or
- A **bottom sheet**

On desktop (`≥ 768px`), use centered dialog as usual.

Pattern:
```tsx
// Outer container
className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center p-0 md:p-4"

// Inner modal
className="relative z-10 w-full md:max-w-md max-h-[100dvh] md:max-h-[90vh] bg-card rounded-t-2xl md:rounded-2xl"
```

### 4. Touch Targets
Every interactive element (button, input, link) **MUST** have a minimum touch target of **44px** on mobile.

```tsx
className="min-h-[44px] min-w-[44px]"
```

### 5. Single-Column Mobile Layout
Every layout **MUST** work in a single column on mobile.

```tsx
// ✅ Correct
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"

// ❌ Wrong
className="grid grid-cols-3"
```

### 6. Audio Player
There is **one global Audio()** instance managed by `AudioPlayerContext` — never create local audio elements outside of it (except for isolated pages like SharedLinkPage).

### 7. Data Source
All data comes from **Supabase** — no mock data, no hardcoded datasets.

### 7b. Detail Page Fetching Pattern
Detail pages (TrackDetail, PlaylistDetail, etc.) **MUST** use the context as primary data source with a DB fallback for direct navigation / refresh:

```tsx
// 1. Try context first (instant if navigated from list)
const contextData = getItem(id);

// 2. DB fallback via useRef to avoid re-fetching
const dbFetchedRef = useRef<string | null>(null);
useEffect(() => {
  if (contextData || dbFetchedRef.current === id) return;
  dbFetchedRef.current = id;
  supabase.from("table").select("*").eq("id", id).single().then(/* ... */);
}, [id]);

// 3. Merge: context wins, DB is fallback
const data = contextData || dbData;

// 4. Track "had data" for loading vs not-found
const hadDataRef = useRef(false);
if (data) hadDataRef.current = true;
```

Public pages (SharedLinkPage) fetch directly from Supabase since no app context is available.

### 8. Storage Buckets
- Audio files → `tracks` bucket (private)
- Stems → `stems` bucket (private)
- Cover art → `covers` bucket (public)

### 9. Template Literals
Avoid backticks in template literals when copying code. Use string concatenation (`+`) instead.
