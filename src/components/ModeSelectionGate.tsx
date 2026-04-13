import { useState } from 'react';
import { Shield, Stethoscope, ArrowRight, Brain, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppMode } from '@/lib/providerTypes';

interface Props {
  onSelect: (mode: AppMode) => void;
}

const MODES = [
  {
    id: 'payer' as AppMode,
    title: 'Payer',
    subtitle: 'Payment Integrity',
    description: 'Detect anomalies, quantify risk, and build defensible audit positions with multi-AI consensus scoring.',
    icon: Shield,
    highlights: [
      'Multi-perspective claim analysis',
      'Denial prediction & appeal defense',
      'OR readiness cost tracking',
      'Pattern-based risk surfacing',
    ],
    gradient: 'from-[hsl(220,50%,18%)] to-[hsl(220,45%,28%)]',
    accentBorder: 'border-[hsl(220,45%,50%)]',
    accentText: 'text-[hsl(220,45%,55%)]',
    accentBg: 'bg-[hsl(220,45%,50%)]',
    hoverRing: 'hover:ring-[hsl(220,45%,50%)]',
  },
  {
    id: 'provider' as AppMode,
    title: 'Provider',
    subtitle: 'Claim Accuracy Program',
    description: 'Improve documentation quality, reduce denials, and surface education opportunities before claims are filed.',
    icon: Stethoscope,
    highlights: [
      'Pre-submission documentation review',
      'Provider education & coaching',
      'Triage accuracy & booking insights',
      'Post-op flow optimization',
    ],
    gradient: 'from-[hsl(190,45%,22%)] to-[hsl(190,40%,32%)]',
    accentBorder: 'border-[hsl(190,40%,45%)]',
    accentText: 'text-[hsl(190,40%,50%)]',
    accentBg: 'bg-[hsl(190,40%,45%)]',
    hoverRing: 'hover:ring-[hsl(190,40%,45%)]',
  },
] as const;

export function ModeSelectionGate({ onSelect }: Props) {
  const [hoveredMode, setHoveredMode] = useState<AppMode | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12 max-w-xl animate-fade-in">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SOUPY Audit</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          AI-powered multi-perspective audit engine. Select your workflow to get started.
        </p>
      </div>

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full animate-fade-in" style={{ animationDelay: '150ms' }}>
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isHovered = hoveredMode === mode.id;

          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              onMouseEnter={() => setHoveredMode(mode.id)}
              onMouseLeave={() => setHoveredMode(null)}
              className={cn(
                'group relative flex flex-col text-left rounded-xl border-2 transition-all duration-300 overflow-hidden',
                'ring-0 ring-transparent hover:ring-2',
                mode.accentBorder,
                mode.hoverRing,
                'bg-card shadow-md hover:shadow-xl',
              )}
            >
              {/* Top gradient banner */}
              <div className={cn('h-28 bg-gradient-to-br flex items-center justify-center relative', mode.gradient)}>
                <Icon className="h-12 w-12 text-white/90 transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-bold text-foreground">{mode.title}</h2>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary', mode.accentText)}>
                    {mode.subtitle}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{mode.description}</p>

                <ul className="space-y-1.5 mb-5 flex-1">
                  {mode.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className={cn('mt-1 h-1.5 w-1.5 rounded-full shrink-0', mode.accentBg)} />
                      {h}
                    </li>
                  ))}
                </ul>

                <div className={cn(
                  'flex items-center gap-1.5 text-xs font-semibold transition-all',
                  isHovered ? mode.accentText : 'text-muted-foreground'
                )}>
                  Enter {mode.title} Mode
                  <ArrowRight className={cn('h-3.5 w-3.5 transition-transform', isHovered && 'translate-x-1')} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <p className="mt-10 text-[10px] text-muted-foreground/60 animate-fade-in" style={{ animationDelay: '300ms' }}>
        You can switch modes at any time from within the application.
      </p>
    </div>
  );
}
