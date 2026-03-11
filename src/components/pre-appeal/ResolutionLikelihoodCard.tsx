import type { ResolutionAssessment, ResolutionLikelihood } from '@/lib/preAppealTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const likelihoodConfig: Record<ResolutionLikelihood, { label: string; color: string; bgColor: string }> = {
  'likely-resolvable-clarification': { label: 'Likely Resolvable Through Clarification', color: 'text-consensus', bgColor: 'bg-consensus' },
  'likely-resolvable-records': { label: 'Likely Resolvable Through Additional Records', color: 'text-consensus', bgColor: 'bg-consensus' },
  'partially-resolvable': { label: 'Partially Resolvable / Downcode Candidate', color: 'text-disagreement', bgColor: 'bg-disagreement' },
  'weak-candidate': { label: 'Weak Candidate for Reconsideration', color: 'text-violation', bgColor: 'bg-violation' },
  'requires-formal-appeal': { label: 'Likely Requires Formal Appeal', color: 'text-info-blue', bgColor: 'bg-info-blue' },
  'not-supportable': { label: 'Not Likely Supportable', color: 'text-violation', bgColor: 'bg-violation' },
};

interface ResolutionLikelihoodCardProps {
  assessment: ResolutionAssessment;
}

export function ResolutionLikelihoodCard({ assessment }: ResolutionLikelihoodCardProps) {
  const config = likelihoodConfig[assessment.likelihood];
  const isPositive = assessment.confidence >= 75;
  const isNeutral = assessment.confidence >= 50 && assessment.confidence < 75;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Resolution Likelihood</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {isPositive ? (
            <TrendingUp className={cn('h-5 w-5', config.color)} />
          ) : isNeutral ? (
            <Minus className={cn('h-5 w-5', config.color)} />
          ) : (
            <TrendingDown className={cn('h-5 w-5', config.color)} />
          )}
          <div className="flex-1">
            <p className={cn('text-sm font-semibold', config.color)}>{config.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={assessment.confidence} className="h-2 flex-1" />
              <span className="text-xs font-mono text-muted-foreground">{assessment.confidence}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Confidence in assessment</p>
          </div>
        </div>

        {assessment.whatIsMissing.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">What Is Missing</p>
            <ul className="space-y-1">
              {assessment.whatIsMissing.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-violation mt-0.5">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {assessment.whatWouldChangeResult.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">What Would Change the Result</p>
            <ul className="space-y-1">
              {assessment.whatWouldChangeResult.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-consensus mt-0.5">•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
