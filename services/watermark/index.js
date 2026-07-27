const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const dns = require("dns").promises;
const net = require("net");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.WATERMARK_API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

// Encode tuning. strength 10 = audiowmark default (inaudible); 320k MP3 avoids the
// 128k pre-echo "ticks". A post-encode verify (audiowmark get on the MP3) guards leak
// tracing: if the mark doesn't survive the lossy pass we fall back to the WAV.
const WM_STRENGTH = "10";
const MP3_BITRATE = "320k";
const WM_DETECT_THRESHOLD = 1.0; // genuine mark ~1.5, clean-file noise ~0.2-0.3
// Three sequential CPU steps (add, ffmpeg, verify). Their inner caps sum below the
// global budget so no single step can starve the others.
const ADD_TIMEOUT_MS = 110000;
const FFMPEG_TIMEOUT_MS = 60000;
const VERIFY_TIMEOUT_MS = 60000;
const ENCODE_GLOBAL_TIMEOUT_MS = 240000;
const DECODE_GLOBAL_TIMEOUT_MS = 120000;
const DECODE_STEP_TIMEOUT_MS = 110000;

// CORS restrictif
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    // Server-to-server callers (the Edge Function) read the delivered format here.
    exposedHeaders: ["X-Watermark-Format"],
  })
);

app.use(express.json());

// Multer — upload tmp, 100MB max
const tmpDir = path.join("/tmp", "watermark-uploads");
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// API key middleware
function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!API_KEY) {
    return res
      .status(500)
      .json({ error: "WATERMARK_API_KEY not configured on server" });
  }
  if (key !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }
  next();
}

// Cleanup helper
function cleanup(...files) {
  for (const f of files) {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch (_) {
      // ignore cleanup errors
    }
  }
}

// Parse audiowmark 0.6.5 "get" output → strongest { payload, confidence }.
// Lines look like: "pattern  0:00 <32-hex-payload> 1.530 0.279 CLIP-B". The 2nd token
// is a timestamp ("0:00") or "all", NOT a bit count. Shared by /decode and the
// /encode post-encode verification (single source of truth for the parser).
function parseWatermark(stdout) {
  const lines = (stdout || "").trim().split("\n");
  let payload = null;
  let confidence = 0;
  for (const line of lines) {
    const match = line.match(/^pattern\s+\S+\s+([0-9a-f]{32})\s+([\d.]+)/i);
    if (match) {
      const score = parseFloat(match[2]);
      if (score > confidence) {
        confidence = score;
        payload = match[1].toLowerCase();
      }
    }
  }
  return { payload, confidence };
}

// ── SSRF-hardened source_url download ────────────────────────────────────────
// source_url is attacker-influenceable, so downloads are locked down: HTTPS only,
// an EXACT-match host allowlist (fail closed — an empty allowlist refuses every
// URL and forces file upload), per-resolved-IP checks against private / loopback /
// link-local / CGNAT / ULA ranges, the connection pinned to the validated IP
// (defeats DNS rebinding between check and connect), bounded redirects that are
// each fully re-validated, and hard size / time caps. The req.file upload path is
// completely unaffected.
const ALLOWED_HOSTS = new Set(
  (process.env.WATERMARK_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
);
const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // aligned with the multer upload limit
const CONNECT_TIMEOUT_MS = 15000;
const DOWNLOAD_TIMEOUT_MS = 120000;
const MAX_REDIRECTS = 2;

function ipv4ToInt(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const o = Number(p);
    if (o > 255) return null;
    n = n * 256 + o;
  }
  return n >>> 0;
}
function inCidr4(intIp, baseStr, bits) {
  const base = ipv4ToInt(baseStr);
  if (base === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (intIp & mask) === (base & mask);
}
function isBlockedIpv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → block (fail closed)
  return [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10], // CGNAT
    ["127.0.0.0", 8], // loopback
    ["169.254.0.0", 16], // link-local incl. 169.254.169.254 (cloud metadata)
    ["172.16.0.0", 12],
    ["192.168.0.0", 16],
  ].some(([b, bits]) => inCidr4(n, b, bits));
}
function expandIpv6(addr) {
  let a = addr;
  const pct = a.indexOf("%");
  if (pct !== -1) a = a.slice(0, pct); // strip zone id
  if (a.indexOf("::") !== -1) {
    const [head, tail] = a.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const missing = 8 - (h.length + t.length);
    if (missing < 0) return null;
    a = [...h, ...Array(missing).fill("0"), ...t].join(":");
  }
  const parts = a.split(":");
  if (parts.length !== 8) return null;
  const groups = [];
  for (const p of parts) {
    if (!/^[0-9a-f]{1,4}$/i.test(p)) return null;
    groups.push(parseInt(p, 16));
  }
  return groups;
}
function isBlockedIpv6(ip) {
  let a = ip;
  const pct = a.indexOf("%");
  if (pct !== -1) a = a.slice(0, pct);
  const lower = a.toLowerCase();
  // IPv4-mapped / -compatible (::ffff:a.b.c.d or ::a.b.c.d) → check the IPv4.
  const v4 = lower.match(/(?:::ffff:|::)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (v4) return isBlockedIpv4(v4[1]);
  const g = expandIpv6(lower);
  if (!g) return true; // unparseable → block
  if (g.slice(0, 7).every((x) => x === 0) && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  return false;
}
function isBlockedIp(address, family) {
  if (family === 4 || net.isIPv4(address)) return isBlockedIpv4(address);
  if (family === 6 || net.isIPv6(address)) return isBlockedIpv6(address);
  return true; // unknown → block
}

// Parse + enforce scheme and the exact-match host allowlist. Throws on violation.
function validateSourceUrl(urlString) {
  let u;
  try {
    u = new URL(urlString);
  } catch (_) {
    throw new Error("malformed url");
  }
  if (u.protocol !== "https:") throw new Error("only https is allowed");
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) throw new Error("host not in allowlist");
  return u;
}

// Resolve EVERY A/AAAA record and reject if ANY is a blocked address. Returns the
// first record so the connection can be pinned to an already-validated IP.
async function resolveSafeIp(hostname) {
  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) throw new Error("no dns records");
  for (const r of records) {
    if (isBlockedIp(r.address, r.family)) throw new Error("resolves to a blocked address");
  }
  return records[0];
}

// One bounded HTTPS GET, connecting to the pre-validated IP (anti DNS-rebinding)
// while keeping TLS/SNI + Host on the real hostname. Resolves { redirect, location }
// for a 3xx, or writes the body to destPath under a hard size cap.
function fetchOnceToFile(u, ip, family, destPath) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let globalTimer;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(globalTimer);
      fn(arg);
    };

    // Pass the real URL (Node derives Host / SNI / cert validation from the
    // hostname and handles IPv6 correctly), but PIN DNS resolution to the
    // already-validated IP via a custom lookup so the connection can never
    // re-resolve to a different address between check and connect (anti-rebinding).
    const request = https.request(
      u,
      {
        method: "GET",
        timeout: CONNECT_TIMEOUT_MS,
        lookup: (_hostname, opts, cb) =>
          opts && opts.all ? cb(null, [{ address: ip, family }]) : cb(null, ip, family),
      },
      (response) => {
        const status = response.statusCode || 0;
        if (status >= 300 && status < 400 && response.headers.location) {
          response.resume(); // drain, never write a redirect body
          request.destroy();
          return done(resolve, { redirect: true, location: response.headers.location });
        }
        if (status !== 200) {
          response.resume();
          request.destroy();
          return done(reject, new Error("status " + status));
        }
        const file = fs.createWriteStream(destPath);
        let downloaded = 0;
        const fail = (err) => {
          response.unpipe(file);
          response.destroy();
          file.destroy();
          request.destroy();
          cleanup(destPath);
          done(reject, err);
        };
        response.on("data", (chunk) => {
          downloaded += chunk.length;
          if (downloaded > MAX_DOWNLOAD_BYTES) fail(new Error("download exceeds size limit"));
        });
        response.pipe(file);
        file.on("finish", () => file.close(() => done(resolve, { redirect: false })));
        file.on("error", (err) => fail(err));
        response.on("error", (err) => fail(err));
      }
    );

    globalTimer = setTimeout(() => request.destroy(new Error("download timeout")), DOWNLOAD_TIMEOUT_MS);
    request.on("timeout", () => request.destroy(new Error("connection timeout")));
    request.on("error", (err) => { cleanup(destPath); done(reject, err); });
    request.end();
  });
}

// Public entry point used by /encode — same signature as before. Each redirect hop
// is fully re-validated (allowlist + https + IP checks), so a naive allowlist can't
// be bypassed by redirecting to an internal or non-allowlisted host.
async function downloadToFile(sourceUrl, destPath) {
  let current = sourceUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = validateSourceUrl(current);
    const { address, family } = await resolveSafeIp(u.hostname);
    const result = await fetchOnceToFile(u, address, family, destPath);
    if (!result.redirect) return;
    // Resolve a possibly-relative Location against the current URL, then loop to
    // re-validate the destination from scratch.
    current = new URL(result.location, u).toString();
  }
  throw new Error("too many redirects");
}

// POST /encode
app.post(
  "/encode",
  requireApiKey,
  upload.single("audio"),
  async (req, res) => {
    const payload = req.body.payload;
    const sourceUrl = req.body.source_url;

    // Determine input: uploaded file or download from source_url
    let inputPath = null;
    let downloadedFile = false;

    if (req.file) {
      inputPath = req.file.path;
    } else if (sourceUrl) {
      inputPath = path.join(tmpDir, `${uuidv4()}-download`);
      downloadedFile = true;
      try {
        await downloadToFile(sourceUrl, inputPath);
      } catch (err) {
        cleanup(inputPath);
        // Generic to the client; the reason (blocked host/IP, scheme, size, …)
        // stays server-side so we never leak internal network topology.
        console.error("encode: source_url rejected: " + (err instanceof Error ? err.message : "unknown"));
        return res.status(400).json({ error: "Invalid source URL" });
      }
    } else {
      return res.status(400).json({ error: "No audio file or source_url provided" });
    }

    if (!payload) {
      cleanup(inputPath);
      return res.status(400).json({ error: "No payload provided" });
    }

    // audiowmark expects a 128-bit hex payload (32 hex chars)
    if (!/^[0-9a-f]{32}$/i.test(payload)) {
      cleanup(inputPath);
      return res.status(400).json({ error: "Payload must be a 128-bit hex string (32 hex chars)" });
    }

    const outputPath = path.join(tmpDir, `${uuidv4()}.wav`);
    const mp3Path = path.join(tmpDir, `${uuidv4()}.mp3`);

    // Three sequential CPU-bound steps run (audiowmark add, ffmpeg, audiowmark get).
    // The global budget covers all three; the timeout cleans every temp artifact.
    const timeout = setTimeout(() => {
      cleanup(inputPath, outputPath, mp3Path);
      if (!res.headersSent) {
        res.status(504).json({ error: "Processing timeout" });
      }
    }, ENCODE_GLOBAL_TIMEOUT_MS);

    // Step 1: embed the watermark (WAV master untouched; we work on a copy).
    // strength 10 = audiowmark default — inaudible; the post-encode verify below
    // confirms it survives the lossy MP3 pass before we ship the smaller file.
    execFile(
      "audiowmark",
      ["add", "--strength", WM_STRENGTH, inputPath, outputPath, payload],
      { timeout: ADD_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          clearTimeout(timeout);
          cleanup(inputPath, outputPath, mp3Path);
          return res
            .status(500)
            .json({ error: "Watermark encoding failed", details: stderr });
        }

        // Step 2: encode the delivery copy to MP3 320k CBR (~4x smaller than WAV, no
        // 128k pre-echo). Keep the watermarked WAV as a fallback until the verify passes.
        execFile(
          "ffmpeg",
          ["-i", outputPath, "-c:a", "libmp3lame", "-b:a", MP3_BITRATE, "-y", mp3Path],
          { timeout: FFMPEG_TIMEOUT_MS },
          (ffError, ffStdout, ffStderr) => {
            // Input no longer needed; keep outputPath (WAV) + mp3Path until we pick one.
            cleanup(inputPath);

            if (res.headersSent) { // global timeout already responded (504)
              clearTimeout(timeout);
              cleanup(outputPath, mp3Path);
              return;
            }
            if (ffError) {
              clearTimeout(timeout);
              cleanup(outputPath, mp3Path);
              return res
                .status(500)
                .json({ error: "MP3 encoding failed", details: ffStderr });
            }

            // Step 3: verify the watermark still decodes from the MP3. If it does,
            // ship the small MP3; otherwise fall back to the watermarked WAV so leak
            // tracing NEVER silently breaks.
            execFile(
              "audiowmark",
              ["get", mp3Path],
              { timeout: VERIFY_TIMEOUT_MS },
              (vError, vStdout) => {
                clearTimeout(timeout);
                if (res.headersSent) { // global timeout already responded (504)
                  cleanup(outputPath, mp3Path);
                  return;
                }

                const { payload: detected, confidence } = vError
                  ? { payload: null, confidence: 0 }
                  : parseWatermark(vStdout);
                const mp3Ok = !!detected
                  && confidence >= WM_DETECT_THRESHOLD
                  && detected.toLowerCase() === payload.toLowerCase();

                if (mp3Ok) {
                  cleanup(outputPath); // drop the WAV fallback
                  res.set("X-Watermark-Format", "mp3");
                  res.download(mp3Path, "watermarked.mp3", () => cleanup(mp3Path));
                } else {
                  // Fallback: the MP3 lost the watermark — serve the watermarked WAV so
                  // the payload is still traceable. Loud log so this never hides silently.
                  console.warn(
                    "encode: MP3 watermark verify FAILED (confidence=" + confidence +
                    ", detected=" + (detected ? detected.substring(0, 8) : "none") +
                    ", expected=" + payload.substring(0, 8) + ") — falling back to WAV"
                  );
                  cleanup(mp3Path); // drop the unusable MP3
                  res.set("X-Watermark-Format", "wav");
                  res.download(outputPath, "watermarked.wav", () => cleanup(outputPath));
                }
              }
            );
          }
        );
      }
    );
  }
);

// POST /decode
app.post(
  "/decode",
  requireApiKey,
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const inputPath = req.file.path;

    const timeout = setTimeout(() => {
      cleanup(inputPath);
      if (!res.headersSent) {
        res.status(504).json({ error: "Processing timeout" });
      }
    }, DECODE_GLOBAL_TIMEOUT_MS);

    execFile(
      "audiowmark",
      ["get", inputPath],
      { timeout: DECODE_STEP_TIMEOUT_MS },
      (error, stdout, stderr) => {
        clearTimeout(timeout);
        cleanup(inputPath);

        if (error) {
          return res
            .status(500)
            .json({ error: "Watermark decoding failed", details: stderr });
        }

        const { payload, confidence } = parseWatermark(stdout);

        // A genuine watermark scores ~1.5; clean-file noise sits around 0.2-0.3.
        // Require >= threshold to count as detected, avoiding false positives.
        if (!payload || confidence < WM_DETECT_THRESHOLD) {
          return res.json({ payload: null, confidence: 0, message: "No watermark detected" });
        }

        res.json({ payload, confidence });
      }
    );
  }
);

// GET /health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

app.listen(PORT, () => {
  console.log(`Watermark service running on port ${PORT}`);
});
