// Job worker for the watermark service. Runs ALONGSIDE the HTTP server (index.js)
// and drains the Postgres `jobs` queue for `watermark_encode` jobs, so a bulk
// import no longer blocks on the synchronous /encode round-trip.
//
// It reuses the EXACT same watermark pipeline + SSRF-hardened downloader as
// /encode (injected by index.js via startWorker) — a single source of truth.
//
// Security: never logs the payload's source_url (a signed URL bearer token),
// never logs an API key. Only job id, format, byte count and timings are logged.

const os = require("os");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

const POLL_INTERVAL_MS = 5000; // claim every 5s
const STALE_INTERVAL_MS = 5 * 60 * 1000; // requeue stale jobs every 5 min
const STALE_OLDER_THAN_MIN = 15;
const JOB_TYPE = "watermark_encode";
const MAX_ERROR_LEN = 500;

const SERVICE_NAME = process.env.RAILWAY_SERVICE_NAME || "watermark";
// WORKER_ID traces exactly which instance/process handled a job.
const WORKER_ID = SERVICE_NAME + "-" + os.hostname() + "-" + process.pid;

let deps = null; // { tmpDir, cleanup, downloadToFile, runWatermarkPipeline }
let supabase = null;
let started = false;
let shuttingDown = false;
let processedCount = 0;
let lastJobAt = null;
let loopPromise = null;
let staleTimer = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Validation failures can never succeed on retry (bad payload, SSRF-blocked host,
// unsupported scheme). Everything else (network, tool crash, storage) is transient.
class NonRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = "NonRetryableError";
  }
}

// downloadToFile throws plain Errors; classify its validation reasons (and our own
// NonRetryableError) as non-retryable so the queue doesn't waste retries on them.
const VALIDATION_PATTERNS = [
  "only https",
  "not in allowlist",
  "blocked address",
  "malformed url",
  "too many redirects",
  "must be 32 hex",
  "missing required",
];
function isNonRetryable(err) {
  if (err instanceof NonRetryableError) return true;
  const msg = (err && err.message ? String(err.message) : "").toLowerCase();
  return VALIDATION_PATTERNS.some((p) => msg.includes(p));
}

// Process a single watermark_encode job. Returns the completion result object.
// Always cleans up its temp files (input + delivered) via the finally blocks.
async function processJob(job) {
  const { tmpDir, cleanup, downloadToFile, runWatermarkPipeline } = deps;
  const payload = (job && job.payload) || {};
  const sourceUrl = payload.source_url;
  const payloadHex = payload.payload_hex;
  const outputBucket = payload.output_bucket;
  const outputPath = payload.output_path;

  if (!sourceUrl || !payloadHex || !outputBucket || !outputPath) {
    throw new NonRetryableError("missing required payload fields");
  }
  // Same 128-bit hex payload validation as /encode.
  if (!/^[0-9a-f]{32}$/i.test(payloadHex)) {
    throw new NonRetryableError("payload_hex must be 32 hex chars");
  }

  const inputPath = path.join(tmpDir, uuidv4() + "-job-download");
  const startedAt = Date.now();
  let deliveredPath = null;
  try {
    // SSRF-hardened download — identical validation to the /encode path.
    await downloadToFile(sourceUrl, inputPath);

    const { filePath, format } = await runWatermarkPipeline(inputPath, payloadHex);
    deliveredPath = filePath;

    const buffer = fs.readFileSync(deliveredPath);
    const contentType = format === "wav" ? "audio/wav" : "audio/mpeg";
    const { error: upErr } = await supabase.storage
      .from(outputBucket)
      .upload(outputPath, buffer, { contentType, upsert: true });
    if (upErr) throw new Error("storage upload failed: " + upErr.message);

    return {
      output_path: outputPath,
      format,
      bytes: buffer.length,
      duration_ms: Date.now() - startedAt,
    };
  } finally {
    // cleanup() is idempotent (existsSync-guarded). runWatermarkPipeline already
    // removes inputPath internally on its success/failure paths; this is the
    // owner-of-last-resort for the paths where the pipeline never ran (e.g. a
    // failed download) plus the delivered file, which the pipeline hands back to us.
    cleanup(inputPath);
    if (deliveredPath) cleanup(deliveredPath);
  }
}

// Claim + process at most one job. Fully awaited by the loop, so only ONE audio
// task ever runs at a time (audiowmark + ffmpeg already saturate the CPU).
async function tick() {
  if (shuttingDown) return;

  let jobs;
  try {
    const { data, error } = await supabase.rpc("claim_jobs", {
      _worker_id: WORKER_ID,
      _job_types: [JOB_TYPE],
      _limit: 1,
    });
    if (error) {
      console.error("worker: claim_jobs failed: " + error.message);
      return;
    }
    jobs = data || [];
  } catch (e) {
    console.error("worker: claim_jobs threw: " + (e instanceof Error ? e.message : "unknown"));
    return;
  }

  if (jobs.length === 0) return; // nothing to do — wait for the next tick, no log

  const job = jobs[0];
  try {
    const result = await processJob(job);
    await supabase.rpc("complete_job", { _job_id: job.id, _result: result });
    processedCount += 1;
    lastJobAt = new Date().toISOString();
    console.log(
      "worker: job " + job.id + " completed (format=" + result.format +
      ", bytes=" + result.bytes + ", " + result.duration_ms + "ms)"
    );
  } catch (err) {
    const retry = !isNonRetryable(err);
    const message = (err && err.message ? String(err.message) : "unknown error").slice(0, MAX_ERROR_LEN);
    try {
      await supabase.rpc("fail_job", { _job_id: job.id, _error: message, _retry: retry });
    } catch (fe) {
      console.error("worker: fail_job failed for " + job.id + ": " + (fe instanceof Error ? fe.message : "unknown"));
    }
    console.error("worker: job " + job.id + " failed (retry=" + retry + "): " + message);
  }
}

async function loop() {
  while (!shuttingDown) {
    await tick();
    if (shuttingDown) break;
    await sleep(POLL_INTERVAL_MS);
  }
}

async function requeueStale() {
  if (shuttingDown) return;
  try {
    const { data, error } = await supabase.rpc("requeue_stale_jobs", { _older_than_minutes: STALE_OLDER_THAN_MIN });
    if (error) {
      console.error("worker: requeue_stale_jobs failed: " + error.message);
      return;
    }
    if (data && data > 0) console.log("worker: requeued " + data + " stale job(s)");
  } catch (e) {
    console.error("worker: requeue_stale_jobs threw: " + (e instanceof Error ? e.message : "unknown"));
  }
}

// Start the worker loop. Fail-safe: if the Supabase env is missing, log a warning
// and DON'T start the loop — the HTTP server keeps serving /encode and /decode.
function startWorker(injectedDeps) {
  deps = injectedDeps;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn(
      "worker: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — job worker DISABLED " +
      "(HTTP /encode and /decode still work). Set both to enable the queue worker."
    );
    return false;
  }
  supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  started = true;
  console.log("worker: starting job worker id=" + WORKER_ID);
  loopPromise = loop();
  staleTimer = setInterval(requeueStale, STALE_INTERVAL_MS);
  return true;
}

// Stop claiming new jobs and wait for the in-flight job to finish. Never abandons
// a half-processed job.
async function stopWorker() {
  if (!started) return;
  shuttingDown = true;
  if (staleTimer) {
    clearInterval(staleTimer);
    staleTimer = null;
  }
  if (loopPromise) {
    try {
      await loopPromise;
    } catch (_) {
      // loop() never rejects, but never let shutdown hang on it.
    }
  }
}

function getWorkerStatus() {
  return {
    active: started && !shuttingDown,
    worker_id: started ? WORKER_ID : null,
    processed: processedCount,
    last_job_at: lastJobAt,
  };
}

module.exports = { startWorker, stopWorker, getWorkerStatus, WORKER_ID };
