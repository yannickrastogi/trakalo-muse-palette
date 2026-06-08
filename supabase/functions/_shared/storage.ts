// Storage abstraction layer for Trakalog.
// Allows switching between Supabase Storage and Cloudflare R2 via STORAGE_PROVIDER env var.
//
// Default: STORAGE_PROVIDER=supabase (zero regression).
// To switch to R2: supabase secrets set STORAGE_PROVIDER=r2 + redeploy.
//
// Buckets are addressed by their *logical* name ("tracks", "stems", "watermarked",
// "covers", "documents"). The R2 provider maps logical → physical bucket via env vars
// (R2_BUCKET_TRACKS, etc.). The Supabase provider passes the logical name as-is.
//
// All signed URLs default to 300s (5 min) to match Trakalog's DRM posture.
//
// Deno runtime — uses Web Crypto API for V4 signing, no npm deps.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export type BucketName =
  | "tracks"
  | "stems"
  | "watermarked"
  | "covers"
  | "documents";

export interface StorageProvider {
  /** Génère une signed URL courte pour lecture protégée (GET). Default expires: 300s. */
  createSignedUrl(
    bucket: BucketName,
    key: string,
    expiresInSec?: number,
  ): Promise<string>;

  /** Upload un fichier (server-side, utilisé par get-watermarked-audio etc.). */
  upload(
    bucket: BucketName,
    key: string,
    body: Uint8Array | ArrayBuffer | Blob,
    contentType?: string,
  ): Promise<void>;

  /** Download un fichier (server-side). */
  download(bucket: BucketName, key: string): Promise<Uint8Array>;

  /** Supprime un objet. */
  delete(bucket: BucketName, key: string): Promise<void>;

  /** Vérifie l'existence d'un objet via HEAD. */
  exists(bucket: BucketName, key: string): Promise<boolean>;

  /** Identifier the provider for logging / monitoring. */
  readonly name: "supabase" | "r2";
}

/** Factory — returns the active provider based on STORAGE_PROVIDER env var. */
export function getStorageProvider(): StorageProvider {
  const provider = (Deno.env.get("STORAGE_PROVIDER") || "supabase").toLowerCase();
  if (provider === "r2") {
    return new R2StorageProvider();
  }
  return new SupabaseStorageProvider();
}

// -----------------------------------------------------------------------------
// Supabase Storage provider (default, zero regression)
// -----------------------------------------------------------------------------

class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase" as const;
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }

  async createSignedUrl(
    bucket: BucketName,
    key: string,
    expiresInSec = 300,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(key, expiresInSec);
    if (error || !data?.signedUrl) {
      throw new Error(
        `[storage:supabase] createSignedUrl failed for ${bucket}/${key}: ${error?.message ?? "no signed URL returned"}`,
      );
    }
    return data.signedUrl;
  }

  async upload(
    bucket: BucketName,
    key: string,
    body: Uint8Array | ArrayBuffer | Blob,
    contentType?: string,
  ): Promise<void> {
    const { error } = await this.client.storage.from(bucket).upload(key, body, {
      contentType: contentType ?? "application/octet-stream",
      upsert: false,
    });
    if (error) {
      throw new Error(
        `[storage:supabase] upload failed for ${bucket}/${key}: ${error.message}`,
      );
    }
  }

  async download(bucket: BucketName, key: string): Promise<Uint8Array> {
    const { data, error } = await this.client.storage.from(bucket).download(key);
    if (error || !data) {
      throw new Error(
        `[storage:supabase] download failed for ${bucket}/${key}: ${error?.message ?? "no data"}`,
      );
    }
    return new Uint8Array(await data.arrayBuffer());
  }

  async delete(bucket: BucketName, key: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([key]);
    if (error) {
      throw new Error(
        `[storage:supabase] delete failed for ${bucket}/${key}: ${error.message}`,
      );
    }
  }

  async exists(bucket: BucketName, key: string): Promise<boolean> {
    // Supabase Storage has no native HEAD; createSignedUrl returns an error when
    // the object is missing. A 60s URL is cheap and short-lived.
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(key, 60);
    return !error && !!data?.signedUrl;
  }
}

// -----------------------------------------------------------------------------
// Cloudflare R2 provider (S3-compatible, AWS Signature V4)
// -----------------------------------------------------------------------------

interface R2Config {
  endpoint: string;        // https://<account>.r2.cloudflarestorage.com (no trailing slash)
  accessKeyId: string;
  secretAccessKey: string;
}

function getR2Config(): R2Config {
  const endpoint = Deno.env.get("R2_ENDPOINT");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "[storage:r2] Missing R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY",
    );
  }
  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    accessKeyId,
    secretAccessKey,
  };
}

/** Map logical bucket name → physical R2 bucket name (from env). */
function r2BucketFor(bucket: BucketName): string {
  const envVar = `R2_BUCKET_${bucket.toUpperCase()}`;
  const physical = Deno.env.get(envVar);
  if (!physical) {
    throw new Error(`[storage:r2] Missing ${envVar} env var`);
  }
  return physical;
}

class R2StorageProvider implements StorageProvider {
  readonly name = "r2" as const;

  async createSignedUrl(
    bucket: BucketName,
    key: string,
    expiresInSec = 300,
  ): Promise<string> {
    return await presignR2Url("GET", bucket, key, expiresInSec);
  }

  async upload(
    bucket: BucketName,
    key: string,
    body: Uint8Array | ArrayBuffer | Blob,
    contentType?: string,
  ): Promise<void> {
    // Use a presigned PUT URL with UNSIGNED-PAYLOAD: avoids hashing the body
    // up-front (important for large audio files). R2 accepts unsigned payload
    // on presigned PUT just like S3.
    const url = await presignR2Url("PUT", bucket, key, 600);
    // Normalize body to a Blob — strict TS rejects bare ArrayBufferLike,
    // so we slice into a fresh standard ArrayBuffer first.
    const fetchBody: Blob = body instanceof Blob ? body : new Blob([toStdArrayBuffer(body)]);
    const res = await fetch(url, {
      method: "PUT",
      body: fetchBody,
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
      },
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `[storage:r2] upload PUT failed for ${bucket}/${key}: status=${res.status} ${errText.substring(0, 200)}`,
      );
    }
  }

  async download(bucket: BucketName, key: string): Promise<Uint8Array> {
    const url = await presignR2Url("GET", bucket, key, 300);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `[storage:r2] download failed for ${bucket}/${key}: status=${res.status}`,
      );
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  async delete(bucket: BucketName, key: string): Promise<void> {
    const url = await presignR2Url("DELETE", bucket, key, 300);
    const res = await fetch(url, { method: "DELETE" });
    // R2 returns 204 on success, 404 if missing — treat 404 as success.
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `[storage:r2] delete failed for ${bucket}/${key}: status=${res.status}`,
      );
    }
  }

  async exists(bucket: BucketName, key: string): Promise<boolean> {
    const url = await presignR2Url("HEAD", bucket, key, 60);
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  }
}

// -----------------------------------------------------------------------------
// AWS Signature V4 (presigned URL flavor) — pure Deno, Web Crypto API only.
// Spec: https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html
// -----------------------------------------------------------------------------

const SIGV4_ALGO = "AWS4-HMAC-SHA256";
const R2_REGION = "auto";
const R2_SERVICE = "s3";

async function presignR2Url(
  method: "GET" | "PUT" | "DELETE" | "HEAD",
  bucket: BucketName,
  key: string,
  expiresInSec: number,
): Promise<string> {
  const cfg = getR2Config();
  const physicalBucket = r2BucketFor(bucket);

  const url = new URL(cfg.endpoint);
  const host = url.host;
  // Path-style addressing: /{bucket}/{key}
  const canonicalUri = `/${physicalBucket}/${encodeRfc3986Path(key)}`;

  const { amzDate, dateStamp } = nowAmzDate();
  const credentialScope = `${dateStamp}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const credential = `${cfg.accessKeyId}/${credentialScope}`;

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": SIGV4_ALGO,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSec),
    "X-Amz-SignedHeaders": "host",
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map(
      (k) =>
        `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`,
    )
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  // Presigned URLs use UNSIGNED-PAYLOAD so the body isn't part of the signature.
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    SIGV4_ALGO,
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  const signingKey = await deriveSigningKey(
    cfg.secretAccessKey,
    dateStamp,
    R2_REGION,
    R2_SERVICE,
  );
  const signatureBuf = await hmacSha256Raw(signingKey, stringToSign);
  const signature = bufferToHex(signatureBuf);

  return `${cfg.endpoint}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function nowAmzDate(): { amzDate: string; dateStamp: string } {
  const iso = new Date().toISOString();          // 2026-06-08T17:53:12.345Z
  const amzDate = iso.replace(/[:-]|\.\d{3}/g, ""); // 20260608T175312Z
  const dateStamp = amzDate.slice(0, 8);           // 20260608
  return { amzDate, dateStamp };
}

/** Encode per RFC 3986 (stricter than encodeURIComponent — see SigV4 spec). */
function encodeRfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Encode a path while preserving slashes (each segment encoded individually). */
function encodeRfc3986Path(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeRfc3986(seg))
    .join("/");
}

async function sha256Hex(message: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(message),
  );
  return bufferToHex(hash);
}

async function hmacSha256Raw(
  key: ArrayBuffer | Uint8Array,
  message: string,
): Promise<ArrayBuffer> {
  // Normalize to a standard ArrayBuffer — strict TS rejects ArrayBufferLike / SharedArrayBuffer.
  const keyBuffer: ArrayBuffer = key instanceof ArrayBuffer
    ? key
    : (key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.byteLength,
      ) as ArrayBuffer);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(message),
  );
}

async function deriveSigningKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256Raw(
    new TextEncoder().encode(`AWS4${secretKey}`),
    dateStamp,
  );
  const kRegion = await hmacSha256Raw(kDate, region);
  const kService = await hmacSha256Raw(kRegion, service);
  const kSigning = await hmacSha256Raw(kService, "aws4_request");
  return kSigning;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Normalize Uint8Array / ArrayBuffer to a standard ArrayBuffer (strips
 *  ArrayBufferLike / SharedArrayBuffer that TS 6.0 strict refuses to accept). */
function toStdArrayBuffer(src: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (src instanceof ArrayBuffer) return src;
  return src.buffer.slice(
    src.byteOffset,
    src.byteOffset + src.byteLength,
  ) as ArrayBuffer;
}
