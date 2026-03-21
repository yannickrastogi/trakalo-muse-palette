/**
 * Audio analysis with Essentia.js WASM.
 * Lazy-loads the ~2MB WASM module on first call to avoid impacting initial load.
 */

export interface AudioFeatures {
  bpm: number;
  key: string;
  scale: string;
  genre: string;
  mood: string[];
}

// Cached Essentia instance (lazy-loaded)
let essentiaInstance: any = null;

async function getEssentia(): Promise<any> {
  if (essentiaInstance) return essentiaInstance;

  const { EssentiaWASM } = await import("essentia.js/dist/essentia-wasm.es.js");
  const { default: Essentia } = await import("essentia.js/dist/essentia.js-core.es.js");

  const wasmModule = await EssentiaWASM();
  essentiaInstance = new Essentia(wasmModule);
  return essentiaInstance;
}

/**
 * Convert AudioBuffer to mono Float32Array.
 */
function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) * 0.5;
  }
  return mono;
}

/**
 * Compute RMS energy of a signal.
 */
function computeEnergy(signal: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i] * signal[i];
  }
  return Math.sqrt(sum / signal.length);
}

/**
 * Compute spectral centroid approximation (brightness indicator).
 * Higher values = brighter/more treble-heavy sound.
 */
function computeSpectralBrightness(signal: Float32Array, sampleRate: number): number {
  // Use a simple FFT-like approach: ratio of high-frequency energy to total energy
  const halfLen = Math.floor(signal.length / 2);
  const cutoffSample = Math.floor(signal.length * 2000 / sampleRate); // 2kHz cutoff

  let lowEnergy = 0;
  let highEnergy = 0;
  for (let i = 0; i < halfLen; i++) {
    const val = signal[i] * signal[i];
    if (i < cutoffSample) lowEnergy += val;
    else highEnergy += val;
  }

  const total = lowEnergy + highEnergy;
  return total > 0 ? highEnergy / total : 0;
}

/**
 * Map BPM + energy + key/scale + brightness to a genre heuristic.
 */
function inferGenre(bpm: number, energy: number, scale: string, brightness: number): string {
  // High energy thresholds
  const highEnergy = energy > 0.08;
  const mediumEnergy = energy > 0.04;

  if (bpm >= 120 && bpm <= 135 && highEnergy && brightness > 0.3) return "House";
  if (bpm >= 135 && bpm <= 160 && highEnergy) return "DnB";
  if (bpm >= 125 && bpm <= 145 && highEnergy && brightness > 0.25) return "Electronic";
  if (bpm >= 115 && bpm <= 130 && mediumEnergy && brightness > 0.2) return "Dance";
  if (bpm >= 90 && bpm <= 115 && highEnergy && brightness > 0.3) return "Pop";
  if (bpm >= 70 && bpm <= 100 && mediumEnergy && brightness < 0.2) return "R&B";
  if (bpm >= 80 && bpm <= 115 && highEnergy && brightness < 0.25) return "Hip-Hop";
  if (bpm >= 100 && bpm <= 130 && mediumEnergy && brightness > 0.25) return "Rock";
  if (bpm >= 60 && bpm <= 90 && !mediumEnergy) return "Ambient";
  if (bpm >= 90 && bpm <= 120 && mediumEnergy && scale === "minor") return "Soul";
  if (bpm >= 60 && bpm <= 80 && !highEnergy) return "Lo-fi";
  if (bpm >= 100 && bpm <= 130 && mediumEnergy) return "Indie";
  return "Pop";
}

/**
 * Map features to mood tags.
 */
function inferMoods(bpm: number, energy: number, scale: string, brightness: number): string[] {
  const moods: string[] = [];

  // Tempo-based
  if (bpm >= 120) moods.push("energetic");
  if (bpm >= 130) moods.push("driving");
  if (bpm < 80) moods.push("calm");
  if (bpm >= 100 && bpm <= 120) moods.push("smooth");

  // Energy-based
  if (energy > 0.1) moods.push("aggressive");
  if (energy > 0.06) moods.push("uplifting");
  if (energy < 0.03) moods.push("meditative");

  // Key/scale-based
  if (scale === "minor") {
    moods.push("dark");
    if (bpm < 100) moods.push("nostalgic");
    if (energy < 0.05) moods.push("emotional");
  } else {
    moods.push("happy");
    if (bpm >= 110) moods.push("euphoric");
    if (energy < 0.05) moods.push("dreamy");
  }

  // Brightness-based
  if (brightness > 0.35) moods.push("warm");
  if (brightness < 0.15 && energy < 0.05) moods.push("hypnotic");

  // Deduplicate and limit to 4
  return [...new Set(moods)].slice(0, 4);
}

/**
 * Analyze an audio file and extract BPM, key, scale, genre, and mood.
 * Uses Essentia.js WASM for BPM and key detection, heuristics for genre/mood.
 */
export async function analyzeWithEssentia(audioFile: File): Promise<AudioFeatures> {
  // Decode audio
  const arrayBuffer = await audioFile.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const mono = toMono(decoded);
  const sampleRate = decoded.sampleRate;

  // Load Essentia
  const essentia = await getEssentia();

  // Convert to Essentia vector
  const inputSignal = essentia.arrayToVector(mono);

  // BPM detection with PercivalBpmEstimator
  let bpm = 0;
  try {
    const bpmResult = essentia.PercivalBpmEstimator(inputSignal);
    bpm = Math.round(bpmResult.bpm);
    // Normalize to 60-180 range
    while (bpm > 0 && bpm < 60) bpm *= 2;
    while (bpm > 180) bpm = Math.round(bpm / 2);
  } catch (e) {
    console.warn("Essentia BPM detection failed:", e);
  }

  // Key + Scale detection with KeyExtractor
  let key = "C";
  let scale = "major";
  try {
    const keyResult = essentia.KeyExtractor(inputSignal);
    key = keyResult.key;
    scale = keyResult.scale;
  } catch (e) {
    console.warn("Essentia key detection failed:", e);
  }

  // Compute additional features for genre/mood inference
  const energy = computeEnergy(mono);
  const brightness = computeSpectralBrightness(mono, sampleRate);

  // Format key string to match app format (e.g. "C Min", "F# Maj")
  const scaleAbbrev = scale === "minor" ? "Min" : "Maj";
  const formattedKey = key + " " + scaleAbbrev;

  // Infer genre and mood from features
  const genre = inferGenre(bpm, energy, scale, brightness);
  const mood = inferMoods(bpm, energy, scale, brightness);

  return { bpm, key: formattedKey, scale, genre, mood };
}
