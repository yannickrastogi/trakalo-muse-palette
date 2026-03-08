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

/** Standard song structure template */
const SONG_STRUCTURE = [
  { label: "Intro", weight: 0.06 },
  { label: "Verse 1", weight: 0.12 },
  { label: "Pre-Chorus", weight: 0.06 },
  { label: "Chorus", weight: 0.12 },
  { label: "Post-Chorus", weight: 0.04 },
  { label: "Verse 2", weight: 0.12 },
  { label: "Pre-Chorus", weight: 0.06 },
  { label: "Chorus", weight: 0.12 },
  { label: "Post-Chorus", weight: 0.04 },
  { label: "Bridge", weight: 0.10 },
  { label: "Chorus", weight: 0.12 },
  { label: "Outro", weight: 0.04 },
];

const INSTRUMENTAL_STRUCTURE = [
  { label: "Intro", weight: 0.08 },
  { label: "Theme A", weight: 0.18 },
  { label: "Build", weight: 0.10 },
  { label: "Theme B", weight: 0.18 },
  { label: "Breakdown", weight: 0.12 },
  { label: "Theme A", weight: 0.16 },
  { label: "Climax", weight: 0.10 },
  { label: "Outro", weight: 0.08 },
];

const SAMPLE_STRUCTURE = [
  { label: "Intro", weight: 0.10 },
  { label: "Loop A", weight: 0.25 },
  { label: "Variation", weight: 0.20 },
  { label: "Loop B", weight: 0.25 },
  { label: "Breakdown", weight: 0.10 },
  { label: "Outro", weight: 0.10 },
];

/**
 * Generates "smart-detected" chapters based on track type and BPM.
 * Uses deterministic seeding from BPM for slight variation.
 */
export function detectChapters(
  trackType: string,
  bpm: number,
  seed: number = 0
): TrackChapter[] {
  let structure: { label: string; weight: number }[];

  switch (trackType) {
    case "Instrumental":
      structure = INSTRUMENTAL_STRUCTURE;
      break;
    case "Sample":
      structure = SAMPLE_STRUCTURE;
      break;
    case "Acapella":
      structure = SONG_STRUCTURE.filter(
        (s) => !["Post-Chorus"].includes(s.label)
      );
      break;
    default:
      structure = SONG_STRUCTURE;
  }

  // Normalize weights
  const totalWeight = structure.reduce((sum, s) => sum + s.weight, 0);

  // Add slight deterministic variation based on seed (BPM + id)
  const varied = structure.map((s, i) => {
    const jitter = ((((seed + i) * 16807 + 7) % 2147483647) / 2147483647 - 0.5) * 0.02;
    return { ...s, weight: s.weight / totalWeight + jitter };
  });

  // Re-normalize after jitter
  const variedTotal = varied.reduce((sum, s) => sum + s.weight, 0);

  let cursor = 0;
  const labelCount: Record<string, number> = {};

  return varied.map((s, i) => {
    const normalizedWeight = s.weight / variedTotal;
    const start = cursor;
    cursor += normalizedWeight;

    // Track label occurrences for unique IDs
    labelCount[s.label] = (labelCount[s.label] || 0) + 1;

    return {
      id: `ch-${i}`,
      label: s.label,
      startPercent: Math.round(start * 10000) / 100,
      endPercent: Math.round(Math.min(cursor, 1) * 10000) / 100,
      color: CHAPTER_COLORS[i % CHAPTER_COLORS.length],
    };
  });
}
