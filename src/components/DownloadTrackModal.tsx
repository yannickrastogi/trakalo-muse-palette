import { useState } from "react";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { ID3Writer } from "browser-id3-writer";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Package, Music, Image, FileText, Layers, Paperclip, PieChart, ArrowLeft, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  generateLyricsPdf,
  generateSplitsPdf,
  generateMetadataPdf,
  generateSignedAgreementPdf,
  addWatermark,
} from "@/lib/pdf-generators";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_COVER } from "@/lib/constants";
import type { TrackData } from "@/contexts/TrackContext";

interface DownloadTrackModalProps {
  open: boolean;
  onClose: () => void;
  trackData: TrackData;
  meta: { label: string; value: string }[];
}

type Step = "choose" | "quality" | "pack";

const packItemDefs = [
  { id: "track", labelKey: "downloadTrack.track", description: "Original audio file", icon: Music },
  { id: "cover", labelKey: "downloadTrack.coverArt", description: "3000×3000 JPEG artwork", icon: Image },
  { id: "lyrics", labelKey: "downloadTrack.lyrics", description: "Branded PDF document", icon: FileText },
  { id: "stems", labelKey: "downloadTrack.stems", description: "All stem files (original format)", icon: Layers },
  { id: "metadata", labelKey: "downloadTrack.metadata", description: "Branded PDF with all track info", icon: PieChart },
  { id: "paperwork", labelKey: "downloadTrack.paperwork", description: "All documents with watermark", icon: Paperclip },
] as const;

type PackItemId = typeof packItemDefs[number]["id"];

export function DownloadTrackModal({ open, onClose, trackData, meta }: DownloadTrackModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("choose");
  const [quality, setQuality] = useState<"hires" | "lowres">("hires");
  const [selectedItems, setSelectedItems] = useState<Set<PackItemId>>(new Set(["track", "cover", "lyrics", "stems", "metadata", "paperwork"]));
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClose = () => {
    setStep("choose");
    setIsGenerating(false);
    onClose();
  };

  const toggleItem = (id: PackItemId) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadTrack = async () => {
    // In a real app, this would fetch the actual audio file ArrayBuffer
    // For demo, we create a tagged file with embedded cover art
    const coverArrayBuffer = await getCoverArtArrayBuffer(trackData);
    const taggedBlob = createTaggedAudioBlob(
      trackData.title,
      trackData.artist,
      trackData.album,
      coverArrayBuffer
    );

    const link = document.createElement("a");
    link.download = `${trackData.title} - ${trackData.artist}${quality === "hires" ? " (Hi-Res)" : " (Low-Res)"}.mp3`;
    link.href = URL.createObjectURL(taggedBlob);
    link.click();
    URL.revokeObjectURL(link.href);
    handleClose();
  };

  const handleDownloadPack = async () => {
    if (selectedItems.size === 0) return;
    setIsGenerating(true);

    try {
      const zip = new JSZip();
      const folderName = `${trackData.title} - ${trackData.artist} - Trakalog Pack`;
      const root = zip.folder(folderName)!;

      // Get cover art for embedding in audio files (used by stems)
      const coverArrayBuffer = await getCoverArtArrayBuffer(trackData);

      // Track — real audio file from Supabase Storage
      if (selectedItems.has("track") && trackData.originalFileUrl) {
        const trackFolder = root.folder("Track")!;
        const fileName = trackData.originalFileName || (trackData.title + ".mp3");
        const audioBytes = await fetch(trackData.originalFileUrl).then(r => r.arrayBuffer());
        trackFolder.file(fileName, audioBytes);
      }

      // Cover Art — real image from Supabase Storage or default
      if (selectedItems.has("cover")) {
        const coverFolder = root.folder("Cover Art")!;
        const coverUrl = trackData.coverImage || DEFAULT_COVER;
        const coverBytes = await fetch(coverUrl).then(r => r.arrayBuffer());
        const ext = trackData.coverImage ? (trackData.coverImage.match(/\.(jpe?g|png|webp)$/i)?.[0] || ".jpg") : ".png";
        coverFolder.file(trackData.title + " - Cover Art" + ext, coverBytes);
      }

      // Lyrics
      if (selectedItems.has("lyrics") && trackData.lyrics) {
        const lyricsFolder = root.folder("Lyrics")!;
        const blob = generateLyricsPdf(trackData.title, trackData.artist, trackData.lyrics, true) as Blob;
        lyricsFolder.file(`${trackData.title} - Lyrics.pdf`, blob);
      }

      // Stems — each with embedded cover art
      if (selectedItems.has("stems") && trackData.stems.length > 0) {
        const stemsFolder = root.folder("Stems")!;
        trackData.stems.forEach(stem => {
          const stemName = stem.fileName.replace(/\.\w+$/, '.mp3');
          const taggedBlob = createTaggedAudioBlob(
            `${trackData.title} - ${stem.type}`,
            trackData.artist,
            trackData.album,
            coverArrayBuffer
          );
          stemsFolder.file(stemName, taggedBlob);
        });
      }

      // Metadata
      if (selectedItems.has("metadata")) {
        const metaFolder = root.folder("Metadata")!;
        const blob = generateMetadataPdf(trackData.title, trackData.artist, meta, true) as Blob;
        metaFolder.file(`${trackData.title} - Metadata.pdf`, blob);
      }

      // Splits (part of metadata conceptually, but included if metadata selected)
      if (selectedItems.has("metadata") && trackData.splits.length > 0) {
        const metaFolder = root.folder("Metadata")!;
        const totalShares = trackData.splits.reduce((sum, s) => sum + (s.share || 0), 0);
        const blob = generateSplitsPdf(trackData.title, trackData.artist, trackData.splits, totalShares, true) as Blob;
        metaFolder.file(`${trackData.title} - Splits.pdf`, blob);
      }

      // Signed Split Agreement
      if (selectedItems.has("metadata") && (trackData.uuid || trackData.id)) {
        const trackIdForSig = trackData.uuid || trackData.id;
        const { data: signatures } = await supabase
          .from("signature_requests")
          .select("collaborator_name, collaborator_email, status, signed_at, signature_data, split_share")
          .eq("track_id", trackIdForSig);

        if (signatures) {
          const signedEntries = signatures
            .filter(sig => sig.status === "signed")
            .map(sig => ({
              name: sig.collaborator_name,
              role: "",
              share: sig.split_share || 0,
              pro: "",
              ipi: "",
              publisher: "",
              signatureData: sig.signature_data,
              signedAt: sig.signed_at,
            }));

          if (signedEntries.length > 0) {
            const metaFolder = root.folder("Metadata")!;
            const signedBlob = generateSignedAgreementPdf(trackData.title, trackData.artist, signedEntries, true) as Blob;
            metaFolder.file(trackData.title + " - Split Agreement (Signed).pdf", signedBlob);
          }
        }
      }

      // Paperwork
      const trackId = trackData.uuid || trackData.id;
      if (selectedItems.has("paperwork") && trackId) {
        const { data: docs } = await supabase
          .from("track_documents")
          .select("*")
          .eq("track_id", trackId);

        if (docs && docs.length > 0) {
          const paperworkFolder = root.folder("Paperwork")!;
          for (const doc of docs) {
            const { data: signedData } = await supabase.storage
              .from("documents")
              .createSignedUrl(doc.file_path, 3600);
            if (!signedData?.signedUrl) continue;

            const fileBytes = await fetch(signedData.signedUrl).then(r => r.arrayBuffer());

            if (doc.mime_type && doc.mime_type.includes("pdf")) {
              const pdfDoc = await PDFDocument.load(fileBytes);
              const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
              for (const page of pdfDoc.getPages()) {
                const { width, height } = page.getSize();
                const fontSize = width / 4;
                for (let y = height * 0.2; y < height; y += height * 0.25) {
                  page.drawText("TRAKALOG", {
                    x: width * 0.15,
                    y,
                    size: fontSize,
                    font,
                    color: rgb(0.5, 0.5, 0.5),
                    opacity: 0.08,
                    rotate: degrees(45),
                  });
                }
              }
              const watermarkedBytes = await pdfDoc.save();
              paperworkFolder.file(doc.file_name, watermarkedBytes);
            } else {
              paperworkFolder.file(doc.file_name, fileBytes);
            }
          }
        }
      }

      // Generate and download the ZIP
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = `${folderName}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Failed to generate Trakalog Pack:", err);
    } finally {
      setIsGenerating(false);
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {step !== "choose" && (
              <button onClick={() => setStep("choose")} className="p-1 rounded-lg hover:bg-secondary transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {step === "choose" && t("downloadTrack.title")}
            {step === "quality" && t("downloadTrack.downloadTrack")}
            {step === "pack" && t("downloadTrack.trakalogPack")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "choose" && `${trackData.title} — ${trackData.artist}`}
            {step === "quality" && t("downloadTrack.chooseQuality")}
            {step === "pack" && t("downloadTrack.selectPackItems")}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-2 pt-2"
            >
              <button
                onClick={() => setStep("quality")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-left group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("downloadTrack.downloadTrack")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("downloadTrack.trackDesc")}</p>
                </div>
              </button>

              <button
                onClick={() => setStep("pack")}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors text-left group"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:opacity-90 transition-opacity"
                  style={{ background: "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))" }}
                >
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("downloadTrack.trakalogPack")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("downloadTrack.packDesc")}</p>
                </div>
              </button>
            </motion.div>
          )}

          {step === "quality" && (
            <motion.div
              key="quality"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-3 pt-2"
            >
              <button
                onClick={() => setQuality("hires")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
                  quality === "hires"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/30 hover:bg-secondary/60"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  quality === "hires" ? "border-primary" : "border-muted-foreground/40"
                }`}>
                  {quality === "hires" && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("downloadTrack.hiRes")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("downloadTrack.hiResDesc")}</p>
                </div>
              </button>

              <button
                onClick={() => setQuality("lowres")}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
                  quality === "lowres"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/30 hover:bg-secondary/60"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  quality === "lowres" ? "border-primary" : "border-muted-foreground/40"
                }`}>
                  {quality === "lowres" && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("downloadTrack.lowRes")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("downloadTrack.lowResDesc")}</p>
                </div>
              </button>

              <button
                onClick={handleDownloadTrack}
                className="w-full mt-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))" }}
              >
                <Download className="w-4 h-4 inline mr-2" />
                {quality === "hires" ? t("downloadTrack.downloadHiRes") : t("downloadTrack.downloadLowRes")}
              </button>
            </motion.div>
          )}

          {step === "pack" && (
            <motion.div
              key="pack"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-1 pt-2"
            >
              {packItemDefs.map(item => {
                const checked = selectedItems.has(item.id);
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                      checked
                        ? "border-primary/30 bg-primary/5"
                        : "border-transparent hover:bg-secondary/40"
                    }`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="shrink-0"
                    />
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                      <ItemIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{t(item.labelKey)}</p>
                      <p className="text-[11px] text-muted-foreground">{item.description}</p>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={handleDownloadPack}
                disabled={selectedItems.size === 0 || isGenerating}
                className="w-full mt-3 py-3 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))" }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("downloadTrack.generatingPack")}
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    {t("downloadTrack.downloadPack", { count: selectedItems.size })}
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}


function drawFallbackCover(ctx: CanvasRenderingContext2D, size: number, trackData: TrackData) {
  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#1a1025");
  gradient.addColorStop(0.5, "#0d0d12");
  gradient.addColorStop(1, "#1a0a05");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Brand accent glow
  const glow = ctx.createRadialGradient(size * 0.3, size * 0.4, 0, size * 0.3, size * 0.4, size * 0.5);
  glow.addColorStop(0, "rgba(140, 70, 209, 0.15)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const glow2 = ctx.createRadialGradient(size * 0.7, size * 0.6, 0, size * 0.7, size * 0.6, size * 0.5);
  glow2.addColorStop(0, "rgba(255, 140, 26, 0.12)");
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, size, size);

  // Title text
  ctx.fillStyle = "#f5f5f5";
  ctx.font = `bold ${size * 0.08}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(trackData.title, size / 2, size * 0.45);

  // Artist text
  ctx.fillStyle = "#787880";
  ctx.font = `${size * 0.04}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText(trackData.artist, size / 2, size * 0.52);

  // TRAKALOG branding bottom
  ctx.fillStyle = "rgba(255, 140, 26, 0.6)";
  ctx.font = `bold ${size * 0.025}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillText("TRAKALOG", size / 2, size * 0.95);
}

/** Get cover art as ArrayBuffer for ID3 embedding */
async function getCoverArtArrayBuffer(trackData: TrackData): Promise<ArrayBuffer> {
  // Generate a cover art image (smaller size for embedding — 500x500)
  const size = 500;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (trackData.coverImage) {
    return new Promise<ArrayBuffer>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob(async (blob) => {
          resolve(await blob!.arrayBuffer());
        }, "image/jpeg", 0.9);
      };
      img.onerror = () => {
        drawFallbackCover(ctx, size, trackData);
        canvas.toBlob(async (blob) => {
          resolve(await blob!.arrayBuffer());
        }, "image/jpeg", 0.9);
      };
      img.src = trackData.coverImage!;
    });
  } else {
    drawFallbackCover(ctx, size, trackData);
    return new Promise<ArrayBuffer>((resolve) => {
      canvas.toBlob(async (blob) => {
        resolve(await blob!.arrayBuffer());
      }, "image/jpeg", 0.9);
    });
  }
}

/** Create an audio blob with ID3 tags and embedded cover art */
function createTaggedAudioBlob(
  title: string,
  artist: string,
  album: string,
  coverArtBuffer: ArrayBuffer
): Blob {
  // Create a minimal MP3-compatible buffer for demo
  // In production, this would be the real audio ArrayBuffer
  const emptyBuffer = new ArrayBuffer(128);

  const writer = new ID3Writer(emptyBuffer);
  writer
    .setFrame("TIT2", title)
    .setFrame("TPE1", [artist])
    .setFrame("TALB", album)
    .setFrame("APIC", {
      type: 3, // Cover (front)
      data: coverArtBuffer,
      description: "Cover Art",
    });
  writer.addTag();

  return writer.getBlob();
}
