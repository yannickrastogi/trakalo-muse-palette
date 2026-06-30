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

    // Two sequential CPU-bound steps now run (audiowmark add, then ffmpeg),
    // each with its own 110s inner limit — the global budget must cover both.
    const timeout = setTimeout(() => {
      cleanup(inputPath, outputPath, mp3Path);
      if (!res.headersSent) {
        res.status(504).json({ error: "Processing timeout" });
      }
    }, 240000);

    // Step 1: embed the watermark (WAV master stays untouched; we work on a copy).
    // strength 12 survives lossy compression (MP3/Opus/AAC 128k) — verified on Ubuntu 24.04.
    execFile(
      "audiowmark",
      ["add", "--strength", "12", inputPath, outputPath, payload],
      { timeout: 110000 },
      (error, stdout, stderr) => {
        if (error) {
          clearTimeout(timeout);
          cleanup(inputPath, outputPath, mp3Path);
          return res
            .status(500)
            .json({ error: "Watermark encoding failed", details: stderr });
        }

        // Step 2: encode the delivery copy to MP3 128k CBR (~10-15x smaller than WAV).
        // The watermark survives this lossy pass; trace-leak decodes the MP3 fine.
        execFile(
          "ffmpeg",
          ["-i", outputPath, "-c:a", "libmp3lame", "-b:a", "128k", "-y", mp3Path],
          { timeout: 110000 },
          (ffError, ffStdout, ffStderr) => {
            clearTimeout(timeout);
            // The watermarked WAV is a temp artifact — drop it now, keep only the MP3.
            cleanup(inputPath, outputPath);

            // The global timeout may have already responded (504) — never respond twice.
            if (res.headersSent) {
              cleanup(mp3Path);
              return;
            }

            if (ffError) {
              cleanup(mp3Path);
              return res
                .status(500)
                .json({ error: "MP3 encoding failed", details: ffStderr });
            }

            res.download(mp3Path, "watermarked.mp3", () => {
              cleanup(mp3Path);
            });
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
    }, 120000);

    execFile(
      "audiowmark",
      ["get", inputPath],
      { timeout: 110000 },
      (error, stdout, stderr) => {
        clearTimeout(timeout);
        cleanup(inputPath);

        if (error) {
          return res
            .status(500)
            .json({ error: "Watermark decoding failed", details: stderr });
        }

        // Parse audiowmark 0.6.5 output. Lines look like:
        //   "pattern  0:00 <32-hex-payload> 1.530 0.279 CLIP-B"
        //   "pattern   all <32-hex-payload> 1.234 ..."
        // The 2nd token is a timestamp ("0:00") or "all" — NOT a bit count — so the
        // old /^pattern\s+\d+.../ regex never matched. Capture the 32-hex payload and
        // the first float score regardless of that token.
        const lines = stdout.trim().split("\n");
        let payload = null;
        let confidence = 0;

        for (const line of lines) {
          const match = line.match(/^pattern\s+\S+\s+([0-9a-f]{32})\s+([\d.]+)/i);
          if (match) {
            const score = parseFloat(match[2]);
            // Keep the strongest detection across all lines.
            if (score > confidence) {
              confidence = score;
              payload = match[1].toLowerCase();
            }
          }
        }

        // A genuine watermark scores ~1.5; clean-file noise sits around 0.2-0.3.
        // Require >= 1.0 to count as detected, avoiding false positives on clean audio.
        if (!payload || confidence < 1.0) {
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
