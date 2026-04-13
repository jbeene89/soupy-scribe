import { useState, useMemo } from 'react';
import type { PhysicianPattern, AuditCase } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CPTCodeBadge } from './CPTCodeBadge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, TrendingUp, ChevronRight, BarChart3, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart as RechartsLine, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

type ChartMetric = 'errorsFound' | 'upchargeAmount' | 'claimAmount' | 'procedureDuration';
type GroupBy = 'dayOfWeek' | 'timeOfDay' | 'anesthesiaType' | 'patientObesity' | 'understaffing' | 'orReadiness' | 'triageAccuracy' | 'postOpFlow';

const METRIC_COLORS: Record<ChartMetric, string> = {
  errorsFound: 'hsl(var(--violation))',
  upchargeAmount: 'hsl(var(--disagreement))',
  claimAmount: 'hsl(var(--info-blue))',
  procedureDuration: 'hsl(var(--role-analyst))',
};

const METRIC_LABELS: Record<ChartMetric, string> = {
  errorsFound: 'Errors Found',
  upchargeAmount: 'Upcharges ($)',
  claimAmount: 'Claim Amount ($)',
  procedureDuration: 'Duration (min)',
};

// Simulated peer benchmark values (would come from aggregated data in production)
const PEER_BENCHMARKS: Record<ChartMetric, number> = {
  errorsFound: 1.2,
  upchargeAmount: 800,
  claimAmount: 8500,
  procedureDuration: 95,
};

const GROUPBY_CONTEXT: Record<GroupBy, { why: string; abnormal: string; actions: string[] }> = {
  dayOfWeek: {
    why: 'Day-of-week patterns reveal scheduling density impacts. Higher error rates on specific days may indicate staffing mismatches, fatigue effects, or resource contention.',
    abnormal: 'Groups exceeding the peer benchmark line suggest disproportionate claim activity or complexity concentration on those days.',
    actions: ['Educate on scheduling density', 'Review staffing ratios by day', 'Pend high-volume day cases for review'],
  },
  timeOfDay: {
    why: 'Time-of-day analysis surfaces fatigue-related patterns and shift-transition risks. Late-day procedures often correlate with higher error rates and longer durations.',
    abnormal: 'Evening/night procedures with elevated metrics may reflect documentation gaps or fatigue-driven coding errors.',
    actions: ['Review shift transition protocols', 'Request records for late-day cases', 'Educate on time-based risk'],
  },
  anesthesiaType: {
    why: 'Anesthesia type correlates with case complexity and billing accuracy. General anesthesia cases tend to have higher claim amounts and more documentation requirements.',
    abnormal: 'Spikes in errors or duration under specific anesthesia types may indicate modifier misuse or documentation gaps.',
    actions: ['Validate modifier usage', 'Request anesthesia records', 'Cross-reference with surgeon patterns'],
  },
  patientObesity: {
    why: 'BMI context affects procedure duration, complication rates, and equipment needs. Obese patients may require additional documentation to support medical necessity.',
    abnormal: 'Significant cost or duration differences between groups may indicate underdocumented complexity adjustments.',
    actions: ['Request BMI documentation', 'Educate on medical necessity for high-BMI', 'Review equipment utilization'],
  },
  understaffing: {
    why: 'Understaffing correlates with increased errors, longer procedures, and documentation gaps. Patterns here suggest systemic operational issues impacting claim integrity.',
    abnormal: 'If understaffed sessions show markedly higher errors or upcharges, it indicates resource constraints driving claim anomalies.',
    actions: ['Escalate staffing patterns to operations', 'Cross-reference with OR readiness events', 'Deny if documentation insufficient'],
  },
  orReadiness: {
    why: 'OR readiness events (dropped implants, sterilization lapses, missing instruments) drive delay costs, affect procedure complexity, and may alter coding. Cases with readiness events often show higher claim amounts.',
    abnormal: 'The "High Events" group indicates cases where multiple OR failures occurred — these drive disproportionate cost and may mask under-documented complexity.',
    actions: ['Review vendor protocols', 'Escalate repeat sterile failures', 'Cross-reference delay costs with claim amounts'],
  },
  triageAccuracy: {
    why: 'Triage accuracy measures how well pre-op booking matches actual surgical complexity. Systematic under-calling affects scheduling, staffing, and cost predictability — and may signal intentional complexity escalation.',
    abnormal: 'Over-duration cases that were booked as routine deserve scrutiny: was the complexity genuinely unpredictable, or was booking accuracy deliberately poor?',
    actions: ['Educate booking staff on complexity indicators', 'Flag predictable mismatches for review', 'Request pre-op imaging documentation'],
  },
  postOpFlow: {
    why: 'Post-op flow bottlenecks (bed unavailability, transport delays) increase patient risk, staff idle time, and resource consumption. They may also correlate with claim timing anomalies.',
    abnormal: 'Cases with flow delays show higher total cost due to extended anesthesia and monitoring — these costs should be validated against billing.',
    actions: ['Review PACU capacity planning', 'Optimize discharge timing', 'Validate extended monitoring billing'],
  },
};

interface PatternAnalysisProps {
  patterns: PhysicianPattern[];
  onSelectCase: (c: AuditCase) => void;
}

export function PatternAnalysis({ patterns, onSelectCase }: PatternAnalysisProps) {
  const [selectedPatternId, setSelectedPatternId] = useState(patterns[0]?.patternId || '');
  const [selectedMetrics, setSelectedMetrics] = useState<ChartMetric[]>(['errorsFound', 'claimAmount']);
  const [groupBy, setGroupBy] = useState<GroupBy>('dayOfWeek');
  const [chartType, setChartType] = useState<'line' | 'bar'>('bar');

  const selectedPattern = patterns.find(p => p.patternId === selectedPatternId);

  const toggleMetric = (metric: ChartMetric) => {
    setSelectedMetrics(prev => {
      if (prev.includes(metric)) return prev.filter(m => m !== metric);
      if (prev.length >= 4) return prev;
      return [...prev, metric];
    });
  };

  const chartData = useMemo(() => {
    if (!selectedPattern) return [];
    const cases = selectedPattern.cases.filter(c => c.metadata);
    const groups: Record<string, { values: Record<ChartMetric, number[]> }> = {};

    cases.forEach(c => {
      if (!c.metadata) return;
      let key = '';
      switch (groupBy) {
        case 'dayOfWeek': key = c.metadata.dayOfWeek; break;
        case 'timeOfDay': key = parseInt(c.metadata.timeOfDay) < 12 ? 'Morning' : parseInt(c.metadata.timeOfDay) < 18 ? 'Afternoon' : 'Evening/Night'; break;
        case 'anesthesiaType': key = c.metadata.anesthesiaType || 'None'; break;
        case 'patientObesity': key = c.metadata.patientObesity ? 'Obese (BMI 30+)' : 'Non-Obese'; break;
        case 'understaffing': key = c.metadata.understaffing ? 'Understaffed' : 'Fully Staffed'; break;
        case 'orReadiness': key = c.metadata.errorsFound > 2 ? 'High Events (3+)' : c.metadata.errorsFound > 0 ? 'Some Events (1-2)' : 'No Events'; break;
        case 'triageAccuracy': key = c.metadata.procedureDuration > 120 ? 'Over-Duration (>2hr)' : c.metadata.procedureDuration > 60 ? 'Moderate (1-2hr)' : 'On-Target (<1hr)'; break;
        case 'postOpFlow': key = c.metadata.understaffing ? 'Flow Delay Likely' : 'Normal Flow'; break;
      }
      if (!groups[key]) groups[key] = { values: { errorsFound: [], upchargeAmount: [], claimAmount: [], procedureDuration: [] } };
      groups[key].values.errorsFound.push(c.metadata.errorsFound);
      groups[key].values.upchargeAmount.push(c.metadata.upchargeAmount);
      groups[key].values.claimAmount.push(c.claimAmount);
      groups[key].values.procedureDuration.push(c.metadata.procedureDuration);
    });

    return Object.entries(groups).map(([name, data]) => {
      const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      return {
        name,
        errorsFound: Math.round(avg(data.values.errorsFound) * 10) / 10,
        upchargeAmount: Math.round(avg(data.values.upchargeAmount)),
        claimAmount: Math.round(avg(data.values.claimAmount)),
        procedureDuration: Math.round(avg(data.values.procedureDuration)),
        count: data.values.errorsFound.length,
      };
    });
  }, [selectedPattern, groupBy]);

  // Calculate the primary benchmark line value based on first selected metric
  const primaryBenchmark = selectedMetrics.length > 0 ? PEER_BENCHMARKS[selectedMetrics[0]] : 0;

  const contextInfo = GROUPBY_CONTEXT[groupBy];

  if (patterns.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">No Patterns Detected</p>
        <p className="text-sm text-muted-foreground mt-1">Patterns require minimum 2 cases from the same physician with identical CPT codes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Pattern Selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={selectedPatternId} onValueChange={setSelectedPatternId}>
          <SelectTrigger className="w-[400px]">
            <SelectValue placeholder="Select a pattern" />
          </SelectTrigger>
          <SelectContent>
            {patterns.map(p => (
              <SelectItem key={p.patternId} value={p.patternId}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{p.physicianId}</span>
                  <span className="text-sm">{p.physicianName}</span>
                  <span className="text-xs text-muted-foreground">({p.totalCases} cases, {p.rejectionRate}% rejected)</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPattern && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pattern Overview */}
          <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
            <div>
              <p className="text-sm font-semibold">{selectedPattern.physicianName}</p>
              <p className="font-mono text-xs text-muted-foreground">{selectedPattern.physicianId}</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {selectedPattern.cptCodes.map(c => <CPTCodeBadge key={c} code={c} />)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center rounded-md border p-2">
                <p className="text-lg font-bold font-mono">{selectedPattern.totalCases}</p>
                <p className="text-xs text-muted-foreground">Total Cases</p>
              </div>
              <div className="text-center rounded-md border p-2">
                <p className={cn('text-lg font-bold font-mono', selectedPattern.rejectionRate > 50 ? 'text-violation' : 'text-foreground')}>
                  {selectedPattern.rejectionRate}%
                </p>
                <p className="text-xs text-muted-foreground">Rejection Rate</p>
              </div>
              <div className="text-center rounded-md border p-2">
                <p className="text-lg font-bold font-mono">${selectedPattern.totalClaimAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Claims</p>
              </div>
              <div className="text-center rounded-md border p-2">
                <p className="text-lg font-bold font-mono">${selectedPattern.averageClaimAmount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Avg Claim</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPattern.dateRange.start} — {selectedPattern.dateRange.end}
            </p>

            {/* Observed Billing & Documentation Patterns */}
            {selectedPattern.insights.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observed Patterns</p>
                {selectedPattern.insights.map((insight, i) => (
                  <div key={i} className="flex gap-2 text-xs rounded-md border bg-muted/50 border-muted p-2">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground italic">
                  Observed billing and documentation patterns — not assertions of intent. For education and workflow improvement.
                </p>
              </div>
            )}
          </div>

          {/* Charts + Cases */}
          <div className="lg:col-span-2 space-y-4">
            {/* Chart Controls */}
            <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1 flex-wrap">
                  {(Object.keys(METRIC_LABELS) as ChartMetric[]).map(metric => (
                    <Button
                      key={metric}
                      variant={selectedMetrics.includes(metric) ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-7"
                      style={selectedMetrics.includes(metric) ? { backgroundColor: METRIC_COLORS[metric] } : {}}
                      onClick={() => toggleMetric(metric)}
                    >
                      {METRIC_LABELS[metric]}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
                    <SelectTrigger className="h-7 text-xs w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                     <SelectContent>
                      <SelectItem value="dayOfWeek">Day of Week</SelectItem>
                      <SelectItem value="timeOfDay">Time of Day</SelectItem>
                      <SelectItem value="anesthesiaType">Anesthesia Type</SelectItem>
                      <SelectItem value="patientObesity">Patient Obesity</SelectItem>
                      <SelectItem value="understaffing">Understaffing</SelectItem>
                      <SelectItem value="orReadiness">OR Readiness</SelectItem>
                      <SelectItem value="triageAccuracy">Triage Accuracy</SelectItem>
                      <SelectItem value="postOpFlow">Post-Op Flow</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline" size="icon" className="h-7 w-7"
                    onClick={() => setChartType(t => t === 'line' ? 'bar' : 'line')}
                  >
                    {chartType === 'line' ? <BarChart3 className="h-3.5 w-3.5" /> : <LineChart className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  {chartType === 'bar' ? (
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {selectedMetrics.map(m => (
                        <Bar key={m} dataKey={m} name={METRIC_LABELS[m]} fill={METRIC_COLORS[m]} radius={[4, 4, 0, 0]} />
                      ))}
                      {selectedMetrics.length > 0 && (
                        <ReferenceLine
                          y={primaryBenchmark}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="5 5"
                          label={{ value: `Peer Avg: ${primaryBenchmark}`, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        />
                      )}
                    </BarChart>
                  ) : (
                    <RechartsLine data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {selectedMetrics.map(m => (
                        <Line key={m} type="monotone" dataKey={m} name={METRIC_LABELS[m]} stroke={METRIC_COLORS[m]} strokeWidth={2} dot={{ r: 4 }} />
                      ))}
                      {selectedMetrics.length > 0 && (
                        <ReferenceLine
                          y={primaryBenchmark}
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="5 5"
                          label={{ value: `Peer Avg: ${primaryBenchmark}`, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        />
                      )}
                    </RechartsLine>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                  Insufficient data for chart visualization
                </div>
              )}
            </div>

            {/* Context Explanation Panel */}
            <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why This Dimension Matters</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{contextInfo.why}</p>
              <div className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1">
                <p className="font-medium text-foreground">Abnormality Signal</p>
                <p className="text-muted-foreground">{contextInfo.abnormal}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Recommended Actions</p>
                <div className="flex gap-2 flex-wrap">
                  {contextInfo.actions.map((action, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground">{action}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cases */}
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="p-4 border-b">
                <p className="text-sm font-semibold">Cases in Pattern ({selectedPattern.cases.length})</p>
              </div>
              <Accordion type="multiple">
                {selectedPattern.cases.map(c => (
                  <AccordionItem key={c.id} value={c.id}>
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 text-left w-full">
                        <span className="font-mono text-sm">{c.caseNumber}</span>
                        <span className="text-xs text-muted-foreground">{c.dateOfService}</span>
                        <span className="font-mono text-sm ml-auto mr-4">${c.claimAmount.toLocaleString()}</span>
                        <Badge variant="outline" className="text-xs capitalize">{c.status}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
                        {c.metadata && (
                          <>
                            <div><span className="text-muted-foreground">Day:</span> {c.metadata.dayOfWeek}</div>
                            <div><span className="text-muted-foreground">Time:</span> {c.metadata.timeOfDay}</div>
                            <div><span className="text-muted-foreground">Anesthesia:</span> {c.metadata.anesthesiaType}</div>
                            <div><span className="text-muted-foreground">Duration:</span> {c.metadata.procedureDuration}min</div>
                            <div><span className="text-muted-foreground">Errors:</span> {c.metadata.errorsFound}</div>
                            <div><span className="text-muted-foreground">Upcharge:</span> ${c.metadata.upchargeAmount}</div>
                            <div><span className="text-muted-foreground">Obesity:</span> {c.metadata.patientObesity ? 'Yes' : 'No'}</div>
                            <div><span className="text-muted-foreground">Understaffed:</span> {c.metadata.understaffing ? 'Yes' : 'No'}</div>
                          </>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => onSelectCase(c)}>
                        <ChevronRight className="h-3 w-3" />
                        Open Full Audit
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
