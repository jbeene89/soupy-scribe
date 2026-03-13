import { useState, useMemo } from 'react';
import type { EvidenceChecklistItem, EvidenceStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, Clock, Minus, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CPTCodeBadge } from './CPTCodeBadge';
import { classifyEvidenceImpact, isEvidenceLikelyCurable, type EvidenceImpactTier } from '@/lib/caseIntelligence';

interface EvidenceChecklistProps {
  items: EvidenceChecklistItem[];
}

const statusConfig: Record<EvidenceStatus, { icon: React.ElementType; label: string; className: string }> = {
  missing: { icon: Circle, label: 'Missing', className: 'text-violation' },
  requested: { icon: Clock, label: 'Requested', className: 'text-disagreement' },
  received: { icon: CheckCircle, label: 'Received', className: 'text-consensus' },
  na: { icon: Minus, label: 'N/A', className: 'text-muted-foreground' },
};

const tierConfig: Record<EvidenceImpactTier, { label: string; description: string; className: string }> = {
  critical: {
    label: 'Highest-Impact — Changes Outcome',
    description: 'Obtaining these items materially changes the case disposition.',
    className: 'border-violation/30 text-violation',
  },
  supporting: {
    label: 'Supporting — Strengthens Case',
    description: 'These items improve defense strength but may not change the outcome alone.',
    className: 'border-disagreement/30 text-disagreement',
  },
  low_value: {
    label: 'Low-Value — Not Worth Chasing',
    description: 'Minimal impact on case outcome. Do not delay determination for these.',
    className: 'border-muted-foreground/30 text-muted-foreground',
  },
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

  // Group items by impact tier
  const groupedItems = useMemo(() => {
    const tiers: Record<EvidenceImpactTier, (EvidenceChecklistItem & { curable: boolean })[]> = {
      critical: [],
      supporting: [],
      low_value: [],
    };
    items.forEach(item => {
      const tier = classifyEvidenceImpact(item);
      tiers[tier].push({ ...item, curable: isEvidenceLikelyCurable(item) });
    });
    return tiers;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Evidence Checklist</h3>
          <p className="text-xs text-muted-foreground">{receivedCount}/{totalActionable} items received • {missingCount} missing</p>
        </div>
        <div className="flex gap-2">
          {missingCount > 0 && (
            <Button size="sm" variant="outline" onClick={handleRequestRecords} className="text-xs gap-1.5">
              <Copy className="h-3 w-3" />
              Request {missingCount} Records
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {(Object.entries(groupedItems) as [EvidenceImpactTier, (EvidenceChecklistItem & { curable: boolean })[]][]).map(([tier, tierItems]) => {
          if (tierItems.length === 0) return null;
          const tierCfg = tierConfig[tier];
          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-[10px]', tierCfg.className)}>{tierCfg.label}</Badge>
                <span className="text-[10px] text-muted-foreground">{tierItems.length} items</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-2">{tierCfg.description}</p>

              <div className="space-y-1.5">
                {tierItems.sort((a, b) => {
                  // Missing items always sort before received/na; then by priority
                  const statusOrder: Record<string, number> = { missing: 0, requested: 1, received: 2, na: 3 };
                  const statusDiff = (statusOrder[a.status] ?? 2) - (statusOrder[b.status] ?? 2);
                  if (statusDiff !== 0) return statusDiff;
                  const prio: Record<string, number> = { high: 0, medium: 1, low: 2 };
                  return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
                }).map(item => {
                  const status = statusConfig[item.status];
                  const StatusIcon = status.icon;
                  return (
                    <div key={item.id} className={cn(
                      'flex items-start gap-3 rounded-md border p-2.5 transition-colors',
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
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge variant="outline" className={cn('text-[10px]', categoryBadge[item.category])}>
                            {item.category}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {item.priority} priority
                          </Badge>
                          {item.curable && item.status === 'missing' && (
                            <Badge variant="outline" className="text-[10px] border-consensus/30 text-consensus bg-consensus/5">
                              Likely obtainable
                            </Badge>
                          )}
                          {!item.curable && item.status === 'missing' && tier === 'low_value' && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Low value
                            </Badge>
                          )}
                          {item.relatedCodes?.map(code => (
                            <CPTCodeBadge key={code} code={code} />
                          ))}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            Impact: -{item.impactOnRisk}pts
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
