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
import { ArrowLeft } from 'lucide-react';

interface ProviderCaseDetailProps {
  auditCase: AuditCase;
  onBack: () => void;
}

export function ProviderCaseDetail({ auditCase, onBack }: ProviderCaseDetailProps) {
  const review = providerReviews[auditCase.id];

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

      {review ? (
        <Tabs defaultValue="review" className="space-y-4">
          <TabsList>
            <TabsTrigger value="review">Readiness Review</TabsTrigger>
            <TabsTrigger value="appeal">Appeal Assessment</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Checklist</TabsTrigger>
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
        </Tabs>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <p className="text-muted-foreground">Provider readiness review not yet available for this case.</p>
          <p className="text-xs text-muted-foreground mt-2">Submit this case for compliance readiness analysis to see documentation sufficiency, coding vulnerability, and appeal viability indicators.</p>
        </div>
      )}
    </div>
  );
}
