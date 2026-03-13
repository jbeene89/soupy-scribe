import type { AuditCase } from '@/lib/types';
import type { ProviderCaseReview as ProviderCaseReviewType } from '@/lib/providerTypes';
import { providerReviews } from '@/lib/providerMockData';
import { ProviderCaseReviewCard } from './ProviderCaseReview';
import { ProviderPacket } from './ProviderPacket';
import { EvidenceReadinessChecklist } from './EvidenceReadinessChecklist';
import { CPTCodeBadge } from '@/components/CPTCodeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Brain, Loader2, CheckCircle, Clock, FileText, ShieldAlert, XCircle } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getStoredProviderReview, runProviderAnalysis } from '@/lib/providerService';
import { useAuth } from '@/hooks/useAuth';
import { AuthGate } from '@/components/AuthGate';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PreAppealResolutionTab } from '@/components/pre-appeal/PreAppealResolutionTab';
import { preAppealResolutions } from '@/lib/preAppealMockData';
import { deriveCaseSignals } from '@/lib/caseIntelligence';

interface ProviderCaseDetailProps {
  auditCase: AuditCase;
  onBack: () => void;
}

export function ProviderCaseDetail({ auditCase, onBack }: ProviderCaseDetailProps) {
  const { isAuthenticated } = useAuth();
  // Check mock reviews first, then live
  const mockReview = providerReviews[auditCase.id];
  const [liveReview, setLiveReview] = useState<ProviderCaseReviewType | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);

  const review = mockReview || liveReview;

  useEffect(() => {
    if (mockReview) return; // skip if mock data exists
    setLoadingReview(true);
    getStoredProviderReview(auditCase.id)
      .then(r => { if (r) setLiveReview(r); })
      .catch(() => {})
      .finally(() => setLoadingReview(false));
  }, [auditCase.id, mockReview]);

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

  // Centralized case intelligence — same module as payer mode
  const signals = useMemo(() => deriveCaseSignals(auditCase), [auditCase]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">{auditCase.caseNumber}</h1>
            <Badge variant="outline" className="text-xs border-accent/40 text-accent bg-accent/10">Provider Readiness</Badge>
            {liveReview && !mockReview && (
              <Badge variant="outline" className="text-xs border-consensus/40 text-consensus bg-consensus/10">AI Analyzed</Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span>DOS: {auditCase.dateOfService}</span>
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

      {/* Disposition Banner — synced with payer mode via caseIntelligence */}
      {signals.hasAnalyses && (
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

      {loadingReview ? (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent mb-2" />
          <p className="text-sm text-muted-foreground">Loading readiness review...</p>
        </div>
      ) : review ? (
        <Tabs defaultValue="review" className="space-y-4">
          <TabsList>
            <TabsTrigger value="review">Readiness Review</TabsTrigger>
            <TabsTrigger value="appeal">Appeal Assessment</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Checklist</TabsTrigger>
            {preAppealResolutions[auditCase.id] && (
              <TabsTrigger value="pre-appeal">Pre-Appeal Resolution</TabsTrigger>
            )}
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

          {preAppealResolutions[auditCase.id] && (
            <TabsContent value="pre-appeal">
              <PreAppealResolutionTab
                auditCase={auditCase}
                resolution={preAppealResolutions[auditCase.id]}
                viewMode="provider"
              />
            </TabsContent>
          )}
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
