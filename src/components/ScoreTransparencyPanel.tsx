import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, ShieldAlert, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GovernanceAssessment } from '@/lib/caseGovernance';
import type { CaseSummarySignals } from '@/lib/caseIntelligence';

interface ScoreTransparencyPanelProps {
  governance: GovernanceAssessment;
  signals: CaseSummarySignals;
}

// ─── Score Definitions ───

interface ScoreExplainer {
  label: string;
  value: number | string;
  unit: string;
  definition: string;
  contributing: string[];
  limiting: string[];
  thresholds: { label: string; range: string; active: boolean }[];
  statusColor: string;
}

function buildExplainers(gov: GovernanceAssessment, sig: CaseSummarySignals): ScoreExplainer[] {
  const risk = gov.claimRiskScore;
  const confidence = gov.automationConfidence;
  const evidence = gov.evidenceSufficiency;
  const consensus = gov.consensusIntegrity;

  // ── Claim Risk Score ──
  const riskContributing: string[] = [];
  const riskLimiting: string[] = [];
  if (gov.confirmedCriticalCount > 0) riskContributing.push(`${gov.confirmedCriticalCount} confirmed critical finding(s) (+${gov.confirmedCriticalCount * 30} pts)`);
  if (gov.pendingVerificationCount > 0) riskContributing.push(`${gov.pendingVerificationCount} pending verification finding(s) (+${gov.pendingVerificationCount * 15} pts)`);
  if (gov.documentationGapCount > 0) riskContributing.push(`${gov.documentationGapCount} documentation gap(s) contributing to score`);
  if (sig.consensusScore < 60) riskContributing.push(`Low consensus (${sig.consensusScore}%) adds divergence penalty`);
  if (risk < 35) riskLimiting.push('No critical findings driving score upward');
  if (gov.pendingVerificationCount > 0) riskLimiting.push('Pending findings scored at half weight (15 pts vs 30 pts)');
  if (sig.dataCompleteness < 70) riskLimiting.push(`Data completeness at ${sig.dataCompleteness}% — score may not reflect full picture`);

  // ── Automation Confidence ──
  const confContributing: string[] = [];
  const confLimiting: string[] = [];
  if (confidence >= 70) confContributing.push('Base engine confidence is adequate');
  if (gov.contradictionDowngrade.automationConfidenceReduction > 0) {
    confLimiting.push(`Contradictions reduced confidence by ${gov.contradictionDowngrade.automationConfidenceReduction} points`);
  }
  if (gov.contradictionDowngrade.mandatoryHumanReview) confLimiting.push('Contradiction burden triggered mandatory human review');
  if (confidence < 55) confLimiting.push('Below automation floor (55%) — automated processing not recommended');
  if (gov.pendingVerificationCount > 1) confLimiting.push(`${gov.pendingVerificationCount} unverified critical findings reduce confidence`);

  // ── Evidence Sufficiency ──
  const evContributing: string[] = [];
  const evLimiting: string[] = [];
  if (evidence >= 50) evContributing.push('Documentation meets minimum threshold');
  if (sig.dataCompleteness >= 80) evContributing.push(`Data completeness at ${sig.dataCompleteness}%`);
  if (evidence < 50) evLimiting.push('Below sufficiency floor (50%) — insufficient for automated determination');
  if (sig.dataCompleteness < 70) evLimiting.push(`${sig.dataCompleteness}% data completeness — key records may be missing`);
  if (gov.documentationGapCount > 0) evLimiting.push(`${gov.documentationGapCount} documentation gap(s) identified`);

  // ── Consensus Integrity ──
  const ciContributing: string[] = [];
  const ciLimiting: string[] = [];
  if (sig.consensusScore >= 75) ciContributing.push('Analysis models show strong pre-adjustment agreement');
  if (consensus >= 70) ciContributing.push('Consensus survived contradiction adjustments');
  if (gov.contradictionDowngrade.consensusIntegrityReduction > 0) {
    ciLimiting.push(`Contradictions reduced consensus by ${gov.contradictionDowngrade.consensusIntegrityReduction} points`);
  }
  if (consensus < 45) ciLimiting.push('Below consensus floor (45%) — model perspectives diverge significantly');

  return [
    {
      label: 'Claim Risk Score',
      value: risk,
      unit: '/100',
      definition: 'Aggregate measure of compliance risk based on confirmed findings, pending findings, and model agreement.',
      contributing: riskContributing,
      limiting: riskLimiting,
      thresholds: [
        { label: 'Low', range: '0–34', active: risk < 35 },
        { label: 'Medium', range: '35–54', active: risk >= 35 && risk < 55 },
        { label: 'High', range: '55–74', active: risk >= 55 && risk < 75 },
        { label: 'Critical', range: '75–100', active: risk >= 75 },
      ],
      statusColor: risk >= 75 ? 'text-destructive' : risk >= 55 ? 'text-violation' : risk >= 35 ? 'text-disagreement' : 'text-consensus',
    },
    {
      label: 'Automation Confidence',
      value: confidence,
      unit: '%',
      definition: 'Engine\'s confidence in its own output after contradiction penalties are applied.',
      contributing: confContributing,
      limiting: confLimiting,
      thresholds: [
        { label: 'High', range: '80%+', active: confidence >= 80 },
        { label: 'Moderate', range: '60–79%', active: confidence >= 60 && confidence < 80 },
        { label: 'Low', range: '40–59%', active: confidence >= 40 && confidence < 60 },
        { label: 'Very Low', range: '<40%', active: confidence < 40 },
      ],
      statusColor: confidence >= 80 ? 'text-consensus' : confidence >= 60 ? 'text-info-blue' : confidence >= 40 ? 'text-disagreement' : 'text-violation',
    },
    {
      label: 'Evidence Sufficiency',
      value: Math.round(gov.evidenceSufficiency),
      unit: '%',
      definition: 'Completeness of supporting documentation relative to what is needed for a defensible determination.',
      contributing: evContributing,
      limiting: evLimiting,
      thresholds: [
        { label: 'Sufficient', range: '70%+', active: evidence >= 70 },
        { label: 'Marginal', range: '50–69%', active: evidence >= 50 && evidence < 70 },
        { label: 'Insufficient', range: '<50%', active: evidence < 50 },
      ],
      statusColor: evidence >= 70 ? 'text-consensus' : evidence >= 50 ? 'text-disagreement' : 'text-violation',
    },
    {
      label: 'Consensus Integrity',
      value: consensus,
      unit: '%',
      definition: 'Quality of agreement across analysis perspectives after contradiction adjustments.',
      contributing: ciContributing,
      limiting: ciLimiting,
      thresholds: [
        { label: 'Strong', range: '85%+', active: consensus >= 85 },
        { label: 'Adequate', range: '70–84%', active: consensus >= 70 && consensus < 85 },
        { label: 'Moderate', range: '50–69%', active: consensus >= 50 && consensus < 70 },
        { label: 'Weak', range: '<50%', active: consensus < 50 },
      ],
      statusColor: consensus >= 70 ? 'text-consensus' : consensus >= 50 ? 'text-info-blue' : 'text-violation',
    },
  ];
}

// ─── Action Recommendation Logic ───

interface ActionExplainer {
  action: string;
  label: string;
  rationale: string;
  colorClass: string;
}

const ACTION_LABELS: Record<string, { label: string; colorClass: string }> = {
  automated_approve: { label: 'Approve / Likely Supportable', colorClass: 'text-consensus' },
  automated_review: { label: 'Support with Packet', colorClass: 'text-info-blue' },
  escalate: { label: 'Request Additional Documentation', colorClass: 'text-disagreement' },
  human_audit: { label: 'Route to Human Audit', colorClass: 'text-violation' },
};

function buildActionExplainer(gov: GovernanceAssessment): ActionExplainer {
  const outcome = gov.routingDecision.outcome;
  const meta = ACTION_LABELS[outcome] || { label: outcome, colorClass: 'text-foreground' };

  const failedFactors = gov.routingDecision.factors.filter(f => f.status === 'fail');
  const warnFactors = gov.routingDecision.factors.filter(f => f.status === 'warn');

  let rationale: string;
  if (failedFactors.length > 0) {
    rationale = `Driven by: ${failedFactors.map(f => f.signal).join(', ')}. ${failedFactors[0].explanation}`;
  } else if (warnFactors.length > 0) {
    rationale = `Flagged signals: ${warnFactors.map(f => f.signal).join(', ')}. Case requires additional validation before automated processing.`;
  } else {
    rationale = 'All routing signals pass thresholds. Case eligible for automated processing.';
  }

  return { action: outcome, label: meta.label, rationale, colorClass: meta.colorClass };
}

// ─── Component ───

export function ScoreTransparencyPanel({ governance, signals }: ScoreTransparencyPanelProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const explainers = useMemo(() => buildExplainers(governance, signals), [governance, signals]);
  const actionExplainer = useMemo(() => buildActionExplainer(governance), [governance]);

  const contradictionCount = governance.contradictionDowngrade.explanations.length;
  const hasEscalation = ['human_audit', 'escalate'].includes(governance.routingDecision.outcome);

  return (
    <Card className="border bg-card">
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Score Transparency</span>
                <Badge variant="outline" className="text-[9px]">
                  {explainers.length} scores
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {/* Compact score summary */}
                <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
                  {explainers.map(e => (
                    <span key={e.label} className={cn('font-mono font-semibold', e.statusColor)}>
                      {e.value}{e.unit === '%' ? '%' : ''}
                    </span>
                  ))}
                </div>
                {detailsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* ── Score Explainers ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {explainers.map(score => (
                <div key={score.label} className="rounded-md border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{score.label}</span>
                    <span className={cn('text-lg font-mono font-bold', score.statusColor)}>
                      {score.value}<span className="text-xs font-normal text-muted-foreground">{score.unit}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{score.definition}</p>

                  {/* Thresholds */}
                  <div className="flex flex-wrap gap-1">
                    {score.thresholds.map(t => (
                      <Badge
                        key={t.label}
                        variant="outline"
                        className={cn(
                          'text-[9px]',
                          t.active ? 'bg-foreground/10 text-foreground font-semibold' : 'text-muted-foreground/60'
                        )}
                      >
                        {t.label} ({t.range})
                      </Badge>
                    ))}
                  </div>

                  {/* Contributing factors */}
                  {score.contributing.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Contributing</p>
                      {score.contributing.map((c, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                          <CheckCircle className="h-3 w-3 text-consensus shrink-0 mt-0.5" />
                          {c}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Limiting factors */}
                  {score.limiting.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Limiting</p>
                      {score.limiting.map((l, i) => (
                        <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1">
                          <AlertTriangle className="h-3 w-3 text-disagreement shrink-0 mt-0.5" />
                          {l}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ── Final Action Recommendation ── */}
            <div className="rounded-md border p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Final Action Recommendation</span>
              </div>
              <p className={cn('text-sm font-semibold', actionExplainer.colorClass)}>
                {actionExplainer.label}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{actionExplainer.rationale}</p>
            </div>

            {/* ── Score Details ── */}
            <div className="rounded-md border bg-muted/10 p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Score Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                {/* Findings summary */}
                <div className="space-y-0.5">
                  <p className="font-medium text-muted-foreground">Findings</p>
                  <p>Confirmed critical: <span className="font-semibold text-foreground">{governance.confirmedCriticalCount}</span></p>
                  <p>Pending verification: <span className="font-semibold text-foreground">{governance.pendingVerificationCount}</span></p>
                  <p>Documentation gaps: <span className="font-semibold text-foreground">{governance.documentationGapCount}</span></p>
                </div>

                {/* Contradictions */}
                <div className="space-y-0.5">
                  <p className="font-medium text-muted-foreground">Contradictions</p>
                  {contradictionCount > 0 ? (
                    <>
                      <p>{contradictionCount} contradiction adjustment(s) applied</p>
                      <p>Consensus reduced by: <span className="font-semibold text-foreground">{governance.contradictionDowngrade.consensusIntegrityReduction} pts</span></p>
                      <p>Confidence reduced by: <span className="font-semibold text-foreground">{governance.contradictionDowngrade.automationConfidenceReduction} pts</span></p>
                    </>
                  ) : (
                    <p className="text-consensus">No contradictions detected</p>
                  )}
                </div>

                {/* Evidence completeness */}
                <div className="space-y-0.5">
                  <p className="font-medium text-muted-foreground">Evidence Completeness</p>
                  <p>Data completeness: <span className="font-semibold text-foreground">{signals.dataCompleteness}%</span></p>
                  <p>Evidence sufficiency: <span className="font-semibold text-foreground">{Math.round(governance.evidenceSufficiency)}%</span></p>
                </div>

                {/* Metadata dependency */}
                <div className="space-y-0.5">
                  <p className="font-medium text-muted-foreground">Metadata Dependencies</p>
                  {governance.governedFindings.some(f => f.dependsOnMissingMetadata) ? (
                    <>
                      <p>{governance.governedFindings.filter(f => f.dependsOnMissingMetadata).length} finding(s) depend on missing metadata</p>
                      <p className="text-disagreement">Severity classification adjusted</p>
                    </>
                  ) : (
                    <p className="text-consensus">No metadata dependencies</p>
                  )}
                </div>
              </div>

              {/* Escalation reasons */}
              {hasEscalation && (
                <div className="mt-2 pt-2 border-t space-y-0.5">
                  <p className="text-[11px] font-medium text-violation">Escalation Reasons</p>
                  {governance.contradictionDowngrade.explanations.map((e, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground">• {e}</p>
                  ))}
                  {governance.routingDecision.factors.filter(f => f.status === 'fail').map((f, i) => (
                    <p key={`f-${i}`} className="text-[10px] text-muted-foreground">• {f.signal}: {f.explanation}</p>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[10px] text-muted-foreground italic">
              Scores are operational guidance only — not legal determinations. High risk does not equal automatic denial.
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
