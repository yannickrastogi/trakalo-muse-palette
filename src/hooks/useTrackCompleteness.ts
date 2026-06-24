import { useMemo } from "react";
import type { TrackData, TrackStem } from "@/contexts/TrackContext";

export interface CompletenessResult {
  score: number; // 0-100
  missing: string[]; // i18n keys of missing elements
  color: "green" | "amber" | "red"; // green >=80, amber 50-79, red <50
}

interface CompletenessOptions {
  /** Override the stems used for the "stems" criterion (defaults to track.stems). */
  stems?: TrackStem[];
  /**
   * Whether every split is signed. Only TrackDetail can know this (signature_requests
   * is PII-restricted and not on TrackData), so the catalog leaves it undefined →
   * the "signed splits" criterion stays unmet there. This is intentional: the catalog
   * circle is an approximate indicator; TrackDetail shows the exact score.
   */
  splitsAllSigned?: boolean;
}

interface CompletenessCtx {
  track: TrackData;
  stems: TrackStem[];
  splitsAllSigned?: boolean;
}

// Criteria + weights (total = 100). Field names match the real TrackData shape.
const CRITERIA: { key: string; weight: number; check: (c: CompletenessCtx) => boolean }[] = [
  { key: "cover", weight: 10, check: (c) => !!c.track.coverImage },
  { key: "bpmKey", weight: 10, check: (c) => !!c.track.bpm && !!c.track.key },
  { key: "genreMood", weight: 10, check: (c) => (c.track.genre?.length ?? 0) > 0 && (c.track.mood?.length ?? 0) > 0 },
  { key: "lyrics", weight: 10, check: (c) => !!c.track.lyrics && c.track.lyrics.trim().length > 0 },
  { key: "splits", weight: 15, check: (c) => (c.track.splits?.length ?? 0) > 0 },
  { key: "splitsSigned", weight: 10, check: (c) => (c.track.splits?.length ?? 0) > 0 && c.splitsAllSigned === true },
  { key: "credits", weight: 10, check: (c) => !!c.track.credits && Object.values(c.track.credits).some((v) => Array.isArray(v) ? v.length > 0 : !!v) },
  { key: "isrc", weight: 5, check: (c) => !!c.track.isrc && c.track.isrc.trim().length > 0 },
  { key: "stems", weight: 10, check: (c) => c.stems.length > 0 },
  { key: "metadata", weight: 10, check: (c) => !!c.track.album || !!c.track.label || !!c.track.copyright },
];

export function useTrackCompleteness(track: TrackData, opts?: CompletenessOptions): CompletenessResult {
  const stems = opts?.stems;
  const splitsAllSigned = opts?.splitsAllSigned;
  return useMemo(() => {
    const ctx: CompletenessCtx = {
      track,
      stems: stems ?? track.stems ?? [],
      splitsAllSigned,
    };
    let score = 0;
    const missing: string[] = [];
    CRITERIA.forEach((c) => {
      if (c.check(ctx)) {
        score += c.weight;
      } else {
        missing.push(`completeness.${c.key}`);
      }
    });
    const color: CompletenessResult["color"] = score >= 80 ? "green" : score >= 50 ? "amber" : "red";
    return { score, missing, color };
  }, [track, stems, splitsAllSigned]);
}
