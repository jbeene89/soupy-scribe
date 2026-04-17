// Per-code inline chip editor for CPT / HCPCS / Modifier / ICD-10 / Dx pointers.
// Each code is its own chip with: click-to-edit, delete, and "+ Add code".
// Built to let users fix a single parser mis-pull in 2 seconds without re-uploading.
import { useState, useRef, useEffect } from "react";
import { Check, X, Plus, Pencil, Eye, AlertTriangle, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ParsedFieldArray } from "@/lib/parsedClaimTypes";

export interface CodeSuggestion {
  /** The code value to insert (e.g. "99214"). */
  code: string;
  /** Short human label shown next to the code (e.g. "Office visit, established, level 4"). */
  label?: string;
}

interface Props {
  label: string;
  /** Short hint shown next to the label, e.g. "Procedures billed". */
  hint?: string;
  field: ParsedFieldArray<string> | undefined;
  /** Called whenever the array changes (add/edit/remove). */
  onChange: (codes: string[]) => void;
  onShowEvidence: () => void;
  /** Color tone for chips. */
  tone?: "primary" | "accent" | "muted" | "warning";
  /** Optional placeholder for the add-input. */
  placeholder?: string;
  /** Force-uppercase entered codes (CPT/ICD style). */
  uppercase?: boolean;
  /** Optional list of valid codes to suggest as the user types. */
  suggestions?: CodeSuggestion[];
}

const TONE_STYLES: Record<string, string> = {
  primary: "border-primary/40 bg-primary/5 text-foreground hover:border-primary",
  accent: "border-accent/50 bg-accent/10 text-foreground hover:border-accent",
  muted: "border-border bg-muted/40 text-foreground hover:border-muted-foreground/40",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:border-amber-500",
};

/** Compress noisy source_location strings into a short, human chip. */
function formatSourceLocation(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // Hide our deterministic-sweep marker — it's not a real region.
  if (/code sweep/i.test(s)) return null;
  // Keep it short — chips shouldn't wrap.
  return s.length > 48 ? s.slice(0, 45) + "…" : s;
}

export function CodeChipsEditor({
  label, hint, field, onChange, onShowEvidence,
  tone = "primary", placeholder = "Add code…", uppercase = true,
}: Props) {
  const codes = field?.value ?? [];
  const lowConf = (field?.confidence ?? 1) < 0.8;
  const hasEvidence = !!field?.evidence_snippet || !!field?.source_location;
  const sourceLabel = formatSourceLocation(field?.source_location);

  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const normalize = (s: string) => (uppercase ? s.toUpperCase() : s).trim();

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setDraft(codes[idx] ?? "");
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const cleaned = normalize(draft);
    const next = [...codes];
    if (cleaned === "") {
      next.splice(editingIdx, 1);
    } else {
      next[editingIdx] = cleaned;
    }
    onChange(next);
    setEditingIdx(null);
    setDraft("");
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft("");
  };

  const removeCode = (idx: number) => {
    const next = codes.filter((_, i) => i !== idx);
    onChange(next);
  };

  const commitAdd = () => {
    const cleaned = normalize(addDraft);
    if (cleaned !== "" && !codes.includes(cleaned)) {
      onChange([...codes, cleaned]);
    }
    setAddDraft("");
    setAdding(false);
  };

  const cancelAdd = () => {
    setAddDraft("");
    setAdding(false);
  };

  const toneClass = TONE_STYLES[tone];
  const empty = codes.length === 0;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 transition-colors",
        empty ? "border-dashed bg-muted/20" : "bg-card",
        lowConf && "border-amber-500/50 bg-amber-500/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          {hint && <span className="text-[10px] text-muted-foreground/70 italic truncate">· {hint}</span>}
        </div>
        <div className="flex items-center gap-1">
          {sourceLabel && !empty && (
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1.5 gap-0.5 font-normal text-muted-foreground border-border/60 max-w-[180px]"
              title={`Parser found these in: ${field?.source_location}`}
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{sourceLabel}</span>
            </Badge>
          )}
          {lowConf && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              Review
            </Badge>
          )}
          {hasEvidence && (
            <Button
              type="button" variant="ghost" size="sm"
              className="h-5 w-5 p-0 text-muted-foreground"
              onClick={onShowEvidence}
              title="Show source"
              aria-label="Show source"
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {codes.map((code, idx) => {
          const isEditing = editingIdx === idx;
          if (isEditing) {
            return (
              <div key={idx} className="inline-flex items-center gap-0.5 rounded-md border border-primary bg-background px-1 py-0.5">
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                  }}
                  className="h-5 w-20 px-1 text-xs font-mono border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="code"
                />
                <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-emerald-600" onMouseDown={(e) => e.preventDefault()} onClick={commitEdit}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground" onMouseDown={(e) => e.preventDefault()} onClick={cancelEdit}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          }
          return (
            <span
              key={idx}
              className={cn(
                "group inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-mono transition-colors",
                toneClass,
              )}
            >
              <button
                type="button"
                onClick={() => startEdit(idx)}
                className="inline-flex items-center gap-1 hover:underline decoration-dotted underline-offset-2"
                title="Wrong code? Click to fix it."
              >
                {code}
                <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-70" />
              </button>
              <button
                type="button"
                onClick={() => removeCode(idx)}
                className="ml-0.5 text-muted-foreground hover:text-destructive"
                title="Remove this code"
                aria-label={`Remove ${code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}

        {adding ? (
          <div className="inline-flex items-center gap-0.5 rounded-md border border-primary bg-background px-1 py-0.5">
            <Input
              ref={addInputRef}
              value={addDraft}
              onChange={(e) => setAddDraft(e.target.value)}
              onBlur={commitAdd}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitAdd(); }
                if (e.key === "Escape") { e.preventDefault(); cancelAdd(); }
              }}
              className="h-5 w-20 px-1 text-xs font-mono border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder={placeholder}
            />
            <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-emerald-600" onMouseDown={(e) => e.preventDefault()} onClick={commitAdd}>
              <Check className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground" onMouseDown={(e) => e.preventDefault()} onClick={cancelAdd}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            {empty ? "Add code" : "Add"}
          </button>
        )}

        {empty && !adding && (
          <span className="text-[11px] text-muted-foreground italic ml-1">Not detected — click "Add code" if the parser missed it.</span>
        )}
      </div>
    </div>
  );
}
