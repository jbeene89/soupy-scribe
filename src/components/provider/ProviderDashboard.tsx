import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ProviderDashboardStats } from '@/lib/providerTypes';
import { providerDashboardStats as mockDashboardStats } from '@/lib/providerMockData';
import { computeProviderDashboardStats } from '@/lib/providerService';
import {
  ROOT_CAUSE_LABELS, REMEDIATION_TYPE_LABELS,
  PATTERN_SEVERITY_LABELS, PATTERN_SEVERITY_COLORS,
} from '@/lib/providerReadinessEngine';
import { exportProviderReadinessPDF } from '@/lib/exportProviderReadinessPDF';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  FileWarning, ShieldAlert, TrendingDown, GraduationCap,
  DollarSign, ClipboardCheck, AlertTriangle, ChevronDown,
  ChevronUp, Wrench, Target, Ban, ArrowUpRight, Lightbulb,
  BarChart3, Download,
} from 'lucide-react';

const statCards = [
  { label: 'Cases Reviewed', icon: ClipboardCheck, colorClass: 'text-accent', bgClass: 'bg-accent/10', getValue: (s: ProviderDashboardStats) => s.totalCasesReviewed },
  { label: 'Documentation Weakness', icon: FileWarning, colorClass: 'text-disagreement', bgClass: 'bg-disagreement/10', getValue: (s: ProviderDashboardStats) => s.documentationWeakCases },
  { label: 'Coding Vulnerability', icon: ShieldAlert, colorClass: 'text-violation', bgClass: 'bg-violation/10', getValue: (s: ProviderDashboardStats) => s.codingVulnerableCases },
  { label: 'Appeals Not Recommended', icon: TrendingDown, colorClass: 'text-muted-foreground', bgClass: 'bg-muted', getValue: (s: ProviderDashboardStats) => s.appealsNotWorthPursuing },
];

interface ProviderDashboardProps {
  dataSource?: 'mock' | 'live';
}

export function ProviderDashboard({ dataSource = 'mock' }: ProviderDashboardProps) {
  const [liveStats, setLiveStats] = useState<ProviderDashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [themesExpanded, setThemesExpanded] = useState(false);
  const [interventionsExpanded, setInterventionsExpanded] = useState(false);

  useEffect(() => {
    if (dataSource === 'mock') {
      setLiveStats(null);
      return;
    }
    setLoading(true);
    computeProviderDashboardStats()
      .then(s => setLiveStats(s))
      .catch(() => setLiveStats(null))
      .finally(() => setLoading(false));
  }, [dataSource]);

  const stats = dataSource === 'live' && liveStats
    ? liveStats
    : dataSource === 'live' && loading
      ? null
      : mockDashboardStats;

  if (!stats) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const totalAvoidable = stats.avoidableDenialBreakdown;
  const totalBreakdownSum = totalAvoidable.documentationGaps + totalAvoidable.codingErrors + totalAvoidable.modifierIssues + totalAvoidable.timeDocumentation;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ Value Banner ═══ */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-accent/15 shrink-0">
              <ClipboardCheck className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold mb-1">Provider Readiness Overview</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Identify preventable denials, recurring documentation patterns, and operational improvements. 
                    This view helps reduce denial rates and improve staff documentation practices — 
                    focus on prevention, not just appeals.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  onClick={() => {
                    exportProviderReadinessPDF(stats);
                    toast.success('Provider readiness PDF downloaded');
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export PDF
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ 1–4. Stat Cards ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, icon: Icon, colorClass, bgClass, getValue }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', bgClass)}>
                  <Icon className={cn('h-4 w-4', colorClass)} />
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

      {/* ═══ 5. Avoidable Denial Cost + Breakdown ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-consensus" />
              Estimated Avoidable Denial Cost
            </CardTitle>
            <CardDescription>Projected savings from documentation and coding improvements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-consensus">${stats.estimatedAvoidableDenialCost.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Based on {stats.documentationWeakCases} cases with documentation insufficiency</p>
            
            {/* Breakdown */}
            {totalBreakdownSum > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Cost Breakdown by Root Cause</p>
                <p className="text-[10px] text-muted-foreground italic">
                  Formula: cases affected × avg claim value × denial probability (70% high / 40% medium / 15% low)
                </p>
                {[
                  { label: 'Documentation Gaps', value: totalAvoidable.documentationGaps, color: 'bg-disagreement' },
                  { label: 'Coding Errors', value: totalAvoidable.codingErrors, color: 'bg-violation' },
                  { label: 'Modifier Issues', value: totalAvoidable.modifierIssues, color: 'bg-accent' },
                  { label: 'Time Documentation', value: totalAvoidable.timeDocumentation, color: 'bg-info-blue' },
                ].filter(b => b.value > 0).map(b => (
                  <div key={b.label} className="flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', b.color)} />
                    <span className="text-xs flex-1">{b.label}</span>
                    <span className="text-xs font-mono font-semibold">${b.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ 6. Staff Education Opportunities ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-info-blue" />
              Staff Education Opportunities
            </CardTitle>
            <CardDescription>Recurring issues that suggest training needs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-info-blue">{stats.staffEducationOpportunities}</p>
            <p className="text-xs text-muted-foreground">Recurring patterns identified across reviewed cases</p>
            
            {/* Quick education summary */}
            <div className="space-y-1.5 pt-2 border-t">
              {stats.recurringThemes
                .filter(t => t.educationOpportunity)
                .slice(0, 3)
                .map(t => (
                  <div key={t.id} className="flex items-start gap-2">
                    <Lightbulb className="h-3 w-3 text-info-blue shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{t.educationOpportunity}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ 7. Top Correctable Patterns ═══ */}
      {stats.correctablePatterns.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-consensus" />
              Top Correctable Patterns
            </CardTitle>
            <CardDescription>Issues that can be fixed to prevent future denials — sorted by revenue impact</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.correctablePatterns.slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-md border bg-background">
                  <span className="text-xs font-mono text-muted-foreground w-5 pt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{p.title}</p>
                      {p.isCorrectible ? (
                        <Badge variant="outline" className="text-[9px] border-consensus/30 text-consensus">Correctable</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] border-violation/30 text-violation">Structural</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{p.casesAffected}</span> cases</span>
                      <span>•</span>
                      <span className="font-semibold text-consensus">${p.estimatedRevenue.toLocaleString()}</span> est. impact
                      <span>•</span>
                      <span>{ROOT_CAUSE_LABELS[p.rootCause]}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{p.correctiveAction}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 8. High-Risk Operational Behaviors ═══ */}
      {stats.highRiskBehaviors.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-violation" />
              High-Risk Operational Behaviors
            </CardTitle>
            <CardDescription>Patterns with significant audit or denial exposure — address first</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.highRiskBehaviors.map(b => {
                const colors = PATTERN_SEVERITY_COLORS[b.riskLevel];
                return (
                  <div key={b.id} className={cn('p-3 rounded-md border', colors.bg, colors.border)}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={cn('text-[9px]', colors.text, colors.border)}>
                        {PATTERN_SEVERITY_LABELS[b.riskLevel]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{b.casesAffected} cases</span>
                    </div>
                    <p className="text-sm font-medium">{b.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{b.description}</p>
                    <div className="flex items-start gap-1.5 mt-2">
                      <ArrowUpRight className="h-3 w-3 text-consensus shrink-0 mt-0.5" />
                      <p className="text-[11px] text-consensus">{b.suggestedAction}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Recurring Documentation Themes ═══ */}
      {stats.recurringThemes.length > 0 && (
        <Card>
          <Collapsible open={themesExpanded} onOpenChange={setThemesExpanded}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="w-full text-left">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Recurring Documentation Themes
                    <Badge variant="outline" className="text-[9px]">{stats.recurringThemes.length}</Badge>
                  </CardTitle>
                  {themesExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
                <CardDescription className="mt-1">Patterns that suggest operational improvement and staff education opportunities</CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {stats.recurringThemes.map(theme => {
                    const severity = theme.patternSeverity || 'medium_recurring_weakness';
                    const colors = PATTERN_SEVERITY_COLORS[severity];
                    return (
                      <div key={theme.id} className="p-3 rounded-md border bg-background space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('text-[9px]', colors.text, colors.border)}>
                            {PATTERN_SEVERITY_LABELS[severity]}
                          </Badge>
                          {theme.rootCause && (
                            <Badge variant="outline" className="text-[9px] text-muted-foreground">
                              {ROOT_CAUSE_LABELS[theme.rootCause]}
                            </Badge>
                          )}
                          {theme.fixUpstreamInstead && (
                            <Badge variant="outline" className="text-[9px] border-info-blue/30 text-info-blue">
                              Fix Upstream
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{theme.title}</p>
                        <p className="text-[11px] text-muted-foreground">{theme.whyItMatters || theme.description}</p>
                        
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span><span className="font-semibold text-foreground">{theme.frequency}</span> cases affected</span>
                          {theme.estimatedDenialImpact && theme.estimatedDenialImpact > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-disagreement">${theme.estimatedDenialImpact.toLocaleString()}</span> est. denial impact
                            </>
                          )}
                          {theme.remediationType && (
                            <>
                              <span>•</span>
                              <span>{REMEDIATION_TYPE_LABELS[theme.remediationType]}</span>
                            </>
                          )}
                        </div>

                        {theme.educationOpportunity && (
                          <div className="flex items-start gap-1.5 pt-1">
                            <Lightbulb className="h-3 w-3 text-info-blue shrink-0 mt-0.5" />
                            <p className="text-[11px] text-info-blue">{theme.educationOpportunity}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* ═══ Recommended Interventions ═══ */}
      {stats.recommendedInterventions.length > 0 && (
        <Card>
          <Collapsible open={interventionsExpanded} onOpenChange={setInterventionsExpanded}>
            <CardHeader className="pb-3">
              <CollapsibleTrigger className="w-full text-left">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-consensus" />
                    Recommended Interventions
                    <Badge variant="outline" className="text-[9px]">{stats.recommendedInterventions.length}</Badge>
                  </CardTitle>
                  {interventionsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
                <CardDescription className="mt-1">Operational changes that address the root causes of recurring patterns</CardDescription>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {stats.recommendedInterventions.map(int => {
                    const priorityColors = {
                      critical: 'text-destructive border-destructive/30',
                      high: 'text-violation border-violation/30',
                      medium: 'text-disagreement border-disagreement/30',
                      low: 'text-muted-foreground border-muted',
                    };
                    const effortColors = {
                      low: 'text-consensus',
                      medium: 'text-disagreement',
                      high: 'text-violation',
                    };
                    return (
                      <div key={int.id} className="p-3 rounded-md border bg-background space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('text-[9px]', priorityColors[int.priority])}>
                            {int.priority} priority
                          </Badge>
                          <Badge variant="outline" className="text-[9px] text-muted-foreground">
                            {int.typeLabel}
                          </Badge>
                          <span className={cn('text-[10px]', effortColors[int.implementationEffort])}>
                            {int.implementationEffort} effort
                          </span>
                        </div>
                        <p className="text-sm font-medium">{int.title}</p>
                        <p className="text-[11px] text-muted-foreground">{int.description}</p>
                        <p className="text-[11px] text-consensus">{int.estimatedImpact}</p>
                        
                        {int.affectedPatterns.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Addresses:</span>
                            {int.affectedPatterns.map((p, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] text-muted-foreground">{p}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* ═══ Top Vulnerabilities ═══ */}
      {stats.topVulnerabilities.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ban className="h-4 w-4 text-disagreement" />
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
      )}

      <p className="text-[10px] text-muted-foreground italic text-center">
        Provider readiness insights are operational guidance for prevention and education — not audit determinations.
      </p>
    </div>
  );
}
