import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { RecurringIssue } from '@/lib/providerTypes';
import { recurringIssues } from '@/lib/providerMockData';
import { GraduationCap, TrendingUp, AlertTriangle } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  'modifier-misuse': 'Modifier Usage',
  'documentation-gap': 'Documentation Gap',
  'time-element': 'Time Documentation',
  'medical-necessity': 'Medical Necessity',
  'em-separation': 'E/M Separation',
  'addon-vulnerability': 'Add-on Code Risk',
};

export function EducationInsights() {
  const highImpact = recurringIssues.filter(i => i.impact === 'high');
  const mediumImpact = recurringIssues.filter(i => i.impact === 'medium');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <Card className="border-info-blue/30 bg-info-blue/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-info-blue/15 shrink-0">
              <GraduationCap className="h-5 w-5 text-info-blue" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold mb-1">Operational Improvement Insights</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Recurring patterns identified across reviewed cases that suggest staff education and 
                process improvement opportunities. Addressing these patterns can reduce preventable 
                denials and improve documentation quality across your practice.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-semibold text-violation">{highImpact.length}</p>
            <p className="text-xs text-muted-foreground">High-Impact Issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-semibold text-disagreement">{mediumImpact.length}</p>
            <p className="text-xs text-muted-foreground">Moderate-Impact Issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{recurringIssues.reduce((sum, i) => sum + i.frequency, 0)}</p>
            <p className="text-xs text-muted-foreground">Total Cases Affected</p>
          </CardContent>
        </Card>
      </div>

      {/* Issue Cards */}
      <div className="space-y-4">
        {recurringIssues.map(issue => (
          <Card key={issue.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-2">
                <CardTitle className="text-sm flex-1">{issue.title}</CardTitle>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{categoryLabels[issue.category]}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${
                    issue.impact === 'high' ? 'border-violation/40 text-violation bg-violation/10' : 'border-disagreement/40 text-disagreement bg-disagreement/10'
                  }`}>{issue.impact} impact</Badge>
                  <Badge variant="outline" className="text-[10px]">{issue.frequency} cases</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{issue.description}</p>
              <Separator className="mb-3" />
              <div className="p-3 rounded-md bg-info-blue/5 border border-info-blue/15">
                <div className="flex items-center gap-2 mb-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-info-blue" />
                  <span className="text-xs font-semibold text-info-blue">Education Opportunity</span>
                </div>
                <p className="text-xs text-muted-foreground">{issue.educationOpportunity}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
