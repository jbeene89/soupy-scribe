import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Clock, AlertTriangle, TrendingUp, Users, ArrowUpDown, CheckCircle2, XCircle, Hourglass } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import type { TriageAccuracyEvent } from '@/lib/operationalTypes';
import { FORESEEABILITY_OPTIONS } from '@/lib/operationalTypes';
import { Progress } from '@/components/ui/progress';

interface Props {
  events: TriageAccuracyEvent[];
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function TriageAccuracyModule({ events, posture }: Props) {
  const [groupBy, setGroupBy] = useState<'surgeon_name' | 'booker_name' | 'service_line' | 'foreseeability_class'>('surgeon_name');
  const [view, setView] = useState<'distribution' | 'longitudinal'>('distribution');

  const stats = useMemo(() => {
    const predictable = events.filter(e => e.foreseeability_class === 'predictable').length;
    const avgForeseeability = events.length ? Math.round(events.reduce((s, e) => s + e.foreseeability_score, 0) / events.length) : 0;
    const totalExtraMinutes = events.reduce((s, e) => s + Math.max(0, (e.actual_duration || 0) - (e.expected_duration || 0)), 0);
    const avgComplexityDelta = events.length ? (events.reduce((s, e) => s + e.complexity_delta, 0) / events.length).toFixed(1) : '0';
    const staffMismatches = events.filter(e => (e.actual_staff_count || 0) > (e.expected_staff_count || 0)).length;
    const followUpPending = events.filter(e => e.follow_up_status === 'pending' || e.follow_up_status === 'escalated').length;
    return { total: events.length, predictable, avgForeseeability, totalExtraMinutes, avgComplexityDelta, staffMismatches, followUpPending };
  }, [events]);

  const chartData = useMemo(() => {
    const groups: Record<string, { events: TriageAccuracyEvent[] }> = {};
    events.forEach(e => {
      const key = (e[groupBy as keyof TriageAccuracyEvent] as string) || 'Unknown';
      if (!groups[key]) groups[key] = { events: [] };
      groups[key].events.push(e);
    });
    return Object.entries(groups).map(([name, d]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '…' : name,
      predictable: d.events.filter(e => e.foreseeability_class === 'predictable').length,
      partial: d.events.filter(e => e.foreseeability_class === 'partially_foreseeable').length,
      unavoidable: d.events.filter(e => e.foreseeability_class === 'unavoidable').length,
      avgDelta: Math.round(d.events.reduce((s, e) => s + e.complexity_delta, 0) / d.events.length * 10) / 10,
      extraMinutes: d.events.reduce((s, e) => s + Math.max(0, (e.actual_duration || 0) - (e.expected_duration || 0)), 0),
      staffMismatches: d.events.filter(e => (e.actual_staff_count || 0) > (e.expected_staff_count || 0)).length,
    }));
  }, [events, groupBy]);

  // Longitudinal data: group by month
  const longitudinalData = useMemo(() => {
    const months: Record<string, { events: TriageAccuracyEvent[] }> = {};
    events.forEach(e => {
      const m = e.month || e.created_at.slice(0, 7);
      if (!months[m]) months[m] = { events: [] };
      months[m].events.push(e);
    });
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
      name: month,
      total: d.events.length,
      predictable: d.events.filter(e => e.foreseeability_class === 'predictable').length,
      avgForeseeability: Math.round(d.events.reduce((s, e) => s + e.foreseeability_score, 0) / d.events.length),
      avgDelta: Math.round(d.events.reduce((s, e) => s + e.complexity_delta, 0) / d.events.length * 10) / 10,
    }));
  }, [events]);

  const peerBenchmark = useMemo(() => {
    if (chartData.length === 0) return 0;
    const totalPredictable = chartData.reduce((s, d) => s + d.predictable, 0);
    return Math.round(totalPredictable / chartData.length * 10) / 10;
  }, [chartData]);

  const isPayer = posture === 'payment-integrity';

  const followUpIcon = (status?: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-3 w-3 text-consensus" />;
      case 'escalated': return <XCircle className="h-3 w-3 text-violation" />;
      case 'pending': return <Hourglass className="h-3 w-3 text-disagreement" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-disagreement" />
          Case-Triage Accuracy
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isPayer ? 'Identify systematic under-calling that drives unexpected claim complexity and cost.' : 'Compare pre-op booking accuracy against actual intra-operative needs to improve scheduling.'}
        </p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Cases Reviewed', value: stats.total, icon: Target },
          { label: 'Predictable Mismatches', value: stats.predictable, icon: AlertTriangle, color: stats.predictable > 0 ? 'text-violation' : '' },
          { label: 'Avg Foreseeability', value: `${stats.avgForeseeability}%`, icon: TrendingUp, color: stats.avgForeseeability > 50 ? 'text-disagreement' : 'text-consensus' },
          { label: 'Extra OR Time', value: `${stats.totalExtraMinutes}min`, icon: Clock, color: stats.totalExtraMinutes > 60 ? 'text-violation' : '' },
          { label: 'Avg Complexity Δ', value: stats.avgComplexityDelta, icon: ArrowUpDown },
          { label: 'Staff Mismatches', value: stats.staffMismatches, icon: Users, color: stats.staffMismatches > 0 ? 'text-disagreement' : '' },
          { label: 'Follow-Ups Open', value: stats.followUpPending, icon: Hourglass, color: stats.followUpPending > 0 ? 'text-disagreement' : 'text-consensus' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 shadow-sm text-center">
            <s.icon className={cn('h-4 w-4 mx-auto mb-1', s.color || 'text-muted-foreground')} />
            <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {view === 'distribution' ? 'Triage Accuracy by Dimension' : 'Longitudinal Trends'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-md border overflow-hidden">
                <button
                  onClick={() => setView('distribution')}
                  className={cn('px-2 py-1 text-[11px] font-medium transition-colors',
                    view === 'distribution' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >Distribution</button>
                <button
                  onClick={() => setView('longitudinal')}
                  className={cn('px-2 py-1 text-[11px] font-medium transition-colors',
                    view === 'longitudinal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  )}
                >Over Time</button>
              </div>
              {view === 'distribution' && (
                <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
                  <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surgeon_name">Surgeon</SelectItem>
                    <SelectItem value="booker_name">Booker</SelectItem>
                    <SelectItem value="service_line">Service Line</SelectItem>
                    <SelectItem value="foreseeability_class">Foreseeability</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {view === 'distribution' ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="predictable" name="Predictable" stackId="a" fill="hsl(var(--violation))" />
                <Bar dataKey="partial" name="Partially Foreseeable" stackId="a" fill="hsl(var(--disagreement))" />
                <Bar dataKey="unavoidable" name="Unavoidable" stackId="a" fill="hsl(var(--consensus))" radius={[4, 4, 0, 0]} />
                <ReferenceLine y={peerBenchmark} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={{ value: `Avg: ${peerBenchmark}`, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={longitudinalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="total" name="Total Cases" stroke="hsl(var(--info-blue))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="predictable" name="Predictable" stroke="hsl(var(--violation))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="avgForeseeability" name="Avg Foreseeability %" stroke="hsl(var(--disagreement))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Insights Panel */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 max-h-[400px] overflow-y-auto">
          <p className="text-sm font-semibold">{isPayer ? 'Cost Impact Signals' : 'Improvement Opportunities'}</p>

          {stats.predictable > 0 && (
            <div className="rounded-md border border-violation/30 bg-violation/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-violation">Predictable under-calling detected</p>
              <p className="text-muted-foreground">
                {isPayer
                  ? `${stats.predictable} case(s) booked below actual complexity. Systematic patterns may affect claim accuracy and cost predictability.`
                  : `${stats.predictable} case(s) could have been booked more accurately. Review booking protocols with schedulers — pre-op imaging and history should drive complexity estimates.`}
              </p>
            </div>
          )}

          {stats.staffMismatches > 0 && (
            <div className="rounded-md border border-disagreement/30 bg-disagreement/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-disagreement">Staffing mismatches</p>
              <p className="text-muted-foreground">
                {stats.staffMismatches} case(s) required more staff than booked. Under-triaged staffing creates delays and safety risk.
              </p>
            </div>
          )}

          {stats.totalExtraMinutes > 60 && (
            <div className="rounded-md border border-disagreement/30 bg-disagreement/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-disagreement">Significant OR time overruns</p>
              <p className="text-muted-foreground">{stats.totalExtraMinutes} extra minutes across {stats.total} cases. Downstream scheduling impact likely.</p>
            </div>
          )}

          {stats.followUpPending > 0 && (
            <div className="rounded-md border border-info-blue/30 bg-info-blue/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-info-blue">Open follow-ups</p>
              <p className="text-muted-foreground">{stats.followUpPending} case(s) have pending or escalated follow-up actions.</p>
            </div>
          )}

          {/* Repeat offender detection */}
          {(() => {
            const surgeonCounts: Record<string, number> = {};
            events.filter(e => e.foreseeability_class === 'predictable').forEach(e => {
              if (e.surgeon_name) surgeonCounts[e.surgeon_name] = (surgeonCounts[e.surgeon_name] || 0) + 1;
            });
            const repeaters = Object.entries(surgeonCounts).filter(([, c]) => c >= 2);
            if (repeaters.length === 0) return null;
            return repeaters.map(([surgeon, count]) => (
              <div key={surgeon} className="rounded-md border border-violation/30 bg-violation/5 p-2.5 text-xs space-y-1">
                <p className="font-medium text-violation">Repeat pattern: {surgeon}</p>
                <p className="text-muted-foreground">{count} predictable mismatches.
                  {isPayer ? ' Suggests systematic under-calling affecting cost forecasting.' : ' Targeted education or booking review recommended.'}
                </p>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Event Detail Cards */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Case Details</p>
        {events.map(e => (
          <div key={e.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn('text-[10px]',
                  e.foreseeability_class === 'predictable' ? 'text-violation border-violation/30' :
                  e.foreseeability_class === 'partially_foreseeable' ? 'text-disagreement border-disagreement/30' :
                  'text-consensus border-consensus/30'
                )}>
                  {FORESEEABILITY_OPTIONS.find(o => o.value === e.foreseeability_class)?.label}
                </Badge>
                {e.surgeon_name && <span className="text-xs font-medium">{e.surgeon_name}</span>}
                {e.service_line && <span className="text-xs text-muted-foreground">• {e.service_line}</span>}
                {e.follow_up_status && e.follow_up_status !== 'none' && (
                  <Badge variant="outline" className={cn('text-[10px] gap-1',
                    e.follow_up_status === 'completed' ? 'text-consensus border-consensus/30' :
                    e.follow_up_status === 'escalated' ? 'text-violation border-violation/30' :
                    'text-disagreement border-disagreement/30'
                  )}>
                    {followUpIcon(e.follow_up_status)}
                    {e.follow_up_status}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-mono">Foreseeability: <strong>{e.foreseeability_score}%</strong></p>
                <Progress value={e.foreseeability_score} className="h-1.5 w-24 mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Expected</p>
                <p>{e.expected_procedure || '—'}</p>
                <p className="text-muted-foreground">
                  Duration: {e.expected_duration || '—'}min • Implant: {e.expected_implant || 'None'}
                  {e.expected_staff_count != null && ` • Staff: ${e.expected_staff_count}`}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Actual</p>
                <p>{e.actual_procedure || '—'}</p>
                <p className="text-muted-foreground">
                  Duration: {e.actual_duration || '—'}min • Implant: {e.actual_implant || 'None'}
                  {e.actual_staff_count != null && ` • Staff: ${e.actual_staff_count}`}
                </p>
              </div>
            </div>
            {(e.extra_equipment?.length || e.unplanned_support?.length) && (
              <div className="flex gap-4 mt-2 text-xs flex-wrap">
                {e.extra_equipment?.length ? (
                  <div><span className="text-muted-foreground">Extra Equipment:</span> {e.extra_equipment.join(', ')}</div>
                ) : null}
                {e.unplanned_support?.length ? (
                  <div><span className="text-muted-foreground">Unplanned Support:</span> {e.unplanned_support.join(', ')}</div>
                ) : null}
              </div>
            )}
            {e.follow_up_notes && (
              <div className="mt-2 text-xs rounded-md bg-muted/50 border p-2">
                <span className="text-muted-foreground font-medium">Follow-up: </span>
                {e.follow_up_notes}
              </div>
            )}
            {e.notes && <p className="text-xs text-muted-foreground mt-2 italic">{e.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
