import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Clock, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
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

  const stats = useMemo(() => {
    const predictable = events.filter(e => e.foreseeability_class === 'predictable').length;
    const avgForeseeability = events.length ? Math.round(events.reduce((s, e) => s + e.foreseeability_score, 0) / events.length) : 0;
    const totalExtraMinutes = events.reduce((s, e) => s + ((e.actual_duration || 0) - (e.expected_duration || 0)), 0);
    const avgComplexityDelta = events.length ? (events.reduce((s, e) => s + e.complexity_delta, 0) / events.length).toFixed(1) : '0';
    return { total: events.length, predictable, avgForeseeability, totalExtraMinutes, avgComplexityDelta };
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
    }));
  }, [events, groupBy]);

  const isPayer = posture === 'payment-integrity';

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Cases Reviewed', value: stats.total },
          { label: 'Predictable Mismatches', value: stats.predictable, color: stats.predictable > 0 ? 'text-violation' : '' },
          { label: 'Avg Foreseeability', value: `${stats.avgForeseeability}%`, color: stats.avgForeseeability > 50 ? 'text-disagreement' : 'text-consensus' },
          { label: 'Extra OR Time', value: `${stats.totalExtraMinutes}min`, color: stats.totalExtraMinutes > 60 ? 'text-violation' : '' },
          { label: 'Avg Complexity Δ', value: stats.avgComplexityDelta, color: '' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 shadow-sm text-center">
            <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Triage Accuracy by Dimension</p>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="surgeon_name">Surgeon</SelectItem>
                <SelectItem value="booker_name">Booker</SelectItem>
                <SelectItem value="service_line">Service Line</SelectItem>
                <SelectItem value="foreseeability_class">Foreseeability</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="predictable" name="Predictable" stackId="a" fill="hsl(var(--violation))" />
              <Bar dataKey="partial" name="Partially Foreseeable" stackId="a" fill="hsl(var(--disagreement))" />
              <Bar dataKey="unavoidable" name="Unavoidable" stackId="a" fill="hsl(var(--consensus))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold">{isPayer ? 'Cost Impact Signals' : 'Improvement Opportunities'}</p>
          {events.filter(e => e.foreseeability_class === 'predictable').length > 0 && (
            <div className="rounded-md border border-violation/30 bg-violation/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-violation">Predictable under-calling detected</p>
              <p className="text-muted-foreground">
                {isPayer
                  ? 'Cases booked below actual complexity may indicate systematic patterns affecting claim accuracy.'
                  : 'Review booking protocols with schedulers. Pre-op imaging and history should drive complexity estimates.'}
              </p>
            </div>
          )}
          {stats.totalExtraMinutes > 60 && (
            <div className="rounded-md border border-disagreement/30 bg-disagreement/5 p-2.5 text-xs space-y-1">
              <p className="font-medium text-disagreement">Significant OR time overruns</p>
              <p className="text-muted-foreground">{stats.totalExtraMinutes} extra minutes across {stats.total} cases.</p>
            </div>
          )}
        </div>
      </div>

      {/* Event Detail Cards */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">Case Details</p>
        {events.map(e => (
          <div key={e.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn('text-[10px]',
                  e.foreseeability_class === 'predictable' ? 'text-violation border-violation/30' :
                  e.foreseeability_class === 'partially_foreseeable' ? 'text-disagreement border-disagreement/30' :
                  'text-consensus border-consensus/30'
                )}>
                  {FORESEEABILITY_OPTIONS.find(o => o.value === e.foreseeability_class)?.label}
                </Badge>
                {e.surgeon_name && <span className="text-xs font-medium">{e.surgeon_name}</span>}
                {e.service_line && <span className="text-xs text-muted-foreground">• {e.service_line}</span>}
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
                <p className="text-muted-foreground">Duration: {e.expected_duration || '—'}min • Implant: {e.expected_implant || 'None'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">Actual</p>
                <p>{e.actual_procedure || '—'}</p>
                <p className="text-muted-foreground">Duration: {e.actual_duration || '—'}min • Implant: {e.actual_implant || 'None'}</p>
              </div>
            </div>
            {(e.extra_equipment?.length || e.unplanned_support?.length) && (
              <div className="flex gap-4 mt-2 text-xs">
                {e.extra_equipment?.length ? (
                  <div><span className="text-muted-foreground">Extra Equipment:</span> {e.extra_equipment.join(', ')}</div>
                ) : null}
                {e.unplanned_support?.length ? (
                  <div><span className="text-muted-foreground">Unplanned Support:</span> {e.unplanned_support.join(', ')}</div>
                ) : null}
              </div>
            )}
            {e.notes && <p className="text-xs text-muted-foreground mt-2 italic">{e.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
