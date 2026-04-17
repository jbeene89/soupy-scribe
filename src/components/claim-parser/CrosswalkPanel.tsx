// Crosswalk Audit panel — strict auditor verdict for a parsed claim + clinical note.
// Sits next to the 5-perspective panel inside each parsed claim tab.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, AlertCircle, RefreshCw, ShieldCheck, FileSearch, Stethoscope, ClipboardList,
  Clock, AlertTriangle, ListChecks, Gavel, FileText, Pill, Brain, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type CrosswalkVerdict, type ParsedNote, DECISION_META, strengthTone, priorityTone,
} from "@/lib/crosswalkTypes";
import { NoteDropzone, type IngestedNote } from "./NoteDropzone";

interface CrosswalkPanelProps {
  note: IngestedNote | null;
  parsedNote: ParsedNote | null;
  verdict: CrosswalkVerdict | null;
  loading: boolean;
  error?: string | null;
  onSetNote: (note: IngestedNote) => void;
  onClearNote: () => void;
  onRun: () => void;
  onExportAppealPacket: () => void;
}

export function CrosswalkPanel({
  note, parsedNote, verdict, loading, error,
  onSetNote, onClearNote, onRun, onExportAppealPacket,
}: CrosswalkPanelProps) {
  const canRun = !!note && !loading;
  const decisionMeta = verdict ? DECISION_META[verdict.pre_submission_decision.decision] : null;
  const showAppealButton = verdict?.appeal_readiness.applicable && verdict.appeal_readiness.strength !== "not_applicable";

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Crosswalk Audit · Claim ↔ Clinical Note
          </CardTitle>
          <div className="flex gap-2">
            {showAppealButton && (
              <Button size="sm" variant="outline" onClick={onExportAppealPacket} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Appeal Packet PDF
              </Button>
            )}
            <Button
              size="sm"
              variant={verdict ? "outline" : "default"}
              onClick={onRun}
              disabled={!canRun}
              className="gap-1.5"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {loading ? "Auditing…" : verdict ? "Re-run audit" : "Run crosswalk"}
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Strict auditor: only documented evidence counts. Compares the billed claim against the clinical note.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* STEP 0 — Note attachment */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Clinical note for this claim</p>
          <NoteDropzone note={note} onSet={onSetNote} onClear={onClearNote} busy={loading} />
          {!note && (
            <p className="text-[11px] text-muted-foreground italic">
              The crosswalk needs the actual clinical note to compare against. Drop the session note, intake, or progress note here.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && !verdict && (
          <div className="py-6 text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Strict auditor is reading the note and comparing it to the claim…</p>
          </div>
        )}

        {/* STEP 7 — Decision banner */}
        {verdict && decisionMeta && (
          <div className={cn("rounded-md border px-3 py-3 space-y-1.5", decisionMeta.tone)}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[10px] font-semibold", decisionMeta.badge)}>
                {decisionMeta.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono">
                {Math.round((verdict.pre_submission_decision.confidence || 0) * 100)}% confidence
              </Badge>
            </div>
            <p className="text-sm font-semibold text-foreground">{verdict.pre_submission_decision.headline}</p>
            <p className="text-xs text-foreground/90">{verdict.pre_submission_decision.why}</p>
          </div>
        )}

        {/* Note quality banner: copy-forward / internal contradictions */}
        {parsedNote && (parsedNote.copy_forward_indicators?.length > 0 || parsedNote.internal_contradictions?.length > 0) && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 space-y-1">
            {parsedNote.copy_forward_indicators?.length > 0 && (
              <p className="text-[11px] text-amber-700 flex gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span><strong>Copy-forward signals detected:</strong> {parsedNote.copy_forward_indicators.slice(0, 2).join(" · ")}</span>
              </p>
            )}
            {parsedNote.internal_contradictions?.length > 0 && (
              <p className="text-[11px] text-amber-700 flex gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span><strong>{parsedNote.internal_contradictions.length} internal note contradiction(s)</strong> — see contradictions section.</span>
              </p>
            )}
          </div>
        )}

        {verdict && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* STEP 1 — Service match */}
            <Section icon={FileSearch} title="Service Validation">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant="outline" className={cn("text-[10px]", strengthTone(verdict.service_match.verdict))}>
                  {verdict.service_match.verdict.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">{verdict.service_match.cpt_under_review}</Badge>
              </div>
              <p className="text-[11px] text-foreground/90">{verdict.service_match.why}</p>
              {verdict.service_match.modifier_issues.length > 0 && (
                <div className="mt-1.5">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Modifier issues</p>
                  <ul className="space-y-0.5">
                    {verdict.service_match.modifier_issues.map((m, i) => (
                      <li key={i} className="text-[11px] text-foreground">• {m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>

            {/* STEP 3 — Medical necessity */}
            <Section icon={Stethoscope} title="Medical Necessity">
              <Badge variant="outline" className={cn("text-[10px] mb-1.5", strengthTone(verdict.medical_necessity.verdict))}>
                {verdict.medical_necessity.verdict}
              </Badge>
              <div className="grid grid-cols-2 gap-1 text-[10px] mb-1.5">
                <Indicator label="Severity" ok={verdict.medical_necessity.symptom_severity_documented} />
                <Indicator label="Impairment" ok={verdict.medical_necessity.functional_impairment_documented} />
                <Indicator label="Risk level" ok={verdict.medical_necessity.risk_level_documented} />
                <Indicator label="Tx justified" ok={verdict.medical_necessity.treatment_justification_documented} />
              </div>
              <p className="text-[11px] text-foreground/90">{verdict.medical_necessity.why}</p>
              {verdict.medical_necessity.missing_elements.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {verdict.medical_necessity.missing_elements.map((m, i) => (
                    <li key={i} className="text-[10px] text-destructive">• Missing: {m}</li>
                  ))}
                </ul>
              )}
            </Section>

            {/* STEP 5 — Time */}
            <Section icon={Clock} title="Time Validation">
              <Badge variant="outline" className={cn("text-[10px] mb-1.5",
                verdict.time_support.verdict === "valid" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
                : verdict.time_support.verdict === "questionable" ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                : verdict.time_support.verdict === "unsupported" ? "text-destructive bg-destructive/10 border-destructive/30"
                : "text-muted-foreground bg-muted border-border"
              )}>
                {verdict.time_support.verdict.replace("_", " ")}
              </Badge>
              <p className="text-[11px] text-foreground/90">
                Time statement {verdict.time_support.time_statement_present ? "present" : "absent"}.
                {verdict.time_support.documented_minutes != null && ` Documented: ${verdict.time_support.documented_minutes} min.`}
                {verdict.time_support.required_minutes_for_billed_code != null && ` Required: ${verdict.time_support.required_minutes_for_billed_code} min.`}
              </p>
              {verdict.time_support.issues.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {verdict.time_support.issues.map((m, i) => (
                    <li key={i} className="text-[10px] text-destructive">• {m}</li>
                  ))}
                </ul>
              )}
            </Section>

            {/* STEP 4 — Med management */}
            <Section icon={Pill} title="Medication Management">
              {!verdict.med_management_support.applies ? (
                <p className="text-[11px] text-muted-foreground italic">Not applicable — no E/M or med-management code billed.</p>
              ) : (
                <>
                  <Badge variant="outline" className={cn("text-[10px] mb-1.5",
                    verdict.med_management_support.verdict === "strong" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
                    : verdict.med_management_support.verdict === "moderate" ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                    : "text-destructive bg-destructive/10 border-destructive/30"
                  )}>
                    {verdict.med_management_support.verdict}
                  </Badge>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <Indicator label="Reviewed" ok={!!verdict.med_management_support.medication_review_documented} />
                    <Indicator label="Changes documented" ok={!!verdict.med_management_support.changes_documented} />
                    <Indicator label="Rationale" ok={!!verdict.med_management_support.rationale_documented} />
                    <Indicator label="Side effects" ok={!!verdict.med_management_support.side_effects_documented} />
                    <Indicator label="Adherence" ok={!!verdict.med_management_support.adherence_documented} />
                  </div>
                  {verdict.med_management_support.missing_elements.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {verdict.med_management_support.missing_elements.map((m, i) => (
                        <li key={i} className="text-[10px] text-destructive">• Missing: {m}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </Section>
          </div>
        )}

        {/* STEP 2 — Diagnosis support matrix (full width) */}
        {verdict && verdict.diagnosis_support_matrix.length > 0 && (
          <Section icon={ClipboardList} title="Diagnosis Support Matrix" full>
            <div className="space-y-2">
              {verdict.diagnosis_support_matrix.map((dx, i) => (
                <div key={i} className="rounded-md border bg-card px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">{dx.diagnosis}</Badge>
                    <Badge variant="outline" className={cn("text-[10px]", strengthTone(dx.support_strength))}>
                      {dx.support_strength}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-emerald-600 mb-0.5">Supported by</p>
                      {dx.supported_by.length > 0 ? (
                        <ul className="space-y-0.5">{dx.supported_by.map((s, j) => <li key={j} className="text-[10px] text-foreground">• {s}</li>)}</ul>
                      ) : <p className="text-[10px] text-muted-foreground italic">Nothing in note</p>}
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-destructive mb-0.5">Missing support</p>
                      {dx.missing_support.length > 0 ? (
                        <ul className="space-y-0.5">{dx.missing_support.map((s, j) => <li key={j} className="text-[10px] text-foreground">• {s}</li>)}</ul>
                      ) : <p className="text-[10px] text-muted-foreground italic">—</p>}
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-amber-600 mb-0.5">Contradictions</p>
                      {dx.contradictions.length > 0 ? (
                        <ul className="space-y-0.5">{dx.contradictions.map((s, j) => <li key={j} className="text-[10px] text-foreground">• {s}</li>)}</ul>
                      ) : <p className="text-[10px] text-muted-foreground italic">—</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* STEP 6 — Contradictions */}
        {verdict && verdict.contradictions.length > 0 && (
          <Section icon={AlertTriangle} title="Contradictions" full>
            <div className="space-y-1.5">
              {verdict.contradictions.map((c, i) => (
                <div key={i} className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[9px] font-mono">{c.type.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className={cn("text-[9px]",
                      c.severity === "high" ? "border-destructive/40 text-destructive"
                      : c.severity === "medium" ? "border-amber-500/40 text-amber-600"
                      : "border-muted-foreground/40 text-muted-foreground"
                    )}>{c.severity}</Badge>
                  </div>
                  <p className="text-[11px] text-foreground"><strong>A:</strong> {c.statement_a}</p>
                  <p className="text-[11px] text-foreground"><strong>B:</strong> {c.statement_b}</p>
                  <p className="text-[10px] text-muted-foreground italic mt-0.5">{c.why}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* STEP 8 — Action checklist */}
        {verdict && verdict.actions.length > 0 && (
          <Section icon={ListChecks} title="Fix-It Action Checklist" full>
            <ul className="space-y-1.5">
              {verdict.actions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2">
                  <Badge variant="outline" className={cn("text-[9px] shrink-0", priorityTone(a.priority))}>
                    {a.priority}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">{a.action}</p>
                    <p className="text-[10px] text-muted-foreground">Issue: {a.issue}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* STEP 9 — Appeal readiness */}
        {verdict?.appeal_readiness.applicable && (
          <Section icon={Gavel} title="Appeal Readiness" full>
            <div className="flex items-center gap-2 mb-1.5">
              <Badge variant="outline" className={cn("text-[10px]",
                verdict.appeal_readiness.strength === "strong" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
                : verdict.appeal_readiness.strength === "moderate" ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
                : "text-destructive bg-destructive/10 border-destructive/30"
              )}>
                {verdict.appeal_readiness.strength} appeal
              </Badge>
            </div>
            {verdict.appeal_readiness.argument && (
              <p className="text-[11px] text-foreground mb-2"><strong>Argument:</strong> {verdict.appeal_readiness.argument}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-emerald-600 mb-0.5">Evidence to cite</p>
                {verdict.appeal_readiness.evidence_to_cite.length > 0 ? (
                  <ul className="space-y-0.5">{verdict.appeal_readiness.evidence_to_cite.map((s, j) => <li key={j} className="text-[10px] text-foreground">• {s}</li>)}</ul>
                ) : <p className="text-[10px] text-muted-foreground italic">—</p>}
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-destructive mb-0.5">Documentation gaps</p>
                {verdict.appeal_readiness.what_is_missing.length > 0 ? (
                  <ul className="space-y-0.5">{verdict.appeal_readiness.what_is_missing.map((s, j) => <li key={j} className="text-[10px] text-foreground">• {s}</li>)}</ul>
                ) : <p className="text-[10px] text-muted-foreground italic">—</p>}
              </div>
            </div>
          </Section>
        )}

        {!verdict && !loading && !error && note && (
          <p className="text-xs text-muted-foreground italic">Note attached. Click "Run crosswalk" to start the strict audit.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ icon: Icon, title, children, full }: { icon: any; title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn("rounded-md border bg-card px-3 py-2.5 space-y-1.5", full && "md:col-span-2")}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Indicator({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn(
        "h-2 w-2 rounded-full shrink-0",
        ok ? "bg-emerald-500" : "bg-destructive"
      )} />
      <span className="text-foreground/80">{label}</span>
    </div>
  );
}
