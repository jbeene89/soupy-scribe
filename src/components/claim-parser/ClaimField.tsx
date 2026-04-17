// Reusable editable claim field. Click anywhere → opens evidence drawer.
// Pencil → toggles edit mode. Saves on Enter or blur.
import { useState } from "react";
import { Pencil, Check, X, Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ParsedField, ParsedFieldArray } from "@/lib/parsedClaimTypes";

type AnyField = ParsedField<any> | ParsedFieldArray<any> | undefined;

export interface ClaimFieldProps {
  label: string;
  field: AnyField;
  /** Render type. "text" / "number" / "currency" / "date" / "array" */
  kind?: "text" | "number" | "currency" | "date" | "array";
  onChange: (value: any) => void;
  onShowEvidence: () => void;
}

const LOW_CONF = 0.8;

function formatDisplay(field: AnyField, kind: string): string {
  if (!field) return "";
  if (kind === "array") {
    const arr = (field as ParsedFieldArray<any>).value || [];
    return arr.join(", ");
  }
  const v = (field as ParsedField<any>).value;
  if (v === null || v === undefined || v === "") return "";
  if (kind === "currency" && typeof v === "number") {
    return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  return String(v);
}

export function ClaimField({ label, field, kind = "text", onChange, onShowEvidence }: ClaimFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(formatDisplay(field, kind));

  const display = formatDisplay(field, kind);
  const empty = display === "";
  const conf = field?.confidence ?? null;
  const lowConf = conf !== null && conf < LOW_CONF;
  const hasEvidence = !!field?.evidence_snippet || !!field?.source_location;

  const startEdit = () => {
    setDraft(kind === "array"
      ? ((field as ParsedFieldArray<any>)?.value || []).join(", ")
      : ((field as ParsedField<any>)?.value ?? "") + "");
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    if (kind === "array") {
      onChange(draft.split(",").map((s) => s.trim()).filter(Boolean));
    } else if (kind === "number" || kind === "currency") {
      const n = parseFloat(draft.replace(/[$,]/g, ""));
      onChange(isNaN(n) ? null : n);
    } else {
      onChange(draft.trim() === "" ? null : draft.trim());
    }
  };

  const cancel = () => { setEditing(false); setDraft(display); };

  return (
    <div className={cn(
      "rounded-md border px-3 py-2 group transition-colors",
      empty ? "border-dashed bg-muted/20" : "bg-card",
      lowConf && "border-amber-500/50 bg-amber-500/5",
    )}>
      <div className="flex items-center justify-between gap-2 mb-0.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          {lowConf && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
              Review
            </Badge>
          )}
          {hasEvidence && !editing && (
            <Button
              type="button" variant="ghost" size="sm"
              className="h-5 w-5 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={onShowEvidence}
              aria-label="Show evidence"
            >
              <Eye className="h-3 w-3" />
            </Button>
          )}
          {!editing ? (
            <Button
              type="button" variant="ghost" size="sm"
              className="h-5 w-5 p-0 text-muted-foreground opacity-0 group-hover:opacity-100"
              onClick={startEdit}
              aria-label="Edit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          ) : (
            <>
              <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-emerald-600" onClick={commit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground" onClick={cancel}>
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          className="h-7 text-xs font-mono"
          placeholder={kind === "array" ? "comma-separated values" : "—"}
        />
      ) : (
        <button
          type="button"
          onClick={hasEvidence ? onShowEvidence : undefined}
          className={cn(
            "block w-full text-left text-sm font-medium font-mono break-words",
            empty ? "text-muted-foreground italic font-normal" : "text-foreground",
            hasEvidence && "hover:underline decoration-dotted underline-offset-2 cursor-pointer",
          )}
          title={hasEvidence ? "Click to see source" : undefined}
        >
          {empty ? "Not detected" : display}
        </button>
      )}
    </div>
  );
}
