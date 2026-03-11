import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import type { ProviderCaseReview, ReadinessLevel } from '@/lib/providerTypes';
import { FileText, ShieldCheck, AlertTriangle, Clock, Target } from 'lucide-react';

const readinessConfig: Record<ReadinessLevel, { label: string; className: string; progressValue: number }> = {
  strong: { label: 'Strong', className: 'border-consensus/40 text-consensus bg-consensus/10', progressValue: 90 },
  moderate: { label: 'Moderate', className: 'border-disagreement/40 text-disagreement bg-disagreement/10', progressValue: 60 },
  weak: { label: 'Weak', className: 'border-violation/40 text-violation bg-violation/10', progressValue: 35 },
  insufficient: { label: 'Insufficient', className: 'border-destructive/40 text-destructive bg-destructive/10', progressValue: 10 },
};

interface ProviderCaseReviewProps {
  review: ProviderCaseReview;
}

export function ProviderCaseReviewCard({ review }: ProviderCaseReviewProps) {
  const docConfig = readinessConfig[review.documentationSufficiency];
  const timeConfig = readinessConfig[review.timelineConsistency];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Readiness Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Documentation Sufficiency</span>
            </div>
            <Badge variant="outline" className={`text-xs ${docConfig.className}`}>{docConfig.label}</Badge>
            <Progress value={docConfig.progressValue} className="h-1.5 mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Timeline Consistency</span>
            </div>
            <Badge variant="outline" className={`text-xs ${timeConfig.className}`}>{timeConfig.label}</Badge>
            <Progress value={timeConfig.progressValue} className="h-1.5 mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Appeal Viability</span>
            </div>
            <Badge variant="outline" className={`text-xs ${
              review.appealAssessment.viability === 'recommended' ? 'border-consensus/40 text-consensus bg-consensus/10' :
              review.appealAssessment.viability === 'conditional' ? 'border-disagreement/40 text-disagreement bg-disagreement/10' :
              'border-violation/40 text-violation bg-violation/10'
            }`}>
              {review.appealAssessment.viability === 'recommended' ? 'Likely Supportable' :
               review.appealAssessment.viability === 'conditional' ? 'Conditional — Records Needed' :
               'Appeal Not Recommended'}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Est. success: {review.appealAssessment.estimatedSuccessRate}% • Effort: ~{review.appealAssessment.estimatedEffortHours}hrs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Documentation Assessments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            Documentation Review
          </CardTitle>
          <CardDescription>Readiness indicators for each documentation category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {review.documentationAssessments.map((assess, i) => {
              const cfg = readinessConfig[assess.status];
              return (
                <div key={i} className="p-3 rounded-md border bg-background">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                    <span className="text-sm font-medium">{assess.category}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{assess.detail}</p>
                  <div className="mt-2 p-2 rounded bg-muted/50">
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Why it matters:</span> {assess.whyItMatters}</p>
                    <p className="text-[11px] text-muted-foreground mt-1"><span className="font-medium text-foreground">Recommendation:</span> {assess.recommendation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Coding Vulnerabilities */}
      {review.codingVulnerabilities.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-disagreement" />
              Coding Vulnerabilities
            </CardTitle>
            <CardDescription>Areas where coding may be subject to review considerations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {review.codingVulnerabilities.map((vuln, i) => {
                const cfg = readinessConfig[vuln.severity];
                return (
                  <div key={i} className="p-3 rounded-md border bg-background">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="font-mono text-[10px]">{vuln.code}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                      {vuln.isCorrectible && (
                        <Badge variant="outline" className="text-[10px] border-consensus/40 text-consensus bg-consensus/10">Correctible</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{vuln.issue}</p>
                    <p className="text-xs text-muted-foreground mt-1.5"><span className="font-medium text-foreground">Recommendation:</span> {vuln.recommendation}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Denial Pressure Points */}
      {review.denialPressurePoints.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-violation" />
              Denial Pressure Points
            </CardTitle>
            <CardDescription>Factors most likely to contribute to denial risk</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {review.denialPressurePoints.map((point, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-violation/5 border border-violation/15">
                  <span className="text-xs text-violation font-medium">•</span>
                  <p className="text-xs text-muted-foreground">{point}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
