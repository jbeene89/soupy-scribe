import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ChevronDown, ChevronRight, Download } from "lucide-react";
import { LENS_LABELS, type RecoveryFinding, type RecoveryLensId } from "@/lib/recoveryService";

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// Per-lens prevention guidance — what workflow change stops this leak next cycle.
const LENS_PLAYBOOK: Record<RecoveryLensId, { owner: string; actions: string[] }> = {
  hcc: {
    owner: "CDI lead + PCP panel",
    actions: [
      "Run an HCC gap report against the active problem list before the next AWV cycle.",
      "Force suspect-Dx prompts in the EHR when chronic conditions are unaddressed for >12 months.",
      "Schedule risk-adjustment re-capture visits for patients with dropped HCCs from prior year.",
    ],
  },
  cdi: {
    owner: "CDI specialist + attending",
    actions: [
      "Add concurrent CDI review on inpatient day 2 for cases lacking specificity on the principal Dx.",
      "Build EHR smart-phrases for the top under-specified conditions surfaced this cycle.",
      "Loop physician advisor on any case where severity/MCC capture is missing at discharge.",
    ],
  },
  counterfactual: {
    owner: "Coder QA",
    actions: [
      "Add a pre-bill coder second-look on encounters where a higher-paying eligible code was bypassed.",
      "Update coder cheat-sheets with the specific code pairs that were under-selected this cycle.",
    ],
  },
  modifier: {
    owner: "Coding manager",
    actions: [
      "Enable modifier-suggestion edits (-25, -59, -XS/XU, anatomical) in the scrubber before claim drop.",
      "Audit a 10% sample weekly for missing modifiers on the codes that leaked this cycle.",
    ],
  },
  bundling: {
    owner: "Charge integrity",
    actions: [
      "Tighten NCCI/MUE edits in the scrubber for the code pairs that were over- or under-bundled.",
      "Add a charge-master rule that flags component billing when a global code was already submitted.",
    ],
  },
  contract: {
    owner: "Payer contracting + AR",
    actions: [
      "Open underpayment recovery on the specific CPT/payer pairs flagged this cycle.",
      "Update the contract-management system with the variance pattern so it auto-flags next remit.",
      "Schedule a JOC item with this payer if the same code keeps underpaying.",
    ],
  },
  clawback_exposure: {
    owner: "Compliance + RAC defense",
    actions: [
      "Pre-empt by self-reviewing the encounters that fit known RAC issue categories.",
      "Tighten documentation templates so the auditor target language is present on first pass.",
      "Stage defense packets now — don't wait for the demand letter.",
    ],
  },
  policy_time: {
    owner: "Coding policy lead",
    actions: [
      "Subscribe to LCD/NCD change feeds for the payers/codes surfaced this cycle.",
      "Add a DOS-vs-policy-effective-date check in the scrubber to catch off-window claims.",
    ],
  },
  supply: {
    owner: "Materials + OR charge nurse",
    actions: [
      "Reconcile implant logs to billed HCPCS daily — not at month-end.",
      "Add a charge-capture step at case-close that requires implant/supply codes before sign-off.",
      "Flag vendors with recurring missing-charge patterns for rep accountability.",
    ],
  },
};

interface Pattern {
  lens: RecoveryLensId;
  code: string | null;
  title: string;
  count: number;
  totalRecoverable: number;
  totalAtRisk: number;
  encounters: Set<string>;
}

interface LensRollup {
  lens: RecoveryLensId;
  count: number;
  totalRecoverable: number;
  totalAtRisk: number;
  encounters: Set<string>;
  patterns: Pattern[];
}

function buildRollups(findings: RecoveryFinding[]): LensRollup[] {
  const lensMap = new Map<RecoveryLensId, LensRollup>();
  for (const f of findings) {
    // Only count what actually rolls into the headline number.
    if (!f.is_primary_in_cluster) continue;
    if (f.adversarial_verdict !== "kept") continue;
    const lens = f.lens;
    if (!LENS_PLAYBOOK[lens]) continue;
    let lr = lensMap.get(lens);
    if (!lr) {
      lr = { lens, count: 0, totalRecoverable: 0, totalAtRisk: 0, encounters: new Set(), patterns: [] };
      lensMap.set(lens, lr);
    }
    lr.count += 1;
    lr.totalRecoverable += Number(f.dollars_recoverable || 0);
    lr.totalAtRisk += Number(f.dollars_at_risk || 0);
    lr.encounters.add(f.run_id);

    const key = (f.code || f.title || "").trim().toLowerCase().slice(0, 80);
    let p = lr.patterns.find(x => ((x.code || x.title) || "").toLowerCase().slice(0, 80) === key);
    if (!p) {
      p = { lens, code: f.code, title: f.title, count: 0, totalRecoverable: 0, totalAtRisk: 0, encounters: new Set() };
      lr.patterns.push(p);
    }
    p.count += 1;
    p.totalRecoverable += Number(f.dollars_recoverable || 0);
    p.totalAtRisk += Number(f.dollars_at_risk || 0);
    p.encounters.add(f.run_id);
  }
  for (const lr of lensMap.values()) {
    lr.patterns.sort((a, b) => b.totalRecoverable - a.totalRecoverable);
    lr.patterns = lr.patterns.slice(0, 5);
  }
  return Array.from(lensMap.values()).sort((a, b) => b.totalRecoverable - a.totalRecoverable);
}

interface Props {
  findings: RecoveryFinding[];
  totalEncounters: number;
  scopeLabel?: string;
}

export function PreventionPlaybook({ findings, totalEncounters, scopeLabel }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rollups = useMemo(() => buildRollups(findings), [findings]);
  const totalRecoverable = rollups.reduce((s, r) => s + r.totalRecoverable, 0);

  const handleExport = () => {
    const lines: string[] = [];
    lines.push("# Next-Cycle Prevention Playbook");
    if (scopeLabel) lines.push(`Scope: ${scopeLabel}`);
    lines.push(`Total preventable recoverable: ${fmtMoney(totalRecoverable)}`);
    lines.push(`Encounters analyzed: ${totalEncounters}`);
    lines.push("");
    for (const lr of rollups) {
      const pb = LENS_PLAYBOOK[lr.lens];
      lines.push(`## ${LENS_LABELS[lr.lens]} — ${fmtMoney(lr.totalRecoverable)} across ${lr.encounters.size} encounters`);
      lines.push(`Owner: ${pb.owner}`);
      lines.push("Actions:");
      pb.actions.forEach(a => lines.push(`  - ${a}`));
      if (lr.patterns.length) {
        lines.push("Top recurring patterns:");
        lr.patterns.forEach(p => lines.push(`  - ${p.code ? `[${p.code}] ` : ""}${p.title} — ${fmtMoney(p.totalRecoverable)} · ${p.count}x · ${p.encounters.size} enc`));
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prevention-playbook-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (rollups.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Next-Cycle Prevention Playbook
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No kept primary findings yet. Run encounters first — the playbook builds itself from this batch's leaks.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Next-Cycle Prevention Playbook
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Where this cycle leaked, who owns the fix, and what to change before the next billing window.
              Prioritized by recoverable dollars across {totalEncounters} encounter{totalEncounters === 1 ? "" : "s"}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {rollups.map((lr, idx) => {
          const pb = LENS_PLAYBOOK[lr.lens];
          const isOpen = open[lr.lens] ?? idx < 2;
          const pct = totalRecoverable > 0 ? Math.round((lr.totalRecoverable / totalRecoverable) * 100) : 0;
          return (
            <div key={lr.lens} className="border rounded-md">
              <button
                type="button"
                onClick={() => setOpen(s => ({ ...s, [lr.lens]: !isOpen }))}
                className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/40 text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                  <span className="font-medium text-sm truncate">{LENS_LABELS[lr.lens]}</span>
                  <Badge variant="outline" className="text-[10px]">{pct}% of leak</Badge>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  <span className="text-muted-foreground">{lr.encounters.size} enc · {lr.count} findings</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(lr.totalRecoverable)}</span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t px-3 py-3 space-y-3 bg-muted/20">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Owner: </span>
                    <span className="font-medium">{pb.owner}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1.5">Do this before the next cycle:</p>
                    <ul className="space-y-1">
                      {pb.actions.map((a, i) => (
                        <li key={i} className="text-xs flex gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400 shrink-0">→</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {lr.patterns.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1.5">Top recurring patterns this cycle:</p>
                      <div className="space-y-1">
                        {lr.patterns.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-xs border rounded px-2 py-1 bg-background">
                            <div className="min-w-0 flex items-center gap-2">
                              {p.code && <Badge variant="secondary" className="text-[9px] font-mono">{p.code}</Badge>}
                              <span className="truncate">{p.title}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-muted-foreground">{p.count}x · {p.encounters.size} enc</span>
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmtMoney(p.totalRecoverable)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}