import type { PreAppealResolution } from '@/lib/preAppealTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ResolutionSummaryProps {
  resolution: PreAppealResolution;
  viewMode: 'provider' | 'payer';
}

export function ResolutionSummary({ resolution, viewMode }: ResolutionSummaryProps) {
  if (viewMode === 'provider') {
    const ps = resolution.providerSummary;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Provider Resolution Summary</CardTitle>
          <p className="text-xs text-muted-foreground">Pre-appeal resolution assessment for your review</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-sm text-foreground">{ps.whyResolvableQuickly}</p>
          </div>

          <div>
            <p className="text-xs font-medium mb-1.5">What Is Needed</p>
            <ul className="space-y-1">
              {ps.exactlyNeeded.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mt-0.5 shrink-0 text-consensus" />{item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-medium mb-1.5">Do Not Waste Time On</p>
            <ul className="space-y-1">
              {ps.doNotWasteTimeOn.map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <XCircle className="h-3 w-3 mt-0.5 shrink-0 text-violation" />{item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 flex-wrap">
            {ps.appearsCurable ? (
              <Badge variant="outline" className="text-xs border-consensus/40 text-consensus bg-consensus/10">Appears Curable</Badge>
            ) : (
              <Badge variant="outline" className="text-xs border-violation/40 text-violation bg-violation/10">Does Not Appear Curable</Badge>
            )}
            {ps.fullAppealPoorUse && (
              <Badge variant="outline" className="text-xs border-disagreement/40 text-disagreement bg-disagreement/10">
                Full Appeal Likely Not Best Use of Resources
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Payer view
  const pys = resolution.payerSummary;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Payer Resolution Summary</CardTitle>
        <p className="text-xs text-muted-foreground">Internal pre-appeal resolution assessment</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {pys.issueAppearsCurable ? (
            <Badge variant="outline" className="text-xs border-consensus/40 text-consensus bg-consensus/10 gap-1">
              <CheckCircle className="h-3 w-3" />Issue Appears Curable
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-violation/40 text-violation bg-violation/10 gap-1">
              <XCircle className="h-3 w-3" />Issue Does Not Appear Curable
            </Badge>
          )}
          {pys.partialReversalPossible && (
            <Badge variant="outline" className="text-xs border-disagreement/40 text-disagreement bg-disagreement/10 gap-1">
              <AlertTriangle className="h-3 w-3" />Partial Reversal Possible
            </Badge>
          )}
          {pys.moveToStandardAppeal && (
            <Badge variant="outline" className="text-xs border-info-blue/40 text-info-blue bg-info-blue/10">
              Route to Standard Appeal
            </Badge>
          )}
        </div>

        {pys.clarificationNeeded.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5">Clarification / Documents Needed</p>
            <ul className="space-y-1">
              {pys.clarificationNeeded.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-accent mt-0.5">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pys.denialStandsWithoutSupport && (
          <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-2">
            Current denial stands without additional supporting documentation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
