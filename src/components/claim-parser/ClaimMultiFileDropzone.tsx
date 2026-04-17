// Multi-file dropzone for the Claim Upload Parser.
// Each file is ingested independently (text-layer extraction for PDFs;
// vision fallback for scanned PDFs and images; plain-text for text/DOCX).
// Files are kept SEPARATE — the parent parses each one on its own so the
// AI never confuses two claims.
import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X, Image as ImageIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractTextFromFile } from "@/lib/fileTextExtractor";
import { toast } from "sonner";
import type { ParsedSourceDocument } from "@/lib/parsedClaimTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface IngestedFile {
  /** Stable client id for this ingested file. */
  id: string;
  /** Best plain-text representation (may be empty for pure-image scans). */
  sourceText: string;
  /** First-page (or only) image as data URL when document is scanned/image. */
  imageDataUrl?: string;
  /** Source document descriptor for the evidence drawer. */
  source: ParsedSourceDocument;
  /** Short human label (e.g. "1,234 chars · 3 pages" or "image — vision parser"). */
  meta: string;
}

interface ClaimMultiFileDropzoneProps {
  files: IngestedFile[];
  onAdd: (file: IngestedFile) => void;
  onRemove: (id: string) => void;
  busy?: boolean;
  maxFiles?: number;
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

async function pdfFirstPageToImage(file: File, maxWidth = 1400): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / viewport.width, 2);
  const scaled = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(scaled.width);
  canvas.height = Math.ceil(scaled.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  await page.render({ canvasContext: ctx, viewport: scaled } as any).promise;
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function ingestOne(file: File): Promise<IngestedFile> {
  if (file.size > MAX_SIZE) {
    throw new Error(`${file.name} is too large (max 20MB).`);
  }
  const id = `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isImage = type.startsWith("image/");

  if (isImage) {
    const dataUrl = await fileToDataUrl(file);
    const objectUrl = URL.createObjectURL(file);
    return {
      id,
      sourceText: "",
      imageDataUrl: dataUrl,
      source: { fileName: file.name, kind: "image", objectUrl },
      meta: "image — vision parser",
    };
  }

  if (isPdf) {
    const result = await extractTextFromFile(file);
    const objectUrl = URL.createObjectURL(file);
    if (!result.text || result.text.trim().length < 60) {
      const imageDataUrl = await pdfFirstPageToImage(file);
      return {
        id,
        sourceText: result.text || "",
        imageDataUrl,
        source: { fileName: file.name, kind: "pdf", objectUrl },
        meta: `${result.pages || 1} page(s) · scanned (vision)`,
      };
    }
    return {
      id,
      sourceText: result.text,
      source: { fileName: file.name, kind: "pdf", objectUrl },
      meta: `${result.text.length.toLocaleString()} chars · ${result.pages || 1} page(s)`,
    };
  }

  // DOCX / TXT / etc.
  const result = await extractTextFromFile(file);
  return {
    id,
    sourceText: result.text,
    source: { fileName: file.name, kind: "text", rawText: result.text },
    meta: `${result.text.length.toLocaleString()} chars extracted`,
  };
}

export function ClaimMultiFileDropzone({
  files, onAdd, onRemove, busy, maxFiles = 10,
}: ClaimMultiFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const atCapacity = files.length >= maxFiles;

  const handleFiles = async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (!list.length) return;
    const room = Math.max(0, maxFiles - files.length);
    if (room === 0) {
      toast.error(`Maximum ${maxFiles} files. Remove one to add more.`);
      return;
    }
    const slice = list.slice(0, room);
    if (list.length > room) {
      toast.warning(`Only added the first ${room} file(s) — limit is ${maxFiles}.`);
    }
    for (const f of slice) {
      try {
        setReading(f.name);
        const ingested = await ingestOne(f);
        onAdd(ingested);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to read file";
        toast.error(`Couldn't read ${f.name}`, { description: message });
      } finally {
        setReading(null);
      }
    }
  };

  const onPick = () => inputRef.current?.click();
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!atCapacity && !busy) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={atCapacity ? undefined : onDrop}
        onClick={!atCapacity && !busy && !reading ? onPick : undefined}
        className={cn(
          "relative rounded-lg border-2 border-dashed p-5 text-center transition-colors",
          !atCapacity && !busy && "cursor-pointer border-border hover:border-primary/60 hover:bg-primary/5",
          atCapacity && "opacity-60 cursor-not-allowed",
          dragOver && "border-primary bg-primary/10",
          busy && "opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.rtf,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,image/*"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {reading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Reading {reading}…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop claim PDFs, EOBs, remits, denial letters, or screenshots
            </p>
            <p className="text-xs text-muted-foreground">
              Up to {maxFiles} files · 20MB each · each file is parsed separately
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1"
              disabled={atCapacity || busy}
              onClick={(e) => { e.stopPropagation(); onPick(); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> {files.length === 0 ? "Choose files" : "Add more files"}
            </Button>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""} ready · each will be parsed independently
          </p>
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
              <div className="h-7 w-7 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                {f.source.kind === "image" ? (
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-emerald-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate flex items-center gap-1.5">
                  <span className="truncate">{f.source.fileName}</span>
                  <Badge variant="outline" className="text-[9px] shrink-0">{f.source.kind}</Badge>
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{f.meta}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(f.id)}
                disabled={busy}
                aria-label={`Remove ${f.source.fileName}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
