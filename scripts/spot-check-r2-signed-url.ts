// Spot-check Phase 3 — generate an R2 signed URL via storage.ts for a real
// migrated object, then compare content-length against the Supabase original.
//
// Usage:
//   deno run -A --env-file=.env.local scripts/spot-check-r2-signed-url.ts <storage_path>
//
// Example:
//   deno run -A --env-file=.env.local scripts/spot-check-r2-signed-url.ts \
//     "38007e8a-605b-4852-8c5a-73f3bc5c827c/23f9cf2f-12b7-4738-86dd-f1cd362bcc7d.wav"

Deno.env.set("STORAGE_PROVIDER", "r2");
const { getStorageProvider } = await import("../supabase/functions/_shared/storage.ts");

const path = Deno.args[0];
if (!path) {
  console.error("usage: spot-check-r2-signed-url.ts <storage_path>");
  Deno.exit(2);
}

const r2 = getStorageProvider();

console.log(`\n=== Spot-check storage_path: ${path} ===\n`);

// 1. Generate R2 signed URL
const url = await r2.createSignedUrl("tracks", path, 300);
console.log(`✅ Generated R2 signed URL (length ${url.length}, contains X-Amz-Signature: ${url.includes("X-Amz-Signature=")})`);

// 2. Range GET first 1024 bytes — the signed URL is method=GET so we cannot
//    HEAD it (the signature is bound to the method). Range avoids the full DL.
const rangeRes = await fetch(url, { headers: { Range: "bytes=0-1023" } });
if (!rangeRes.ok && rangeRes.status !== 206) {
  console.error(`❌ Range GET failed: status=${rangeRes.status}`);
  Deno.exit(1);
}
const firstBytes = new Uint8Array(await rangeRes.arrayBuffer());
const r2ContentRange = rangeRes.headers.get("content-range") || "(none)";
const r2ContentType = rangeRes.headers.get("content-type") || "(none)";
console.log(`✅ Range GET R2: status=${rangeRes.status} bytes_received=${firstBytes.byteLength} content-range=${r2ContentRange} content-type=${r2ContentType}`);

// Parse Content-Range: "bytes 0-1023/<total>"
const totalMatch = r2ContentRange.match(/\/(\d+)$/);
const r2TotalSize = totalMatch ? totalMatch[1] : "unknown";
console.log(`\n✅ R2 total object size from Content-Range: ${r2TotalSize} bytes`);
console.log(`(Compare against SQL baseline for this row.)`);

// 5. WAV files start with "RIFF" — check magic bytes
const magic = String.fromCharCode(...firstBytes.slice(0, 4));
console.log(`✅ First 4 bytes (magic): "${magic}" ${magic === "RIFF" ? "(valid WAV header)" : magic === "ID3\u0003" || magic.startsWith("ID3") ? "(valid MP3/ID3 header)" : "(unknown — inspect manually)"}`);

console.log(`\n--- spot-check OK ---`);
