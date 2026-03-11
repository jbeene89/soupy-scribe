import type { RapidResolutionItem } from '@/lib/preAppealTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react';

const priorityConfig = {
  'required': { label: 'Required', className: 'border-violation/40 text-violation bg-violation/10', icon: AlertCircle },
  'helpful': { label: 'Helpful', className: 'border-disagreement/40 text-disagreement bg-disagreement/10', icon: CheckCircle2 },
  'unlikely-to-change-outcome': { label: 'Unlikely to Change Outcome', className: 'border-muted-foreground/40 text-muted-foreground bg-muted/50', icon: MinusCircle },
};

interface RapidResolutionChecklistProps {
  items: RapidResolutionItem[];
}

export function RapidResolutionChecklist({ items }: RapidResolutionChecklistProps) {
  const sorted = [...items].sort((a, b) => {
    const order = { required: 0, helpful: 1, 'unlikely-to-change-outcome': 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Evidence Checklist for Rapid Resolution</CardTitle>
        <p className="text-xs text-muted-foreground">Focused evidence items for this pre-appeal resolution path</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map(item => {
          const pConfig = priorityConfig[item.priority];
          const PIcon = pConfig.icon;

          return (
            <div key={item.id} className="rounded-md border bg-background p-3 space-y-2">
              <div className="flex items-start gap-2">
                <PIcon className={cn('h-4 w-4 mt-0.5 shrink-0', item.priority === 'required' ? 'text-violation' : item.priority === 'helpful' ? 'text-disagreement' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{item.record}</p>
                    <Badge variant="outline" className={cn('text-[10px]', pConfig.className)}>{pConfig.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{item.whyItMatters}</p>
                </div>
              </div>
              <div className="flex gap-3 text-[10px] ml-6">
                {item.supportsQuickReconsideration && (
                  <span className="text-consensus">✓ Supports quick reconsideration</span>
                )}
                {item.absencePushesToAppeal && (
                  <span className="text-violation">⚠ Absence pushes to full appeal</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
