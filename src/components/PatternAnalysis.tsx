import { useState, useMemo } from 'react';
import type { PhysicianPattern, AuditCase } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CPTCodeBadge } from './CPTCodeBadge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, TrendingUp, ChevronRight, BarChart3, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart as RechartsLine, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type ChartMetric = 'errorsFound' | 'upchargeAmount' | 'claimAmount' | 'procedureDuration';
type GroupBy = 'dayOfWeek' | 'timeOfDay' | 'anesthesiaType' | 'patientObesity' | 'understaffing';

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
        case 'patientObesity': key = c.metadata.patientObesity ? 'Obese' : 'Non-Obese'; break;
        case 'understaffing': key = c.metadata.understaffing ? 'Understaffed' : 'Fully Staffed'; break;
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

            {/* Insights */}
            {selectedPattern.insights.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Insights</p>
                {selectedPattern.insights.map((insight, i) => (
                  <div key={i} className="flex gap-2 text-xs rounded-md border bg-disagreement/5 border-disagreement/20 p-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-disagreement shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
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
                    </RechartsLine>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                  Insufficient data for chart visualization
                </div>
              )}
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
