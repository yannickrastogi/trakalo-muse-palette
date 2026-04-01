const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

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

// POST /encode
app.post(
  "/encode",
  requireApiKey,
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const payload = req.body.payload;
    if (!payload) {
      cleanup(req.file.path);
      return res.status(400).json({ error: "No payload provided" });
    }

    const inputPath = req.file.path;
    const outputPath = path.join(tmpDir, `${uuidv4()}.wav`);

    const timeout = setTimeout(() => {
      cleanup(inputPath, outputPath);
      if (!res.headersSent) {
        res.status(504).json({ error: "Processing timeout" });
      }
    }, 120000);

    execFile(
      "audiowmark",
      ["add", inputPath, outputPath, payload],
      { timeout: 110000 },
      (error, stdout, stderr) => {
        clearTimeout(timeout);

        if (error) {
          cleanup(inputPath, outputPath);
          return res
            .status(500)
            .json({ error: "Watermark encoding failed", details: stderr });
        }

        res.download(outputPath, "watermarked.wav", () => {
          cleanup(inputPath, outputPath);
        });
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
