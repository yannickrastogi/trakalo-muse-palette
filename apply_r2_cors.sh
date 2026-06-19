#!/usr/bin/env bash
set -euo pipefail
cat > cors.json <<'JSON'
{
  "rules": [
    {
      "allowed": {
        "origins": [
          "https://app.trakalog.com",
          "https://trakalog.com",
          "https://www.trakalog.com",
          "https://admin.trakalog.com",
          "https://localhost:5173",
          "http://localhost:5173",
          "http://localhost:3000",
          "http://localhost:8080"
        ],
        "methods": ["GET", "HEAD", "PUT"],
        "headers": ["range", "content-type", "authorization", "x-upsert", "cache-control"]
      },
      "exposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"],
      "maxAgeSeconds": 3600
    }
  ]
}
JSON

BUCKETS=(trakalog-tracks trakalog-watermarked trakalog-stems trakalog-covers trakalog-documents)
for b in "${BUCKETS[@]}"; do
  echo "== set CORS → ${b} =="
  npx wrangler r2 bucket cors set "${b}" --file cors.json
done

for b in "${BUCKETS[@]}"; do
  echo "== CORS actuel sur ${b} =="
  npx wrangler r2 bucket cors list "${b}"
done
