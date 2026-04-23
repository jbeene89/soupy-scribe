import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, AlertTriangle, ArrowRight, Network } from 'lucide-react';
import { useSystemImpact } from '@/hooks/useSystemImpact';
import { formatUSD } from '@/lib/systemImpactService';
import { cn } from '@/lib/utils';

/**
 * Compact summary card showing total cross-module financial impact + top patterns.
 * Lives on the main dashboard, links to the full /app/system-impact page.
 */
export function SystemImpactSummaryCard() {
  const navigate = useNavigate();
  const { totalLoss, categories, patterns, entries } = useSystemImpact();

  if (entries.length === 0) {
    return null;
  }

  const topCategory = categories[0];
  const topPattern = patterns[0];
  const criticalCount = patterns.filter((p) => p.severity === 'critical').length;

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Network className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                System Impact
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {criticalCount} critical
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                Cross-module financial roll-up across {entries.length} events
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate('/app/system-impact')}>
            Open
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              Estimated loss
            </div>
            <div className="text-lg font-bold mt-1">{formatUSD(totalLoss)}</div>
          </div>
          {topCategory && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
                Top driver
              </div>
              <div className="text-sm font-semibold mt-1">{topCategory.category_label}</div>
              <div className="text-[11px] text-muted-foreground">
                {formatUSD(topCategory.total_loss)} · {topCategory.event_count} events
              </div>
            </div>
          )}
          {topPattern && (
            <div
              className={cn(
                'rounded-md border p-3 col-span-2 sm:col-span-1',
                topPattern.severity === 'critical' && 'border-destructive/40 bg-destructive/5',
                topPattern.severity === 'warning' && 'border-amber-500/40 bg-amber-500/5'
              )}
            >
              <div className="text-[10px] uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Top pattern
              </div>
              <div className="text-xs font-semibold mt-1 line-clamp-2">{topPattern.title}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}