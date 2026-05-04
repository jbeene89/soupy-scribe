import type { AuditCase } from '@/lib/types';
import type { ProviderCaseReview as ProviderCaseReviewType } from '@/lib/providerTypes';
import type { PreAppealResolution } from '@/lib/preAppealTypes';
import { ProviderCaseReviewCard } from './ProviderCaseReview';
import { ProviderPacket } from './ProviderPacket';
import { EvidenceReadinessChecklist } from './EvidenceReadinessChecklist';
import { PayerPerspectiveView } from './PayerPerspectiveView';
import { CPTCodeBadge } from '@/components/CPTCodeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GovernancePanel } from '@/components/GovernancePanel';
import { ScoreTransparencyPanel } from '@/components/ScoreTransparencyPanel';
import { CodeCombinationAnalysisCard } from '@/components/spark/CodeCombinationAnalysisCard';
import {
  ArrowLeft, Brain, Loader2, CheckCircle, Clock, Download, FileText,
  ShieldAlert, XCircle, Zap, Link2, AlertTriangle, ArrowRight, Info, Eye,
} from 'lucide-react';
import { exportProviderCaseDetailPDF, PROVIDER_CASE_SECTIONS } from '@/lib/exportProviderCaseDetailPDF';
import { SectionExportMenu } from '@/components/SectionExportMenu';
import { useState, useEffect, useMemo } from 'react';
import { getStoredProviderReview, runProviderAnalysis } from '@/lib/providerService';
import { getStoredPreAppealResolution, runPreAppealAnalysis } from '@/lib/preAppealService';
import {
  getCodeCombinations, getEvidenceSufficiency, getContradictions,
  getConfidenceFloorEvents, type CodeCombination, type EvidenceSufficiency,
  type Contradiction, type ConfidenceFloorEvent,
} from '@/lib/soupyEngineService';
import { deriveCaseSignals } from '@/lib/caseIntelligence';
import { assessGovernance, type GovernanceAssessment } from '@/lib/caseGovernance';
import { useAuth } from '@/hooks/useAuth';
import { AuthGate } from '@/components/AuthGate';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PreAppealResolutionTab } from '@/components/pre-appeal/PreAppealResolutionTab';
import { CDIFindingsPanel } from '@/components/provider/CDIFindingsPanel';
import { supabase } from '@/integrations/supabase/client';
import { StandardizedScalesPanel } from '@/components/psych/StandardizedScalesPanel';
import type { ParsedNote } from '@/lib/crosswalkTypes';

interface ProviderCaseDetailProps {
  auditCase: AuditCase;
  onBack: () => void;
}

export function ProviderCaseDetail({ auditCase, onBack }: ProviderCaseDetailProps) {
  const { isAuthenticated } = useAuth();
  const [liveReview, setLiveReview] = useState<ProviderCaseReviewType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);

  // Pre-appeal resolution (live)
  const [preAppealResolution, setPreAppealResolution] = useState<PreAppealResolution | null>(null);
  const [loadingPreAppeal, setLoadingPreAppeal] = useState(false);
  const [runningPreAppeal, setRunningPreAppeal] = useState(false);

  // Engine v3 data — parity with payer
  const [liveCodeCombos, setLiveCodeCombos] = useState<CodeCombination[]>([]);
  const [evidenceSuff, setEvidenceSuff] = useState<EvidenceSufficiency | null>(null);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [floorEvents, setFloorEvents] = useState<ConfidenceFloorEvent[]>([]);

  // Linked case info
  const [linkedCase, setLinkedCase] = useState<{ caseNumber: string; id: string } | null>(null);

  const review = liveReview;
  const isLiveCase = !!auditCase.createdAt;
  const hasAnalyses = auditCase.analyses.length > 0;

  useEffect(() => {
    setLoadingReview(true);
    getStoredProviderReview(auditCase.id)
      .then(r => { if (r) setLiveReview(r); })
      .catch(() => {})
      .finally(() => setLoadingReview(false));

    // Load stored pre-appeal resolution
    setLoadingPreAppeal(true);
    getStoredPreAppealResolution(auditCase.id)
      .then(r => { if (r) setPreAppealResolution(r); })
      .catch(() => {})
      .finally(() => setLoadingPreAppeal(false));

    // Load v3 engine data
    if (isLiveCase) {
      Promise.allSettled([
        getCodeCombinations(auditCase.id).then(setLiveCodeCombos),
        getEvidenceSufficiency(auditCase.id).then(setEvidenceSuff),
        getContradictions(auditCase.id).then(setContradictions),
        getConfidenceFloorEvents(auditCase.id).then(setFloorEvents),
      ]);
    }

    // Check for linked case
    if (auditCase.linkedCaseId) {
      supabase
        .from('audit_cases')
        .select('case_number, id')
        .eq('id', auditCase.linkedCaseId)
        .single()
        .then(({ data }) => {
          if (data) setLinkedCase({ caseNumber: data.case_number, id: data.id });
        });
    }
  }, [auditCase.id, auditCase.linkedCaseId, isLiveCase]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const result = await runProviderAnalysis(auditCase.id);
      setLiveReview(result);
      toast.success('Compliance readiness analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunPreAppeal = async () => {
    setRunningPreAppeal(true);
    try {
      const result = await runPreAppealAnalysis(auditCase.id);
      setPreAppealResolution(result);
      toast.success('Pre-appeal resolution analysis complete');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pre-appeal analysis failed');
    } finally {
      setRunningPreAppeal(false);
    }
  };

  // Centralized case intelligence — same module as payer mode
  const signals = useMemo(() => deriveCaseSignals(auditCase, {
    contradictions,
    evidenceSuff,
    floorEvents,
  }), [auditCase, contradictions, evidenceSuff, floorEvents]);

  const governance = useMemo(() => {
    if (!hasAnalyses) return null;
    return assessGovernance(auditCase, { contradictions, evidenceSuff, floorEvents });
  }, [auditCase, contradictions, evidenceSuff, floorEvents, hasAnalyses]);

  const matchingCombinations = liveCodeCombos.map(cc => ({
    codes: cc.codes,
    flagReason: cc.flag_reason,
    legitimateExplanations: cc.legitimate_explanations || [],
    noncompliantExplanations: cc.noncompliant_explanations || [],
    requiredDocumentation: cc.required_documentation || [],
  }));

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{auditCase.caseNumber}</h1>
            <Badge variant="outline" className="text-xs border-accent/40 text-accent bg-accent/10">Provider Readiness</Badge>
            {liveReview && (
              <Badge variant="outline" className="text-xs border-consensus/40 text-consensus bg-consensus/10">AI Analyzed</Badge>
            )}
            {auditCase.bodyRegion && (
              <Badge variant="outline" className="text-xs">{auditCase.bodyRegion}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {liveReview && (
              <SectionExportMenu
                sections={PROVIDER_CASE_SECTIONS}
                buttonLabel="Export PDF"
                onExport={(ids) => exportProviderCaseDetailPDF(auditCase, liveReview, ids)}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>DOS: {auditCase.dateOfService}</span>
            <span>Patient: {auditCase.patientId}</span>
            <span className="font-mono font-semibold text-foreground">${auditCase.claimAmount.toLocaleString()}</span>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
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

      {/* Linked Case Banner */}
      {linkedCase && (
        <Card className="border-info-blue/30 bg-info-blue/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-3">
              <Link2 className="h-4 w-4 text-info-blue shrink-0" />
              <div>
                <p className="text-sm font-medium text-info-blue">Linked to {linkedCase.caseNumber}</p>
                <p className="text-xs text-muted-foreground">
                  This case was auto-linked based on matching patient ID and body region.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standardized rating-scale evidence (PHQ-9, GAD-7, Y-BOCS, PCL-5, CAPS-5, MDQ, ASRS) */}
      {(() => {
        const note = (auditCase.metadata as unknown as { clinicalNote?: ParsedNote })?.clinicalNote;
        return <StandardizedScalesPanel scales={note?.standardized_scales} />;
      })()}

      {/* Disposition Banner — synced with payer mode via caseIntelligence */}
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
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score Transparency */}
      {governance && hasAnalyses && (
        <ScoreTransparencyPanel governance={governance} signals={signals} />
      )}

      {/* Human Review Alert */}
      {signals.humanReview.triggered && hasAnalyses && (
        <Card className="border-violation/30 bg-violation/5">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-violation shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-violation">Analyst Review Required</p>
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

      {/* Governance Panel */}
      {governance && hasAnalyses && (
        <GovernancePanel assessment={governance} />
      )}

      {loadingReview ? (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent mb-2" />
          <p className="text-sm text-muted-foreground">Loading readiness review...</p>
        </div>
      ) : review ? (
        <Tabs defaultValue="review" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="review">Readiness Review</TabsTrigger>
            <TabsTrigger value="appeal">Appeal Assessment</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Checklist</TabsTrigger>
            <TabsTrigger value="cdi">CDI / Coding</TabsTrigger>
            {matchingCombinations.length > 0 && (
              <TabsTrigger value="code-combos">
                Code Combinations
                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-disagreement/40 text-disagreement">
                  {matchingCombinations.length}
                </Badge>
              </TabsTrigger>
            )}
            {hasAnalyses && (
              <TabsTrigger value="payer-view">
                <Eye className="h-3 w-3 mr-1" />
                Payer Perspective
              </TabsTrigger>
            )}
            <TabsTrigger value="pre-appeal">
              Pre-Appeal Resolution
              {preAppealResolution && (
                <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-accent/40 text-accent">✓</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            <ProviderCaseReviewCard review={review} />
          </TabsContent>

          <TabsContent value="appeal">
            <ProviderPacket assessment={review.appealAssessment} caseNumber={auditCase.caseNumber} />
          </TabsContent>

          <TabsContent value="evidence">
            <EvidenceReadinessChecklist items={review.evidenceReadiness} />
          </TabsContent>

          <TabsContent value="cdi">
            <CDIFindingsPanel auditCase={auditCase} />
          </TabsContent>

          {matchingCombinations.length > 0 && (
            <TabsContent value="code-combos">
              <div className="space-y-4">
                {matchingCombinations.map((combo, i) => (
                  <CodeCombinationAnalysisCard key={i} analysis={{
                    codes: combo.codes,
                    flagReason: combo.flagReason,
                    legitimateExplanations: combo.legitimateExplanations,
                    noncompliantExplanations: combo.noncompliantExplanations,
                    requiredDocumentation: combo.requiredDocumentation,
                  }} />
                ))}
              </div>
            </TabsContent>
          )}

          {hasAnalyses && (
            <TabsContent value="payer-view">
              <PayerPerspectiveView
                auditCase={auditCase}
                evidenceSuff={evidenceSuff}
                contradictions={contradictions}
                floorEvents={floorEvents}
              />
            </TabsContent>
          )}

          <TabsContent value="pre-appeal">
            {loadingPreAppeal ? (
              <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent mb-2" />
                <p className="text-sm text-muted-foreground">Loading pre-appeal resolution...</p>
              </div>
            ) : preAppealResolution ? (
              <PreAppealResolutionTab
                auditCase={auditCase}
                resolution={preAppealResolution}
                viewMode="provider"
              />
            ) : (
              <div className="rounded-lg border bg-card p-8 text-center shadow-sm space-y-4">
                <Zap className="h-10 w-10 mx-auto text-accent/50" />
                <div>
                  <p className="text-sm font-medium">No pre-appeal resolution yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Run AI-powered pre-appeal analysis to determine if this case can be resolved without a formal appeal.
                  </p>
                </div>
                <AuthGate>
                  <Button onClick={handleRunPreAppeal} disabled={runningPreAppeal} className="gap-2">
                    {runningPreAppeal ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Analyzing...</>
                    ) : (
                      <><Zap className="h-4 w-4" />Run Pre-Appeal Analysis</>
                    )}
                  </Button>
                </AuthGate>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm space-y-4">
          <Brain className="h-10 w-10 mx-auto text-accent/50" />
          <div>
            <p className="text-sm font-medium">No readiness review yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Run AI-powered compliance readiness analysis to see documentation sufficiency, coding vulnerability, and appeal viability indicators.
            </p>
          </div>
          <AuthGate>
            <Button
              onClick={handleRunAnalysis}
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Run Readiness Analysis
                </>
              )}
            </Button>
          </AuthGate>
        </div>
      )}
    </div>
  );
}
