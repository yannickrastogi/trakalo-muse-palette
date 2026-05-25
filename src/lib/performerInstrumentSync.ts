import type { TrackTags } from "@/lib/tagsVocabulary";

/**
 * Maps a performer field key (as used in tracks.credits / details) to the
 * canonical instrument tag — lowercased to match how predefined tags are
 * persisted by `TagsSection` (line that does `onAdd(v.toLowerCase())`).
 *
 * Fields not present here (programmingBy, recordingEngineer, mixingEngineer,
 * masteringEngineer, producers, songwriters, ...) are NOT synced — they
 * aren't instruments.
 */
export const PERFORMER_TO_INSTRUMENT: Record<string, string> = {
  bassBy: "bass",
  guitarsBy: "electric guitar",
  keysBy: "keys",
  drumsBy: "drums",
  synthsBy: "synth",
  vocalsBy: "vocals",
  backgroundVocalsBy: "vocals",
};

/**
 * Returns a new TrackTags with the instrument tag for `performerKey` appended,
 * IFF the value is non-empty AND the tag isn't already present.
 *
 * One-way sync: NEVER removes a tag. If the user manually un-checks a tag, it
 * stays un-checked until they write a new name into that performer field
 * (which is when this function will re-add it — that's the documented
 * "simple rule" behaviour).
 */
export function syncPerformerToInstrumentTag(
  tags: TrackTags,
  performerKey: string,
  hasNonEmptyValue: boolean,
): TrackTags {
  if (!hasNonEmptyValue) return tags;
  const tagLower = PERFORMER_TO_INSTRUMENT[performerKey];
  if (!tagLower) return tags;
  const existing = tags.instruments || [];
  if (existing.some((t) => t.toLowerCase() === tagLower)) return tags;
  return { ...tags, instruments: [...existing, tagLower] };
}
