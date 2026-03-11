import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EvidenceReadinessItem } from '@/lib/providerTypes';
import { CheckCircle, XCircle, AlertCircle, FileSearch } from 'lucide-react';

const statusIcons = {
  present: { icon: CheckCircle, className: 'text-consensus' },
  missing: { icon: XCircle, className: 'text-violation' },
  partial: { icon: AlertCircle, className: 'text-disagreement' },
};

const categoryLabels = {
  required: { label: 'Required', className: 'border-violation/40 text-violation bg-violation/10' },
  helpful: { label: 'Helpful', className: 'border-disagreement/40 text-disagreement bg-disagreement/10' },
  'unlikely-to-help': { label: 'Unlikely to Change Outcome', className: 'border-muted-foreground/40 text-muted-foreground bg-muted' },
};

interface EvidenceReadinessChecklistProps {
  items: EvidenceReadinessItem[];
}

export function EvidenceReadinessChecklist({ items }: EvidenceReadinessChecklistProps) {
  const grouped = {
    required: items.filter(i => i.category === 'required'),
    helpful: items.filter(i => i.category === 'helpful'),
    'unlikely-to-help': items.filter(i => i.category === 'unlikely-to-help'),
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-accent" />
          Evidence Readiness Checklist
        </CardTitle>
        <CardDescription>Records needed to support this claim, prioritized by impact</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {(Object.entries(grouped) as [keyof typeof categoryLabels, EvidenceReadinessItem[]][]).map(([cat, catItems]) => {
            if (catItems.length === 0) return null;
            const catConfig = categoryLabels[cat];
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={`text-[10px] ${catConfig.className}`}>{catConfig.label}</Badge>
                  <span className="text-xs text-muted-foreground">{catItems.length} items</span>
                </div>
                <div className="space-y-2">
                  {catItems.map(item => {
                    const statusCfg = statusIcons[item.status];
                    const StatusIcon = statusCfg.icon;
                    return (
                      <div key={item.id} className="p-3 rounded-md border bg-background">
                        <div className="flex items-start gap-2.5">
                          <StatusIcon className={`h-4 w-4 shrink-0 mt-0.5 ${statusCfg.className}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{item.record}</p>
                              <Badge variant="outline" className="text-[9px]">
                                {item.status === 'present' ? 'On File' : item.status === 'partial' ? 'Partial' : 'Missing'}
                              </Badge>
                              {item.essentialForAppeal && (
                                <Badge variant="outline" className="text-[9px] border-violation/30 text-violation">Essential</Badge>
                              )}
                              {item.materiallyImproves && !item.essentialForAppeal && (
                                <Badge variant="outline" className="text-[9px] border-consensus/30 text-consensus">Improves Case</Badge>
                              )}
                            </div>
                            <div className="mt-1.5 space-y-1">
                              <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Why it matters:</span> {item.whyItMatters}</p>
                              <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">Supports:</span> {item.whatItSupports}</p>
                            </div>
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
      </CardContent>
    </Card>
  );
}
