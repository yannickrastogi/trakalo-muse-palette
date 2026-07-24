const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

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

// Download a file from URL to a local path
function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    proto.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return downloadToFile(response.headers.location, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${response.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", (err) => { fs.unlinkSync(destPath); reject(err); });
    }).on("error", reject);
  });
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
        return res.status(400).json({ error: "Failed to download source_url", details: err.message });
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
