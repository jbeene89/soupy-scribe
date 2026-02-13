import type { AuditCase } from '@/lib/types';
import { AIRoleCard } from './AIRoleCard';
import { ConsensusMeter } from './ConsensusMeter';
import { RiskIndicator } from './RiskIndicator';
import { EvidenceChecklist } from './EvidenceChecklist';
import { AppealSummary } from './AppealSummary';
import { CPTCodeBadge } from './CPTCodeBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockEvidenceChecklist, mockCodeCombinations } from '@/lib/mockData';
import { ArrowLeft, CheckCircle, XCircle, HelpCircle, Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AuditDetailProps {
  auditCase: AuditCase;
  onBack: () => void;
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function AuditDetail({ auditCase, onBack, posture }: AuditDetailProps) {
  const [decisionNotes, setDecisionNotes] = useState('');

  const allViolations = auditCase.analyses.flatMap(a => a.violations);
  const hasAnalyses = auditCase.analyses.length > 0;

  const approveLabel = posture === 'payment-integrity' ? 'Approve Payment' : 'Documentation Sufficient';
  const rejectLabel = posture === 'payment-integrity' ? 'Deny Payment' : 'Documentation Deficiency Identified';

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
            <TabsTrigger value="appeals">Appeals</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-6">
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

            {/* Code Combinations */}
            {mockCodeCombinations.filter(cc => cc.codes.every(c => auditCase.cptCodes.includes(c))).map((combo, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Code Combination Analysis</p>
                  <div className="flex gap-1">
                    {combo.codes.map(c => <CPTCodeBadge key={c} code={c} />)}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{combo.flagReason}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-consensus">✓ Common Legitimate Explanations</p>
                    {combo.legitimateExplanations.map((e, j) => (
                      <p key={j} className="text-xs text-muted-foreground pl-3 border-l-2 border-consensus/30">{e}</p>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-violation">✗ Common Noncompliant Explanations</p>
                    {combo.noncompliantExplanations.map((e, j) => (
                      <p key={j} className="text-xs text-muted-foreground pl-3 border-l-2 border-violation/30">{e}</p>
                    ))}
                  </div>
                </div>
              </div>
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

          <TabsContent value="appeals">
            <AppealSummary violations={allViolations} caseNumber={auditCase.caseNumber} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No AI analysis available for this case.</p>
          <Button className="mt-4">Run SOUPY Analysis</Button>
        </div>
      )}

      {/* Decision Panel */}
      {!auditCase.decision && hasAnalyses && (
        <div className="sticky bottom-0 bg-background border-t p-4 -mx-8 px-8 shadow-[0_-4px_12px_hsl(var(--border)/0.5)]">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Decision Notes</label>
              <Textarea
                placeholder="Document your reasoning..."
                value={decisionNotes}
                onChange={e => setDecisionNotes(e.target.value)}
                className="h-20 resize-none"
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" className="gap-1.5" onClick={() => toast.info('Request sent')}>
                <HelpCircle className="h-4 w-4" />
                Request Info
              </Button>
              <Button variant="destructive" className="gap-1.5" onClick={() => toast.success('Case rejected')}>
                <XCircle className="h-4 w-4" />
                {rejectLabel}
              </Button>
              <Button className="gap-1.5 bg-consensus hover:bg-consensus/90 text-consensus-foreground" onClick={() => toast.success('Case approved')}>
                <CheckCircle className="h-4 w-4" />
                {approveLabel}
              </Button>
            </div>
          </div>
        </div>
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
