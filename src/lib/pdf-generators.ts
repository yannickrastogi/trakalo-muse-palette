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
  drawTrakalogWordmark(doc, marginX + iconSize + 10, y + iconSize / 2 + 1, 13, { baseline: "middle" });
}

/**
 * Renders the TRAKALOG wordmark letter-by-letter with an orange→pink→purple gradient.
 * Each character is colored along the gradient interpolation (T = orange, A (middle) ≈ pink, G = purple).
 * Caller controls position, font size, and baseline — replaces a single doc.text("TRAKALOG", ...) call.
 */
function drawTrakalogWordmark(
  doc: jsPDF,
  x: number,
  y: number,
  fontSize: number,
  options?: { baseline?: "alphabetic" | "top" | "middle" | "bottom" | "hanging" | "ideographic" }
) {
  const baseline = options?.baseline ?? "alphabetic";
  const word = "TRAKALOG";
  const orange: [number, number, number] = [249, 115, 22];
  const pink: [number, number, number] = [236, 72, 153];
  const purple: [number, number, number] = [168, 85, 247];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fontSize);
  let cursorX = x;
  for (let i = 0; i < word.length; i++) {
    const t = i / (word.length - 1); // 0..1 across T..G
    let r: number, g: number, b: number;
    if (t < 0.5) {
      const tt = t * 2;
      r = Math.round(orange[0] + (pink[0] - orange[0]) * tt);
      g = Math.round(orange[1] + (pink[1] - orange[1]) * tt);
      b = Math.round(orange[2] + (pink[2] - orange[2]) * tt);
    } else {
      const tt = (t - 0.5) * 2;
      r = Math.round(pink[0] + (purple[0] - pink[0]) * tt);
      g = Math.round(pink[1] + (purple[1] - pink[1]) * tt);
      b = Math.round(pink[2] + (purple[2] - pink[2]) * tt);
    }
    doc.setTextColor(r, g, b);
    doc.text(word[i], cursorX, y, { baseline });
    cursorX += doc.getTextWidth(word[i]);
  }
}

function drawHeaderCard(doc: jsPDF, marginX: number, contentW: number, pageW: number, title: string, artist: string, badgeLabel: string) {
  let y = 92;
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 80, 8, 8, "F");

  // Badge geometry (top-right) — computed first so the title can be clamped to it.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(badgeLabel) + 16;
  const badgeX = pageW - marginX - badgeW - 20;

  // Title — truncate with an ellipsis so a long name never runs under the badge.
  // Short titles fit within titleMaxW and render unchanged.
  const titleX = marginX + 20;
  const titleMaxW = badgeX - titleX - 12; // 12pt gutter before the badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...textLight);
  // ASCII "..." rather than the … glyph — jsPDF standard fonts may not render U+2026.
  let shownTitle = title;
  if (doc.getTextWidth(shownTitle) > titleMaxW) {
    while (shownTitle.length > 1 && doc.getTextWidth(shownTitle + "...") > titleMaxW) {
      shownTitle = shownTitle.slice(0, -1);
    }
    shownTitle = shownTitle.replace(/\s+$/, "") + "...";
  }
  doc.text(shownTitle, titleX, y + 32);

  // Artist sits on the row below the badge (never overlaps it) — unchanged.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...textMuted);
  doc.text(artist, titleX, y + 54);

  // Badge on top of everything (the title is already clamped clear of it).
  doc.setFillColor(...brandOrange);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.roundedRect(badgeX, y + 16, badgeW, 18, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(badgeLabel, badgeX + badgeW / 2, y + 28, { align: "center" });
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
  stage_name?: string;
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
    // `share` is absent on public/sanitized splits → treat as 0 (no bar segment).
    const w = ((s.share ?? 0) / 100) * contentW;
    doc.setFillColor(...color);
    doc.roundedRect(barX, y, Math.max(w, 2), barHeight, i === 0 ? 4 : 0, i === splits.length - 1 ? 4 : 0, "F");
    barX += w;
  });
  y += barHeight + 24;

  // Column layout — proportional widths to prevent overlap
  const colName = marginX;
  const nameW = contentW * 0.30;
  const colRole = colName + nameW;
  const roleW = contentW * 0.22;
  const colPro = colRole + roleW;
  const proW = contentW * 0.20;
  const colIpi = colPro + proW;
  const ipiW = contentW * 0.15;
  const colShare = colIpi + ipiW;
  const shareW = contentW * 0.13;

  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 28, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...textMuted);
  doc.text("NAME", colName + 14, y + 18);
  doc.text("ROLE", colRole + 4, y + 18);
  doc.text("PRO", colPro + 4, y + 18);
  doc.text("IPI", colIpi + 4, y + 18);
  doc.text("SHARE", colShare + shareW - 6, y + 18, { align: "right" });
  y += 36;

  splits.forEach((s, i) => {
    const color = splitColors[i % splitColors.length];

    // Build display name with stage name
    const displayName = s.stage_name ? s.name + " (" + s.stage_name + ")" : s.name;

    // Calculate row height based on content wrapping
    // Use name font (bold 9) for name wrapping calculation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const nameLines = doc.splitTextToSize(displayName, nameW - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    const publisherLines = s.publisher ? doc.splitTextToSize(s.publisher, nameW - 24) : [];
    doc.setFontSize(8.5);
    const roleLines = doc.splitTextToSize(s.role || "—", roleW - 8);
    const proLines = doc.splitTextToSize(s.pro || "—", proW - 8);
    const extraLineH = 11;
    const nameColumnLines = nameLines.length + publisherLines.length;
    const maxLines = Math.max(nameColumnLines, roleLines.length, proLines.length, 1);
    const baseRowH = 32;
    const rowH = baseRowH + Math.max(0, maxLines - 1) * extraLineH;

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

    // Name with stage name (wrapped)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textLight);
    var nameY = y + 12;
    nameLines.forEach(function (line: string) {
      doc.text(line, colName + 18, nameY);
      nameY += extraLineH;
    });

    // Publisher below name (wrapped)
    if (s.publisher) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      publisherLines.forEach(function (line: string) {
        doc.text(line, colName + 18, nameY);
        nameY += extraLineH;
      });
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

    // PRO (wrapped)
    doc.setFontSize(8.5);
    doc.setTextColor(...textMuted);
    var proY = y + 12;
    proLines.forEach(function (line: string) {
      doc.text(line, colPro + 4, proY);
      proY += extraLineH;
    });

    // IPI
    doc.text(s.ipi || "—", colIpi + 4, y + 12);

    // Share %
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(s.share != null ? s.share + "%" : "—", colShare + shareW - 6, y + 14, { align: "right" });

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
  doc.text(`${totalShares}%`, colShare + shareW - 6, y, { align: "right" });
  if (isComplete) {
    doc.setFontSize(8);
    doc.setTextColor(74, 222, 128);
    doc.text("✓ Fully allocated", colShare + shareW - 6 - 40, y + 14, { align: "right" });
  }

  drawFooters(doc, marginX);

  if (asBlob) {
    return doc.output("blob");
  }
  doc.save(`${title} - Splits.pdf`);
}

export interface TagsPdfData {
  instruments?: string[];
  lyric_themes?: string[];
  mood_feel?: string[];
  tempo_descriptor?: string | null;
  sync_tags?: string[];
  custom?: string[];
}

/** Generate metadata PDF — optionally includes performer & production credits and tags sections */
export function generateMetadataPdf(
  title: string,
  artist: string,
  meta: MetaField[],
  performerCredits?: CreditEntry[],
  productionCredits?: CreditEntry[],
  asBlobOrTags?: boolean | TagsPdfData,
  asBlob?: boolean,
): Blob | void {
  let tags: TagsPdfData | undefined;
  let returnBlob = asBlob;
  if (typeof asBlobOrTags === "boolean") {
    returnBlob = asBlobOrTags;
  } else if (asBlobOrTags && typeof asBlobOrTags === "object") {
    tags = asBlobOrTags;
  }
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(doc, marginX, contentW, pageW, title, artist, "TRACK INFO");
  drawDividerDots(doc, pageW);

  let y = 210;
  const colW = (contentW - 12) / 2;
  const rowH = 44;

  const drawSectionGrid = (heading: string, entries: MetaField[] | CreditEntry[]) => {
    const filled = entries.filter(e => e.value && e.value !== "—");
    if (filled.length === 0) return;

    if (y + 40 > pageH - 60) { doc.addPage(); drawPageBackground(doc); y = 48; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textMuted);
    doc.text(heading.toUpperCase(), marginX, y);
    y += 20;

    filled.forEach((m, i) => {
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
    if (filled.length % 2 !== 0) y += rowH;
    y += 8;
  };

  drawSectionGrid("Metadata", meta);
  if (performerCredits) drawSectionGrid("Performer Credits", performerCredits);
  if (productionCredits) drawSectionGrid("Production & Other Credits", productionCredits);

  // Tags section
  if (tags) {
    const tagEntries: MetaField[] = [];
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    if (tags.instruments?.length) tagEntries.push({ label: "Instruments", value: tags.instruments.map(capitalize).join(", ") });
    if (tags.lyric_themes?.length) tagEntries.push({ label: "Lyric Themes", value: tags.lyric_themes.map(capitalize).join(", ") });
    if (tags.mood_feel?.length) tagEntries.push({ label: "Mood & Feel", value: tags.mood_feel.map(capitalize).join(", ") });
    if (tags.tempo_descriptor) tagEntries.push({ label: "Tempo", value: capitalize(tags.tempo_descriptor) });
    if (tags.sync_tags?.length) tagEntries.push({ label: "Sync Tags", value: tags.sync_tags.map(capitalize).join(", ") });
    if (tags.custom?.length) tagEntries.push({ label: "Custom Tags", value: tags.custom.join(", ") });
    if (tagEntries.length > 0) drawSectionGrid("Tags", tagEntries);
  }

  drawFooters(doc, marginX);

  if (returnBlob) {
    return doc.output("blob");
  }
  doc.save(`${title} - Metadata.pdf`);
}

export interface LeakReportData {
  file_name: string | null;
  created_at: string | null;
  match: boolean;
  visitor_email: string | null;
  visitor_name: string | null;
  link_id: string | null;
  confidence: number | null;
  hash_hex: string | null;
  leaker_ip: string | null;
  ip_source: "download" | "listen" | "link_only" | null;
}

/** Generate a branded Leak Trace Report PDF — matches the splits/credits style. */
export function generateLeakReportPdf(trace: LeakReportData, workspaceName?: string, asBlob?: boolean): Blob | void {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  drawPageBackground(doc);
  drawLogo(doc, marginX);
  drawHeaderCard(
    doc,
    marginX,
    contentW,
    pageW,
    trace.file_name || "Leak Trace Report",
    workspaceName || "Leak Tracing",
    trace.match ? "LEAK DETECTED" : "CLEAN",
  );
  drawDividerDots(doc, pageW);

  let y = 210;

  // Status banner — red when a leak is traced, green when clean.
  const leakRed: [number, number, number] = [200, 55, 65];
  const cleanGreen: [number, number, number] = [40, 165, 110];
  doc.setFillColor(...(trace.match ? leakRed : cleanGreen));
  doc.roundedRect(marginX, y, contentW, 30, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    trace.match ? "WATERMARK DETECTED — LEAK TRACED" : "NO WATERMARK DETECTED — CLEAN",
    marginX + 14,
    y + 19.5,
  );
  y += 48;

  const rowH = 40;
  const drawRow = (label: string, value: string) => {
    if (y + rowH > pageH - 60) { doc.addPage(); drawPageBackground(doc); y = 48; }
    doc.setFillColor(...cardBg);
    doc.roundedRect(marginX, y, contentW, rowH - 6, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...brandOrange);
    doc.text(label.toUpperCase(), marginX + 14, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...textLight);
    const wrapped = doc.splitTextToSize(value, contentW - 28);
    doc.text(wrapped[0] || "—", marginX + 14, y + 27);
    y += rowH;
  };

  drawRow("Date analyzed", trace.created_at ? new Date(trace.created_at).toLocaleString() : "—");
  drawRow("File", trace.file_name || "—");
  if (trace.match) {
    drawRow("Name", trace.visitor_name || "Not available");
    drawRow("Email", trace.visitor_email || "Not available");
    drawRow("Shared link", trace.link_id || "Not available");
    const ipSuffix =
      trace.ip_source === "link_only" ? "  (via link — email unverified)"
      : trace.ip_source === "listen" ? "  (from listen)"
      : trace.ip_source === "download" ? "  (from download)"
      : "";
    drawRow("IP address", trace.leaker_ip ? trace.leaker_ip + ipSuffix : "Not available");
    drawRow("Confidence", trace.confidence != null ? Math.round(trace.confidence * 100) + "%" : "—");
    drawRow("Watermark hash", trace.hash_hex || "Not available");
  }

  drawFooters(doc, marginX);

  if (asBlob) return doc.output("blob");
  const datePart = (trace.created_at ? new Date(trace.created_at) : new Date()).toISOString().slice(0, 10);
  doc.save("leak-report-" + datePart + ".pdf");
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
  stageName: string;
  publisher: string;
  ipi: string;
  pro: string;
  phone: string;
  city: string;
  country: string;
  collaborationsCount: number;
  tracksDownloaded: string[];
  totalDownloads: number;
  lastDownload: string;
}

export function generateContactListPdf(contacts: ContactExportEntry[], workspaceName: string = "Workspace") {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentW = pageW - marginX * 2;

  // Cell rendering constants (clean wrap pattern, same as buildSignedAgreementDoc)
  // No line cap — long values wrap fully; rowH grows dynamically.
  const LINE_HEIGHT = 9.5;       // pt — tuned to fontSize 8.5
  const MIN_ROW_H = 22;
  const CELL_PADDING_X = 4;
  const CELL_PADDING_Y = 6;      // top/bottom vertical padding inside a row
  const FOOTER_RESERVED = 40;    // reserve space at bottom of page for footer line

  const drawPageBackground = () => {
    doc.setFillColor(...bgDark);
    doc.rect(0, 0, pageW, pageH, "F");
    drawGradientBar(doc, pageW, 0, 5);
  };

  const drawHeaderBlock = () => {
    // Logo (icon + gradient wordmark)
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
    drawTrakalogWordmark(doc, marginX + iconSize + 8, logoY + iconSize / 2 + 1, 11, { baseline: "middle" });
  };

  drawPageBackground();
  drawHeaderBlock();

  // Title — "{Workspace} — Contacts" (em-dash unicode \u2014)
  const wsLabel = (workspaceName || "Workspace").trim() || "Workspace";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...textLight);
  doc.text(`${wsLabel} \u2014 Contacts`, marginX, 72);

  // Date + count badge
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  doc.text(`Exported ${dateStr}  \u00B7  ${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`, marginX, 88);

  // Table — 10 columns. Widths rebalanced: more room for EMAIL / LOCATION / ROLE
  // (visibly truncated before), shrink PHONE / IPI / PUBLISHER / STAGE which fit shorter content.
  const cols = [
    { label: "NAME",         width: contentW * 0.10 },
    { label: "EMAIL",        width: contentW * 0.16 },
    { label: "PHONE",        width: contentW * 0.10 },
    { label: "STAGE NAME",   width: contentW * 0.08 },
    { label: "ORGANIZATION", width: contentW * 0.085 },
    { label: "PUBLISHER",    width: contentW * 0.08 },
    { label: "IPI",          width: contentW * 0.085 },
    { label: "PRO",          width: contentW * 0.10 },
    { label: "LOCATION",     width: contentW * 0.10 },
    { label: "ROLE",         width: contentW * 0.11 },
  ];

  const headerRowH = 22;
  const headerStartY = 108;
  let y = headerStartY;

  const drawTableHeader = () => {
    doc.setFillColor(28, 28, 32);
    doc.roundedRect(marginX, y, contentW, headerRowH, 4, 4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    let x = marginX + 12;
    cols.forEach((col) => {
      doc.text(col.label, x, y + headerRowH / 2 + 1, { baseline: "middle" });
      x += col.width;
    });
    y += headerRowH + 2;
  };

  drawTableHeader();

  // Helper: wrap a cell's text to as many lines as needed (no cap, no ellipsis).
  // rowH grows dynamically so long values stay fully readable.
  // (using fontSize 8.5 which is already set on rendering — call this AFTER setting font)
  const wrapCell = (text: string, colWidth: number): string[] => {
    if (!text) return [];
    const maxW = Math.max(8, colWidth - 2 * CELL_PADDING_X);
    return doc.splitTextToSize(text, maxW) as string[];
  };

  contacts.forEach((c, idx) => {
    // Use the same fontSize wrapCell will measure with
    doc.setFontSize(8.5);

    // First pass — compute wrapped lines per cell
    const locStr = [c.city, c.country].filter((s) => s && s.trim()).join(", ");
    const cells: string[][] = [
      wrapCell(`${c.firstName} ${c.lastName}`.trim(), cols[0].width),
      wrapCell(c.email || "", cols[1].width),
      wrapCell(c.phone || "", cols[2].width),
      wrapCell(c.stageName || "", cols[3].width),
      wrapCell(c.organization || "", cols[4].width),
      wrapCell(c.publisher || "", cols[5].width),
      wrapCell(c.ipi || "", cols[6].width),
      wrapCell(c.pro || "", cols[7].width),
      wrapCell(locStr, cols[8].width),
      wrapCell(c.role || "", cols[9].width),
    ];
    const maxLines = Math.max(1, ...cells.map((c2) => c2.length));
    const rowH = Math.max(MIN_ROW_H, maxLines * LINE_HEIGHT + 2 * CELL_PADDING_Y);

    // Pagination — break before this row if it would overflow
    if (y + rowH > pageH - FOOTER_RESERVED) {
      doc.addPage();
      drawPageBackground();
      // On continuation pages, redraw the table header only (no title, no logo block)
      y = 60;
      drawTableHeader();
    }

    // Zebra striping
    if (idx % 2 === 0) {
      doc.setFillColor(22, 22, 26);
      doc.rect(marginX, y, contentW, rowH, "F");
    }

    // Render cells — vertically centered block of `maxLines * LINE_HEIGHT`
    const blockH = maxLines * LINE_HEIGHT;
    const blockTop = y + (rowH - blockH) / 2;
    let x = marginX + 12;

    // Per-column font/color setup
    const styles: Array<{ font: "bold" | "normal"; color: [number, number, number] }> = [
      { font: "bold",   color: textLight },     // NAME
      { font: "normal", color: textMuted },     // EMAIL
      { font: "normal", color: textMuted },     // PHONE
      { font: "normal", color: textLight },     // STAGE
      { font: "normal", color: textLight },     // ORG
      { font: "normal", color: textMuted },     // PUBLISHER
      { font: "normal", color: textMuted },     // IPI
      { font: "normal", color: textMuted },     // PRO
      { font: "normal", color: textMuted },     // LOCATION
      { font: "normal", color: brandOrange },   // ROLE
    ];

    cells.forEach((lines, colIdx) => {
      const style = styles[colIdx];
      doc.setFont("helvetica", style.font);
      doc.setTextColor(...style.color);
      lines.forEach((line, li) => {
        // baseline:"top" lets us position by line index from blockTop
        doc.text(line, x + CELL_PADDING_X, blockTop + li * LINE_HEIGHT, { baseline: "top" });
      });
      x += cols[colIdx].width;
    });

    y += rowH;
  });

  // Footer — drawn on EVERY page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.text("Generated by Trakalog", marginX, pageH - 20);
    if (totalPages > 1) {
      doc.text(`${p} / ${totalPages}`, pageW / 2, pageH - 20, { align: "center" });
    }
    doc.text("trakalog.com", pageW - marginX, pageH - 20, { align: "right" });
  }

  doc.save("trakalog-contacts.pdf");
}

// ─── Signed Split Agreement PDF ────────────────────────────────────────
export interface SignedSplitEntry {
  name: string;
  stage_name?: string;
  role: string;
  share: number;
  pro: string;
  ipi: string;
  publisher: string;
  signatureData: string | null;
  signedAt: string | null;
  /** Marked as signed elsewhere (migrated track) — no on-file signature image. */
  signedExternally?: boolean;
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

  // Splits table — column layout
  var saNameW = contentW * 0.30;
  var saRoleW = contentW * 0.22;
  var saShareW = contentW * 0.12;
  var saProIpiW = contentW * 0.36;
  var saColName = marginX;
  var saColRole = saColName + saNameW;
  var saColShare = saColRole + saRoleW;
  var saColProIpi = saColShare + saShareW;

  // Splits table header
  doc.setFillColor(...cardBg);
  doc.roundedRect(marginX, y, contentW, 26, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text("NAME", saColName + 14, y + 16);
  doc.text("ROLE", saColRole + 4, y + 16);
  doc.text("SHARE", saColShare + 4, y + 16);
  doc.text("PRO / IPI", saColProIpi + 4, y + 16);
  y += 34;

  var splitColors: [number, number, number][] = [brandOrange, brandPink, brandPurple, [80, 180, 220]];
  var saExtraLineH = 11;

  entries.forEach(function (e, i) {
    var color = splitColors[i % splitColors.length];
    var signedDisplayName = e.stage_name ? e.name + " (" + e.stage_name + ")" : e.name;
    var proIpi = (e.pro || "—") + " / " + (e.ipi || "—");

    // Calculate wrapped lines
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    var saNameLines = doc.splitTextToSize(signedDisplayName, saNameW - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    var saRoleLines = doc.splitTextToSize(e.role || "—", saRoleW - 8);
    doc.setFontSize(7.5);
    var saProIpiLines = doc.splitTextToSize(proIpi, saProIpiW - 8);

    var saMaxLines = Math.max(saNameLines.length, saRoleLines.length, saProIpiLines.length, 1);
    var saRowH = 24 + Math.max(0, saMaxLines - 1) * saExtraLineH;

    if (y + saRowH > pageH - 120) {
      doc.addPage();
      drawPageBackground(doc);
      y = 48;
    }
    if (i % 2 === 0) {
      doc.setFillColor(cardBg[0] - 2, cardBg[1] - 2, cardBg[2] - 2);
      doc.rect(marginX, y - 4, contentW, saRowH, "F");
    }
    doc.setFillColor(...color);
    doc.circle(saColName + 6, y + 8, 3, "F");

    // Name (wrapped)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textLight);
    var saNameY = y + 10;
    saNameLines.forEach(function (line: string) {
      doc.text(line, saColName + 16, saNameY);
      saNameY += saExtraLineH;
    });

    // Role (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    var saRoleY = y + 10;
    saRoleLines.forEach(function (line: string) {
      doc.text(line, saColRole + 4, saRoleY);
      saRoleY += saExtraLineH;
    });

    // Share
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...color);
    doc.text(e.share + "%", saColShare + 4, y + 10);

    // PRO / IPI (wrapped)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    var saProY = y + 10;
    saProIpiLines.forEach(function (line: string) {
      doc.text(line, saColProIpi + 4, saProY);
      saProY += saExtraLineH;
    });

    y += saRowH;
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
    var sigDisplayName = e.stage_name ? e.name + " (" + e.stage_name + ")" : e.name;
    doc.text(sigDisplayName, marginX + 14, y + 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(e.role + " — " + e.share + "%", marginX + 14, y + 32);

    // Signature image — or an explicit "signed externally" note for migrated
    // tracks (no on-file signature image), vs "[Pending]" for the not-yet-signed.
    if (e.signatureData) {
      try {
        doc.addImage(e.signatureData, "PNG", marginX + contentW - 170, y + 6, 150, 50);
      } catch (err) {
        doc.setFontSize(8);
        doc.setTextColor(...textMuted);
        doc.text("[Signature on file]", marginX + contentW - 100, y + 35);
      }
    } else if (e.signedExternally) {
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text("[Signed externally]", marginX + contentW - 110, y + 35);
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

// ─── Contact Card PDF (single contact, A4 portrait, minimalist) ──────
function sanitizeFilename(s: string): string {
  return s.replace(/[\/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_");
}

export function exportContactCardPdf(params: {
  contact: ContactExportEntry;
  workspaceName: string;
  displayRoles: string[];
}) {
  const { contact, workspaceName, displayRoles } = params;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // ~595pt
  const pageH = doc.internal.pageSize.getHeight();  // ~842pt
  const marginX = 56;
  const contentW = pageW - marginX * 2;

  // Dark palette (matches the rest of the Trakalog PDF suite)
  const bgPage: [number, number, number] = [10, 10, 11];
  const cardSubtle: [number, number, number] = [20, 20, 22];
  const textPrimary: [number, number, number] = [245, 245, 250];
  const textMutedGray: [number, number, number] = [140, 140, 148];
  const textLabel: [number, number, number] = [110, 110, 118];
  const dividerColor: [number, number, number] = [40, 40, 45];

  // Page background
  doc.setFillColor(...bgPage);
  doc.rect(0, 0, pageW, pageH, "F");

  // Top gradient border (orange → pink → purple)
  drawGradientBar(doc, pageW, 0, 3);

  // TRAKALOG logo (icon + gradient wordmark, shared with all other PDFs)
  drawLogo(doc, marginX);

  // Header card (subtle dark) with avatar + name + stage
  // cardY pushed below drawLogo footprint (icon spans y=42..70 with wordmark baseline 59)
  const cardY = 90;
  const cardH = 150;
  doc.setFillColor(...cardSubtle);
  doc.roundedRect(marginX, cardY, contentW, cardH, 8, 8, "F");

  // Avatar — solid pink circle (clean, matches Trakalog splits PDF dot style)
  const avatarCx = pageW / 2;
  const avatarCy = cardY + 45;
  const avatarR = 30;
  doc.setFillColor(...brandPink);
  doc.circle(avatarCx, avatarCy, avatarR, "F");
  // Initials
  const a = (contact.firstName?.[0] || "?").toUpperCase();
  const b = (contact.lastName?.[0] || "").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(a + b, avatarCx, avatarCy + 8, { align: "center" });

  // Name (centered, white bold)
  const fullName = (contact.firstName + " " + contact.lastName).trim();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...textPrimary);
  doc.text(fullName, avatarCx, cardY + 105, { align: "center" });

  // Stage name (centered, italic, muted)
  if (contact.stageName?.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...textMutedGray);
    doc.text(contact.stageName, avatarCx, cardY + 125, { align: "center" });
  }

  // ── Body ──
  let y = cardY + cardH + 40;
  const labelColW = 100;
  const labelX = marginX;
  const valueX = marginX + labelColW;
  const lineGap = 22;

  const drawSectionHeader = (label: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...brandOrange);
    doc.text(label.toUpperCase(), marginX, y);
    y += 8;
    // subtle dark divider
    doc.setDrawColor(...dividerColor);
    doc.setLineWidth(0.5);
    doc.line(marginX, y, marginX + contentW, y);
    y += 18;
  };

  const drawRow = (label: string, value: string) => {
    if (!value) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textLabel);
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...textPrimary);
    const maxValW = contentW - labelColW;
    const wrapped = doc.splitTextToSize(value, maxValW) as string[];
    wrapped.forEach((line, i) => {
      doc.text(line, valueX, y + i * 13);
    });
    y += Math.max(lineGap, wrapped.length * 13 + 8);
  };

  // CONTACT section
  drawSectionHeader("Contact");
  drawRow("Email", contact.email || "");
  drawRow("Phone", contact.phone || "");
  const locationParts = [contact.city, contact.country].map((s) => (s || "").trim()).filter(Boolean);
  drawRow("Location", locationParts.join(", "));
  y += 14;

  // INDUSTRY section — only if at least one field present
  const rolesStr = displayRoles.join(", ");
  const publisherStr = (contact.publisher || "").split(",").map((s) => s.trim()).filter(Boolean).join(", ");
  const proStr = (contact.pro || "").split(",").map((s) => s.trim()).filter(Boolean).join(", ");
  const hasIndustry = !!(rolesStr || contact.organization || publisherStr || (contact.ipi || "").trim() || proStr);

  if (hasIndustry) {
    drawSectionHeader("Industry");
    drawRow("Roles", rolesStr);
    drawRow("Organization", contact.organization || "");
    drawRow("Publisher", publisherStr);
    drawRow("IPI", (contact.ipi || "").trim());
    drawRow("PROs", proStr);
  }

  // Footer — centered italic muted gray with divider above
  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const footerY = pageH - 32;
  doc.setDrawColor(...dividerColor);
  doc.setLineWidth(0.5);
  doc.line(marginX, footerY - 18, marginX + contentW, footerY - 18);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...textMutedGray);
  const wsLabel = (workspaceName || "Workspace").trim();
  doc.text("Generated via Trakalog  ·  " + wsLabel + "  ·  " + dateStr, pageW / 2, footerY, { align: "center" });

  // Bottom gradient border
  drawGradientBar(doc, pageW, pageH - 3, 3);

  // Save
  const safeFirst = sanitizeFilename(contact.firstName || "Contact");
  const safeLast = sanitizeFilename(contact.lastName || "");
  const filename = (safeLast ? safeFirst + "_" + safeLast : safeFirst) + "_Contact.pdf";
  doc.save(filename);
}
