/**
 * Browser-side file text extraction for PDFs, Word docs, plain text, and CSV.
 *
 * Used by Behavioral Health upload + add-document flows so users can attach
 * source files (session notes, superbills, treatment plans) instead of pasting raw text.
 *
 * No server roundtrip — everything runs in the browser. PDFs use pdfjs-dist
 * (already in the bundle for PDF export). DOCX uses mammoth (browser build).
 *
 * Out of scope for v1: scanned-image OCR. Users with scanned PDFs see a
 * helpful prompt to paste text manually or use a text-based PDF.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

// Wire pdfjs worker once. Vite's ?url import gives us a hashed asset URL.
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.rtf'] as const;
export const SUPPORTED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/rtf',
  'text/rtf',
];

export const ACCEPT_ATTRIBUTE = SUPPORTED_EXTENSIONS.join(',') + ',' + SUPPORTED_MIME.join(',');

export interface ExtractResult {
  text: string;
  fileName: string;
  fileType: string;
  pageCount?: number;
  warning?: string;
}

/**
 * Extract plain text from a File. Throws on unsupported types or unparseable files.
 */
export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  const name = file.name.toLowerCase();
  const type = file.type;

  // Plain text family
  if (
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.rtf') ||
    type.startsWith('text/') ||
    type === 'application/rtf'
  ) {
    const text = await file.text();
    // RTF has control codes — strip the most obvious ones for readability.
    const cleaned = name.endsWith('.rtf') ? stripRtfBasic(text) : text;
    return { text: cleaned.trim(), fileName: file.name, fileType: type || 'text/plain' };
  }

  // PDF
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return await extractFromPdf(file);
  }

  // DOCX (modern Word)
  if (
    name.endsWith('.docx') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractFromDocx(file);
  }

  // Legacy .doc isn't supported by mammoth — give clear guidance.
  if (name.endsWith('.doc') || type === 'application/msword') {
    throw new Error(
      'Old-format .doc files aren\'t supported. Please save as .docx or PDF and try again.'
    );
  }

  throw new Error(
    `Unsupported file type. Please upload a PDF, Word document (.docx), or text file.`
  );
}

async function extractFromPdf(file: File): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      // pdfjs items are TextItem | TextMarkedContent — only TextItem has .str
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    if (pageText.trim()) parts.push(pageText.trim());
  }

  const text = parts.join('\n\n').trim();

  // If the PDF has pages but extracted basically nothing, it's almost certainly scanned/image-based.
  if (pdf.numPages > 0 && text.length < 30) {
    return {
      text: '',
      fileName: file.name,
      fileType: 'application/pdf',
      pageCount: pdf.numPages,
      warning:
        'This PDF appears to be scanned images (no readable text layer). Please paste the text manually, or save the source document as a text-based PDF.',
    };
  }

  return {
    text,
    fileName: file.name,
    fileType: 'application/pdf',
    pageCount: pdf.numPages,
  };
}

async function extractFromDocx(file: File): Promise<ExtractResult> {
  // Lazy-import mammoth so it only loads when the user actually uploads a DOCX.
  const mammoth = await import('mammoth/mammoth.browser');
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return {
    text: (result.value || '').trim(),
    fileName: file.name,
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    warning: result.messages?.length ? `${result.messages.length} formatting note(s) ignored.` : undefined,
  };
}

/**
 * Quick-and-dirty RTF cleanup — strips control words and braces.
 * Not perfect, but readable for clinical notes.
 */
function stripRtfBasic(rtf: string): string {
  return rtf
    .replace(/\\[a-z]+-?\d* ?/gi, '') // control words like \par, \fs24
    .replace(/[{}]/g, '')
    .replace(/\\\*/g, '')
    .replace(/\\'[0-9a-f]{2}/gi, '') // hex chars
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
