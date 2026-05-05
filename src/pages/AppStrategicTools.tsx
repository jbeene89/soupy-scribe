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
import { Gavel, Coins, Receipt, Clock, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseX12, SAMPLE_835 } from "@/lib/x12Ingest";
import { detectLeakage, defaultFeeSchedule } from "@/lib/contractLeakage";
import { analyzeCounterfactuals } from "@/lib/counterfactualCoding";
import { computeClocks, PAYER_TYPES, STATES, type PayerType } from "@/lib/regulatoryClock";
import { computeDrift, detectReviewerClusters, generateDemoDenials } from "@/lib/denialDrift";

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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="auditor"><Gavel className="h-3.5 w-3.5 mr-1.5" />Audit the Auditor</TabsTrigger>
          <TabsTrigger value="counterfactual"><Coins className="h-3.5 w-3.5 mr-1.5" />Counterfactual</TabsTrigger>
          <TabsTrigger value="leakage"><Receipt className="h-3.5 w-3.5 mr-1.5" />Contract Leakage</TabsTrigger>
          <TabsTrigger value="clocks"><Clock className="h-3.5 w-3.5 mr-1.5" />Regulatory Clocks</TabsTrigger>
          <TabsTrigger value="drift"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Denial Drift</TabsTrigger>
        </TabsList>

        <TabsContent value="auditor" className="mt-4"><AuditTheAuditor /></TabsContent>
        <TabsContent value="counterfactual" className="mt-4"><Counterfactual /></TabsContent>
        <TabsContent value="leakage" className="mt-4"><Leakage /></TabsContent>
        <TabsContent value="clocks" className="mt-4"><Clocks /></TabsContent>
        <TabsContent value="drift" className="mt-4"><Drift /></TabsContent>
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