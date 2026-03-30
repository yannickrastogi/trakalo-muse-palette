# React Component Pattern — Trakalog

---
name: react-component
description: Quand on crée un nouveau composant React, une nouvelle page, ou qu'on modifie un composant existant dans src/
---

## Règles critiques

### Hooks — JAMAIS après un early return
```typescript
// ❌ INTERDIT
const MyComponent = () => {
  if (!data) return null;
  const [state, setState] = useState(false); // CRASH
};

// ✅ CORRECT
const MyComponent = () => {
  const [state, setState] = useState(false);
  if (!data) return null;
};
```

### Client Supabase
- Utiliser l'import depuis `src/integrations/supabase/client.ts` — JAMAIS créer un nouveau client
- Exception : pages publiques → `useRef(createClient(..., { auth: { persistSession: false } }))`

### Texte visible
- TOUJOURS utiliser `t()` de i18next : `{t('ma_cle')}` — jamais de texte en dur

### Audio
- JAMAIS créer une nouvelle instance `Audio()` — utiliser `AudioPlayerContext`

### DB
- JAMAIS de `.from('table')` direct pour des données protégées — utiliser `.rpc('nom_rpc', { _user_id: user.id })`

## Patterns courants

### Page détail avec fallback DB
```typescript
const cachedData = useRef<Type | null>(null);

useEffect(() => {
  const fetchData = async () => {
    const { data } = await supabase.rpc('get_xxx', { _user_id: user.id });
    if (data) cachedData.current = data;
  };
  fetchData();
}, [id]);

// Utiliser cachedData.current || freshData pour l'affichage
```

### Responsive
- Mobile-first : commencer par 375px
- Utiliser les breakpoints Tailwind : `sm:`, `md:`, `lg:`

## Style
- shadcn/ui pour les composants de base
- Framer Motion pour les animations
- Tailwind pour le styling — pas de CSS custom sauf cas exceptionnel
