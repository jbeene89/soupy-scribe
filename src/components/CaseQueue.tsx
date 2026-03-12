import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AuditCase, CaseStatus } from '@/lib/types';
import { RiskIndicator } from './RiskIndicator';
import { ConsensusMeter } from './ConsensusMeter';
import { CPTCodeBadge } from './CPTCodeBadge';
import { CaseCard } from './spark/CaseCard';
import { CaseCardSkeleton } from './spark/LoadingState';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle, XCircle, Search, FileText, LayoutGrid, List } from 'lucide-react';

const statusConfig: Record<CaseStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-disagreement/15 text-disagreement border-disagreement/30' },
  'in-review': { label: 'In Review', icon: Search, className: 'bg-info-blue/15 text-info-blue border-info-blue/30' },
  approved: { label: 'Approved', icon: CheckCircle, className: 'bg-consensus/15 text-consensus border-consensus/30' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-violation/15 text-violation border-violation/30' },
  appealed: { label: 'Appealed', icon: FileText, className: 'bg-role-analyst/15 text-role-analyst border-role-analyst/30' },
};

interface CaseQueueProps {
  cases: AuditCase[];
  onSelectCase: (caseData: AuditCase) => void;
  selectedCaseId?: string;
  loading?: boolean;
}

export function CaseQueue({ cases, onSelectCase, selectedCaseId, loading }: CaseQueueProps) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4">
          <div className="space-y-1">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {[1, 2, 3, 4, 5, 6].map(i => <CaseCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Audit Case Queue</h2>
          <p className="text-sm text-muted-foreground">{cases.length} cases • {cases.filter(c => c.status === 'pending').length} pending review</p>
        </div>
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode('table')}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode('cards')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {cases.length === 0 ? (
        <div className="p-12 text-center">
          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No cases found</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Cases will appear here when they're available.</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {cases.map(c => (
            <CaseCard key={c.id} auditCase={c} onClick={() => onSelectCase(c)} />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Case ID</TableHead>
              <TableHead>Physician</TableHead>
              <TableHead>CPT Codes</TableHead>
              <TableHead className="text-right">Claim</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map(c => {
              const status = statusConfig[c.status];
              const StatusIcon = status.icon;
              return (
                <TableRow
                  key={c.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedCaseId === c.id && 'bg-accent/10 border-l-2 border-l-accent'
                  )}
                  onClick={() => onSelectCase(c)}
                >
                  <TableCell className="font-mono text-sm font-medium">{c.caseNumber}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{c.physicianName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{c.physicianId}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {c.cptCodes.map(code => <CPTCodeBadge key={code} code={code} />)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">${c.claimAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <RiskIndicator riskScore={c.riskScore} compact />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs gap-1', status.className)}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.dateOfService}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
