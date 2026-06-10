import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OBAuditResult } from '@/lib/obFetalTypes';

function catColor(c: string) {
  if (c === 'III') return 'bg-destructive/20 border-destructive/40 text-destructive';
  if (c === 'II') return 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300';
  if (c === 'I') return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300';
  return 'bg-muted border-border text-muted-foreground';
}

export function StripTimeline({ result }: { result: OBAuditResult }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Strip timeline</h3>
          <p className="text-xs text-muted-foreground">{result.windows.length} windows × {result.windowMinutes} min · click a window to see why it was classified.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Cat I</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Cat II</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Cat III</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max pb-2">
          {result.windows.map((w) => (
            <div
              key={w.start}
              title={`${new Date(w.start).toLocaleTimeString()} — ${w.categoryReason}`}
              className={cn('rounded border px-2 py-2 text-[10px] min-w-[88px] cursor-help', catColor(w.category))}
            >
              <div className="font-semibold">{new Date(w.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div>FHR {w.baselineFHR ?? '—'}</div>
              <div>{w.variability}</div>
              <div>{w.contractionCount} cx {w.tachysystole && '⚠'}</div>
              <div className="font-bold">Cat {w.category}</div>
            </div>
          ))}
        </div>
      </div>
      {result.marEvents.length > 0 && (
        <div className="mt-3 pt-3 border-t">
          <div className="text-xs font-semibold mb-2">Medication events</div>
          <div className="flex flex-wrap gap-2">
            {result.marEvents.map((e, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">
                {new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {e.medicationLabel} {e.action}
                {e.amount ? ` ${e.amount} ${e.unit ?? ''}` : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
