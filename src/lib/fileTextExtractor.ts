/**
 * Browser-side text extraction from uploaded files.
 * Supports: PDF (with text layer), DOCX, plain text formats.
 * Returns extracted plain text or throws a friendly error.
 */
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Configure pdf.js worker (Vite-friendly: use the bundled worker)
// We use the legacy build for max compatibility.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export type ExtractionResult = {
  text: string;
  pages?: number;
  warning?: string;
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function extractTextFromFile(file: File): Promise<ExtractionResult> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max is 20MB.`);
  }

  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  // PDF
  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    return await extractPdf(file);
  }

  // DOCX
  if (
    name.endsWith('.docx') ||
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return await extractDocx(file);
  }

  // Old .doc — not supported in browser
  if (name.endsWith('.doc') || type === 'application/msword') {
    throw new Error('Old .doc format is not supported. Please save as .docx or PDF and try again.');
  }

  // Plain text formats
  if (
    type.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.md') ||
    name.endsWith('.csv') ||
    name.endsWith('.rtf')
  ) {
    const text = await file.text();
    return { text: cleanText(text) };
  }

  throw new Error(
    `Unsupported file type: ${file.type || name.split('.').pop()}. Please upload a PDF, Word document, or text file.`
  );
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string }>;
    const pageText = items.map(it => it.str).join(' ');
    pages.push(pageText);
  }

  const text = cleanText(pages.join('\n\n'));

  if (text.trim().length < 30) {
    return {
      text: '',
      pages: pdf.numPages,
      warning:
        'This PDF appears to be a scanned image with no readable text layer. Try copy-pasting the note instead, or save the document as a text-based PDF.',
    };
  }

  return { text, pages: pdf.numPages };
}

async function extractDocx(file: File): Promise<ExtractionResult> {
  const buf = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return { text: cleanText(result.value) };
}

function cleanText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
