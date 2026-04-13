import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, ShieldAlert, TrendingUp, Activity, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import type { ORReadinessEvent } from '@/lib/operationalTypes';
import { OR_EVENT_TYPES, CLASSIFICATION_OPTIONS } from '@/lib/operationalTypes';
import { ORReadinessForm } from './ORReadinessForm';

interface Props {
  events: ORReadinessEvent[];
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function ORReadinessModule({ events, posture }: Props) {
  const [groupBy, setGroupBy] = useState<'event_type' | 'room_id' | 'service_line' | 'shift' | 'vendor_rep' | 'classification'>('event_type');
  const [showForm, setShowForm] = useState(false);

  const stats = useMemo(() => {
    const totalDelay = events.reduce((s, e) => s + e.delay_minutes, 0);
    const repeatPatterns = events.filter(e => e.classification === 'repeat_pattern').length;
    const underAnesthesia = events.filter(e => e.patient_wait_status === 'under_anesthesia').length;
    return { totalEvents: events.length, totalDelay, avgDelay: events.length ? Math.round(totalDelay / events.length) : 0, repeatPatterns, underAnesthesia };
  }, [events]);

  const chartData = useMemo(() => {
    const groups: Record<string, { count: number; totalDelay: number }> = {};
    events.forEach(e => {
      const key = (e[groupBy] as string) || 'Unknown';
      if (!groups[key]) groups[key] = { count: 0, totalDelay: 0 };
      groups[key].count++;
      groups[key].totalDelay += e.delay_minutes;
    });
    return Object.entries(groups).map(([name, d]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '…' : name,
      events: d.count,
      avgDelay: Math.round(d.totalDelay / d.count),
    }));
  }, [events, groupBy]);

  const corrective = useMemo(() => {
    const actions: { action: string; type: 'education' | 'escalation' | 'process'; context: string }[] = [];
    const repeatEvents = events.filter(e => e.classification === 'repeat_pattern');
    if (repeatEvents.length > 0) {
      actions.push({ action: 'Escalate repeat pattern events for root cause review', type: 'escalation', context: `${repeatEvents.length} repeat pattern event(s) detected` });
    }
    const sterilization = events.filter(e => e.event_type === 'sterilization_lapse');
    if (sterilization.length > 0) {
      actions.push({ action: 'Mandatory sterile processing retraining', type: 'education', context: `${sterilization.length} sterilization lapse(es)` });
    }
    const roomGroups: Record<string, number> = {};
    events.forEach(e => { if (e.room_id) roomGroups[e.room_id] = (roomGroups[e.room_id] || 0) + 1; });
    Object.entries(roomGroups).filter(([, c]) => c >= 2).forEach(([room, c]) => {
      actions.push({ action: `Review workflow in ${room} — ${c} events`, type: 'process', context: 'Room-level trend' });
    });
    if (stats.avgDelay > 25) {
      actions.push({ action: 'Evaluate backup implant/instrument protocols', type: 'process', context: `Average delay ${stats.avgDelay}min exceeds 25min threshold` });
    }
    return actions;
  }, [events, stats]);

  const isPayer = posture === 'payment-integrity';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-violation" />
            OR Readiness & Sterile Integrity
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPayer ? 'Identify operational patterns that drive claim complexity and cost variance.' : 'Track and improve surgical readiness to reduce delays and patient risk.'}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" />
          Log Event
        </Button>
      </div>

      {showForm && <ORReadinessForm onClose={() => setShowForm(false)} />}

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.totalEvents, icon: Activity, color: '' },
          { label: 'Total Delay', value: `${stats.totalDelay}min`, icon: Clock, color: stats.totalDelay > 100 ? 'text-violation' : '' },
          { label: 'Avg Delay', value: `${stats.avgDelay}min`, icon: Clock, color: stats.avgDelay > 25 ? 'text-disagreement' : '' },
          { label: 'Repeat Patterns', value: stats.repeatPatterns, icon: TrendingUp, color: stats.repeatPatterns > 0 ? 'text-violation' : 'text-consensus' },
          { label: 'Under Anesthesia', value: stats.underAnesthesia, icon: AlertTriangle, color: stats.underAnesthesia > 0 ? 'text-disagreement' : '' },
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
            <p className="text-sm font-semibold">Event Distribution</p>
            <Select value={groupBy} onValueChange={v => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="event_type">Event Type</SelectItem>
                <SelectItem value="room_id">Room</SelectItem>
                <SelectItem value="service_line">Service Line</SelectItem>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="vendor_rep">Vendor Rep</SelectItem>
                <SelectItem value="classification">Classification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="events" name="Events" fill="hsl(var(--violation))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgDelay" name="Avg Delay (min)" fill="hsl(var(--disagreement))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No events recorded</div>
          )}
        </div>

        {/* Corrective Actions */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold">{isPayer ? 'Risk Indicators' : 'Suggested Corrective Actions'}</p>
          {corrective.length === 0 ? (
            <p className="text-xs text-muted-foreground">No actionable patterns detected.</p>
          ) : (
            <div className="space-y-2">
              {corrective.map((c, i) => (
                <div key={i} className={cn('rounded-md border p-2.5 text-xs space-y-1',
                  c.type === 'escalation' ? 'border-violation/30 bg-violation/5' :
                  c.type === 'education' ? 'border-disagreement/30 bg-disagreement/5' :
                  'border-info-blue/30 bg-info-blue/5'
                )}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn('text-[10px]',
                      c.type === 'escalation' ? 'text-violation border-violation/30' :
                      c.type === 'education' ? 'text-disagreement border-disagreement/30' :
                      'text-info-blue border-info-blue/30'
                    )}>{c.type}</Badge>
                    <span className="font-medium">{c.action}</span>
                  </div>
                  <p className="text-muted-foreground">{c.context}</p>
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
          {events.map(e => (
            <div key={e.id} className="px-4 py-3 flex items-start gap-3 text-xs">
              <div className="shrink-0 mt-0.5">
                <Badge variant="outline" className={cn('text-[10px]',
                  e.classification === 'repeat_pattern' ? 'text-violation border-violation/30' :
                  e.classification === 'workflow_issue' ? 'text-disagreement border-disagreement/30' :
                  'text-info-blue border-info-blue/30'
                )}>
                  {CLASSIFICATION_OPTIONS.find(o => o.value === e.classification)?.label}
                </Badge>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{OR_EVENT_TYPES.find(t => t.value === e.event_type)?.label}</span>
                  {e.room_id && <span className="text-muted-foreground">• {e.room_id}</span>}
                  {e.service_line && <span className="text-muted-foreground">• {e.service_line}</span>}
                  <span className="text-muted-foreground">• {e.shift} shift</span>
                </div>
                {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
                <div className="flex gap-3 text-muted-foreground">
                  <span>Delay: <strong className="text-foreground">{e.delay_minutes}min</strong></span>
                  <span>Patient: <strong className="text-foreground">{e.patient_wait_status.replace(/_/g, ' ')}</strong></span>
                  {e.vendor_rep && <span>Vendor: {e.vendor_rep}</span>}
                </div>
              </div>
              <span className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
