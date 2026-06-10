import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { OBAuditResult } from '@/lib/obFetalTypes';

export function ContraindicationLedger({ result }: { result: OBAuditResult }) {
  if (!result.contraindicationChecks.length) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        No Pitocin or Misoprostol doses in the MAR — nothing to check.
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {result.contraindicationChecks.map((c) => (
        <Card key={c.id} className="p-3">
          <div className="flex items-start gap-3">
            {c.clear ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold">{c.medicationLabel}</span>
                <Badge variant="outline" className="text-[10px]">{c.dose || 'dose'}</Badge>
                <span className="text-muted-foreground">{new Date(c.doseEventTime).toLocaleString()}</span>
              </div>
              {c.clear ? (
                <p className="text-xs text-muted-foreground mt-1">None documented at time of administration.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {c.contraindicationsPresent.map((ci, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-semibold text-foreground">{ci.label}</span>
                      <span className="text-muted-foreground"> — {ci.evidence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
