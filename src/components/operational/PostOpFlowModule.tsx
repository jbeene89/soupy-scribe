import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bed, Clock, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import type { PostOpFlowEvent } from '@/lib/operationalTypes';

interface Props {
  events: PostOpFlowEvent[];
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function PostOpFlowModule({ events, posture }: Props) {
  const [groupBy, setGroupBy] = useState<'day_of_week' | 'facility' | 'surgeon_name' | 'service_line' | 'shift' | 'delay_reason'>('day_of_week');

  const stats = useMemo(() => {
    const totalPatientWait = events.reduce((s, e) => s + e.patient_wait_minutes, 0);
    const totalStaffIdle = events.reduce((s, e) => s + e.staff_idle_minutes, 0);
    const noBed = events.filter(e => !e.bed_available).length;
    const avgWait = events.length ? Math.round(totalPatientWait / events.length) : 0;
    const over30 = events.filter(e => e.patient_wait_minutes > 30).length;
    return { total: events.length, totalPatientWait, totalStaffIdle, noBed, avgWait, over30 };
  }, [events]);

  const chartData = useMemo(() => {
    const groups: Record<string, { patientWait: number[]; staffIdle: number[]; count: number }> = {};
    events.forEach(e => {
      const key = (e[groupBy as keyof PostOpFlowEvent] as string) || 'Unknown';
      if (!groups[key]) groups[key] = { patientWait: [], staffIdle: [], count: 0 };
      groups[key].patientWait.push(e.patient_wait_minutes);
      groups[key].staffIdle.push(e.staff_idle_minutes);
      groups[key].count++;
    });
    return Object.entries(groups).map(([name, d]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '…' : name,
      avgPatientWait: Math.round(d.patientWait.reduce((a, b) => a + b, 0) / d.count),
      avgStaffIdle: Math.round(d.staffIdle.reduce((a, b) => a + b, 0) / d.count),
      events: d.count,
    }));
  }, [events, groupBy]);

  const patterns = useMemo(() => {
    const insights: { pattern: string; severity: 'high' | 'medium' | 'low'; recommendation: string }[] = [];
    // Day-of-week patterns
    const dayGroups: Record<string, number[]> = {};
    events.forEach(e => {
      if (e.day_of_week) {
        if (!dayGroups[e.day_of_week]) dayGroups[e.day_of_week] = [];
        dayGroups[e.day_of_week].push(e.patient_wait_minutes);
      }
    });
    Object.entries(dayGroups).forEach(([day, waits]) => {
      const avg = waits.reduce((a, b) => a + b, 0) / waits.length;
      if (avg > 30 && waits.length >= 2) {
        insights.push({ pattern: `${day} shows avg ${Math.round(avg)}min patient wait (${waits.length} events)`, severity: 'high', recommendation: 'Review scheduling density and PACU capacity for this day.' });
      }
    });
    if (stats.noBed > stats.total * 0.5) {
      insights.push({ pattern: `${stats.noBed}/${stats.total} events had no bed available`, severity: 'high', recommendation: 'Evaluate PACU bed allocation and discharge timing protocols.' });
    }
    if (stats.totalStaffIdle > 60) {
      insights.push({ pattern: `${stats.totalStaffIdle} total staff idle minutes`, severity: 'medium', recommendation: 'Cross-train staff for flexible post-op assignments during wait periods.' });
    }
    return insights;
  }, [events, stats]);

  const isPayer = posture === 'payment-integrity';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bed className="h-5 w-5 text-info-blue" />
          Post-Op Flow Monitoring
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isPayer ? 'Track post-operative bottlenecks that increase facility cost and operational risk.' : 'Monitor recovery flow to reduce patient wait times and optimize staff utilization.'}
        </p>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.total, icon: TrendingUp },
          { label: 'Avg Patient Wait', value: `${stats.avgWait}min`, icon: Clock, color: stats.avgWait > 25 ? 'text-violation' : 'text-consensus' },
          { label: 'Total Staff Idle', value: `${stats.totalStaffIdle}min`, icon: Users, color: stats.totalStaffIdle > 60 ? 'text-disagreement' : '' },
          { label: 'No Bed Available', value: stats.noBed, icon: Bed, color: stats.noBed > 0 ? 'text-violation' : 'text-consensus' },
          { label: 'Wait >30min', value: stats.over30, icon: AlertTriangle, color: stats.over30 > 0 ? 'text-disagreement' : '' },
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
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Flow Analysis</p>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day_of_week">Day of Week</SelectItem>
                <SelectItem value="facility">Facility</SelectItem>
                <SelectItem value="surgeon_name">Surgeon</SelectItem>
                <SelectItem value="service_line">Service Line</SelectItem>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="delay_reason">Delay Reason</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="avgPatientWait" name="Avg Patient Wait (min)" fill="hsl(var(--violation))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgStaffIdle" name="Avg Staff Idle (min)" fill="hsl(var(--disagreement))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pattern Insights */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold">Trend Insights</p>
          {patterns.length === 0 ? (
            <p className="text-xs text-muted-foreground">No significant patterns detected yet.</p>
          ) : (
            <div className="space-y-2">
              {patterns.map((p, i) => (
                <div key={i} className={cn('rounded-md border p-2.5 text-xs space-y-1',
                  p.severity === 'high' ? 'border-violation/30 bg-violation/5' :
                  p.severity === 'medium' ? 'border-disagreement/30 bg-disagreement/5' :
                  'border-info-blue/30 bg-info-blue/5'
                )}>
                  <p className="font-medium">{p.pattern}</p>
                  <p className="text-muted-foreground">{p.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold">Flow Events ({events.length})</p>
        </div>
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {events.map(e => (
            <div key={e.id} className="px-4 py-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {!e.bed_available && <Badge variant="outline" className="text-[10px] text-violation border-violation/30">No Bed</Badge>}
                  <span className="font-medium">{e.delay_reason || 'Unspecified delay'}</span>
                  {e.surgeon_name && <span className="text-muted-foreground">• {e.surgeon_name}</span>}
                  {e.facility && <span className="text-muted-foreground">• {e.facility}</span>}
                </div>
                <span className="text-muted-foreground">{e.day_of_week} {e.shift}</span>
              </div>
              <div className="flex gap-4 text-muted-foreground">
                <span>Patient Wait: <strong className={cn(e.patient_wait_minutes > 30 ? 'text-violation' : 'text-foreground')}>{e.patient_wait_minutes}min</strong></span>
                <span>Staff Idle: <strong className="text-foreground">{e.staff_idle_minutes}min</strong></span>
              </div>
              {e.notes && <p className="text-muted-foreground mt-1 italic">{e.notes}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
