import type { AuditCase } from '@/lib/types';
import { AIRoleCard } from './AIRoleCard';
import { ConsensusMeter } from './ConsensusMeter';
import { RiskIndicator } from './RiskIndicator';
import { EvidenceChecklist } from './EvidenceChecklist';
import { CPTCodeBadge } from './CPTCodeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockEvidenceChecklist, mockCodeCombinations } from '@/lib/mockData';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Shield, FileText, Activity, Scale, Clock, ArrowRight, ShieldAlert, Eye } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Spark integrations
import { DecisionPanel } from './spark/DecisionPanel';
import { EnhancedAppealSummary } from './spark/EnhancedAppealSummary';
import { CodeCombinationAnalysisCard } from './spark/CodeCombinationAnalysisCard';
import { PayerExportDialog } from './spark/PayerExportDialog';
import { PayerTemplateInfo } from './spark/PayerTemplateInfo';
import { AIAnalysisLoadingState } from './spark/LoadingState';

// Pre-Appeal Resolution
import { PreAppealResolutionTab } from './pre-appeal/PreAppealResolutionTab';
import { preAppealResolutions } from '@/lib/preAppealMockData';

// Engine v3 services
import {
  getDecisionTrace, getEvidenceSufficiency, getContradictions,
  getActionPathway, getMinimalWinningPacket, getConfidenceFloorEvents,
  getRegulatoryFlags,
  type DecisionTrace, type EvidenceSufficiency, type Contradiction,
  type ActionPathway, type MinimalWinningPacket, type ConfidenceFloorEvent,
  type RegulatoryFlag,
} from '@/lib/soupyEngineService';

// Case intelligence
import {
  deriveCaseSignals, classifyDisposition, evaluateHumanReviewGating,
  evaluateExportReadiness, deriveActionPath, ACTION_PATH_CONFIG,
  type CaseSummarySignals,
} from '@/lib/caseIntelligence';

interface AuditDetailProps {
  auditCase: AuditCase;
  onBack: () => void;
  posture: 'payment-integrity' | 'compliance-coaching';
  onDecisionMade?: (outcome: 'approved' | 'rejected' | 'info-requested') => void;
}

export function AuditDetail({ auditCase, onBack, posture, onDecisionMade }: AuditDetailProps) {
  const hasAnalyses = auditCase.analyses.length > 0;
  const isAnalyzing = auditCase.analyses.some(a => a.status === 'analyzing');
  const isLiveCase = !!auditCase.createdAt;

  // v3 engine data
  const [decisionTrace, setDecisionTrace] = useState<DecisionTrace | null>(null);
  const [evidenceSuff, setEvidenceSuff] = useState<EvidenceSufficiency | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [actionPathway, setActionPathway] = useState<ActionPathway | null>(null);
  const [winningPacket, setWinningPacket] = useState<MinimalWinningPacket | null>(null);
  const [floorEvents, setFloorEvents] = useState<ConfidenceFloorEvent[]>([]);
  const [regFlags, setRegFlags] = useState<RegulatoryFlag[]>([]);

  useEffect(() => {
    if (!isLiveCase || !hasAnalyses) return;
    Promise.allSettled([
      getDecisionTrace(auditCase.id).then(setDecisionTrace),
      getEvidenceSufficiency(auditCase.id).then(setEvidenceSuff),
      getContradictions(auditCase.id).then(setContradictions),
      getActionPathway(auditCase.id).then(setActionPathway),
      getMinimalWinningPacket(auditCase.id).then(setWinningPacket),
      getConfidenceFloorEvents(auditCase.id).then(setFloorEvents),
      getRegulatoryFlags(auditCase.id).then(setRegFlags),
    ]);
  }, [auditCase.id, isLiveCase, hasAnalyses]);

  // ─── Synchronized Case Signals ───
  const signals = useMemo(() => deriveCaseSignals(auditCase, {
    contradictions,
    evidenceSuff,
    floorEvents,
    actionPathway,
  }), [auditCase, contradictions, evidenceSuff, floorEvents, actionPathway]);

  // For mock cases without live action pathway, derive one
  const effectiveActionPath = useMemo(() => {
    if (actionPathway) return actionPathway;
    if (!hasAnalyses) return null;
    const derived = deriveActionPath(auditCase, { evidenceSuff, contradictions });
    return {
      recommended_action: derived.action,
      action_rationale: derived.rationale,
      confidence_in_recommendation: derived.confidence,
      is_human_review_required: signals.humanReview.triggered,
    } as ActionPathway;
  }, [actionPathway, hasAnalyses, auditCase, evidenceSuff, contradictions, signals.humanReview.triggered]);

  const exportReadiness = useMemo(() => evaluateExportReadiness(auditCase, {
    evidenceSuff,
    contradictions,
  }), [auditCase, evidenceSuff, contradictions]);

  const handleDecision = (outcome: 'approved' | 'rejected' | 'info-requested', reasoning: string) => {
    toast.success(`Case ${outcome === 'info-requested' ? 'info requested' : outcome}`);
    onDecisionMade?.(outcome);
  };

  const matchingCombinations = mockCodeCombinations.filter(cc =>
    cc.codes.every(c => auditCase.cptCodes.includes(c))
  );

  const metadata = auditCase.metadata as any;
  const hasV3Data = decisionTrace || evidenceSuff || actionPathway || contradictions.length > 0;

  // Count mock contradictions from analyses for non-live cases
  const effectiveContradictionCount = contradictions.length > 0
    ? contradictions.length
    : (auditCase.riskScore?.factors.filter(f => f.triggered && f.isDeterminative).length || 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ═══ Case Header ═══ */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{auditCase.caseNumber}</h1>
            <Badge variant="outline" className="font-mono text-xs">{auditCase.physicianId}</Badge>
            <span className="text-sm text-muted-foreground">{auditCase.physicianName}</span>
            {metadata?.engineVersion === "SOUPY-v3" && (
              <Badge variant="secondary" className="text-[10px]">SOUPY v3</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>DOS: {auditCase.dateOfService}</span>
            <span>Patient: {auditCase.patientId}</span>
            <span className="font-mono font-semibold text-foreground">${auditCase.claimAmount.toLocaleString()}</span>
            {auditCase.createdAt && (
              <span className="text-xs">Submitted: {new Date(auditCase.dateSubmitted).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">CPT:</span>
            {auditCase.cptCodes.map(c => <CPTCodeBadge key={c} code={c} />)}
            <Separator orientation="vertical" className="h-5" />
            <span className="text-xs text-muted-foreground mr-1">ICD-10:</span>
            {auditCase.icdCodes.map(c => (
              <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Disposition Banner — Always visible when analyses exist ═══ */}
      {hasAnalyses && (
        <Card className={cn('border-l-4', signals.disposition.borderClass, signals.disposition.bgClass)}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                {signals.disposition.disposition === 'defensible_now' && <CheckCircle className="h-4 w-4 text-consensus" />}
                {signals.disposition.disposition === 'curable_with_documentation' && <Clock className="h-4 w-4 text-disagreement" />}
                {signals.disposition.disposition === 'admin_fix_only' && <FileText className="h-4 w-4 text-info-blue" />}
                {signals.disposition.disposition === 'human_review_required' && <ShieldAlert className="h-4 w-4 text-violation" />}
                {signals.disposition.disposition === 'not_defensible' && <XCircle className="h-4 w-4 text-destructive" />}
                <div>
                  <p className={cn('text-sm font-semibold', signals.disposition.colorClass)}>{signals.disposition.label}</p>
                  <p className="text-xs text-muted-foreground">{signals.disposition.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Risk: <span className="font-semibold text-foreground">{signals.riskScore}</span>/100</span>
                <span>•</span>
                <span>{signals.consensusLabel} <span className="font-mono">({signals.consensusScore}%)</span></span>
                <span>•</span>
                <span>{signals.confidenceLabel}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Human Review Alert ═══ */}
      {signals.humanReview.triggered && hasAnalyses && (
        <Card className="border-violation/30 bg-violation/5">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-violation shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-violation">Human Review Required</p>
                <ul className="mt-1 space-y-0.5">
                  {signals.humanReview.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground">• {r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Action Pathway Banner ═══ */}
      {effectiveActionPath && hasAnalyses && (
        <Card className={cn(
          'border-l-4',
          ACTION_PATH_CONFIG[effectiveActionPath.recommended_action]?.borderClass || 'border-l-muted'
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Suggested Action</p>
                  <p className={cn("text-sm font-semibold mt-0.5",
                    ACTION_PATH_CONFIG[effectiveActionPath.recommended_action]?.colorClass || 'text-foreground'
                  )}>
                    {ACTION_PATH_CONFIG[effectiveActionPath.recommended_action]?.label || effectiveActionPath.recommended_action}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{effectiveActionPath.action_rationale}</p>
                  <p className="text-[10px] text-muted-foreground mt-1.5 italic">Operational guidance only — not legal advice.</p>
                </div>
              </div>
              <div className="text-center shrink-0">
                <p className="text-lg font-semibold text-muted-foreground">{effectiveActionPath.confidence_in_recommendation}%</p>
                <p className="text-[10px] text-muted-foreground">Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasAnalyses ? (
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
            {hasV3Data && <TabsTrigger value="engine">Engine Intelligence</TabsTrigger>}
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="appeals">
              Appeals & Export
              {exportReadiness.status !== 'ready' && (
                <Badge variant="outline" className={cn('ml-1.5 text-[9px] px-1', exportReadiness.colorClass)}>{exportReadiness.label}</Badge>
              )}
            </TabsTrigger>
            {preAppealResolutions[auditCase.id] && (
              <TabsTrigger value="pre-appeal">Pre-Appeal Resolution</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            {isAnalyzing && <AIAnalysisLoadingState />}

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
                {signals.humanReview.triggered && (
                  <div className="mt-2 rounded-md border border-violation/30 bg-violation/5 p-2">
                    <p className="text-xs font-medium text-violation">⚠ Human Review Required</p>
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

            {/* Contradictions */}
            {contradictions.length > 0 && (
              <Card className="border-violation/20">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-violation" />
                    Contradictions Found ({contradictions.length})
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
                        {(c.source_a || c.source_b) && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {c.source_a && <span>Source: {c.source_a}</span>}
                            {c.source_a && c.source_b && <span> ↔ </span>}
                            {c.source_b && <span>{c.source_b}</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Regulatory Flags */}
            {regFlags.length > 0 && (
              <Card>
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-disagreement" />
                    Regulatory Currency Flags ({regFlags.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="space-y-2">
                    {regFlags.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-md border bg-disagreement/5 border-disagreement/15">
                        <Badge variant="outline" className="text-[10px] shrink-0">{f.severity}</Badge>
                        <div>
                          <p className="text-xs text-foreground">{f.description}</p>
                          {f.source_reference && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Ref: {f.source_reference}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Regulatory awareness flag — not a guarantee of legal completeness.</p>
                </CardContent>
              </Card>
            )}

            {/* Code Combination Analysis */}
            {matchingCombinations.map((combo, i) => (
              <CodeCombinationAnalysisCard key={i} analysis={combo} />
            ))}

            {/* AI Role Cards */}
            <div>
              <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider text-muted-foreground">SOUPY Protocol Analysis</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {auditCase.analyses.map((analysis, i) => (
                  <AIRoleCard key={analysis.role} analysis={analysis} staggerIndex={i} />
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Engine Intelligence Tab */}
          {hasV3Data && (
            <TabsContent value="engine" className="space-y-4">
              {/* Decision Trace */}
              {decisionTrace && (
                <Card>
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-accent" />
                      Decision Trace
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Structured audit-ready reasoning. Integrity: <span className="font-semibold capitalize">{decisionTrace.consensus_integrity_grade}</span>
                    </p>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-2">
                      {(decisionTrace.trace_entries as any[]).map((entry, i) => (
                        <div key={i} className="rounded-md border p-3 bg-muted/30">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">{entry.sourceRole || 'engine'}</Badge>
                            <p className="text-xs font-medium text-foreground">{entry.trigger}</p>
                          </div>
                          {entry.documentationGap && (
                            <p className="text-[11px] text-muted-foreground"><span className="font-medium">Gap:</span> {entry.documentationGap}</p>
                          )}
                          {entry.counterargumentConsidered && (
                            <p className="text-[11px] text-muted-foreground"><span className="font-medium">Counterpoint:</span> {entry.counterargumentConsidered}</p>
                          )}
                          {entry.evidenceSupporting && (
                            <p className="text-[11px] text-muted-foreground"><span className="font-medium">Evidence:</span> {entry.evidenceSupporting}</p>
                          )}
                          {entry.regulationReferenced && (
                            <p className="text-[11px] text-muted-foreground"><span className="font-medium">Regulation:</span> {entry.regulationReferenced}</p>
                          )}
                          {entry.confidenceImpact && (
                            <p className="text-[11px] text-muted-foreground"><span className="font-medium">Impact:</span> {entry.confidenceImpact}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {decisionTrace.recommendation_rationale && (
                      <div className="mt-3 rounded-md border bg-card p-3">
                        <p className="text-xs font-medium text-foreground">Final Recommendation</p>
                        <p className="text-xs text-muted-foreground mt-1">{decisionTrace.recommendation_rationale}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Minimal Winning Packet */}
              {winningPacket && winningPacket.checklist.length > 0 && (
                <Card>
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="h-4 w-4 text-consensus" />
                      Minimal Winning Packet
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {winningPacket.estimated_curable_count} curable items · {winningPacket.estimated_not_worth_chasing} not worth chasing
                    </p>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="space-y-2">
                      {(winningPacket.checklist as any[]).map((item, i) => (
                        <div key={i} className={cn(
                          "flex items-start gap-2 p-2 rounded-md border",
                          item.isCurable ? "bg-consensus/5 border-consensus/15" : "bg-muted/30 border-muted"
                        )}>
                          {item.isCurable ? (
                            <CheckCircle className="h-3.5 w-3.5 text-consensus shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="text-xs text-foreground">{item.item}</p>
                            <div className="flex gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[9px]">{item.priority} priority</Badge>
                              <Badge variant="outline" className="text-[9px]">{item.impactIfObtained} impact</Badge>
                              {!item.isCurable && <Badge variant="outline" className="text-[9px] text-muted-foreground">not worth chasing</Badge>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Evidence Sufficiency Breakdown */}
              {evidenceSuff && (
                <Card>
                  <CardHeader className="pb-3 pt-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4 text-info-blue" />
                      Evidence Sufficiency Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { label: 'Approve', value: evidenceSuff.sufficiency_for_approve },
                        { label: 'Deny', value: evidenceSuff.sufficiency_for_deny },
                        { label: 'Info Request', value: evidenceSuff.sufficiency_for_info_request },
                        { label: 'Appeal Defense', value: evidenceSuff.sufficiency_for_appeal_defense },
                        { label: 'Appeal Not Rec.', value: evidenceSuff.sufficiency_for_appeal_not_recommended },
                      ].map((s, i) => (
                        <div key={i} className="rounded-md border bg-background p-3 text-center">
                          <p className={cn("text-lg font-semibold",
                            Number(s.value) >= 70 ? "text-consensus" :
                            Number(s.value) >= 40 ? "text-disagreement" : "text-violation"
                          )}>{Math.round(Number(s.value))}%</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          <TabsContent value="evidence">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <EvidenceChecklist items={mockEvidenceChecklist} />
            </div>
          </TabsContent>

          <TabsContent value="appeals" className="space-y-4">
            {/* Export Readiness Status */}
            <Card className={cn('border-l-4', 
              exportReadiness.status === 'ready' ? 'border-l-consensus' :
              exportReadiness.status === 'conditional' ? 'border-l-disagreement' :
              exportReadiness.status === 'incomplete' ? 'border-l-violation' :
              'border-l-destructive'
            )}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className={cn("text-sm font-semibold", exportReadiness.colorClass)}>{exportReadiness.label}</p>
                    <p className="text-xs text-muted-foreground">{exportReadiness.description}</p>
                    {exportReadiness.missingItems.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {exportReadiness.missingItems.map((item, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <EnhancedAppealSummary auditCase={auditCase} exportReadiness={exportReadiness} />
            <PayerTemplateInfo />
            <div className="flex justify-center">
              <PayerExportDialog auditCase={auditCase} />
            </div>
          </TabsContent>

          {preAppealResolutions[auditCase.id] && (
            <TabsContent value="pre-appeal">
              <PreAppealResolutionTab
                auditCase={auditCase}
                resolution={preAppealResolutions[auditCase.id]}
                viewMode="payer"
              />
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <div className="rounded-lg border bg-card p-6 text-center shadow-sm">
          <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No AI analysis available for this case.</p>
          <p className="text-xs text-muted-foreground mt-1">Run SOUPY analysis to generate risk assessment, evidence review, and action recommendations.</p>
          <Button className="mt-4" size="sm">Run SOUPY Analysis</Button>
        </div>
      )}

      {/* Decision Panel — suppress confident approval buttons when human review required */}
      {!auditCase.decision && hasAnalyses && (
        <DecisionPanel
          auditCase={auditCase}
          onDecision={handleDecision}
          humanReviewRequired={signals.humanReview.triggered}
          disposition={signals.disposition}
        />
      )}

      {auditCase.decision && (
        <div className={cn(
          'rounded-lg border p-4 shadow-sm',
          auditCase.decision.outcome === 'approved' ? 'border-consensus/30 bg-consensus/5' : 'border-violation/30 bg-violation/5'
        )}>
          <div className="flex items-center gap-2 mb-2">
            {auditCase.decision.outcome === 'approved'
              ? <CheckCircle className="h-5 w-5 text-consensus" />
              : <XCircle className="h-5 w-5 text-violation" />
            }
            <span className="font-semibold text-sm capitalize">{auditCase.decision.outcome}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              by {auditCase.decision.auditor} • {new Date(auditCase.decision.timestamp).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{auditCase.decision.reasoning}</p>
        </div>
      )}
    </div>
  );
}
