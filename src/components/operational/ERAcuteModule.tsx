import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Siren, Clock, Users, AlertTriangle, TrendingUp, Activity, Bed, UserX, ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import type { ERAcuteEvent } from '@/lib/operationalTypes';
import { ACUITY_LEVELS, DISPOSITION_OPTIONS, ARRIVAL_METHODS } from '@/lib/operationalTypes';
import { Progress } from '@/components/ui/progress';

interface Props {
  events: ERAcuteEvent[];
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function ERAcuteModule({ events, posture }: Props) {
  const [groupBy, setGroupBy] = useState<'acuity_level' | 'disposition' | 'shift' | 'day_of_week' | 'department_zone' | 'arrival_method'>('acuity_level');

  const stats = useMemo(() => {
    const avgTriageWait = events.length ? Math.round(events.reduce((s, e) => s + e.triage_wait_minutes, 0) / events.length) : 0;
    const avgBedAssign = events.length ? Math.round(events.reduce((s, e) => s + e.bed_assignment_minutes, 0) / events.length) : 0;
    const avgProviderSeen = events.length ? Math.round(events.reduce((s, e) => s + e.provider_seen_minutes, 0) / events.length) : 0;
    const totalBoardingHours = events.reduce((s, e) => s + e.boarding_hours, 0);
    const lwbs = events.filter(e => e.left_without_seen).length;
    const overcrowded = events.filter(e => e.overcrowding_at_arrival).length;
    const highAcuity = events.filter(e => e.acuity_level <= 2).length;
    const admitted = events.filter(e => e.disposition === 'admitted').length;
    return { total: events.length, avgTriageWait, avgBedAssign, avgProviderSeen, totalBoardingHours: Math.round(totalBoardingHours * 10) / 10, lwbs, overcrowded, highAcuity, admitted };
  }, [events]);

  const chartData = useMemo(() => {
    const groups: Record<string, { events: ERAcuteEvent[] }> = {};
    events.forEach(e => {
      let key: string;
      if (groupBy === 'acuity_level') {
        key = `ESI ${e.acuity_level}`;
      } else {
        key = (e[groupBy as keyof ERAcuteEvent] as string) || 'Unknown';
      }
      if (!groups[key]) groups[key] = { events: [] };
      groups[key].events.push(e);
    });
    return Object.entries(groups).map(([name, d]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '…' : name,
      count: d.events.length,
      avgTriageWait: Math.round(d.events.reduce((s, e) => s + e.triage_wait_minutes, 0) / d.events.length),
      avgBedAssign: Math.round(d.events.reduce((s, e) => s + e.bed_assignment_minutes, 0) / d.events.length),
      avgProviderSeen: Math.round(d.events.reduce((s, e) => s + e.provider_seen_minutes, 0) / d.events.length),
      boardingHours: Math.round(d.events.reduce((s, e) => s + e.boarding_hours, 0) * 10) / 10,
    }));
  }, [events, groupBy]);

  const insights = useMemo(() => {
    const items: { pattern: string; severity: 'high' | 'medium' | 'low'; recommendation: string }[] = [];

    if (stats.lwbs > 0) {
      items.push({ pattern: `${stats.lwbs} patient(s) left without being seen`, severity: 'high', recommendation: 'Review triage-to-provider times. Consider fast-track protocol for ESI 4-5 patients.' });
    }

    if (stats.totalBoardingHours > 10) {
      items.push({ pattern: `${stats.totalBoardingHours}h total ED boarding time`, severity: 'high', recommendation: 'Boarding drives overcrowding, increases errors, and delays care. Address inpatient bed flow.' });
    }

    if (stats.avgTriageWait > 20) {
      items.push({ pattern: `Average triage wait ${stats.avgTriageWait}min`, severity: 'medium', recommendation: 'Target <15min for ESI 3+. Consider provider-in-triage model.' });
    }

    if (stats.overcrowded > stats.total * 0.4) {
      items.push({ pattern: `${stats.overcrowded}/${stats.total} arrivals during overcrowding`, severity: 'high', recommendation: 'Overcrowding correlates with increased adverse events. Review surge protocols and diversion criteria.' });
    }

    // Day-of-week patterns
    const dayGroups: Record<string, { count: number; avgWait: number }> = {};
    events.forEach(e => {
      if (e.day_of_week) {
        if (!dayGroups[e.day_of_week]) dayGroups[e.day_of_week] = { count: 0, avgWait: 0 };
        dayGroups[e.day_of_week].count++;
        dayGroups[e.day_of_week].avgWait += e.provider_seen_minutes;
      }
    });
    Object.entries(dayGroups).forEach(([day, d]) => {
      const avg = Math.round(d.avgWait / d.count);
      if (avg > 60 && d.count >= 2) {
        items.push({ pattern: `${day}: avg ${avg}min to provider (${d.count} encounters)`, severity: 'medium', recommendation: 'Review staffing levels and patient volume for this day.' });
      }
    });

    // High-acuity boarding
    const highAcuityBoarding = events.filter(e => e.acuity_level <= 2 && e.boarding_hours > 2);
    if (highAcuityBoarding.length > 0) {
      items.push({ pattern: `${highAcuityBoarding.length} high-acuity patient(s) boarded >2 hours`, severity: 'high', recommendation: 'Critical patients boarding in ED is a safety risk. Escalate to bed management.' });
    }

    return items;
  }, [events, stats]);

  const isPayer = posture === 'payment-integrity';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Siren className="h-5 w-5 text-violation" />
            ER / Acute Care Flow
            <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10">EXPERIMENTAL</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPayer ? 'Identify ED throughput patterns driving cost, boarding, and downstream claim complexity.' : 'Track emergency department flow metrics to reduce wait times, boarding, and left-without-seen rates.'}
          </p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Encounters', value: stats.total, icon: Activity },
          { label: 'Avg Triage Wait', value: `${stats.avgTriageWait}min`, icon: Clock, color: stats.avgTriageWait > 20 ? 'text-violation' : 'text-consensus' },
          { label: 'Avg Bed Assign', value: `${stats.avgBedAssign}min`, icon: Bed, color: stats.avgBedAssign > 30 ? 'text-disagreement' : '' },
          { label: 'Avg to Provider', value: `${stats.avgProviderSeen}min`, icon: Users, color: stats.avgProviderSeen > 45 ? 'text-violation' : '' },
          { label: 'Total Boarding', value: `${stats.totalBoardingHours}h`, icon: TrendingUp, color: stats.totalBoardingHours > 10 ? 'text-violation' : '' },
          { label: 'Left w/o Seen', value: stats.lwbs, icon: UserX, color: stats.lwbs > 0 ? 'text-violation' : 'text-consensus' },
          { label: 'Overcrowded', value: stats.overcrowded, icon: AlertTriangle, color: stats.overcrowded > 0 ? 'text-disagreement' : '' },
          { label: 'High Acuity', value: stats.highAcuity, icon: ArrowUpDown, color: stats.highAcuity > 0 ? 'text-violation' : '' },
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
            <p className="text-sm font-semibold">Flow Metrics</p>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acuity_level">Acuity (ESI)</SelectItem>
                <SelectItem value="disposition">Disposition</SelectItem>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="day_of_week">Day of Week</SelectItem>
                <SelectItem value="department_zone">Zone</SelectItem>
                <SelectItem value="arrival_method">Arrival</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="avgTriageWait" name="Triage Wait (min)" fill="hsl(var(--violation))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgBedAssign" name="Bed Assign (min)" fill="hsl(var(--disagreement))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgProviderSeen" name="To Provider (min)" fill="hsl(var(--info-blue))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No encounters recorded</div>
          )}
        </div>

        {/* Insights */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 max-h-[400px] overflow-y-auto">
          <p className="text-sm font-semibold">{isPayer ? 'Cost & Risk Signals' : 'Flow Improvement Opportunities'}</p>
          {insights.length === 0 ? (
            <p className="text-xs text-muted-foreground">No significant patterns detected yet.</p>
          ) : (
            <div className="space-y-2">
              {insights.map((p, i) => (
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

      {/* Encounter Log */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold">Encounter Log ({events.length})</p>
        </div>
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {events.map(e => {
            const acuityInfo = ACUITY_LEVELS.find(a => a.value === e.acuity_level);
            return (
              <div key={e.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn('text-[10px]', acuityInfo?.color || '')}>
                      ESI {e.acuity_level}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {DISPOSITION_OPTIONS.find(d => d.value === e.disposition)?.label || e.disposition}
                    </Badge>
                    {e.left_without_seen && <Badge variant="outline" className="text-[10px] text-violation border-violation/30">LWBS</Badge>}
                    {e.overcrowding_at_arrival && <Badge variant="outline" className="text-[10px] text-disagreement border-disagreement/30">Overcrowded</Badge>}
                    <span className="font-medium">{e.chief_complaint || 'No complaint recorded'}</span>
                  </div>
                  <span className="text-muted-foreground shrink-0">{e.day_of_week} {e.shift}</span>
                </div>
                <div className="flex gap-4 text-muted-foreground flex-wrap">
                  <span>Triage: <strong className={cn(e.triage_wait_minutes > 20 ? 'text-violation' : 'text-foreground')}>{e.triage_wait_minutes}min</strong></span>
                  <span>Bed: <strong className={cn(e.bed_assignment_minutes > 30 ? 'text-disagreement' : 'text-foreground')}>{e.bed_assignment_minutes}min</strong></span>
                  <span>Provider: <strong className={cn(e.provider_seen_minutes > 45 ? 'text-violation' : 'text-foreground')}>{e.provider_seen_minutes}min</strong></span>
                  {e.boarding_hours > 0 && <span>Boarding: <strong className="text-violation">{e.boarding_hours}h</strong></span>}
                  {e.department_zone && <span>{e.department_zone}</span>}
                  <span>{ARRIVAL_METHODS.find(a => a.value === e.arrival_method)?.label}</span>
                </div>
                {e.notes && <p className="text-muted-foreground mt-1 italic">{e.notes}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
