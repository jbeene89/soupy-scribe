import { useCallback, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Upload, FileArchive, Eye, EyeOff, Download, AlertTriangle, CheckCircle2, XCircle, Play, Loader2 } from "lucide-react";
import {
  EXPECTED_FILES,
  MAX_BUNDLE_BYTES,
  parseCodeBayBundle,
  scoreDetector,
  type BenchmarkResult,
  type DetectorFinding,
  type ParsedBundle,
} from "@/lib/codeBayBundle";
import {
  deriveSourceId,
  rollupByDefectType,
  toDetectorFindings,
  type AuditFinding,
  type SourceType,
} from "@/lib/auditFindings";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function RowsPreview({ rows, max = 50 }: { rows: Record<string, string>[]; max?: number }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground p-4">No rows present in this bundle.</p>;
  const cols = Object.keys(rows[0]);
  const visible = rows.slice(0, max);
  return (
    <div className="overflow-auto max-h-[60vh] border rounded-md">
      <Table>
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>{cols.map((c) => <TableHead key={c} className="whitespace-nowrap">{c}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((r, i) => (
            <TableRow key={i}>
              {cols.map((c) => <TableCell key={c} className="whitespace-nowrap font-mono text-xs">{String(r[c] ?? "")}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > max && (
        <div className="p-2 text-xs text-muted-foreground text-center border-t">
          Showing first {max} of {rows.length} rows.
        </div>
      )}
    </div>
  );
}

export default function CodeBayIntake() {
  const [bundle, setBundle] = useState<ParsedBundle | null>(null);
  const [parsing, setParsing] = useState(false);
  const [revealGT, setRevealGT] = useState(false);
  const [tab, setTab] = useState("overview");
  const [detector, setDetector] = useState<DetectorFinding[] | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [running, setRunning] = useState(false);
  const [auditFindings, setAuditFindings] = useState<AuditFinding[] | null>(null);
  const [auditStats, setAuditStats] = useState<{
    rowsAnalyzed: number;
    rowsTruncated: number;
    findingsKept: number;
    findingsRejected: number;
    rowErrors: number;
    rejectedReasons: Record<string, number>;
  } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectorInputRef = useRef<HTMLInputElement>(null);

  const handleBundle = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast({ title: "Wrong file type", description: "Upload a Code Bay .zip bundle.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BUNDLE_BYTES) {
      toast({ title: "Too large", description: `Max bundle size is ${MAX_BUNDLE_BYTES / 1024 / 1024} MB.`, variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const parsed = await parseCodeBayBundle(file);
      setBundle(parsed);
      setRevealGT(false);
      setDetector(null);
      setBenchmark(null);
      setAuditFindings(null);
      setAuditStats(null);
      setTab("overview");
      toast({ title: "Bundle loaded", description: `${parsed.totals.chargeCount} charges · ${parsed.totals.injectedFindingCount} hidden findings.` });
    } catch (e) {
      toast({ title: "Could not parse bundle", description: (e as Error).message, variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove("ring-2", "ring-primary");
    const f = e.dataTransfer.files?.[0];
    if (f) void handleBundle(f);
  }, [handleBundle]);

  const handleDetectorUpload = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Detector output must be a JSON array.");
      const cleaned: DetectorFinding[] = parsed
        .filter((x) => x && typeof x === "object" && typeof x.sourceId === "string")
        .map((x: any) => ({ sourceId: x.sourceId, findingType: x.findingType, reasoning: x.reasoning }));
      setDetector(cleaned);
      if (bundle) setBenchmark(scoreDetector(cleaned, bundle.groundTruth));
      toast({ title: "Detector output loaded", description: `${cleaned.length} findings scored.` });
    } catch (e) {
      toast({ title: "Invalid detector JSON", description: (e as Error).message, variant: "destructive" });
    }
  }, [bundle]);

  const runSoupyDetector = useCallback(async () => {
    if (!bundle) return;
    setRunning(true);
    setAuditFindings(null);
    setAuditStats(null);
    try {
      // Build the per-row payload. Every row carries the sourceId BEFORE the
      // model sees it, so findings can never lose their row-level anchor.
      const rows: { sourceId: string; sourceType: SourceType; row: Record<string, unknown> }[] = [];
      bundle.charges.forEach((r, i) => rows.push({
        sourceId: deriveSourceId(r, "charge", i),
        sourceType: "charge",
        row: r,
      }));
      bundle.vendorInvoices.forEach((r, i) => rows.push({
        sourceId: deriveSourceId(r, "vendor", i),
        sourceType: "vendor",
        row: r,
      }));
      bundle.clinicalNotes.forEach((r, i) => rows.push({
        sourceId: deriveSourceId(r, "note", i),
        sourceType: "note",
        row: r,
      }));

      const { data, error } = await supabase.functions.invoke("audit-bundle", {
        body: { rows },
      });
      if (error) throw error;
      const findings: AuditFinding[] = Array.isArray(data?.findings) ? data.findings : [];
      setAuditFindings(findings);
      setAuditStats(data?.stats ? { ...data.stats, rejectedReasons: data.rejectedReasons ?? {} } : null);

      // Auto-score against the hidden ground truth.
      const detectorPayload = toDetectorFindings(findings);
      setDetector(detectorPayload);
      setBenchmark(scoreDetector(detectorPayload, bundle.groundTruth));
      setTab("playbook");
      toast({
        title: "SoupyAudit run complete",
        description: `${findings.length} validated findings across ${rows.length} rows.`,
      });
    } catch (e) {
      toast({
        title: "SoupyAudit run failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }, [bundle]);

  const rollup = useMemo(
    () => (auditFindings ? rollupByDefectType(auditFindings) : []),
    [auditFindings],
  );
  const totalRecoverable = useMemo(
    () => rollup.reduce((s, r) => s + r.totalRecoverable, 0),
    [rollup],
  );

  const exportParsed = () => {
    if (!bundle) return;
    const safe = revealGT ? bundle : { ...bundle, groundTruth: `[hidden — click "Reveal Ground Truth" first]` as any };
    downloadJson(`${bundle.manifest?.runId ?? "codebay"}-parsed.json`, safe);
  };

  const categories = useMemo(
    () => Object.entries(bundle?.totals.findingCategories ?? {}).sort((a, b) => b[1] - a[1]),
    [bundle],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEO
        title="SoupyAudit Code Bay Intake — Upload Synthetic Audit Bundles"
        description="Drop a Code Bay synthetic audit bundle and inspect what SoupyAudit would score: claims, notes, vendors, FHIR, and hidden ground truth."
        path="/code-bay-intake"
      />
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">SoupyAudit · Code Bay Intake</h1>
            <p className="text-xs text-muted-foreground">
              Synthetic demo data only. No real PHI. No medical advice. No billing submission.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">Public Demo</Badge>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {!bundle && (
          <Card>
            <CardHeader>
              <CardTitle>Upload a Code Bay export bundle</CardTitle>
              <CardDescription>
                Drop the <code className="text-xs px-1 py-0.5 rounded bg-muted">.zip</code> file exported from Code Bay.
                Bundles are parsed in your browser — nothing is uploaded or stored.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                ref={dropRef}
                onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("ring-2", "ring-primary"); }}
                onDragLeave={() => dropRef.current?.classList.remove("ring-2", "ring-primary")}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">Drop a Code Bay .zip bundle here</p>
                <p className="text-sm text-muted-foreground mt-1">or click to select a file (max 25 MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleBundle(f); }}
                />
              </div>
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                {EXPECTED_FILES.map((f) => (
                  <div key={f} className="flex items-center gap-2"><FileArchive className="h-3 w-3" />{f}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {parsing && <p className="text-sm text-muted-foreground">Parsing bundle…</p>}

        {bundle && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileArchive className="h-5 w-5" /> {bundle.fileName}
                  </CardTitle>
                  <CardDescription>
                    Run ID: <span className="font-mono">{String(bundle.manifest?.runId ?? "—")}</span> · Seed:{" "}
                    <span className="font-mono">{String(bundle.manifest?.seed ?? "—")}</span> · {formatBytes(bundle.sizeBytes)}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button size="sm" onClick={runSoupyDetector} disabled={running}>
                    {running
                      ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running…</>
                      : <><Play className="h-4 w-4 mr-1" /> Run SoupyAudit on this bundle</>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportParsed}>
                    <Download className="h-4 w-4 mr-1" /> Export JSON
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setBundle(null); setDetector(null); setBenchmark(null); }}>
                    Upload another
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {bundle.warnings.length > 0 && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="py-3 text-sm flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>{bundle.warnings.join(" · ")}</div>
                </CardContent>
              </Card>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex flex-wrap h-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="charges">Charges ({bundle.charges.length})</TabsTrigger>
                <TabsTrigger value="notes">Clinical Notes ({bundle.clinicalNotes.length})</TabsTrigger>
                <TabsTrigger value="vendors">Vendors ({bundle.vendorInvoices.length})</TabsTrigger>
                <TabsTrigger value="ground-truth">Hidden Ground Truth</TabsTrigger>
                <TabsTrigger value="playbook">
                  Prevention Playbook{auditFindings ? ` (${auditFindings.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="benchmark">Benchmark Scoring</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard label="Patients" value={bundle.totals.patientCount} />
                  <StatCard label="Charges" value={bundle.totals.chargeCount} />
                  <StatCard label="Vendor invoices" value={bundle.totals.vendorInvoiceCount} />
                  <StatCard label="Injected findings" value={bundle.totals.injectedFindingCount} />
                  <StatCard label="FHIR resources" value={bundle.fhirResources.length} />
                  <StatCard
                    label="Total billed"
                    value={bundle.totals.totalBilledAmount.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Bundle contents</CardTitle>
                    <CardDescription>Files SoupyAudit looks for inside a Code Bay export.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {EXPECTED_FILES.map((f) => {
                        const p = bundle.presence[f];
                        return (
                          <div key={f} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              {p.present
                                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                : <XCircle className="h-4 w-4 text-muted-foreground" />}
                              {f}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {p.present ? formatBytes(p.sizeBytes) : "not included"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {categories.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Finding categories (counts only)</CardTitle>
                      <CardDescription>Category counts are shown; specific findings stay hidden until you reveal them.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {categories.map(([cat, n]) => (
                        <Badge key={cat} variant="secondary" className="font-mono text-xs">{cat}: {n}</Badge>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="charges"><RowsPreview rows={bundle.charges} /></TabsContent>
              <TabsContent value="notes"><RowsPreview rows={bundle.clinicalNotes} /></TabsContent>
              <TabsContent value="vendors"><RowsPreview rows={bundle.vendorInvoices} /></TabsContent>

              <TabsContent value="ground-truth" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base">Hidden ground truth</CardTitle>
                      <CardDescription>
                        {bundle.groundTruth.length} findings injected by Code Bay. Hidden by default to keep benchmarks honest.
                      </CardDescription>
                    </div>
                    <Button variant={revealGT ? "secondary" : "default"} size="sm" onClick={() => setRevealGT((v) => !v)}>
                      {revealGT ? <><EyeOff className="h-4 w-4 mr-1" /> Hide</> : <><Eye className="h-4 w-4 mr-1" /> Reveal Ground Truth</>}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {!revealGT && (
                      <p className="text-sm text-muted-foreground">
                        Ground truth is intentionally hidden. Reveal it only after you've run your detector, so your scores stay meaningful.
                      </p>
                    )}
                    {revealGT && (
                      <div className="overflow-auto max-h-[60vh] border rounded-md">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              <TableHead>sourceId</TableHead>
                              <TableHead>findingType</TableHead>
                              <TableHead>category</TableHead>
                              <TableHead>description</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bundle.groundTruth.map((g, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">{String(g.sourceId ?? "")}</TableCell>
                                <TableCell className="font-mono text-xs">{String(g.findingType ?? "")}</TableCell>
                                <TableCell className="text-xs">{String(g.category ?? "")}</TableCell>
                                <TableCell className="text-xs">{String(g.description ?? "")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="benchmark" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Bring Your Own Detector</CardTitle>
                    <CardDescription>
                      Upload a JSON array of detector findings. We'll match each item against the hidden ground truth by
                      <code className="text-xs px-1 mx-1 rounded bg-muted">sourceId</code> first, then
                      <code className="text-xs px-1 mx-1 rounded bg-muted">findingType</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => detectorInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-1" /> Upload detector JSON
                      </Button>
                      <input
                        ref={detectorInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDetectorUpload(f); }}
                      />
                      {detector && <span className="text-sm text-muted-foreground">{detector.length} detector findings loaded</span>}
                    </div>

                    <pre className="text-xs bg-muted rounded p-3 overflow-auto">
{`[
  { "sourceId": "chg-pt-0005-22", "findingType": "modifier_abuse", "reasoning": "..." }
]`}
                    </pre>

                    {benchmark && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <StatCard label="True positives" value={benchmark.truePositives.length} />
                          <StatCard label="False positives" value={benchmark.falsePositives.length} />
                          <StatCard label="False negatives" value={benchmark.falseNegatives.length} />
                          <StatCard
                            label="Precision / Recall"
                            value={`${(benchmark.precision * 100).toFixed(1)}% / ${(benchmark.recall * 100).toFixed(1)}%`}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Matched findings</CardTitle></CardHeader>
                            <CardContent>
                              {benchmark.matched.length === 0
                                ? <p className="text-xs text-muted-foreground">No matches yet.</p>
                                : (
                                  <ul className="space-y-1 text-xs max-h-64 overflow-auto">
                                    {benchmark.matched.map((m, i) => (
                                      <li key={i} className="font-mono">
                                        ✓ {m.detector.sourceId} · {m.detector.findingType ?? "—"}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Missed findings (false negatives)</CardTitle></CardHeader>
                            <CardContent>
                              {benchmark.falseNegatives.length === 0
                                ? <p className="text-xs text-muted-foreground">None — detector caught everything.</p>
                                : (
                                  <ul className="space-y-1 text-xs max-h-64 overflow-auto">
                                    {benchmark.falseNegatives.map((f, i) => (
                                      <li key={i} className="font-mono">
                                        ✗ {String(f.sourceId ?? "—")} · {String(f.findingType ?? "—")}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </CardContent>
                          </Card>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => downloadJson("benchmark-results.json", benchmark)}>
                          <Download className="h-4 w-4 mr-1" /> Export benchmark JSON
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="playbook" className="space-y-4">
                {!auditFindings && (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Click <span className="font-medium">"Run SoupyAudit on this bundle"</span> above
                      to generate validated, line-level findings.
                    </CardContent>
                  </Card>
                )}

                {auditFindings && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Prevention Playbook</CardTitle>
                        <CardDescription>
                          Every category total below names the exact rows behind it.
                          Total recoverable: <span className="font-mono">
                            {totalRecoverable.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                          </span> across {auditFindings.length} validated finding{auditFindings.length === 1 ? "" : "s"}.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {rollup.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            SoupyAudit found no defects in this bundle.
                          </p>
                        )}
                        {rollup.map((g) => (
                          <div key={g.defectType} className="border rounded-md p-3">
                            <div className="flex items-center justify-between">
                              <div className="font-medium capitalize">
                                {g.defectType.replace(/_/g, " ")}
                              </div>
                              <div className="font-mono text-sm">
                                {g.totalRecoverable.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                                <span className="text-muted-foreground"> · {g.count} finding{g.count === 1 ? "" : "s"}</span>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {g.sourceIds.map((sid) => (
                                <Badge key={sid} variant="outline" className="font-mono text-[10px]">
                                  {sid}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Validated findings (source of truth)</CardTitle>
                        <CardDescription>
                          These rows ARE the audit. The summary above is a view of this list.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-auto max-h-[60vh] border rounded-md">
                          <Table>
                            <TableHeader className="sticky top-0 bg-background">
                              <TableRow>
                                <TableHead>sourceId</TableHead>
                                <TableHead>sourceType</TableHead>
                                <TableHead>defectType</TableHead>
                                <TableHead>conf.</TableHead>
                                <TableHead className="text-right">recoverable</TableHead>
                                <TableHead>evidence</TableHead>
                                <TableHead>explanation</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {auditFindings.map((f, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-mono text-xs">{f.sourceId}</TableCell>
                                  <TableCell className="text-xs">{f.sourceType}</TableCell>
                                  <TableCell className="text-xs">{f.defectType}</TableCell>
                                  <TableCell className="text-xs">{f.confidence}</TableCell>
                                  <TableCell className="text-xs text-right font-mono">
                                    {f.recoverableAmount.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                                  </TableCell>
                                  <TableCell className="text-xs italic max-w-[260px] truncate" title={f.evidence}>
                                    "{f.evidence}"
                                  </TableCell>
                                  <TableCell className="text-xs max-w-[260px] truncate" title={f.explanation}>
                                    {f.explanation}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {auditStats && (
                          <div className="mt-3 text-xs text-muted-foreground flex flex-wrap gap-3">
                            <span>Rows analyzed: <span className="font-mono">{auditStats.rowsAnalyzed}</span></span>
                            <span>Kept: <span className="font-mono">{auditStats.findingsKept}</span></span>
                            <span>Rejected by validator: <span className="font-mono">{auditStats.findingsRejected}</span></span>
                            {auditStats.rowsTruncated > 0 && (
                              <span className="text-amber-600">
                                Truncated: <span className="font-mono">{auditStats.rowsTruncated}</span> rows skipped (over per-run cap)
                              </span>
                            )}
                            {Object.keys(auditStats.rejectedReasons || {}).length > 0 && (
                              <span>
                                Rejection reasons: {Object.entries(auditStats.rejectedReasons)
                                  .map(([k, v]) => `${k}=${v}`).join(", ")}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadJson(
                              `${bundle.manifest?.runId ?? "soupyaudit"}-findings.json`,
                              auditFindings,
                            )}
                          >
                            <Download className="h-4 w-4 mr-1" /> Export findings (full)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadJson(
                              `${bundle.manifest?.runId ?? "soupyaudit"}-detector.json`,
                              toDetectorFindings(auditFindings),
                            )}
                          >
                            <Download className="h-4 w-4 mr-1" /> Export detector JSON (for scoring)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              <TabsContent value="benchmark-old-anchor" className="hidden">
                <Card>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => detectorInputRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-1" /> Upload detector JSON
                      </Button>
                      <input
                        ref={detectorInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleDetectorUpload(f); }}
                      />
                      {detector && <span className="text-sm text-muted-foreground">{detector.length} detector findings loaded</span>}
                    </div>

                    <pre className="text-xs bg-muted rounded p-3 overflow-auto">
{`[
  { "sourceId": "chg-pt-0005-22", "findingType": "modifier_abuse", "reasoning": "..." }
]`}
                    </pre>

                    {benchmark && (
                      <>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <StatCard label="True positives" value={benchmark.truePositives.length} />
                          <StatCard label="False positives" value={benchmark.falsePositives.length} />
                          <StatCard label="False negatives" value={benchmark.falseNegatives.length} />
                          <StatCard
                            label="Precision / Recall"
                            value={`${(benchmark.precision * 100).toFixed(1)}% / ${(benchmark.recall * 100).toFixed(1)}%`}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Matched findings</CardTitle></CardHeader>
                            <CardContent>
                              {benchmark.matched.length === 0
                                ? <p className="text-xs text-muted-foreground">No matches yet.</p>
                                : (
                                  <ul className="space-y-1 text-xs max-h-64 overflow-auto">
                                    {benchmark.matched.map((m, i) => (
                                      <li key={i} className="font-mono">
                                        ✓ {m.detector.sourceId} · {m.detector.findingType ?? "—"}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </CardContent>
                          </Card>
                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Missed findings (false negatives)</CardTitle></CardHeader>
                            <CardContent>
                              {benchmark.falseNegatives.length === 0
                                ? <p className="text-xs text-muted-foreground">None — detector caught everything.</p>
                                : (
                                  <ul className="space-y-1 text-xs max-h-64 overflow-auto">
                                    {benchmark.falseNegatives.map((f, i) => (
                                      <li key={i} className="font-mono">
                                        ✗ {String(f.sourceId ?? "—")} · {String(f.findingType ?? "—")}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </CardContent>
                          </Card>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => downloadJson("benchmark-results.json", benchmark)}>
                          <Download className="h-4 w-4 mr-1" /> Export benchmark JSON
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center pt-8 border-t">
          Synthetic demo data only. No real PHI. No medical advice. No billing submission.
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}