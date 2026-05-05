import { useMemo, useState } from "react";
import { useLocalState } from "@/hooks/useLocalState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Activity, ClipboardList, FileBarChart, Eye, TrendingDown, HeartPulse, Siren, Microscope, Download, Copy, AlertTriangle, ShieldAlert, Search, Calculator, Handshake, ChevronDown, ChevronRight, NotebookPen, RotateCcw, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import {
  PAYER_SCORECARDS, NOC_ALERTS, SERVICE_LINES, MYSTERY_SHOPPER,
  SHRINKAGE, RUNBOOKS, LOST_APPEAL_RCAS, generateWeeklyBrief,
  gradeColor, ragClass, severityClass,
  VENDOR_CONTRACTS, VENDOR_ANOMALIES, VENDOR_PLAYS, VENDOR_BENCHMARKS,
  vendorRiskClass, vendorSignalLabel,
  VENDOR_DEALS, dealTypeLabel,
} from "@/lib/opsCenterData";

function downloadCsv(rows: (string | number)[][], filename: string) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map(r => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}

export default function AppOpsCenter() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ops Center</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Cross-pollinated playbooks: NOC-style live incident wall, retail-style payer scorecards and shrinkage,
          agency-style weekly brief and service-line health, ITIL-style severity runbooks, and a blameless lost-appeal RCA library.
        </p>
      </div>

      <Tabs defaultValue="noc" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex h-auto flex-nowrap gap-1 w-max min-w-full">
            <TabsTrigger value="noc" className="whitespace-nowrap"><Siren className="h-3.5 w-3.5 mr-1.5 shrink-0" />Denial NOC</TabsTrigger>
            <TabsTrigger value="qbr" className="whitespace-nowrap"><ClipboardList className="h-3.5 w-3.5 mr-1.5 shrink-0" />Payer QBR</TabsTrigger>
            <TabsTrigger value="brief" className="whitespace-nowrap"><FileBarChart className="h-3.5 w-3.5 mr-1.5 shrink-0" />Weekly Brief</TabsTrigger>
            <TabsTrigger value="shopper" className="whitespace-nowrap"><Eye className="h-3.5 w-3.5 mr-1.5 shrink-0" />Mystery Shopper</TabsTrigger>
            <TabsTrigger value="shrink" className="whitespace-nowrap"><TrendingDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />Shrinkage</TabsTrigger>
            <TabsTrigger value="lines" className="whitespace-nowrap"><HeartPulse className="h-3.5 w-3.5 mr-1.5 shrink-0" />Service Lines</TabsTrigger>
            <TabsTrigger value="runbooks" className="whitespace-nowrap"><Activity className="h-3.5 w-3.5 mr-1.5 shrink-0" />Sev Runbooks</TabsTrigger>
            <TabsTrigger value="rca" className="whitespace-nowrap"><Microscope className="h-3.5 w-3.5 mr-1.5 shrink-0" />Lost-Appeal RCA</TabsTrigger>
            <TabsTrigger value="vendors" className="whitespace-nowrap"><ShieldAlert className="h-3.5 w-3.5 mr-1.5 shrink-0" />Vendor Watch</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="noc" className="mt-4"><Noc /></TabsContent>
        <TabsContent value="qbr" className="mt-4"><Qbr /></TabsContent>
        <TabsContent value="brief" className="mt-4"><Brief /></TabsContent>
        <TabsContent value="shopper" className="mt-4"><Shopper /></TabsContent>
        <TabsContent value="shrink" className="mt-4"><Shrinkage /></TabsContent>
        <TabsContent value="lines" className="mt-4"><Lines /></TabsContent>
        <TabsContent value="runbooks" className="mt-4"><Runbooks /></TabsContent>
        <TabsContent value="rca" className="mt-4"><Rca /></TabsContent>
        <TabsContent value="vendors" className="mt-4"><Vendors /></TabsContent>
      </Tabs>
    </div>
  );
}

function Noc() {
  const [filter, setFilter] = useState<"all" | "sev1" | "sev2" | "breached">("all");
  const filtered = useMemo(() => NOC_ALERTS.filter(a => {
    if (filter === "all") return true;
    if (filter === "breached") return a.slaRemainingHrs < 0;
    return a.severity === filter;
  }), [filter]);
  const totalDollars = NOC_ALERTS.reduce((s, a) => s + a.dollarsAtRisk, 0);
  const breached = NOC_ALERTS.filter(a => a.slaRemainingHrs < 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Active incidents" value={NOC_ALERTS.length} />
        <Stat label="Sev1" value={NOC_ALERTS.filter(a => a.severity === "sev1").length} tone="red" />
        <Stat label="SLA breached" value={breached} tone={breached ? "red" : "muted"} />
        <Stat label="$ at risk" value={`$${(totalDollars / 1000).toFixed(0)}K`} tone="amber" />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex gap-1.5">
            {(["all", "sev1", "sev2", "breached"] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-7 text-xs" onClick={() => setFilter(f)}>
                {f.toUpperCase()}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
            ["ID", "Severity", "Payer", "Category", "Title", "SLA hrs remaining", "Claims", "$ at risk", "Opened"],
            ...NOC_ALERTS.map(a => [a.id, a.severity, a.payer, a.category, a.title, a.slaRemainingHrs, a.affectedClaims, a.dollarsAtRisk, a.opened]),
          ], "noc-incidents.csv")}>
            <Download className="h-3 w-3" />CSV
          </Button>
        </div>

        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className={`border rounded-md p-3 ${a.slaRemainingHrs < 0 ? "border-red-500/50 bg-red-500/5" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] uppercase ${severityClass(a.severity)}`}>{a.severity}</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{a.id}</span>
                    <span className="text-xs font-medium">{a.payer}</span>
                    <span className="text-[10px] text-muted-foreground">· {a.category}</span>
                  </div>
                  <div className="text-sm font-medium mt-1">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {a.affectedClaims} claims · ${a.dollarsAtRisk.toLocaleString()} at risk
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {a.slaRemainingHrs < 0 ? (
                    <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Breached {Math.abs(a.slaRemainingHrs)}h</Badge>
                  ) : (
                    <Badge variant={a.slaRemainingHrs <= 12 ? "default" : "outline"} className="text-[10px]">SLA {a.slaRemainingHrs}h</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Qbr() {
  const [picked, setPicked] = useState(PAYER_SCORECARDS[0].payer);
  const card = PAYER_SCORECARDS.find(p => p.payer === picked)!;
  const dtpDelta = card.avgDaysToPay - card.contractDaysToPay;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="p-4 space-y-2 lg:col-span-1">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">All payers</h3>
          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
            ["Payer", "Grade", "Denial %", "Overturn %", "Days to pay", "Contract DTP", "Policy churn 30d", "P2P resp hrs", "Prompt-pay defects", "Trend"],
            ...PAYER_SCORECARDS.map(p => [p.payer, p.grade, p.denialRatePct, p.overturnRatePct, p.avgDaysToPay, p.contractDaysToPay, p.policyChurn30d, p.p2pResponseHrs, p.promptPayDefects, p.trend]),
          ], "payer-scorecards.csv")}>
            <Download className="h-3 w-3" />CSV
          </Button>
        </div>
        <div className="space-y-1">
          {PAYER_SCORECARDS.map(p => (
            <button key={p.payer} onClick={() => setPicked(p.payer)}
              className={`w-full flex items-center justify-between border rounded px-2 py-1.5 text-xs hover:bg-muted ${picked === p.payer ? "bg-muted border-primary" : ""}`}>
              <span className="font-medium truncate">{p.payer}</span>
              <Badge variant="outline" className={`text-[10px] ${gradeColor(p.grade)}`}>{p.grade}</Badge>
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">{card.payer} — Quarterly Scorecard</h3>
            <p className="text-xs text-muted-foreground">Q1 2026 · vs contract baseline</p>
          </div>
          <Badge variant="outline" className={`text-base px-3 py-1 ${gradeColor(card.grade)}`}>{card.grade}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          <Metric label="Denial rate" value={`${card.denialRatePct}%`} bad={card.denialRatePct > 12} />
          <Metric label="Overturn rate" value={`${card.overturnRatePct}%`} bad={card.overturnRatePct < 60} />
          <Metric label="Avg days to pay" value={`${card.avgDaysToPay}d`} bad={dtpDelta > 0} note={dtpDelta > 0 ? `+${dtpDelta}d vs contract` : "On contract"} />
          <Metric label="Policy churn (30d)" value={`${card.policyChurn30d}`} bad={card.policyChurn30d >= 5} />
          <Metric label="P2P response" value={`${card.p2pResponseHrs}h`} bad={card.p2pResponseHrs > 48} />
          <Metric label="Prompt-pay defects" value={`${card.promptPayDefects}`} bad={card.promptPayDefects >= 5} />
        </div>

        <div className="border rounded p-3 text-xs space-y-1">
          <div className="font-semibold">Talking points for QBR</div>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            {dtpDelta > 0 && <li>Days-to-pay running {dtpDelta}d over contract — quantify carrying cost.</li>}
            {card.overturnRatePct >= 60 && <li>{card.overturnRatePct}% overturn rate suggests denials are not standing scrutiny — ask for first-pass quality plan.</li>}
            {card.promptPayDefects >= 5 && <li>{card.promptPayDefects} prompt-pay defects this quarter — escalation path documented.</li>}
            {card.policyChurn30d >= 5 && <li>{card.policyChurn30d} policy changes in last 30d — request 60d advance notice for material edits.</li>}
            {card.trend === "worsening" && <li>Trend is worsening QoQ — request joint root-cause review.</li>}
          </ul>
        </div>
      </Card>
    </div>
  );
}

function Brief() {
  const brief = useMemo(() => generateWeeklyBrief(), []);
  const text = useMemo(() => [
    "WEEKLY BRIEF — Week of " + new Date().toISOString().slice(0, 10),
    "",
    "WHAT CHANGED",
    ...brief.whatChanged.map(x => "  · " + x),
    "",
    "WHAT WE DID",
    ...brief.whatWeDid.map(x => "  · " + x),
    "",
    "WHAT WE RECOMMEND",
    ...brief.whatWeRecommend.map(x => "  · " + x),
    "",
    "METRICS",
    ...brief.metrics.map(m => `  · ${m.label}: ${m.value}`),
  ].join("\n"), [brief]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Weekly Brief — auto-generated</h3>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => { navigator.clipboard.writeText(text); toast.success("Brief copied"); }}>
              <Copy className="h-3 w-3" />Copy
            </Button>
            <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => {
              const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
              const a = document.createElement("a"); a.href = url; a.download = "weekly-brief.txt"; a.click();
              URL.revokeObjectURL(url); toast.success("Brief downloaded");
            }}>
              <Download className="h-3 w-3" />.txt
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {brief.metrics.map(m => <Stat key={m.label} label={m.label} value={m.value} />)}
        </div>

        <div className="grid md:grid-cols-3 gap-3 text-xs">
          <Section title="What changed" items={brief.whatChanged} tone="amber" />
          <Section title="What we did" items={brief.whatWeDid} tone="muted" />
          <Section title="What we recommend" items={brief.whatWeRecommend} tone="emerald" />
        </div>
      </Card>
    </div>
  );
}

function Shopper() {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Synthetic-claim mystery shopper</h3>
          <p className="text-xs text-muted-foreground mt-1">Known-clean claim profiles re-scored against each payer to detect silent policy drift before real denials surface.</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
          ["Payer", "Scenario", "Expected", "Observed", "Drift", "Last observed"],
          ...MYSTERY_SHOPPER.map(m => [m.payer, m.scenario, m.expectedOutcome, m.observedOutcome, m.drift, m.lastObserved]),
        ], "mystery-shopper.csv")}>
          <Download className="h-3 w-3" />CSV
        </Button>
      </div>
      <div className="space-y-2">
        {MYSTERY_SHOPPER.map((m, i) => (
          <div key={i} className={`border rounded p-3 text-xs ${m.drift === "material" ? "border-red-500/50 bg-red-500/5" : m.drift === "minor" ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="font-medium">{m.payer}</div>
              <Badge variant={m.drift === "material" ? "destructive" : m.drift === "minor" ? "default" : "secondary"} className="text-[10px]">{m.drift} drift</Badge>
            </div>
            <div className="text-muted-foreground mt-1">{m.scenario}</div>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <div><span className="text-[10px] uppercase text-muted-foreground">Expected</span><div>{m.expectedOutcome}</div></div>
              <div><span className="text-[10px] uppercase text-muted-foreground">Observed</span><div>{m.observedOutcome}</div></div>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Last observed: {m.lastObserved}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Shrinkage() {
  const total = SHRINKAGE.reduce((s, b) => s + b.amount, 0);
  const preventable = SHRINKAGE.filter(b => b.preventable).reduce((s, b) => s + b.amount, 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Stat label="Total shrinkage (12mo)" value={`$${(total / 1000).toFixed(0)}K`} tone="red" />
        <Stat label="Preventable" value={`$${(preventable / 1000).toFixed(0)}K`} tone="amber" />
        <Stat label="Preventable share" value={`${Math.round((preventable / total) * 100)}%`} />
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Decomposition</h3>
          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
            ["Category", "Amount", "% of total", "Preventable"],
            ...SHRINKAGE.map(b => [b.category, b.amount, b.pctOfTotal, b.preventable ? "yes" : "no"]),
          ], "shrinkage.csv")}>
            <Download className="h-3 w-3" />CSV
          </Button>
        </div>
        <div className="space-y-2">
          {SHRINKAGE.map((b, i) => (
            <div key={i} className="border rounded p-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{b.category}</span>
                  {b.preventable && <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">Preventable</Badge>}
                </div>
                <div className="font-semibold text-red-500">${(b.amount / 1000).toFixed(0)}K · {b.pctOfTotal}%</div>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${b.preventable ? "bg-amber-500" : "bg-muted-foreground"}`} style={{ width: `${b.pctOfTotal}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Lines() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><HeartPulse className="h-4 w-4" />Service-line health (RAG)</h3>
          <p className="text-xs text-muted-foreground mt-1">One row per service line. Drill-in to physicians via Doc Debt panel.</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
          ["Line", "Status", "Denial %", "AR days", "Appeal win %", "Doc debt $K", "Trend"],
          ...SERVICE_LINES.map(l => [l.line, l.rag, l.denialRatePct, l.arDays, l.appealWinPct, l.docDebtK, l.trend]),
        ], "service-line-health.csv")}>
          <Download className="h-3 w-3" />CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left py-1.5">Line</th>
              <th className="text-left">Status</th>
              <th className="text-right">Denial %</th>
              <th className="text-right">AR days</th>
              <th className="text-right">Appeal win %</th>
              <th className="text-right">Doc debt</th>
              <th className="text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {SERVICE_LINES.map(l => (
              <tr key={l.line} className="border-t">
                <td className="py-1.5 font-medium">{l.line}</td>
                <td><Badge variant="outline" className={`text-[10px] ${ragClass(l.rag)}`}>{l.rag.toUpperCase()}</Badge></td>
                <td className="text-right">{l.denialRatePct}%</td>
                <td className="text-right">{l.arDays}</td>
                <td className="text-right">{l.appealWinPct}%</td>
                <td className="text-right">${l.docDebtK}K</td>
                <td className="text-center">{l.trend === "up" ? "↑" : l.trend === "down" ? "↓" : "→"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Runbooks() {
  return (
    <div className="space-y-3">
      {RUNBOOKS.map(r => (
        <Card key={r.severity} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] uppercase ${severityClass(r.severity)}`}>{r.severity}</Badge>
              <span className="text-xs text-muted-foreground">SLA {r.slaHrs}h</span>
            </div>
          </div>
          <div className="mt-2 text-xs"><span className="font-semibold">Trigger:</span> {r.trigger}</div>
          <div className="grid md:grid-cols-3 gap-2 mt-2 text-xs">
            <RunbookCol title="Page" items={r.pages} />
            <RunbookCol title="Pull" items={r.pulls} />
            <RunbookCol title="Template" items={[r.template]} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function Rca() {
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2"><Microscope className="h-4 w-4" />Lost-Appeal RCAs (blameless)</h3>
            <p className="text-xs text-muted-foreground mt-1">Every lost appeal generates a structured RCA. Prevention rules feed the pre-bill check library.</p>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
            ["ID", "Payer", "CPT", "Reason", "Root cause", "Prevention rule", "Lost at", "Amount"],
            ...LOST_APPEAL_RCAS.map(r => [r.id, r.payer, r.cpt, r.denialReason, r.rootCause, r.preventionRule, r.lostAt, r.amount]),
          ], "lost-appeal-rcas.csv")}>
            <Download className="h-3 w-3" />CSV
          </Button>
        </div>
      </Card>
      {LOST_APPEAL_RCAS.map(r => (
        <Card key={r.id} className="p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
              <span className="font-semibold">{r.payer}</span>
              <Badge variant="outline" className="text-[10px] font-mono">CPT {r.cpt}</Badge>
              <Badge variant="secondary" className="text-[10px]">{r.denialReason}</Badge>
            </div>
            <div className="text-right">
              <div className="font-semibold text-red-500">${r.amount.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground">{r.lostAt}</div>
            </div>
          </div>
          <div><span className="text-[10px] uppercase text-muted-foreground">Root cause</span><div>{r.rootCause}</div></div>
          <div><span className="text-[10px] uppercase text-muted-foreground">Contributing</span><ul className="list-disc list-inside text-muted-foreground">{r.contributingFactors.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
          <div className="border-l-2 border-emerald-500/60 pl-2"><span className="text-[10px] uppercase text-emerald-500">Prevention rule (added)</span><div>{r.preventionRule}</div></div>
        </Card>
      ))}
    </div>
  );
}

/* ── small atoms ── */
function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "red" | "amber" | "muted" | "emerald" }) {
  const color = tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : tone === "emerald" ? "text-emerald-500" : "";
  return (
    <div className="border rounded p-2.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function Metric({ label, value, bad, note }: { label: string; value: string; bad?: boolean; note?: string }) {
  return (
    <div className={`border rounded p-2.5 ${bad ? "border-red-500/40 bg-red-500/5" : ""}`}>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold mt-0.5 ${bad ? "text-red-500" : ""}`}>{value}</div>
      {note && <div className="text-[10px] text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}

function Section({ title, items, tone }: { title: string; items: string[]; tone: "amber" | "emerald" | "muted" }) {
  const border = tone === "amber" ? "border-amber-500/40" : tone === "emerald" ? "border-emerald-500/40" : "border-border";
  const head = tone === "amber" ? "text-amber-500" : tone === "emerald" ? "text-emerald-500" : "text-muted-foreground";
  return (
    <div className={`border rounded p-3 ${border}`}>
      <div className={`text-[10px] uppercase font-semibold ${head} mb-1.5`}>{title}</div>
      <ul className="space-y-1 list-disc list-inside text-foreground">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function RunbookCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border rounded p-2">
      <div className="text-[10px] uppercase text-muted-foreground mb-1">{title}</div>
      <ul className="list-disc list-inside space-y-0.5">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

/* ── Vendor Watch ── */
function Vendors() {
  const [tab, setTab] = useLocalState<"roi" | "deals" | "contracts" | "anomalies" | "plays" | "bench">("opsc.vendor.tab", "roi");
  const [pursued] = useLocalState<Record<string, PursueEntry>>("opsc.vendor.pursued", {});
  const totalRecovery = VENDOR_ANOMALIES.reduce((s, a) => s + a.amountK, 0);
  const critical = VENDOR_CONTRACTS.filter(v => v.risk === "critical").length;
  const trapDays = Math.min(...VENDOR_CONTRACTS.filter(v => v.noticeRequiredDays > v.autoRenewDays).map(v => v.autoRenewDays));
  const pursuedCount = Object.values(pursued).filter(p => p.active).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Vendors monitored" value={VENDOR_CONTRACTS.length} />
        <Stat label="Critical risk" value={critical} tone={critical ? "red" : "muted"} />
        <Stat label={pursuedCount ? `Pursuing (${pursuedCount})` : "Recoverable (open)"} value={`$${totalRecovery}K`} tone="emerald" />
        <Stat label="Nearest renew trap" value={isFinite(trapDays) ? `${trapDays}d` : "—"} tone={trapDays <= 30 ? "red" : "amber"} />
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-flex gap-1 border rounded-md p-1 bg-muted/30">
          {([
            { k: "roi",       label: "ROI prioritizer" },
            { k: "deals",     label: "Deals" },
            { k: "contracts", label: "Contracts" },
            { k: "anomalies", label: "Billing anomalies" },
            { k: "plays",     label: "Recovery plays" },
            { k: "bench",     label: "Market benchmarks" },
          ] as const).map(t => (
            <Button key={t.k} size="sm" variant={tab === t.k ? "default" : "ghost"} className="h-7 text-xs whitespace-nowrap" onClick={() => setTab(t.k)}>
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {tab === "roi" && <VendorRoi />}
      {tab === "deals" && <VendorDeals />}
      {tab === "contracts" && <VendorContracts />}
      {tab === "anomalies" && <VendorAnomalies />}
      {tab === "plays" && <VendorPlays />}
      {tab === "bench" && <VendorBench />}
    </div>
  );
}

/* ── persistence shapes ── */
interface PursueEntry { active: boolean; note: string; pinned: boolean; updatedAt: string; }
interface RoiWeights { dollars: number; confidence: number; effort: number; leverage: number; }
const DEFAULT_WEIGHTS: RoiWeights = { dollars: 50, confidence: 25, effort: 15, leverage: 10 };

/* ── ROI prioritizer ──
 * Score = recoverable$ × confidence × effortInverse × leverage
 * Confidence: high=1.0, medium=0.65, low=0.35
 * Effort: derived from signal type (auto-renew-trap = quick, scope-creep = slow)
 * Leverage: derived from signal type (rebate-miss/sla-credit-miss = high)
 */
const SIGNAL_PROFILE: Record<string, { effortDays: number; leverage: number; effortLabel: "quick" | "moderate" | "heavy" }> = {
  "rebate-miss":      { effortDays: 5,  leverage: 1.0, effortLabel: "quick" },
  "sla-credit-miss":  { effortDays: 7,  leverage: 1.0, effortLabel: "quick" },
  "auto-renew-trap":  { effortDays: 3,  leverage: 0.9, effortLabel: "quick" },
  "duplicate":        { effortDays: 10, leverage: 0.95, effortLabel: "moderate" },
  "shadow-fee":       { effortDays: 14, leverage: 0.8, effortLabel: "moderate" },
  "price-creep":      { effortDays: 21, leverage: 0.75, effortLabel: "moderate" },
  "scope-creep":      { effortDays: 35, leverage: 0.6, effortLabel: "heavy" },
};
const CONF_WEIGHT = { high: 1.0, medium: 0.65, low: 0.35 } as const;

function VendorRoi() {
  const [weights, setWeights] = useLocalState<RoiWeights>("opsc.vendor.roi.weights", DEFAULT_WEIGHTS);
  const [pursued, setPursued] = useLocalState<Record<string, PursueEntry>>("opsc.vendor.pursued", {});
  const [openId, setOpenId] = useState<string | null>(null);

  const sumWeights = weights.dollars + weights.confidence + weights.effort + weights.leverage || 1;
  const maxAmount = Math.max(...VENDOR_ANOMALIES.map(a => a.amountK));
  const maxEffort = Math.max(...Object.values(SIGNAL_PROFILE).map(p => p.effortDays));

  const ranked = useMemo(() => {
    return VENDOR_ANOMALIES.map(a => {
      const profile = SIGNAL_PROFILE[a.signal] ?? { effortDays: 20, leverage: 0.7, effortLabel: "moderate" as const };
      const conf = CONF_WEIGHT[a.confidence];
      const dollarsNorm = a.amountK / maxAmount;
      const effortNorm = 1 - (profile.effortDays / maxEffort) * 0.85; // higher effort → lower score
      const score =
        ((wDollars / sumWeights) * dollarsNorm +
          (wConfidence / sumWeights) * conf +
          (wEffort / sumWeights) * effortNorm +
          (wLeverage / sumWeights) * profile.leverage) * 100;
      const expectedRecovery = a.amountK * conf * profile.leverage;
      return { ...a, profile, score: Math.round(score), expectedRecovery: Math.round(expectedRecovery) };
    }).sort((x, y) => y.score - x.score);
  }, [wDollars, wConfidence, wEffort, wLeverage, sumWeights, maxAmount, maxEffort]);

  const top5 = ranked.slice(0, 5);
  const top5Dollars = top5.reduce((s, r) => s + r.expectedRecovery, 0);
  const allDollars = ranked.reduce((s, r) => s + r.expectedRecovery, 0);
  const top5Effort = top5.reduce((s, r) => s + r.profile.effortDays, 0);

  function toggle(id: string) {
    setPursued(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const pursuedRows = ranked.filter(r => pursued.has(r.id));
  const pursuedDollars = pursuedRows.reduce((s, r) => s + r.expectedRecovery, 0);
  const pursuedEffort = pursuedRows.reduce((s, r) => s + r.profile.effortDays, 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          <h3 className="font-semibold text-sm">ROI prioritizer — what to pursue first</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Ranks every billing anomaly by a weighted score: recoverable dollars × confidence × effort × leverage.
          Tune weights to match your team's posture (e.g. heavy on quick-wins vs deep-dollar plays).
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Slider label="$ recoverable" value={wDollars} onChange={setWDollars} />
          <Slider label="Confidence" value={wConfidence} onChange={setWConfidence} />
          <Slider label="Low effort" value={wEffort} onChange={setWEffort} />
          <Slider label="Leverage" value={wLeverage} onChange={setWLeverage} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Stat label="Top-5 expected recovery" value={`$${top5Dollars}K`} tone="emerald" />
          <Stat label="Top-5 effort (cum days)" value={`${top5Effort}d`} />
          <Stat label="Total expected (all)" value={`$${allDollars}K`} />
          <Stat label="Pursuing now" value={`${pursued.size} · $${pursuedDollars}K / ${pursuedEffort}d`} tone={pursued.size ? "emerald" : "muted"} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">Ranked findings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tap a row to add it to your pursue list. Expected $ already discounts by confidence and leverage.</p>
          </div>
          <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
            ["Rank", "ID", "Vendor", "Signal", "Gross $K", "Confidence", "Effort (d)", "Leverage", "Expected $K", "Score"],
            ...ranked.map((r, i) => [i + 1, r.id, r.vendor, vendorSignalLabel(r.signal), r.amountK, r.confidence, r.profile.effortDays, r.profile.leverage, r.expectedRecovery, r.score]),
          ], "vendor-roi-ranked.csv")}>
            <Download className="h-3 w-3" />CSV
          </Button>
        </div>

        <div className="space-y-1.5">
          {ranked.map((r, i) => {
            const active = pursued.has(r.id);
            return (
              <button
                key={r.id}
                onClick={() => toggle(r.id)}
                className={`w-full text-left border rounded-md p-2.5 text-xs hover:bg-muted/50 transition-colors ${active ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] w-6 text-muted-foreground">#{i + 1}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{r.score}</Badge>
                  <span className="font-semibold truncate">{r.vendor}</span>
                  <Badge variant="outline" className="text-[10px]">{vendorSignalLabel(r.signal)}</Badge>
                  <Badge variant={r.confidence === "high" ? "default" : "secondary"} className="text-[10px]">{r.confidence}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${r.profile.effortLabel === "quick" ? "text-emerald-500 border-emerald-500/40" : r.profile.effortLabel === "heavy" ? "text-amber-500 border-amber-500/40" : ""}`}>
                    {r.profile.effortLabel} · {r.profile.effortDays}d
                  </Badge>
                  <span className="ml-auto text-emerald-500 font-semibold">${r.expectedRecovery}K exp</span>
                  <span className="text-[10px] text-muted-foreground">of ${r.amountK}K</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">{r.pattern}</div>
                <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${i < 3 ? "bg-emerald-500" : i < 6 ? "bg-amber-500" : "bg-muted-foreground/40"}`} style={{ width: `${r.score}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="border rounded p-2 space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px]">{value}</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function VendorContracts() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Vendor contracts — variance & renewal traps</h3>
          <p className="text-xs text-muted-foreground mt-1">Effective rate vs contracted rate, with auto-renew vs notice-window math.</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
          ["Vendor", "Category", "Spend $K/yr", "Contracted", "Effective", "Variance %", "Auto-renew (d)", "Notice req (d)", "Risk", "Est recovery $K"],
          ...VENDOR_CONTRACTS.map(v => [v.vendor, v.category, v.spendAnnualK, v.contractedRate, v.effectiveRate, v.variancePct, v.autoRenewDays, v.noticeRequiredDays, v.risk, v.estRecoveryK]),
        ], "vendor-contracts.csv")}>
          <Download className="h-3 w-3" />CSV
        </Button>
      </div>
      <div className="space-y-2">
        {VENDOR_CONTRACTS.map(v => {
          const trap = v.noticeRequiredDays > v.autoRenewDays;
          return (
            <div key={v.vendor} className={`border rounded-md p-3 ${v.risk === "critical" ? "border-red-500/50 bg-red-500/5" : v.risk === "high" ? "border-orange-500/40 bg-orange-500/5" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{v.vendor}</span>
                    <Badge variant="outline" className="text-[10px]">{v.category}</Badge>
                    <Badge variant="outline" className={`text-[10px] uppercase ${vendorRiskClass(v.risk)}`}>{v.risk}</Badge>
                    {trap && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />Renew trap</Badge>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
                    <div><div className="text-[10px] uppercase text-muted-foreground">Contracted</div><div>{v.contractedRate}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Effective</div><div className={v.variancePct < 0 ? "text-red-500" : ""}>{v.effectiveRate}</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Variance</div><div className={v.variancePct < 0 ? "text-red-500 font-semibold" : ""}>{v.variancePct}%</div></div>
                    <div><div className="text-[10px] uppercase text-muted-foreground">Renew / notice</div><div>{v.autoRenewDays}d / {v.noticeRequiredDays}d</div></div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] uppercase text-muted-foreground">Spend / Recovery</div>
                  <div className="text-sm font-semibold">${v.spendAnnualK}K<span className="text-muted-foreground font-normal">/yr</span></div>
                  {v.estRecoveryK > 0 && <div className="text-xs text-emerald-500 font-semibold">+${v.estRecoveryK}K recoverable</div>}
                </div>
              </div>
              <ul className="mt-2 text-[11px] space-y-0.5 list-disc list-inside text-muted-foreground">
                {v.flags.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function VendorAnomalies() {
  const [signal, setSignal] = useState<"all" | (typeof VENDOR_ANOMALIES)[number]["signal"]>("all");
  const filtered = useMemo(() => signal === "all" ? VENDOR_ANOMALIES : VENDOR_ANOMALIES.filter(a => a.signal === signal), [signal]);
  const signals = Array.from(new Set(VENDOR_ANOMALIES.map(a => a.signal)));
  const total = filtered.reduce((s, a) => s + a.amountK, 0);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2"><Search className="h-4 w-4" />Billing anomalies — vendors trying to pull a fast one</h3>
          <p className="text-xs text-muted-foreground mt-1">Pattern detection across invoices, MSAs, and remittances. Each finding has citable evidence.</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
          ["ID", "Vendor", "Detected", "Signal", "Pattern", "Amount $K", "Confidence", "Evidence"],
          ...VENDOR_ANOMALIES.map(a => [a.id, a.vendor, a.detected, a.signal, a.pattern, a.amountK, a.confidence, a.evidence]),
        ], "vendor-anomalies.csv")}>
          <Download className="h-3 w-3" />CSV
        </Button>
      </div>

      <div className="flex gap-1 flex-wrap mb-3">
        <Button size="sm" variant={signal === "all" ? "default" : "outline"} className="h-7 text-xs" onClick={() => setSignal("all")}>All · ${VENDOR_ANOMALIES.reduce((s, a) => s + a.amountK, 0)}K</Button>
        {signals.map(s => (
          <Button key={s} size="sm" variant={signal === s ? "default" : "outline"} className="h-7 text-xs" onClick={() => setSignal(s)}>
            {vendorSignalLabel(s)}
          </Button>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground mb-2">{filtered.length} finding(s) · ${total}K exposure shown</div>

      <div className="space-y-2">
        {filtered.map(a => (
          <div key={a.id} className="border rounded-md p-3 text-xs">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-muted-foreground">{a.id}</span>
                  <span className="font-semibold">{a.vendor}</span>
                  <Badge variant="outline" className="text-[10px]">{vendorSignalLabel(a.signal)}</Badge>
                  <Badge variant={a.confidence === "high" ? "default" : "secondary"} className="text-[10px]">{a.confidence} conf</Badge>
                </div>
                <div className="mt-1">{a.pattern}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Evidence: {a.evidence}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[10px] uppercase text-muted-foreground">Recoverable</div>
                <div className="text-sm font-semibold text-emerald-500">${a.amountK}K</div>
                <div className="text-[10px] text-muted-foreground">{a.detected}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function VendorPlays() {
  return (
    <div className="space-y-3">
      {VENDOR_PLAYS.map(p => (
        <Card key={p.title} className="p-4 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-semibold text-sm">{p.title}</div>
            <div className="flex gap-1 flex-wrap">
              {p.appliesTo.map(s => <Badge key={s} variant="outline" className="text-[10px]">{vendorSignalLabel(s)}</Badge>)}
            </div>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
            {p.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <div className="border-l-2 border-emerald-500/60 pl-2 text-[11px]">
            <span className="text-[10px] uppercase text-emerald-500">Leverage</span>
            <div>{p.leverage}</div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => {
              const text = `${p.title}\n\nLeverage: ${p.leverage}\n\nSteps:\n${p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
              navigator.clipboard.writeText(text); toast.success("Play copied");
            }}>
              <Copy className="h-3 w-3" />Copy play
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function VendorBench() {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">Market benchmarks</h3>
          <p className="text-xs text-muted-foreground mt-1">Where we sit vs the market on each vendor category. Use in QBRs and re-negotiations.</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={() => downloadCsv([
          ["Category", "Metric", "P25", "Median", "P75", "Our position", "Note"],
          ...VENDOR_BENCHMARKS.map(b => [b.category, b.metric, b.marketP25, b.marketMedian, b.marketP75, b.ourPosition, b.note]),
        ], "vendor-benchmarks.csv")}>
          <Download className="h-3 w-3" />CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th className="text-left py-1.5">Category</th>
              <th className="text-left">Metric</th>
              <th className="text-right">P25</th>
              <th className="text-right">Median</th>
              <th className="text-right">P75</th>
              <th className="text-left">Our position</th>
            </tr>
          </thead>
          <tbody>
            {VENDOR_BENCHMARKS.map(b => (
              <tr key={b.category} className="border-t align-top">
                <td className="py-1.5 font-medium">{b.category}</td>
                <td>{b.metric}</td>
                <td className="text-right">{b.marketP25}</td>
                <td className="text-right">{b.marketMedian}</td>
                <td className="text-right">{b.marketP75}</td>
                <td>
                  <Badge variant="outline" className={`text-[10px] ${b.ourPosition === "above market" ? "text-red-500 border-red-500/40 bg-red-500/5" : b.ourPosition === "below market" ? "text-emerald-500 border-emerald-500/40 bg-emerald-500/5" : "text-muted-foreground"}`}>
                    {b.ourPosition}
                  </Badge>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{b.note}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}