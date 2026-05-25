import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Shield, Upload, FileText, AlertTriangle, CheckCircle2, Calculator,
  TrendingDown, FileDown, Trash2, Play, ArrowLeft, Loader2, Archive, Filter,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listAudits, getAudit, listClaims, getExtrapolation, ingestAudit,
  analyzeClaim, runExtrapolationAttack, fetchChartText, uploadChartForClaim, deleteAudit,
  bulkAttachChartsFromZip, batchAnalyzeClaims,
} from "@/lib/clawbackService";
import type { ClawbackAudit, ClawbackClaim, ClawbackExtrapolation } from "@/lib/clawbackTypes";
import { exportClawbackPacketPDF } from "@/lib/exportClawbackPacketPDF";
import { extractTextFromFile } from "@/lib/fileTextExtractor";

const fmtMoney = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;

const STRENGTH_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  full_defense: "default",
  strong: "default",
  partial: "secondary",
  weak: "outline",
  conceded: "destructive",
  pending: "outline",
};
const STRENGTH_LABEL: Record<string, string> = {
  full_defense: "Full Defense",
  strong: "Strong",
  partial: "Partial",
  weak: "Weak",
  conceded: "Conceded",
  pending: "Pending",
};

export default function AppClawbackShield() {
  const { session } = useAuth();
  const user = session?.user;
  const [params, setParams] = useSearchParams();
  const auditId = params.get("auditId");
  const navigate = useNavigate();

  const [audits, setAudits] = useState<ClawbackAudit[]>([]);
  const [audit, setAudit] = useState<ClawbackAudit | null>(null);
  const [claims, setClaims] = useState<ClawbackClaim[]>([]);
  const [extrap, setExtrap] = useState<ClawbackExtrapolation | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<{ kind: string; pct: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "analyzed" | "weak">("all");

  // Intake form
  const [auditName, setAuditName] = useState("");
  const [contractor, setContractor] = useState("");
  const [demandAmount, setDemandAmount] = useState("");
  const [universeSize, setUniverseSize] = useState("");
  const [sampleSize, setSampleSize] = useState("");
  const [stratifNotes, setStratifNotes] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  async function refreshList() {
    try { setAudits(await listAudits()); } catch (e: any) { toast.error(e.message); }
  }

  async function refreshAudit(id: string) {
    setLoading(true);
    try {
      const [a, cs, ex] = await Promise.all([getAudit(id), listClaims(id), getExtrapolation(id)]);
      setAudit(a); setClaims(cs); setExtrap(ex);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refreshList(); }, []);
  useEffect(() => {
    if (auditId) refreshAudit(auditId);
    else { setAudit(null); setClaims([]); setExtrap(null); }
  }, [auditId]);

  async function handleIngest() {
    if (!csvFile) return toast.error("Upload a claims roster CSV.");
    if (!auditName.trim()) return toast.error("Audit name required.");
    setRunning({ kind: "ingest", pct: 30 });
    try {
      const { readTextMaybeGzipped } = await import("@/lib/gunzip");
      const csvText = await readTextMaybeGzipped(csvFile);
      const res = await ingestAudit({
        auditMeta: {
          auditName,
          contractor: contractor || null,
          demandAmount: parseFloat(demandAmount) || 0,
          universeSize: parseInt(universeSize) || 0,
          sampleSize: parseInt(sampleSize) || 0,
          stratification: stratifNotes ? { notes: stratifNotes } : {},
        },
        csvText,
      });
      toast.success(`Ingested ${res.claimCount} claims.`);
      setAuditName(""); setContractor(""); setDemandAmount("");
      setUniverseSize(""); setSampleSize(""); setStratifNotes(""); setCsvFile(null);
      await refreshList();
      setParams({ auditId: res.auditId });
    } catch (e: any) {
      toast.error(e.message || "Ingest failed");
    } finally { setRunning(null); }
  }

  async function handleAnalyzeAll() {
    if (!audit) return;
    const targets = claims.filter(c => c.defense_status === "pending");
    if (!targets.length) return toast.info("All claims already analyzed.");
    setRunning({ kind: "analyze", pct: 0 });
    const result = await batchAnalyzeClaims(targets, {
      concurrency: 4,
      onProgress: (done, total) => setRunning({ kind: "analyze", pct: Math.round((done / total) * 100) }),
      onClaimError: (c, err) => console.error("claim analyze failed", c.id, err),
    });
    await refreshAudit(audit.id);
    setRunning(null);
    if (result.failed > 0) {
      toast.warning(`Analyzed ${result.ok} · ${result.failed} failed. Retry the unanalyzed ones.`);
    } else {
      toast.success(`Analyzed ${result.ok} claim${result.ok === 1 ? "" : "s"}.`);
    }
  }

  async function handleRunAttack() {
    if (!audit) return;
    setRunning({ kind: "attack", pct: 50 });
    try {
      await runExtrapolationAttack(audit.id);
      await refreshAudit(audit.id);
      toast.success("Extrapolation attack complete.");
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(null); }
  }

  async function handleUploadChart(claim: ClawbackClaim, file: File) {
    if (!user) return;
    try {
      await uploadChartForClaim(user.id, claim.audit_id, claim.id, file);
      toast.success("Chart uploaded.");
      if (audit) await refreshAudit(audit.id);
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleBulkChartZip(file: File) {
    if (!user || !audit) return;
    setRunning({ kind: "zip", pct: 0 });
    try {
      const res = await bulkAttachChartsFromZip(user.id, audit.id, file, (done, total) => {
        setRunning({ kind: "zip", pct: Math.round((done / Math.max(1, total)) * 100) });
      });
      await refreshAudit(audit.id);
      if (res.unmatched.length) {
        toast.warning(`Matched ${res.matched}/${res.total}. ${res.unmatched.length} unmatched.`);
      } else {
        toast.success(`Attached ${res.matched} charts.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Bulk upload failed");
    } finally { setRunning(null); }
  }

  function handleExport() {
    if (!audit) return;
    const blob = exportClawbackPacketPDF({ audit, claims, extrapolation: extrap });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${audit.audit_name.replace(/\s+/g, "_")}_defense_packet.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this audit and all claims?")) return;
    try { await deleteAudit(id); toast.success("Deleted."); setParams({}); refreshList(); }
    catch (e: any) { toast.error(e.message); }
  }

  const totals = useMemo(() => {
    const racDisallowed = claims.reduce((s, c) => s + (Number(c.rac_disallowed_amount) || 0), 0);
    const analyzed = claims.filter(c => c.defense_status !== "pending").length;
    const weak = claims.filter(c => c.defense_strength === "weak" || c.defense_strength === "conceded").length;
    const withCharts = claims.filter(c => c.chart_file_path).length;
    return { racDisallowed, analyzed, total: claims.length, weak, withCharts };
  }, [claims]);

  const visibleClaims = useMemo(() => {
    switch (filter) {
      case "pending": return claims.filter(c => c.defense_status === "pending");
      case "analyzed": return claims.filter(c => c.defense_status !== "pending");
      case "weak": return claims.filter(c => c.defense_strength === "weak" || c.defense_strength === "conceded");
      default: return claims;
    }
  }, [claims, filter]);

  // ─── List view ───
  if (!audit) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> RAC Clawback Shield
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Defend retroactive payer audits at scale. Ingest the contested claims roster, run adversarial defense reasoning across every claim, attack the RAC's extrapolation math, and export a cross-referenced settlement-leverage packet.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Start a New Defense</CardTitle>
            <CardDescription>Upload the RAC's claims roster (CSV). Per-claim charts can be attached afterward.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Audit name *</Label>
                <Input value={auditName} onChange={(e) => setAuditName(e.target.value)} placeholder="Cotiviti FY24 IP Coding Audit" />
              </div>
              <div>
                <Label>Contractor</Label>
                <Input value={contractor} onChange={(e) => setContractor(e.target.value)} placeholder="Cotiviti / Performant / Optum" />
              </div>
              <div>
                <Label>RAC demand amount ($)</Label>
                <Input type="number" value={demandAmount} onChange={(e) => setDemandAmount(e.target.value)} placeholder="5000000" />
              </div>
              <div>
                <Label>Universe size (N)</Label>
                <Input type="number" value={universeSize} onChange={(e) => setUniverseSize(e.target.value)} placeholder="42000" />
              </div>
              <div>
                <Label>Sample size (n)</Label>
                <Input type="number" value={sampleSize} onChange={(e) => setSampleSize(e.target.value)} placeholder="500" />
              </div>
              <div>
                <Label>Stratification notes</Label>
                <Input value={stratifNotes} onChange={(e) => setStratifNotes(e.target.value)} placeholder="e.g. 4 strata by $ band" />
              </div>
            </div>
            <div>
              <Label>Claims roster CSV *</Label>
              <Input type="file" accept=".csv,.csv.gz,.gz,text/csv,application/gzip" onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground mt-1">
                Expected columns (any subset): claim_number, date_of_service, billed_amount, disallowed_amount, cpt_codes, icd_codes, finding_code, finding_text.
              </p>
            </div>
            <Button onClick={handleIngest} disabled={!!running || !csvFile}>
              {running?.kind === "ingest" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Ingest Audit
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Defenses</CardTitle>
            <CardDescription>{audits.length} audit{audits.length === 1 ? "" : "s"} in progress.</CardDescription>
          </CardHeader>
          <CardContent>
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audits yet.</p>
            ) : (
              <div className="space-y-2">
                {audits.map((a) => (
                  <button key={a.id} onClick={() => setParams({ auditId: a.id })}
                    className="w-full text-left flex items-center justify-between border rounded-md px-3 py-2 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{a.audit_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.contractor || "Unknown contractor"} · Demand {fmtMoney(Number(a.demand_amount))} · Sample {a.sample_size ?? "?"}/{a.universe_size ?? "?"}
                      </div>
                    </div>
                    <Badge variant="outline">{a.status}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Detail view ───
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => setParams({})} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> All audits
          </Button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> {audit.audit_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {audit.contractor || "Unknown contractor"} · RAC demand <strong>{fmtMoney(Number(audit.demand_amount))}</strong> · Sample {audit.sample_size ?? "?"} of {audit.universe_size ?? "?"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAnalyzeAll} disabled={!!running}>
            <Play className="h-4 w-4 mr-2" /> Analyze All Claims
          </Button>
          <Button variant="outline" size="sm" onClick={handleRunAttack} disabled={!!running}>
            <Calculator className="h-4 w-4 mr-2" /> Run Extrapolation Attack
          </Button>
          <Button variant="default" size="sm" onClick={handleExport}>
            <FileDown className="h-4 w-4 mr-2" /> Export Packet
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(audit.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {running && (
        <Card>
          <CardContent className="py-3 flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <div className="flex-1">
              <div className="text-sm font-medium">{running.kind === "analyze" ? "Analyzing claims" : running.kind === "attack" ? "Running extrapolation attack" : running.kind === "zip" ? "Mapping charts from ZIP" : "Working"}…</div>
              <Progress value={running.pct} className="h-1 mt-1" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement Leverage */}
      {extrap ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-primary" /> Settlement Leverage</CardTitle>
            <CardDescription>Defensible exposure recomputed from per-claim defense outcomes and CMS Ch.8 compliance review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="RAC Demand" value={fmtMoney(extrap.rac_point_estimate)} />
              <Stat label="Defensible (90% LCB)" value={fmtMoney(extrap.reduced_exposure)} accent />
              <Stat label="Liability Reduced" value={fmtMoney(extrap.exposure_delta)} accent />
              <Stat label="Leverage Score" value={`${extrap.leverage_score}/100`} accent />
            </div>
            <div>
              <Label className="text-xs">Leverage</Label>
              <Progress value={extrap.leverage_score} className="h-2 mt-1" />
            </div>
            {extrap.attack_summary && (
              <div className="text-sm border-l-2 border-primary pl-3 py-1">{extrap.attack_summary}</div>
            )}
            {extrap.details?.scenarios && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Stat label="Best case (90% LCB)" value={fmtMoney(extrap.details.scenarios.best_case_lower_ci)} />
                <Stat label="Expected (90% LCB)" value={fmtMoney(extrap.details.scenarios.expected_lower_ci)} accent />
                <Stat label="Worst case (90% LCB)" value={fmtMoney(extrap.details.scenarios.worst_case_lower_ci)} />
              </div>
            )}
            <Separator />
            <div>
              <h4 className="font-medium text-sm mb-2">CMS MPIM Ch.8 Compliance</h4>
              <div className="space-y-1.5">
                {Object.entries(extrap.cms_compliance || {}).map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2 text-sm">
                    {v.ok ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />}
                    <div>
                      <span className="font-medium capitalize">{k.replace(/_/g, " ")}: </span>
                      <span className="text-muted-foreground">{v.finding}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {(extrap.procedural_defects || []).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2">Procedural Defects</h4>
                <div className="space-y-2">
                  {extrap.procedural_defects.map((d) => (
                    <div key={d.code} className="border rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={d.severity === "high" ? "destructive" : "secondary"}>{d.severity}</Badge>
                        <span className="font-medium text-sm">{d.title}</span>
                        <span className="text-xs text-muted-foreground">{d.citation}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Run the extrapolation attack to compute settlement leverage. Analyze the claims first for the most accurate result.
          </CardContent>
        </Card>
      )}

      {/* Claims roster */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Contested Claims</CardTitle>
              <CardDescription>
                {totals.analyzed} of {totals.total} analyzed · {totals.withCharts} with charts · {fmtMoney(totals.racDisallowed)} disallowed by RAC
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Archive className="h-3 w-3" />
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkChartZip(f); e.currentTarget.value = ""; }}
                />
                <Button asChild variant="outline" size="sm" disabled={!!running}>
                  <span className="cursor-pointer">Bulk-attach ZIP</span>
                </Button>
              </label>
              <div className="inline-flex items-center gap-1 border rounded-md p-0.5">
                {(["all","pending","analyzed","weak"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`text-xs px-2 py-1 rounded ${filter===f?"bg-primary text-primary-foreground":"text-muted-foreground hover:bg-muted"}`}>
                    {f === "all" ? "All" : f === "pending" ? "Pending" : f === "analyzed" ? "Analyzed" : "Weak"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-auto">
            {visibleClaims.map((c) => (
              <ClaimRow key={c.id} claim={c} onUploadChart={(f) => handleUploadChart(c, f)} />
            ))}
            {claims.length === 0 && <p className="text-sm text-muted-foreground">No claims in this audit.</p>}
            {claims.length > 0 && visibleClaims.length === 0 && (
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Filter className="h-4 w-4" /> No claims match this filter.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border p-3 ${accent ? "bg-primary/5 border-primary/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function ClaimRow({ claim, onUploadChart }: { claim: ClawbackClaim; onUploadChart: (f: File) => void }) {
  const [open, setOpen] = useState(false);
  const strength = claim.defense_strength || "pending";
  return (
    <div className="border rounded-md">
      <button onClick={() => setOpen(!open)} className="w-full px-3 py-2 flex items-center justify-between gap-3 text-left hover:bg-muted/40">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">
            {claim.claim_number || "(unnumbered)"} · {claim.date_of_service || "—"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            Disallowed {fmtMoney(claim.rac_disallowed_amount)} · CPT {(claim.cpt_codes || []).slice(0, 3).join(", ") || "—"} · {claim.rac_finding_text || claim.rac_finding_code || "no finding text"}
          </div>
        </div>
        <Badge variant={STRENGTH_VARIANT[strength]}>{STRENGTH_LABEL[strength]}</Badge>
      </button>
      {open && (
        <div className="px-3 py-3 border-t space-y-2 bg-muted/30">
          {claim.clinical_justification && (
            <div className="text-sm"><strong>Defense rationale:</strong> {claim.clinical_justification}</div>
          )}
          {(claim.defense_findings || []).map((f: any, i: number) => (
            <div key={i} className="text-xs"><Badge variant="outline" className="mr-1">{f.type}</Badge>{f.title} — <span className="text-muted-foreground">{f.detail}</span></div>
          ))}
          {claim.recommended_outcome && (
            <div className="text-xs"><strong>Recommended outcome:</strong> {claim.recommended_outcome}</div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Label className="text-xs">{claim.chart_file_path ? "Chart attached." : "Attach chart:"}</Label>
            <Input type="file" className="h-8 text-xs" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadChart(f); }} />
          </div>
        </div>
      )}
    </div>
  );
}