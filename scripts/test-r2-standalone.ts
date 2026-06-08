// Standalone R2 sanity check — validates AWS Signature V4 implementation
// against the real Cloudflare R2 endpoint, without needing Supabase creds.
//
// Tests upload → signed URL → download → exists → delete for each R2 bucket.
//
// Usage:
//   deno run -A --env-file=.env.local scripts/test-r2-standalone.ts

import { getStorageProvider, type BucketName } from "../supabase/functions/_shared/storage.ts";

Deno.env.set("STORAGE_PROVIDER", "r2");
const r2 = getStorageProvider();

const buckets: BucketName[] = ["tracks", "covers", "stems", "watermarked", "documents"];
let failures = 0;

for (const bucket of buckets) {
  const key = `parity-test/${Date.now()}-${crypto.randomUUID()}.bin`;
  const payload = crypto.getRandomValues(new Uint8Array(2048));
  console.log(`\n=== bucket=${bucket} key=${key} ===`);

  // 1. exists() before upload should be false
  try {
    const e0 = await r2.exists(bucket, key);
    if (e0) {
      console.error("❌ exists() pre-upload returned true unexpectedly");
      failures++;
    } else {
      console.log("✅ exists() before upload: false");
    }
  } catch (e) {
    console.error("❌ exists() pre-upload threw:", e instanceof Error ? e.message : e);
    failures++;
  }

  // 2. upload
  try {
    await r2.upload(bucket, key, payload, "application/octet-stream");
    console.log("✅ upload ok (" + payload.byteLength + "B)");
  } catch (e) {
    console.error("❌ upload failed:", e instanceof Error ? e.message : e);
    failures++;
    continue;
  }

  // 3. exists() after upload
  try {
    const e1 = await r2.exists(bucket, key);
    if (!e1) {
      console.error("❌ exists() after upload returned false");
      failures++;
    } else {
      console.log("✅ exists() after upload: true");
    }
  } catch (e) {
    console.error("❌ exists() post-upload threw:", e instanceof Error ? e.message : e);
    failures++;
  }

  // 4. createSignedUrl + GET via fetch
  try {
    const signedUrl = await r2.createSignedUrl(bucket, key, 60);
    if (!signedUrl.includes("X-Amz-Signature=")) {
      console.error("❌ signed URL malformed:", signedUrl.substring(0, 120));
      failures++;
    } else {
      const res = await fetch(signedUrl);
      if (!res.ok) {
        console.error(`❌ GET signed URL failed: status=${res.status}`);
        failures++;
      } else {
        const got = new Uint8Array(await res.arrayBuffer());
        let same = got.byteLength === payload.byteLength;
        if (same) {
          for (let i = 0; i < got.byteLength; i++) {
            if (got[i] !== payload[i]) {
              same = false;
              break;
            }
          }
        }
        console.log(same ? "✅ signed URL GET bytes match payload" : "❌ bytes mismatch");
        if (!same) failures++;
      }
    }
  } catch (e) {
    console.error("❌ signed URL test threw:", e instanceof Error ? e.message : e);
    failures++;
  }

  // 5. download (server-side)
  try {
    const dl = await r2.download(bucket, key);
    let same = dl.byteLength === payload.byteLength;
    if (same) {
      for (let i = 0; i < dl.byteLength; i++) {
        if (dl[i] !== payload[i]) {
          same = false;
          break;
        }
      }
    }
    console.log(same ? "✅ download() bytes match payload" : "❌ download() bytes mismatch");
    if (!same) failures++;
  } catch (e) {
    console.error("❌ download() threw:", e instanceof Error ? e.message : e);
    failures++;
  }

  // 6. delete + exists()=false
  try {
    await r2.delete(bucket, key);
    const e2 = await r2.exists(bucket, key);
    if (e2) {
      console.error("❌ exists() after delete still true");
      failures++;
    } else {
      console.log("✅ delete + exists()=false");
    }
  } catch (e) {
    console.error("❌ delete threw:", e instanceof Error ? e.message : e);
    failures++;
  }
}

console.log("\n--- " + (failures === 0 ? "ALL R2 TESTS PASSED ✅" : `${failures} failures ❌`) + " ---");
Deno.exit(failures === 0 ? 0 : 1);
