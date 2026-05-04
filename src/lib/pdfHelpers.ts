import jsPDF from 'jspdf';

/* ─── Color Palette (matches app theme) ─── */
const COLORS = {
  // Primary brand
  brand:      [30, 58, 95] as RGB,    // deep navy
  brandLight: [55, 80, 120] as RGB,   // lighter navy
  accent:     [200, 120, 40] as RGB,  // warm amber

  // Risk levels
  critical: [185, 28, 28] as RGB,
  high:     [217, 119, 6] as RGB,
  medium:   [202, 138, 4] as RGB,
  low:      [22, 163, 74] as RGB,

  // Status
  success:  [22, 163, 74] as RGB,
  warning:  [217, 119, 6] as RGB,
  danger:   [185, 28, 28] as RGB,
  info:     [37, 99, 235] as RGB,

  // Backgrounds (fill)
  headerBg:   [30, 58, 95] as RGB,
  sectionBg:  [245, 247, 250] as RGB,
  cardBg:     [255, 255, 255] as RGB,
  alertBgRed: [254, 242, 242] as RGB,
  alertBgAmber:[255, 251, 235] as RGB,
  alertBgGreen:[240, 253, 244] as RGB,
  alertBgBlue: [239, 246, 255] as RGB,
  badgeBgRed:  [254, 226, 226] as RGB,
  badgeBgAmber:[254, 243, 199] as RGB,
  badgeBgGreen:[220, 252, 231] as RGB,
  badgeBgBlue: [219, 234, 254] as RGB,

  // Text
  textDark:  [30, 30, 30] as RGB,
  textBody:  [55, 65, 81] as RGB,
  textMuted: [107, 114, 128] as RGB,
  textWhite: [255, 255, 255] as RGB,

  // Lines
  divider:   [229, 231, 235] as RGB,
  border:    [209, 213, 219] as RGB,
};

type RGB = [number, number, number];

export interface PDFContext {
  doc: jsPDF;
  y: number;
  margin: number;
  maxWidth: number;
  pageHeight: number;
  pageWidth: number;
  pageNumber: number;
}

/* ─── Core Context ─── */
export function createPDFContext(orientation: 'portrait' | 'landscape' = 'portrait'): PDFContext {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  return { doc, y: 44, margin, maxWidth: pageWidth - margin * 2, pageHeight, pageWidth, pageNumber: 1 };
}

export function checkPage(ctx: PDFContext, needed = 60) {
  if (ctx.y + needed > ctx.pageHeight - 50) {
    ctx.doc.addPage();
    ctx.pageNumber++;
    ctx.y = 44;
    addPageNumber(ctx);
  }
}

function addPageNumber(ctx: PDFContext) {
  const prevY = ctx.y;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...COLORS.textMuted);
  ctx.doc.text(`Page ${ctx.pageNumber}`, ctx.pageWidth - ctx.margin, ctx.pageHeight - 24, { align: 'right' });
  ctx.y = prevY;
}

/* ─── Document Header (full-width colored banner) ─── */
export function addDocumentHeader(ctx: PDFContext, title: string, subtitle?: string) {
  const bannerH = subtitle ? 68 : 50;
  ctx.doc.setFillColor(...COLORS.headerBg);
  ctx.doc.rect(0, 0, ctx.pageWidth, bannerH, 'F');

  // Accent bar
  ctx.doc.setFillColor(...COLORS.accent);
  ctx.doc.rect(0, bannerH, ctx.pageWidth, 3, 'F');

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(18);
  ctx.doc.setTextColor(...COLORS.textWhite);
  ctx.doc.text(title, ctx.margin, 30);

  if (subtitle) {
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(180, 195, 220);
    ctx.doc.text(subtitle, ctx.margin, 50);
  }

  ctx.y = bannerH + 16;
  addPageNumber(ctx);
}

/* ─── Section Header (colored left bar) ─── */
export function addSectionHeader(ctx: PDFContext, text: string, color: RGB = COLORS.brand) {
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(14);
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth - 16);
  const blockH = lines.length * 18 + 8;
  checkPage(ctx, blockH);
  ctx.doc.setFillColor(...color);
  ctx.doc.rect(ctx.margin, ctx.y - 12, 4, 18, 'F');
  ctx.doc.setTextColor(...color);
  ctx.doc.text(lines, ctx.margin + 12, ctx.y);
  ctx.y += (lines.length - 1) * 18 + 20;
}

/* ─── Titles & Text ─── */
export function addTitle(ctx: PDFContext, text: string, size = 14) {
  checkPage(ctx, size + 16);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...COLORS.brand);
  ctx.doc.text(text, ctx.margin, ctx.y);
  ctx.y += size + 6;
}

export function addSubtitle(ctx: PDFContext, text: string, size = 11) {
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth);
  checkPage(ctx, lines.length * (size + 3) + 6);
  ctx.doc.setTextColor(...COLORS.brandLight);
  ctx.doc.text(lines, ctx.margin, ctx.y);
  ctx.y += lines.length * (size + 3) + 2;
}

export function addBody(ctx: PDFContext, text: string, size = 9.5) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...COLORS.textBody);
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth);
  checkPage(ctx, lines.length * (size + 3) + 6);
  ctx.doc.text(lines, ctx.margin, ctx.y);
  ctx.y += lines.length * (size + 3) + 3;
}

export function addBullet(ctx: PDFContext, text: string, size = 9.5, indent = 0) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...COLORS.textBody);
  const leftPad = ctx.margin + 12 + indent;
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth - 12 - indent);
  checkPage(ctx, lines.length * (size + 3) + 3);
  // Bullet dot
  ctx.doc.setFillColor(...COLORS.accent);
  ctx.doc.circle(ctx.margin + 4 + indent, ctx.y - 2.5, 2.2, 'F');
  ctx.doc.text(lines, leftPad, ctx.y);
  ctx.y += lines.length * (size + 3) + 1;
}

/* ─── Key-Value (label: value inline) ─── */
export function addKeyValue(ctx: PDFContext, key: string, value: string, size = 9.5) {
  checkPage(ctx, size + 6);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(...COLORS.textMuted);
  ctx.doc.text(`${key}:`, ctx.margin, ctx.y);
  const keyWidth = ctx.doc.getTextWidth(`${key}: `);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(...COLORS.textDark);
  const valLines = ctx.doc.splitTextToSize(value, ctx.maxWidth - keyWidth);
  ctx.doc.text(valLines, ctx.margin + keyWidth, ctx.y);
  ctx.y += valLines.length * (size + 3) + 2;
}

/* ─── Score Card Row (colored metric boxes side by side) ─── */
export interface ScoreCardItem {
  label: string;
  value: string;
  sublabel?: string;
  color?: 'red' | 'amber' | 'green' | 'blue' | 'brand';
}

export function addScoreCards(ctx: PDFContext, items: ScoreCardItem[]) {
  const count = Math.min(items.length, 5);
  if (count === 0) return;
  checkPage(ctx, 56);

  const gap = 8;
  const cardW = (ctx.maxWidth - gap * (count - 1)) / count;
  const cardH = 48;

  const colorMap: Record<string, { bg: RGB; text: RGB }> = {
    red:   { bg: COLORS.alertBgRed,   text: COLORS.critical },
    amber: { bg: COLORS.alertBgAmber, text: COLORS.high },
    green: { bg: COLORS.alertBgGreen, text: COLORS.success },
    blue:  { bg: COLORS.alertBgBlue,  text: COLORS.info },
    brand: { bg: COLORS.sectionBg,    text: COLORS.brand },
  };

  items.slice(0, 5).forEach((item, i) => {
    const x = ctx.margin + i * (cardW + gap);
    const c = colorMap[item.color || 'brand'];

    // Card bg
    ctx.doc.setFillColor(...c.bg);
    roundRect(ctx.doc, x, ctx.y, cardW, cardH, 4);

    // Value
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(15);
    ctx.doc.setTextColor(...c.text);
    ctx.doc.text(item.value, x + cardW / 2, ctx.y + 18, { align: 'center' });

    // Label
    ctx.doc.setFont('helvetica', 'normal');
    ctx.doc.setFontSize(7.5);
    ctx.doc.setTextColor(...COLORS.textMuted);
    ctx.doc.text(item.label, x + cardW / 2, ctx.y + 30, { align: 'center' });

    // Sublabel
    if (item.sublabel) {
      ctx.doc.setFontSize(7);
      ctx.doc.setTextColor(...c.text);
      ctx.doc.text(item.sublabel, x + cardW / 2, ctx.y + 40, { align: 'center' });
    }
  });

  ctx.y += cardH + 10;
}

/* ─── Badge (inline colored pill) ─── */
export function addBadge(ctx: PDFContext, text: string, color: 'red' | 'amber' | 'green' | 'blue' = 'blue', x?: number) {
  const bgMap: Record<string, RGB> = { red: COLORS.badgeBgRed, amber: COLORS.badgeBgAmber, green: COLORS.badgeBgGreen, blue: COLORS.badgeBgBlue };
  const fgMap: Record<string, RGB> = { red: COLORS.critical, amber: COLORS.high, green: COLORS.success, blue: COLORS.info };

  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  const w = ctx.doc.getTextWidth(text) + 12;
  const bx = x ?? ctx.margin;

  ctx.doc.setFillColor(...bgMap[color]);
  roundRect(ctx.doc, bx, ctx.y - 9, w, 14, 7);
  ctx.doc.setTextColor(...fgMap[color]);
  ctx.doc.text(text, bx + 6, ctx.y);
  return w;
}

/* ─── Alert Box (colored left-border box with icon text) ─── */
export function addAlertBox(ctx: PDFContext, text: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info', title?: string) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth - 20);
  const titleH = title ? 14 : 0;
  const boxH = lines.length * 12 + 16 + titleH;
  checkPage(ctx, boxH + 4);

  const colorMap: Record<string, { border: RGB; bg: RGB; text: RGB }> = {
    info:    { border: COLORS.info,    bg: COLORS.alertBgBlue,  text: COLORS.info },
    warning: { border: COLORS.warning, bg: COLORS.alertBgAmber, text: COLORS.high },
    error:   { border: COLORS.danger,  bg: COLORS.alertBgRed,   text: COLORS.critical },
    success: { border: COLORS.success, bg: COLORS.alertBgGreen, text: COLORS.success },
  };
  const c = colorMap[severity];

  // Background
  ctx.doc.setFillColor(...c.bg);
  ctx.doc.rect(ctx.margin, ctx.y, ctx.maxWidth, boxH, 'F');
  // Left accent
  ctx.doc.setFillColor(...c.border);
  ctx.doc.rect(ctx.margin, ctx.y, 4, boxH, 'F');

  let innerY = ctx.y + 12;
  if (title) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(...c.text);
    ctx.doc.text(title, ctx.margin + 14, innerY);
    innerY += 14;
  }
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(...COLORS.textBody);
  ctx.doc.text(lines, ctx.margin + 14, innerY);

  ctx.y += boxH + 8;
}

/* ─── Card Container (rounded box with optional title) ─── */
export function startCard(ctx: PDFContext, title?: string, needed = 100): number {
  checkPage(ctx, needed);
  const startY = ctx.y;
  if (title) {
    ctx.doc.setFont('helvetica', 'bold');
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(...COLORS.brand);
    ctx.doc.text(title, ctx.margin + 10, ctx.y + 14);
    ctx.y += 24;
  } else {
    ctx.y += 8;
  }
  return startY;
}

export function endCard(ctx: PDFContext, startY: number) {
  const h = ctx.y - startY + 6;
  ctx.doc.setDrawColor(...COLORS.border);
  ctx.doc.setLineWidth(0.5);
  roundRectStroke(ctx.doc, ctx.margin, startY, ctx.maxWidth, h, 4);
  ctx.y += 10;
}

/* ─── Divider ─── */
export function addDivider(ctx: PDFContext) {
  ctx.doc.setDrawColor(...COLORS.divider);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin, ctx.y);
  ctx.y += 8;
}

/* ─── Spacer ─── */
export function addSpacer(ctx: PDFContext, h = 8) {
  ctx.y += h;
}

/* ─── Footer ─── */
export function addFooter(ctx: PDFContext, text: string) {
  addSpacer(ctx, 16);
  ctx.doc.setDrawColor(...COLORS.divider);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin, ctx.y);
  ctx.y += 12;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...COLORS.textMuted);
  ctx.doc.text(text, ctx.margin, ctx.y);
}

/* ─── Two-Column Key-Value Grid ─── */
export function addKeyValueGrid(ctx: PDFContext, pairs: [string, string][]) {
  const colW = ctx.maxWidth / 2;
  for (let i = 0; i < pairs.length; i += 2) {
    // Compute row height based on wrapped text
    const leftH = kvCellHeight(ctx, colW, pairs[i][1]);
    const rightH = (i + 1 < pairs.length) ? kvCellHeight(ctx, colW, pairs[i + 1][1]) : 0;
    const rowH = Math.max(leftH, rightH, 16);
    checkPage(ctx, rowH);
    drawKVCell(ctx, ctx.margin, ctx.y, colW, pairs[i][0], pairs[i][1]);
    if (i + 1 < pairs.length) drawKVCell(ctx, ctx.margin + colW, ctx.y, colW, pairs[i + 1][0], pairs[i + 1][1]);
    ctx.y += rowH;
  }
}

function kvCellHeight(ctx: PDFContext, w: number, value: string): number {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9.5);
  const lines = ctx.doc.splitTextToSize(value, w - 8);
  return 10 + lines.length * 12.5;
}

function drawKVCell(ctx: PDFContext, x: number, y: number, w: number, key: string, value: string) {
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...COLORS.textMuted);
  ctx.doc.text(key, x + 4, y);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9.5);
  ctx.doc.setTextColor(...COLORS.textDark);
  const valLines = ctx.doc.splitTextToSize(value, w - 8);
  ctx.doc.text(valLines, x + 4, y + 10);
}

/* ─── Table ─── */
export interface TableColumn { header: string; width: number; align?: 'left' | 'center' | 'right'; }

export function addTable(ctx: PDFContext, columns: TableColumn[], rows: string[][]) {
  const lineH = 11;
  const rowPadV = 6;
  const headerH = 20;
  checkPage(ctx, headerH + 24);

  // Header
  ctx.doc.setFillColor(...COLORS.sectionBg);
  ctx.doc.rect(ctx.margin, ctx.y, ctx.maxWidth, headerH, 'F');
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(8);
  ctx.doc.setTextColor(...COLORS.textMuted);
  let cx = ctx.margin;
  columns.forEach(col => {
    const ax = col.align === 'right' ? cx + col.width - 6 : col.align === 'center' ? cx + col.width / 2 : cx + 6;
    ctx.doc.text(col.header, ax, ctx.y + 13, { align: col.align || 'left' });
    cx += col.width;
  });
  ctx.y += headerH;

  // Rows
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(9);
  rows.forEach((row, ri) => {
    // Pre-wrap every cell to compute the row's natural height
    const wrapped = columns.map((col, ci) =>
      ctx.doc.splitTextToSize(row[ci] || '', col.width - 12)
    );
    const maxLines = Math.max(1, ...wrapped.map(w => w.length));
    const rowH = maxLines * lineH + rowPadV * 2;
    checkPage(ctx, rowH);
    if (ri % 2 === 1) {
      ctx.doc.setFillColor(250, 250, 252);
      ctx.doc.rect(ctx.margin, ctx.y, ctx.maxWidth, rowH, 'F');
    }
    ctx.doc.setTextColor(...COLORS.textBody);
    let rx = ctx.margin;
    columns.forEach((col, ci) => {
      const ax = col.align === 'right' ? rx + col.width - 6 : col.align === 'center' ? rx + col.width / 2 : rx + 6;
      ctx.doc.text(wrapped[ci], ax, ctx.y + rowPadV + 9, { align: col.align || 'left' });
      rx += col.width;
    });
    ctx.y += rowH;
  });
  // Bottom border
  ctx.doc.setDrawColor(...COLORS.divider);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin, ctx.y);
  ctx.y += 8;
}

/* ─── Helpers ─── */
function roundRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number) {
  doc.roundedRect(x, y, w, h, r, r, 'F');
}

function roundRectStroke(doc: jsPDF, x: number, y: number, w: number, h: number, r: number) {
  doc.roundedRect(x, y, w, h, r, r, 'S');
}

/* ─── Utility: risk color key ─── */
export function riskColor(level: string): 'red' | 'amber' | 'green' | 'blue' {
  const l = level.toLowerCase();
  if (l === 'critical' || l === 'high' || l === 'strong' || l === 'error') return 'red';
  if (l === 'medium' || l === 'moderate' || l === 'warning') return 'amber';
  if (l === 'low' || l === 'success' || l === 'adequate') return 'green';
  return 'blue';
}

export function severityColor(severity: string): 'red' | 'amber' | 'green' | 'blue' {
  const s = severity.toLowerCase();
  if (s === 'critical' || s === 'high') return 'red';
  if (s === 'medium' || s === 'moderate') return 'amber';
  if (s === 'low') return 'green';
  return 'blue';
}
