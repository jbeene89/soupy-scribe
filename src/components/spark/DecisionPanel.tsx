import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AuditCase } from '@/lib/types';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

interface DecisionPanelProps {
  auditCase: AuditCase;
  onDecision: (outcome: 'approved' | 'rejected' | 'info-requested', reasoning: string) => void;
}

export function DecisionPanel({ auditCase, onDecision }: DecisionPanelProps) {
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

  const getOutcomeDetails = () => {
    switch (pendingOutcome) {
      case 'approved':
        return {
          title: 'Approve Claim',
          description: 'You are approving this claim for payment. Please document your reasoning for this decision.',
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
    <>
      <Card className="sticky bottom-0 left-0 right-0 p-4 sm:p-6 border-t-2 border-accent bg-card shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h3 className="font-semibold mb-3 sm:mb-4">Audit Decision</h3>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <Button
              onClick={() => handleDecisionClick('approved')}
              disabled={!hasAnalyses}
              className="flex-1 bg-consensus hover:bg-consensus/90 text-consensus-foreground"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Claim
            </Button>

            <Button
              onClick={() => handleDecisionClick('info-requested')}
              disabled={!hasAnalyses}
              variant="outline"
              className="flex-1"
            >
              <HelpCircle className="h-4 w-4 mr-2" />
              Request Information
            </Button>

            <Button
              onClick={() => handleDecisionClick('rejected')}
              disabled={!hasAnalyses}
              variant="destructive"
              className="flex-1"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Claim
            </Button>
          </div>

          {!hasAnalyses && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {hasCompleteAnalyses
                ? 'Some AI analyses are still running...'
                : 'Waiting for all AI analyses to complete...'}
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
  );
}
