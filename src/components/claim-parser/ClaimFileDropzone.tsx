// Auto-detecting dropzone for the Claim Upload Parser.
// PDFs: tries text-layer extraction first; if empty (scanned), falls back to image rasterization.
// Images: read directly as base64.
// Text/DOCX: extracted to plain text.
import { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { extractTextFromFile } from "@/lib/fileTextExtractor";
import { toast } from "sonner";
import type { ParsedSourceDocument } from "@/lib/parsedClaimTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface IngestedFile {
  /** Best plain-text representation (may be empty for pure-image scans). */
  sourceText: string;
  /** First-page (or only) image as data URL when document is scanned/image. */
  imageDataUrl?: string;
  /** Source document descriptor for the evidence drawer. */
  source: ParsedSourceDocument;
}

interface ClaimFileDropzoneProps {
  onIngested: (file: IngestedFile) => void;
  busy?: boolean;
}

type State =
  | { kind: "idle" }
  | { kind: "reading"; fileName: string; step: string }
  | { kind: "ready"; fileName: string; meta: string }
  | { kind: "error"; message: string };

const MAX_SIZE = 20 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Render the first page of a PDF to a JPEG data URL for vision fallback. */
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

export function ClaimFileDropzone({ onIngested, busy }: ClaimFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_SIZE) {
      const msg = `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 20MB.`;
      setState({ kind: "error", message: msg });
      toast.error(msg);
      return;
    }

    const name = file.name.toLowerCase();
    const type = file.type.toLowerCase();
    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    const isImage = type.startsWith("image/");

    setState({ kind: "reading", fileName: file.name, step: "Reading file..." });

    try {
      // === Image path ===
      if (isImage) {
        setState({ kind: "reading", fileName: file.name, step: "Reading image..." });
        const dataUrl = await fileToDataUrl(file);
        const objectUrl = URL.createObjectURL(file);
        onIngested({
          sourceText: "",
          imageDataUrl: dataUrl,
          source: { fileName: file.name, kind: "image", objectUrl },
        });
        setState({ kind: "ready", fileName: file.name, meta: "image — sent to vision parser" });
        return;
      }

      // === PDF path ===
      if (isPdf) {
        setState({ kind: "reading", fileName: file.name, step: "Reading PDF text..." });
        const result = await extractTextFromFile(file);
        const objectUrl = URL.createObjectURL(file);

        // If text layer is empty/sparse, fall back to vision on page 1.
        if (!result.text || result.text.trim().length < 60) {
          setState({ kind: "reading", fileName: file.name, step: "Scanned PDF detected — preparing image..." });
          const imageDataUrl = await pdfFirstPageToImage(file);
          onIngested({
            sourceText: result.text || "",
            imageDataUrl,
            source: { fileName: file.name, kind: "pdf", objectUrl },
          });
          setState({ kind: "ready", fileName: file.name, meta: `${result.pages || 1} page(s) — using vision (scanned)` });
          return;
        }

        onIngested({
          sourceText: result.text,
          source: { fileName: file.name, kind: "pdf", objectUrl },
        });
        setState({
          kind: "ready",
          fileName: file.name,
          meta: `${result.text.length.toLocaleString()} chars · ${result.pages || 1} page(s)`,
        });
        return;
      }

      // === DOCX / TXT / etc. path ===
      setState({ kind: "reading", fileName: file.name, step: "Reading text..." });
      const result = await extractTextFromFile(file);
      onIngested({
        sourceText: result.text,
        source: { fileName: file.name, kind: "text", rawText: result.text },
      });
      setState({
        kind: "ready",
        fileName: file.name,
        meta: `${result.text.length.toLocaleString()} chars extracted`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to read file";
      setState({ kind: "error", message });
      toast.error("Could not read file", { description: message });
    }
  };

  const onPick = () => inputRef.current?.click();
  const reset = () => setState({ kind: "idle" });
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const interactive = state.kind === "idle" || state.kind === "error";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={interactive && !busy ? onPick : undefined}
      className={cn(
        "relative rounded-lg border-2 border-dashed p-5 text-center transition-colors",
        interactive && !busy && "cursor-pointer border-border hover:border-primary/60 hover:bg-primary/5",
        state.kind === "error" && "border-destructive/50 bg-destructive/5",
        state.kind === "reading" && "border-primary/60 bg-primary/5",
        state.kind === "ready" && "border-emerald-500/50 bg-emerald-500/5",
        dragOver && "border-primary bg-primary/10",
        busy && "opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.tsv,.rtf,.json,.xml,.hl7,.png,.jpg,.jpeg,.webp,.tif,.tiff,.dcm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/dicom,text/*,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {state.kind === "idle" && (
        <div className="flex flex-col items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Drop a claim PDF, EOB, remit, denial letter, or screenshot
          </p>
          <p className="text-xs text-muted-foreground">PDF, image, Word, or text · up to 20MB</p>
          <Button type="button" variant="outline" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); onPick(); }}>
            Choose file
          </Button>
        </div>
      )}

      {state.kind === "reading" && (
        <div className="flex flex-col items-center gap-2 py-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">{state.step}</p>
          <p className="text-xs text-muted-foreground">{state.fileName}</p>
        </div>
      )}

      {state.kind === "ready" && (
        <div className="flex items-center gap-3 text-left">
          <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {state.fileName}
            </p>
            <p className="text-xs text-muted-foreground">{state.meta}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={(e) => { e.stopPropagation(); reset(); }} aria-label="Remove">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-2">
          <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-destructive" />
          </div>
          <p className="text-sm font-medium text-foreground">Couldn't read that file</p>
          <p className="text-xs text-muted-foreground max-w-md">{state.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); reset(); onPick(); }}>
            Try another file
          </Button>
        </div>
      )}
    </div>
  );
}
