import type { TrackChapter } from "@/contexts/TrackContext";

/** Chapter color palette using semantic design tokens */
const CHAPTER_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--brand-pink))",
  "hsl(var(--brand-purple))",
  "hsl(var(--brand-orange))",
  "hsl(var(--accent))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

/** Default section count per track type */
const SECTION_COUNTS: Record<string, number> = {
  Song: 12,
  Instrumental: 8,
  Sample: 6,
  Acapella: 10,
};

/** Weights for equal-ish sections with slight variation per type */
function buildWeights(count: number): number[] {
  var weights: number[] = [];
  for (var i = 0; i < count; i++) weights.push(1 / count);
  return weights;
}

/**
 * Generates numbered section chapters based on track type.
 * Labels are simply "Section 1", "Section 2", etc.
 * Uses deterministic seeding from BPM for slight variation in section sizes.
 */
export function detectChapters(
  trackType: string,
  bpm: number,
  seed: number = 0
): TrackChapter[] {
  var count = SECTION_COUNTS[trackType] || SECTION_COUNTS.Song;
  var weights = buildWeights(count);

  // Add slight deterministic variation based on seed (BPM + id)
  var varied = weights.map(function (w, i) {
    var jitter = ((((seed + i) * 16807 + 7) % 2147483647) / 2147483647 - 0.5) * 0.02;
    return w + jitter;
  });

  // Re-normalize
  var total = varied.reduce(function (sum, v) { return sum + v; }, 0);

  var cursor = 0;
  return varied.map(function (w, i) {
    var normalizedWeight = w / total;
    var start = cursor;
    cursor += normalizedWeight;

    return {
      id: "ch-" + i,
      label: "Section " + (i + 1),
      startPercent: Math.round(start * 10000) / 100,
      endPercent: Math.round(Math.min(cursor, 1) * 10000) / 100,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
    };
  });
}
