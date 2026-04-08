import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  type GovernanceAssessment,
  type GovernedFinding,
  GOVERNED_SEVERITY_CONFIG,
} from '@/lib/caseGovernance';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Info,
  ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useState } from 'react';

interface GovernancePanelProps {
  assessment: GovernanceAssessment;
  compact?: boolean;
}

export function GovernancePanel({ assessment, compact }: GovernancePanelProps) {
  const [showFindings, setShowFindings] = useState(false);
  const { routingDecision, contradictionDowngrade } = assessment;

  const routingColor = {
    automated_approve: 'text-consensus',
    automated_review: 'text-info-blue',
    escalate: 'text-disagreement',
    human_audit: 'text-violation',
  }[routingDecision.outcome];

  const routingBg = {
    automated_approve: 'bg-consensus/5 border-consensus/30',
    automated_review: 'bg-info-blue/5 border-info-blue/30',
    escalate: 'bg-disagreement/5 border-disagreement/30',
    human_audit: 'bg-violation/5 border-violation/30',
  }[routingDecision.outcome];

  return (
    <div className="space-y-3">
      {/* ─── Routing Decision Card ─── */}
      <Card className={cn('border-l-4', routingBg)}>
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <Shield className={cn('h-4 w-4 shrink-0 mt-0.5', routingColor)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className={cn('text-sm font-semibold', routingColor)}>
                  {routingDecision.outcomeLabel}
                </p>
                <Badge variant="outline" className="text-[10px]">
                  Governance v2
                </Badge>
              </div>

              {/* Signal Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                {routingDecision.factors.map((factor, i) => (
                  <div key={i} className="rounded-md border bg-background p-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {factor.status === 'pass' && <CheckCircle className="h-3 w-3 text-consensus shrink-0" />}
                      {factor.status === 'warn' && <AlertTriangle className="h-3 w-3 text-disagreement shrink-0" />}
                      {factor.status === 'fail' && <XCircle className="h-3 w-3 text-violation shrink-0" />}
                      <span className="text-[10px] font-medium text-foreground truncate">{factor.signal}</span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">{factor.value}</p>
                  </div>
                ))}
              </div>

              {/* Explanation bullets */}
              {!compact && (
                <div className="mt-3 space-y-1">
                  {routingDecision.factors
                    .filter(f => f.status !== 'pass')
                    .map((f, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                        <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60" />
                        {f.explanation}
                      </p>
                    ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Separated Metrics ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <MetricCard
          label="Claim Risk"
          value={`${assessment.claimRiskScore}/100`}
          sublabel={assessment.claimRiskLevel}
          color={assessment.claimRiskScore >= 75 ? 'text-violation' : assessment.claimRiskScore >= 55 ? 'text-disagreement' : 'text-consensus'}
        />
        <MetricCard
          label="Automation Confidence"
          value={`${assessment.automationConfidence}%`}
          sublabel={assessment.automationConfidenceLabel}
          color={assessment.automationConfidence >= 60 ? 'text-consensus' : assessment.automationConfidence >= 40 ? 'text-disagreement' : 'text-violation'}
        />
        <MetricCard
          label="Evidence Sufficiency"
          value={`${Math.round(assessment.evidenceSufficiency)}%`}
          sublabel={assessment.evidenceSufficiency >= 70 ? 'Sufficient' : assessment.evidenceSufficiency >= 50 ? 'Partial' : 'Insufficient'}
          color={assessment.evidenceSufficiency >= 70 ? 'text-consensus' : assessment.evidenceSufficiency >= 50 ? 'text-disagreement' : 'text-violation'}
        />
        <MetricCard
          label="Consensus Integrity"
          value={`${assessment.consensusIntegrity}%`}
          sublabel={assessment.consensusIntegrityLabel}
          color={assessment.consensusIntegrity >= 70 ? 'text-consensus' : assessment.consensusIntegrity >= 50 ? 'text-disagreement' : 'text-violation'}
        />
        <MetricCard
          label="Findings"
          value={`${assessment.confirmedCriticalCount} confirmed`}
          sublabel={`${assessment.pendingVerificationCount} pending`}
          color={assessment.confirmedCriticalCount > 0 ? 'text-violation' : 'text-consensus'}
        />
      </div>

      {/* ─── Contradiction Downgrades ─── */}
      {contradictionDowngrade.explanations.length > 0 && (
        <Card className="border-disagreement/20">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-xs flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-disagreement" />
              Contradiction-Aware Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-1.5">
              {contradictionDowngrade.explanations.map((exp, i) => (
                <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-disagreement/60" />
                  {exp}
                </p>
              ))}
            </div>
            {contradictionDowngrade.mandatoryHumanReview && (
              <div className="mt-2 rounded-md border border-violation/30 bg-violation/5 p-2">
                <p className="text-[11px] font-medium text-violation">
                  ⚠ Mandatory human review triggered by contradiction analysis
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Governed Findings ─── */}
      {assessment.governedFindings.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <button
              onClick={() => setShowFindings(!showFindings)}
              className="flex items-center gap-2 w-full text-left"
            >
              <CardTitle className="text-xs flex items-center gap-2 flex-1">
                <Shield className="h-3.5 w-3.5 text-accent" />
                Governed Finding Severity ({assessment.governedFindings.length})
                {assessment.pendingVerificationCount > 0 && (
                  <Badge variant="outline" className="text-[9px] text-disagreement border-disagreement/30">
                    {assessment.pendingVerificationCount} reclassified
                  </Badge>
                )}
              </CardTitle>
              {showFindings ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </CardHeader>
          {showFindings && (
            <CardContent className="pb-3">
              <div className="space-y-2">
                {assessment.governedFindings.map((gf, i) => {
                  const config = GOVERNED_SEVERITY_CONFIG[gf.governedSeverity];
                  return (
                    <div key={i} className={cn('rounded-md border p-2.5', config.bgClass, config.borderClass)}>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className="font-mono text-[10px]">{gf.violation.code}</Badge>
                        <Badge variant="outline" className={cn('text-[10px]', config.colorClass, config.borderClass)}>
                          {config.label}
                        </Badge>
                        {gf.downgradeReason && gf.originalSeverity === 'critical' && (
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">
                            was: critical
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-foreground">{gf.violation.description}</p>
                      {gf.downgradeReason && (
                        <p className="text-[10px] text-muted-foreground mt-1 italic">
                          ↳ {gf.downgradeReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

function MetricCard({ label, value, sublabel, color }: {
  label: string; value: string; sublabel: string; color: string;
}) {
  return (
    <div className="rounded-md border bg-card p-2.5 text-center">
      <p className={cn('text-sm font-semibold font-mono', color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
      <p className={cn('text-[9px] capitalize', color)}>{sublabel}</p>
    </div>
  );
}
