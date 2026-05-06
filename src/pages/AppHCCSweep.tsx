import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Activity, Play, Trash2, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, TrendingDown, FileText, ClipboardList,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listSweeps, listSuspects, runSweep, deleteSweep, toggleResolved, type HCCSweep, type HCCSuspect } from "@/lib/hccService";

const fmtMoney = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;
const fmtRaf = (n: number) => Number(n || 0).toFixed(3);

const STATUS_BADGE: Record<string, "default"|"secondary"|"destructive"|"outline"> = {
  dropped: "destructive", possible: "secondary", documented: "default",
};

const SAMPLE_PROBLEM_LIST = [
  { hcc: "HCC 22", icd: "E66.01", label: "Morbid obesity (BMI 41)", last_documented: "2024-03-12" },
  { hcc: "HCC 18", icd: "E11.65", label: "Type 2 diabetes with hyperglycemia", last_documented: "2024-03-12" },
  { hcc: "HCC 85", icd: "I50.32", label: "Chronic systolic CHF", last_documented: "2024-09-04" },
  { hcc: "HCC 138", icd: "N18.30", label: "CKD stage 3", last_documented: "2024-09-04" },
  { hcc: "HCC 155", icd: "L97.529", label: "Non-pressure chronic ulcer of foot", last_documented: "2024-11-22" },
];

export default function AppHCCSweep() {
  const { session } = useAuth();
  const user = session?.user;

  const [sweeps, setSweeps] = useState<HCCSweep[]>([]);
  const [active, setActive] = useState<HCCSweep | null>(null);
  const [suspects, setSuspects] = useState<HCCSuspect[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  // Intake
  const [patientRef, setPatientRef] = useState("");
  const [payer, setPayer] = useState("");
  const [planYear, setPlanYear] = useState<string>(String(new Date().getFullYear()));
  const [benchmark, setBenchmark] = useState("10000");
  const [problemListText, setProblemListText] = useState(JSON.stringify(SAMPLE_PROBLEM_LIST, null, 2));
  const [encounterText, setEncounterText] = useState("");

  async function refreshSweeps() {
    try { setSweeps(await listSweeps()); } catch (e: any) { toast.error(e.message); }
  }
  async function openSweep(s: HCCSweep) {
    setActive(s); setLoading(true);
    try { setSuspects(await listSuspects(s.id)); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user) refreshSweeps(); }, [user?.id]);

  async function handleRun() {
    if (!patientRef.trim() || !encounterText.trim()) {
      toast.error("Patient reference and current encounter note are required.");
      return;
    }
    let problemList: any[] = [];
    try { problemList = JSON.parse(problemListText); }
    catch { toast.error("Historical problem list must be valid JSON."); return; }
    if (!Array.isArray(problemList)) { toast.error("Historical problem list must be a JSON array."); return; }

    setRunning(true);
    try {
      const res = await runSweep({
        patient_ref: patientRef.trim(),
        payer: payer.trim() || null,
        plan_year: Number(planYear) || new Date().getFullYear(),
        historical_problem_list: problemList,
        current_encounter_text: encounterText,
        benchmark_per_raf: Number(benchmark) || 10000,
      });
      toast.success(`Sweep complete — ${res.suspects.length} suspect${res.suspects.length === 1 ? "" : "s"} flagged.`);
      await refreshSweeps();
      await openSweep(res.sweep);
    } catch (e: any) {
      toast.error(e?.message || "Sweep failed");
    } finally { setRunning(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sweep and all its suspects?")) return;
    try { await deleteSweep(id); if (active?.id === id) { setActive(null); setSuspects([]); } await refreshSweeps(); toast.success("Deleted."); }
    catch (e: any) { toast.error(e.message); }
  }

  async function handleToggle(s: HCCSuspect) {
    try {
      await toggleResolved(s.id, !s.resolved);
      setSuspects(prev => prev.map(x => x.id === s.id ? { ...x, resolved: !s.resolved } : x));
    } catch (e: any) { toast.error(e.message); }
  }

  if (!user) {
    return <div className="p-6"><Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">Sign in to run HCC sweeps.</p></CardContent></Card></div>;
  }

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">HCC / VBC Leak Detector</h1>
          <p className="text-sm text-muted-foreground">Longitudinal risk-adjustment sweep — flags dropped HCC suspects vs. the active encounter and quantifies RAF revenue exposure.</p>
        </div>
      </div>

      {!active ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Run a Sweep</CardTitle>
              <CardDescription>Compare the patient's historical problem list against the current encounter note.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Patient Reference</Label><Input value={patientRef} onChange={(e) => setPatientRef(e.target.value)} placeholder="MRN-1042" /></div>
                <div><Label>Payer</Label><Input value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="Humana MA" /></div>
                <div><Label>Plan Year</Label><Input value={planYear} onChange={(e) => setPlanYear(e.target.value)} type="number" /></div>
                <div><Label>$ per RAF (capitation benchmark)</Label><Input value={benchmark} onChange={(e) => setBenchmark(e.target.value)} type="number" /></div>
              </div>
              <div>
                <Label>Historical Problem List (JSON)</Label>
                <Textarea value={problemListText} onChange={(e) => setProblemListText(e.target.value)} className="font-mono text-xs" rows={8} />
                <p className="text-xs text-muted-foreground mt-1">Each entry should describe a prior condition: hcc, icd, label, last_documented date.</p>
              </div>
              <div>
                <Label>Current Encounter Note</Label>
                <Textarea value={encounterText} onChange={(e) => setEncounterText(e.target.value)} rows={10} placeholder="Paste the current visit's progress note (HPI, A/P, etc.)…" />
              </div>
              <Button onClick={handleRun} disabled={running} className="w-full">
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {running ? "Running adversarial sweep…" : "Run Sweep"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Sweeps</CardTitle>
              <CardDescription>{sweeps.length} on record</CardDescription>
            </CardHeader>
            <CardContent>
              {sweeps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No sweeps yet. Run your first one →</p>
              ) : (
                <div className="space-y-2">
                  {sweeps.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded border bg-card hover:bg-accent/30 cursor-pointer" onClick={() => openSweep(s)}>
                      <div>
                        <div className="font-medium text-sm">{s.patient_ref} <span className="text-muted-foreground font-normal">· {s.payer || "—"} · PY {s.plan_year}</span></div>
                        <div className="text-xs text-muted-foreground">RAF Δ {fmtRaf(s.raf_delta)} · {fmtMoney(s.estimated_revenue_impact)} exposure · {new Date(s.created_at).toLocaleString()}</div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => { setActive(null); setSuspects([]); }}><ArrowLeft className="h-4 w-4 mr-2" />Back to sweeps</Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(active.id)}><Trash2 className="h-4 w-4 mr-2" />Delete sweep</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardDescription>Baseline RAF</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtRaf(active.baseline_raf)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Current RAF (documented)</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{fmtRaf(active.current_raf)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> RAF Δ (dropped)</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold text-destructive">{fmtRaf(active.raf_delta)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardDescription>Estimated Revenue Leak</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold text-destructive">{fmtMoney(active.estimated_revenue_impact)}</div></CardContent></Card>
          </div>

          {active.metadata?.summary && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Sweep Summary</CardTitle></CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{String(active.metadata.summary)}</p></CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Suspect HCCs ({suspects.length})</CardTitle>
              <CardDescription>Conditions documented historically but missing MEAT-level documentation in the current encounter.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
               suspects.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No suspects flagged. RAF capture is intact.</p> :
              (
                <div className="space-y-3">
                  {suspects.map(s => (
                    <div key={s.id} className={`p-4 rounded border ${s.resolved ? "opacity-60 bg-muted/30" : "bg-card"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={STATUS_BADGE[s.status] || "outline"}>{s.status}</Badge>
                            <span className="font-medium">{s.hcc_label}</span>
                            {s.hcc_code && <span className="text-xs text-muted-foreground">{s.hcc_code}</span>}
                            {s.icd_code && <span className="text-xs text-muted-foreground">· {s.icd_code}</span>}
                            <Badge variant="outline" className="text-xs">RAF {fmtRaf(s.raf_weight)}</Badge>
                            <Badge variant="secondary" className="text-xs">{fmtMoney(s.estimated_dollar_impact)}</Badge>
                            <Badge variant="outline" className="text-xs">conf: {s.confidence}</Badge>
                          </div>
                          {s.recapture_recommendation && (
                            <div className="mt-2 text-sm"><span className="font-medium">Recapture: </span>{s.recapture_recommendation}</div>
                          )}
                          {s.evidence_snippet && (
                            <div className="mt-1 text-xs text-muted-foreground border-l-2 pl-2 italic">"{s.evidence_snippet}"</div>
                          )}
                        </div>
                        <Button variant={s.resolved ? "outline" : "secondary"} size="sm" onClick={() => handleToggle(s)}>
                          {s.resolved ? "Reopen" : <><CheckCircle2 className="h-3 w-3 mr-1" /> Resolve</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}