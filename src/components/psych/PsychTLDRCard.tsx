import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, Wrench, BadgeAlert, Zap, AlertTriangle, DollarSign, ListChecks,
} from 'lucide-react';
import type { PsychAuditResult } from '@/lib/psychTypes';

/**
 * TL;DR card — sits at the very top of the Behavioral Health case detail.
 * Designed for non-coders: one-line verdict, then bullet points of what to fix,
 * any missed-revenue opportunity, and the single biggest risk factor.
 */
export function PsychTLDRCard({ result }: { result: PsychAuditResult }) {
  const verdict = getVerdict(result);
  const topFixes = result.smallestFixes.slice(0, 5);
  const topRevenue = result.missedRevenue[0];
  const topRisk = result.denialRiskFactors[0];

  return (
    <Card className={cn('border-l-4', verdict.borderClass)}>
      <CardContent className="py-4 px-4 space-y-3">
        {/* Verdict line */}
        <div className="flex items-start gap-3">
          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', verdict.bgClass)}>
            <verdict.Icon className={cn('h-5 w-5', verdict.colorClass)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn('text-sm font-bold', verdict.colorClass)}>{verdict.label}</p>
              <Badge variant="outline" className="text-[9px] uppercase tracking-wide">TL;DR</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{verdict.subtext}</p>
          </div>
        </div>

        {/* What to fix */}
        {topFixes.length > 0 && (
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-foreground">What to fix</p>
            </div>
            <ol className="space-y-1.5">
              {topFixes.map((fix) => (
                <li key={fix.priority} className="flex items-start gap-2 text-xs">
                  <span className="font-bold text-muted-foreground shrink-0 w-4">{fix.priority}.</span>
                  <span className="text-foreground leading-snug">{fix.description}</span>
                </li>
              ))}
            </ol>
            {result.smallestFixes.length > topFixes.length && (
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                +{result.smallestFixes.length - topFixes.length} more in the full checklist below
              </p>
            )}
          </div>
        )}

        {/* No fixes generated */}
        {topFixes.length === 0 && verdict.tone !== 'good' && (
          <div className="rounded-md border bg-background/60 p-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>No quick-fix list was generated. Scroll down to the <span className="font-medium text-foreground">Full Pre-Submission Checklist</span> for every flagged item.</p>
            </div>
          </div>
        )}

        {/* Missed revenue + biggest risk (side by side on wider screens) */}
        {(topRevenue || topRisk) && (
          <div className="grid sm:grid-cols-2 gap-2">
            {topRevenue && (
              <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-[11px] font-semibold text-foreground">Possible missed revenue</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <span className="font-mono text-foreground">{topRevenue.currentCode}</span>
                  {topRevenue.suggestedCode && (
                    <> → <span className="font-mono text-blue-600 dark:text-blue-400">{topRevenue.suggestedCode}</span></>
                  )}
                  {topRevenue.estimatedDifference != null && (
                    <span className="text-blue-600 dark:text-blue-400 font-medium"> · +${topRevenue.estimatedDifference}</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{topRevenue.description}</p>
                {result.missedRevenue.length > 1 && (
                  <p className="text-[9px] text-muted-foreground/70 mt-1 italic">
                    +{result.missedRevenue.length - 1} more opportunity{result.missedRevenue.length - 1 === 1 ? '' : 'ies'}
                  </p>
                )}
              </div>
            )}
            {topRisk && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-[11px] font-semibold text-foreground">Biggest denial risk</p>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{topRisk}</p>
                {result.denialRiskFactors.length > 1 && (
                  <p className="text-[9px] text-muted-foreground/70 mt-1 italic">
                    +{result.denialRiskFactors.length - 1} more risk factor{result.denialRiskFactors.length - 1 === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getVerdict(r: PsychAuditResult) {
  if (r.submitRecommendation === 'submit-now') {
    return {
      tone: 'good' as const,
      label: 'Looks ready to submit',
      subtext: 'No blocking issues found. Review the checklist below to confirm.',
      Icon: CheckCircle2,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-l-emerald-500',
    };
  }
  if (r.submitRecommendation === 'fix-first') {
    return {
      tone: 'fix' as const,
      label: 'Fix these before submitting',
      subtext: 'Most issues are correctable in a few minutes. See the bullet list below.',
      Icon: Wrench,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10',
      borderClass: 'border-l-amber-500',
    };
  }
  return {
    tone: 'review' as const,
    label: 'Needs human review',
    subtext: 'This case has issues that should be looked at by a person before submission.',
    Icon: BadgeAlert,
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-l-destructive',
  };
}
