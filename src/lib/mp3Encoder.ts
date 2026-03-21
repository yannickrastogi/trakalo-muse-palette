import lamejs from "lamejs";

/**
 * Encode an audio file to MP3 128kbps using lamejs (client-side).
 * Decodes via Web Audio API, then encodes with LAME.
 */
export async function encodeToMp3(audioFile: File): Promise<Blob> {
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const sampleRate = decoded.sampleRate;
  const channels = decoded.numberOfChannels;
  const kbps = 128;

  // Convert Float32 samples to Int16
  function floatTo16Bit(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  const left = floatTo16Bit(decoded.getChannelData(0));
  const right = channels >= 2 ? floatTo16Bit(decoded.getChannelData(1)) : undefined;

  const encoder = new lamejs.Mp3Encoder(right ? 2 : 1, sampleRate, kbps);

  const mp3Parts: Int8Array[] = [];
  const blockSize = 1152;

  for (let i = 0; i < left.length; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    const rightChunk = right ? right.subarray(i, i + blockSize) : undefined;

    let encoded: Int8Array;
    if (rightChunk) {
      encoded = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      encoded = encoder.encodeBuffer(leftChunk);
    }
    if (encoded.length > 0) {
      mp3Parts.push(encoded);
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Parts.push(flushed);
  }

  return new Blob(mp3Parts, { type: "audio/mp3" });
}
