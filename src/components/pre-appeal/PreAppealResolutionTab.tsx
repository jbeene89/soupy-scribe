import type { PreAppealResolution } from '@/lib/preAppealTypes';
import type { AuditCase } from '@/lib/types';
import { CurabilityBadge } from './CurabilityBadge';
import { IssueClassification } from './IssueClassification';
import { ResolutionLikelihoodCard } from './ResolutionLikelihoodCard';
import { RapidResolutionChecklist } from './RapidResolutionChecklist';
import { ProviderSubmissionBuilder } from './ProviderSubmissionBuilder';
import { PayerReviewPanel } from './PayerReviewPanel';
import { DispositionCard } from './DispositionCard';
import { ResolutionSummary } from './ResolutionSummary';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Zap, Info } from 'lucide-react';

interface PreAppealResolutionTabProps {
  auditCase: AuditCase;
  resolution: PreAppealResolution;
  viewMode: 'payer' | 'provider';
}

export function PreAppealResolutionTab({ auditCase, resolution, viewMode }: PreAppealResolutionTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold">Pre-Appeal Resolution</h3>
          <Badge variant="outline" className="text-[10px] border-accent/40 text-accent bg-accent/10">Optional Accelerated Path</Badge>
        </div>
        <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            This is an optional structured reconsideration workflow for selected denials. It does not replace formal appeal rights or standard payer review processes. Standard appeal channels remain available.
          </p>
        </div>
      </div>

      {/* Claim Snapshot + Curability */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Denial / Rejection Reason</p>
            <p className="text-sm font-medium mt-0.5">{resolution.denialReason}</p>
          </div>
          <CurabilityBadge status={resolution.curability} size="lg" />
        </div>
      </div>

      {/* Disposition */}
      <DispositionCard disposition={resolution.recommendedDisposition} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ResolutionLikelihoodCard assessment={resolution.resolution} />
          <IssueClassification issues={resolution.issues} />
        </div>

        <div className="space-y-6">
          <ResolutionSummary resolution={resolution} viewMode={viewMode} />
          <RapidResolutionChecklist items={resolution.evidenceChecklist} />
        </div>
      </div>

      <Separator />

      {/* Action panels based on view mode */}
      {viewMode === 'provider' ? (
        <ProviderSubmissionBuilder resolution={resolution} />
      ) : (
        <PayerReviewPanel existingResponse={resolution.payerResponse} />
      )}
    </div>
  );
}
