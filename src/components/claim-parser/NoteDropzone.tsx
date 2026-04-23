// Single-file dropzone for attaching a clinical note to a parsed claim.
// Reuses the same ingest pipeline as the multi-file dropzone but is simpler:
// one note per claim. Supports PDF (text + scanned), DOCX, TXT, and images.
import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { FileUp, FileText, Image as ImageIcon, Loader2, X, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractTextFromFile } from "@/lib/fileTextExtractor";
import { toast } from "sonner";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface IngestedNote {
  fileName: string;
  kind: "pdf" | "image" | "text";
  sourceText?: string;
  imageDataUrl?: string;
  /** All rendered pages when the note PDF is scanned. */
  imageDataUrls?: string[];
  meta: string;
}

const MAX_NOTE_VISION_PAGES = 5;

interface NoteDropzoneProps {
  note: IngestedNote | null;
  onSet: (note: IngestedNote) => void;
  onClear: () => void;
  busy?: boolean;
}

const MAX_SIZE = 20 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Render up to maxPages of a scanned note PDF for the vision model. */
async function pdfPagesToImages(file: File, maxPages = MAX_NOTE_VISION_PAGES, maxWidth = 1400): Promise<{ images: string[]; totalPages: number }> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const limit = Math.min(totalPages, maxPages);
  const out: string[] = [];
  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxWidth / viewport.width, 2);
    const scaled = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(scaled.width);
    canvas.height = Math.ceil(scaled.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not available");
    await page.render({ canvasContext: ctx, viewport: scaled } as any).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.82));
  }
  return { images: out, totalPages };
}

async function ingest(file: File): Promise<IngestedNote> {
  if (file.size > MAX_SIZE) throw new Error(`${file.name} is too large (max 20MB).`);
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = type.startsWith("image/");

  if (isImage) {
    const dataUrl = await fileToDataUrl(file);
    return { fileName: file.name, kind: "image", imageDataUrl: dataUrl, meta: "image — vision parser" };
  }
  if (isPdf) {
    const result = await extractTextFromFile(file);
    if (!result.text || result.text.trim().length < 60) {
      const { images, totalPages } = await pdfPagesToImages(file);
      const truncated = totalPages > images.length;
      return {
        fileName: file.name,
        kind: "pdf",
        sourceText: result.text || "",
        imageDataUrl: images[0],
        imageDataUrls: images,
        meta: `${totalPages} page(s) · scanned (vision)${truncated ? ` · first ${images.length} read` : ""}`,
      };
    }
    return {
      fileName: file.name,
      kind: "pdf",
      sourceText: result.text,
      meta: `${result.text.length.toLocaleString()} chars · ${result.pages || 1} page(s)`,
    };
  }
  // DOCX / TXT
  const result = await extractTextFromFile(file);
  return { fileName: file.name, kind: "text", sourceText: result.text, meta: `${result.text.length.toLocaleString()} chars extracted` };
}

export function NoteDropzone({ note, onSet, onClear, busy }: NoteDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    try {
      setReading(true);
      const ingested = await ingest(file);
      onSet(ingested);
      toast.success(`Note attached: ${file.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read note";
      toast.error(`Couldn't read ${file.name}`, { description: message });
    } finally {
      setReading(false);
    }
  };

  if (note) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-violet-500/5 border-violet-500/30 px-3 py-2">
        <div className="h-7 w-7 rounded-md bg-violet-500/15 flex items-center justify-center shrink-0">
          {note.kind === "image" ? (
            <ImageIcon className="h-3.5 w-3.5 text-violet-600" />
          ) : (
            <NotebookPen className="h-3.5 w-3.5 text-violet-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
            <span className="truncate">{note.fileName}</span>
            <Badge variant="outline" className="text-[9px] shrink-0 border-violet-500/40 text-violet-600">clinical note</Badge>
          </p>
          <p className="text-[10px] text-muted-foreground truncate">{note.meta}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onClear}
          disabled={busy}
          aria-label="Remove clinical note"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!busy) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !busy && !reading && inputRef.current?.click()}
      className={cn(
        "rounded-md border-2 border-dashed p-3 text-center transition-colors cursor-pointer",
        "border-violet-500/30 bg-violet-500/5 hover:border-violet-500/60",
        dragOver && "border-violet-500 bg-violet-500/10",
        (busy || reading) && "opacity-60 cursor-not-allowed",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.tsv,.rtf,.json,.xml,.hl7,.png,.jpg,.jpeg,.webp,.tif,.tiff,.dcm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/dicom,text/*,image/*"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {reading ? (
        <div className="flex items-center justify-center gap-2 py-1">
          <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
          <p className="text-xs font-medium text-foreground">Reading note…</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <FileUp className="h-4 w-4 text-violet-600" />
          <div className="text-left">
            <p className="text-xs font-medium text-foreground">Attach the clinical note for this claim</p>
            <p className="text-[10px] text-muted-foreground">PDF, DOCX, TXT, or screenshot · 20MB max</p>
          </div>
        </div>
      )}
    </div>
  );
}
