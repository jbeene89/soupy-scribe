import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { AppealAssessment } from '@/lib/providerTypes';
import { AlertTriangle, CheckCircle, XCircle, ArrowRight, FileText, Clock } from 'lucide-react';

const actionLabels: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  'do-not-appeal': { label: 'Do Not Appeal', icon: XCircle, className: 'text-violation' },
  'gather-records': { label: 'Gather Additional Records', icon: FileText, className: 'text-disagreement' },
  'recode-resubmit': { label: 'Recode and Resubmit', icon: ArrowRight, className: 'text-info-blue' },
  'seek-compliance-review': { label: 'Seek Compliance Review', icon: AlertTriangle, className: 'text-violation' },
  'educate-staff': { label: 'Staff Education Recommended', icon: CheckCircle, className: 'text-accent' },
};

interface ProviderPacketProps {
  assessment: AppealAssessment;
  caseNumber: string;
}

export function ProviderPacket({ assessment, caseNumber }: ProviderPacketProps) {
  const actionConfig = actionLabels[assessment.recommendedAction];
  const ActionIcon = actionConfig.icon;
  const isNotRecommended = assessment.viability === 'not-recommended';

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Appeal Assessment Header */}
      <Card className={isNotRecommended ? 'border-violation/30 bg-violation/5' : assessment.viability === 'conditional' ? 'border-disagreement/30 bg-disagreement/5' : 'border-consensus/30 bg-consensus/5'}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className={`p-2.5 rounded-lg shrink-0 ${isNotRecommended ? 'bg-violation/15' : assessment.viability === 'conditional' ? 'bg-disagreement/15' : 'bg-consensus/15'}`}>
              {isNotRecommended ? <XCircle className="h-5 w-5 text-violation" /> : assessment.viability === 'conditional' ? <AlertTriangle className="h-5 w-5 text-disagreement" /> : <CheckCircle className="h-5 w-5 text-consensus" />}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold mb-1">
                {isNotRecommended ? 'Appeal May Not Be Worth Pursuing' : assessment.viability === 'conditional' ? 'Appeal Conditional on Additional Support' : 'Appeal Appears Supportable'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{assessment.actionRationale}</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-center">
                  <p className={`text-lg font-semibold ${isNotRecommended ? 'text-violation' : assessment.viability === 'conditional' ? 'text-disagreement' : 'text-consensus'}`}>
                    {assessment.estimatedSuccessRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Est. Success Rate</p>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div className="text-center">
                  <p className="text-lg font-semibold text-muted-foreground">{assessment.estimatedEffortHours}hrs</p>
                  <p className="text-[10px] text-muted-foreground">Est. Effort</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Action */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ActionIcon className={`h-4 w-4 ${actionConfig.className}`} />
            Recommended Next Step
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-md border bg-background">
            <p className={`text-sm font-semibold ${actionConfig.className}`}>{actionConfig.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{assessment.actionRationale}</p>
          </div>
        </CardContent>
      </Card>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-consensus">What Supports This Claim</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assessment.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-consensus shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{s}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-violation">Support Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assessment.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <XCircle className="h-3.5 w-3.5 text-violation shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">{w}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Missing Support */}
      {assessment.missingSupport.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-disagreement" />
              Additional Support Needed
            </CardTitle>
            <CardDescription>Records or documentation that could strengthen this case</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {assessment.missingSupport.map((item, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-disagreement/5 border border-disagreement/15">
                  <span className="text-xs text-disagreement font-medium">→</span>
                  <p className="text-xs text-muted-foreground">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
