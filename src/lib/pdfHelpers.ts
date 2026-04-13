import jsPDF from 'jspdf';

export interface PDFContext {
  doc: jsPDF;
  y: number;
  margin: number;
  maxWidth: number;
  pageHeight: number;
  pageWidth: number;
}

export function createPDFContext(orientation: 'portrait' | 'landscape' = 'portrait'): PDFContext {
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  return { doc, y: 50, margin, maxWidth: pageWidth - margin * 2, pageHeight, pageWidth };
}

export function checkPage(ctx: PDFContext, needed = 60) {
  if (ctx.y + needed > ctx.pageHeight - 50) {
    ctx.doc.addPage();
    ctx.y = 50;
  }
}

export function addTitle(ctx: PDFContext, text: string, size = 16) {
  checkPage(ctx, size + 20);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(30, 58, 95);
  ctx.doc.text(text, ctx.margin, ctx.y);
  ctx.y += size + 8;
}

export function addSubtitle(ctx: PDFContext, text: string, size = 12) {
  checkPage(ctx, size + 16);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(55, 80, 120);
  ctx.doc.text(text, ctx.margin, ctx.y);
  ctx.y += size + 6;
}

export function addBody(ctx: PDFContext, text: string, size = 10) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(40, 40, 40);
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth);
  checkPage(ctx, lines.length * (size + 3) + 8);
  ctx.doc.text(lines, ctx.margin, ctx.y);
  ctx.y += lines.length * (size + 3) + 4;
}

export function addBullet(ctx: PDFContext, text: string, size = 10) {
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(40, 40, 40);
  const lines = ctx.doc.splitTextToSize(text, ctx.maxWidth - 14);
  checkPage(ctx, lines.length * (size + 3) + 4);
  ctx.doc.text('•', ctx.margin, ctx.y);
  ctx.doc.text(lines, ctx.margin + 14, ctx.y);
  ctx.y += lines.length * (size + 3) + 2;
}

export function addKeyValue(ctx: PDFContext, key: string, value: string, size = 10) {
  checkPage(ctx, size + 8);
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(80, 80, 80);
  ctx.doc.text(`${key}:`, ctx.margin, ctx.y);
  const keyWidth = ctx.doc.getTextWidth(`${key}: `);
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setTextColor(40, 40, 40);
  ctx.doc.text(value, ctx.margin + keyWidth, ctx.y);
  ctx.y += size + 5;
}

export function addSpacer(ctx: PDFContext, h = 10) {
  ctx.y += h;
}

export function addFooter(ctx: PDFContext, text: string) {
  addSpacer(ctx, 20);
  ctx.doc.setDrawColor(180, 180, 180);
  ctx.doc.line(ctx.margin, ctx.y, ctx.pageWidth - ctx.margin, ctx.y);
  ctx.y += 16;
  ctx.doc.setFont('helvetica', 'italic');
  ctx.doc.setFontSize(9);
  ctx.doc.setTextColor(120, 120, 120);
  ctx.doc.text(text, ctx.margin, ctx.y);
}
