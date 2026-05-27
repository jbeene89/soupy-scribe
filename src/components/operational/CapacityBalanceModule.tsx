import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Scale, AlertTriangle, TrendingDown, BedDouble, Plus, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { CapacityEvent } from '@/lib/capacityTypes';
import { DEFAULT_TARGET_RATIOS, computeCapacity } from '@/lib/capacityTypes';
import { rollupCapacity, createCapacityEvent } from '@/lib/capacityService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const SHIFTS = ['Day', 'Evening', 'Night'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  events: CapacityEvent[];
  onChanged?: () => void;
}

export function CapacityBalanceModule({ events, onChanged }: Props) {
  const rollup = useMemo(() => rollupCapacity(events), [events]);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Capacity Balance
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Tracks unit-level staffing and bed utilization against safe ratios. Surfaces both over-ratio risk
            (overtime, sentinel-event exposure) and under-ratio waste (idle nurse hours, empty-bed opportunity cost).
          </p>
        </div>
        <CapacityLogDialog open={open} setOpen={setOpen} onCreated={onChanged} />
      </div>

      {/* Rollup cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Events Logged"
          value={rollup.totalEvents.toString()}
          sub={`${rollup.balanced} balanced`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-violation" />}
          label="Over-Ratio Risk"
          value={fmt(rollup.totalRiskCost)}
          sub={`${rollup.overRatio} unsafe shifts`}
          tone="risk"
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4 text-disagreement" />}
          label="Idle / Empty Cost"
          value={fmt(rollup.totalIdleLoss)}
          sub={`${rollup.underRatio} overstaffed shifts`}
          tone="loss"
        />
        <StatCard
          icon={<BedDouble className="h-4 w-4 text-primary" />}
          label="Total Impact"
          value={fmt(rollup.totalImpact)}
          sub="Risk + waste, both directions"
          tone="total"
        />
      </div>

      {events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No capacity events logged yet. Click <span className="font-semibold">Log Shift</span> to record
          staffed beds, occupied beds, and nurses on shift — the system will compute the ratio and dollar impact.
        </Card>
      ) : (
        <Tabs defaultValue="byUnit" className="w-full">
          <TabsList>
            <TabsTrigger value="byUnit">By Unit</TabsTrigger>
            <TabsTrigger value="byShift">By Shift</TabsTrigger>
            <TabsTrigger value="events">Event Log</TabsTrigger>
          </TabsList>

          <TabsContent value="byUnit" className="space-y-2 mt-4">
            {rollup.byUnit.map(u => (
              <Card key={u.unit} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{u.unit}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {u.events} shifts · avg utilization {u.avgUtil.toFixed(0)}%
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {u.over > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <ArrowUpRight className="h-3 w-3" /> {u.over} over
                    </Badge>
                  )}
                  {u.under > 0 && (
                    <Badge variant="outline" className="gap-1 border-disagreement/40 text-disagreement">
                      <ArrowDownRight className="h-3 w-3" /> {u.under} under
                    </Badge>
                  )}
                  <div className="font-bold text-sm">{fmt(u.impact)}</div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="byShift" className="space-y-2 mt-4">
            {rollup.byShift.map(s => (
              <Card key={s.shift} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold capitalize">{s.shift}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.events} events</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {s.over > 0 && <Badge variant="destructive">{s.over} over</Badge>}
                  {s.under > 0 && <Badge variant="outline" className="border-disagreement/40 text-disagreement">{s.under} under</Badge>}
                  <div className="font-bold text-sm">{fmt(s.impact)}</div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="events" className="space-y-2 mt-4">
            {events.slice(0, 30).map(e => (
              <EventRow key={e.id} event={e} />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'risk' | 'loss' | 'total' }) {
  return (
    <Card className={cn(
      'p-4 space-y-1',
      tone === 'risk' && 'border-l-4 border-l-violation',
      tone === 'loss' && 'border-l-4 border-l-disagreement',
      tone === 'total' && 'border-l-4 border-l-primary'
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function EventRow({ event }: { event: CapacityEvent }) {
  const util = event.staffed_beds > 0 ? (event.occupied_beds / event.staffed_beds) * 100 : 0;
  const isOver = event.classification === 'over_ratio';
  const isUnder = event.classification === 'under_ratio';
  return (
    <Card className={cn(
      'p-3',
      isOver && 'border-l-4 border-l-violation',
      isUnder && 'border-l-4 border-l-disagreement'
    )}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{event.unit}</span>
            {event.shift && <Badge variant="outline" className="text-[10px]">{event.shift}</Badge>}
            {event.day_of_week && <span className="text-[11px] text-muted-foreground">{event.day_of_week}</span>}
            {isOver && <Badge variant="destructive" className="text-[10px]">Over ratio</Badge>}
            {isUnder && <Badge variant="outline" className="text-[10px] border-disagreement/40 text-disagreement">Under ratio</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {event.occupied_beds}/{event.staffed_beds} beds ({util.toFixed(0)}% util) · {event.nurses_on_shift} RN ·
            ratio {event.actual_ratio}:1 (target {event.target_ratio}:1)
          </div>
          {event.notes && <div className="text-xs mt-1 italic">"{event.notes}"</div>}
        </div>
        <div className="text-right">
          <div className={cn(
            'font-bold text-sm',
            isOver && 'text-violation',
            isUnder && 'text-disagreement'
          )}>
            {event.estimated_impact > 0 ? fmt(event.estimated_impact) : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {event.impact_direction === 'risk_understaffed' ? 'Safety risk' : event.impact_direction === 'loss_overstaffed' ? 'Waste' : 'Balanced'}
          </div>
        </div>
      </div>
    </Card>
  );
}

function CapacityLogDialog({ open, setOpen, onCreated }: { open: boolean; setOpen: (b: boolean) => void; onCreated?: () => void }) {
  const [unit, setUnit] = useState('');
  const [shift, setShift] = useState('Day');
  const [day, setDay] = useState('Mon');
  const [staffed, setStaffed] = useState('');
  const [occupied, setOccupied] = useState('');
  const [nurses, setNurses] = useState('');
  const [target, setTarget] = useState('4');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const s = Number(staffed), o = Number(occupied), n = Number(nurses), t = Number(target);
    if (!unit || !s || !o || !n || !t) return null;
    return computeCapacity({ unit, staffed_beds: s, occupied_beds: o, nurses_on_shift: n, target_ratio: t });
  }, [unit, staffed, occupied, nurses, target]);

  const reset = () => {
    setUnit(''); setStaffed(''); setOccupied(''); setNurses(''); setTarget('4'); setNotes('');
  };

  const submit = async () => {
    if (!unit || !staffed || !occupied || !nurses || !target) {
      toast.error('Fill all required fields'); return;
    }
    setBusy(true);
    try {
      await createCapacityEvent({
        unit,
        shift,
        day_of_week: day,
        staffed_beds: Number(staffed),
        occupied_beds: Number(occupied),
        nurses_on_shift: Number(nurses),
        target_ratio: Number(target),
        notes: notes || undefined,
      });
      toast.success('Capacity event logged');
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log event');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Log Shift</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Capacity Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Unit *</Label>
              <Select value={unit} onValueChange={(v) => {
                setUnit(v);
                if (DEFAULT_TARGET_RATIOS[v]) setTarget(String(DEFAULT_TARGET_RATIOS[v]));
              }}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(DEFAULT_TARGET_RATIOS).map(u => (
                    <SelectItem key={u} value={u}>{u} (target {DEFAULT_TARGET_RATIOS[u]}:1)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Target Ratio *</Label>
              <Input type="number" value={target} onChange={e => setTarget(e.target.value)} min={1} step="0.5" />
            </div>
            <div>
              <Label className="text-xs">Shift</Label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Day</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Staffed Beds *</Label>
              <Input type="number" value={staffed} onChange={e => setStaffed(e.target.value)} min={0} />
            </div>
            <div>
              <Label className="text-xs">Occupied Beds *</Label>
              <Input type="number" value={occupied} onChange={e => setOccupied(e.target.value)} min={0} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Nurses on Shift *</Label>
              <Input type="number" value={nurses} onChange={e => setNurses(e.target.value)} min={0} step="0.5" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Context: callouts, surge, etc." />
            </div>
          </div>

          {preview && (
            <Card className={cn(
              'p-3 text-xs space-y-1',
              preview.classification === 'over_ratio' && 'border-violation/40 bg-violation/5',
              preview.classification === 'under_ratio' && 'border-disagreement/40 bg-disagreement/5',
              preview.classification === 'balanced' && 'border-consensus/40 bg-consensus/5'
            )}>
              <div className="flex items-center justify-between font-semibold">
                <span className="capitalize">{preview.classification.replace('_', ' ')}</span>
                <span>{preview.estimated_impact > 0 ? fmt(preview.estimated_impact) : '—'}</span>
              </div>
              <div>Actual ratio: <span className="font-mono">{preview.actual_ratio}:1</span> · Utilization: <span className="font-mono">{preview.utilization_pct}%</span></div>
              <div className="text-muted-foreground">{preview.rationale}</div>
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Logging…' : 'Log Event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}