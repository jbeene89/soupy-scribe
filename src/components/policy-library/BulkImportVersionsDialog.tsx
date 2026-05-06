import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileUp, AlertCircle, CheckCircle2, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { bulkAddVersions, coerceVersionRow, parseCSV, type BulkVersionRow } from "@/lib/policyLibraryService";

interface Props {
  policyId: string;
  policyLabel?: string;
  onImported: () => void;
}

type ParseResult =
  | { kind: "ok"; rows: BulkVersionRow[]; errors: { line: number; error: string }[] }
  | { kind: "fatal"; message: string };

/* CSV column mapping ------------------------------------------------------- */

const TARGET_FIELDS = [
  { key: "effective_start", label: "Effective start *", required: true,
    aliases: ["effective_start", "effective start", "start", "start_date", "startdate", "effectivestart", "from", "begin", "begin_date"] },
  { key: "policy_text", label: "Policy text *", required: true,
    aliases: ["policy_text", "policy text", "text", "policytext", "body", "content", "policy"] },
  { key: "version_label", label: "Version label", required: false,
    aliases: ["version_label", "label", "version", "ver", "rev", "revision"] },
  { key: "effective_end", label: "Effective end", required: false,
    aliases: ["effective_end", "effective end", "end", "end_date", "enddate", "effectiveend", "to", "thru", "until"] },
  { key: "change_summary", label: "Change summary", required: false,
    aliases: ["change_summary", "summary", "changes", "notes", "changelog", "change_log"] },
  { key: "source_url", label: "Source URL", required: false,
    aliases: ["source_url", "url", "source", "link", "href"] },
] as const;

type TargetKey = (typeof TARGET_FIELDS)[number]["key"];
const NONE = "__none__";

function norm(s: string) { return s.toLowerCase().replace(/[\s_\-]+/g, ""); }

function autoMap(headers: string[]): Record<TargetKey, string> {
  const m = {} as Record<TargetKey, string>;
  for (const f of TARGET_FIELDS) {
    const wanted = new Set(f.aliases.map(norm));
    const hit = headers.find(h => wanted.has(norm(h)));
    m[f.key] = hit ?? NONE;
  }
  return m;
}

const CSV_TEMPLATE = `version_label,effective_start,effective_end,policy_text,change_summary,source_url
v6.1,2023-01-01,2023-12-31,"Full policy text for v6.1...","Initial version",https://example.com/v6.1
v6.2,2024-01-01,,"Full policy text for v6.2...","Tightened conservative therapy to 6 months",https://example.com/v6.2
`;

function parseInput(format: "csv" | "json", text: string): ParseResult {
  const errors: { line: number; error: string }[] = [];
  const rows: BulkVersionRow[] = [];
  try {
    if (format === "csv") {
      const recs = parseCSV(text);
      recs.forEach((r, i) => {
        const c = coerceVersionRow(r);
        if (c.ok === true) rows.push(c.row);
        else errors.push({ line: i + 2, error: (c as { ok: false; error: string }).error });
      });
    } else {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.versions) ? parsed.versions : null;
      if (!arr) return { kind: "fatal", message: "JSON must be an array of version objects, or { versions: [...] }." };
      arr.forEach((r: any, i: number) => {
        const c = coerceVersionRow(r ?? {});
        if (c.ok === true) rows.push(c.row);
        else errors.push({ line: i + 1, error: (c as { ok: false; error: string }).error });
      });
    }
  } catch (e: any) {
    return { kind: "fatal", message: e?.message || "Failed to parse input." };
  }
  return { kind: "ok", rows, errors };
}

function parseCsvWithMapping(text: string, mapping: Record<TargetKey, string>): ParseResult {
  const errors: { line: number; error: string }[] = [];
  const rows: BulkVersionRow[] = [];
  let recs: Record<string, string>[];
  try { recs = parseCSV(text); } catch (e: any) { return { kind: "fatal", message: e?.message || "Failed to parse CSV." }; }
  recs.forEach((r, i) => {
    const remapped: Record<string, string> = {};
    for (const f of TARGET_FIELDS) {
      const src = mapping[f.key];
      if (src && src !== NONE) remapped[f.key] = r[src] ?? "";
    }
    const c = coerceVersionRow(remapped);
    if (c.ok === true) rows.push(c.row);
    else errors.push({ line: i + 2, error: (c as { ok: false; error: string }).error });
  });
  return { kind: "ok", rows, errors };
}

export default function BulkImportVersionsDialog({ policyId, policyLabel, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [mapping, setMapping] = useState<Record<TargetKey, string> | null>(null);

  // Detect CSV headers from current text
  const csvHeaders = useMemo<string[]>(() => {
    if (format !== "csv" || !text.trim()) return [];
    try {
      const recs = parseCSV(text);
      if (recs.length === 0) {
        // No data rows but we still want headers — re-derive from first non-empty line
        const first = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? "";
        // crude split by comma respecting quotes
        const m = first.match(/("([^"]|"")*"|[^,]+)/g) ?? [];
        return m.map(h => h.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
      }
      return Object.keys(recs[0]);
    } catch { return []; }
  }, [format, text]);

  // Auto-map whenever CSV headers change
  useEffect(() => {
    if (format === "csv" && csvHeaders.length > 0) setMapping(autoMap(csvHeaders));
    else setMapping(null);
  }, [csvHeaders, format]);

  const mappingComplete = !!mapping && TARGET_FIELDS.every(f => !f.required || (mapping[f.key] && mapping[f.key] !== NONE));

  function reset() { setText(""); setResult(null); }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.name.toLowerCase().endsWith(".json")) setFormat("json");
    else if (f.name.toLowerCase().endsWith(".csv")) setFormat("csv");
    const reader = new FileReader();
    reader.onload = () => { setText(String(reader.result || "")); setResult(null); };
    reader.onerror = () => toast.error("Could not read file.");
    reader.readAsText(f);
  }

  function handleParse() {
    if (!text.trim()) { toast.error("Paste content or upload a file first."); return; }
    if (format === "csv") {
      if (!mapping) { toast.error("Add CSV headers first."); return; }
      if (!mappingComplete) { toast.error("Map all required columns (marked *)."); return; }
      setResult(parseCsvWithMapping(text, mapping));
    } else {
      setResult(parseInput(format, text));
    }
  }

  async function handleImport() {
    if (!result || result.kind !== "ok" || result.rows.length === 0) return;
    setImporting(true);
    try {
      const n = await bulkAddVersions(policyId, result.rows);
      toast.success(`Imported ${n} version${n === 1 ? "" : "s"}.`);
      onImported();
      setOpen(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "policy-versions-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Bulk import</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk import versions{policyLabel ? ` — ${policyLabel}` : ""}</DialogTitle>
          <DialogDescription>
            Upload or paste CSV/JSON to add multiple policy versions at once. Required: <code>effective_start</code>, <code>policy_text</code>.
            Optional: <code>version_label</code>, <code>effective_end</code>, <code>change_summary</code>, <code>source_url</code>.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={format} onValueChange={(v) => { setFormat(v as any); setResult(null); }}>
          <div className="flex items-center justify-between gap-2">
            <TabsList><TabsTrigger value="csv">CSV</TabsTrigger><TabsTrigger value="json">JSON</TabsTrigger></TabsList>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" />CSV template</Button>
              <Label htmlFor="bulk-version-file" className="cursor-pointer inline-flex items-center text-sm px-3 py-1.5 rounded-md border hover:bg-accent">
                <FileUp className="h-4 w-4 mr-1" />Upload file
              </Label>
              <input id="bulk-version-file" type="file" accept=".csv,.json,text/csv,application/json" className="hidden" onChange={handleFile} />
            </div>
          </div>

          <TabsContent value="csv" className="mt-3 space-y-2">
            <Textarea rows={10} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }}
              placeholder={CSV_TEMPLATE} className="font-mono text-xs" />
            {csvHeaders.length > 0 && mapping && (
              <div className="rounded border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Map your columns</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{csvHeaders.length} column{csvHeaders.length === 1 ? "" : "s"} detected</Badge>
                    <Button variant="ghost" size="sm" onClick={() => setMapping(autoMap(csvHeaders))}>Auto-map</Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Pick which column in your file feeds each field. Required fields are marked *.</p>
                <div className="grid grid-cols-2 gap-3">
                  {TARGET_FIELDS.map(f => {
                    const value = mapping[f.key] || NONE;
                    const missing = f.required && (value === NONE);
                    return (
                      <div key={f.key}>
                        <Label className="text-xs flex items-center gap-1">
                          {f.label}
                          {missing && <span className="text-destructive">unmapped</span>}
                        </Label>
                        <Select value={value} onValueChange={(v) => { setMapping({ ...mapping, [f.key]: v }); setResult(null); }}>
                          <SelectTrigger className={missing ? "border-destructive" : ""}><SelectValue placeholder="Choose column" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{f.required ? "— select column —" : "— not in file —"}</SelectItem>
                            {csvHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="json" className="mt-3 space-y-2">
            <Textarea rows={10} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }}
              placeholder={`[\n  {\n    "version_label": "v6.2",\n    "effective_start": "2024-01-01",\n    "effective_end": null,\n    "policy_text": "Full text...",\n    "change_summary": "Tightened criteria",\n    "source_url": "https://..."\n  }\n]`}
              className="font-mono text-xs" />
          </TabsContent>
        </Tabs>

        {result && result.kind === "fatal" && (
          <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{result.message}</AlertDescription></Alert>
        )}
        {result && result.kind === "ok" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" />{result.rows.length} valid</Badge>
              {result.errors.length > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />{result.errors.length} skipped</Badge>}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-32 overflow-auto rounded border bg-muted/30 p-2 text-xs space-y-1">
                {result.errors.slice(0, 50).map((e, i) => (
                  <div key={i}>Row {e.line}: <span className="text-destructive">{e.error}</span></div>
                ))}
              </div>
            )}
            {result.rows.length > 0 && (
              <div className="max-h-40 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/40"><tr>
                    <th className="text-left p-2">Label</th><th className="text-left p-2">Start</th><th className="text-left p-2">End</th><th className="text-left p-2">Text preview</th>
                  </tr></thead>
                  <tbody>
                    {result.rows.slice(0, 25).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.version_label || "—"}</td>
                        <td className="p-2">{r.effective_start}</td>
                        <td className="p-2">{r.effective_end || "current"}</td>
                        <td className="p-2 truncate max-w-[280px]">{r.policy_text.slice(0, 80)}{r.policy_text.length > 80 ? "…" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          {!result || result.kind === "fatal"
            ? <Button onClick={handleParse}>Validate</Button>
            : <Button onClick={handleImport} disabled={importing || result.rows.length === 0}>
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing…</> : <>Import {result.rows.length} version{result.rows.length === 1 ? "" : "s"}</>}
              </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}