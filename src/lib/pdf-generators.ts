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

  // Column layout — proportional widths to prevent overlap
  const colName = marginX;
  const nameW = contentW * 0.28;
  const colRole = colName + nameW;
  const roleW = contentW * 0.28;
  const colPro = colRole + roleW;
  const proW = contentW * 0.13;
  const colIpi = colPro + proW;
  const ipiW = contentW * 0.18;
  const colShare = marginX + contentW;

  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 28, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("NAME", colName + 14, y + 18);
  doc.text("ROLE", colRole + 4, y + 18);
  doc.text("PRO", colPro + 4, y + 18);
  doc.text("IPI", colIpi + 4, y + 18);
  doc.text("SHARE", colShare - 6, y + 18, { align: "right" });
  y += 36;

  splits.forEach((s, i) => {
    const color = splitColors[i % splitColors.length];

    // Calculate row height based on content wrapping
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const roleLines = doc.splitTextToSize(s.role || "—", roleW - 8);
    const ipiLines = doc.splitTextToSize(s.ipi || "—", ipiW - 8);
    const nameLines = doc.splitTextToSize(s.name, nameW - 24);
    const maxLines = Math.max(roleLines.length, ipiLines.length, nameLines.length);
    const baseRowH = 32;
    const extraLineH = 11;
    const rowH = baseRowH + Math.max(0, maxLines - 1) * extraLineH + (s.publisher ? 12 : 0);

    // Page break check
    if (y + rowH > pageH - 80) {
      doc.addPage();
      drawPageBackground(doc);
      y = 48;
    }

    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0] - 2, cardBg[1] - 2, cardBg[2] - 2);
      doc.rect(marginX, y - 4, contentW, rowH, "F");
    }

    // Color dot
    doc.setFillColor(...color);
    doc.circle(colName + 6, y + 10, 4, "F");

    // Name (wrapped)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textLight);
    var nameY = y + 12;
    nameLines.forEach(function (line: string) {
      doc.text(line, colName + 18, nameY);
      nameY += extraLineH;
    });

    // Publisher below name
    if (s.publisher) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      doc.text(s.publisher, colName + 18, nameY);
    }

    // Role (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...textLight);
    var roleY = y + 12;
    roleLines.forEach(function (line: string) {
      doc.text(line, colRole + 4, roleY);
      roleY += extraLineH;
    });

    // PRO
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    doc.text(s.pro || "—", colPro + 4, y + 12);

    // IPI (wrapped)
    var ipiY = y + 12;
    ipiLines.forEach(function (line: string) {
      doc.text(line, colIpi + 4, ipiY);
      ipiY += extraLineH;
    });

    // Share %
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(s.share + "%", colShare - 6, y + 14, { align: "right" });

    y += rowH;
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

export interface CreditEntry {
  label: string;
  value: string;
}

/** Generate credits PDF */
export function generateCreditsPdf(
  title: string,
  artist: string,
  topLevel: CreditEntry[],
  performerCredits: CreditEntry[],
  productionCredits: CreditEntry[],
  asBlob?: boolean,
): Blob | void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "CREDITS");
  drawDividerDots(doc, pageW);

  let y = 210;

  const drawSection = (heading: string, entries: CreditEntry[]) => {
    if (entries.length === 0) return;
    if (y + 40 > pageH - 60) { doc.addPage(); drawPageBackground(doc); y = 48; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textMuted);
    doc.text(heading.toUpperCase(), marginX, y);
    y += 20;

    const colW = (contentW - 12) / 2;
    const rowH = 44;
    entries.forEach((m, i) => {
      if (y + rowH > pageH - 60) { doc.addPage(); drawPageBackground(doc); y = 48; }
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
      const wrappedLines = doc.splitTextToSize(m.value || "—", colW - 24);
      doc.text(wrappedLines[0] || "—", x + 12, y + 30);
      if (col === 1) y += rowH;
    });
    if (entries.length % 2 !== 0) y += rowH;
    y += 8;
  };

  drawSection("Key Credits", topLevel);
  drawSection("Performer Credits", performerCredits);
  drawSection("Production & Other Credits", productionCredits);

  drawFooters(doc, marginX);

  if (asBlob) {
    return doc.output("blob");
  }
  doc.save(`${title} - Credits.pdf`);
}

/** Add diagonal TRAKALOG watermark across all pages */
export function addWatermark(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.saveGraphicsState();

    const gState = (doc as any).GState({ opacity: 0.06 });
    doc.setGState(gState);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(72);
    doc.setTextColor(...brandOrange);

    const text = "TRAKALOG";
    const angle = -35;

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

// ─── Contact List PDF ────────────────────────────────────────────────
export interface ContactExportEntry {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  role: string;
  tracksDownloaded: string[];
  totalDownloads: number;
  lastDownload: string;
}

export function generateContactListPdf(contacts: ContactExportEntry[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;

  // Background + gradient bar
  doc.setFillColor(...bgDark);
  doc.rect(0, 0, pageW, pageH, "F");
  drawGradientBar(doc, pageW, 0, 5);

  // Logo
  const logoY = 24;
  const iconSize = 22;
  try {
    doc.addImage(trakalogLogo, "PNG", marginX, logoY, iconSize, iconSize);
  } catch {
    doc.setFillColor(...brandOrange);
    doc.roundedRect(marginX, logoY, iconSize, iconSize, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("T", marginX + iconSize / 2, logoY + iconSize / 2 + 1, { align: "center", baseline: "middle" });
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...brandOrange);
  doc.text("TRAKALOG", marginX + iconSize + 8, logoY + iconSize / 2 + 1, { baseline: "middle" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...textLight);
  doc.text("Contact List", marginX, 72);

  // Date + count badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.text(`Exported ${dateStr}  ·  ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`, marginX, 88);

  // Table
  const cols = [
    { label: "NAME", width: contentW * 0.25 },
    { label: "EMAIL", width: contentW * 0.30 },
    { label: "ORGANIZATION", width: contentW * 0.25 },
    { label: "ROLE", width: contentW * 0.20 },
  ];

  const rowH = 26;
  const headerY = 108;
  let y = headerY;

  const drawTableHeader = () => {
    doc.setFillColor(28, 28, 32);
    doc.roundedRect(marginX, y, contentW, rowH, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    let x = marginX + 12;
    cols.forEach((col) => {
      doc.text(col.label, x, y + rowH / 2 + 1, { baseline: "middle" });
      x += col.width;
    });
    y += rowH + 2;
  };

  drawTableHeader();

  contacts.forEach((c, idx) => {
    if (y + rowH > pageH - 40) {
      doc.addPage();
      doc.setFillColor(...bgDark);
      doc.rect(0, 0, pageW, pageH, "F");
      drawGradientBar(doc, pageW, 0, 5);
      y = 24;
      drawTableHeader();
    }

    if (idx % 2 === 0) {
      doc.setFillColor(22, 22, 26);
      doc.rect(marginX, y, contentW, rowH, "F");
    }

    doc.setFontSize(8.5);
    let x = marginX + 12;
    const textY = y + rowH / 2 + 1;

    // Name
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textLight);
    doc.text(`${c.firstName} ${c.lastName}`.slice(0, 30), x, textY, { baseline: "middle" });
    x += cols[0].width;

    // Email
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...textMuted);
    doc.text(c.email.slice(0, 36), x, textY, { baseline: "middle" });
    x += cols[1].width;

    // Organization
    doc.setTextColor(...textLight);
    doc.text(c.organization.slice(0, 28), x, textY, { baseline: "middle" });
    x += cols[2].width;

    // Role
    doc.setTextColor(...brandOrange);
    doc.text(c.role.slice(0, 24), x, textY, { baseline: "middle" });

    y += rowH;
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text("Generated by Trakalog", marginX, pageH - 20);
  doc.text("trakalog.com", pageW - marginX, pageH - 20, { align: "right" });

  doc.save("trakalog-contacts.pdf");
}

// ─── Signed Split Agreement PDF ────────────────────────────────────────
export interface SignedSplitEntry {
  name: string;
  role: string;
  share: number;
  pro: string;
  ipi: string;
  publisher: string;
  signatureData: string | null;
  signedAt: string | null;
}

function buildSignedAgreementDoc(title: string, artist: string, entries: SignedSplitEntry[]) {
  var doc = new jsPDF({ unit: "pt", format: "letter" });
  var pageW = doc.internal.pageSize.getWidth();
  var pageH = doc.internal.pageSize.getHeight();
  var marginX = 56;
  var contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "SPLIT AGREEMENT");
  drawDividerDots(doc, pageW);

  var y = 210;

  // Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textMuted);
  var dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.text("Agreement Date: " + dateStr, marginX, y);
  y += 24;

  // Splits table header
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 26, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text("NAME", marginX + 14, y + 16);
  doc.text("ROLE", marginX + contentW * 0.3, y + 16);
  doc.text("SHARE", marginX + contentW * 0.6, y + 16);
  doc.text("PRO / IPI", marginX + contentW * 0.72, y + 16);
  y += 34;

  var splitColors: [number, number, number][] = [brandOrange, brandPink, brandPurple, [80, 180, 220]];

  entries.forEach(function (e, i) {
    if (y + 28 > pageH - 120) {
      doc.addPage();
      drawPageBackground(doc);
      y = 48;
    }
    var color = splitColors[i % splitColors.length];
    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0] - 2, cardBg[1] - 2, cardBg[2] - 2);
      doc.rect(marginX, y - 4, contentW, 26, "F");
    }
    doc.setFillColor(...color);
    doc.circle(marginX + 6, y + 8, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textLight);
    doc.text(e.name, marginX + 16, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(e.role || "—", marginX + contentW * 0.3, y + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(e.share + "%", marginX + contentW * 0.6, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    var proIpi = (e.pro || "—") + " / " + (e.ipi || "—");
    doc.text(proIpi, marginX + contentW * 0.72, y + 10);
    y += 28;
  });

  y += 20;

  // Signatures section
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textMuted);
  doc.text("SIGNATURES", marginX, y);
  y += 16;

  entries.forEach(function (e, i) {
    if (y + 90 > pageH - 60) {
      doc.addPage();
      drawPageBackground(doc);
      y = 48;
    }

    doc.setFillColor(...cardBg);
    doc.roundedRect(marginX, y, contentW, 80, 6, 6, "F");

    // Name + role
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textLight);
    doc.text(e.name, marginX + 14, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(e.role + " — " + e.share + "%", marginX + 14, y + 32);

    // Signature image
    if (e.signatureData) {
      try {
        doc.addImage(e.signatureData, "PNG", marginX + contentW - 170, y + 6, 150, 50);
      } catch (err) {
        doc.setFontSize(8);
        doc.setTextColor(...textMuted);
        doc.text("[Signature on file]", marginX + contentW - 100, y + 35);
      }
    } else {
      doc.setFontSize(8);
      doc.setTextColor(...brandOrange);
      doc.text("[Pending]", marginX + contentW - 80, y + 35);
    }

    // Signed date
    if (e.signedAt) {
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text("Signed: " + new Date(e.signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), marginX + 14, y + 70);
    }

    y += 90;
  });

  // Legal footer
  y += 10;
  if (y + 40 > pageH - 60) {
    doc.addPage();
    drawPageBackground(doc);
    y = 48;
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  var legalLines = doc.splitTextToSize("This document was generated by Trakalog. The signatures above constitute a binding agreement between all parties listed regarding the ownership split of the track \"" + title + "\" by " + artist + ".", contentW);
  legalLines.forEach(function (line: string) {
    doc.text(line, marginX, y);
    y += 11;
  });

  drawFooters(doc, marginX);
  return doc;
}

export function generateSignedAgreementPdf(title: string, artist: string, entries: SignedSplitEntry[], asBlob?: boolean): Blob | void {
  var doc = buildSignedAgreementDoc(title, artist, entries);
  if (asBlob) {
    return doc.output("blob");
  }
  doc.save(title + " - Split Agreement.pdf");
}

export function generateSignedAgreementPdfBase64(title: string, artist: string, entries: SignedSplitEntry[]): string {
  var doc = buildSignedAgreementDoc(title, artist, entries);
  return doc.output("datauristring").split(",")[1];
}
