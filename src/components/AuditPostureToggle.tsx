import type { AuditPosture } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AuditPostureToggleProps {
  posture: AuditPosture;
  onChange: (posture: AuditPosture) => void;
}

export function AuditPostureToggle({ posture, onChange }: AuditPostureToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-secondary/50 p-0.5">
      <button
        onClick={() => onChange('payment-integrity')}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          posture === 'payment-integrity'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Payment Integrity
      </button>
      <button
        onClick={() => onChange('compliance-coaching')}
        className={cn(
          'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          posture === 'compliance-coaching'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Compliance Coaching
      </button>
    </div>
  );
}
