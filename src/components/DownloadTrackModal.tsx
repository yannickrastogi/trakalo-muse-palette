import { useState } from "react";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
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
  generatePaperworkPdf,
  addWatermark,
} from "@/lib/pdf-generators";
import type { TrackData } from "@/contexts/TrackContext";

interface DownloadTrackModalProps {
  open: boolean;
  onClose: () => void;
  trackData: TrackData;
  meta: { label: string; value: string }[];
}

type Step = "choose" | "quality" | "pack";

const packItems = [
  { id: "track", label: "Track", description: "Original audio file", icon: Music },
  { id: "cover", label: "Cover Art", description: "3000×3000 JPEG artwork", icon: Image },
  { id: "lyrics", label: "Lyrics", description: "Branded PDF document", icon: FileText },
  { id: "stems", label: "Stems", description: "All stem files (original format)", icon: Layers },
  { id: "metadata", label: "Metadata", description: "Branded PDF with all track info", icon: PieChart },
  { id: "paperwork", label: "Paperwork", description: "All documents with watermark", icon: Paperclip },
] as const;

type PackItemId = typeof packItems[number]["id"];

export function DownloadTrackModal({ open, onClose, trackData, meta }: DownloadTrackModalProps) {
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

  const handleDownloadTrack = () => {
    // Simulate download — in a real app this would fetch the actual file
    const link = document.createElement("a");
    link.download = `${trackData.title} - ${trackData.artist}${quality === "hires" ? " (Hi-Res)" : " (Low-Res)"}.wav`;
    // Create a small placeholder blob for demo
    const blob = new Blob(["[Audio file placeholder]"], { type: "audio/wav" });
    link.href = URL.createObjectURL(blob);
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

      // Track
      if (selectedItems.has("track")) {
        const trackFolder = root.folder("Track")!;
        const fileName = trackData.originalFileName || `${trackData.title}.wav`;
        // In a real app, this would be the actual audio blob
        trackFolder.file(fileName, new Blob(["[Original audio file]"], { type: "audio/wav" }));
      }

      // Cover Art — generate a 3000x3000 JPEG from the cover image
      if (selectedItems.has("cover")) {
        const coverFolder = root.folder("Cover Art")!;
        const coverBlob = await generateCoverArtBlob(trackData);
        coverFolder.file(`${trackData.title} - Cover Art.jpg`, coverBlob);
      }

      // Lyrics
      if (selectedItems.has("lyrics") && trackData.lyrics) {
        const lyricsFolder = root.folder("Lyrics")!;
        const blob = generateLyricsPdf(trackData.title, trackData.artist, trackData.lyrics, true) as Blob;
        lyricsFolder.file(`${trackData.title} - Lyrics.pdf`, blob);
      }

      // Stems
      if (selectedItems.has("stems") && trackData.stems.length > 0) {
        const stemsFolder = root.folder("Stems")!;
        trackData.stems.forEach(stem => {
          // In a real app, these would be actual audio blobs
          stemsFolder.file(stem.fileName, new Blob([`[Stem: ${stem.fileName}]`], { type: "audio/wav" }));
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

      // Paperwork
      if (selectedItems.has("paperwork")) {
        const paperworkFolder = root.folder("Paperwork")!;

        // Generate index PDF
        const paperworkDocs = [
          { name: "Master License Agreement", status: "Signed", date: "Jan 15, 2026" },
          { name: "Publishing Split Sheet", status: "Signed", date: "Jan 18, 2026" },
          { name: "Sync License — Nike Campaign", status: "Pending", date: "Feb 22, 2026" },
          { name: "Distribution Agreement", status: "Signed", date: "Jan 10, 2026" },
          { name: "Mechanical License", status: "Draft", date: "Mar 01, 2026" },
        ];

        const indexBlob = generatePaperworkPdf(trackData.title, trackData.artist, paperworkDocs);
        paperworkFolder.file(`${trackData.title} - Documents Index.pdf`, indexBlob);

        // Generate individual watermarked document placeholders
        // In a real app, these would be actual uploaded PDFs with watermark applied
        paperworkDocs.forEach(doc => {
          const docBlob = generateWatermarkedDocumentPdf(doc.name, doc.status, doc.date, trackData.title, trackData.artist);
          paperworkFolder.file(`${doc.name}.pdf`, docBlob);
        });
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
            {step === "choose" && "Download"}
            {step === "quality" && "Download Track"}
            {step === "pack" && "Trakalog Pack"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "choose" && `${trackData.title} — ${trackData.artist}`}
            {step === "quality" && "Choose audio quality"}
            {step === "pack" && "Select what to include in your pack"}
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
                  <p className="text-sm font-semibold text-foreground">Download Track</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Hi-res or low-res audio file</p>
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
                  <p className="text-sm font-semibold text-foreground">Trakalog Pack</p>
                  <p className="text-xs text-muted-foreground mt-0.5">ZIP with branded files, stems & documents</p>
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
                  <p className="text-sm font-semibold text-foreground">Hi-Res</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Original quality WAV / FLAC</p>
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
                  <p className="text-sm font-semibold text-foreground">Low-Res</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Compressed MP3 (320kbps)</p>
                </div>
              </button>

              <button
                onClick={handleDownloadTrack}
                className="w-full mt-2 py-3 rounded-xl text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, hsl(24, 100%, 55%), hsl(330, 80%, 60%), hsl(270, 70%, 55%))" }}
              >
                <Download className="w-4 h-4 inline mr-2" />
                Download {quality === "hires" ? "Hi-Res" : "Low-Res"}
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
              {packItems.map(item => {
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
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
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
                    Generating Pack…
                  </>
                ) : (
                  <>
                    <Package className="w-4 h-4" />
                    Download Trakalog Pack ({selectedItems.size} items)
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

/** Generate cover art as a JPEG blob — 3000x3000 for industry standards */
async function generateCoverArtBlob(trackData: TrackData): Promise<Blob> {
  const size = 3000;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  if (trackData.coverImage) {
    // If there's a cover image, draw it at 3000x3000
    return new Promise<Blob>((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
      };
      img.onerror = () => {
        // Fallback gradient
        drawFallbackCover(ctx, size, trackData);
        canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
      };
      img.src = trackData.coverImage!;
    });
  } else {
    // Generate a branded gradient cover
    drawFallbackCover(ctx, size, trackData);
    return new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95);
    });
  }
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

/** Generate a watermarked placeholder document PDF */
function generateWatermarkedDocumentPdf(docName: string, status: string, date: string, trackTitle: string, trackArtist: string): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // White background for document pages
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, "F");

  // Document header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text(docName, 56, 80);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text(`Track: ${trackTitle} — ${trackArtist}`, 56, 105);
  doc.text(`Status: ${status}  |  Date: ${date}`, 56, 122);

  // Placeholder body
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const bodyLines = [
    "This document is a copy of the original uploaded to Trakalog.",
    "The original document is securely stored and can be accessed",
    "through your Trakalog account at any time.",
    "",
    "This copy is provided as part of the Trakalog Pack download",
    "and is watermarked for identification purposes.",
  ];
  let y = 170;
  bodyLines.forEach(line => {
    doc.text(line, 56, y);
    y += 18;
  });

  // Add watermark
  addWatermark(doc);

  return doc.output("blob");
}
