import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';
import { useSystemImpact } from '@/hooks/useSystemImpact';
import { formatUSD, type ImpactEntry } from '@/lib/systemImpactService';
import { cn } from '@/lib/utils';

interface Props {
  patientId?: string;
  physicianName?: string;
  onClear?: () => void;
}

const SEVERITY_BADGE: Record<ImpactEntry['severity'], string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info-blue/15 text-info-blue',
  high: 'bg-disagreement/15 text-disagreement',
  critical: 'bg-destructive/15 text-destructive',
};

export function UnifiedTimeline({ patientId, physicianName, onClear }: Props) {
  const navigate = useNavigate();
  const { timelineFor } = useSystemImpact();
  const items = timelineFor({ patient_id: patientId, physician_name: physicianName });
  const total = items.reduce((s, e) => s + e.estimated_loss, 0);

  if (!patientId && !physicianName) return null;

  const subjectLabel = patientId
    ? `Patient ${patientId}`
    : `Physician ${physicianName}`;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Unified timeline
          </div>
          <h3 className="text-base font-semibold mt-0.5">{subjectLabel}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} event{items.length === 1 ? '' : 's'} across modules ·{' '}
            <span className="font-medium text-foreground">{formatUSD(total)} estimated loss</span>
          </p>
        </div>
        {onClear && (
          <Button size="sm" variant="ghost" onClick={onClear}>
            <X className="h-3.5 w-3.5 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground py-6 text-center border rounded-md bg-muted/20">
          No cross-module activity recorded for this {patientId ? 'patient' : 'physician'} yet.
        </div>
      ) : (
        <ol className="relative border-l-2 border-border ml-2 space-y-3">
          {items.map((e) => (
            <li key={e.id} className="ml-4 relative">
              <span className="absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              <div className="rounded-md border p-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {e.category_label}
                      </Badge>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          SEVERITY_BADGE[e.severity]
                        )}
                      >
                        {e.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(e.occurred_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm mt-1 line-clamp-2">{e.description}</div>
                    {(e.physician_name || e.service_line) && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[e.physician_name, e.service_line].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold">{formatUSD(e.estimated_loss)}</div>
                    <button
                      onClick={() => navigate(e.module_path)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 mt-1"
                    >
                      Open module <ArrowRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}