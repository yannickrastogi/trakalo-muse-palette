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

// Promise wrapper for execFile
function execFileP(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        return reject(error);
      }
      resolve({ stdout, stderr });
    });
  });
}

// Parse audiowmark "get" output to extract first detected payload (hex string)
function parseAudiowmarkPayload(stdout) {
  const lines = stdout.trim().split("\n");
  for (const line of lines) {
    const match = line.match(/^pattern\s+\d+\s+(\S+)\s+([\d.]+)/);
    if (match) return match[1];
  }
  const trimmed = stdout.trim();
  return /^[0-9a-f]{32}$/i.test(trimmed) ? trimmed : null;
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

    const wavOutputPath = path.join(tmpDir, `${uuidv4()}.wav`);
    const mp3OutputPath = path.join(tmpDir, `${uuidv4()}.mp3`);

    const timeout = setTimeout(() => {
      cleanup(inputPath, wavOutputPath, mp3OutputPath);
      if (!res.headersSent) {
        res.status(504).json({ error: "Processing timeout" });
      }
    }, 120000);

    try {
      // 1. audiowmark add → WAV watermarked
      await execFileP("audiowmark", ["add", inputPath, wavOutputPath, payload], { timeout: 80000 });
    } catch (error) {
      clearTimeout(timeout);
      cleanup(inputPath, wavOutputPath, mp3OutputPath);
      return res.status(500).json({
        error: "Watermark encoding failed",
        details: error.stderr || error.message,
      });
    }

    // Source no longer needed
    cleanup(inputPath);

    // 2. Re-encode WAV → MP3 192 kbps (libmp3lame). On failure, fallback to WAV.
    let useMp3 = false;
    try {
      await execFileP(
        "ffmpeg",
        ["-i", wavOutputPath, "-c:a", "libmp3lame", "-b:a", "192k", "-y", mp3OutputPath],
        { timeout: 40000 }
      );

      // 3. CRITICAL — Validate watermark survives MP3 compression
      const { stdout } = await execFileP("audiowmark", ["get", mp3OutputPath], { timeout: 30000 });
      const detected = parseAudiowmarkPayload(stdout);

      if (!detected || detected.toLowerCase() !== payload.toLowerCase()) {
        // Validation failed → log and fallback to WAV
        console.error(
          `[watermark] MP3 validation FAILED — expected=${payload.substring(0, 8)}..., detected=${
            detected ? detected.substring(0, 8) + "..." : "none"
          }. Falling back to WAV.`
        );
        cleanup(mp3OutputPath);
      } else {
        useMp3 = true;
      }
    } catch (mp3Err) {
      console.error(`[watermark] MP3 encode/validate error: ${mp3Err.message}. Falling back to WAV.`);
      cleanup(mp3OutputPath);
    }

    clearTimeout(timeout);

    if (useMp3) {
      // res.download will set Content-Type from .mp3 filename
      res.setHeader("X-Watermark-Format", "mp3");
      res.setHeader("Access-Control-Expose-Headers", "X-Watermark-Format");
      return res.download(mp3OutputPath, "watermarked.mp3", () => {
        cleanup(wavOutputPath, mp3OutputPath);
      });
    }

    // Fallback path — WAV output (legacy compat)
    res.setHeader("X-Watermark-Format", "wav");
    res.setHeader("Access-Control-Expose-Headers", "X-Watermark-Format");
    return res.download(wavOutputPath, "watermarked.wav", () => {
      cleanup(wavOutputPath);
    });
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

        // Parse audiowmark output
        // audiowmark get outputs lines like: "pattern <bit_count> <payload> <confidence>"
        const lines = stdout.trim().split("\n");
        let payload = null;
        let confidence = 0;

        for (const line of lines) {
          const match = line.match(/^pattern\s+\d+\s+(\S+)\s+([\d.]+)/);
          if (match) {
            payload = match[1];
            confidence = parseFloat(match[2]);
            break;
          }
        }

        if (!payload) {
          // Try raw output as fallback
          const trimmed = stdout.trim();
          if (trimmed) {
            return res.json({ payload: trimmed, confidence: null, raw: true });
          }
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
