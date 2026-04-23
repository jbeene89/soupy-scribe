/**
 * Browser-side text extraction from uploaded files.
 * Supports: PDF (with text layer), DOCX, plain text formats.
 * Returns extracted plain text or throws a friendly error.
 */
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

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
    name.endsWith('.tsv') ||
    name.endsWith('.json') ||
    name.endsWith('.xml') ||
    name.endsWith('.hl7') ||
    name.endsWith('.rtf')
  ) {
    const text = await file.text();
    return { text: cleanText(text) };
  }

  // XLSX / XLS — convert each sheet to CSV-ish text
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  ) {
    return await extractXlsx(file);
  }

  // TIFF / DICOM / other clinical image formats — accepted as attachments,
  // but no text layer to extract. Caller should treat the file as image-only.
  if (
    name.endsWith('.tif') ||
    name.endsWith('.tiff') ||
    name.endsWith('.dcm') ||
    name.endsWith('.dicom') ||
    type === 'image/tiff' ||
    type === 'application/dicom'
  ) {
    return {
      text: '',
      warning:
        'This is a clinical image file (TIFF/DICOM). It will be attached to the case as an image — no text was extracted. The imaging audit module (coming soon) will read these directly.',
    };
  }

  throw new Error(
    `Unsupported file type: ${file.type || name.split('.').pop()}. Supported formats: PDF, Word (.docx), Excel (.xlsx), text (.txt/.csv/.tsv/.md/.rtf/.json/.xml/.hl7), and clinical images (.tiff/.dcm).`
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

async function extractXlsx(file: File): Promise<ExtractionResult> {
  const buf = await file.arrayBuffer();
  const workbook = XLSX.read(buf, { type: 'array' });
  const chunks: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim().length === 0) continue;
    chunks.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }
  const text = cleanText(chunks.join('\n\n'));
  if (text.trim().length < 5) {
    return {
      text: '',
      warning: 'This spreadsheet appears to be empty or contains only formatting.',
    };
  }
  return { text };
}

function cleanText(s: string): string {
  return s
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
