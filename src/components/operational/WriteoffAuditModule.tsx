import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Banknote, Plus, AlertTriangle, ShieldCheck, FileSearch, TrendingUp } from 'lucide-react';
import type { WriteoffEvent, WriteoffType } from '@/lib/writeoffTypes';
import { WRITEOFF_TYPE_LABELS, COMMON_PAYERS, classifyWriteoff } from '@/lib/writeoffTypes';
import { createWriteoffEvent, rollupWriteoffs } from '@/lib/writeoffService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

interface Props {
  events: WriteoffEvent[];
  onChanged?: () => void;
}

export function WriteoffAuditModule({ events, onChanged }: Props) {
  const rollup = useMemo(() => rollupWriteoffs(events), [events]);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" />
            Concession &amp; Write-off Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Audits administrative write-offs, contractual adjustments, charity concessions, small-balance,
            timely-filing, and no-auth events. Surfaces leakage with no documented basis and estimates
            recoverable revenue per category.
          </p>
        </div>
        <WriteoffLogDialog open={open} setOpen={setOpen} onCreated={onChanged} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<FileSearch className="h-4 w-4" />}
          label="Events Logged"
          value={rollup.totalEvents.toString()}
          sub={`${rollup.validCount} validated`}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4 text-violation" />}
          label="Flagged as Leak"
          value={rollup.leakCount.toString()}
          sub={`${rollup.reviewCount} need review`}
          tone="risk"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-consensus" />}
          label="Recoverable Estimate"
          value={fmt(rollup.totalRecoverable)}
          sub="Conservative recovery model"
          tone="recovery"
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4 text-primary" />}
          label="Total Written Off"
          value={fmt(rollup.totalAmount)}
          sub="Across all logged events"
          tone="total"
        />
      </div>

      {events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No write-off events logged yet. Click <span className="font-semibold">Log Write-off</span> to record
          an adjustment — the system classifies it as leak, review, or valid and estimates recoverable revenue.
        </Card>
      ) : (
        <Tabs defaultValue="byType" className="w-full">
          <TabsList>
            <TabsTrigger value="byType">By Type</TabsTrigger>
            <TabsTrigger value="byPayer">By Payer</TabsTrigger>
            <TabsTrigger value="events">Event Log</TabsTrigger>
          </TabsList>

          <TabsContent value="byType" className="space-y-2 mt-4">
            {rollup.byType.map(t => (
              <Card key={t.type} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{WRITEOFF_TYPE_LABELS[t.type]}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {t.count} event(s) · {fmt(t.amount)} written off
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-consensus">{fmt(t.recoverable)}</div>
                  <div className="text-[10px] text-muted-foreground">Recoverable</div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="byPayer" className="space-y-2 mt-4">
            {rollup.byPayer.map(p => (
              <Card key={p.payer} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-semibold">{p.payer}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.count} event(s) · {fmt(p.amount)} written off
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-consensus">{fmt(p.recoverable)}</div>
                  <div className="text-[10px] text-muted-foreground">Recoverable</div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="events" className="space-y-2 mt-4">
            {events.slice(0, 50).map(e => <EventRow key={e.id} event={e} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'risk' | 'recovery' | 'total' }) {
  return (
    <Card className={cn(
      'p-4 space-y-1',
      tone === 'risk' && 'border-l-4 border-l-violation',
      tone === 'recovery' && 'border-l-4 border-l-consensus',
      tone === 'total' && 'border-l-4 border-l-primary'
    )}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function EventRow({ event }: { event: WriteoffEvent }) {
  const isLeak = event.classification === 'leak';
  const isReview = event.classification === 'review';
  return (
    <Card className={cn(
      'p-3',
      isLeak && 'border-l-4 border-l-violation',
      isReview && 'border-l-4 border-l-amber-500'
    )}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{event.payer}</span>
            {event.patient_account && <span className="text-[11px] text-muted-foreground font-mono">{event.patient_account}</span>}
            <Badge variant="outline" className="text-[10px]">{WRITEOFF_TYPE_LABELS[event.writeoff_type]}</Badge>
            {isLeak && <Badge variant="destructive" className="text-[10px]">Leak</Badge>}
            {isReview && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">Review</Badge>}
            {event.classification === 'valid' && <Badge variant="outline" className="text-[10px] border-consensus/40 text-consensus">Valid</Badge>}
            {event.appeal_viable && <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">Appeal viable</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Written off: <span className="font-mono">{fmt(event.amount)}</span>
            {event.reason_code && <> · code <span className="font-mono">{event.reason_code}</span></>}
            {event.policy_basis && <> · basis: {event.policy_basis}</>}
          </div>
          {event.notes && <div className="text-xs mt-1 italic">"{event.notes}"</div>}
        </div>
        <div className="text-right shrink-0">
          <div className={cn('font-bold text-sm', event.recoverable_estimate > 0 ? 'text-consensus' : 'text-muted-foreground')}>
            {event.recoverable_estimate > 0 ? fmt(event.recoverable_estimate) : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">Recoverable</div>
        </div>
      </div>
    </Card>
  );
}

function WriteoffLogDialog({ open, setOpen, onCreated }: { open: boolean; setOpen: (b: boolean) => void; onCreated?: () => void }) {
  const [payer, setPayer] = useState('');
  const [account, setAccount] = useState('');
  const [type, setType] = useState<WriteoffType>('contractual');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [basis, setBasis] = useState('');
  const [appealViable, setAppealViable] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => {
    const a = Number(amount);
    if (!payer || !type || !a) return null;
    return classifyWriteoff({
      payer, writeoff_type: type, amount: a,
      policy_basis: basis || undefined, appeal_viable: appealViable,
    });
  }, [payer, type, amount, basis, appealViable]);

  const reset = () => {
    setPayer(''); setAccount(''); setType('contractual'); setAmount('');
    setReason(''); setBasis(''); setAppealViable(false); setNotes('');
  };

  const submit = async () => {
    if (!payer || !type || !amount) {
      toast.error('Payer, type, and amount are required'); return;
    }
    setBusy(true);
    try {
      await createWriteoffEvent({
        payer,
        patient_account: account || undefined,
        writeoff_type: type,
        amount: Number(amount),
        reason_code: reason || undefined,
        policy_basis: basis || undefined,
        appeal_viable: appealViable,
        notes: notes || undefined,
      });
      toast.success('Write-off logged');
      reset();
      setOpen(false);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log write-off');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Log Write-off</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Write-off Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Payer *</Label>
              <Select value={payer} onValueChange={setPayer}>
                <SelectTrigger><SelectValue placeholder="Select payer" /></SelectTrigger>
                <SelectContent>
                  {COMMON_PAYERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Patient Account</Label>
              <Input value={account} onChange={e => setAccount(e.target.value)} placeholder="P-XXXXX" />
            </div>
            <div>
              <Label className="text-xs">Write-off Type *</Label>
              <Select value={type} onValueChange={(v) => setType(v as WriteoffType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(WRITEOFF_TYPE_LABELS) as WriteoffType[]).map(t => (
                    <SelectItem key={t} value={t}>{WRITEOFF_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (USD) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={0} step="0.01" />
            </div>
            <div>
              <Label className="text-xs">Reason Code</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="CO-45, CO-29…" />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox id="appeal" checked={appealViable} onCheckedChange={(c) => setAppealViable(!!c)} />
              <Label htmlFor="appeal" className="text-xs cursor-pointer">Appeal viable</Label>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Policy Basis</Label>
              <Input value={basis} onChange={e => setBasis(e.target.value)} placeholder="e.g. State fee schedule, contract §4.2" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Context: who authorized, why, supporting documentation" />
            </div>
          </div>

          {preview && (
            <Card className={cn(
              'p-3 text-xs space-y-1',
              preview.classification === 'leak' && 'border-violation/40 bg-violation/5',
              preview.classification === 'review' && 'border-amber-500/40 bg-amber-500/5',
              preview.classification === 'valid' && 'border-consensus/40 bg-consensus/5'
            )}>
              <div className="flex items-center justify-between font-semibold">
                <span className="capitalize">{preview.classification}</span>
                <span>{preview.recoverable_estimate > 0 ? fmt(preview.recoverable_estimate) + ' recoverable' : '—'}</span>
              </div>
              <div className="text-muted-foreground">{preview.rationale}</div>
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Logging…' : 'Log Write-off'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}