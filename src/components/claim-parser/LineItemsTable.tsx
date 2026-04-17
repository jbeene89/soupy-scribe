// Editable line-item table for claim_line_items.
import { useState } from "react";
import { Trash2, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ParsedLineItem } from "@/lib/parsedClaimTypes";

interface Props {
  items: ParsedLineItem[];
  onChange: (items: ParsedLineItem[]) => void;
  onShowEvidence: (item: ParsedLineItem, idx: number) => void;
}

const COLS: Array<{ key: keyof ParsedLineItem; label: string; type?: "number" | "currency" }> = [
  { key: "service_date", label: "DOS" },
  { key: "procedure_code", label: "CPT" },
  { key: "modifier", label: "Mod" },
  { key: "units", label: "Units", type: "number" },
  { key: "charge_amount", label: "Charge", type: "currency" },
  { key: "allowed_amount", label: "Allowed", type: "currency" },
  { key: "paid_amount", label: "Paid", type: "currency" },
  { key: "denied_amount", label: "Denied", type: "currency" },
  { key: "diagnosis_pointer", label: "Dx Ptr" },
  { key: "denial_reason", label: "Denial Reason" },
];

function fmt(v: any, type?: string) {
  if (v === null || v === undefined || v === "") return "";
  if (type === "currency" && typeof v === "number") {
    return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  return String(v);
}

export function LineItemsTable({ items, onChange, onShowEvidence }: Props) {
  const [editing, setEditing] = useState<{ row: number; col: string } | null>(null);
  const [draft, setDraft] = useState("");

  const updateCell = (rowIdx: number, key: string, raw: string, type?: string) => {
    const next = [...items];
    let v: any = raw.trim();
    if (v === "") v = null;
    else if (type === "number" || type === "currency") {
      const n = parseFloat(v.replace(/[$,]/g, ""));
      v = isNaN(n) ? null : n;
    }
    next[rowIdx] = { ...next[rowIdx], [key]: v };
    onChange(next);
  };

  const removeRow = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(next);
  };

  const addRow = () => {
    onChange([...items, { service_date: null, procedure_code: null, modifier: null, units: null, charge_amount: null, allowed_amount: null, paid_amount: null, denied_amount: null, diagnosis_pointer: null, denial_reason: null }]);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
        No line items detected.
        <div className="mt-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3 w-3 mr-1" /> Add line item
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {COLS.map((c) => (
                <th key={String(c.key)} className="text-left font-medium px-2 py-1.5 whitespace-nowrap text-[10px] uppercase tracking-wider">
                  {c.label}
                </th>
              ))}
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, rIdx) => {
              const lowConf = (row.confidence ?? 1) < 0.8;
              return (
                <tr key={rIdx} className={cn("border-t group", lowConf && "bg-amber-500/5")}>
                  {COLS.map((c) => {
                    const isEditing = editing?.row === rIdx && editing.col === c.key;
                    const display = fmt(row[c.key], c.type);
                    return (
                      <td key={String(c.key)} className="px-2 py-1 align-top">
                        {isEditing ? (
                          <Input
                            autoFocus
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => { updateCell(rIdx, c.key as string, draft, c.type); setEditing(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { updateCell(rIdx, c.key as string, draft, c.type); setEditing(null); }
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className="h-6 px-1.5 text-xs font-mono"
                          />
                        ) : (
                          <button
                            type="button"
                            className="text-left font-mono text-xs min-h-[1.5rem] block w-full hover:bg-accent/40 rounded px-1 -mx-1"
                            onClick={() => { setDraft(display); setEditing({ row: rIdx, col: c.key as string }); }}
                          >
                            {display || <span className="text-muted-foreground italic">—</span>}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-1 py-1 text-right whitespace-nowrap">
                    {row.evidence_snippet && (
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100" onClick={() => onShowEvidence(row, rIdx)} title="Show evidence">
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeRow(rIdx)} title="Remove">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center">
        <Badge variant="outline" className="text-[10px]">{items.length} line item{items.length !== 1 ? "s" : ""}</Badge>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3 w-3 mr-1" /> Add line item
        </Button>
      </div>
    </div>
  );
}
