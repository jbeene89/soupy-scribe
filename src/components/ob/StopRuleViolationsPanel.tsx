import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { OBAuditResult, StopRuleViolation } from '@/lib/obFetalTypes';

function sevTone(s: StopRuleViolation['severity']) {
  if (s === 'critical') return { icon: ShieldAlert, cls: 'border-destructive/50 bg-destructive/5', badge: 'destructive' as const };
  if (s === 'high')     return { icon: AlertTriangle, cls: 'border-amber-500/50 bg-amber-500/5', badge: 'secondary' as const };
  return { icon: AlertCircle, cls: 'border-border', badge: 'outline' as const };
}

export function StopRuleViolationsPanel({ result }: { result: OBAuditResult }) {
  if (!result.violations.length) {
    return (
      <Card className="p-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
        <div className="text-sm font-semibold">No stop-rule violations detected.</div>
        <p className="text-xs text-muted-foreground mt-1">All medication changes occurred during reassuring tracing windows, and no medication continued through a Category III window.</p>
      </Card>
    );
  }
  const order = { critical: 0, high: 1, moderate: 2 } as const;
  const sorted = [...result.violations].sort((a, b) => order[a.severity] - order[b.severity] || a.t.localeCompare(b.t));

  return (
    <div className="space-y-3">
      {sorted.map((v) => {
        const tone = sevTone(v.severity);
        const Icon = tone.icon;
        return (
          <Card key={v.id} className={`p-4 border-l-4 ${tone.cls}`}>
            <div className="flex items-start gap-3">
              <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={tone.badge} className="uppercase text-[10px]">{v.severity}</Badge>
                  <Badge variant="outline" className="text-[10px]">{v.medicationLabel}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(v.t).toLocaleString()}</span>
                </div>
                <div className="text-sm font-semibold mb-1">{v.rule}</div>
                <div className="grid gap-1.5 text-xs">
                  <div><span className="font-semibold text-foreground">Strip finding:</span> <span className="text-muted-foreground">{v.stripFinding}</span></div>
                  <div><span className="font-semibold text-foreground">Medication action:</span> <span className="text-muted-foreground">{v.medAction}</span></div>
                  <div><span className="font-semibold text-foreground">Charted response:</span> <span className="text-muted-foreground italic">"{v.chartedResponse}"</span></div>
                  <div>
                    <span className="font-semibold text-foreground">Time to first stop / decrease:</span>{' '}
                    <span className={v.minutesToAction === null ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                      {v.minutesToAction === null ? 'never documented' : `${v.minutesToAction} min`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
