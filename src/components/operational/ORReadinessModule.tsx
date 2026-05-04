import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, ShieldAlert, TrendingUp, Activity, Plus, DollarSign, ShieldOff, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { cn } from '@/lib/utils';
import type { ORReadinessEvent } from '@/lib/operationalTypes';
import { OR_EVENT_TYPES, CLASSIFICATION_OPTIONS, estimateEventCost } from '@/lib/operationalTypes';
import { ORReadinessForm } from './ORReadinessForm';
import { exportORReadinessPDF, OR_READINESS_SECTIONS } from '@/lib/exportOperationalPDF';
import { SectionExportMenu } from '@/components/SectionExportMenu';
import { SupplyWasteSection } from './SupplyWasteSection';

interface Props {
  events: ORReadinessEvent[];
  posture: 'payment-integrity' | 'compliance-coaching';
}

export function ORReadinessModule({ events, posture }: Props) {
  const [groupBy, setGroupBy] = useState<'event_type' | 'room_id' | 'service_line' | 'shift' | 'vendor_rep' | 'classification' | 'day_of_week'>('event_type');
  const [showForm, setShowForm] = useState(false);

  const stats = useMemo(() => {
    const totalDelay = events.reduce((s, e) => s + e.delay_minutes, 0);
    const totalCost = events.reduce((s, e) => s + (e.estimated_cost || estimateEventCost(e.delay_minutes, e.event_type)), 0);
    const repeatPatterns = events.filter(e => e.classification === 'repeat_pattern').length;
    const underAnesthesia = events.filter(e => e.patient_wait_status === 'under_anesthesia').length;
    const safetyFlags = events.filter(e => e.safety_flag).length;
    const sterilizationCount = events.filter(e => e.event_type === 'sterilization_lapse' || e.event_type === 'contaminated').length;
    return {
      totalEvents: events.length, totalDelay, totalCost,
      avgDelay: events.length ? Math.round(totalDelay / events.length) : 0,
      repeatPatterns, underAnesthesia, safetyFlags, sterilizationCount,
    };
  }, [events]);

  const chartData = useMemo(() => {
    const groups: Record<string, { count: number; totalDelay: number; totalCost: number; safetyFlags: number }> = {};
    events.forEach(e => {
      const key = (e[groupBy as keyof ORReadinessEvent] as string) || 'Unknown';
      if (!groups[key]) groups[key] = { count: 0, totalDelay: 0, totalCost: 0, safetyFlags: 0 };
      groups[key].count++;
      groups[key].totalDelay += e.delay_minutes;
      groups[key].totalCost += e.estimated_cost || estimateEventCost(e.delay_minutes, e.event_type);
      if (e.safety_flag) groups[key].safetyFlags++;
    });
    return Object.entries(groups).map(([name, d]) => ({
      name: name.length > 18 ? name.slice(0, 16) + '…' : name,
      events: d.count,
      avgDelay: Math.round(d.totalDelay / d.count),
      totalCost: d.totalCost,
      safetyFlags: d.safetyFlags,
    }));
  }, [events, groupBy]);

  // Peer benchmark: average events per group across all groups
  const peerBenchmark = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.round(chartData.reduce((s, d) => s + d.events, 0) / chartData.length * 10) / 10;
  }, [chartData]);

  const corrective = useMemo(() => {
    const actions: { action: string; type: 'education' | 'escalation' | 'process' | 'safety'; context: string; priority: number }[] = [];

    // SAFETY: Recurring sterilization / contamination
    const sterilRooms: Record<string, number> = {};
    events.filter(e => e.event_type === 'sterilization_lapse' || e.event_type === 'contaminated').forEach(e => {
      const key = e.room_id || 'Unknown';
      sterilRooms[key] = (sterilRooms[key] || 0) + 1;
    });
    Object.entries(sterilRooms).filter(([, c]) => c >= 2).forEach(([room, c]) => {
      actions.push({
        action: `SAFETY ALERT: ${c} sterilization/contamination events in ${room}`,
        type: 'safety', context: 'Recurring sterile integrity breach — patient safety concern. Immediate process review required.',
        priority: 0,
      });
    });

    const repeatEvents = events.filter(e => e.classification === 'repeat_pattern');
    if (repeatEvents.length > 0) {
      actions.push({ action: 'Escalate repeat pattern events for root cause review', type: 'escalation', context: `${repeatEvents.length} repeat pattern event(s) detected`, priority: 1 });
    }

    const sterilization = events.filter(e => e.event_type === 'sterilization_lapse' || e.event_type === 'contaminated');
    if (sterilization.length > 0) {
      actions.push({ action: 'Mandatory sterile processing retraining', type: 'education', context: `${sterilization.length} sterile integrity event(s)`, priority: 2 });
    }

    // Vendor-specific patterns
    const vendorGroups: Record<string, { count: number; types: Set<string> }> = {};
    events.forEach(e => {
      if (e.vendor_rep) {
        if (!vendorGroups[e.vendor_rep]) vendorGroups[e.vendor_rep] = { count: 0, types: new Set() };
        vendorGroups[e.vendor_rep].count++;
        vendorGroups[e.vendor_rep].types.add(e.event_type);
      }
    });
    Object.entries(vendorGroups).filter(([, v]) => v.count >= 2).forEach(([rep, v]) => {
      actions.push({ action: `Review vendor protocols for ${rep} — ${v.count} events across ${v.types.size} type(s)`, type: 'process', context: 'Vendor-linked trend', priority: 3 });
    });

    // Room-level clustering
    const roomGroups: Record<string, number> = {};
    events.forEach(e => { if (e.room_id) roomGroups[e.room_id] = (roomGroups[e.room_id] || 0) + 1; });
    Object.entries(roomGroups).filter(([, c]) => c >= 2).forEach(([room, c]) => {
      actions.push({ action: `Review workflow in ${room} — ${c} events`, type: 'process', context: 'Room-level trend', priority: 4 });
    });

    // Day-of-week clustering
    const dayGroups: Record<string, number> = {};
    events.forEach(e => { if (e.day_of_week) dayGroups[e.day_of_week] = (dayGroups[e.day_of_week] || 0) + 1; });
    Object.entries(dayGroups).filter(([, c]) => c >= 3).forEach(([day, c]) => {
      actions.push({ action: `${day} has ${c} events — review scheduling and staffing`, type: 'process', context: 'Day-of-week pattern', priority: 5 });
    });

    if (stats.avgDelay > 25) {
      actions.push({ action: 'Evaluate backup implant/instrument protocols', type: 'process', context: `Average delay ${stats.avgDelay}min exceeds 25min threshold`, priority: 6 });
    }

    // Tray-not-ready pattern
    const trayEvents = events.filter(e => e.event_type === 'tray_not_ready');
    if (trayEvents.length >= 2) {
      actions.push({ action: 'Review sterile processing turnaround and scheduling alignment', type: 'education', context: `${trayEvents.length} tray-not-ready events`, priority: 3 });
    }

    return actions.sort((a, b) => a.priority - b.priority);
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
            {isPayer ? 'Identify operational patterns that drive claim complexity, cost variance, and safety risk.' : 'Track and improve surgical readiness to reduce delays, waste, and patient risk.'}
          </p>
        </div>
        <div className="flex gap-2">
          <SectionExportMenu
            sections={OR_READINESS_SECTIONS}
            buttonLabel="Export PDF"
            onExport={(ids) => exportORReadinessPDF(events, posture, ids)}
          />
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5" />
            Log Event
          </Button>
        </div>
      </div>

      {showForm && <ORReadinessForm onClose={() => setShowForm(false)} />}

      {/* Score Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Events', value: stats.totalEvents, icon: Activity, color: '' },
          { label: 'Total Delay', value: `${stats.totalDelay}min`, icon: Clock, color: stats.totalDelay > 100 ? 'text-violation' : '' },
          { label: 'Avg Delay', value: `${stats.avgDelay}min`, icon: Clock, color: stats.avgDelay > 25 ? 'text-disagreement' : '' },
          { label: 'Est. Cost Impact', value: `$${stats.totalCost.toLocaleString()}`, icon: DollarSign, color: 'text-violation' },
          { label: 'Repeat Patterns', value: stats.repeatPatterns, icon: TrendingUp, color: stats.repeatPatterns > 0 ? 'text-violation' : 'text-consensus' },
          { label: 'Under Anesthesia', value: stats.underAnesthesia, icon: AlertTriangle, color: stats.underAnesthesia > 0 ? 'text-disagreement' : '' },
          { label: 'Safety Flags', value: stats.safetyFlags, icon: ShieldOff, color: stats.safetyFlags > 0 ? 'text-violation' : 'text-consensus' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 shadow-sm text-center">
            <s.icon className={cn('h-4 w-4 mx-auto mb-1', s.color || 'text-muted-foreground')} />
            <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Safety Alert Banner */}
      {stats.safetyFlags > 0 && (
        <div className="rounded-lg border-2 border-violation/40 bg-violation/5 p-4 flex items-start gap-3">
          <ShieldOff className="h-5 w-5 text-violation shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-violation">Patient Safety Alert</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {stats.safetyFlags} event(s) flagged for potential patient safety concern (sterilization breaches, contamination).
              {stats.sterilizationCount >= 2 && ' Recurring sterile integrity failures detected — immediate escalation recommended.'}
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
                <SelectItem value="event_type">Event Type</SelectItem>
                <SelectItem value="room_id">Room</SelectItem>
                <SelectItem value="service_line">Service Line</SelectItem>
                <SelectItem value="shift">Shift</SelectItem>
                <SelectItem value="day_of_week">Day of Week</SelectItem>
                <SelectItem value="vendor_rep">Vendor Rep</SelectItem>
                <SelectItem value="classification">Classification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="events" name="Events" fill="hsl(var(--violation))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="avgDelay" name="Avg Delay (min)" fill="hsl(var(--disagreement))" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="totalCost" name="Cost ($)" fill="hsl(var(--info-blue))" radius={[4, 4, 0, 0]} />
                <ReferenceLine yAxisId="left" y={peerBenchmark} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" label={{ value: `Avg: ${peerBenchmark}`, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">No events recorded</div>
          )}
        </div>

        {/* Corrective Actions */}
        <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 max-h-[400px] overflow-y-auto">
          <p className="text-sm font-semibold">{isPayer ? 'Risk Indicators & Cost Drivers' : 'Suggested Corrective Actions'}</p>
          {corrective.length === 0 ? (
            <p className="text-xs text-muted-foreground">No actionable patterns detected.</p>
          ) : (
            <div className="space-y-2">
              {corrective.map((c, i) => (
                <div key={i} className={cn('rounded-md border p-2.5 text-xs space-y-1',
                  c.type === 'safety' ? 'border-violation/50 bg-violation/10' :
                  c.type === 'escalation' ? 'border-violation/30 bg-violation/5' :
                  c.type === 'education' ? 'border-disagreement/30 bg-disagreement/5' :
                  'border-info-blue/30 bg-info-blue/5'
                )}>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={cn('text-[10px]',
                      c.type === 'safety' ? 'text-violation border-violation/50 bg-violation/10' :
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
          {events.map(e => {
            const cost = e.estimated_cost || estimateEventCost(e.delay_minutes, e.event_type);
            return (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3 text-xs">
                <div className="shrink-0 mt-0.5 flex flex-col gap-1">
                  <Badge variant="outline" className={cn('text-[10px]',
                    e.classification === 'repeat_pattern' ? 'text-violation border-violation/30' :
                    e.classification === 'workflow_issue' ? 'text-disagreement border-disagreement/30' :
                    'text-info-blue border-info-blue/30'
                  )}>
                    {CLASSIFICATION_OPTIONS.find(o => o.value === e.classification)?.label}
                  </Badge>
                  {e.safety_flag && (
                    <Badge variant="outline" className="text-[10px] text-violation border-violation/40 bg-violation/10">
                      ⚠ Safety
                    </Badge>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{OR_EVENT_TYPES.find(t => t.value === e.event_type)?.label}</span>
                    {e.room_id && <span className="text-muted-foreground">• {e.room_id}</span>}
                    {e.service_line && <span className="text-muted-foreground">• {e.service_line}</span>}
                    {e.day_of_week && <span className="text-muted-foreground">• {e.day_of_week}</span>}
                    <span className="text-muted-foreground">• {e.shift} shift</span>
                  </div>
                  {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
                  <div className="flex gap-3 text-muted-foreground flex-wrap">
                    <span>Delay: <strong className="text-foreground">{e.delay_minutes}min</strong></span>
                    <span>Patient: <strong className="text-foreground">{e.patient_wait_status.replace(/_/g, ' ')}</strong></span>
                    <span>Cost: <strong className="text-violation">${cost.toLocaleString()}</strong></span>
                    {e.vendor_rep && <span>Vendor: {e.vendor_rep}</span>}
                    {e.replacement_source && <span>Source: {e.replacement_source}</span>}
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Supply Utilization Audit (frugal waste tracking) */}
      <SupplyWasteSection posture={posture} />
    </div>
  );
}
