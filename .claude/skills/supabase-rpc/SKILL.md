# Supabase RPC Pattern — Trakalog

---
name: supabase-rpc
description: Quand on crée, modifie ou débug une query Supabase, une table, une policy RLS, ou un appel .from() / .rpc() dans le code React
---

## Règle absolue

`auth.uid()` est INSTABLE dans Trakalog. Ne JAMAIS écrire de query qui dépend de `auth.uid()` dans une policy RLS ou une fonction.

## Pattern obligatoire

Toute nouvelle query DB doit être une RPC `SECURITY DEFINER` :

```sql
CREATE OR REPLACE FUNCTION ma_nouvelle_rpc(_user_id uuid, ...)
RETURNS ... AS $$
BEGIN
  -- Vérifier les permissions ICI (pas via RLS)
  -- Exécuter la query
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Côté React

```typescript
const { data, error } = await supabase.rpc('ma_nouvelle_rpc', {
  _user_id: user.id,
  // autres params
});
```

## Checklist avant de livrer

1. ✅ La query est une RPC SECURITY DEFINER (pas un .from() direct)
2. ✅ `_user_id uuid` est le premier paramètre
3. ✅ Les permissions sont vérifiées dans la fonction SQL
4. ✅ Le SQL est fourni séparément pour exécution manuelle dans le Supabase SQL Editor
5. ✅ Soft delete (pas de DELETE, utiliser un champ status/deleted_at)

## RPCs existantes — voir docs/RPCS.md
