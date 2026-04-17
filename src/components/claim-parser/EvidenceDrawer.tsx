// Evidence Drawer: shows the AI-quoted snippet, source location, and (for PDFs)
// renders the actual page with a yellow highlight over the matching text spans.
import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedSourceDocument } from "@/lib/parsedClaimTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface EvidenceDrawerProps {
  open: boolean;
  onClose: () => void;
  source: ParsedSourceDocument | null;
  fieldLabel: string;
  fieldValue: string;
  evidenceSnippet?: string | null;
  sourceLocation?: string | null;
  confidence?: number | null;
}

function parsePageHint(loc?: string | null): number {
  if (!loc) return 1;
  const m = loc.match(/page\s*(\d+)/i);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

export function EvidenceDrawer({
  open, onClose, source, fieldLabel, fieldValue,
  evidenceSnippet, sourceLocation, confidence,
}: EvidenceDrawerProps) {
  const initialPage = parsePageHint(sourceLocation);
  const [page, setPage] = useState(initialPage);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setPage(parsePageHint(sourceLocation)); }, [open, sourceLocation]);

  // Render PDF page + text-layer highlights
  useEffect(() => {
    if (!open || !source || source.kind !== "pdf" || !source.objectUrl) return;
    let cancelled = false;
    let pdfDoc: any = null;

    (async () => {
      try {
        setLoading(true); setError(null);
        const loadingTask = pdfjsLib.getDocument(source.objectUrl!);
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        setNumPages(pdfDoc.numPages);
        const safePage = Math.min(Math.max(1, page), pdfDoc.numPages);
        const pdfPage = await pdfDoc.getPage(safePage);
        const containerWidth = containerRef.current?.clientWidth || 700;
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / viewport.width, 1.5);
        const scaled = pdfPage.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(scaled.width);
        canvas.height = Math.ceil(scaled.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
        if (cancelled) return;

        // Highlight overlay using text content positions
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.innerHTML = "";
          overlay.style.width = `${canvas.width}px`;
          overlay.style.height = `${canvas.height}px`;
          if (evidenceSnippet) {
            const textContent = await pdfPage.getTextContent();
            const items = textContent.items as Array<any>;
            const target = evidenceSnippet.toLowerCase().replace(/\s+/g, " ").trim();
            // Build highlight rects for any text item whose string is contained in the snippet,
            // or that contains a word from the snippet (3+ chars). We OR these together.
            const tokens = target.split(/\W+/).filter((t) => t.length >= 4);
            for (const it of items) {
              const str: string = (it.str || "").toLowerCase();
              if (!str) continue;
              const matchesPhrase = target.includes(str) && str.length >= 3;
              const matchesToken = tokens.some((t) => str.includes(t));
              if (!matchesPhrase && !matchesToken) continue;

              // pdf.js gives us a 6-element transform [a, b, c, d, e, f]
              const tx = pdfjsLib.Util.transform(scaled.transform, it.transform);
              const fontHeight = Math.hypot(tx[2], tx[3]);
              const x = tx[4];
              const y = tx[5] - fontHeight;
              const w = (it.width || 10) * scale;
              const h = fontHeight * 1.1;

              const div = document.createElement("div");
              div.style.position = "absolute";
              div.style.left = `${x}px`;
              div.style.top = `${y}px`;
              div.style.width = `${w}px`;
              div.style.height = `${h}px`;
              div.style.background = "rgba(250, 204, 21, 0.45)";
              div.style.borderRadius = "2px";
              div.style.pointerEvents = "none";
              overlay.appendChild(div);
            }
          }
        }

        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error("PDF render error", e);
          setError(e instanceof Error ? e.message : "Could not render PDF");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; if (pdfDoc) pdfDoc.destroy?.(); };
  }, [open, source, page, evidenceSnippet]);

  if (!source) return null;

  const pct = typeof confidence === "number" ? Math.round(confidence * 100) : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>Evidence — {fieldLabel}</span>
            {pct !== null && (
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-[10px]",
                  pct >= 80 ? "border-emerald-500/40 text-emerald-600" :
                  pct >= 60 ? "border-amber-500/40 text-amber-600" :
                  "border-destructive/40 text-destructive",
                )}
              >
                {pct}% confidence
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Extracted value</p>
            <p className="text-sm font-medium font-mono break-words">{fieldValue || "—"}</p>
          </div>

          {evidenceSnippet ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Source quote</p>
              <p className="text-sm italic">“{evidenceSnippet}”</p>
              {sourceLocation && (
                <p className="text-[11px] text-muted-foreground mt-1">📄 {sourceLocation}</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              No source quote was returned for this field.
            </div>
          )}

          {/* Source render */}
          {source.kind === "pdf" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Button variant="outline" size="sm" className="h-7 px-2"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-muted-foreground">Page {page}{numPages > 0 ? ` / ${numPages}` : ""}</span>
                <Button variant="outline" size="sm" className="h-7 px-2"
                  disabled={(numPages > 0 && page >= numPages) || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
              <div ref={containerRef} className="relative rounded-md border overflow-auto bg-muted/20 max-h-[60vh]">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {error && (
                  <div className="p-4 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" /> {error}
                  </div>
                )}
                <div className="relative inline-block">
                  <canvas ref={canvasRef} />
                  <div ref={overlayRef} className="absolute inset-0 pointer-events-none" />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Yellow boxes mark text the AI cited as evidence. Highlighting is approximate.
              </p>
            </div>
          )}

          {source.kind === "image" && source.objectUrl && (
            <div className="space-y-2">
              <div className="rounded-md border overflow-auto bg-muted/20 max-h-[60vh]">
                <img src={source.objectUrl} alt={source.fileName} className="block max-w-full" />
              </div>
              <p className="text-[10px] text-muted-foreground">
                For images, the snippet quote above is your evidence. The image itself is shown for reference.
              </p>
            </div>
          )}

          {source.kind === "text" && source.rawText && (
            <div className="rounded-md border bg-muted/20 max-h-[40vh] overflow-auto">
              <pre className="p-3 text-[11px] leading-relaxed whitespace-pre-wrap font-mono">
                {highlightText(source.rawText, evidenceSnippet)}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Render text with the snippet wrapped in a <mark>. Returns a React fragment as string-children safe nodes. */
function highlightText(text: string, snippet?: string | null) {
  if (!snippet) return text;
  const idx = text.toLowerCase().indexOf(snippet.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + snippet.length);
  const after = text.slice(idx + snippet.length);
  return (
    <>
      {before}
      <mark className="bg-amber-300/60 rounded-sm px-0.5">{match}</mark>
      {after}
    </>
  );
}
