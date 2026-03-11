import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { ProviderDashboardStats } from '@/lib/providerTypes';
import { providerDashboardStats } from '@/lib/providerMockData';
import {
  FileWarning, ShieldAlert, TrendingDown, GraduationCap,
  DollarSign, ClipboardCheck, AlertTriangle, ArrowRight,
} from 'lucide-react';

const statCards = [
  { label: 'Cases Reviewed', icon: ClipboardCheck, colorClass: 'text-accent', bgClass: 'bg-accent/10', getValue: (s: ProviderDashboardStats) => s.totalCasesReviewed },
  { label: 'Documentation Weakness', icon: FileWarning, colorClass: 'text-disagreement', bgClass: 'bg-disagreement/10', getValue: (s: ProviderDashboardStats) => s.documentationWeakCases },
  { label: 'Coding Vulnerability', icon: ShieldAlert, colorClass: 'text-violation', bgClass: 'bg-violation/10', getValue: (s: ProviderDashboardStats) => s.codingVulnerableCases },
  { label: 'Appeals Not Recommended', icon: TrendingDown, colorClass: 'text-muted-foreground', bgClass: 'bg-muted', getValue: (s: ProviderDashboardStats) => s.appealsNotWorthPursuing },
];

export function ProviderDashboard() {
  const stats = providerDashboardStats;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Value Banner */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-accent/15 shrink-0">
              <ClipboardCheck className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold mb-1">Provider Readiness Overview</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Review your compliance readiness, identify documentation improvement opportunities, 
                and prioritize which denials merit appeal resources. This view helps reduce preventable 
                denials and improve staff documentation practices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, icon: Icon, colorClass, bgClass, getValue }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bgClass} shrink-0`}>
                  <Icon className={`h-4 w-4 ${colorClass}`} />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{getValue(stats)}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Impact + Education Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-consensus" />
              Estimated Avoidable Denial Cost
            </CardTitle>
            <CardDescription>Projected savings from documentation improvements</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-consensus">${stats.estimatedAvoidableDenialCost.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Based on {stats.documentationWeakCases} cases with documentation insufficiency</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-info-blue" />
              Staff Education Opportunities
            </CardTitle>
            <CardDescription>Recurring issues that suggest training needs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-info-blue">{stats.staffEducationOpportunities}</p>
            <p className="text-xs text-muted-foreground mt-1">Recurring patterns identified across reviewed cases</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Vulnerabilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-disagreement" />
            Top Documentation Vulnerabilities
          </CardTitle>
          <CardDescription>Most frequent areas needing improvement across reviewed cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.topVulnerabilities.map((v, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm">{v}</p>
                  <Progress value={100 - i * 20} className="h-1.5 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recurring Themes Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-accent" />
            Recurring Documentation Themes
          </CardTitle>
          <CardDescription>Patterns that suggest operational improvement and staff education opportunities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recurringThemes.slice(0, 4).map(theme => (
              <div key={theme.id} className="flex items-start gap-3 p-3 rounded-md border bg-background">
                <Badge variant="outline" className={`text-[10px] shrink-0 ${
                  theme.impact === 'high' ? 'border-violation/40 text-violation' : 'border-disagreement/40 text-disagreement'
                }`}>
                  {theme.impact}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{theme.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{theme.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{theme.frequency} cases</span> affected
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
