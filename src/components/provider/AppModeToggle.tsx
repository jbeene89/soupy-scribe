import type { AppMode } from '@/lib/providerTypes';
import { cn } from '@/lib/utils';
import { Shield, Stethoscope, HeartPulse } from 'lucide-react';

interface AppModeToggleProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function AppModeToggle({ mode, onChange }: AppModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-secondary/50 p-0.5">
      <button
        onClick={() => onChange('payer')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          mode === 'payer'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Shield className="h-3 w-3" />
        Payer / Internal
      </button>
      <button
        onClick={() => onChange('provider')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          mode === 'provider'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Stethoscope className="h-3 w-3" />
        Provider Readiness
      </button>
      <button
        onClick={() => onChange('psych')}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
          mode === 'psych'
            ? 'bg-card shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <HeartPulse className="h-3 w-3" />
        Behavioral Health
      </button>
    </div>
  );
}
