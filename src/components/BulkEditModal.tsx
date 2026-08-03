import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useTrack, type TrackData } from "@/contexts/TrackContext";
import type { TrackTags } from "@/lib/tagsVocabulary";
import { STATUSES, KEYS, MOODS } from "@/lib/constants";
import { GenreMultiSelect } from "@/components/GenreMultiSelect";
import { ArtistsInput } from "@/components/ArtistsInput";
import { MultiSelectChips } from "@/components/MultiSelectChips";
import { TagsSection } from "@/components/TagsSection";
import { FieldLabel, FieldInput, FieldSelect } from "@/components/TrackFields";

type Mode = "ignore" | "replace" | "add";

type FieldId =
  | "status" | "artist" | "featuring" | "genre" | "mood" | "bpm" | "key"
  | "album" | "label" | "publisher" | "upc" | "releaseDate" | "copyright"
  | "explicit" | "tags" | "notes";

const ALL_FIELDS: FieldId[] = [
  "status", "artist", "featuring", "genre", "mood", "bpm", "key",
  "album", "label", "publisher", "upc", "releaseDate", "copyright",
  "explicit", "tags", "notes",
];

// Fields that support the "Add" (merge, never overwrite) mode.
const ADD_CAPABLE = new Set<FieldId>(["genre", "mood", "tags"]);

const splitComma = (v: string): string[] => v.split(",").map((s) => s.trim()).filter(Boolean);
const unionArr = (existing: string[] | undefined, add: string[]): string[] => {
  const out = [...(existing || [])];
  const seen = new Set(out.map((s) => s.toLowerCase().trim()));
  for (const a of add) {
    const k = a.toLowerCase().trim();
    if (k && !seen.has(k)) { seen.add(k); out.push(a); }
  }
  return out;
};
// Merge two TrackTags, unioning each array category. `add` wins for the scalar
// tempo_descriptor only when it actually sets one.
const mergeTags = (existing: TrackTags | undefined, add: TrackTags): TrackTags => {
  const base: TrackTags = { ...(existing || {}) };
  const arrKeys: (keyof TrackTags)[] = ["instruments", "lyric_themes", "mood_feel", "sync_tags", "custom"];
  for (const k of arrKeys) {
    const addVals = (add[k] as string[] | undefined) || [];
    if (addVals.length > 0) base[k] = unionArr(base[k] as string[] | undefined, addVals) as never;
  }
  if (add.tempo_descriptor) base.tempo_descriptor = add.tempo_descriptor;
  return base;
};

const normArr = (arr: string[] | undefined): string =>
  (arr || []).map((s) => s.toLowerCase().trim()).filter(Boolean).sort().join("|");
const tagsKey = (t: TrackTags | undefined): string => {
  const o = t || {};
  return [
    normArr(o.instruments), normArr(o.lyric_themes), normArr(o.mood_feel),
    normArr(o.sync_tags), normArr(o.custom), (o.tempo_descriptor || "").toLowerCase(),
  ].join("::");
};

export function BulkEditModal({
  open,
  onClose,
  trackIds,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  trackIds: number[];
  /** Called after a successful apply so the page can exit selection mode. */
  onDone?: () => void;
}) {
  const { t } = useTranslation();
  const { tracks, bulkEditTracks } = useTrack();

  const [modes, setModes] = useState<Record<FieldId, Mode>>(
    () => Object.fromEntries(ALL_FIELDS.map((f) => [f, "ignore"])) as Record<FieldId, Mode>,
  );
  const [statusVal, setStatusVal] = useState("");
  const [artistVal, setArtistVal] = useState<string[]>([]);
  const [featuringVal, setFeaturingVal] = useState("");
  const [genreVal, setGenreVal] = useState<string[]>([]);
  const [moodVal, setMoodVal] = useState<string[]>([]);
  const [bpmVal, setBpmVal] = useState("");
  const [keyVal, setKeyVal] = useState("");
  const [albumVal, setAlbumVal] = useState("");
  const [labelVal, setLabelVal] = useState("");
  const [publisherVal, setPublisherVal] = useState("");
  const [upcVal, setUpcVal] = useState("");
  const [releaseDateVal, setReleaseDateVal] = useState("");
  const [copyrightVal, setCopyrightVal] = useState("");
  const [explicitVal, setExplicitVal] = useState(false);
  const [tagsVal, setTagsVal] = useState<TrackTags>({});
  const [notesVal, setNotesVal] = useState("");

  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const selectedTracks = useMemo(
    () => trackIds.map((id) => tracks.find((tr) => tr.id === id)).filter((tr): tr is TrackData => !!tr),
    [trackIds, tracks],
  );

  // Which fields hold differing values across the selection → show "Mixed".
  const mixed = useMemo(() => {
    const distinct = (fn: (tr: TrackData) => string) => new Set(selectedTracks.map(fn)).size > 1;
    return {
      status: distinct((tr) => tr.status || ""),
      artist: distinct((tr) => tr.artist || ""),
      featuring: distinct((tr) => normArr(tr.featuredArtists)),
      genre: distinct((tr) => normArr(tr.genre)),
      mood: distinct((tr) => normArr(tr.mood)),
      bpm: distinct((tr) => String(tr.bpm || "")),
      key: distinct((tr) => tr.key || ""),
      album: distinct((tr) => tr.album || ""),
      label: distinct((tr) => tr.label || ""),
      publisher: distinct((tr) => normArr(tr.publishers)),
      upc: distinct((tr) => tr.upc || ""),
      releaseDate: distinct((tr) => tr.releaseDate || ""),
      copyright: distinct((tr) => tr.copyright || ""),
      explicit: distinct((tr) => (tr.explicit ? "1" : "0")),
      tags: distinct((tr) => tagsKey(tr.tags as TrackTags | undefined)),
      notes: distinct((tr) => tr.notes || ""),
    } as Record<FieldId, boolean>;
  }, [selectedTracks]);

  const setMode = (id: FieldId, mode: Mode) => setModes((prev) => ({ ...prev, [id]: mode }));

  const chosenCount = ALL_FIELDS.filter((f) => modes[f] !== "ignore").length;

  const buildUpdates = (track: TrackData): Partial<TrackData> => {
    const u: Partial<TrackData> = {};
    if (modes.status === "replace") u.status = statusVal;
    if (modes.artist === "replace") u.artist = artistVal.join(", ");
    if (modes.featuring === "replace") u.featuredArtists = splitComma(featuringVal);
    if (modes.bpm === "replace") u.bpm = parseFloat(bpmVal) || 0;
    if (modes.key === "replace") u.key = keyVal;
    if (modes.album === "replace") u.album = albumVal;
    if (modes.label === "replace") u.label = labelVal;
    if (modes.publisher === "replace") u.publishers = splitComma(publisherVal);
    if (modes.upc === "replace") u.upc = upcVal;
    if (modes.releaseDate === "replace") u.releaseDate = releaseDateVal;
    if (modes.copyright === "replace") u.copyright = copyrightVal;
    if (modes.explicit === "replace") u.explicit = explicitVal;
    if (modes.notes === "replace") u.notes = notesVal;
    if (modes.genre === "replace") u.genre = genreVal;
    else if (modes.genre === "add") u.genre = unionArr(track.genre, genreVal);
    if (modes.mood === "replace") u.mood = moodVal;
    else if (modes.mood === "add") u.mood = unionArr(track.mood, moodVal);
    if (modes.tags === "replace") u.tags = tagsVal;
    else if (modes.tags === "add") u.tags = mergeTags(track.tags as TrackTags | undefined, tagsVal);
    return u;
  };

  const handleApply = async () => {
    if (chosenCount === 0) {
      toast.error(t("bulkEdit.pickAtLeastOne", "Choose at least one field to edit"));
      return;
    }
    setApplying(true);
    if (trackIds.length > 10) setProgress({ done: 0, total: trackIds.length });
    const res = await bulkEditTracks(trackIds, buildUpdates, (done, total) => setProgress({ done, total }));
    setApplying(false);
    setProgress(null);

    // Honest report: never claim a full success when some tracks failed/were skipped.
    if (res.failed === 0 && res.skipped === 0) {
      toast.success(t("bulkEdit.updatedCount", { count: res.succeeded, defaultValue: "Updated " + res.succeeded + " tracks" }));
    } else {
      toast.warning(
        t("bulkEdit.partialResult", {
          ok: res.succeeded, failed: res.failed, skipped: res.skipped,
          defaultValue: res.succeeded + " updated, " + res.failed + " failed" + (res.skipped ? ", " + res.skipped + " skipped" : ""),
        }),
      );
    }
    // Keep the modal open on a total failure so the user can retry without losing
    // their selection; otherwise close and let the page exit selection mode.
    if (!(res.succeeded === 0 && res.failed > 0)) {
      onDone?.();
      onClose();
    }
  };

  // Segmented Keep / Replace / (Add) toggle for one field.
  const modeToggle = (id: FieldId) => {
    const canAdd = ADD_CAPABLE.has(id);
    const opt = (mode: Mode, label: string) => (
      <button
        key={mode}
        type="button"
        onClick={() => setMode(id, mode)}
        className={
          "px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors " +
          (modes[id] === mode ? "bg-brand-orange/15 text-brand-orange" : "text-muted-foreground hover:text-foreground")
        }
      >
        {label}
      </button>
    );
    return (
      <div className="inline-flex items-center gap-0.5 rounded-lg bg-secondary/60 border border-border/60 p-0.5">
        {opt("ignore", t("bulkEdit.modeKeep", "Keep"))}
        {opt("replace", t("bulkEdit.modeReplace", "Replace"))}
        {canAdd && opt("add", t("bulkEdit.modeAdd", "Add"))}
      </div>
    );
  };

  // Plain function (NOT a component) so inner inputs keep identity across renders.
  const row = (id: FieldId, label: string, control: React.ReactNode) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FieldLabel>{label}</FieldLabel>
          {mixed[id] && modes[id] === "ignore" && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 text-[9px] font-semibold uppercase tracking-wider">
              {t("bulkEdit.mixed", "Mixed")}
            </span>
          )}
        </div>
        {modeToggle(id)}
      </div>
      {modes[id] !== "ignore" && <div>{control}</div>}
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={applying ? undefined : onClose} />
          <motion.div
            className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 12 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center">
                  <Layers className="w-4 h-4 text-brand-orange" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{t("bulkEdit.title", "Edit all")}</h2>
                  <p className="text-2xs text-muted-foreground">
                    {t("bulkEdit.subtitle", { count: trackIds.length, defaultValue: trackIds.length + " tracks selected" })}
                  </p>
                </div>
              </div>
              <button onClick={applying ? undefined : onClose} disabled={applying} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hint */}
            <div className="px-5 pt-3">
              <p className="text-2xs text-muted-foreground leading-relaxed">
                {t("bulkEdit.hint", "Fields left on “Keep” are never touched. Choose “Replace” to overwrite, or “Add” to append to existing values without erasing them.")}
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {row("status", t("editTrack.status", "Status"),
                <FieldSelect value={statusVal} onChange={setStatusVal} options={STATUSES} placeholder={t("bulkEdit.selectStatus", "Select status")} />)}
              {row("artist", t("editTrack.artist", "Artist"),
                <ArtistsInput value={artistVal} onChange={setArtistVal} placeholder={t("editTrack.artistPlaceholder", "Artist name")} className="w-full rounded-lg bg-secondary border border-border" />)}
              {row("featuring", t("editTrack.featuredArtists", "Featuring"),
                <FieldInput value={featuringVal} onChange={setFeaturingVal} placeholder={t("editTrack.commaSeparated", "Comma separated")} />)}
              {row("genre", t("editTrack.genre", "Genre"),
                <GenreMultiSelect value={genreVal} onChange={setGenreVal} placeholder={t("uploadTrack.selectGenre", "Select genre")} />)}
              {row("mood", t("bulkEdit.mood", "Mood"),
                <MultiSelectChips options={MOODS} selected={moodVal} onChange={setMoodVal} placeholder={t("bulkEdit.selectMood", "Select mood")} filterable />)}
              {row("bpm", t("editTrack.bpm", "BPM"),
                <FieldInput value={bpmVal} onChange={setBpmVal} placeholder="120" type="number" />)}
              {row("key", t("editTrack.key", "Key"),
                <FieldSelect value={keyVal} onChange={setKeyVal} options={KEYS} placeholder={t("uploadTrack.selectKey", "Select key")} />)}
              {row("album", t("editTrack.album", "Album"),
                <FieldInput value={albumVal} onChange={setAlbumVal} placeholder={t("editTrack.album", "Album")} />)}
              {row("label", t("editTrack.label", "Label"),
                <FieldInput value={labelVal} onChange={setLabelVal} placeholder={t("editTrack.label", "Label")} />)}
              {row("publisher", t("editTrack.publisher", "Publisher"),
                <FieldInput value={publisherVal} onChange={setPublisherVal} placeholder={t("editTrack.commaSeparated", "Comma separated")} />)}
              {row("upc", t("editTrack.upc", "UPC"),
                <FieldInput value={upcVal} onChange={setUpcVal} placeholder="UPC" />)}
              {row("releaseDate", t("editTrack.releaseDate", "Release date"),
                <FieldInput value={releaseDateVal} onChange={setReleaseDateVal} placeholder="" type="date" />)}
              {row("copyright", t("editTrack.copyright", "Copyright"),
                <FieldInput value={copyrightVal} onChange={setCopyrightVal} placeholder="© 2026" />)}
              {row("explicit", t("editTrack.explicit", "Explicit"),
                <div className="inline-flex items-center gap-0.5 rounded-lg bg-secondary/60 border border-border/60 p-0.5">
                  <button type="button" onClick={() => setExplicitVal(true)} className={"px-3 py-1 rounded-md text-xs font-semibold transition-colors " + (explicitVal ? "bg-brand-orange/15 text-brand-orange" : "text-muted-foreground hover:text-foreground")}>{t("common.yes", "Yes")}</button>
                  <button type="button" onClick={() => setExplicitVal(false)} className={"px-3 py-1 rounded-md text-xs font-semibold transition-colors " + (!explicitVal ? "bg-brand-orange/15 text-brand-orange" : "text-muted-foreground hover:text-foreground")}>{t("common.no", "No")}</button>
                </div>)}
              {row("tags", t("editTrack.tags", "Tags"),
                <TagsSection tags={tagsVal} onChange={setTagsVal} />)}
              {row("notes", t("editTrack.notes", "Notes"),
                <textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} rows={3} placeholder={t("editTrack.notes", "Notes")} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all resize-none placeholder:text-muted-foreground/40" />)}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border space-y-2">
              {progress && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-brand-orange transition-all" style={{ width: (progress.total ? (progress.done / progress.total) * 100 : 0) + "%" }} />
                  </div>
                  <p className="text-2xs text-muted-foreground text-center">{progress.done} / {progress.total}</p>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xs text-muted-foreground">
                  {t("bulkEdit.fieldsChosen", { count: chosenCount, defaultValue: chosenCount + " fields to change" })}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={onClose} disabled={applying} className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40">
                    {t("common.cancel", "Cancel")}
                  </button>
                  <button onClick={handleApply} disabled={applying || chosenCount === 0} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold btn-brand disabled:opacity-50 disabled:cursor-not-allowed">
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {t("bulkEdit.applyToCount", { count: trackIds.length, defaultValue: "Apply to " + trackIds.length })}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
