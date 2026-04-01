# Trakalog Watermark Service

Audio watermarking service using [audiowmark](https://github.com/swesterfeld/audiowmark).

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /encode | x-api-key | Encode a payload into an audio file |
| POST | /decode | x-api-key | Extract payload from a watermarked audio file |
| GET | /health | none | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WATERMARK_API_KEY` | Yes | API key for authenticating requests |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed CORS origins (e.g. `https://app.trakalog.com`) |
| `PORT` | No | Server port (default: 3000) |

## Deploy on Railway

1. Create a new project on [Railway](https://railway.app)

2. Connect your GitHub repo and set the root directory to `services/watermark`

3. Railway will auto-detect the Dockerfile. Set the environment variables:
   ```
   WATERMARK_API_KEY=your-secret-key
   ALLOWED_ORIGINS=https://app.trakalog.com
   ```

4. Deploy. Railway will build the Docker image and expose the service.

5. Note the generated URL (e.g. `https://watermark-production-xxxx.up.railway.app`) — use this as `VITE_WATERMARK_SERVICE_URL` in the main app if needed.

## Local Development

```bash
# Build
docker build -t trakalog-watermark .

# Run
docker run -p 3000:3000 \
  -e WATERMARK_API_KEY=dev-key \
  -e ALLOWED_ORIGINS=http://localhost:5173 \
  trakalog-watermark
```

## Usage Examples

```bash
# Encode
curl -X POST http://localhost:3000/encode \
  -H "x-api-key: dev-key" \
  -F "audio=@track.wav" \
  -F "payload=sl_abc123_visitor_xyz" \
  --output watermarked.wav

# Decode
curl -X POST http://localhost:3000/decode \
  -H "x-api-key: dev-key" \
  -F "audio=@watermarked.wav"

# Health
curl http://localhost:3000/health
```
