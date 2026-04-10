import os
import tempfile
import traceback

import requests as http_requests
from flask import Flask, request, jsonify

from analyzer import analyze

app = Flask(__name__)

API_KEY = os.environ.get("SONIC_DNA_API_KEY", "")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["POST"])
def analyze_route():
    # Verify API key
    req_key = request.headers.get("x-api-key", "")
    if API_KEY and req_key != API_KEY:
        return jsonify({"error": "Invalid or missing x-api-key"}), 401

    body = request.get_json(silent=True) or {}
    source_url = body.get("source_url")
    if not source_url:
        return jsonify({"error": "source_url is required"}), 400

    tmp_path = None
    try:
        # Download audio to temp file
        resp = http_requests.get(source_url, timeout=120, stream=True)
        resp.raise_for_status()

        suffix = ".wav"
        if ".mp3" in source_url.lower():
            suffix = ".mp3"
        elif ".flac" in source_url.lower():
            suffix = ".flac"
        elif ".ogg" in source_url.lower():
            suffix = ".ogg"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in resp.iter_content(chunk_size=65536):
                tmp.write(chunk)
            tmp_path = tmp.name

        # Run analysis
        result = analyze(tmp_path)
        return jsonify(result)

    except http_requests.RequestException as e:
        return jsonify({"error": "Failed to download audio: " + str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Analysis failed: " + str(e)}), 500
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8081))
    app.run(host="0.0.0.0", port=port)
