// Supabase Edge Function: backfill-storage-sizes
//
// Outil d'ADMINISTRATION à exécution ponctuelle. Mesure la taille réelle des
// tracks dont le fichier vit sur Cloudflare R2 et dont tracks.file_size_bytes
// vaut encore 0, puis renseigne cette colonne — pour que le compteur de
// stockage cesse de sous-estimer la consommation (R2 facture au Go).
//
// LECTURE SEULE sur R2 : uniquement des requêtes HEAD (jamais PUT/DELETE).
// Réutilise le signeur SigV4 existant (_shared/storage.ts:presignR2Url) : ni la
// signature ni les credentials ne sont recréés ici.
//
// AUTORISATION : service_role UNIQUEMENT. Le bearer présenté doit être égal à
// SUPABASE_SERVICE_ROLE_KEY (comparaison à temps constant). Tout appel utilisateur
// authentifié normal ou anonyme est refusé (403). verify_jwt = true (config.toml).
//
// POST /backfill-storage-sizes
// Body (optionnel) : { "limit": number }   // défaut 100, pour relancer par tranches
// Headers : Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
// Réponse : { traitees, mises_a_jour, introuvables, erreurs, octets_ajoutes,
//             ids_introuvables: string[], recompute_ok: boolean }
//
// À la fin : appelle la RPC existante recompute_all_storage_usage() (service_role).
//
// Deploy: supabase functions deploy backfill-storage-sizes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { presignR2Url } from "../_shared/storage.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const CONCURRENCY = 5;
const HEAD_EXPIRES_SEC = 60;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Comparaison à temps constant — évite une fuite d'information par timing sur
 *  la clé service_role. Longueurs différentes -> false immédiat (les deux sont
 *  des secrets de config, pas des entrées attaquant, donc acceptable). */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** Dérive la clé objet R2 depuis tracks.audio_url. Gère : clé simple
 *  ("workspace/file.wav"), préfixe "r2://bucket/…", et URL complète http(s). */
function deriveTrackKey(audioUrl: string): string | null {
  const s = (audioUrl || "").trim();
  if (!s) return null;
  if (s.startsWith("r2://")) {
    const rest = s.slice("r2://".length);
    const idx = rest.indexOf("/");
    return idx >= 0 ? rest.slice(idx + 1) : null;
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const parts = u.pathname.replace(/^\/+/, "").split("/");
      // path-style: /{bucket}/{key…} -> on retire le segment bucket
      if (parts.length < 2) return null;
      return parts.slice(1).join("/");
    } catch {
      return null;
    }
  }
  return s.replace(/^\/+/, "");
}

/** Exécute fn sur items avec au plus `concurrency` tâches en parallèle. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

type Outcome =
  | { kind: "updated"; bytes: number }
  | { kind: "not_found"; id: string }
  | { kind: "error" };

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // --- Autorisation : service_role UNIQUEMENT --------------------------------
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!serviceKey || !token || !timingSafeEqual(token, serviceKey)) {
    // Message générique : ne révèle rien sur la raison exacte du refus.
    return jsonResponse({ error: "Forbidden: service_role only" }, 403);
  }

  // --- Paramètre limit (optionnel) ------------------------------------------
  let limit = DEFAULT_LIMIT;
  try {
    const body = await req.json();
    if (body && typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = Math.floor(body.limit);
    }
  } catch {
    // pas de body / body non-JSON -> défaut
  }
  if (limit < 1) limit = 1;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
  );

  // --- Sélection des tracks non mesurées ------------------------------------
  // coalesce(file_size_bytes,0)=0  ->  NULL ou 0 ; audio_url IS NOT NULL.
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("tracks")
    .select("id, audio_url")
    .or("file_size_bytes.is.null,file_size_bytes.eq.0")
    .not("audio_url", "is", null)
    .limit(limit);

  if (selErr) {
    console.error("backfill-storage-sizes: select failed:", selErr.message);
    return jsonResponse({ error: "Query failed" }, 500);
  }

  const tracks = (rows ?? []) as Array<{ id: string; audio_url: string | null }>;

  const outcomes = await mapPool(tracks, CONCURRENCY, async (track): Promise<Outcome> => {
    const key = deriveTrackKey(track.audio_url || "");
    if (!key) return { kind: "not_found", id: track.id };

    let res: Response;
    try {
      const url = await presignR2Url("HEAD", "tracks", key, HEAD_EXPIRES_SEC);
      // NB : `url` contient la signature + l'access key id — ne JAMAIS le logger.
      res = await fetch(url, { method: "HEAD" });
    } catch (e) {
      console.error("backfill-storage-sizes: HEAD failed for track", track.id, "-", (e as Error).message);
      return { kind: "error" };
    }

    if (res.status === 404) {
      return { kind: "not_found", id: track.id };
    }
    if (!res.ok) {
      console.error("backfill-storage-sizes: HEAD non-ok for track", track.id, "status", res.status);
      return { kind: "error" };
    }

    const raw = res.headers.get("content-length");
    const size = raw != null ? Number(raw) : NaN;
    // N'écrire QUE si taille entière strictement positive.
    if (!Number.isFinite(size) || size <= 0 || !Number.isInteger(size)) {
      console.error("backfill-storage-sizes: missing/invalid Content-Length for track", track.id);
      return { kind: "error" };
    }

    // Garde-fou anti-réécriture : ne mettre à jour que si toujours à 0/NULL.
    const { error: updErr } = await supabaseAdmin
      .from("tracks")
      .update({ file_size_bytes: size })
      .eq("id", track.id)
      .or("file_size_bytes.is.null,file_size_bytes.eq.0");

    if (updErr) {
      console.error("backfill-storage-sizes: update failed for track", track.id, "-", updErr.message);
      return { kind: "error" };
    }
    return { kind: "updated", bytes: size };
  });

  // --- Agrégation ------------------------------------------------------------
  let mises_a_jour = 0;
  let introuvables = 0;
  let erreurs = 0;
  let octets_ajoutes = 0;
  const ids_introuvables: string[] = [];
  for (const o of outcomes) {
    if (o.kind === "updated") {
      mises_a_jour++;
      octets_ajoutes += o.bytes;
    } else if (o.kind === "not_found") {
      introuvables++;
      ids_introuvables.push(o.id);
    } else {
      erreurs++;
    }
  }

  // --- Recalcul global du stockage (RPC existante, service_role) -------------
  let recompute_ok = true;
  const { error: recomputeErr } = await supabaseAdmin.rpc("recompute_all_storage_usage");
  if (recomputeErr) {
    recompute_ok = false;
    console.error("backfill-storage-sizes: recompute_all_storage_usage failed:", recomputeErr.message);
  }

  return jsonResponse({
    traitees: tracks.length,
    mises_a_jour,
    introuvables,
    erreurs,
    octets_ajoutes,
    ids_introuvables,
    recompute_ok,
  }, 200);
});
