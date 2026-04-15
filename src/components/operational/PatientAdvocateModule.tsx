import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, AlertTriangle, Clock, Eye, FileWarning, ArrowLeftRight, Activity, CheckCircle2, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import type { PatientAdvocateEvent } from '@/lib/operationalTypes';
import { ADVOCATE_CATEGORIES, RESOLUTION_STATUSES } from '@/lib/operationalTypes';

interface Props {
  events: PatientAdvocateEvent[];
  posture: 'payment-integrity' | 'compliance-coaching';
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-violation', bg: 'bg-violation/10', border: 'border-violation/30', fill: 'hsl(var(--violation))' },
  high: { color: 'text-violation', bg: 'bg-violation/5', border: 'border-violation/20', fill: 'hsl(var(--disagreement))' },
  medium: { color: 'text-disagreement', bg: 'bg-disagreement/5', border: 'border-disagreement/20', fill: 'hsl(var(--info-blue))' },
  low: { color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-muted', fill: 'hsl(var(--muted-foreground))' },
};

export function PatientAdvocateModule({ events, posture }: Props) {
  const [groupBy, setGroupBy] = useState<'event_category' | 'severity' | 'unit' | 'shift' | 'day_of_week' | 'responsible_role' | 'resolution_status'>('event_category');

  const stats = useMemo(() => {
    const critical = events.filter(e => e.severity === 'critical').length;
    const high = events.filter(e => e.severity === 'high').length;
    const open = events.filter(e => e.resolution_status === 'open').length;
    const escalated = events.filter(e => e.resolution_status === 'escalated').length;
    const unreported = events.filter(e => !e.was_reported).length;
    const avgDeviation = events.length ? Math.round(events.reduce((s, e) => s + e.deviation_minutes, 0) / events.length) : 0;
    const resolved = events.filter(e => e.resolution_status === 'resolved').length;
    return { total: events.length, critical, high, open, escalated, unreported, avgDeviation, resolved };
  }, [events]);

  const chartData = useMemo(() => {
    const groups: Record<string, { events: PatientAdvocateEvent[] }> = {};
    events.forEach(e => {
      let key: string;
      if (groupBy === 'event_category') {
        key = ADVOCATE_CATEGORIES.find(c => c.value === e.event_category)?.label || e.event_category;
      } else if (groupBy === 'resolution_status') {
        key = RESOLUTION_STATUSES.find(s => s.value === e.resolution_status)?.label || e.resolution_status;
      } else {
        key = (e[groupBy as keyof PatientAdvocateEvent] as string) || 'Unknown';
      }
      if (!groups[key]) groups[key] = { events: [] };
      groups[key].events.push(e);
    });
    return Object.entries(groups).map(([name, d]) => ({
      name: name.length > 20 ? name.slice(0, 18) + '…' : name,
      count: d.events.length,
      critical: d.events.filter(e => e.severity === 'critical').length,
      high: d.events.filter(e => e.severity === 'high').length,
      medium: d.events.filter(e => e.severity === 'medium').length,
      low: d.events.filter(e => e.severity === 'low').length,
      avgDeviation: Math.round(d.events.reduce((s, e) => s + e.deviation_minutes, 0) / d.events.length),
      unreported: d.events.filter(e => !e.was_reported).length,
    }));
  }, [events, groupBy]);

  const severityPieData = useMemo(() => [
    { name: 'Critical', value: stats.critical, fill: SEVERITY_CONFIG.critical.fill },
    { name: 'High', value: stats.high, fill: SEVERITY_CONFIG.high.fill },
    { name: 'Medium', value: events.filter(e => e.severity === 'medium').length, fill: SEVERITY_CONFIG.medium.fill },
    { name: 'Low', value: events.filter(e => e.severity === 'low').length, fill: SEVERITY_CONFIG.low.fill },
  ].filter(d => d.value > 0), [events, stats]);

  const insights = useMemo(() => {
    const items: { pattern: string; severity: 'high' | 'medium' | 'low'; recommendation: string }[] = [];

    if (stats.unreported > stats.total * 0.5) {
      items.push({ pattern: `${stats.unreported}/${stats.total} events were not formally reported`, severity: 'high', recommendation: 'Under-reporting masks systemic issues. Review near-miss reporting culture and anonymous reporting options.' });
    }

    if (stats.critical > 0) {
      items.push({ pattern: `${stats.critical} critical safety event(s)`, severity: 'high', recommendation: 'Critical events require root cause analysis and leadership notification within 24 hours.' });
    }

    // Unit clustering
    const unitGroups: Record<string, number> = {};
    events.forEach(e => { if (e.unit) unitGroups[e.unit] = (unitGroups[e.unit] || 0) + 1; });
    Object.entries(unitGroups).filter(([, c]) => c >= 2).forEach(([unit, c]) => {
      items.push({ pattern: `${unit}: ${c} events`, severity: c >= 3 ? 'high' : 'medium', recommendation: 'Clustering by unit suggests systemic workflow or staffing issues. Review unit-level processes.' });
    });

    // Shift patterns
    const shiftGroups: Record<string, number> = {};
    events.forEach(e => { if (e.shift) shiftGroups[e.shift] = (shiftGroups[e.shift] || 0) + 1; });
    Object.entries(shiftGroups).filter(([, c]) => c >= 3).forEach(([shift, c]) => {
      items.push({ pattern: `${shift} shift: ${c} events`, severity: 'medium', recommendation: 'Shift-specific clustering may indicate staffing adequacy or handoff issues.' });
    });

    // Category patterns
    const catGroups: Record<string, number> = {};
    events.forEach(e => { catGroups[e.event_category] = (catGroups[e.event_category] || 0) + 1; });
    Object.entries(catGroups).filter(([, c]) => c >= 2).forEach(([cat, c]) => {
      const label = ADVOCATE_CATEGORIES.find(a => a.value === cat)?.label || cat;
      items.push({ pattern: `${label}: ${c} occurrences`, severity: c >= 3 ? 'high' : 'medium', recommendation: `Recurring ${label.toLowerCase()} events suggest a gap in standard workflows. Target with focused education.` });
    });

    if (stats.open > stats.total * 0.6) {
      items.push({ pattern: `${stats.open}/${stats.total} events still open`, severity: 'medium', recommendation: 'High open rate may indicate lack of follow-through. Assign accountability and deadlines.' });
    }

    return items;
  }, [events, stats]);

  const isPayer = posture === 'payment-integrity';

  const resolutionIcon = (status: string) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 className="h-3 w-3 text-consensus" />;
      case 'escalated': return <XCircle className="h-3 w-3 text-violation" />;
      case 'investigating': return <Eye className="h-3 w-3 text-info-blue" />;
      default: return <Clock className="h-3 w-3 text-disagreement" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-info-blue" />
            Patient Advocate — Anomaly Detection
            <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 bg-amber-500/10">EXPERIMENTAL</Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPayer ? 'Surface care quality anomalies that may correlate with claim disputes, readmissions, or liability exposure.' : 'Detect deviations from expected care standards to protect patients and improve nursing workflows.'}
          </p>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Events', value: stats.total, icon: Activity },
          { label: 'Critical', value: stats.critical, icon: AlertTriangle, color: stats.critical > 0 ? 'text-violation' : 'text-consensus' },
          { label: 'High Severity', value: stats.high, icon: FileWarning, color: stats.high > 0 ? 'text-violation' : '' },
          { label: 'Open', value: stats.open, icon: Clock, color: stats.open > 0 ? 'text-disagreement' : 'text-consensus' },
          { label: 'Escalated', value: stats.escalated, icon: ArrowLeftRight, color: stats.escalated > 0 ? 'text-violation' : '' },
          { label: 'Unreported', value: stats.unreported, icon: Eye, color: stats.unreported > 0 ? 'text-disagreement' : 'text-consensus' },
          { label: 'Avg Deviation', value: `${stats.avgDeviation}min`, icon: Clock },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 shadow-sm text-center">
            <s.icon className={cn('h-4 w-4 mx-auto mb-1', s.color || 'text-muted-foreground')} />
            <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Critical Alert */}
      {stats.critical > 0 && (
        <div className="rounded-lg border-2 border-violation/40 bg-violation/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-violation shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-violation">Critical Safety Events Detected</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.critical} event(s) classified as critical. These require immediate root cause analysis, leadership notification, and may trigger mandatory reporting.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Event Distribution</p>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="event_category">Category</SelectItem>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="day_of_week">Day of Week</SelectItem>
                <SelectItem value="responsible_role">Role</SelectItem>
                <SelectItem value="resolution_status">Resolution Status</SelectItem>
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
                <Bar dataKey="critical" name="Critical" stackId="sev" fill="hsl(var(--violation))" />
                <Bar dataKey="high" name="High" stackId="sev" fill="hsl(var(--disagreement))" />
                <Bar dataKey="medium" name="Medium" stackId="sev" fill="hsl(var(--info-blue))" />
                <Bar dataKey="low" name="Low" stackId="sev" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No events recorded</div>
          )}
        </div>

        {/* Insights */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 max-h-[400px] overflow-y-auto">
          <p className="text-sm font-semibold">{isPayer ? 'Quality & Liability Signals' : 'Patient Safety Insights'}</p>
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

      {/* Event Log */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-4 border-b">
          <p className="text-sm font-semibold">Event Log ({events.length})</p>
        </div>
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {events.map(e => {
            const catInfo = ADVOCATE_CATEGORIES.find(c => c.value === e.event_category);
            const sevConfig = SEVERITY_CONFIG[e.severity];
            return (
              <div key={e.id} className="px-4 py-3 text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn('text-[10px]', sevConfig.color, sevConfig.border)}>
                      {e.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {catInfo?.label || e.event_category}
                    </Badge>
                    <div className="flex items-center gap-1">
                      {resolutionIcon(e.resolution_status)}
                      <span className="text-[10px]">{RESOLUTION_STATUSES.find(s => s.value === e.resolution_status)?.label}</span>
                    </div>
                    {!e.was_reported && <Badge variant="outline" className="text-[10px] text-disagreement border-disagreement/30">Unreported</Badge>}
                  </div>
                  <span className="text-muted-foreground shrink-0">{e.day_of_week} {e.shift}</span>
                </div>
                <p className="font-medium mb-1">{e.description}</p>
                {(e.expected_standard || e.actual_finding) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-1">
                    {e.expected_standard && (
                      <div>
                        <span className="text-muted-foreground">Expected: </span>
                        <span>{e.expected_standard}</span>
                      </div>
                    )}
                    {e.actual_finding && (
                      <div>
                        <span className="text-muted-foreground">Finding: </span>
                        <span>{e.actual_finding}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 text-muted-foreground flex-wrap">
                  {e.deviation_minutes > 0 && <span>Deviation: <strong className="text-foreground">{e.deviation_minutes}min</strong></span>}
                  {e.unit && <span>Unit: {e.unit}</span>}
                  {e.responsible_role && <span>Role: {e.responsible_role}</span>}
                  {e.patient_id && <span>Patient: {e.patient_id}</span>}
                </div>
                {e.resolution_notes && (
                  <div className="mt-1.5 rounded-md bg-muted/50 border p-2 text-muted-foreground">
                    <span className="font-medium text-foreground">Resolution: </span>{e.resolution_notes}
                  </div>
                )}
                {e.notes && <p className="text-muted-foreground mt-1 italic">{e.notes}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
