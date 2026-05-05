import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gavel, Coins, Receipt, Clock, TrendingUp, AlertTriangle, Loader2, FlaskConical, Bell, Stethoscope, ShieldCheck, Download, Copy } from "lucide-react";
import { toast } from "sonner";
import { parseX12, SAMPLE_835 } from "@/lib/x12Ingest";
import { detectLeakage, defaultFeeSchedule } from "@/lib/contractLeakage";
import { analyzeCounterfactuals } from "@/lib/counterfactualCoding";
import { computeClocks, PAYER_TYPES, STATES, type PayerType } from "@/lib/regulatoryClock";
import { computeDrift, detectReviewerClusters, generateDemoDenials } from "@/lib/denialDrift";
import { generateDemoAppealData, computeWinners } from "@/lib/appealABTest";
import { getDemoPolicyChanges, getDemoProviderMix, correlatePolicyImpact } from "@/lib/ncdLcdAlerts";
import { generateDemoPhysicianDebt, summarizeDebt } from "@/lib/documentationDebt";
import { predictPriorAuth, PA_PAYERS, PA_COMMON_CODES } from "@/lib/priorAuthPredictor";

const SAMPLE_DENIAL_LETTER = `Dear Provider,

After review, the requested service (CPT 27447 — total knee arthroplasty) for member ID 12345 is denied as not medically necessary. Documentation does not support the medical necessity of the requested procedure at this time.

Please refer to our medical policy. If you disagree with this determination, you may submit additional information.

Sincerely,
Utilization Management
ACME Health Plan`;

const SAMPLE_NOTE = `73 y/o male admitted for shortness of breath, lower extremity edema, and weight gain. History of CHF, HTN, T2DM, BMI 42. Creatinine on admission 2.1, baseline 1.0. SpO2 88% on RA, started on 4L NC. Blood cultures drawn for fever 101.4F. Nutrition consult notes weight loss 12lbs over 3 months. Plan: diuresis, monitor renal function, antibiotics pending cultures. Procedure: 99285 ED visit + 71046 chest x-ray, right knee 27447 scheduled.`;

export default function AppStrategicTools() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Strategic Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Five analytical layers no other audit platform ships. Audit the auditor, quantify documentation gaps, detect underpayments, track regulatory clocks, and watch denial behavior drift.
        </p>
      </div>

      <Tabs defaultValue="auditor" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex h-auto flex-nowrap gap-1 w-max min-w-full">
            <TabsTrigger value="auditor" className="whitespace-nowrap"><Gavel className="h-3.5 w-3.5 mr-1.5 shrink-0" />Audit the Auditor</TabsTrigger>
            <TabsTrigger value="counterfactual" className="whitespace-nowrap"><Coins className="h-3.5 w-3.5 mr-1.5 shrink-0" />Counterfactual</TabsTrigger>
            <TabsTrigger value="leakage" className="whitespace-nowrap"><Receipt className="h-3.5 w-3.5 mr-1.5 shrink-0" />Contract Leakage</TabsTrigger>
            <TabsTrigger value="clocks" className="whitespace-nowrap"><Clock className="h-3.5 w-3.5 mr-1.5 shrink-0" />Regulatory Clocks</TabsTrigger>
            <TabsTrigger value="drift" className="whitespace-nowrap"><TrendingUp className="h-3.5 w-3.5 mr-1.5 shrink-0" />Denial Drift</TabsTrigger>
            <TabsTrigger value="abtest" className="whitespace-nowrap"><FlaskConical className="h-3.5 w-3.5 mr-1.5 shrink-0" />Appeal A/B</TabsTrigger>
            <TabsTrigger value="ncd" className="whitespace-nowrap"><Bell className="h-3.5 w-3.5 mr-1.5 shrink-0" />NCD/LCD Alerts</TabsTrigger>
            <TabsTrigger value="debt" className="whitespace-nowrap"><Stethoscope className="h-3.5 w-3.5 mr-1.5 shrink-0" />Doc Debt</TabsTrigger>
            <TabsTrigger value="pa" className="whitespace-nowrap"><ShieldCheck className="h-3.5 w-3.5 mr-1.5 shrink-0" />PA Predictor</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="auditor" className="mt-4"><AuditTheAuditor /></TabsContent>
        <TabsContent value="counterfactual" className="mt-4"><Counterfactual /></TabsContent>
        <TabsContent value="leakage" className="mt-4"><Leakage /></TabsContent>
        <TabsContent value="clocks" className="mt-4"><Clocks /></TabsContent>
        <TabsContent value="drift" className="mt-4"><Drift /></TabsContent>
        <TabsContent value="abtest" className="mt-4"><AppealAB /></TabsContent>
        <TabsContent value="ncd" className="mt-4"><NcdAlerts /></TabsContent>
        <TabsContent value="debt" className="mt-4"><DocDebt /></TabsContent>
        <TabsContent value="pa" className="mt-4"><PAPredictor /></TabsContent>
      </Tabs>
    </div>
  );
}

function AuditTheAuditor() {
  const [letter, setLetter] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<any>(null);

  const run = async () => {
    if (letter.trim().length < 50) { toast.error("Paste a denial letter (min 50 chars)"); return; }
    setBusy(true); setAudit(null);
    try {
      const { data, error } = await supabase.functions.invoke("audit-the-auditor", {
        body: { letterText: letter, additionalContext: context },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAudit(data.audit);
      toast.success("Payer audit complete");
    } catch (e: any) {
      toast.error(e?.message || "Audit failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">Denial letter / EOB</h3>
          <p className="text-xs text-muted-foreground">Paste the payer's adverse determination. We audit it against the payer's own cited policy, ERISA full-and-fair-review, and prompt-pay law.</p>
        </div>
        <Textarea value={letter} onChange={e => setLetter(e.target.value)} rows={12} placeholder="Paste denial letter or EOB rationale..." className="font-mono text-xs" />
        <Textarea value={context} onChange={e => setContext(e.target.value)} rows={3} placeholder="Optional: additional context (claim amount, what was approved/denied, peer-to-peer history)" className="text-xs" />
        <div className="flex gap-2">
          <Button onClick={run} disabled={busy} size="sm">
            {busy ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Auditing...</> : <>Audit this letter</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLetter(SAMPLE_DENIAL_LETTER)}>Load sample</Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Audit results</h3>
        {!audit && <p className="text-xs text-muted-foreground">Results will appear here. Defects, regulatory exposure, and an optional state-DOI complaint draft.</p>}
        {audit && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Letter quality score:</span>
              <Badge variant={audit.overallScore >= 70 ? "secondary" : audit.overallScore >= 40 ? "default" : "destructive"}>{audit.overallScore}/100</Badge>
              <span className="text-muted-foreground ml-3">Overturn likelihood:</span>
              <Badge variant="outline">{audit.overturnLikelihood?.estimate} ({audit.overturnLikelihood?.confidence}%)</Badge>
            </div>
            <div>
              <div className="font-semibold text-foreground">Summary</div>
              <div className="text-muted-foreground">{audit.denialSummary}</div>
              <div className="text-muted-foreground mt-1">Payer: <span className="text-foreground">{audit.payerNamed}</span> · Policy cited: <span className="text-foreground">{audit.policyCited}</span></div>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Defects ({audit.defects?.length ?? 0})</div>
              <div className="space-y-2">
                {audit.defects?.map((d: any, i: number) => (
                  <div key={i} className="border rounded p-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={d.severity === "regulatory" ? "destructive" : d.severity === "high" ? "default" : "secondary"} className="text-[10px]">{d.severity}</Badge>
                      <span className="font-medium">{d.category}</span>
                    </div>
                    <div className="text-muted-foreground italic mt-1">"{d.quote}"</div>
                    <div className="mt-1">{d.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
            {audit.promptPayRisk?.triggered && (
              <div className="border border-amber-500/40 bg-amber-500/5 rounded p-2">
                <div className="font-semibold text-amber-500 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" />Prompt-pay exposure</div>
                <div>{audit.promptPayRisk.reasoning}</div>
                {audit.promptPayRisk.stateLawHook && <div className="text-muted-foreground mt-1">{audit.promptPayRisk.stateLawHook}</div>}
              </div>
            )}
            {audit.erisaRisk?.triggered && (
              <div className="border border-amber-500/40 bg-amber-500/5 rounded p-2">
                <div className="font-semibold text-amber-500">ERISA full-and-fair-review exposure</div>
                <div>{audit.erisaRisk.reasoning}</div>
              </div>
            )}
            {audit.regulatoryComplaintDraft?.warranted && (
              <div>
                <div className="font-semibold text-foreground">Draft state-DOI complaint</div>
                <pre className="bg-muted p-2 rounded text-[11px] whitespace-pre-wrap mt-1">{audit.regulatoryComplaintDraft.draft}</pre>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Counterfactual() {
  const [text, setText] = useState("");
  const result = useMemo(() => text.trim() ? analyzeCounterfactuals(text) : null, [text]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">Clinical note / op report</h3>
          <p className="text-xs text-muted-foreground">Paste the encounter. We surface documentation deltas with $ and CMI impact — what's missing, what to add, what it's worth.</p>
        </div>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={14} placeholder="Paste clinical note..." className="text-xs" />
        <Button variant="outline" size="sm" onClick={() => setText(SAMPLE_NOTE)}>Load sample note</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Counterfactual opportunities</h3>
        {!result && <p className="text-xs text-muted-foreground">Paste a note to see ranked documentation opportunities.</p>}
        {result && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="border rounded p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Estimated uplift</div>
                <div className="text-xl font-semibold text-emerald-500">${result.totalEstimatedUplift.toLocaleString()}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-[10px] uppercase text-muted-foreground">CMI delta</div>
                <div className="text-xl font-semibold">+{result.totalCmiDelta.toFixed(2)}</div>
              </div>
            </div>
            <div className="space-y-2">
              {result.opportunities.filter(o => o.matched).map(o => (
                <div key={o.id} className="border rounded p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge variant="default" className="text-[10px]">{o.category}</Badge>
                    <span className="font-semibold text-emerald-500">+${o.estimatedDollarImpact.toLocaleString()}</span>
                  </div>
                  <div className="font-medium mt-1">{o.suggestion}</div>
                  <div className="text-muted-foreground mt-1">{o.rationale}</div>
                  {o.drgShift && <div className="text-[10px] text-muted-foreground mt-1">DRG: {o.drgShift}{o.cmiDelta ? ` · CMI +${o.cmiDelta}` : ""}</div>}
                </div>
              ))}
              {result.opportunities.filter(o => o.matched).length === 0 && (
                <p className="text-xs text-muted-foreground">No documentation gaps detected by current rule set.</p>
              )}
            </div>
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Rules evaluated ({result.opportunities.length})</summary>
              <ul className="mt-1 space-y-0.5">
                {result.opportunities.map(o => <li key={o.id}>{o.matched ? "● " : "○ "}{o.id}</li>)}
              </ul>
            </details>
          </>
        )}
      </Card>
    </div>
  );
}

function Leakage() {
  const [edi, setEdi] = useState("");
  const report = useMemo(() => {
    if (!edi.trim()) return null;
    const parsed = parseX12(edi);
    if (!parsed) return null;
    return { parsed, leakage: detectLeakage(parsed, defaultFeeSchedule()) };
  }, [edi]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">835 remit (EDI)</h3>
          <p className="text-xs text-muted-foreground">Paste an X12 835 file. We compare paid amounts against expected fee schedule and flag underpayments by code.</p>
        </div>
        <Textarea value={edi} onChange={e => setEdi(e.target.value)} rows={12} placeholder="Paste X12 835 remit..." className="font-mono text-[10px]" />
        <Button variant="outline" size="sm" onClick={() => setEdi(SAMPLE_835)}>Load sample 835</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Leakage report</h3>
        {!report && <p className="text-xs text-muted-foreground">Paste an 835 to see contract leakage analysis.</p>}
        {report && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="border rounded p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Lines scanned</div>
                <div className="text-xl font-semibold">{report.leakage.totalLinesScanned}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Underpayment</div>
                <div className="text-xl font-semibold text-red-500">${report.leakage.totalUnderpayment.toLocaleString()}</div>
              </div>
              <div className="border rounded p-2">
                <div className="text-[10px] uppercase text-muted-foreground">Leakage rate</div>
                <div className="text-xl font-semibold">{report.leakage.leakageRatePct}%</div>
              </div>
            </div>
            <div>
              <div className="font-semibold mb-1">Findings</div>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {report.leakage.findings.map((f, i) => (
                  <div key={i} className="border rounded p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono">{f.code}{f.modifier ? `-${f.modifier}` : ""} · {f.patient}</span>
                      <Badge variant={f.severity === "high" ? "destructive" : f.severity === "medium" ? "default" : "secondary"} className="text-[10px]">−${f.underpayment.toFixed(0)} ({f.underpaymentPct}%)</Badge>
                    </div>
                    <div className="text-muted-foreground mt-0.5">Charged ${f.charged.toFixed(0)} · Paid ${f.paid.toFixed(0)} · Expected ${f.expected.toFixed(0)}</div>
                    {f.adjustments.length > 0 && <div className="text-[10px] text-muted-foreground mt-0.5">{f.adjustments.join(" · ")}</div>}
                  </div>
                ))}
                {report.leakage.findings.length === 0 && <p className="text-muted-foreground">No underpayments detected against reference fee schedule.</p>}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Clocks() {
  const [denialDate, setDenialDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cleanClaimDate, setCleanClaimDate] = useState("");
  const [payerType, setPayerType] = useState<PayerType>("commercial-fully-insured");
  const [state, setState] = useState("CA");

  const events = useMemo(() => computeClocks({
    denialDate: new Date(denialDate),
    payerType,
    state,
    cleanClaimDate: cleanClaimDate ? new Date(cleanClaimDate) : undefined,
  }), [denialDate, payerType, state, cleanClaimDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-5 space-y-3 lg:col-span-1">
        <h3 className="font-semibold text-sm">Inputs</h3>
        <div className="space-y-2">
          <Label className="text-xs">Denial date</Label>
          <Input type="date" value={denialDate} onChange={e => setDenialDate(e.target.value)} />
          <Label className="text-xs">Clean-claim submission date (optional)</Label>
          <Input type="date" value={cleanClaimDate} onChange={e => setCleanClaimDate(e.target.value)} />
          <Label className="text-xs">Payer type</Label>
          <Select value={payerType} onValueChange={v => setPayerType(v as PayerType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PAYER_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Label className="text-xs">State</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Card>
      <Card className="p-5 space-y-3 lg:col-span-2">
        <h3 className="font-semibold text-sm">Active clocks ({events.length})</h3>
        <div className="space-y-2">
          {events.map((ev, i) => {
            const color =
              ev.severity === "expired" ? "border-red-500/60 bg-red-500/5" :
              ev.daysRemaining <= 7 ? "border-amber-500/60 bg-amber-500/5" :
              "border-border";
            return (
              <div key={i} className={`border rounded p-3 ${color}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{ev.label}</span>
                  <Badge variant={ev.severity === "expired" ? "destructive" : ev.severity === "regulatory" ? "default" : "outline"} className="text-[10px]">
                    {ev.severity === "expired" ? "EXPIRED" : `${ev.daysRemaining}d remaining`}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Due: {ev.dueDate.toDateString()} · {ev.basis}</div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">Defaults are conservative national values. Provider contracts may shorten or extend specific clocks — overlay your payer manual for production use.</p>
      </Card>
    </div>
  );
}

function Drift() {
  const events = useMemo(() => generateDemoDenials(), []);
  const drift = useMemo(() => computeDrift(events), [events]);
  const clusters = useMemo(() => detectReviewerClusters(events), [events]);
  const accelerating = drift.filter(d => d.trend === "accelerating");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Denial reason drift (last 30d vs prior 30d)</h3>
        <p className="text-xs text-muted-foreground mt-1">Reasons accelerating per payer. Surface emerging denial patterns before your RCM team notices.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {accelerating.slice(0, 8).map((d, i) => (
            <div key={i} className="border rounded p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{d.payer} · CARC {d.reasonCode}</span>
                <Badge variant="destructive" className="text-[10px]">+{d.changePct}%</Badge>
              </div>
              <div className="text-muted-foreground mt-0.5">Last 30d: {d.totalLast30} · Prior 30d: {d.totalPrev30}</div>
              <div className="mt-1.5 flex items-end gap-0.5 h-8">
                {d.weekly.slice(-10).map((w, j) => {
                  const max = Math.max(...d.weekly.map(x => x.count), 1);
                  return <div key={j} className="bg-primary/60 w-2" style={{ height: `${(w.count / max) * 100}%` }} title={`${w.weekStart}: ${w.count}`} />;
                })}
              </div>
            </div>
          ))}
          {accelerating.length === 0 && <p className="text-xs text-muted-foreground">No accelerating denial patterns in current dataset.</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-sm">Reviewer fingerprint clusters</h3>
        <p className="text-xs text-muted-foreground mt-1">Denials grouped by letter boilerplate signature. Same fingerprint + same reviewer suggests templated denials — typically higher overturn rate.</p>
        <div className="mt-3 space-y-2">
          {clusters.map((c, i) => (
            <div key={i} className="border rounded p-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{c.payer}</span>
                  <span className="text-muted-foreground ml-2">Reviewer: {c.reviewerHint}</span>
                  <span className="text-muted-foreground ml-2">·</span>
                  <span className="font-mono text-[10px] text-muted-foreground ml-1">{c.fingerprint}</span>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">{c.count} denials</Badge>
                  <Badge variant="default" className="text-[10px]">~{c.overturnRateEstimate}% overturn est</Badge>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Top reasons: {c.topReasonCodes.map(r => `${r.code}×${r.count}`).join(" · ")}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">Demo dataset. In a multi-tenant pilot this becomes a network-effect data product.</p>
      </Card>
    </div>
  );
}

function AppealAB() {
  const variants = useMemo(() => generateDemoAppealData(), []);
  const winners = useMemo(() => computeWinners(variants), [variants]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" />Best appeal variant per (payer, denial reason)</h3>
        <p className="text-xs text-muted-foreground mt-1">Tracks overturn rates across multiple appeal letter templates. Winners ranked by lift over the worst-performing variant.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {winners.slice(0, 12).map((w, i) => (
            <div key={i} className="border rounded p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">{w.payer} · CARC {w.reasonCode}</span>
                <Badge variant={w.confidence === "high" ? "default" : "secondary"} className="text-[10px]">+{w.liftOverWorst}pp · {w.confidence}</Badge>
              </div>
              <div className="mt-1 text-muted-foreground">Best: <span className="text-foreground">{w.bestVariant.name}</span></div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {w.bestVariant.attempts} attempts · {Math.round((w.bestVariant.overturned / w.bestVariant.attempts) * 100)}% overturned · avg {w.bestVariant.avgDaysToDecision}d
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-sm">All variants</h3>
        <div className="mt-3 max-h-[400px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground uppercase">
              <tr>
                <th className="text-left py-1">Payer</th>
                <th className="text-left">CARC</th>
                <th className="text-left">Variant</th>
                <th className="text-right">Attempts</th>
                <th className="text-right">Overturn %</th>
                <th className="text-right">Avg days</th>
              </tr>
            </thead>
            <tbody>
              {variants.map(v => (
                <tr key={v.id} className="border-t">
                  <td className="py-1">{v.payer}</td>
                  <td>{v.reasonCode}</td>
                  <td>{v.name}</td>
                  <td className="text-right">{v.attempts}</td>
                  <td className="text-right">{Math.round((v.overturned / v.attempts) * 100)}%</td>
                  <td className="text-right">{v.avgDaysToDecision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function NcdAlerts() {
  const changes = useMemo(() => getDemoPolicyChanges(), []);
  const mix = useMemo(() => getDemoProviderMix(), []);
  const correlated = useMemo(() => correlatePolicyImpact(changes, mix), [changes, mix]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Bell className="h-4 w-4" />Recent CMS coverage changes affecting your code mix</h3>
        <p className="text-xs text-muted-foreground mt-1">NCD, LCD, and MAC article changes correlated with provider monthly volumes. Retroactive changes flagged for recoupment risk.</p>
        <div className="mt-3 space-y-2">
          {correlated.map(({ change, affectedVolume, estimatedMonthlyImpact }) => {
            const tone =
              change.recoupmentRiskLevel === "high" ? "border-red-500/60 bg-red-500/5" :
              change.newRevenueOpportunity ? "border-emerald-500/40 bg-emerald-500/5" :
              change.changeType === "new-prior-auth" ? "border-amber-500/40 bg-amber-500/5" :
              "border-border";
            return (
              <div key={change.id} className={`border rounded p-3 ${tone}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{change.policyType} {change.policyNumber}</Badge>
                    <span className="font-medium text-sm">{change.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {change.retroactive && <Badge variant="destructive" className="text-[10px]">Retroactive</Badge>}
                    {change.newRevenueOpportunity && <Badge variant="default" className="text-[10px] bg-emerald-500/20 text-emerald-500">Opportunity</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{new Date(change.effectiveDate).toLocaleDateString()}</Badge>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{change.summary}</div>
                <div className="text-[11px] mt-1.5 flex items-center gap-3">
                  <span className="text-muted-foreground">Codes: <span className="font-mono text-foreground">{change.affectedCodes.join(", ")}</span></span>
                  {affectedVolume > 0 && <span className="font-medium">Impact: {estimatedMonthlyImpact}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">Demo policy set. Production version ingests CMS Coverage Database weekly.</p>
      </Card>
    </div>
  );
}

function DocDebt() {
  const records = useMemo(() => generateDemoPhysicianDebt(), []);
  const summary = useMemo(() => summarizeDebt(records), [records]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4" />Documentation debt — 12 month rolling</h3>
        <p className="text-xs text-muted-foreground mt-1">Per-physician cumulative dollars left on the table from documentation gaps. Physicians fix what gets measured.</p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="border rounded p-2 text-xs">
            <div className="text-[10px] uppercase text-muted-foreground">Total debt</div>
            <div className="text-xl font-semibold text-red-500">${(summary.totalDebt / 1000).toFixed(0)}K</div>
          </div>
          <div className="border rounded p-2 text-xs">
            <div className="text-[10px] uppercase text-muted-foreground">Physicians tracked</div>
            <div className="text-xl font-semibold">{summary.totalPhysicians}</div>
          </div>
          <div className="border rounded p-2 text-xs">
            <div className="text-[10px] uppercase text-muted-foreground">Avg per physician</div>
            <div className="text-xl font-semibold">${(summary.averageDebtPerPhysician / 1000).toFixed(1)}K</div>
          </div>
          <div className="border rounded p-2 text-xs">
            <div className="text-[10px] uppercase text-muted-foreground">Trend</div>
            <div className="text-sm font-semibold">↑{summary.worsening} ↓{summary.improving}</div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-sm">By physician</h3>
        <div className="mt-3 max-h-[480px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted-foreground uppercase">
              <tr>
                <th className="text-left py-1">Physician</th>
                <th className="text-left">Specialty</th>
                <th className="text-right">Cases/mo</th>
                <th className="text-right">12mo debt</th>
                <th className="text-right">CMI opp</th>
                <th className="text-left pl-2">Top misses</th>
                <th className="text-center">Trend</th>
                <th className="text-left pl-2">Sparkline</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const max = Math.max(...r.monthlyTrend.map(m => m.debt), 1);
                return (
                  <tr key={r.physicianId} className="border-t">
                    <td className="py-1.5 font-medium">{r.physicianName}</td>
                    <td className="text-muted-foreground">{r.specialty}</td>
                    <td className="text-right">{r.monthlyCases}</td>
                    <td className="text-right font-semibold text-red-500">${(r.cumulativeDebt / 1000).toFixed(1)}K</td>
                    <td className="text-right">+{r.cmiOpportunity.toFixed(2)}</td>
                    <td className="pl-2 text-muted-foreground text-[10px]">{r.topMissedCategories.join(", ")}</td>
                    <td className="text-center">
                      <Badge variant={r.trend === "worsening" ? "destructive" : r.trend === "improving" ? "default" : "secondary"} className="text-[9px]">{r.trend}</Badge>
                    </td>
                    <td className="pl-2">
                      <div className="flex items-end gap-px h-6">
                        {r.monthlyTrend.map((m, j) => (
                          <div key={j} className="bg-primary/60 w-1" style={{ height: `${(m.debt / max) * 100}%` }} title={`${m.month}: $${m.debt}`} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PAPredictor() {
  const [code, setCode] = useState("63685");
  const [payer, setPayer] = useState("Aetna");
  const [text, setText] = useState("");
  const result = useMemo(() => text.trim() ? predictPriorAuth({ procedureCode: code, payer, clinicalText: text }) : null, [code, payer, text]);

  const sampleNote = `52 y/o male with chronic low back pain, failed conservative therapy including 14 weeks of physical therapy, NSAIDs, and 2 epidural steroid injections without sustained relief. Recent MRI lumbar spine shows multilevel degenerative disc disease with moderate central canal stenosis. Patient reports VAS pain 8/10, ODI 52, unable to sit longer than 20 minutes. Failed PT and conservative measures. Psychological evaluation completed and cleared by Dr. Anders. Recommending spinal cord stimulator trial.`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-sm">Prior authorization request</h3>
          <p className="text-xs text-muted-foreground">Predict outcome before submission. Surfaces missing elements payer-by-payer.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Procedure code</Label>
            <Select value={code} onValueChange={setCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PA_COMMON_CODES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Payer</Label>
            <Select value={payer} onValueChange={setPayer}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PA_PAYERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Textarea value={text} onChange={e => setText(e.target.value)} rows={12} placeholder="Paste clinical narrative supporting the PA request..." className="text-xs" />
        <Button variant="outline" size="sm" onClick={() => setText(sampleNote)}>Load sample narrative</Button>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-sm">Prediction</h3>
        {!result && <p className="text-xs text-muted-foreground">Paste a narrative to see outcome prediction.</p>}
        {result && (
          <div className="space-y-3 text-xs">
            <div className="border rounded p-3">
              <div className="flex items-center justify-between">
                <Badge variant={
                  result.predictedOutcome === "approve-fast" ? "default" :
                  result.predictedOutcome === "approve-after-p2p" ? "secondary" :
                  result.predictedOutcome === "delay-need-records" ? "outline" :
                  "destructive"
                } className="text-[10px]">{result.predictedOutcome.replace(/-/g, " ")}</Badge>
                <span className="text-muted-foreground">~{result.estimatedDaysToDecision}d to decision</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-muted-foreground">Approval likelihood:</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${result.approvalLikelihood >= 60 ? "bg-emerald-500" : result.approvalLikelihood >= 40 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${result.approvalLikelihood}%` }} />
                </div>
                <span className="font-semibold">{result.approvalLikelihood}%</span>
              </div>
            </div>

            {result.strengthFactors.length > 0 && (
              <div>
                <div className="font-semibold text-foreground">Strengths</div>
                <ul className="mt-1 space-y-0.5">
                  {result.strengthFactors.map((s, i) => (
                    <li key={i} className="flex items-center gap-1.5"><span className="text-emerald-500">✓</span>{s.factor} <span className="text-[10px] text-muted-foreground">({s.weight})</span></li>
                  ))}
                </ul>
              </div>
            )}

            {result.weaknessFactors.length > 0 && (
              <div>
                <div className="font-semibold text-foreground">Weaknesses</div>
                <ul className="mt-1 space-y-1">
                  {result.weaknessFactors.map((w, i) => (
                    <li key={i} className="border-l-2 border-red-500/60 pl-2">
                      <div><span className="text-red-500">✗</span> {w.factor}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">Fix: {w.remediation}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendedRevisions.length > 0 && (
              <div>
                <div className="font-semibold text-foreground">Recommended additions</div>
                <ul className="mt-1 space-y-0.5 list-disc list-inside text-muted-foreground">
                  {result.recommendedRevisions.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {result.payerSpecificNotes.length > 0 && (
              <div className="border border-amber-500/40 bg-amber-500/5 rounded p-2">
                <div className="font-semibold text-amber-500">Payer notes</div>
                <ul className="mt-1 space-y-0.5">
                  {result.payerSpecificNotes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}