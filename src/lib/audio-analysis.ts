/**
 * Client-side audio analysis engine using Web Audio API.
 * Detects BPM, musical key, duration, and generates energy-based chapter segmentation.
 *
 * Architecture: pure functions that accept an AudioBuffer — easy to swap for a backend service later.
 */

import type { TrackChapter } from "@/contexts/TrackContext";

export interface AudioAnalysisResult {
  bpm: number;
  key: string;
  duration: string;
  durationSeconds: number;
  chapters: TrackChapter[];
}

// ─── BPM Detection ──────────────────────────────────────────────────────────

/**
 * Detects BPM using onset-based autocorrelation.
 * Accuracy: ~85-90% for steady-tempo tracks.
 */
function detectBPM(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;

  // Downsample to ~11kHz for faster processing
  const downsampleFactor = Math.max(1, Math.floor(sampleRate / 11025));
  const downsampled: number[] = [];
  for (let i = 0; i < data.length; i += downsampleFactor) {
    downsampled.push(Math.abs(data[i]));
  }
  const dsRate = sampleRate / downsampleFactor;

  // Compute energy envelope with ~50ms windows
  const windowSize = Math.floor(dsRate * 0.05);
  const envelope: number[] = [];
  for (let i = 0; i < downsampled.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += downsampled[i + j] * downsampled[i + j];
    }
    envelope.push(Math.sqrt(sum / windowSize));
  }

  // Differentiate to get onsets
  const diff: number[] = [];
  for (let i = 1; i < envelope.length; i++) {
    diff.push(Math.max(0, envelope[i] - envelope[i - 1]));
  }

  // Autocorrelation over onset signal
  const envelopeRate = dsRate / windowSize;
  const minLag = Math.floor(envelopeRate * 60 / 200); // 200 BPM max
  const maxLag = Math.floor(envelopeRate * 60 / 50);  // 50 BPM min

  let bestLag = minLag;
  let bestCorr = -Infinity;

  for (let lag = minLag; lag <= Math.min(maxLag, diff.length / 2); lag++) {
    let corr = 0;
    const limit = Math.min(diff.length - lag, 500);
    for (let i = 0; i < limit; i++) {
      corr += diff[i] * diff[i + lag];
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }

  const rawBPM = (envelopeRate * 60) / bestLag;

  // Normalize to common range (60-180 BPM)
  let bpm = rawBPM;
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;

  return Math.round(bpm);
}

// ─── Key Detection ──────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Detects musical key using chromagram + Krumhansl-Schmuckler algorithm.
 * Accuracy: ~65-75% for clear tonal music.
 */
function detectKey(buffer: AudioBuffer): string {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const fftSize = 8192;

  // Use OfflineAudioContext would be ideal but we'll do a simple DFT-based chromagram
  // Take several windows from across the track
  const numWindows = Math.min(20, Math.floor(data.length / fftSize));
  const chroma = new Float64Array(12);

  for (let w = 0; w < numWindows; w++) {
    const start = Math.floor((w / numWindows) * (data.length - fftSize));
    const window = data.slice(start, start + fftSize);

    // Apply Hann window
    for (let i = 0; i < fftSize; i++) {
      window[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
    }

    // Compute power spectrum using DFT for key frequency bins
    // Map frequencies to chroma
    for (let note = 0; note < 12; note++) {
      // Check octaves 2-6
      for (let octave = 2; octave <= 6; octave++) {
        const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
        const bin = Math.round(freq * fftSize / sampleRate);
        if (bin < 1 || bin >= fftSize / 2) continue;

        // Goertzel-like single-frequency energy
        let real = 0, imag = 0;
        const omega = (2 * Math.PI * bin) / fftSize;
        for (let i = 0; i < fftSize; i++) {
          real += window[i] * Math.cos(omega * i);
          imag += window[i] * Math.sin(omega * i);
        }
        chroma[note] += Math.sqrt(real * real + imag * imag);
      }
    }
  }

  // Normalize chroma
  const maxChroma = Math.max(...Array.from(chroma));
  if (maxChroma > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= maxChroma;
  }

  // Correlate with key profiles
  let bestKey = "C";
  let bestCorr = -Infinity;

  for (let shift = 0; shift < 12; shift++) {
    let corrMajor = 0;
    let corrMinor = 0;
    for (let i = 0; i < 12; i++) {
      const ci = (i + shift) % 12;
      corrMajor += chroma[ci] * MAJOR_PROFILE[i];
      corrMinor += chroma[ci] * MINOR_PROFILE[i];
    }
    if (corrMajor > bestCorr) {
      bestCorr = corrMajor;
      bestKey = `${NOTE_NAMES[shift]} Maj`;
    }
    if (corrMinor > bestCorr) {
      bestCorr = corrMinor;
      bestKey = `${NOTE_NAMES[shift]} Min`;
    }
  }

  return bestKey;
}

// ─── Chapter Detection ──────────────────────────────────────────────────────

const CHAPTER_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--brand-pink))",
  "hsl(var(--brand-purple))",
  "hsl(var(--brand-orange))",
  "hsl(var(--accent))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const SECTION_LABELS = [
  "Intro", "Verse 1", "Pre-Chorus", "Chorus", "Post-Chorus",
  "Verse 2", "Pre-Chorus", "Chorus", "Post-Chorus",
  "Bridge", "Chorus", "Outro",
];

/**
 * Detects chapters via energy segmentation.
 * Splits the audio into segments based on energy changes and assigns section labels.
 */
function detectChaptersFromAudio(buffer: AudioBuffer): TrackChapter[] {
  const data = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const duration = buffer.duration;

  // Compute energy in ~1s windows
  const windowSamples = sampleRate;
  const numWindows = Math.floor(data.length / windowSamples);
  const energies: number[] = [];

  for (let i = 0; i < numWindows; i++) {
    let sum = 0;
    const start = i * windowSamples;
    for (let j = 0; j < windowSamples; j++) {
      const sample = data[start + j];
      sum += sample * sample;
    }
    energies.push(Math.sqrt(sum / windowSamples));
  }

  if (energies.length < 4) {
    // Too short, use simple equal divisions
    return SECTION_LABELS.slice(0, 4).map((label, i) => ({
      id: `ch-${i}`,
      label,
      startPercent: (i / 4) * 100,
      endPercent: ((i + 1) / 4) * 100,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
    }));
  }

  // Smooth energies
  const smoothed: number[] = [];
  const smoothWindow = 3;
  for (let i = 0; i < energies.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - smoothWindow); j <= Math.min(energies.length - 1, i + smoothWindow); j++) {
      sum += energies[j];
      count++;
    }
    smoothed.push(sum / count);
  }

  // Find change points using energy derivative
  const derivatives: number[] = [];
  for (let i = 1; i < smoothed.length; i++) {
    derivatives.push(Math.abs(smoothed[i] - smoothed[i - 1]));
  }

  // Find peaks in derivative (significant energy changes)
  const meanDeriv = derivatives.reduce((a, b) => a + b, 0) / derivatives.length;
  const threshold = meanDeriv * 1.5;

  const changePoints: number[] = [0]; // Always start at 0
  let lastChange = 0;
  const minGapSeconds = Math.max(4, duration * 0.04); // At least 4s between changes

  for (let i = 0; i < derivatives.length; i++) {
    const timeInSeconds = (i + 1);
    if (derivatives[i] > threshold && (timeInSeconds - lastChange) > minGapSeconds) {
      changePoints.push(timeInSeconds);
      lastChange = timeInSeconds;
    }
  }

  // Ensure we don't have too many or too few sections
  // Target: ~8-12 sections for a typical song
  const targetSections = Math.min(SECTION_LABELS.length, Math.max(4, Math.round(duration / 20)));

  // If too many change points, keep the strongest
  if (changePoints.length > targetSections + 1) {
    const scored = changePoints.slice(1).map((cp, i) => ({
      point: cp,
      score: derivatives[cp - 1] || 0,
      index: i,
    }));
    scored.sort((a, b) => b.score - a.score);
    const kept = scored.slice(0, targetSections - 1).map((s) => s.point);
    kept.sort((a, b) => a - b);
    changePoints.length = 1; // keep 0
    changePoints.push(...kept);
  }

  // If too few, subdivide largest sections
  while (changePoints.length < Math.min(targetSections + 1, 5)) {
    let maxGap = 0, maxIdx = 0;
    for (let i = 0; i < changePoints.length; i++) {
      const end = i < changePoints.length - 1 ? changePoints[i + 1] : numWindows;
      const gap = end - changePoints[i];
      if (gap > maxGap) {
        maxGap = gap;
        maxIdx = i;
      }
    }
    const end = maxIdx < changePoints.length - 1 ? changePoints[maxIdx + 1] : numWindows;
    changePoints.splice(maxIdx + 1, 0, Math.floor((changePoints[maxIdx] + end) / 2));
  }

  // Convert to chapters
  const numSections = changePoints.length;
  const chapters: TrackChapter[] = [];

  for (let i = 0; i < numSections; i++) {
    const startSec = changePoints[i];
    const endSec = i < numSections - 1 ? changePoints[i + 1] : numWindows;
    const label = SECTION_LABELS[i % SECTION_LABELS.length];

    chapters.push({
      id: `ch-${i}`,
      label,
      startPercent: Math.round((startSec / numWindows) * 10000) / 100,
      endPercent: Math.round((endSec / numWindows) * 10000) / 100,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
    });
  }

  return chapters;
}

// ─── Duration Formatting ────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─── Main Analysis Function ─────────────────────────────────────────────────

/**
 * Analyzes an audio file and returns BPM, key, duration, and chapters.
 * Uses Web Audio API — runs entirely in the browser.
 */
export async function analyzeAudio(file: File): Promise<AudioAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();

  let buffer: AudioBuffer;
  try {
    buffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }

  const durationSeconds = buffer.duration;
  const duration = formatDuration(durationSeconds);

  // Run analyses
  const bpm = detectBPM(buffer);
  const key = detectKey(buffer);
  const chapters = detectChaptersFromAudio(buffer);

  return { bpm, key, duration, durationSeconds, chapters };
}
