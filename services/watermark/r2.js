// Cloudflare R2 upload for the worker — a faithful port of the R2StorageProvider
// AWS SigV4 presigned-PUT logic in supabase/functions/_shared/storage.ts, so the
// worker writes to the EXACT same target the Edge Function reads from.
//
// Pure SigV4 over Node's Web Crypto (node:crypto webcrypto) + global fetch — NO
// S3 SDK dependency. Uses the SAME env var names as the Edge Functions:
//   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_<LOGICAL>.
//
// Never logs the secret key or the presigned URL (the URL embeds the signature).

const { webcrypto } = require("node:crypto");
const subtle = webcrypto.subtle;

const SIGV4_ALGO = "AWS4-HMAC-SHA256";
const R2_REGION = "auto";
const R2_SERVICE = "s3";

function getR2Config() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("[storage:r2] Missing R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY");
  }
  return { endpoint: endpoint.replace(/\/+$/, ""), accessKeyId, secretAccessKey };
}

// Map logical bucket name → physical R2 bucket (from env), identical to the EF.
function r2BucketFor(bucket) {
  const envVar = "R2_BUCKET_" + bucket.toUpperCase();
  const physical = process.env[envVar];
  if (!physical) throw new Error("[storage:r2] Missing " + envVar + " env var");
  return physical;
}

function nowAmzDate() {
  const iso = new Date().toISOString();          // 2026-06-08T17:53:12.345Z
  const amzDate = iso.replace(/[:-]|\.\d{3}/g, ""); // 20260608T175312Z
  const dateStamp = amzDate.slice(0, 8);           // 20260608
  return { amzDate, dateStamp };
}

// RFC 3986 encoding (stricter than encodeURIComponent — SigV4 requirement).
function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
function encodeRfc3986Path(p) {
  return p.split("/").map((seg) => encodeRfc3986(seg)).join("/");
}
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message) {
  const hash = await subtle.digest("SHA-256", new TextEncoder().encode(message));
  return bufferToHex(hash);
}

async function hmacSha256Raw(key, message) {
  const keyBuffer = key instanceof ArrayBuffer
    ? key
    : key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength);
  const cryptoKey = await subtle.importKey("raw", keyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function deriveSigningKey(secretKey, dateStamp, region, service) {
  const kDate = await hmacSha256Raw(new TextEncoder().encode("AWS4" + secretKey), dateStamp);
  const kRegion = await hmacSha256Raw(kDate, region);
  const kService = await hmacSha256Raw(kRegion, service);
  return await hmacSha256Raw(kService, "aws4_request");
}

async function presignR2Url(method, bucket, key, expiresInSec) {
  const cfg = getR2Config();
  const physicalBucket = r2BucketFor(bucket);

  const url = new URL(cfg.endpoint);
  const host = url.host;
  const canonicalUri = "/" + physicalBucket + "/" + encodeRfc3986Path(key); // path-style

  const { amzDate, dateStamp } = nowAmzDate();
  const credentialScope = dateStamp + "/" + R2_REGION + "/" + R2_SERVICE + "/aws4_request";
  const credential = cfg.accessKeyId + "/" + credentialScope;

  const queryParams = {
    "X-Amz-Algorithm": SIGV4_ALGO,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSec),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => encodeRfc3986(k) + "=" + encodeRfc3986(queryParams[k]))
    .join("&");

  const canonicalHeaders = "host:" + host + "\n";
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD"; // body isn't part of the signature

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = [SIGV4_ALGO, amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await deriveSigningKey(cfg.secretAccessKey, dateStamp, R2_REGION, R2_SERVICE);
  const signature = bufferToHex(await hmacSha256Raw(signingKey, stringToSign));

  return cfg.endpoint + canonicalUri + "?" + canonicalQuery + "&X-Amz-Signature=" + signature;
}

// Upload a buffer to R2 via a presigned PUT (UNSIGNED-PAYLOAD) — identical to the
// Edge Function's R2StorageProvider.upload. `bucket` is the LOGICAL name
// (e.g. "watermarked"), mapped to the physical R2 bucket via R2_BUCKET_<NAME>.
async function uploadToR2(bucket, key, body, contentType) {
  const url = await presignR2Url("PUT", bucket, key, 600);
  const res = await fetch(url, {
    method: "PUT",
    body: body,
    headers: { "Content-Type": contentType || "application/octet-stream" },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error("[storage:r2] upload PUT failed for " + bucket + "/" + key + ": status=" + res.status + " " + errText.substring(0, 200));
  }
}

module.exports = { uploadToR2 };
