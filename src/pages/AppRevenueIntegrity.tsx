import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Wand2, DollarSign, TrendingDown, AlertTriangle, FileWarning, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  detectRevenueLeaks,
  parseRemitCSV,
  DEMO_REMIT,
  type RemitRow,
  type RIFindingType,
} from '@/lib/revenueIntegrityTypes';
import {
  listRevenueIntegrityFindings,
  persistDetectionResult,
  updateFindingStatus,
  deleteFinding,
} from '@/lib/revenueIntegrityService';
import type { RevenueIntegrityFinding } from '@/lib/revenueIntegrityTypes';
import { useAuth } from '@/hooks/useAuth';

const FINDING_LABEL: Record<RIFindingType, string> = {
  underpayment: 'Underpayment',
  drg_downgrade: 'DRG Downgrade',
  missed_charge: 'Missed Charge',
  duplicate_denial: 'Repeat Denial',
  modifier_drop: 'Modifier Drop',
  timely_filing_risk: 'Timely Filing Risk',
};

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function AppRevenueIntegrity() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [findings, setFindings] = useState<RevenueIntegrityFinding[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('open');

  const refresh = async () => {
    setLoading(true);
    try {
      setFindings(await listRevenueIntegrityFindings());
    } catch (e) {
      console.error(e);
      toast.error('Failed to load findings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    return findings.filter(f =>
      (filterType === 'all' || f.finding_type === filterType) &&
      (filterStatus === 'all' || f.status === filterStatus),
    );
  }, [findings, filterType, filterStatus]);

  const totals = useMemo(() => {
    const open = findings.filter(f => f.status === 'open');
    return {
      total: findings.length,
      open: open.length,
      atRisk: open.reduce((s, f) => s + Number(f.variance_amount || 0), 0),
      recovered: findings
        .filter(f => f.status === 'recovered')
        .reduce((s, f) => s + Number(f.variance_amount || 0), 0),
    };
  }, [findings]);

  const runDetection = async (rows: RemitRow[], label: string) => {
    if (!userId) {
      toast.error('Sign in required');
      return;
    }
    setRunning(true);
    try {
      const result = detectRevenueLeaks(rows);
      const inserted = await persistDetectionResult(result, userId);
      toast.success(`${inserted} finding(s) detected from ${label}`);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error('Detection failed');
    } finally {
      setRunning(false);
    }
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseRemitCSV(text);
    if (rows.length === 0) {
      toast.error('No rows parsed. Expected headers: claim_id, expected_amount, paid_amount, ...');
      return;
    }
    await runDetection(rows, `${rows.length} remit rows`);
    e.target.value = '';
  };

  const onStatusChange = async (id: string, status: RevenueIntegrityFinding['status']) => {
    try {
      await updateFindingStatus(id, status);
      await refresh();
    } catch {
      toast.error('Update failed');
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteFinding(id);
      setFindings(prev => prev.filter(f => f.id !== id));
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revenue Integrity</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Detect underpayments, DRG downgrades, modifier drops, and duplicate denials from remit data.
            Standalone module — operates on uploaded payer remits, contract terms, and claim outcomes.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => runDetection(DEMO_REMIT, 'demo remit')} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Run on demo remit
          </Button>
          <label className="inline-flex">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onUpload} />
            <Button asChild variant="default">
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload remit CSV
              </span>
            </Button>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Open Findings" value={totals.open.toString()} />
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Revenue at Risk" value={fmt$(totals.atRisk)} />
        <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Recovered" value={fmt$(totals.recovered)} />
        <SummaryCard icon={<FileWarning className="h-4 w-4" />} label="Total Findings" value={totals.total.toString()} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base">Findings Ledger</CardTitle>
              <CardDescription>Variance-ranked. Highest dollar leak surfaces first.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {Object.entries(FINDING_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_review">In review</SelectItem>
                  <SelectItem value="recovered">Recovered</SelectItem>
                  <SelectItem value="written_off">Written off</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 mx-auto animate-spin mb-2" />
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No findings yet. Upload a remit CSV or run detection on the demo data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.claim_id}</TableCell>
                      <TableCell className="text-sm">{f.payer_name || f.payer_code || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{FINDING_LABEL[f.finding_type]}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={f.severity === 'critical' || f.severity === 'high' ? 'destructive' : 'secondary'}>
                          {f.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmt$(Number(f.variance_amount || 0))}
                      </TableCell>
                      <TableCell className="text-xs max-w-md text-muted-foreground">{f.description}</TableCell>
                      <TableCell>
                        <Select value={f.status} onValueChange={v => onStatusChange(f.id, v as RevenueIntegrityFinding['status'])}>
                          <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_review">In review</SelectItem>
                            <SelectItem value="recovered">Recovered</SelectItem>
                            <SelectItem value="written_off">Written off</SelectItem>
                            <SelectItem value="dismissed">Dismissed</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(f.id)} className="text-xs h-7">
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expected CSV format</CardTitle>
          <CardDescription>Headers are case-insensitive. Missing columns are skipped.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`claim_id,patient_id,payer_code,payer_name,cpt_code,drg_billed,drg_paid,
expected_amount,paid_amount,date_of_service,denial_reason,modifier_billed,modifier_paid`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-muted-foreground">{icon}</div>
        </div>
        <div className="text-2xl font-semibold mt-2 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}