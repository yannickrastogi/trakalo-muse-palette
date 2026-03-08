import { jsPDF } from "jspdf";
import trakalogLogo from "@/assets/trakalog-logo.png";

// Brand colors
const brandOrange: [number, number, number] = [255, 140, 26];
const brandPink: [number, number, number] = [224, 82, 153];
const brandPurple: [number, number, number] = [140, 70, 209];
const bgDark: [number, number, number] = [16, 16, 18];
const cardBg: [number, number, number] = [22, 22, 25];
const textLight: [number, number, number] = [245, 245, 245];
const textMuted: [number, number, number] = [120, 120, 128];

function drawGradientBar(doc: jsPDF, pageW: number, yPos: number, h: number) {
  const barSegments = 60;
  for (let i = 0; i < barSegments; i++) {
    const t = i / barSegments;
    const r = Math.round(brandOrange[0] + (brandPink[0] - brandOrange[0]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[0] - brandPurple[0]));
    const g = Math.round(brandOrange[1] + (brandPink[1] - brandOrange[1]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[1] - brandPurple[1]));
    const b = Math.round(brandOrange[2] + (brandPink[2] - brandOrange[2]) * t * 2 - Math.max(0, (t * 2 - 1)) * (brandPink[2] - brandPurple[2]));
    doc.setFillColor(Math.min(255, Math.max(0, r)), Math.min(255, Math.max(0, g)), Math.min(255, Math.max(0, b)));
    doc.rect((pageW / barSegments) * i, yPos, pageW / barSegments + 1, h, "F");
  }
}

function drawPageBackground(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...bgDark);
  doc.rect(0, 0, pageW, pageH, "F");
  drawGradientBar(doc, pageW, 0, 5);
}

function drawLogo(doc: jsPDF, marginX: number) {
  let y = 44;
  const iconSize = 28;
  try {
    doc.addImage(trakalogLogo, "PNG", marginX, y - 2, iconSize, iconSize);
  } catch {
    doc.setFillColor(...brandOrange);
    doc.roundedRect(marginX, y - 2, iconSize, iconSize, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("T", marginX + iconSize / 2, y + iconSize / 2 + 1, { align: "center", baseline: "middle" });
  }
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandOrange);
  doc.text("TRAKALOG", marginX + iconSize + 10, y + iconSize / 2 + 1, { baseline: "middle" });
}

function drawHeaderCard(doc: jsPDF, marginX: number, contentW: number, pageW: number, title: string, artist: string, badgeLabel: string) {
  let y = 92;
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 80, 8, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...textLight);
  doc.text(title, marginX + 20, y + 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...textMuted);
  doc.text(artist, marginX + 20, y + 54);
  doc.setFillColor(...brandOrange);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(badgeLabel) + 16;
  doc.roundedRect(pageW - marginX - badgeW - 20, y + 16, badgeW, 18, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(badgeLabel, pageW - marginX - badgeW / 2 - 20, y + 28, { align: "center" });
}

function drawDividerDots(doc: jsPDF, pageW: number) {
  const y = 188;
  [brandOrange, brandPink, brandPurple].forEach((c, i) => {
    doc.setFillColor(...c);
    doc.circle(pageW / 2 - 12 + i * 12, y, 2, "F");
  });
}

function drawFooters(doc: jsPDF, marginX: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawGradientBar(doc, pageW, pageH - 3, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text("Powered by", pageW / 2 - 20, pageH - 18, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...brandOrange);
    doc.text(" trakalog.com", pageW / 2 - 18, pageH - 18);
    if (totalPages > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text(`${p} / ${totalPages}`, pageW - marginX, pageH - 18, { align: "right" });
    }
  }
}

export interface SplitData {
  name: string;
  role: string;
  share: number;
  pro: string;
  ipi: string;
  publisher: string;
}

export interface MetaField {
  label: string;
  value: string;
}

/** Generate lyrics PDF — returns blob if asBlob=true, otherwise saves */
export function generateLyricsPdf(title: string, artist: string, lyrics: string, asBlob?: boolean): Blob | void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "LYRICS");
  drawDividerDots(doc, pageW);

  let y = 210;
  const lines = lyrics.split("\n");
  const lineHeight = 16;
  const sectionLineHeight = 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);

  for (const line of lines) {
    const trimmed = line.trim();
    const isSection = /^\[.*\]$/.test(trimmed);

    if (y > pageH - 80) {
      doc.addPage();
      drawPageBackground(doc);
      y = 48;
    }

    if (isSection) {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...brandOrange);
      doc.text(trimmed.replace(/[\[\]]/g, "").toUpperCase(), marginX, y);
      const tw = doc.getTextWidth(trimmed.replace(/[\[\]]/g, "").toUpperCase());
      doc.setDrawColor(...brandOrange);
      doc.setLineWidth(0.5);
      doc.line(marginX, y + 4, marginX + tw, y + 4);
      y += sectionLineHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
    } else if (trimmed === "") {
      y += 8;
    } else {
      doc.setTextColor(...textLight);
      const splitLines = doc.splitTextToSize(trimmed, contentW);
      for (const sl of splitLines) {
        if (y > pageH - 80) {
          doc.addPage();
          drawPageBackground(doc);
          y = 48;
        }
        doc.text(sl, marginX, y);
        y += lineHeight;
      }
    }
  }

  drawFooters(doc, marginX);

  if (asBlob) {
    return doc.output("blob");
  }
  doc.save(`${title} - Lyrics.pdf`);
}

/** Generate splits PDF */
export function generateSplitsPdf(title: string, artist: string, splits: SplitData[], totalShares: number, asBlob?: boolean): Blob | void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;
  const splitColors: [number, number, number][] = [brandOrange, brandPink, brandPurple, [80, 180, 220]];

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "SPLITS");
  drawDividerDots(doc, pageW);

  let y = 210;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textMuted);
  doc.text("OWNERSHIP BREAKDOWN", marginX, y);
  y += 20;

  const barHeight = 14;
  let barX = marginX;
  splits.forEach((s, i) => {
    const color = splitColors[i % splitColors.length];
    const w = (s.share / 100) * contentW;
    doc.setFillColor(...color);
    doc.roundedRect(barX, y, Math.max(w, 2), barHeight, i === 0 ? 4 : 0, i === splits.length - 1 ? 4 : 0, "F");
    barX += w;
  });
  y += barHeight + 24;

  const colName = marginX;
  const colRole = marginX + 180;
  const colPro = marginX + 310;
  const colIpi = marginX + 370;
  const colShare = pageW - marginX - 40;

  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 28, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("NAME", colName + 14, y + 18);
  doc.text("ROLE", colRole, y + 18);
  doc.text("PRO", colPro, y + 18);
  doc.text("IPI", colIpi, y + 18);
  doc.text("SHARE", colShare, y + 18, { align: "right" });
  y += 36;

  splits.forEach((s, i) => {
    const color = splitColors[i % splitColors.length];
    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0] - 2, cardBg[1] - 2, cardBg[2] - 2);
      doc.rect(marginX, y - 4, contentW, 32, "F");
    }
    doc.setFillColor(...color);
    doc.circle(colName + 6, y + 10, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textLight);
    doc.text(s.name, colName + 18, y + 12);
    if (s.publisher) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text(s.publisher, colName + 18, y + 23);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...textLight);
    doc.text(s.role, colRole, y + 12);
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    doc.text(s.pro || "—", colPro, y + 12);
    doc.text(s.ipi || "—", colIpi, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(`${s.share}%`, colShare, y + 12, { align: "right" });
    y += 36;
  });

  y += 4;
  doc.setDrawColor(...brandOrange);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, marginX + contentW, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...textMuted);
  doc.text("TOTAL", colName + 18, y);
  const isComplete = totalShares === 100;
  doc.setFontSize(14);
  doc.setTextColor(isComplete ? 74 : 239, isComplete ? 222 : 68, isComplete ? 128 : 68);
  doc.text(`${totalShares}%`, colShare, y, { align: "right" });
  if (isComplete) {
    doc.setFontSize(8);
    doc.setTextColor(74, 222, 128);
    doc.text("✓ Fully allocated", colShare - 40, y + 14, { align: "right" });
  }

  drawFooters(doc, marginX);

  if (asBlob) {
    return doc.output("blob");
  }
  doc.save(`${title} - Splits.pdf`);
}

/** Generate metadata PDF */
export function generateMetadataPdf(title: string, artist: string, meta: MetaField[], asBlob?: boolean): Blob | void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "METADATA");
  drawDividerDots(doc, pageW);

  let y = 210;
  const colW = (contentW - 12) / 2;
  const rowH = 44;
  meta.forEach((m, i) => {
    if (y + rowH > pageH - 60) {
      doc.addPage();
      drawPageBackground(doc);
      y = 48;
    }
    const col = i % 2;
    const x = marginX + col * (colW + 12);
    doc.setFillColor(...cardBg);
    doc.roundedRect(x, y, colW, rowH - 4, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...brandOrange);
    doc.text(m.label.toUpperCase(), x + 12, y + 15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...textLight);
    const wrappedLines = doc.splitTextToSize(m.value, colW - 24);
    doc.text(wrappedLines[0] || "—", x + 12, y + 30);
    if (col === 1) y += rowH;
  });
  if (meta.length % 2 !== 0) y += rowH;

  drawFooters(doc, marginX);

  if (asBlob) {
    return doc.output("blob");
  }
  doc.save(`${title} - Metadata.pdf`);
}

/** Generate a watermarked paperwork cover page PDF */
export function generatePaperworkPdf(title: string, artist: string, documents: { name: string; status: string; date: string }[]): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "PAPERWORK");
  drawDividerDots(doc, pageW);

  let y = 210;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textMuted);
  doc.text("DOCUMENTS INDEX", marginX, y);
  y += 24;

  // Table header
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 28, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("DOCUMENT NAME", marginX + 14, y + 18);
  doc.text("STATUS", marginX + 320, y + 18);
  doc.text("DATE", pageW - marginX - 40, y + 18, { align: "right" });
  y += 36;

  documents.forEach((d, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0] - 2, cardBg[1] - 2, cardBg[2] - 2);
      doc.rect(marginX, y - 4, contentW, 28, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...textLight);
    doc.text(d.name, marginX + 14, y + 12);

    // Status badge
    const statusColor = d.status === "Signed" ? [74, 222, 128] as [number, number, number] :
                         d.status === "Pending" ? brandOrange : textMuted;
    doc.setFontSize(8);
    doc.setTextColor(...statusColor);
    doc.setFont("helvetica", "bold");
    doc.text(d.status.toUpperCase(), marginX + 320, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    doc.text(d.date, pageW - marginX - 40, y + 12, { align: "right" });
    y += 28;
  });

  // Add diagonal watermark on all pages
  addWatermark(doc);
  drawFooters(doc, marginX);

  return doc.output("blob");
}

/** Add diagonal TRAKALOG watermark across all pages */
export function addWatermark(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.saveGraphicsState();

    // Set transparent watermark text
    const gState = (doc as any).GState({ opacity: 0.06 });
    doc.setGState(gState);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.setTextColor(...brandOrange);

    // Draw multiple diagonal watermark lines
    const text = "TRAKALOG";
    const angle = -35;
    const radians = (angle * Math.PI) / 180;

    // Multiple positions to cover the page
    const positions = [
      { x: pageW * 0.5, y: pageH * 0.35 },
      { x: pageW * 0.5, y: pageH * 0.65 },
    ];

    positions.forEach(({ x, y }) => {
      doc.text(text, x, y, {
        align: "center",
        angle: angle,
      });
    });

    doc.restoreGraphicsState();
  }
}
