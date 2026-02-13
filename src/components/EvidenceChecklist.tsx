import { useState } from 'react';
import type { EvidenceChecklistItem, EvidenceStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Clock, Minus, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CPTCodeBadge } from './CPTCodeBadge';

interface EvidenceChecklistProps {
  items: EvidenceChecklistItem[];
}

const statusConfig: Record<EvidenceStatus, { icon: React.ElementType; label: string; className: string }> = {
  missing: { icon: Circle, label: 'Missing', className: 'text-violation' },
  requested: { icon: Clock, label: 'Requested', className: 'text-disagreement' },
  received: { icon: CheckCircle, label: 'Received', className: 'text-consensus' },
  na: { icon: Minus, label: 'N/A', className: 'text-muted-foreground' },
};

const categoryBadge: Record<string, string> = {
  documentation: 'bg-info-blue/10 text-info-blue border-info-blue/30',
  clinical: 'bg-consensus/10 text-consensus border-consensus/30',
  coding: 'bg-role-analyst/10 text-role-analyst border-role-analyst/30',
  authorization: 'bg-disagreement/10 text-disagreement border-disagreement/30',
};

export function EvidenceChecklist({ items: initialItems }: EvidenceChecklistProps) {
  const [items, setItems] = useState(initialItems);

  const updateStatus = (id: string, status: EvidenceStatus) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const handleRequestRecords = () => {
    const missing = items.filter(i => i.status === 'missing');
    const text = missing.map(i => `• ${i.description}`).join('\n');
    navigator.clipboard.writeText(text);
    missing.forEach(i => updateStatus(i.id, 'requested'));
    toast.success('Records request copied to clipboard', { description: `${missing.length} items marked as requested` });
  };

  const missingCount = items.filter(i => i.status === 'missing').length;
  const receivedCount = items.filter(i => i.status === 'received').length;
  const totalActionable = items.filter(i => i.status !== 'na').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Evidence Checklist</h3>
          <p className="text-xs text-muted-foreground">{receivedCount}/{totalActionable} items received</p>
        </div>
        <div className="flex gap-2">
          {missingCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleRequestRecords} className="text-xs gap-1.5">
              <Copy className="h-3 w-3" />
              Request {missingCount} Records
            </Button>
          )}
          <Button size="sm" variant="outline" className="text-xs gap-1.5">
            <RefreshCw className="h-3 w-3" />
            Recalculate Risk
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.sort((a, b) => {
          const prio = { high: 0, medium: 1, low: 2 };
          return prio[a.priority] - prio[b.priority];
        }).map(item => {
          const status = statusConfig[item.status];
          const StatusIcon = status.icon;
          return (
            <div key={item.id} className={cn(
              'flex items-start gap-3 rounded-md border p-3 transition-colors',
              item.status === 'missing' && 'border-violation/20 bg-violation/5',
              item.status === 'requested' && 'border-disagreement/20 bg-disagreement/5',
              item.status === 'received' && 'border-consensus/20 bg-consensus/5',
              item.status === 'na' && 'opacity-50',
            )}>
              <button
                onClick={() => {
                  const cycle: EvidenceStatus[] = ['missing', 'requested', 'received', 'na'];
                  const next = cycle[(cycle.indexOf(item.status) + 1) % cycle.length];
                  updateStatus(item.id, next);
                }}
                className="mt-0.5"
              >
                <StatusIcon className={cn('h-4 w-4', status.className)} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{item.description}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className={cn('text-[10px]', categoryBadge[item.category])}>
                    {item.category}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {item.priority} priority
                  </Badge>
                  {item.relatedCodes?.map(code => (
                    <CPTCodeBadge key={code} code={code} />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    Risk impact: -{item.impactOnRisk}pts if received
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
