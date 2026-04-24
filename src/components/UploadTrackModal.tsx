import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTrack, type TrackData } from "@/contexts/TrackContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { encodeToMp3 } from "@/lib/mp3Encoder";
import { toast } from "sonner";
import { useTeams } from "@/contexts/TeamContext";
import { analyzeAudio, type AudioAnalysisResult } from "@/lib/audio-analysis";
import { generateWaveform } from "@/lib/waveformGenerator";
import { compressAudio, type CompressedAudio } from "@/lib/audio-compression";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Music,
  Upload,
  FileAudio,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Play,
  Pause,
  User,
  Users,
  Loader2,
  AlertCircle,
  ImagePlus,
  CheckCircle2,
  ArrowRightLeft,
  Zap,
  Scale,
} from "lucide-react";
import { CollaboratorAutocomplete, type CollaboratorSuggestion } from "@/components/CollaboratorAutocomplete";
import { useContacts, type Contact } from "@/contexts/ContactsContext";
import { useTrack as useTrackContext } from "@/contexts/TrackContext";
import { PerformerCreditsSection } from "@/components/PerformerCreditsSection";
import { ProductionCreditsSection } from "@/components/ProductionCreditsSection";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const MAX_TRACKS = 20;

const STEPS_SINGLE = ["Audio", "Info", "Stems", "Splits", "Review"];

import { GENRES, KEYS, MOODS, LANGUAGES, PROS, SPLIT_ROLES } from "@/lib/constants";
import { equalSplit } from "@/lib/split-utils";
import { MultiSelectChips } from "@/components/MultiSelectChips";
import { NameAutocomplete } from "@/components/NameAutocomplete";

interface Split {
  id: string;
  name: string;
  stage_name: string;
  role: string;
  percentage: number;
  pro: string;
  ipi: string;
  publisher: string;
}

interface StemFile {
  id: string;
  name: string;
  file: File;
  size: string;
}

/** Per-track entry in the bulk queue */
interface TrackEntry {
  id: string;
  file: File;
  fileName: string;
  fileSize: string;
  // Analysis
  analyzing: boolean;
  analysisResult: AudioAnalysisResult | null;
  analysisDuration: string;
  analysisError: boolean;
  // Compression
  compressing: boolean;
  compressed: CompressedAudio | null;
  // Metadata
  title: string;
  artist: string;
  bpm: string;
  trackKey: string;
  genre: string;
  mood: string[];
  trackType: string;
  voice: string;
  language: string;
  notes: string;
  details: Record<string, string[]>;
  stems: StemFile[];
  splits: Split[];
  lyrics: string;
  sharedTeams: string[];
  sharedWorkspaces: string[];
  coverFile: File | null;
  // Extended metadata
  isrc: string;
  upc: string;
  album: string;
  label: string;
  publisher: string;
  releaseDate: string;
  writtenBy: string;
  producedBy: string;
  mixedBy: string;
  masteredBy: string;
  copyright: string;
  explicit: boolean;
  // Status
  metadataComplete: boolean;
}

interface UploadTrackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseFileName(fileName: string): { artist: string; title: string } {
  var nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  var separators = [" - ", " – ", " — "];
  for (var i = 0; i < separators.length; i++) {
    var idx = nameWithoutExt.indexOf(separators[i]);
    if (idx > 0) {
      return {
        artist: nameWithoutExt.substring(0, idx).trim(),
        title: nameWithoutExt.substring(idx + separators[i].length).trim(),
      };
    }
  }
  return { artist: "", title: nameWithoutExt.trim() };
}

function createTrackEntry(file: File): TrackEntry {
  var parsed = parseFileName(file.name);
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    analyzing: false,
    analysisResult: null,
    analysisDuration: "",
    analysisError: false,
    compressing: false,
    compressed: null,
    title: parsed.title,
    artist: parsed.artist,
    bpm: "",
    trackKey: "",
    genre: "",
    mood: [],
    trackType: "Song",
    voice: "",
    language: "",
    notes: "",
    details: {},
    stems: [],
    splits: [{ id: "1", name: "", stage_name: "", role: "", percentage: 100, pro: "", ipi: "", publisher: "" }],
    lyrics: "",
    sharedTeams: [],
    sharedWorkspaces: [],
    coverFile: null,
    isrc: "",
    upc: "",
    album: "",
    label: "",
    publisher: "",
    releaseDate: "",
    writtenBy: "",
    producedBy: "",
    mixedBy: "",
    masteredBy: "",
    copyright: "",
    explicit: false,
    metadataComplete: false,
  };
}

export function UploadTrackModal({ open, onOpenChange }: UploadTrackModalProps) {
  const { t } = useTranslation();
  const { tracks, addTrack, updateTrack, refreshTracks } = useTrack();
  const { tracks: allTracks } = useTrackContext();
  const { contacts, upsertCollaborator } = useContacts();
  const { teams } = useTeams();
  const { activeWorkspace, workspaces } = useWorkspace();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadComplete, setUploadComplete] = useState(false);

  // Phase: "upload" (drag & drop files) → "edit" (per-track metadata) → done
  const [phase, setPhase] = useState<"upload" | "edit">("upload");
  const [queue, setQueue] = useState<TrackEntry[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editStep, setEditStep] = useState(0); // 0=Info, 1=Stems, 2=Lyrics, 3=Splits, 4=Review
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const stemsInputRef = useRef<HTMLInputElement>(null);
  const lyricsFileInputRef = useRef<HTMLInputElement>(null);

  const EDIT_STEPS = [t("uploadTrack.info"), t("uploadTrack.lyrics"), t("uploadTrack.stems"), t("uploadTrack.details", "Details"), t("uploadTrack.review"), t("uploadTrack.workspacesStep", "Workspaces")];

  const currentTrack = queue[currentIdx] || null;

  // Existing split names from all workspace tracks (for autocomplete)
  const existingSplitNames = useMemo(function () {
    var names = new Set<string>();
    for (var i = 0; i < allTracks.length; i++) {
      var s = allTracks[i].splits;
      if (s) for (var j = 0; j < s.length; j++) {
        if (s[j].name) names.add(s[j].name);
      }
    }
    return Array.from(names);
  }, [allTracks]);

  // ─── File handling ──────────────────────────────────────────

  const addFiles = useCallback(async (files: File[]) => {
    const SUPPORTED_EXTENSIONS = /\.(wav|mp3|flac|aiff|aif|ogg|m4a)$/i;
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    const audioFiles = files.filter((f) => f.type.startsWith("audio/") || SUPPORTED_EXTENSIONS.test(f.name));
    if (audioFiles.length === 0 && files.length > 0) {
      toast.error("Unsupported file format. Please upload a WAV, MP3, FLAC, AIFF, M4A, or OGG file.");
      return;
    }
    if (audioFiles.length === 0) return;

    // Check file sizes
    const oversized = audioFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      for (const f of oversized) {
        toast.error("File is too large (" + (f.size / (1024 * 1024)).toFixed(1) + " MB). Maximum upload size is 50MB. Try a compressed format (MP3, FLAC).");
      }
    }
    const validFiles = audioFiles.filter((f) => f.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) return;

    const remaining = MAX_TRACKS - queue.length;
    const toAdd = validFiles.slice(0, remaining);
    if (toAdd.length === 0) return;

    const entries = toAdd.map(createTrackEntry);
    setQueue((prev) => [...prev, ...entries]);

    // Run analysis + compression in parallel for each file
    for (const entry of entries) {
      // Analysis: run basic + Essentia in parallel
      setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, analyzing: true } : e));

      analyzeAudio(entry.file)
        .then((basic) => {
          setQueue((prev) => prev.map((e) => {
            if (e.id !== entry.id) return e;
            const updates: Partial<TrackEntry> = { analyzing: false };
            if (basic) {
              updates.analysisResult = basic;
              updates.analysisDuration = basic.duration;
            }
            if (!basic) updates.analysisError = true;
            return { ...e, ...updates };
          }));
        })
        .catch(() => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, analyzing: false, analysisError: true } : e));
        });

      // Compression
      compressAudio(entry.file)
        .then((compressed) => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, compressing: false, compressed } : e));
        })
        .catch(() => {
          setQueue((prev) => prev.map((e) => e.id === entry.id ? { ...e, compressing: false } : e));
        });
    }
  }, [queue.length]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ─── Drag & Drop ──────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    addFiles(files);
  }, [addFiles]);

  // ─── Metadata updates ──────────────────────────────────────

  const updateCurrent = useCallback((updates: Partial<TrackEntry>) => {
    setQueue((prev) => prev.map((e, i) => i === currentIdx ? { ...e, ...updates } : e));
  }, [currentIdx]);

  const toggleMood = useCallback((m: string) => {
    if (!currentTrack) return;
    if (currentTrack.mood.includes(m)) {
      updateCurrent({ mood: currentTrack.mood.filter((x) => x !== m) });
    } else if (currentTrack.mood.length < 8) {
      updateCurrent({ mood: [...currentTrack.mood, m] });
    }
  }, [currentTrack, updateCurrent]);

  const addCustomMood = useCallback((tag: string) => {
    if (!currentTrack) return;
    const normalized = tag.trim().toLowerCase().replace(/^#/, "");
    if (!normalized) return;
    if (currentTrack.mood.includes(normalized)) return;
    if (currentTrack.mood.length >= 8) return;
    updateCurrent({ mood: [...currentTrack.mood, normalized] });
  }, [currentTrack, updateCurrent]);

  const updateDetail = useCallback((key: string, index: number, value: string) => {
    if (!currentTrack) return;
    const arr = [...(currentTrack.details[key] || [])];
    arr[index] = value;
    updateCurrent({ details: { ...currentTrack.details, [key]: arr } });
  }, [currentTrack, updateCurrent]);

  const addDetailEntry = useCallback((key: string) => {
    if (!currentTrack) return;
    updateCurrent({ details: { ...currentTrack.details, [key]: [...(currentTrack.details[key] || [""]), ""] } });
  }, [currentTrack, updateCurrent]);

  const removeDetailEntry = useCallback((key: string, index: number) => {
    if (!currentTrack) return;
    const arr = (currentTrack.details[key] || []).filter((_, i) => i !== index);
    updateCurrent({ details: { ...currentTrack.details, [key]: arr } });
  }, [currentTrack, updateCurrent]);

  // Stems
  const handleStemsUpload = useCallback((files: FileList) => {
    if (!currentTrack) return;
    const newStems: StemFile[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      file: f,
      size: formatFileSize(f.size),
    }));
    updateCurrent({ stems: [...currentTrack.stems, ...newStems] });
  }, [currentTrack, updateCurrent]);

  const removeStem = useCallback((id: string) => {
    if (!currentTrack) return;
    updateCurrent({ stems: currentTrack.stems.filter((s) => s.id !== id) });
  }, [currentTrack, updateCurrent]);

  // Splits
  const [splitsManuallyEdited, setSplitsManuallyEdited] = useState(false);

  const addSplit = useCallback(() => {
    if (!currentTrack) return;
    const newSplits = [
      ...currentTrack.splits,
      { id: crypto.randomUUID(), name: "", stage_name: "", role: "", percentage: 0, pro: "", ipi: "", publisher: "" },
    ];
    if (splitsManuallyEdited) {
      updateCurrent({ splits: newSplits });
    } else {
      updateCurrent({ splits: equalSplit(newSplits, "percentage") });
    }
  }, [currentTrack, updateCurrent, splitsManuallyEdited]);

  const updateSplit = useCallback((id: string, field: keyof Split, value: string | number) => {
    if (!currentTrack) return;
    const updated = currentTrack.splits.map((s) => (s.id === id ? { ...s, [field]: value } : s));
    if (field === "percentage") setSplitsManuallyEdited(true);
    updateCurrent({ splits: updated });
  }, [currentTrack, updateCurrent]);

  const removeSplit = useCallback((id: string) => {
    if (!currentTrack || currentTrack.splits.length <= 1) return;
    updateCurrent({ splits: currentTrack.splits.filter((s) => s.id !== id) });
  }, [currentTrack, updateCurrent]);

  const equalSplitAll = useCallback(() => {
    if (!currentTrack) return;
    updateCurrent({ splits: equalSplit(currentTrack.splits, "percentage") });
    setSplitsManuallyEdited(false);
  }, [currentTrack, updateCurrent]);

  const batchUpdateSplit = useCallback((id: string, current: Split, s: CollaboratorSuggestion) => {
    if (!currentTrack) return;
    var patch: Partial<Split> = { name: s.fullName };
    if (s.stage_name && !current.stage_name) patch.stage_name = s.stage_name;
    if (s.role && !current.role) patch.role = s.role;
    if (s.pro && !current.pro) patch.pro = s.pro;
    if (s.ipi && !current.ipi) patch.ipi = s.ipi;
    if (s.publisher && !current.publisher) patch.publisher = s.publisher;
    var updated = currentTrack.splits.map(function (sp) { return sp.id === id ? { ...sp, ...patch } : sp; });
    updateCurrent({ splits: updated });
  }, [currentTrack, updateCurrent]);

  const totalSplit = currentTrack ? currentTrack.splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0) : 0;

  // ─── Auto-sync splits → metadata ──────────────────────────
  const syncSplitsToMetadata = useCallback(() => {
    if (!currentTrack) return;
    const filled = currentTrack.splits.filter((s) => s.name.trim() && s.role);
    if (filled.length === 0) return;

    const byRole: Record<string, string[]> = {};
    for (const s of filled) {
      const roles = s.role.split(",").map((r) => r.trim()).filter(Boolean);
      for (const r of roles) {
        if (!byRole[r]) byRole[r] = [];
        byRole[r].push(s.name.trim());
      }
    }

    const updates: Partial<TrackEntry> = {};
    if (!currentTrack.writtenBy && byRole["Songwriter"]?.length) {
      updates.writtenBy = byRole["Songwriter"].join(", ");
    }
    if (!currentTrack.producedBy && byRole["Producer"]?.length) {
      updates.producedBy = byRole["Producer"].join(", ");
    }
    if (Object.keys(updates).length > 0) {
      updateCurrent(updates);
    }
  }, [currentTrack, updateCurrent]);

  // ─── Preview playback ──────────────────────────────────────

  const togglePreview = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlayingPreview) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  }, [isPlayingPreview]);

  // ─── XHR upload with progress ─────────────────────────────

  // Ensure the Supabase client has a valid session before storage operations
  const ensureSession = useCallback(async (): Promise<boolean> => {
    // Try refreshSession first for a fresh token
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session) return true;
    // Try getSession
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return true;
    // Restore from backup
    try {
      const backup = localStorage.getItem("trakalog_session_backup");
      if (backup) {
        const parsed = JSON.parse(backup);
        const accessToken = parsed?.access_token || parsed?.currentSession?.access_token;
        const refreshToken = parsed?.refresh_token || parsed?.currentSession?.refresh_token;
        if (accessToken && refreshToken) {
          const { data: restored } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (restored?.session) return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  const uploadFileWithProgress = useCallback(async (
    bucket: string,
    path: string,
    file: File,
    _contentType: string,
    onProgress: (pct: number) => void,
    upsert = false,
  ): Promise<{ error: string | null }> => {
    // Ensure valid session before upload
    const hasSession = await ensureSession();
    if (!hasSession) {
      return { error: "No auth session — please sign in again" };
    }

    onProgress(10);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert,
        cacheControl: "3600",
      });

    if (error) {
      return { error: error.message };
    }

    onProgress(100);
    return { error: null };
  }, [ensureSession]);

  // ─── Save ──────────────────────────────────────────────────

  const saveCurrentTrack = useCallback(async () => {
    if (!currentTrack || isSaving) return;
    setIsSaving(true);
    setUploadProgress(0);
    const fileSizeMB = currentTrack.file ? (currentTrack.file.size / (1024 * 1024)).toFixed(1) : "0";
    setUploadStage(t("uploadTrack.uploadingAudio", "Uploading audio") + " (" + fileSizeMB + " MB)...");
    setUploadComplete(false);

    try {
      // ── Stage 1: Upload audio (0–60%) ──
      let audioUrl: string | undefined;
      let waveformData: number[] | undefined;
      if (currentTrack.file && activeWorkspace) {
        const fileExt = currentTrack.file.name.split(".").pop() || "wav";
        const filePath = activeWorkspace.id + "/" + crypto.randomUUID() + "." + fileExt;

        const { error: uploadError } = await uploadFileWithProgress(
          "tracks",
          filePath,
          currentTrack.file,
          currentTrack.file.type || "audio/wav",
          (pct) => setUploadProgress(Math.round(pct * 0.6)), // 0–60%
        );

        if (uploadError) {
          console.error("Error uploading audio:", uploadError);
          toast.error("Upload failed: " + uploadError + ". Please try again.");
        } else {
          audioUrl = filePath;
        }
      }
      setUploadProgress(60);

      // ── Stage 2: Generate waveform (60–85%) ──
      setUploadStage(t("uploadTrack.generatingWaveform", "Generating waveform..."));
      setUploadProgress(65);
      if (audioUrl && currentTrack.file) {
        try {
          waveformData = await generateWaveform(currentTrack.file, 200);
        } catch (e) { console.error("Waveform generation error:", e); }
      }
      setUploadProgress(85);

      // ── Stage 4: Save track (85–100%) ──
      setUploadStage(t("uploadTrack.savingTrack", "Saving track..."));

      // Capture cover file before addTrack() — addTrack internally calls
      // fetchTracks() which triggers setTracks/re-render, so any reference
      // through currentTrack after that point could be stale in the closure.
      const coverFileToUpload = currentTrack.coverFile;
      const workspaceId = activeWorkspace?.id;

      const savedTrack = await addTrack({
        title: currentTrack.title.trim() || "Untitled",
        artist: currentTrack.artist.trim() || "Unknown Artist",
        genre: currentTrack.genre || "",
        bpm: parseInt(currentTrack.bpm) || 0,
        key: currentTrack.trackKey || "",
        duration: currentTrack.analysisResult?.duration || "0:00",
        mood: currentTrack.mood,
        status: "Available",
        language: currentTrack.language || "",
        voice: currentTrack.voice || "N/A",
        type: currentTrack.trackType || "Song",
        originalFileUrl: audioUrl,
        previewFileUrl: undefined,
        originalFileName: currentTrack.fileName,
        originalFileSize: currentTrack.file.size,
        notes: currentTrack.notes,
        lyrics: currentTrack.lyrics || undefined,
        waveformData: waveformData,
        chapters: null,
        splits: currentTrack.splits.filter((s) => s.name.trim()).map((s) => ({
          id: s.id,
          name: s.name,
          stage_name: s.stage_name || undefined,
          role: s.role,
          share: Number(s.percentage) || 0,
          pro: s.pro,
          ipi: s.ipi,
          publisher: s.publisher,
        })),
        isrc: currentTrack.isrc || undefined,
        label: currentTrack.label || undefined,
        publisher: currentTrack.publisher || undefined,
        writtenBy: currentTrack.writtenBy ? currentTrack.writtenBy.split(",").map((s) => s.trim()).filter(Boolean) : [],
        producedBy: currentTrack.producedBy ? currentTrack.producedBy.split(",").map((s) => s.trim()).filter(Boolean) : [],
        mixedBy: currentTrack.mixedBy || undefined,
        masteredBy: currentTrack.masteredBy || undefined,
        copyright: currentTrack.copyright || undefined,
        explicit: currentTrack.explicit || undefined,
      });
      setUploadProgress(90);

      // Upload cover art if provided — same pattern as TrackDetail.tsx
      if (savedTrack && coverFileToUpload && workspaceId) {
        setUploadStage(t("uploadTrack.uploadingCover", "Uploading cover..."));
        const coverPath = workspaceId + "/" + savedTrack.uuid + ".jpg";
        const { error: coverError } = await supabase.storage
          .from("covers")
          .upload(coverPath, coverFileToUpload, { upsert: true, contentType: coverFileToUpload.type });
        if (coverError) {
          console.error("Error uploading cover:", coverError);
        } else {
          const { data: urlData } = supabase.storage
            .from("covers")
            .getPublicUrl(coverPath);
          await supabase.rpc("update_track", {
            _user_id: user!.id,
            _track_id: savedTrack.uuid,
            _updates: { cover_url: urlData.publicUrl },
          });
          await refreshTracks();
        }
        setUploadProgress(98);
      }

      // ── Share to other workspaces if selected ──
      if (savedTrack && currentTrack.sharedWorkspaces.length > 0 && user && activeWorkspace) {
        for (var i = 0; i < currentTrack.sharedWorkspaces.length; i++) {
          await supabase.rpc("insert_catalog_share", {
            _user_id: user.id,
            _track_id: savedTrack.uuid,
            _source_workspace_id: activeWorkspace.id,
            _target_workspace_id: currentTrack.sharedWorkspaces[i],
            _access_level: "pitcher",
          });
        }
      }

      // ── Auto-save collaborators to contacts ──
      for (var si = 0; si < currentTrack.splits.length; si++) {
        var sp = currentTrack.splits[si];
        if (!sp.name.trim()) continue;
        var parts = sp.name.trim().split(" ");
        var firstRole = sp.role ? sp.role.split(",")[0].trim() : undefined;
        upsertCollaborator({
          firstName: parts[0] || "",
          lastName: parts.slice(1).join(" ") || "",
          role: firstRole || undefined,
          pro: sp.pro || undefined,
          ipi: sp.ipi || undefined,
          publisher: sp.publisher || undefined,
        });
      }

      setUploadProgress(100);
      var sharedCount = currentTrack.sharedWorkspaces.length;
      if (sharedCount === 1) {
        var sharedWs = workspaces.find(function (w) { return w.id === currentTrack.sharedWorkspaces[0]; });
        setUploadStage(t("uploadTrack.trackUploadedAndShared", { name: sharedWs?.name || "", defaultValue: "Track uploaded and shared to " + (sharedWs?.name || "") + "!" }));
      } else if (sharedCount > 1) {
        setUploadStage(t("uploadTrack.trackUploadedAndSharedMultiple", { count: sharedCount, defaultValue: "Track uploaded and shared to " + sharedCount + " workspaces!" }));
      } else {
        setUploadStage(t("uploadTrack.trackUploaded", "Track uploaded!"));
      }
      setUploadComplete(true);

      // Fire-and-forget: compress audio to MP3 128kbps client-side, then transcribe lyrics
      if (savedTrack && audioUrl && currentTrack.file) {
        const bgFile = currentTrack.file;
        const bgTrackUuid = savedTrack.uuid;
        const bgAudioPath = audioUrl;
        (async () => {
          // Step 1: MP3 compression
          try {
            toast.info(t("uploadTrack.compressingPreview", "Compressing MP3 preview..."));
            const mp3Blob = await encodeToMp3(bgFile);
            const previewPath = bgAudioPath.replace(/\.[^.]+$/, "_preview.mp3");
            const { error: upErr } = await supabase.storage
              .from("tracks")
              .upload(previewPath, mp3Blob, { contentType: "audio/mp3", upsert: true });
            if (upErr) throw upErr;
            await supabase.rpc("update_track", { _user_id: user!.id, _track_id: bgTrackUuid, _updates: { audio_preview_url: previewPath } });
            toast.success(t("uploadTrack.mp3PreviewReady", "MP3 preview ready"));
          } catch (err) {
            console.error("Background MP3 compression failed:", err);
            toast.warning(t("uploadTrack.mp3PreviewFailed", "MP3 preview failed — track is still available"));
          }

          // Step 2: Lyrics transcription (fire-and-forget) — only if user didn't provide lyrics
          if (!currentTrack.lyrics?.trim()) {
          try {
            toast.info(t("uploadTrack.transcribingLyrics", "Transcribing lyrics..."));
            const res = await fetch(SUPABASE_URL + "/functions/v1/transcribe-lyrics", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
                "apikey": SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ track_id: bgTrackUuid }),
            });
            const json = await res.json();
            if (json.empty) {
              toast.info(t("uploadTrack.noVocalsDetected", "No vocals detected"));
            } else if (json.success) {
              toast.success(t("uploadTrack.lyricsTranscribed", "Lyrics transcribed!"));
              refreshTracks();

              // Sync transcribed lyrics to sonic_dna.user_metadata
              try {
                const { data: row } = await supabase
                  .from("tracks")
                  .select("sonic_dna, lyrics")
                  .eq("id", bgTrackUuid)
                  .single();
                const existingSonicDna = row?.sonic_dna as Record<string, unknown> | null;
                if (existingSonicDna && row?.lyrics) {
                  const rawLyrics = (row.lyrics as string).replace(/^\[auto-transcribed\]\n/, "");
                  const updatedSonicDna = {
                    ...existingSonicDna,
                    user_metadata: {
                      ...(existingSonicDna.user_metadata as Record<string, unknown> || {}),
                      lyrics: rawLyrics,
                    },
                  };
                  await supabase.rpc("update_track", { _user_id: user!.id, _track_id: bgTrackUuid, _updates: { sonic_dna: updatedSonicDna } });
                }
              } catch (err) {
                console.error("Failed to sync lyrics to sonic_dna:", err);
              }
            }
          } catch (err) {
            console.error("Lyrics transcription failed:", err);
          }
          } // end if no user-provided lyrics
        })();
      }

      // Show success for 1.5s then proceed
      await new Promise((r) => setTimeout(r, 1500));

      setUploadComplete(false);
      setUploadProgress(0);
      setUploadStage("");

      if (currentIdx < queue.length - 1) {
        setCurrentIdx(currentIdx + 1);
        setEditStep(0);
        setIsPlayingPreview(false);
      } else {
        onOpenChange(false);
        handleReset();
      }
    } catch (err) {
      console.error("Error saving track:", err);
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
      setUploadStage("");
      setUploadComplete(false);
    }
  }, [currentTrack, currentIdx, queue, addTrack, onOpenChange, isSaving, activeWorkspace, uploadFileWithProgress]);

  // ─── Navigation ────────────────────────────────────────────

  const handleReset = () => {
    setPhase("upload");
    setQueue([]);
    setCurrentIdx(0);
    setEditStep(0);
    setIsDragOver(false);
    setIsPlayingPreview(false);
    setQuickUploadIdx(-1);
    setQuickUploadDone(false);
  };

  const canProceedEdit = () => {
    return true; // All steps are optional — users can skip
  };

  const startEditing = () => {
    if (queue.length === 0) return;
    setPhase("edit");
    setCurrentIdx(0);
    setEditStep(0);
  };

  const allProcessing = queue.some((e) => e.analyzing);

  // ─── Quick Upload ───────────────────────────────────────────

  const [quickUploadIdx, setQuickUploadIdx] = useState(-1);
  const [quickUploadDone, setQuickUploadDone] = useState(false);

  const handleQuickUpload = useCallback(async () => {
    if (queue.length === 0 || isSaving) return;
    setIsSaving(true);
    setQuickUploadDone(false);

    try {
      for (let qi = 0; qi < queue.length; qi++) {
        const entry = queue[qi];
        setQuickUploadIdx(qi);
        setUploadProgress(0);
        setUploadStage(
          queue.length === 1
            ? "Uploading your track... Please wait"
            : "Uploading track " + (qi + 1) + " of " + queue.length + "... Please wait"
        );

        // ── Upload audio ──
        let audioUrl: string | undefined;
        let waveformData: number[] | undefined;
        if (entry.file && activeWorkspace) {
          const fileExt = entry.file.name.split(".").pop() || "wav";
          const filePath = activeWorkspace.id + "/" + crypto.randomUUID() + "." + fileExt;

          const { error: uploadError } = await uploadFileWithProgress(
            "tracks",
            filePath,
            entry.file,
            entry.file.type || "audio/wav",
            (pct) => setUploadProgress(Math.round(pct * 0.6)),
          );

          if (uploadError) {
            console.error("Error uploading audio:", uploadError);
            toast.error("Upload failed: " + uploadError + ". Please try again.");
          } else {
            audioUrl = filePath;
          }
        }
        setUploadProgress(60);

        // ── Waveform ──
        setUploadProgress(65);
        if (audioUrl && entry.file) {
          try {
            waveformData = await generateWaveform(entry.file, 200);
          } catch (e) { console.error("Waveform generation error:", e); }
        }
        setUploadProgress(85);

        // ── Save to DB ──
        const savedTrack = await addTrack({
          title: entry.title.trim() || "Untitled",
          artist: entry.artist.trim() || "",
          genre: "",
          bpm: 0,
          key: "",
          duration: entry.analysisResult?.duration || "0:00",
          mood: [],
          status: "Available",
          language: "",
          voice: "N/A",
          type: "Song",
          originalFileUrl: audioUrl,
          previewFileUrl: undefined,
          originalFileName: entry.fileName,
          originalFileSize: entry.file.size,
          notes: "",
          lyrics: undefined,
          waveformData: waveformData,
          chapters: null,
          splits: [],
        });
        setUploadProgress(100);

        // ── Fire-and-forget: MP3 + lyrics transcription ──
        if (savedTrack && audioUrl && entry.file) {
          const bgFile = entry.file;
          const bgTrackUuid = savedTrack.uuid;
          const bgAudioPath = audioUrl;
          (async () => {
            try {
              toast.info(t("uploadTrack.compressingPreview", "Compressing MP3 preview..."));
              const mp3Blob = await encodeToMp3(bgFile);
              const previewPath = bgAudioPath.replace(/\.[^.]+$/, "_preview.mp3");
              const { error: upErr } = await supabase.storage
                .from("tracks")
                .upload(previewPath, mp3Blob, { contentType: "audio/mp3", upsert: true });
              if (upErr) throw upErr;
              await supabase.rpc("update_track", { _user_id: user!.id, _track_id: bgTrackUuid, _updates: { audio_preview_url: previewPath } });
              toast.success(t("uploadTrack.mp3PreviewReady", "MP3 preview ready"));
            } catch (err) {
              console.error("Background MP3 compression failed:", err);
              toast.warning(t("uploadTrack.mp3PreviewFailed", "MP3 preview failed — track is still available"));
            }

            try {
              toast.info(t("uploadTrack.transcribingLyrics", "Transcribing lyrics..."));
              const res = await fetch(SUPABASE_URL + "/functions/v1/transcribe-lyrics", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": "Bearer " + SUPABASE_PUBLISHABLE_KEY,
                  "apikey": SUPABASE_PUBLISHABLE_KEY,
                },
                body: JSON.stringify({ track_id: bgTrackUuid }),
              });
              const json = await res.json();
              if (json.empty) {
                toast.info(t("uploadTrack.noVocalsDetected", "No vocals detected"));
              } else if (json.success) {
                toast.success(t("uploadTrack.lyricsTranscribed", "Lyrics transcribed!"));
                refreshTracks();
                try {
                  const { data: row } = await supabase
                    .from("tracks")
                    .select("sonic_dna, lyrics")
                    .eq("id", bgTrackUuid)
                    .single();
                  const existingSonicDna = row?.sonic_dna as Record<string, unknown> | null;
                  if (existingSonicDna && row?.lyrics) {
                    const rawLyrics = (row.lyrics as string).replace(/^\[auto-transcribed\]\n/, "");
                    const updatedSonicDna = {
                      ...existingSonicDna,
                      user_metadata: {
                        ...(existingSonicDna.user_metadata as Record<string, unknown> || {}),
                        lyrics: rawLyrics,
                      },
                    };
                    await supabase.rpc("update_track", { _user_id: user!.id, _track_id: bgTrackUuid, _updates: { sonic_dna: updatedSonicDna } });
                  }
                } catch (err) {
                  console.error("Failed to sync lyrics to sonic_dna:", err);
                }
              }
            } catch (err) {
              console.error("Lyrics transcription failed:", err);
            }
          })();
        }
      }

      // Show success screen
      setQuickUploadDone(true);
      await new Promise((r) => setTimeout(r, 2000));

      onOpenChange(false);
      handleReset();
    } catch (err) {
      console.error("Quick upload error:", err);
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
      setUploadStage("");
      setQuickUploadIdx(-1);
      setQuickUploadDone(false);
    }
  }, [queue, isSaving, addTrack, activeWorkspace, uploadFileWithProgress, onOpenChange]);

  // ─── Render ────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(val) => { if (isSaving) return; if (!val) handleReset(); onOpenChange(val); }}>
      <DialogContent
        className="md:max-w-2xl overflow-hidden flex flex-col p-0 gap-0 bg-card border-border"
        onInteractOutside={(e) => { if (isSaving) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (isSaving) e.preventDefault(); }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3">
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
            {phase === "upload"
              ? t("uploadTrack.uploadTracks")
              : t("uploadTrack.trackOf", { current: currentIdx + 1, total: queue.length })
            }
          </DialogTitle>

          {phase === "edit" && (
            <>
              {/* Track navigator for bulk */}
              {queue.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {queue.map((entry, i) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        if (i <= currentIdx) {
                          setCurrentIdx(i);
                          setEditStep(0);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-full text-2xs font-semibold whitespace-nowrap transition-all ${
                        i === currentIdx
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : i < currentIdx
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-secondary text-muted-foreground/40 border border-transparent"
                      }`}
                    >
                      {i < currentIdx && <Check className="w-2.5 h-2.5 inline mr-1" />}
                      {entry.title || entry.fileName}
                    </button>
                  ))}
                </div>
              )}
              {/* Step indicator */}
              <div className="flex items-center gap-1">
                {EDIT_STEPS.map((s, i) => (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <button
                      onClick={() => i < editStep && setEditStep(i)}
                      className={`flex items-center gap-1.5 text-2xs font-semibold transition-colors ${
                        i === editStep
                          ? "text-foreground"
                          : i < editStep
                          ? "text-brand-orange cursor-pointer hover:text-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold transition-all ${
                          i < editStep
                            ? "btn-brand shadow-none text-primary-foreground"
                            : i === editStep
                            ? "bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                            : "bg-secondary text-muted-foreground/40"
                        }`}
                      >
                        {i < editStep ? <Check className="w-2.5 h-2.5" /> : i + 1}
                      </span>
                      <span className="hidden sm:inline">{s}</span>
                    </button>
                    {i < EDIT_STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-1 transition-colors ${i < editStep ? "bg-brand-orange/40" : "bg-border"}`} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase === "upload" ? "upload" : `edit-${currentIdx}-${editStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {phase === "upload" && (
                <StepBulkUpload
                  queue={queue}
                  isDragOver={isDragOver}
                  fileInputRef={fileInputRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onAddFiles={addFiles}
                  onRemove={removeFromQueue}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 0 && (
                <StepInfo
                  title={currentTrack.title} setTitle={(v) => updateCurrent({ title: v })}
                  artist={currentTrack.artist} setArtist={(v) => updateCurrent({ artist: v })}
                  bpm={currentTrack.bpm} setBpm={(v) => updateCurrent({ bpm: v })}
                  trackKey={currentTrack.trackKey} setTrackKey={(v) => updateCurrent({ trackKey: v })}
                  genre={currentTrack.genre} setGenre={(v) => updateCurrent({ genre: v })}
                  mood={currentTrack.mood} toggleMood={toggleMood} addCustomMood={addCustomMood}
                  trackType={currentTrack.trackType} setTrackType={(v) => updateCurrent({ trackType: v })}
                  voice={currentTrack.voice} setVoice={(v) => updateCurrent({ voice: v })}
                  language={currentTrack.language} setLanguage={(v) => updateCurrent({ language: v })}
                  notes={currentTrack.notes} setNotes={(v) => updateCurrent({ notes: v })}
                  analysisResult={currentTrack.analysisResult}
                  analyzing={currentTrack.analyzing}
                  coverFile={currentTrack.coverFile}
                  setCoverFile={(f) => updateCurrent({ coverFile: f })}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 1 && (
                <StepLyrics
                  lyrics={currentTrack.lyrics}
                  onUpdate={(v: string) => updateCurrent({ lyrics: v })}
                  fileInputRef={lyricsFileInputRef}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 2 && (
                <StepStems
                  stems={currentTrack.stems}
                  stemsInputRef={stemsInputRef}
                  onUpload={handleStemsUpload}
                  onRemove={removeStem}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 3 && (
                <StepDetails
                  splits={currentTrack.splits}
                  totalSplit={totalSplit}
                  onAdd={addSplit}
                  onUpdate={updateSplit}
                  onRemove={removeSplit}
                  onBatchUpdate={batchUpdateSplit}
                  onEqualSplit={equalSplitAll}
                  details={currentTrack.details}
                  updateDetail={updateDetail}
                  addDetailEntry={addDetailEntry}
                  removeDetailEntry={removeDetailEntry}
                  isrc={currentTrack.isrc}
                  upc={currentTrack.upc}
                  album={currentTrack.album}
                  label={currentTrack.label}
                  publisher={currentTrack.publisher}
                  releaseDate={currentTrack.releaseDate}
                  writtenBy={currentTrack.writtenBy}
                  producedBy={currentTrack.producedBy}
                  mixedBy={currentTrack.mixedBy}
                  masteredBy={currentTrack.masteredBy}
                  copyright={currentTrack.copyright}
                  explicit={currentTrack.explicit}
                  onMetadataChange={(field: string, value: string | boolean) => updateCurrent({ [field]: value })}
                  contacts={contacts}
                  existingSplitNames={existingSplitNames}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 4 && (
                <StepReview
                  title={currentTrack.title} artist={currentTrack.artist}
                  bpm={currentTrack.bpm} trackKey={currentTrack.trackKey}
                  genre={currentTrack.genre} mood={currentTrack.mood}
                  trackType={currentTrack.trackType}
                  voice={currentTrack.voice}
                  language={currentTrack.language} notes={currentTrack.notes}
                  audioFile={currentTrack.file} stems={currentTrack.stems}
                  splits={currentTrack.splits} totalSplit={totalSplit}
                  details={currentTrack.details} lyrics={currentTrack.lyrics}
                  coverFile={currentTrack.coverFile}
                  isrc={currentTrack.isrc} upc={currentTrack.upc}
                  album={currentTrack.album} label={currentTrack.label}
                  publisher={currentTrack.publisher} releaseDate={currentTrack.releaseDate}
                  writtenBy={currentTrack.writtenBy} producedBy={currentTrack.producedBy}
                  mixedBy={currentTrack.mixedBy} masteredBy={currentTrack.masteredBy}
                  copyright={currentTrack.copyright} explicit={currentTrack.explicit}
                />
              )}
              {phase === "edit" && currentTrack && editStep === 5 && (
                <StepTeams
                  activeWorkspaceName={activeWorkspace?.name || ""}
                  otherWorkspaces={workspaces.filter(function (ws, idx, arr) { return ws.id !== activeWorkspace?.id && arr.findIndex(function (w) { return w.id === ws.id; }) === idx; })}
                  selectedWorkspaces={currentTrack.sharedWorkspaces}
                  onToggleWorkspace={function (wsId) {
                    var sharedWorkspaces = currentTrack.sharedWorkspaces.includes(wsId)
                      ? currentTrack.sharedWorkspaces.filter(function (id) { return id !== wsId; })
                      : currentTrack.sharedWorkspaces.concat(wsId);
                    updateCurrent({ sharedWorkspaces: sharedWorkspaces });
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          {isSaving && quickUploadIdx >= 0 ? (
            <div className="space-y-3">
              {quickUploadDone ? (
                <div className="text-center py-2">
                  <p className="text-sm font-semibold text-emerald-400">
                    {queue.length === 1
                      ? "Track uploaded successfully! BPM & Key analysis is in progress — check back in a minute."
                      : queue.length + " tracks uploaded successfully! BPM & Key analysis is in progress — check back in a minute."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-orange" />
                      <span className="text-[13px] font-semibold text-foreground">
                        {uploadStage}
                      </span>
                    </div>
                    <span className="text-[13px] font-bold tabular-nums text-foreground">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Your tracks will appear in your catalog shortly. Sonic DNA analysis will detect BPM & Key automatically.
                  </p>
                </>
              )}
            </div>
          ) : isSaving ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {uploadComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-orange" />
                  )}
                  <span className={`text-[13px] font-semibold ${uploadComplete ? "text-emerald-400" : "text-foreground"}`}>
                    {uploadStage}
                  </span>
                </div>
                <span className="text-[13px] font-bold tabular-nums text-foreground">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : (
            <div>
              {phase === "upload" ? (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs text-muted-foreground">
                      {queue.length} / {MAX_TRACKS} {t("common.tracks")}
                    </span>
                  </div>
                  {queue.length > 0 && !allProcessing && (
                    <div className="flex gap-3">
                      {/* Quick Upload */}
                      <div className="flex-1">
                        <button
                          onClick={handleQuickUpload}
                          disabled={queue.length === 0 || allProcessing}
                          className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold border border-brand-orange text-brand-orange hover:bg-brand-orange/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Zap className="w-3.5 h-3.5" /> Quick Upload
                        </button>
                        <p className="text-xs text-muted-foreground mt-2 max-w-[260px]">
                          Skip all steps — upload now. BPM, Key & audio analysis will run automatically. You can always add lyrics, splits, credits and all other details later in Track Details.
                        </p>
                      </div>
                      {/* Continue with details */}
                      <div className="flex-1">
                        <button
                          onClick={startEditing}
                          disabled={queue.length === 0 || allProcessing}
                          className="w-full btn-brand flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Continue with details <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <p className="text-xs text-muted-foreground mt-2">
                          Fill in metadata, lyrics, splits & credits step by step
                        </p>
                      </div>
                    </div>
                  )}
                  {(queue.length === 0 || allProcessing) && (
                    <div className="flex justify-end">
                      <button
                        disabled
                        className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {allProcessing ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("uploadTrack.processing", "Processing...")}</>
                        ) : (
                          <>{t("uploadTrack.continue", "Continue")} <ChevronRight className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (editStep > 0) setEditStep(editStep - 1);
                      else if (currentIdx > 0) {
                        setCurrentIdx(currentIdx - 1);
                        setEditStep(EDIT_STEPS.length - 1);
                      } else {
                        setPhase("upload");
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> {t("uploadTrack.back")}
                  </button>
                  {editStep < EDIT_STEPS.length - 1 ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (editStep === 3) syncSplitsToMetadata(); setEditStep(editStep + 1); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-border/80"
                      >
                        {t("uploadTrack.skip", "Skip")}
                      </button>
                      <button
                        onClick={() => { if (editStep === 3) syncSplitsToMetadata(); setEditStep(editStep + 1); }}
                        className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold"
                      >
                        {t("uploadTrack.next")} <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={saveCurrentTrack}
                      className="btn-brand flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[13px] font-semibold"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {currentIdx < queue.length - 1
                        ? t("uploadTrack.saveAndNext", "Save & Next") + " (" + (currentIdx + 2) + "/" + queue.length + ")"
                        : currentTrack && currentTrack.sharedWorkspaces.length > 0
                        ? t("uploadTrack.uploadAndShare", "Upload & Share")
                        : queue.length > 1
                        ? t("uploadTrack.saveAllToCatalog", "Save All to Catalog")
                        : t("uploadTrack.saveToCatalog")
                      }
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═════════════════════════════════════════════════════════════════════════════
   Step Components
   ═════════════════════════════════════════════════════════════════════════════ */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{children}</label>;
}

function FieldInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
    />
  );
}

function FieldSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: readonly string[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none font-medium"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function LanguageMultiSelect({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(", ").filter(Boolean) : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = LANGUAGES.filter((l) => !selected.includes(l) && l.toLowerCase().includes(search.toLowerCase()));

  const add = (lang: string) => {
    const next = [...selected, lang].join(", ");
    onChange(next);
    setSearch("");
  };
  const remove = (lang: string) => {
    const next = selected.filter((s) => s !== lang).join(", ");
    onChange(next);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((lang) => (
            <span key={lang} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-brand-orange/10 text-brand-orange">
              {lang}
              <button type="button" onClick={() => remove(lang)} className="hover:text-foreground transition-colors"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={selected.length > 0 ? "" : placeholder}
        className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg bg-secondary border border-border shadow-lg">
          {filtered.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => add(lang)}
              className="w-full text-left px-3 py-1.5 text-[13px] text-foreground hover:bg-accent/10 transition-colors font-medium"
            >
              {lang}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Bulk Upload Step ─── */

function StepBulkUpload({
  queue, isDragOver, fileInputRef,
  onDragOver, onDragLeave, onDrop, onAddFiles, onRemove,
}: {
  queue: TrackEntry[];
  isDragOver: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("uploadTrack.uploadAudioFiles", "Upload Audio Files")}</h3>
        <p className="text-2xs text-muted-foreground">
          {t("uploadTrack.dragDropDesc", "Drag & drop up to " + MAX_TRACKS + " tracks, or click to browse. Each track will be analyzed automatically.")}
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all group ${
          isDragOver
            ? "border-brand-orange bg-brand-orange/5 scale-[1.02]"
            : queue.length >= MAX_TRACKS
            ? "border-border/50 opacity-50 cursor-not-allowed"
            : "border-border hover:border-brand-orange/30"
        }`}
      >
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
          isDragOver ? "bg-brand-orange/15" : "bg-secondary group-hover:bg-brand-orange/10"
        }`}>
          <Upload className={`w-6 h-6 transition-colors ${
            isDragOver ? "text-brand-orange" : "text-muted-foreground group-hover:text-brand-orange"
          }`} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            {isDragOver ? t("uploadTrack.dropFilesHere", "Drop files here") : t("uploadTrack.dragDropAudio", "Drag & drop audio files")}
          </p>
          <p className="text-2xs text-muted-foreground mt-1">
            {t("uploadTrack.orClickToBrowse", "or click to browse") + " · WAV, MP3, FLAC, AIFF · " + t("uploadTrack.upTo", "up to") + " " + MAX_TRACKS + " " + t("common.tracks")}
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/mp4,audio/m4a,audio/ogg,.wav,.mp3,.flac,.aiff,.aif,.m4a,.ogg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              onAddFiles(Array.from(e.target.files));
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t("uploadTrack.uploadQueue", "Upload Queue")} ({queue.length})
            </p>
            {queue.length >= MAX_TRACKS && (
              <span className="text-2xs text-brand-orange font-semibold">{t("uploadTrack.maximumReached", "Maximum reached")}</span>
            )}
          </div>
          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
            {queue.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border group">
                <div className="w-8 h-8 rounded-lg bg-brand-orange/10 flex items-center justify-center shrink-0">
                  <FileAudio className="w-3.5 h-3.5 text-brand-orange" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">{entry.fileName}</p>
                  <div className="flex items-center gap-2 text-2xs text-muted-foreground">
                    <span>{entry.fileSize}</span>
                    {entry.analyzing && (
                      <span className="flex items-center gap-1 text-brand-purple">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> {t("uploadTrack.analyzing", "Analyzing...")}
                      </span>
                    )}
                    {entry.analysisResult && !entry.analyzing && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Check className="w-2.5 h-2.5" /> {t("uploadTrack.analysisComplete", "Analysis complete")}
                      </span>
                    )}
                    {entry.analysisError && (
                      <span className="flex items-center gap-1 text-destructive">
                        <AlertCircle className="w-2.5 h-2.5" /> {t("uploadTrack.analysisFailed", "Analysis failed")}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
                  className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Info Step ─── */


function StepInfo({
  title, setTitle, artist, setArtist, bpm, setBpm,
  trackKey, setTrackKey, genre, setGenre, mood, toggleMood, addCustomMood,
  trackType, setTrackType,
  voice, setVoice,
  language, setLanguage, notes, setNotes,
  analysisResult, analyzing,
  coverFile, setCoverFile,
}: {
  title: string; setTitle: (v: string) => void;
  artist: string; setArtist: (v: string) => void;
  bpm: string; setBpm: (v: string) => void;
  trackKey: string; setTrackKey: (v: string) => void;
  genre: string; setGenre: (v: string) => void;
  mood: string[]; toggleMood: (v: string) => void; addCustomMood: (v: string) => void;
  trackType: string; setTrackType: (v: string) => void;
  voice: string; setVoice: (v: string) => void;
  language: string; setLanguage: (v: string) => void;
  notes: string; setNotes: (v: string) => void;
  analysisResult: AudioAnalysisResult | null;
  analyzing: boolean;
  coverFile: File | null;
  setCoverFile: (f: File | null) => void;
}) {
  const { t } = useTranslation();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverPreviewUrl = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : null, [coverFile]);
  useEffect(() => {
    return () => { if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl); };
  }, [coverPreviewUrl]);

  const handleCoverSelect = (file: File) => {
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB max
    setCoverFile(file);
  };

  return (
    <div className="space-y-4">
      {/* Cover Art */}
      <div className="space-y-1.5">
        <FieldLabel>{t("uploadTrack.coverArt", "Cover Art")} <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">({t("uploadTrack.optional", "optional")})</span></FieldLabel>
        <div className="flex items-start gap-4">
          <div
            onClick={() => coverInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) handleCoverSelect(file);
            }}
            className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-brand-orange/30 flex items-center justify-center cursor-pointer transition-all group overflow-hidden shrink-0"
          >
            {coverPreviewUrl ? (
              <img src={coverPreviewUrl} alt="Cover preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1">
                <ImagePlus className="w-6 h-6 text-muted-foreground group-hover:text-brand-orange transition-colors" />
                <span className="text-[9px] text-muted-foreground group-hover:text-brand-orange transition-colors">{t("uploadTrack.addCover", "Add cover")}</span>
              </div>
            )}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCoverSelect(file);
                e.target.value = "";
              }}
            />
          </div>
          {coverFile && (
            <div className="flex flex-col gap-1 pt-1">
              <p className="text-[13px] font-medium text-foreground truncate max-w-[200px]">{coverFile.name}</p>
              <p className="text-2xs text-muted-foreground">{formatFileSize(coverFile.size)}</p>
              <button
                onClick={() => setCoverFile(null)}
                className="text-2xs text-destructive hover:text-destructive/80 font-semibold mt-1 self-start"
              >
                {t("uploadTrack.remove", "Remove")}
              </button>
            </div>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/50">JPG, PNG or WebP · max 5 MB</p>
      </div>

      {/* Smart analysis banner */}
      {(analyzing || analysisResult) && (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-brand-purple/15 flex items-center justify-center">
              {analyzing ? (
                <div className="w-2.5 h-2.5 rounded-full border-2 border-brand-purple border-t-transparent animate-spin" />
              ) : (
                <Check className="w-3 h-3 text-brand-purple" />
              )}
            </div>
            <span className="text-2xs font-semibold text-foreground">
              {analyzing ? t("uploadTrack.analyzingAudio", "Analyzing audio...") : t("uploadTrack.audioReady", "Audio Ready")}
            </span>
          </div>
          {!analyzing && (
            <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-secondary p-2 text-center group/bpm cursor-text">
                <p className="text-2xs text-muted-foreground font-medium">{t("uploadTrack.bpm")}</p>
                <input
                  type="number"
                  value={bpm}
                  onChange={function (e) { setBpm(e.target.value); }}
                  className="w-full text-center text-sm font-bold text-brand-orange bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="—"
                />
              </div>
              <div className="rounded-lg bg-secondary p-2 text-center">
                <p className="text-2xs text-muted-foreground font-medium">{t("uploadTrack.key")}</p>
                <select
                  value={trackKey}
                  onChange={function (e) { setTrackKey(e.target.value); }}
                  className="w-full text-center text-sm font-bold text-brand-pink bg-transparent outline-none border-none appearance-none cursor-pointer"
                >
                  <option value="">—</option>
                  {KEYS.map(function (k) { return <option key={k} value={k}>{k}</option>; })}
                </select>
              </div>
              <div className="rounded-lg bg-secondary p-2 text-center">
                <p className="text-2xs text-muted-foreground font-medium">{t("uploadTrack.duration", "Duration")}</p>
                <p className="text-sm font-bold text-brand-purple">{analysisResult?.duration || "—"}</p>
              </div>
            </div>
            <p className="text-2xs text-muted-foreground">{t("uploadTrack.autoDetectNote", "BPM & Key will be auto-detected by Sonic DNA after upload — or enter them now if you already know them")}</p>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>{t("uploadTrack.trackTitle")} *</FieldLabel>
          <FieldInput value={title} onChange={setTitle} placeholder={t("uploadTrack.titlePlaceholder")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>{t("uploadTrack.artist")} *</FieldLabel>
          <FieldInput value={artist} onChange={setArtist} placeholder={t("uploadTrack.artistPlaceholder")} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>{t("uploadTrack.genre")}</FieldLabel>
          {genre === "__other__" || (!(GENRES as readonly string[]).includes(genre) && genre !== "") ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={genre === "__other__" ? "" : genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder={t("uploadTrack.enterCustomGenre", "Enter custom genre")}
                autoFocus
                className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40"
              />
              <button
                onClick={() => setGenre("")}
                className="shrink-0 h-9 px-2 rounded-lg bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="h-9 w-full px-3 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all appearance-none font-medium"
            >
              <option value="">{t("uploadTrack.selectGenre")}</option>
              {GENRES.map((o) => <option key={o} value={o}>{o}</option>)}
              <option value="__other__">Other…</option>
            </select>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>{t("uploadTrack.mood")} <span className="text-muted-foreground/50 normal-case tracking-normal font-normal">({mood.length}/8)</span></FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => toggleMood(m)}
              className={`px-2.5 py-1 rounded-full text-2xs font-semibold transition-all ${
                mood.includes(m)
                  ? "bg-brand-orange/15 text-brand-orange border border-brand-orange/30"
                  : "bg-secondary text-muted-foreground border border-border hover:border-brand-orange/20 hover:text-foreground"
              }`}
            >
              #{m}
            </button>
          ))}
          {mood.filter((m) => !(MOODS as readonly string[]).includes(m)).map((m) => (
            <button
              key={m}
              onClick={() => toggleMood(m)}
              className="px-2.5 py-1 rounded-full text-2xs font-semibold transition-all bg-brand-orange/15 text-brand-orange border border-brand-orange/30 flex items-center gap-1"
            >
              #{m}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Add custom tag..."
          className="h-7 px-2.5 rounded-full bg-secondary border border-border text-2xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40 w-36"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomMood((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>{t("uploadTrack.type", "Type")}</FieldLabel>
          <FieldSelect value={trackType} onChange={setTrackType} options={["Song", "Instrumental", "Sample", "Acapella"]} placeholder={t("uploadTrack.selectType", "Select type")} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>{t("editTrack.gender", "Gender")}</FieldLabel>
          <FieldSelect value={voice} onChange={setVoice} options={["Male", "Female", "Duet", "N/A"]} placeholder={t("uploadTrack.selectGender", "Select gender")} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel>{t("uploadTrack.language")}</FieldLabel>
          <LanguageMultiSelect value={language} onChange={setLanguage} placeholder={t("uploadTrack.selectLanguage")} />
        </div>
      </div>
      <div className="space-y-1.5">
        <FieldLabel>{t("uploadTrack.notes")}</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("uploadTrack.notesPlaceholder", "Any additional notes about this track...")}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-[13px] text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40 resize-none"
        />
      </div>

    </div>
  );
}

/* ─── Stems Step ─── */

function StepStems({
  stems, stemsInputRef, onUpload, onRemove,
}: {
  stems: StemFile[];
  stemsInputRef: React.RefObject<HTMLInputElement>;
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("uploadTrack.stemFiles", "Stem Files")}</h3>
        <p className="text-2xs text-muted-foreground">{t("uploadTrack.stemFilesDesc", "Upload individual stems (Kick, Snare, Bass, Guitar, Vocals, etc.)")}</p>
      </div>
      <div
        onClick={() => stemsInputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-brand-orange/30 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-all group"
      >
        <Plus className="w-5 h-5 text-muted-foreground group-hover:text-brand-orange transition-colors" />
        <p className="text-[13px] font-semibold text-foreground">{t("uploadTrack.addStemFiles", "Add stem files")}</p>
        <p className="text-2xs text-muted-foreground">{t("uploadTrack.selectAudioFiles", "Select one or multiple audio files")}</p>
        <input
          ref={stemsInputRef}
          type="file"
          accept="audio/wav,audio/x-wav,audio/mpeg,audio/mp3,audio/flac,audio/x-flac,audio/aiff,audio/x-aiff,audio/mp4,audio/m4a,audio/ogg,.wav,.mp3,.flac,.aiff,.aif,.m4a,.ogg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {stems.length > 0 && (
        <div className="space-y-1.5">
          {stems.map((stem) => (
            <div key={stem.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-secondary/50 border border-border">
              <FileAudio className="w-3.5 h-3.5 text-brand-orange shrink-0" />
              <span className="text-[13px] font-medium text-foreground truncate flex-1">{stem.name}</span>
              <span className="text-2xs text-muted-foreground shrink-0">{stem.size}</span>
              <button onClick={() => onRemove(stem.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <p className="text-2xs text-muted-foreground pt-1">{t("uploadTrack.stemsAdded", { count: stems.length, defaultValue: stems.length + " stem(s) added" })}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Splits Step ─── */

function StepSplits({
  splits, totalSplit, onAdd, onUpdate, onRemove, onBatchUpdate, onEqualSplit, contacts, existingSplitNames,
}: {
  splits: Split[];
  totalSplit: number;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Split, value: string | number) => void;
  onRemove: (id: string) => void;
  onBatchUpdate: (id: string, current: Split, suggestion: CollaboratorSuggestion) => void;
  onEqualSplit: () => void;
  contacts: Contact[];
  existingSplitNames: string[];
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("uploadTrack.splitsAndCredits", "Splits & Credits")}</h3>
        <p className="text-2xs text-muted-foreground">{t("uploadTrack.splitsDesc", "Add collaborators and assign ownership splits")}</p>
      </div>
      <div className="space-y-3">
        {splits.map((split, idx) => (
          <div key={split.id} className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-orange/10 flex items-center justify-center">
                  <User className="w-3 h-3 text-brand-orange" />
                </div>
                <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{t("uploadTrack.contributor", "Contributor")} {idx + 1}</span>
              </div>
              {splits.length > 1 && (
                <button onClick={() => onRemove(split.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.name", "Name")}</label>
                <CollaboratorAutocomplete value={split.name} onChange={(v) => onUpdate(split.id, "name", v)} onSelect={(s) => { onBatchUpdate(split.id, split, s); }} contacts={contacts} existingSplitNames={existingSplitNames} placeholder={t("uploadTrack.fullName", "Full name")} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">Stage Name</label>
                <input value={split.stage_name} onChange={(e) => onUpdate(split.id, "stage_name", e.target.value)} placeholder="Artist / Stage name" className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.role", "Role")}</label>
                <MultiSelectChips options={SPLIT_ROLES} selected={split.role ? split.role.split(", ").filter(Boolean) : []} onChange={function (vals) { onUpdate(split.id, "role", vals.join(", ")); }} placeholder={t("uploadTrack.selectRole", "Select role")} maxItems={4} />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.share", "Split %")}</label>
                <div className="flex items-center gap-1">
                  <input type="text" inputMode="decimal" value={split.percentage === 0 ? "0" : String(split.percentage)} onChange={(e) => { var v = e.target.value.replace(/[^0-9.]/g, ""); if (v.length > 1 && v.startsWith("0") && v[1] !== ".") v = v.replace(/^0+/, ""); var n = parseFloat(v); if (!isNaN(n) && n > 100) v = "100"; onUpdate(split.id, "percentage", v === "" ? 0 : parseFloat(v) || 0); }} onFocus={(e) => { if (split.percentage === 0) e.target.select(); }} className="h-8 w-[70px] px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-mono font-medium text-right" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.pro", "PRO")}</label>
                <MultiSelectChips options={PROS} selected={split.pro ? split.pro.split(", ").filter(Boolean) : []} onChange={function (vals) { onUpdate(split.id, "pro", vals.join(", ")); }} placeholder={t("uploadTrack.proPlaceholder", "Select PRO")} maxItems={3} filterable />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.ipi", "IPI")}</label>
                <input value={split.ipi} onChange={(e) => onUpdate(split.id, "ipi", e.target.value)} placeholder={t("uploadTrack.ipiPlaceholder", "IPI number")} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
              <div className="space-y-1">
                <label className="text-2xs text-muted-foreground font-medium">{t("editTrack.publisher", "Publisher")}</label>
                <input value={split.publisher} onChange={(e) => onUpdate(split.id, "publisher", e.target.value)} placeholder={t("uploadTrack.publisherPlaceholder", "Publisher name")} className="h-8 w-full px-2.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-brand-orange/30 transition-all font-medium placeholder:text-muted-foreground/40" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border hover:border-brand-orange/30 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-all w-full justify-center"
      >
        <Plus className="w-3.5 h-3.5" /> {t("editTrack.addCollaborator")}
      </button>

      {/* Total bar */}
      <div className="space-y-2">
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full rounded-full transition-all ${totalSplit === 100 ? "bg-emerald-500" : totalSplit > 100 ? "bg-destructive" : "bg-brand-orange"}`} style={{ width: Math.min(totalSplit, 100) + "%" }} />
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-2xs font-medium ${totalSplit === 100 ? "text-emerald-400" : totalSplit > 100 ? "text-destructive" : "text-muted-foreground"}`}>
            {totalSplit === 100 ? "Total: 100% \u2713 Fully allocated" : totalSplit > 100 ? "Total: " + parseFloat(totalSplit.toFixed(2)) + "% \u2014 exceeds 100%!" : "Total: " + parseFloat(totalSplit.toFixed(2)) + "% \u2014 " + parseFloat((100 - totalSplit).toFixed(2)) + "% remaining"}
          </span>
          <button type="button" onClick={onEqualSplit} className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <Scale className="w-3 h-3" /> Equal Split
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Details Step (Splits + Credits) ─── */

function StepDetails({
  splits, totalSplit, onAdd, onUpdate, onRemove, onBatchUpdate, onEqualSplit,
  details, updateDetail, addDetailEntry, removeDetailEntry,
  isrc, upc, album, label, publisher, releaseDate,
  writtenBy, producedBy, mixedBy, masteredBy, copyright, explicit: isExplicit,
  onMetadataChange, contacts, existingSplitNames,
}: {
  splits: Split[];
  totalSplit: number;
  onAdd: () => void;
  onUpdate: (id: string, field: keyof Split, value: string | number) => void;
  onRemove: (id: string) => void;
  onBatchUpdate: (id: string, current: Split, suggestion: CollaboratorSuggestion) => void;
  onEqualSplit: () => void;
  details: Record<string, string[]>;
  updateDetail: (key: string, index: number, value: string) => void;
  addDetailEntry: (key: string) => void;
  removeDetailEntry: (key: string, index: number) => void;
  isrc: string; upc: string; album: string; label: string; publisher: string;
  releaseDate: string; writtenBy: string; producedBy: string; mixedBy: string;
  masteredBy: string; copyright: string; explicit: boolean;
  onMetadataChange: (field: string, value: string | boolean) => void;
  contacts: Contact[];
  existingSplitNames: string[];
}) {
  const { t } = useTranslation();
  const [showCredits, setShowCredits] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  return (
    <div className="space-y-5">
      {/* Splits */}
      <StepSplits
        splits={splits}
        totalSplit={totalSplit}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onBatchUpdate={onBatchUpdate}
        onEqualSplit={onEqualSplit}
        contacts={contacts}
        existingSplitNames={existingSplitNames}
      />

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Credits */}
      <div>
        <button
          onClick={() => setShowCredits(!showCredits)}
          className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showCredits ? "rotate-90" : ""}`} />
          {t("uploadTrack.credits", "Credits")}
          <span className="text-2xs text-muted-foreground/50 font-normal">{t("uploadTrack.creditsSubtitle", "— performers, production, studios")}</span>
        </button>
        {showCredits && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 space-y-3"
          >
            <PerformerCreditsSection
              details={details}
              updateDetail={updateDetail}
              addDetailEntry={addDetailEntry}
              removeDetailEntry={removeDetailEntry}
              extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))}
            />
            <ProductionCreditsSection
              details={details}
              updateDetail={updateDetail}
              addDetailEntry={addDetailEntry}
              removeDetailEntry={removeDetailEntry}
              extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))}
            />
          </motion.div>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Metadata */}
      <div>
        <button
          onClick={() => setShowMetadata(!showMetadata)}
          className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showMetadata ? "rotate-90" : ""}`} />
          {t("uploadTrack.metadata", "Metadata")}
          <span className="text-2xs text-muted-foreground/50 font-normal">{t("uploadTrack.metadataSubtitle", "— ISRC, label, release info")}</span>
        </button>
        {showMetadata && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 grid grid-cols-2 gap-3"
          >
            <MetadataInput label={t("uploadTrack.albumEp", "Album / EP")} value={album} onChange={(v) => onMetadataChange("album", v)} />
            <MetadataInput label={t("uploadTrack.label", "Label")} value={label} onChange={(v) => onMetadataChange("label", v)} />
            <MetadataInput label={t("uploadTrack.publisher", "Publisher")} value={publisher} onChange={(v) => onMetadataChange("publisher", v)} />
            <div className="space-y-1">
              <label className="text-2xs font-medium text-muted-foreground">{t("uploadTrack.releaseDate", "Release Date")}</label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => onMetadataChange("releaseDate", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all"
              />
            </div>
            <MetadataInput label="ISRC" value={isrc} onChange={(v) => onMetadataChange("isrc", v)} placeholder="e.g. USRC17607839" />
            <MetadataInput label="UPC" value={upc} onChange={(v) => onMetadataChange("upc", v)} placeholder="e.g. 0123456789012" />
            <div className="space-y-1">
              <label className="text-2xs font-medium text-muted-foreground">{t("uploadTrack.writtenBy", "Written By")}</label>
              <NameAutocomplete value={writtenBy} onChange={(v) => onMetadataChange("writtenBy", v)} placeholder="e.g. John Doe, Jane Smith" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all placeholder:text-muted-foreground/40" extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))} />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-medium text-muted-foreground">{t("uploadTrack.producedBy", "Produced By")}</label>
              <NameAutocomplete value={producedBy} onChange={(v) => onMetadataChange("producedBy", v)} placeholder="e.g. John Doe" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all placeholder:text-muted-foreground/40" extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))} />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-medium text-muted-foreground">{t("uploadTrack.mixedBy", "Mixed By")}</label>
              <NameAutocomplete value={mixedBy} onChange={(v) => onMetadataChange("mixedBy", v)} placeholder="e.g. Mix Engineer" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all placeholder:text-muted-foreground/40" extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))} />
            </div>
            <div className="space-y-1">
              <label className="text-2xs font-medium text-muted-foreground">{t("uploadTrack.masteredBy", "Mastered By")}</label>
              <NameAutocomplete value={masteredBy} onChange={(v) => onMetadataChange("masteredBy", v)} placeholder="e.g. Mastering Engineer" className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all placeholder:text-muted-foreground/40" extraSuggestions={splits.filter((s) => s.name.trim()).map((s) => ({ name: s.name, stage_name: s.stage_name }))} />
            </div>
            <MetadataInput label={t("uploadTrack.copyright", "Copyright")} value={copyright} onChange={(v) => onMetadataChange("copyright", v)} placeholder="e.g. © 2026 Label Name" />
            <div className="flex items-center gap-2 self-end pb-2">
              <input
                type="checkbox"
                id="explicit-toggle"
                checked={isExplicit}
                onChange={(e) => onMetadataChange("explicit", e.target.checked)}
                className="w-4 h-4 rounded border-border accent-brand-orange"
              />
              <label htmlFor="explicit-toggle" className="text-sm text-foreground font-medium cursor-pointer">
                {t("uploadTrack.explicit", "Explicit")}
              </label>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MetadataInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-2xs font-medium text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground outline-none focus:border-brand-orange/30 transition-all placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

/* ─── Lyrics Step ─── */

function StepLyrics({
  lyrics, onUpdate, fileInputRef,
}: {
  lyrics: string;
  onUpdate: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}) {
  const { t } = useTranslation();
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith(".txt")) {
      const text = await file.text();
      onUpdate(text);
    } else if (file.name.toLowerCase().endsWith(".pdf")) {
      // Extract text from PDF binary by parsing text strings between parentheses (Tj/TJ operators)
      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        // Decode as latin1 to preserve all byte values as characters
        let raw = "";
        for (let i = 0; i < bytes.length; i++) {
          raw += String.fromCharCode(bytes[i]);
        }
        // Extract text between parentheses in PDF content streams
        const fragments: string[] = [];
        const pdfTextRe = /\(([^)]*)\)/g;
        let match: RegExpExecArray | null;
        while ((match = pdfTextRe.exec(raw)) !== null) {
          const s = match[1]
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")");
          if (s.trim().length > 0) fragments.push(s);
        }
        const extracted = fragments.join(" ")
          .replace(/[^\x20-\x7E\n\r\u00C0-\u024F]/g, " ")
          .replace(/ {2,}/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (extracted.length > 20) {
          onUpdate(extracted);
        } else {
          toast.error(t("uploadTrack.pdfExtractFailed", "Could not extract text from PDF — please paste your lyrics manually"));
        }
      } catch {
        toast.error(t("uploadTrack.pdfExtractFailed", "Could not extract text from PDF — please paste your lyrics manually"));
      }
    }
    e.target.value = "";
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("uploadTrack.lyrics")}</h3>
        <p className="text-2xs text-muted-foreground">{t("uploadTrack.lyricsDesc", "Type your lyrics directly or import from a .pdf / .txt file")}</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-dashed border-border hover:border-brand-orange/30 text-muted-foreground hover:text-foreground transition-all"
        >
          <Upload className="w-3.5 h-3.5" /> {t("uploadTrack.importFile", "Import .pdf or .txt")}
        </button>
      </div>

      {lyrics === "" && (
        <p className="text-2xs text-muted-foreground italic mb-2">
          {t("uploadTrack.autoTranscribeHint", "💡 No lyrics? You can always auto-transcribe them later in Track Details")}
        </p>
      )}
      <textarea
        value={lyrics}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={"[Verse 1]\nYour lyrics here...\n\n[Chorus]\nYour chorus here..."}
        className="w-full min-h-[300px] px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground font-mono leading-relaxed outline-none focus:border-brand-orange/30 transition-all resize-y placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

/* ─── Review Step ─── */

function StepReview({
  title, artist, bpm, trackKey, genre, mood, trackType, voice, language, notes,
  audioFile, stems, splits, totalSplit, details, lyrics, coverFile,
  isrc, upc, album, label, publisher, releaseDate,
  writtenBy, producedBy, mixedBy, masteredBy, copyright, explicit: isExplicit,
}: {
  title: string; artist: string; bpm: string; trackKey: string;
  genre: string; mood: string[]; trackType: string; voice: string; language: string; notes: string;
  audioFile: File | null; stems: StemFile[]; splits: Split[]; totalSplit: number;
  details: Record<string, string[]>;
  lyrics?: string;
  coverFile?: File | null;
  isrc?: string; upc?: string; album?: string; label?: string; publisher?: string;
  releaseDate?: string; writtenBy?: string; producedBy?: string; mixedBy?: string;
  masteredBy?: string; copyright?: string; explicit?: boolean;
}) {
  const { t } = useTranslation();
  const coverPreviewUrl = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : null, [coverFile]);
  useEffect(() => {
    return () => { if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl); };
  }, [coverPreviewUrl]);
  const ALL_DETAIL_FIELDS = [
    { key: "producers", label: "Producer(s)" },
    { key: "songwriters", label: "Songwriter(s)" },
    { key: "recordingEngineer", label: "Recording Engineer" },
    { key: "mixingEngineer", label: "Mixing Engineer" },
    { key: "masteringEngineer", label: "Mastering Engineer" },
    { key: "drumsBy", label: "Drums By" },
    { key: "synthsBy", label: "Synths By" },
    { key: "keysBy", label: "Keys By" },
    { key: "guitarsBy", label: "Guitars By" },
    { key: "bassBy", label: "Bass By" },
    { key: "programmingBy", label: "Programming By" },
    { key: "vocalsBy", label: "Lead Vocals By" },
    { key: "backgroundVocalsBy", label: "Background Vocals By" },
    { key: "mixingStudio", label: "Mixing Studio" },
    { key: "recordingStudio", label: "Recording Studio" },
    { key: "recordingDate", label: "Recording Date" },
  ];
  const filledDetails = ALL_DETAIL_FIELDS.filter((f) => details[f.key]?.some((v) => v.trim()));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{t("uploadTrack.reviewAndSave", "Review & Save")}</h3>
        <p className="text-2xs text-muted-foreground">{t("uploadTrack.reviewDesc", "Review your track details before adding to catalog")}</p>
      </div>

      {/* Info */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{t("uploadTrack.info")}</p>
        {coverFile && (
          <div className="flex items-center gap-3 pb-2">
            <img src={coverPreviewUrl || ""} alt="Cover" className="w-16 h-16 rounded-lg object-cover" />
            <div>
              <p className="text-2xs text-muted-foreground font-medium">{t("uploadTrack.coverArt", "Cover Art")}</p>
              <p className="text-[13px] font-medium text-foreground truncate max-w-[200px]">{coverFile.name}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          <ReviewRow label={t("uploadTrack.trackTitle")} value={title} />
          <ReviewRow label={t("uploadTrack.artist")} value={artist} />
          <ReviewRow label={t("uploadTrack.bpm")} value={bpm || "—"} />
          <ReviewRow label={t("uploadTrack.key")} value={trackKey || "—"} />
          <ReviewRow label={t("uploadTrack.genre")} value={genre || "—"} />
          <ReviewRow label={t("uploadTrack.type", "Type")} value={trackType || "—"} />
          <ReviewRow label={t("editTrack.gender", "Gender")} value={voice || "—"} />
          <ReviewRow label={t("uploadTrack.language")} value={language || "—"} />
        </div>
        {mood.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1 flex-wrap">
            <span className="text-2xs text-muted-foreground font-medium">{t("uploadTrack.mood")}:</span>
            {mood.map((m) => (
              <span key={m} className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-accent/10 text-accent/70">#{m}</span>
            ))}
          </div>
        )}
        {notes && <p className="text-2xs text-muted-foreground pt-1 italic">"{notes}"</p>}
      </div>

      {/* Lyrics */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{t("uploadTrack.lyrics")}</p>
        {lyrics?.trim() ? (
          <pre className="whitespace-pre-wrap text-xs text-foreground/80 font-mono leading-relaxed max-h-32 overflow-y-auto">
            {lyrics}
          </pre>
        ) : (
          <p className="text-2xs text-muted-foreground italic">{t("uploadTrack.noLyrics", "No lyrics added")}</p>
        )}
      </div>

      {/* Audio */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{t("uploadTrack.audio")}</p>
        {audioFile ? (
          <div className="flex items-center gap-2">
            <FileAudio className="w-3.5 h-3.5 text-brand-orange" />
            <span className="text-[13px] font-medium text-foreground">{audioFile.name}</span>
            <span className="text-2xs text-muted-foreground">({formatFileSize(audioFile.size)})</span>
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground italic">{t("uploadTrack.noAudioFile", "No audio file uploaded")}</p>
        )}
      </div>

      {/* Stems */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{t("uploadTrack.stems")} ({stems.length})</p>
        {stems.length > 0 ? (
          <div className="space-y-1">
            {stems.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-[13px]">
                <FileAudio className="w-3 h-3 text-brand-orange" />
                <span className="font-medium text-foreground">{s.name}</span>
                <span className="text-2xs text-muted-foreground">({s.size})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground italic">{t("uploadTrack.noStems", "No stems uploaded")}</p>
        )}
      </div>

      {/* Splits */}
      <div className="rounded-xl bg-secondary/50 border border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest">{t("uploadTrack.splits")} ({splits.length})</p>
          <span className={`text-xs font-bold tabular-nums ${totalSplit === 100 ? "text-emerald-400" : "text-brand-orange"}`}>{totalSplit}%</span>
        </div>
        {splits.filter((s) => s.name).length > 0 ? (
          <div className="space-y-1">
            {splits.filter((s) => s.name).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-muted-foreground" />
                  <span className="font-medium text-foreground">{s.name}</span>
                  {s.role && <span className="text-2xs text-muted-foreground">· {s.role}</span>}
                </div>
                <span className="font-mono text-xs font-semibold text-foreground">{s.percentage}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-2xs text-muted-foreground italic">{t("uploadTrack.noContributors", "No contributors added")}</p>
        )}
      </div>

      {/* Credits */}
      {filledDetails.length > 0 && (
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{t("uploadTrack.creditsAndDetails", "Credits & Details")}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            {filledDetails.map((f) => (
              <ReviewRow key={f.key} label={f.label} value={details[f.key].filter((v) => v.trim()).join(", ")} />
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      {(album || label || publisher || releaseDate || isrc || upc || writtenBy || producedBy || mixedBy || masteredBy || copyright || isExplicit) && (
        <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-2">
          <p className="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{t("uploadTrack.metadata", "Metadata")}</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
            {album && <ReviewRow label={t("uploadTrack.albumEp", "Album / EP")} value={album} />}
            {label && <ReviewRow label={t("uploadTrack.label", "Label")} value={label} />}
            {publisher && <ReviewRow label={t("uploadTrack.publisher", "Publisher")} value={publisher} />}
            {releaseDate && <ReviewRow label={t("uploadTrack.releaseDate", "Release Date")} value={releaseDate} />}
            {isrc && <ReviewRow label="ISRC" value={isrc} />}
            {upc && <ReviewRow label="UPC" value={upc} />}
            {writtenBy && <ReviewRow label={t("uploadTrack.writtenBy", "Written By")} value={writtenBy} />}
            {producedBy && <ReviewRow label={t("uploadTrack.producedBy", "Produced By")} value={producedBy} />}
            {mixedBy && <ReviewRow label={t("uploadTrack.mixedBy", "Mixed By")} value={mixedBy} />}
            {masteredBy && <ReviewRow label={t("uploadTrack.masteredBy", "Mastered By")} value={masteredBy} />}
            {copyright && <ReviewRow label={t("uploadTrack.copyright", "Copyright")} value={copyright} />}
            {isExplicit && <ReviewRow label={t("uploadTrack.explicit", "Explicit")} value="Yes" />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Workspaces Step ─── */

function StepTeams({
  activeWorkspaceName,
  otherWorkspaces,
  selectedWorkspaces,
  onToggleWorkspace,
}: {
  activeWorkspaceName: string;
  otherWorkspaces: { id: string; name: string; logo_url: string | null }[];
  selectedWorkspaces: string[];
  onToggleWorkspace: (wsId: string) => void;
}) {
  const { t } = useTranslation();

  function getInitials(name: string) {
    return name.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").toUpperCase().slice(0, 2);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-foreground mb-1">
          {t("uploadTrack.trackSavedTo", { workspace: activeWorkspaceName, defaultValue: "This track will be saved to " + activeWorkspaceName })}
        </p>
        <p className="text-2xs text-muted-foreground">
          {t("uploadTrack.shareToOtherWorkspacesDesc", "You can also share it with your other workspaces:")}
        </p>
      </div>

      {otherWorkspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ArrowRightLeft className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm italic text-muted-foreground">{t("uploadTrack.noOtherWorkspacesNew", "You don't have any other workspaces to share with. You can create new workspaces later in Settings.")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {otherWorkspaces.map(function (ws) {
            var isSelected = selectedWorkspaces.includes(ws.id);
            return (
              <button
                key={ws.id}
                onClick={function () { onToggleWorkspace(ws.id); }}
                className={"w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left " + (
                  isSelected
                    ? "border-brand-orange/20 bg-brand-orange/5"
                    : "border-border bg-transparent hover:border-border/80"
                )}
              >
                {ws.logo_url ? (
                  <img src={ws.logo_url} alt="" className="w-7 h-7 rounded-lg object-contain shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-orange to-brand-pink flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-white">{getInitials(ws.name)}</span>
                  </div>
                )}
                <p className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{ws.name}</p>
                <div className={"w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 " + (
                  isSelected ? "border-brand-orange bg-brand-orange" : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedWorkspaces.length > 0 && (
        <p className="text-2xs text-muted-foreground">
          {selectedWorkspaces.length + " workspace" + (selectedWorkspaces.length !== 1 ? "s" : "") + " selected"}
        </p>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
