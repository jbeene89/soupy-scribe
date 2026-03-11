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
import { mockEvidenceChecklist, mockCodeCombinations } from '@/lib/mockData';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
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

interface AuditDetailProps {
  auditCase: AuditCase;
  onBack: () => void;
  posture: 'payment-integrity' | 'compliance-coaching';
  onDecisionMade?: (outcome: 'approved' | 'rejected' | 'info-requested') => void;
}

export function AuditDetail({ auditCase, onBack, posture, onDecisionMade }: AuditDetailProps) {
  const hasAnalyses = auditCase.analyses.length > 0;
  const isAnalyzing = auditCase.analyses.some(a => a.status === 'analyzing');

  const handleDecision = (outcome: 'approved' | 'rejected' | 'info-requested', reasoning: string) => {
    toast.success(`Case ${outcome === 'info-requested' ? 'info requested' : outcome}`);
    onDecisionMade?.(outcome);
  };

  // Find matching code combinations for this case
  const matchingCombinations = mockCodeCombinations.filter(cc =>
    cc.codes.every(c => auditCase.cptCodes.includes(c))
  );

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
            <Badge variant="outline" className="font-mono text-xs">{auditCase.physicianId}</Badge>
            <span className="text-muted-foreground">{auditCase.physicianName}</span>
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

      {hasAnalyses ? (
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="appeals">Appeals & Export</TabsTrigger>
            {preAppealResolutions[auditCase.id] && (
              <TabsTrigger value="pre-appeal">Pre-Appeal Resolution</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="analysis" className="space-y-6">
            {isAnalyzing && <AIAnalysisLoadingState />}

            {/* Risk + Consensus */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <RiskIndicator riskScore={auditCase.riskScore} />
              </div>
              <div className="rounded-lg border bg-card p-4 shadow-sm flex flex-col justify-center">
                <ConsensusMeter score={auditCase.consensusScore} />
                {auditCase.consensusScore < 60 && (
                  <div className="mt-3 rounded-md border border-disagreement/30 bg-disagreement/5 p-3">
                    <p className="text-xs font-medium text-disagreement">⚠ High Complexity — Human Review Required</p>
                    <p className="text-xs text-muted-foreground mt-1">AI models show significant disagreement. All perspectives shown below for your evaluation.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Code Combination Analysis - using Spark component */}
            {matchingCombinations.map((combo, i) => (
              <CodeCombinationAnalysisCard key={i} analysis={combo} />
            ))}

            {/* AI Role Cards */}
            <div>
              <h2 className="text-lg font-semibold mb-4">SOUPY Protocol Analysis</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {auditCase.analyses.map((analysis, i) => (
                  <AIRoleCard key={analysis.role} analysis={analysis} staggerIndex={i} />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="evidence">
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <EvidenceChecklist items={mockEvidenceChecklist} />
            </div>
          </TabsContent>

          <TabsContent value="appeals" className="space-y-6">
            {/* Enhanced Appeal Summary with dual-voice analysis */}
            <EnhancedAppealSummary auditCase={auditCase} />

            {/* Payer template overview */}
            <PayerTemplateInfo />

            {/* Payer-specific export */}
            <div className="flex justify-center">
              <PayerExportDialog auditCase={auditCase} />
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No AI analysis available for this case.</p>
          <Button className="mt-4">Run SOUPY Analysis</Button>
        </div>
      )}

      {/* Decision Panel - using Spark component with confirmation dialog */}
      {!auditCase.decision && hasAnalyses && (
        <DecisionPanel auditCase={auditCase} onDecision={handleDecision} />
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
