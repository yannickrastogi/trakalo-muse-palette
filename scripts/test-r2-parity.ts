// Storage parity test — verifies that the StorageProvider abstraction behaves
// identically for Supabase Storage and Cloudflare R2.
//
// Test plan:
//   1. Upload the same payload to both providers under an identical key.
//   2. Generate a signed download URL on each.
//   3. GET via each signed URL and compare bytes.
//   4. Verify HEAD/exists() reports true on both.
//   5. Delete the test object from both providers, verify exists() = false.
//
// Usage (from repo root, with .env.local populated):
//   SUPABASE_URL=https://xhmeitivkclbeziqavxw.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   $(grep -v '^#' .env.local | xargs) \
//   deno run -A --env-file=.env.local scripts/test-r2-parity.ts
//
// Notes:
// - This script reuses `supabase/functions/_shared/storage.ts` so it tests the
//   exact code path that the Edge Functions use.
// - Provider is selected per-instance: we instantiate both manually rather than
//   relying on the STORAGE_PROVIDER env var (so we can compare them side-by-side).
// - Test bucket: "watermarked" (cheapest to dirty, auto-cleaned).
// - This script REQUIRES the bucket to already exist on both providers.

import {
  type BucketName,
  type StorageProvider,
} from "../supabase/functions/_shared/storage.ts";

// -----------------------------------------------------------------------------
// Build both providers explicitly (bypassing the factory env-var switch).
// -----------------------------------------------------------------------------

async function buildProviders(): Promise<{
  supabase: StorageProvider;
  r2: StorageProvider;
}> {
  // We need to reach the same internals as storage.ts. Easiest path: temporarily
  // set STORAGE_PROVIDER, dynamically import, switch, re-import. Simpler: import
  // the module once but instantiate via the env override per call.
  //
  // Implementation choice: re-export the classes by using a small wrapper that
  // sets the env var per provider. This avoids modifying storage.ts.
  Deno.env.set("STORAGE_PROVIDER", "supabase");
  const { getStorageProvider: gp1 } = await import(
    "../supabase/functions/_shared/storage.ts"
  );
  const supabase = gp1();

  Deno.env.set("STORAGE_PROVIDER", "r2");
  const { getStorageProvider: gp2 } = await import(
    "../supabase/functions/_shared/storage.ts?r2"
  );
  const r2 = gp2();

  return { supabase, r2 };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function randomKey(prefix = "parity-test"): string {
  const r = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(r).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}/${Date.now()}-${hex}.bin`;
}

function randomPayload(size = 4096): Uint8Array {
  const buf = new Uint8Array(size);
  crypto.getRandomValues(buf);
  return buf;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function fetchSignedUrl(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch failed: status=${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// -----------------------------------------------------------------------------
// Test runner
// -----------------------------------------------------------------------------

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
}

async function runParityTest(bucket: BucketName): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const { supabase, r2 } = await buildProviders();
  const key = randomKey();
  const payload = randomPayload(4096);
  const contentType = "application/octet-stream";

  console.log(`\n--- bucket=${bucket} key=${key} payload=${payload.byteLength}B ---\n`);

  // ---- 1. Upload to both providers --------------------------------------
  try {
    await supabase.upload(bucket, key, payload, contentType);
    results.push({ name: "supabase.upload", pass: true });
  } catch (e) {
    results.push({
      name: "supabase.upload",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    await r2.upload(bucket, key, payload, contentType);
    results.push({ name: "r2.upload", pass: true });
  } catch (e) {
    results.push({
      name: "r2.upload",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // ---- 2. Generate signed URLs ------------------------------------------
  let supabaseUrl = "", r2Url = "";
  try {
    supabaseUrl = await supabase.createSignedUrl(bucket, key, 300);
    results.push({ name: "supabase.createSignedUrl", pass: true });
  } catch (e) {
    results.push({
      name: "supabase.createSignedUrl",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  try {
    r2Url = await r2.createSignedUrl(bucket, key, 300);
    results.push({ name: "r2.createSignedUrl", pass: true });
  } catch (e) {
    results.push({
      name: "r2.createSignedUrl",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // ---- 3. Download & compare bytes --------------------------------------
  let supabaseBytes: Uint8Array | null = null;
  let r2Bytes: Uint8Array | null = null;

  if (supabaseUrl) {
    try {
      supabaseBytes = await fetchSignedUrl(supabaseUrl);
      results.push({
        name: "supabase.signed-url GET bytes match payload",
        pass: bytesEqual(supabaseBytes, payload),
        detail: `got ${supabaseBytes.byteLength}B`,
      });
    } catch (e) {
      results.push({
        name: "supabase.signed-url GET",
        pass: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (r2Url) {
    try {
      r2Bytes = await fetchSignedUrl(r2Url);
      results.push({
        name: "r2.signed-url GET bytes match payload",
        pass: bytesEqual(r2Bytes, payload),
        detail: `got ${r2Bytes.byteLength}B`,
      });
    } catch (e) {
      results.push({
        name: "r2.signed-url GET",
        pass: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (supabaseBytes && r2Bytes) {
    results.push({
      name: "supabase ⇄ r2 byte-identical",
      pass: bytesEqual(supabaseBytes, r2Bytes),
    });
  }

  // ---- 4. exists() returns true -----------------------------------------
  try {
    const ok = await supabase.exists(bucket, key);
    results.push({ name: "supabase.exists() true", pass: ok });
  } catch (e) {
    results.push({
      name: "supabase.exists() true",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    const ok = await r2.exists(bucket, key);
    results.push({ name: "r2.exists() true", pass: ok });
  } catch (e) {
    results.push({
      name: "r2.exists() true",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // ---- 5. download() returns identical bytes (server-side) --------------
  try {
    const dlS = await supabase.download(bucket, key);
    results.push({
      name: "supabase.download() matches payload",
      pass: bytesEqual(dlS, payload),
    });
  } catch (e) {
    results.push({
      name: "supabase.download()",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    const dlR = await r2.download(bucket, key);
    results.push({
      name: "r2.download() matches payload",
      pass: bytesEqual(dlR, payload),
    });
  } catch (e) {
    results.push({
      name: "r2.download()",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // ---- 6. delete + exists()=false ---------------------------------------
  try {
    await supabase.delete(bucket, key);
    const stillThere = await supabase.exists(bucket, key);
    results.push({
      name: "supabase.delete then exists()=false",
      pass: !stillThere,
    });
  } catch (e) {
    results.push({
      name: "supabase.delete",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }
  try {
    await r2.delete(bucket, key);
    const stillThere = await r2.exists(bucket, key);
    results.push({
      name: "r2.delete then exists()=false",
      pass: !stillThere,
    });
  } catch (e) {
    results.push({
      name: "r2.delete",
      pass: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  return results;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

if (import.meta.main) {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_WATERMARKED",
  ];
  const missing = required.filter((k) => !Deno.env.get(k));
  if (missing.length > 0) {
    console.error("Missing required env vars:");
    missing.forEach((k) => console.error("  - " + k));
    Deno.exit(2);
  }

  const results = await runParityTest("watermarked");
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const mark = r.pass ? "✅" : "❌";
    const tail = r.detail ? "  (" + r.detail + ")" : "";
    console.log(mark + " " + r.name + tail);
    if (r.pass) passed++;
    else failed++;
  }

  console.log("\n--- summary: " + passed + " passed, " + failed + " failed ---");
  Deno.exit(failed === 0 ? 0 : 1);
}
