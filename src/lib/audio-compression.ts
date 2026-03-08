/**
 * Lightweight audio compression for in-app playback.
 * Uses OfflineAudioContext + MediaRecorder to re-encode audio.
 *
 * Strategy: Decode → resample to 44.1kHz mono → encode to Opus/WebM at 96kbps.
 * Opus at 96kbps ≈ MP3 at 160kbps quality, at ~60% the file size.
 * Falls back to AAC (mp4) if Opus is unsupported.
 */

export interface CompressedAudio {
  blob: Blob;
  url: string;
  format: string;
  sizeBytes: number;
  originalSizeBytes: number;
  compressionRatio: string;
}

const PREFERRED_CODECS = [
  { mimeType: "audio/webm;codecs=opus", ext: "webm" },
  { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
  { mimeType: "audio/mp4", ext: "m4a" },
  { mimeType: "audio/webm", ext: "webm" },
];

function getSupportedCodec(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const codec of PREFERRED_CODECS) {
    if (MediaRecorder.isTypeSupported(codec.mimeType)) return codec;
  }
  return null;
}

/**
 * Compress an audio file for lightweight playback.
 * Target: mono, 44.1kHz, ~96kbps Opus.
 */
export async function compressAudio(file: File): Promise<CompressedAudio> {
  const codec = getSupportedCodec();

  // If no MediaRecorder codec support, return original as blob URL
  if (!codec) {
    const url = URL.createObjectURL(file);
    return {
      blob: file,
      url,
      format: file.type || "audio/unknown",
      sizeBytes: file.size,
      originalSizeBytes: file.size,
      compressionRatio: "1:1",
    };
  }

  // Decode original audio
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  // Render to mono 44.1kHz using OfflineAudioContext
  const targetSampleRate = 44100;
  const channels = 1; // mono for max compression
  const length = Math.ceil(decoded.duration * targetSampleRate);

  const offline = new OfflineAudioContext(channels, length, targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();

  // Encode using MediaRecorder via MediaStreamDestination
  const playbackCtx = new AudioContext({ sampleRate: targetSampleRate });
  const dest = playbackCtx.createMediaStreamDestination();
  const playbackSource = playbackCtx.createBufferSource();
  playbackSource.buffer = rendered;
  playbackSource.connect(dest);

  const recorder = new MediaRecorder(dest.stream, {
    mimeType: codec.mimeType,
    audioBitsPerSecond: 96000, // 96kbps — sweet spot for quality/size
  });

  const chunks: Blob[] = [];

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: codec.mimeType }));
    };
  });

  recorder.start();
  playbackSource.start();

  // Stop after the audio duration + small buffer
  const durationMs = rendered.duration * 1000;
  await new Promise((r) => setTimeout(r, durationMs + 200));

  recorder.stop();
  playbackSource.stop();

  const blob = await recordingDone;
  await playbackCtx.close();

  const url = URL.createObjectURL(blob);
  const ratio = file.size > 0 ? `${(file.size / blob.size).toFixed(1)}:1` : "—";

  return {
    blob,
    url,
    format: codec.mimeType,
    sizeBytes: blob.size,
    originalSizeBytes: file.size,
    compressionRatio: ratio,
  };
}
