import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanSearch, Plus, AlertTriangle, DollarSign, Search } from 'lucide-react';
import { useAdminContext } from '@/components/admin/AdminContext';
import { ImagingUploadDialog } from './ImagingUploadDialog';
import { ImagingFindingCard } from './ImagingFindingCard';

export function ImagingAuditModule() {
  const { imagingFindings } = useAdminContext();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'flagged' | 'reviewed'>('all');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const total = imagingFindings.length;
    const flagged = imagingFindings.filter(f => f.severity === 'high' || f.severity === 'critical').length;
    const mismatches = imagingFindings.filter(f => f.detected_implant_count < f.expected_implant_count).length;
    const totalLoss = imagingFindings.reduce((s, f) => s + f.estimated_loss, 0);
    return { total, flagged, mismatches, totalLoss };
  }, [imagingFindings]);

  const filtered = useMemo(() => {
    let list = imagingFindings;
    if (filter === 'flagged') list = list.filter(f => f.severity === 'high' || f.severity === 'critical');
    if (filter === 'reviewed') list = list.filter(f => f.status === 'reviewed');
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(f =>
        f.patient_id?.toLowerCase().includes(q) ||
        f.physician_name?.toLowerCase().includes(q) ||
        f.procedure_label?.toLowerCase().includes(q) ||
        f.body_region?.toLowerCase().includes(q) ||
        f.ai_summary?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [imagingFindings, filter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanSearch className="h-6 w-6 text-primary" />
            Imaging Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            AI vision review of clinical images. Findings link to the linked patient, surgeon and case across every module.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Upload image
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Images audited" value={stats.total} />
        <StatCard label="Flagged (high/critical)" value={stats.flagged} accent="violation" icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Implant count mismatches" value={stats.mismatches} accent="disagreement" />
        <StatCard label="Estimated impact" value={`$${stats.totalLoss.toLocaleString()}`} accent="violation" icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, surgeon, procedure…" className="pl-8" />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All findings</SelectItem>
            <SelectItem value="flagged">Flagged only</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ScanSearch className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No imaging findings yet. Upload an X-ray or intra-op photo to run the AI audit.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((f) => <ImagingFindingCard key={f.id} finding={f} />)}
        </div>
      )}

      <ImagingUploadDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: string | number; accent?: 'violation' | 'disagreement'; icon?: React.ReactNode }) {
  const color = accent === 'violation' ? 'text-violation' : accent === 'disagreement' ? 'text-disagreement' : 'text-foreground';
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</div>
        <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}