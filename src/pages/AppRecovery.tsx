import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, DollarSign, AlertTriangle, CheckCircle2, ChevronRight, Trash2, Sparkles, FolderUp, ShieldCheck, ShieldAlert, ShieldX, Download } from "lucide-react";
import { exportRecoveryBatchPDF } from "@/lib/exportRecoveryBatchPDF";
import {
  CATEGORY_LABELS,
  LENS_LABELS,
  type RecoveryFinding,
  type RecoveryLensId,
  type RecoveryRun,
  type RecoveryBatch,
  type BatchEncounterInput,
  deleteRecoveryRun,
  deleteBatch,
  finalizeStuckBatch,
  listFindings,
  listRecoveryRuns,
  listBatches,
  listRunsInBatch,
  runRecovery,
  runRecoveryBatch,
  setFindingResolved,
} from "@/lib/recoveryService";
import { readTextMaybeGzipped } from "@/lib/gunzip";
import JSZip from "jszip";

const ALL_LENSES: RecoveryLensId[] = [
  "hcc","cdi","counterfactual","modifier","bundling","contract","clawback_exposure","policy_time","supply",
];

function fmtMoney(n: number | null | undefined): string {
  const v = Number(n || 0);
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function AppRecovery() {
  const [runs, setRuns] = useState<RecoveryRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [findings, setFindings] = useState<RecoveryFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  // Form
  const [encounterText, setEncounterText] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [payer, setPayer] = useState("");
  const [dos, setDos] = useState("");
  const [enabledLenses, setEnabledLenses] = useState<RecoveryLensId[]>(ALL_LENSES);

  // Filter
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showOnlyPrimary, setShowOnlyPrimary] = useState(true);
  const [hideDemoted, setHideDemoted] = useState(true);

  // Batch state
  const [batches, setBatches] = useState<RecoveryBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchRuns, setBatchRuns] = useState<RecoveryRun[]>([]);
  const [batchEncounters, setBatchEncounters] = useState<BatchEncounterInput[]>([]);
  const [batchLabel, setBatchLabel] = useState("");
  const [batchPayer, setBatchPayer] = useState("");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchTurbo, setBatchTurbo] = useState(false); // parallel mode

  useEffect(() => { reloadRuns(); reloadBatches(); }, []);

  async function reloadRuns() {
    try {
      const r = await listRecoveryRuns();
      setRuns(r);
      if (r.length && !selectedRunId) selectRun(r[0].id);
    } catch (e: any) {
      toast({ title: "Could not load runs", description: e.message, variant: "destructive" });
    }
  }

  async function reloadBatches() {
    try {
      const b = await listBatches();
      setBatches(b);
      if (b.length && !selectedBatchId) selectBatch(b[0].id);
    } catch (e: any) {
      toast({ title: "Could not load batches", description: e.message, variant: "destructive" });
    }
  }

  async function selectBatch(id: string) {
    setSelectedBatchId(id);
    try {
      const r = await listRunsInBatch(id);
      setBatchRuns(r);
    } catch (e: any) {
      toast({ title: "Could not load batch runs", description: e.message, variant: "destructive" });
    }
  }

  async function handleBatchFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const next: BatchEncounterInput[] = [];
    // Group key -> { parts: [{path, text}] }. One group = one patient encounter.
    const groups = new Map<string, { path: string; text: string }[]>();
    const TEXT_RE = /\.(txt|md|csv|tsv|json|ndjson|xml|html?|log)$/i;

    function addPart(groupKey: string, path: string, text: string) {
      if (!text || text.trim().length < 5) return;
      const arr = groups.get(groupKey) || [];
      arr.push({ path, text });
      groups.set(groupKey, arr);
    }

    // Pick a stable "patient" group key from a path. If the path has nested
    // folders (e.g. patient_001/admission/note.txt), use the top-level folder.
    // For files inside a sub-section folder like "admission/", we still group
    // by the parent patient folder above it. Falls back to filename.
    function patientKeyFromPath(fullPath: string): string {
      const parts = fullPath.split("/").filter(Boolean);
      if (parts.length >= 2) return parts[0]; // first folder = patient
      return parts[0] || fullPath;
    }
    try {
      for (const file of files) {
        const name = file.name.toLowerCase();
        if (name.endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            const ename = entry.name.toLowerCase();
            if (!TEXT_RE.test(ename)) continue;
            const text = await entry.async("string");
            const key = patientKeyFromPath(entry.name);
            addPart(key, entry.name, text);
          }
        } else {
          const text = await readTextMaybeGzipped(file);
          // webkitRelativePath is set when user picks a folder
          const rel = (file as any).webkitRelativePath || file.name;
          const relTrimmed = rel.includes("/")
            ? rel.split("/").slice(1).join("/") || rel  // strip top "root" wrapper from folder picker
            : rel;
          const key = patientKeyFromPath(relTrimmed);
          addPart(key, rel, text);
        }
      }

      // Flatten groups into one encounter per patient, concatenating parts
      // with clear section dividers so the model can still tell admission
      // notes from labs from discharge.
      for (const [key, parts] of groups.entries()) {
        parts.sort((a, b) => a.path.localeCompare(b.path));
        const concat = parts
          .map(p => `===== ${p.path} =====\n${p.text}`)
          .join("\n\n");
        if (concat.trim().length >= 40) {
          next.push({ patient_ref: key, encounter_text: concat });
        }
      }

      setBatchEncounters(prev => [...prev, ...next]);
      const partCount = Array.from(groups.values()).reduce((s, a) => s + a.length, 0);
      toast({
        title: "Loaded",
        description: `${next.length} patient encounter${next.length === 1 ? "" : "s"} from ${partCount} file${partCount === 1 ? "" : "s"} (total queued: ${batchEncounters.length + next.length})`,
      });
    } catch (err: any) {
      toast({ title: "Could not read files", description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  }

  async function handleRunBatch() {
    if (batchEncounters.length === 0) {
      toast({ title: "No encounters", description: "Upload files or a zip first.", variant: "destructive" });
      return;
    }
    setBatchRunning(true);
    try {
      const res = await runRecoveryBatch({
        batch_label: batchLabel || undefined,
        encounters: batchEncounters,
        lenses: enabledLenses,
        payer: batchPayer || null,
        concurrency: batchTurbo ? 4 : 1,
      });
      toast({
        title: "Batch complete",
        description: `${res.batch.completed_count}/${res.batch.encounter_count} succeeded · ${fmtMoney(res.batch.total_dollars_recoverable)} recoverable`,
      });
      setBatchEncounters([]);
      setBatchLabel("");
      await reloadBatches();
      await selectBatch(res.batch.id);
      await reloadRuns();
    } catch (e: any) {
      toast({ title: "Batch failed", description: e.message, variant: "destructive" });
    } finally {
      setBatchRunning(false);
    }
  }

  async function handleDeleteBatch(id: string) {
    if (!confirm("Delete this batch and all its runs/findings?")) return;
    try {
      await deleteBatch(id);
      if (selectedBatchId === id) { setSelectedBatchId(null); setBatchRuns([]); }
      await reloadBatches();
      await reloadRuns();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  async function selectRun(id: string) {
    setSelectedRunId(id);
    setLoading(true);
    try {
      const f = await listFindings(id);
      setFindings(f);
    } catch (e: any) {
      toast({ title: "Could not load findings", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readTextMaybeGzipped(file);
      setEncounterText(text);
      toast({ title: "Loaded", description: `${file.name} (${text.length.toLocaleString()} chars)` });
    } catch (err: any) {
      toast({ title: "Could not read file", description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  }

  async function handleRun() {
    if (encounterText.trim().length < 40) {
      toast({ title: "Need an encounter", description: "Paste or upload chart text first.", variant: "destructive" });
      return;
    }
    setRunning(true);
    try {
      const res = await runRecovery({
        encounter_text: encounterText,
        patient_ref: patientRef || null,
        payer: payer || null,
        date_of_service: dos || null,
        lenses: enabledLenses,
      });
      toast({
        title: "Recovery scan complete",
        description: `${res.findings.length} findings · ${fmtMoney(res.run.total_dollars_recoverable)} recoverable`,
      });
      await reloadRuns();
      await selectRun(res.run.id);
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }

  async function handleDeleteRun(id: string) {
    if (!confirm("Delete this recovery run and all its findings?")) return;
    try {
      await deleteRecoveryRun(id);
      if (selectedRunId === id) {
        setSelectedRunId(null);
        setFindings([]);
      }
      await reloadRuns();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  }

  async function toggleResolved(f: RecoveryFinding) {
    try {
      await setFindingResolved(f.id, !f.resolved);
      setFindings(prev => prev.map(x => x.id === f.id ? { ...x, resolved: !f.resolved } : x));
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  }

  function toggleLens(l: RecoveryLensId) {
    setEnabledLenses(prev => prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]);
  }

  const selectedRun = useMemo(() => runs.find(r => r.id === selectedRunId) || null, [runs, selectedRunId]);

  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (showOnlyPrimary && !f.is_primary_in_cluster) return false;
      if (hideDemoted && f.adversarial_verdict !== "kept") return false;
      return true;
    });
  }, [findings, categoryFilter, showOnlyPrimary, hideDemoted]);

  const rollup = useMemo(() => {
    const primaries = findings.filter(f => f.is_primary_in_cluster && f.adversarial_verdict === "kept");
    return {
      atRisk: primaries.reduce((s, f) => s + Number(f.dollars_at_risk || 0), 0),
      recoverable: primaries.reduce((s, f) => s + Number(f.dollars_recoverable || 0), 0),
      count: primaries.length,
      duplicates: findings.filter(f => !f.is_primary_in_cluster && f.adversarial_verdict === "kept").length,
      demoted: findings.filter(f => f.adversarial_verdict === "demoted").length,
      removed: findings.filter(f => f.adversarial_verdict === "removed").length,
    };
  }, [findings]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of findings.filter(x => x.is_primary_in_cluster && x.adversarial_verdict === "kept")) {
      map[f.category] = (map[f.category] || 0) + Number(f.dollars_recoverable || 0);
    }
    return map;
  }, [findings]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Revenue Recovery Cockpit
        </h1>
        <p className="text-sm text-muted-foreground">
          Every encounter is scanned in parallel by every revenue-leak lens, deduped across lenses, and put through an adversarial second-pass before counting toward the rollup.
        </p>
      </header>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single Encounter</TabsTrigger>
          <TabsTrigger value="batch"><FolderUp className="h-3.5 w-3.5 mr-1" />Batch / Portfolio</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-4">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-6">
        {/* Input column */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Recovery Scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Patient Ref</Label>
                <Input value={patientRef} onChange={e => setPatientRef(e.target.value)} placeholder="MRN or hadm_id" />
              </div>
              <div>
                <Label className="text-xs">Payer</Label>
                <Input value={payer} onChange={e => setPayer(e.target.value)} placeholder="e.g. Medicare, BCBS" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Date of Service</Label>
                <Input type="date" value={dos} onChange={e => setDos(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Encounter / Chart Text</Label>
              <Textarea
                value={encounterText}
                onChange={e => setEncounterText(e.target.value)}
                placeholder="Paste H&P, discharge summary, op note, progress notes…"
                rows={10}
                className="font-mono text-xs"
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-muted-foreground">{encounterText.length.toLocaleString()} chars</span>
                <label className="text-[11px] text-primary cursor-pointer hover:underline">
                  Upload file (.txt, .csv, .gz)
                  <input type="file" accept=".txt,.csv,.tsv,.json,.ndjson,.xml,.gz,text/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Active Lenses</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_LENSES.map(l => (
                  <button
                    key={l}
                    onClick={() => toggleLens(l)}
                    className={`text-[11px] rounded-md px-2 py-1 border transition-colors ${
                      enabledLenses.includes(l)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {LENS_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleRun} disabled={running || enabledLenses.length === 0} className="w-full">
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running {enabledLenses.length} lenses…</> : <>Run Recovery Scan ({enabledLenses.length})</>}
            </Button>
          </CardContent>
        </Card>

        {/* Results column */}
        <div className="space-y-4">
          {/* Runs list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Runs</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet — paste an encounter and run a scan.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {runs.map(r => (
                    <button
                      key={r.id}
                      onClick={() => selectRun(r.id)}
                      className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                        selectedRunId === r.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ChevronRight className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.patient_ref || "(no ref)"} · {r.payer || "—"}</span>
                        <Badge variant={r.status === "completed" ? "default" : r.status === "partial" ? "secondary" : "destructive"} className="text-[9px]">
                          {r.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmtMoney(r.total_dollars_recoverable)}</span>
                        <Trash2
                          className="h-3 w-3 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDeleteRun(r.id); }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected run details */}
          {selectedRun && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<DollarSign className="h-4 w-4" />} label="Recoverable" value={fmtMoney(rollup.recoverable)} tone="emerald" />
                <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="At Risk" value={fmtMoney(rollup.atRisk)} tone="amber" />
                <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Findings" value={String(rollup.count)} sub={rollup.duplicates ? `+${rollup.duplicates} duplicates` : ""} />
                <StatCard label="Lenses Run" value={String(selectedRun.lenses_run.length)} sub={selectedRun.status} />
              </div>

              {/* Category breakdown */}
              {Object.keys(byCategory).length > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-xs font-medium mb-2 text-muted-foreground">By Category (recoverable $)</div>
                    <div className="space-y-1.5">
                      {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                        const pct = rollup.recoverable > 0 ? (amt / rollup.recoverable) * 100 : 0;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-xs">
                              <span>{CATEGORY_LABELS[cat] || cat}</span>
                              <span className="font-mono">{fmtMoney(amt)}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Filters */}
              <div className="flex items-center gap-3 text-xs">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={showOnlyPrimary} onChange={e => setShowOnlyPrimary(e.target.checked)} />
                  <span className="text-muted-foreground">Hide duplicate-cluster rows (no double-count)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={hideDemoted} onChange={e => setHideDemoted(e.target.checked)} />
                  <span className="text-muted-foreground">Hide adversarially demoted/removed ({rollup.demoted + rollup.removed})</span>
                </label>
              </div>

              {/* Findings table */}
              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
                  ) : filteredFindings.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">No findings for this filter.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="text-left p-2 font-medium">Lens</th>
                            <th className="text-left p-2 font-medium">Finding</th>
                            <th className="text-left p-2 font-medium">Code</th>
                            <th className="text-right p-2 font-medium">$ Recoverable</th>
                            <th className="text-center p-2 font-medium">Conf.</th>
                            <th className="text-center p-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFindings.map(f => (
                            <tr key={f.id} className={`border-t ${f.resolved ? "opacity-50" : ""} ${!f.is_primary_in_cluster ? "bg-muted/20" : ""}`}>
                              <td className="p-2 align-top">
                                <Badge variant="outline" className="text-[10px]">{LENS_LABELS[f.lens]}</Badge>
                                <div className="text-[9px] text-muted-foreground mt-0.5">{CATEGORY_LABELS[f.category] || f.category}</div>
                              </td>
                              <td className="p-2 align-top max-w-md">
                                <div className="font-medium">{f.title}</div>
                                {f.description && <div className="text-muted-foreground mt-0.5 line-clamp-2">{f.description}</div>}
                                {f.recommended_action && <div className="text-[10px] text-primary mt-1">→ {f.recommended_action}</div>}
                                {!f.is_primary_in_cluster && <div className="text-[9px] text-amber-600 mt-0.5">duplicate of cluster {f.dedup_cluster_key}</div>}
                              </td>
                              <td className="p-2 align-top font-mono text-[10px]">{f.code || "—"}</td>
                              <td className="p-2 align-top text-right font-mono text-emerald-600 dark:text-emerald-400">
                                {fmtMoney(f.dollars_recoverable)}
                                {Number(f.dollars_at_risk) > 0 && (
                                  <div className="text-[9px] text-amber-600">@risk {fmtMoney(f.dollars_at_risk)}</div>
                                )}
                              </td>
                              <td className="p-2 align-top text-center">
                                <Badge variant={f.confidence === "high" ? "default" : f.confidence === "medium" ? "secondary" : "outline"} className="text-[9px]">
                                  {f.confidence}
                                </Badge>
                                <div className="mt-1">
                                  {f.adversarial_verdict === "kept" && (
                                    <span title={f.adversarial_note || "Survived adversarial review"} className="inline-flex items-center gap-0.5 text-[9px] text-emerald-600">
                                      <ShieldCheck className="h-2.5 w-2.5" />kept
                                    </span>
                                  )}
                                  {f.adversarial_verdict === "demoted" && (
                                    <span title={f.adversarial_note || "Demoted by adversarial review"} className="inline-flex items-center gap-0.5 text-[9px] text-amber-600">
                                      <ShieldAlert className="h-2.5 w-2.5" />demoted
                                    </span>
                                  )}
                                  {f.adversarial_verdict === "removed" && (
                                    <span title={f.adversarial_note || "Removed by adversarial review"} className="inline-flex items-center gap-0.5 text-[9px] text-destructive">
                                      <ShieldX className="h-2.5 w-2.5" />removed
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2 align-top text-center">
                                <button
                                  onClick={() => toggleResolved(f)}
                                  className={`text-[10px] px-2 py-0.5 rounded border ${f.resolved ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" : "text-muted-foreground border-border hover:border-primary"}`}
                                >
                                  {f.resolved ? "Resolved" : "Open"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedRun.error && (
                <div className="text-xs text-amber-600 p-2 bg-amber-500/5 border border-amber-500/20 rounded">
                  Lens errors: {selectedRun.error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
        </TabsContent>

        <TabsContent value="batch" className="mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_2fr] gap-6">
            {/* Batch input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Batch Scan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Batch Label</Label>
                    <Input value={batchLabel} onChange={e => setBatchLabel(e.target.value)} placeholder="e.g. May Q2 2026 Cardiology pilot" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Payer (applied to all)</Label>
                    <Input value={batchPayer} onChange={e => setBatchPayer(e.target.value)} placeholder="e.g. Medicare" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block border-2 border-dashed border-border hover:border-primary/50 rounded-md p-4 text-center cursor-pointer transition-colors">
                    <FolderUp className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <div className="text-sm font-medium">Files or .zip</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Multiple files, or a zip containing patient folders</div>
                    <input type="file" multiple accept=".txt,.csv,.tsv,.json,.ndjson,.xml,.md,.html,.log,.gz,.zip,text/*" className="hidden" onChange={handleBatchFiles} />
                  </label>
                  <label className="block border-2 border-dashed border-border hover:border-primary/50 rounded-md p-4 text-center cursor-pointer transition-colors">
                    <FolderUp className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <div className="text-sm font-medium">Pick a folder</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Choose your 100-patient root folder — subfolders (admission, labs, notes…) auto-group per patient</div>
                    <input
                      type="file"
                      // @ts-expect-error non-standard but widely supported
                      webkitdirectory=""
                      directory=""
                      multiple
                      className="hidden"
                      onChange={handleBatchFiles}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-2">
                  Structure expected: <span className="font-mono">patient_001/admission/*, patient_001/labs/*, patient_002/...</span> — everything under one patient folder is concatenated into a single encounter.
                </p>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <div className="text-xs font-medium">Turbo mode (parallel)</div>
                    <div className="text-[10px] text-muted-foreground">
                      {batchTurbo
                        ? "Runs 4 patients at a time — ~4x faster, may hit AI rate limits on huge batches."
                        : "Runs one patient at a time — slower but rate-limit safe."}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBatchTurbo(v => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      batchTurbo ? "bg-primary" : "bg-muted"
                    }`}
                    aria-pressed={batchTurbo}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow ring-0 transition-transform ${
                        batchTurbo ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {batchEncounters.length > 0 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto">
                    <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/30">
                      <span className="text-[11px] font-medium">{batchEncounters.length} queued</span>
                      <button onClick={() => setBatchEncounters([])} className="text-[10px] text-destructive hover:underline">Clear all</button>
                    </div>
                    <ul className="text-[11px] divide-y">
                      {batchEncounters.map((e, i) => (
                        <li key={i} className="px-2 py-1 flex justify-between items-center">
                          <span className="truncate font-mono">{e.patient_ref || `encounter-${i + 1}`}</span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">{e.encounter_text.length.toLocaleString()} ch</span>
                            <button onClick={() => setBatchEncounters(prev => prev.filter((_, j) => j !== i))}>
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <Label className="text-xs mb-2 block">Active Lenses</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_LENSES.map(l => (
                      <button
                        key={l}
                        onClick={() => toggleLens(l)}
                        className={`text-[11px] rounded-md px-2 py-1 border transition-colors ${
                          enabledLenses.includes(l)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {LENS_LABELS[l]}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleRunBatch} disabled={batchRunning || batchEncounters.length === 0} className="w-full">
                  {batchRunning ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running {batchEncounters.length} encounters…</>
                  ) : (
                    <>Run Batch ({batchEncounters.length} encounters × {enabledLenses.length} lenses)</>
                  )}
                </Button>
                {batchRunning && (
                  <p className="text-[10px] text-muted-foreground text-center">
                    Sequential to respect rate limits — large batches may take several minutes.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Batch results */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Portfolio Batches</CardTitle>
                </CardHeader>
                <CardContent>
                  {batches.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No batches yet — upload encounters above.</p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {batches.map(b => (
                        <button
                          key={b.id}
                          onClick={() => selectBatch(b.id)}
                          className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                            selectedBatchId === b.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{b.label || "(unlabeled)"}</span>
                            <Badge variant={b.status === "completed" ? "default" : b.status === "partial" ? "secondary" : b.status === "running" ? "outline" : "destructive"} className="text-[9px]">
                              {b.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">{b.completed_count}/{b.encounter_count}</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmtMoney(b.total_dollars_recoverable)}</span>
                            <Trash2
                              className="h-3 w-3 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); handleDeleteBatch(b.id); }}
                            />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedBatchId && (() => {
                const b = batches.find(x => x.id === selectedBatchId);
                if (!b) return null;
                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <StatCard icon={<DollarSign className="h-4 w-4" />} label="Portfolio Recoverable" value={fmtMoney(b.total_dollars_recoverable)} tone="emerald" />
                      <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Portfolio At-Risk" value={fmtMoney(b.total_dollars_at_risk)} tone="amber" />
                      <StatCard label="Encounters" value={`${b.completed_count}/${b.encounter_count}`} sub={b.failed_count ? `${b.failed_count} failed` : "all succeeded"} />
                      <StatCard label="Avg / Encounter" value={fmtMoney(b.completed_count ? b.total_dollars_recoverable / b.completed_count : 0)} tone="emerald" />
                    </div>

                    <div className="flex justify-end">
                      {batchRuns.some(r => r.status === "running") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mr-2"
                          onClick={async () => {
                            try {
                              const res = await finalizeStuckBatch(b.id);
                              toast({
                                title: "Batch finalized",
                                description: `${res.stuckFixed} stuck run${res.stuckFixed === 1 ? "" : "s"} marked failed · ${fmtMoney(res.totalRecoverable)} recoverable across ${res.completed} completed`,
                              });
                              await reloadBatches();
                              await selectBatch(b.id);
                            } catch (e: any) {
                              toast({ title: "Finalize failed", description: e.message, variant: "destructive" });
                            }
                          }}
                        >
                          <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                          Finalize stuck runs ({batchRuns.filter(r => r.status === "running").length})
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            toast({ title: "Building PDF…", description: "Pulling findings across all encounters." });
                            await exportRecoveryBatchPDF(b);
                          } catch (e: any) {
                            toast({ title: "Export failed", description: e.message, variant: "destructive" });
                          }
                        }}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export Portfolio PDF
                      </Button>
                    </div>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Encounters in this batch</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                        {batchRuns.length === 0 ? (
                          <p className="p-4 text-sm text-muted-foreground">No runs.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50 text-muted-foreground">
                                <tr>
                                  <th className="text-left p-2 font-medium">Patient Ref</th>
                                  <th className="text-left p-2 font-medium">Status</th>
                                  <th className="text-right p-2 font-medium">$ Recoverable</th>
                                  <th className="text-right p-2 font-medium">$ At-Risk</th>
                                  <th className="text-center p-2 font-medium"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {batchRuns.map(r => (
                                  <tr key={r.id} className="border-t">
                                    <td className="p-2 font-mono truncate max-w-xs">{r.patient_ref || "—"}</td>
                                    <td className="p-2">
                                      <Badge variant={r.status === "completed" ? "default" : r.status === "partial" ? "secondary" : "destructive"} className="text-[9px]">
                                        {r.status}
                                      </Badge>
                                    </td>
                                    <td className="p-2 text-right font-mono text-emerald-600 dark:text-emerald-400">{fmtMoney(r.total_dollars_recoverable)}</td>
                                    <td className="p-2 text-right font-mono text-amber-600">{fmtMoney(r.total_dollars_at_risk)}</td>
                                    <td className="p-2 text-center">
                                      <button
                                        className="text-[10px] text-primary hover:underline"
                                        onClick={() => { selectRun(r.id); const trigger = document.querySelector<HTMLElement>('[role="tab"][data-state="inactive"][value="single"]'); trigger?.click(); }}
                                      >
                                        Open →
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon?: React.ReactNode; label: string; value: string; sub?: string; tone?: "emerald" | "amber" }) {
  const toneCls = tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</div>
        <div className={`text-xl font-semibold mt-1 ${toneCls}`}>{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}