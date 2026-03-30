# Edge Function Pattern — Trakalog

---
name: edge-function
description: Quand on crée, modifie ou débug une Supabase Edge Function dans supabase/functions/
---

## Structure obligatoire

```typescript
import { corsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // 1. CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // 2. Extraire les données
    const { param1, param2 } = await req.json();

    // 3. Créer le client Supabase admin si besoin DB
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Logique métier

    // 5. Retourner la réponse
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

## Règles

1. TOUJOURS importer cors depuis `_shared/cors.ts`
2. CORS restreint — PAS de wildcard `*`
3. Les Edge Functions fonctionnent avec l'anon key — pas besoin de session auth
4. Utiliser `SUPABASE_SERVICE_ROLE_KEY` pour les opérations admin (bypass RLS)
5. JAMAIS d'auth utilisateur dans l'Edge Function — passer le user_id en paramètre si besoin

## Edge Functions existantes

get-audio-url, hash-link-password, verify-link-password, send-pitch-email, send-invitation-email, create-invitation, accept-invitation, log-link-access, log-link-event

## Déploiement

Fournir le code à Yannick. Déployer via :
```bash
supabase functions deploy nom-de-la-function --project-ref xhmeitivkclbeziqavxw
```
