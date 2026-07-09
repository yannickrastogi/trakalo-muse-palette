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
//
// Weighting reflects real importance for a rights/sync-ready catalog:
//  - Core creative & rights data carry the most weight — credits, splits (+ signed),
//    genre, cover, core info (title/artist), lyrics.
//  - Auto-detected or secondary fields carry little — BPM/Key are filled
//    automatically by Sonic DNA, so a track that is otherwise complete but missing
//    only BPM/Key still scores high (missing BPM/Key alone = 93%). ISRC / stems /
//    extra metadata are minor.
const CRITERIA: { key: string; weight: number; check: (c: CompletenessCtx) => boolean }[] = [
  { key: "coreInfo", weight: 8, check: (c) => !!c.track.title?.trim() && !!c.track.artist?.trim() },
  { key: "cover", weight: 10, check: (c) => !!c.track.coverImage },
  { key: "genreMood", weight: 12, check: (c) => (c.track.genre?.length ?? 0) > 0 && (c.track.mood?.length ?? 0) > 0 },
  { key: "lyrics", weight: 8, check: (c) => !!c.track.lyrics && c.track.lyrics.trim().length > 0 },
  { key: "credits", weight: 15, check: (c) => !!c.track.credits && Object.values(c.track.credits).some((v) => Array.isArray(v) ? v.length > 0 : !!v) },
  { key: "splits", weight: 15, check: (c) => (c.track.splits?.length ?? 0) > 0 },
  { key: "splitsSigned", weight: 10, check: (c) => (c.track.splits?.length ?? 0) > 0 && c.splitsAllSigned === true },
  { key: "stems", weight: 5, check: (c) => c.stems.length > 0 },
  { key: "isrc", weight: 4, check: (c) => !!c.track.isrc && c.track.isrc.trim().length > 0 },
  { key: "metadata", weight: 6, check: (c) => !!c.track.album || !!c.track.label || !!c.track.copyright },
  { key: "bpmKey", weight: 7, check: (c) => !!c.track.bpm && !!c.track.key },
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
