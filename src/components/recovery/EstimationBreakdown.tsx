import { useState } from "react";
import { Calculator } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { LENS_LABELS, type RecoveryFinding } from "@/lib/recoveryService";

function fmtMoney(n: number | null | undefined) {
  return Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtNum(n: number | null | undefined, digits = 2) {
  const v = Number(n || 0);
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

interface Props {
  finding: RecoveryFinding;
}

/**
 * Drill-down dialog that explains exactly how a finding's dollar estimate
 * was derived: method, reference rate, code-to-rate mapping, units,
 * multipliers, formula, and stated assumptions. Falls back gracefully when
 * older findings lack an estimation breakdown (the engine started capturing
 * this in the recovery-engine schema upgrade).
 */
export function EstimationBreakdown({ finding }: Props) {
  const [open, setOpen] = useState(false);
  const est = (finding.metadata && (finding.metadata as any).estimation) || null;
  const hasBreakdown = !!(
    est &&
    (est.method || est.formula || est.reference_source || (est.assumptions || []).length)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          title="How was this dollar estimate computed?"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary px-1.5 py-0.5 rounded border border-border hover:border-primary transition-colors"
        >
          <Calculator className="h-3 w-3" />
          How $?
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Dollar Estimate Breakdown
          </DialogTitle>
          <DialogDescription className="text-xs">
            {LENS_LABELS[finding.lens] || finding.lens} · {finding.title}
          </DialogDescription>
        </DialogHeader>

        {/* Header bar */}
        <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-3 text-xs">
          <div>
            <div className="text-muted-foreground">$ Recoverable</div>
            <div className="font-mono text-base text-emerald-600 dark:text-emerald-400">
              {fmtMoney(finding.dollars_recoverable)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">$ At Risk</div>
            <div className="font-mono text-base text-amber-600">
              {fmtMoney(finding.dollars_at_risk)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Confidence</div>
            <div className="mt-0.5">
              <Badge variant={finding.confidence === "high" ? "default" : finding.confidence === "medium" ? "secondary" : "outline"}>
                {finding.confidence}
              </Badge>
            </div>
          </div>
        </div>

        {!hasBreakdown ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
              No structured breakdown stored for this finding.
            </div>
            This finding was produced before the engine started capturing per-finding
            reference rates and assumptions. Re-run the encounter to capture a full
            estimation trace. The dollar figure shown remains the model's conservative
            estimate based on the code, payer, and evidence excerpt below.
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            {/* Method + source */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estimation method" value={est.method || "—"} />
              <Field label="Reference source" value={est.reference_source || "—"} />
            </div>

            {/* Code -> rate mapping */}
            <div className="rounded-md border bg-card p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Code → rate mapping
              </div>
              <div className="grid grid-cols-4 gap-2 font-mono text-xs">
                <div>
                  <div className="text-[9px] text-muted-foreground">Code</div>
                  <div>{finding.code || "—"}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground">Rate / weight</div>
                  <div>{est.reference_rate ? fmtNum(est.reference_rate) : "—"}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground">Units</div>
                  <div>{fmtNum(est.units)}</div>
                </div>
                <div>
                  <div className="text-[9px] text-muted-foreground">Multiplier</div>
                  <div>{fmtNum(est.multiplier, 3)}</div>
                </div>
              </div>
            </div>

            {/* Formula */}
            {est.formula && (
              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Formula
                </div>
                <code className="font-mono text-xs whitespace-pre-wrap">{est.formula}</code>
              </div>
            )}

            {/* Assumptions */}
            {(est.assumptions || []).length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Reference assumptions
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">
                  {est.assumptions.map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Evidence quote */}
        {finding.evidence_snippet && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Evidence excerpt (verbatim)
            </div>
            <blockquote className="border-l-2 border-primary/40 pl-3 py-1 text-xs italic text-foreground/80">
              "{finding.evidence_snippet}"
            </blockquote>
          </div>
        )}

        <div className="rounded-md border border-dashed p-2 text-[10px] text-muted-foreground leading-relaxed">
          Dollar estimates are model-derived using public reference rates (CMS MPFS,
          NCCI/MUE, HCC v24, payer policies). They are conservative directional
          numbers — replace the reference rate with your contracted fee schedule for
          contract-grounded figures.
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
        {label}
      </div>
      <div className="text-xs">{value}</div>
    </div>
  );
}