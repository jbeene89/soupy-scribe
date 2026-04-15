import type { AuditCase } from '@/lib/types';
import type { EvidenceSufficiency, Contradiction, ConfidenceFloorEvent } from '@/lib/soupyEngineService';
import { AIRoleCard } from '@/components/AIRoleCard';
import { RiskIndicator } from '@/components/RiskIndicator';
import { ConsensusMeter } from '@/components/ConsensusMeter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Eye, AlertTriangle, CheckCircle, XCircle, ArrowRight, Shield,
  Clock, Info,
} from 'lucide-react';
import { useMemo } from 'react';
import {
  deriveCaseSignals, deriveActionPath, ACTION_PATH_CONFIG,
} from '@/lib/caseIntelligence';

interface PayerPerspectiveViewProps {
  auditCase: AuditCase;
  evidenceSuff: EvidenceSufficiency | null;
  contradictions: Contradiction[];
  floorEvents: ConfidenceFloorEvent[];
}

export function PayerPerspectiveView({
  auditCase,
  evidenceSuff,
  contradictions,
  floorEvents,
}: PayerPerspectiveViewProps) {
  const hasAnalyses = auditCase.analyses.length > 0;
  const metadata = auditCase.metadata as any;

  const signals = useMemo(() => deriveCaseSignals(auditCase, {
    contradictions,
    evidenceSuff,
    floorEvents,
  }), [auditCase, contradictions, evidenceSuff, floorEvents]);

  const effectiveActionPath = useMemo(() => {
    if (!hasAnalyses) return null;
    const derived = deriveActionPath(auditCase, { evidenceSuff, contradictions });
    return {
      recommended_action: derived.action,
      action_rationale: derived.rationale,
      confidence: derived.confidence,
    };
  }, [hasAnalyses, auditCase, evidenceSuff, contradictions]);

  if (!hasAnalyses) {
    return (
      <Card className="border-muted">
        <CardContent className="py-12 text-center">
          <Eye className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium">No payer analysis available yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Submit this case through the payer pipeline first, or run analysis to see how it would be evaluated from the payer's perspective.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Context Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Payer Audit Perspective</p>
              <p className="text-xs text-muted-foreground">
                This is how the payer's audit engine evaluates this case. Use this to anticipate flags and strengthen your documentation before submission.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk + Consensus + Evidence Sufficiency */}
      <div className={cn("grid gap-4", evidenceSuff ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2")}>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <RiskIndicator riskScore={auditCase.riskScore} />
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col justify-center">
          <ConsensusMeter score={auditCase.consensusScore} />
          {metadata?.consensusIntegrityGrade && (
            <div className={cn(
              "mt-2 rounded-md border p-2 text-center",
              metadata.consensusIntegrityGrade === "strong" ? "border-consensus/30 bg-consensus/5" :
              metadata.consensusIntegrityGrade === "adequate" ? "border-muted bg-muted/30" :
              "border-violation/30 bg-violation/5"
            )}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Consensus Integrity</p>
              <p className={cn("text-xs font-semibold capitalize",
                metadata.consensusIntegrityGrade === "strong" ? "text-consensus" :
                metadata.consensusIntegrityGrade === "adequate" ? "text-muted-foreground" :
                "text-violation"
              )}>{metadata.consensusIntegrityGrade}</p>
            </div>
          )}
        </div>
        {evidenceSuff && (
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Evidence Sufficiency</p>
            <div className="flex items-end gap-2 mb-2">
              <p className={cn("text-3xl font-semibold",
                evidenceSuff.overall_score >= 70 ? "text-consensus" :
                evidenceSuff.overall_score >= 40 ? "text-disagreement" : "text-violation"
              )}>{Math.round(evidenceSuff.overall_score)}</p>
              <p className="text-xs text-muted-foreground mb-1">/ 100</p>
            </div>
            <Badge variant={evidenceSuff.is_defensible ? "default" : "destructive"} className="text-[10px]">
              {evidenceSuff.is_defensible ? "Defensible" : "Under-supported"}
            </Badge>
            {evidenceSuff.missing_evidence.length > 0 && (
              <div className="space-y-1 mt-2">
                <p className="text-[10px] text-muted-foreground font-medium">Missing:</p>
                {evidenceSuff.missing_evidence.slice(0, 3).map((m, i) => (
                  <p key={i} className="text-[11px] text-muted-foreground">• {m.item}</p>
                ))}
                {evidenceSuff.missing_evidence.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{evidenceSuff.missing_evidence.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Pathway — what the payer would recommend */}
      {effectiveActionPath && (
        <Card className={cn(
          'border-l-4',
          ACTION_PATH_CONFIG[effectiveActionPath.recommended_action]?.borderClass || 'border-l-muted'
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Payer's Likely Resolution Path</p>
                  <p className={cn("text-sm font-semibold mt-0.5",
                    ACTION_PATH_CONFIG[effectiveActionPath.recommended_action]?.colorClass || 'text-foreground'
                  )}>
                    {ACTION_PATH_CONFIG[effectiveActionPath.recommended_action]?.label || effectiveActionPath.recommended_action}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{effectiveActionPath.action_rationale}</p>
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-lg font-semibold text-muted-foreground">{effectiveActionPath.confidence}%</p>
                <p className="text-[10px] text-muted-foreground">Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contradictions the payer engine found */}
      {contradictions.length > 0 && (
        <Card className="border-violation/20">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-violation" />
              Contradictions Found by Payer Engine ({contradictions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {contradictions.map((c, i) => (
                <div key={i} className={cn(
                  "rounded-md border p-3",
                  c.severity === "critical" ? "border-violation/30 bg-violation/5" : "border-disagreement/20 bg-disagreement/5"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={c.severity === "critical" ? "destructive" : "outline"} className="text-[10px]">
                      {c.severity}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground capitalize">{c.contradiction_type.replace(/_/g, ' ')}</span>
                  </div>
                  <p className="text-xs text-foreground">{c.description}</p>
                  {c.explanation && (
                    <p className="text-[11px] text-muted-foreground mt-1 italic">{c.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Role Analyses — the core of what payer sees */}
      <div>
        <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">
          Payer Audit Engine Analysis
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {auditCase.analyses.map((analysis, i) => (
            <AIRoleCard
              key={analysis.role}
              analysis={analysis}
              staggerIndex={i}
              hasPayer={!!(metadata?.payerCode)}
            />
          ))}
        </div>
      </div>

      {/* Provider-oriented insight */}
      <Card className="border-info-blue/20 bg-info-blue/5">
        <CardContent className="py-3 px-4">
          <div className="flex items-start gap-3">
            <Info className="h-4 w-4 text-info-blue shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-info-blue">What This Means for You</p>
              <p className="text-xs text-muted-foreground mt-1">
                The analysis above shows exactly what a payer audit would flag. Each AI role evaluates your case from a different angle — 
                Builder looks for billing logic, Red Team tests for denial vectors, Analyst checks documentation compliance, and Breaker 
                stress-tests edge cases. Address flagged items <span className="font-semibold text-foreground">before</span> submission to reduce denial risk.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
