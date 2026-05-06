import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export default function BulkImportVersionsDialog({ policyId, policyLabel, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);

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
    setResult(parseInput(format, text));
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