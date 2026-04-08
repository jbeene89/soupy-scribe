import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthGate } from '@/components/AuthGate';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AuditCase } from '@/lib/types';
import type { CaseDispositionResult } from '@/lib/caseIntelligence';
import { CheckCircle, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DecisionPanelProps {
  auditCase: AuditCase;
  onDecision: (outcome: 'approved' | 'rejected' | 'info-requested', reasoning: string) => void;
  humanReviewRequired?: boolean;
  disposition?: CaseDispositionResult;
}

export function DecisionPanel({ auditCase, onDecision, humanReviewRequired, disposition }: DecisionPanelProps) {
  const [reasoning, setReasoning] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<'approved' | 'rejected' | 'info-requested' | null>(null);

  const handleDecisionClick = (outcome: 'approved' | 'rejected' | 'info-requested') => {
    setPendingOutcome(outcome);
    setShowDialog(true);
  };

  const confirmDecision = () => {
    if (pendingOutcome && reasoning.trim()) {
      onDecision(pendingOutcome, reasoning);
      setShowDialog(false);
      setReasoning('');
      setPendingOutcome(null);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setReasoning('');
    setPendingOutcome(null);
  };

  const hasAnalyses = auditCase.analyses.length > 0;
  const hasCompleteAnalyses = auditCase.analyses.some(a => a.status === 'complete');

  // Suppress confident auto-approve when human review is required
  const suppressAutoApprove = humanReviewRequired &&
    (disposition?.disposition === 'human_review_required' || disposition?.disposition === 'not_defensible');

  const getOutcomeDetails = () => {
    switch (pendingOutcome) {
      case 'approved':
        return {
          title: 'Approve Claim',
          description: suppressAutoApprove
            ? '⚠ This case has been flagged for human review. By approving, you are overriding the automated recommendation. Please provide detailed justification.'
            : 'You are approving this claim for payment. Please document your reasoning for this decision.',
        };
      case 'rejected':
        return {
          title: 'Reject Claim',
          description: 'You are rejecting this claim. Please provide detailed reasoning that will be shared with the provider.',
        };
      case 'info-requested':
        return {
          title: 'Request Additional Information',
          description: 'You are requesting more information before making a final decision. Specify what documentation is needed.',
        };
      default:
        return { title: '', description: '' };
    }
  };

  const outcomeDetails = getOutcomeDetails();

  return (
    <AuthGate>
      <>
        <Card className="fixed bottom-0 left-0 right-0 z-50 p-4 border-t-2 border-accent bg-card shadow-[0_-4px_20px_-4px_hsl(var(--foreground)/0.1)] rounded-none">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-sm">Audit Decision</h3>
              {humanReviewRequired && (
                <Badge variant="outline" className="text-[10px] border-violation/40 text-violation bg-violation/10 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Human Review Required
                </Badge>
              )}
              {disposition && (
                <Badge variant="outline" className={cn("text-[10px]", disposition.borderClass, disposition.bgClass, disposition.colorClass)}>
                  {disposition.label}
                </Badge>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                onClick={() => handleDecisionClick('approved')}
                disabled={!hasCompleteAnalyses}
                variant={suppressAutoApprove ? 'outline' : 'default'}
                className={cn(
                  'flex-1',
                  suppressAutoApprove
                    ? 'border-consensus/30 text-consensus hover:bg-consensus/10'
                    : 'bg-consensus hover:bg-consensus/90 text-consensus-foreground'
                )}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {suppressAutoApprove ? 'Manual Approval Override' : 'Approve Claim'}
              </Button>

              <Button
                onClick={() => handleDecisionClick('info-requested')}
                disabled={!hasCompleteAnalyses}
                variant="outline"
                className="flex-1"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Request Information
              </Button>

              <Button
                onClick={() => handleDecisionClick('rejected')}
                disabled={!hasCompleteAnalyses}
                variant="destructive"
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Claim
              </Button>
            </div>

            {!hasCompleteAnalyses && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {hasAnalyses
                  ? 'Analysis in progress — decision available when complete.'
                  : 'Waiting for AI analysis to begin.'}
              </p>
            )}
          </div>
        </Card>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>{outcomeDetails.title}</DialogTitle>
              <DialogDescription>
                {outcomeDetails.description}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="reasoning">Reasoning *</Label>
              <Textarea
                id="reasoning"
                placeholder="Enter your reasoning and notes..."
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This will be included in the audit trail and decision record.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                onClick={confirmDecision}
                disabled={!reasoning.trim()}
                className={
                  pendingOutcome === 'approved' ? 'bg-consensus hover:bg-consensus/90 text-consensus-foreground' : ''
                }
              >
                Confirm Decision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </AuthGate>
  );
}
