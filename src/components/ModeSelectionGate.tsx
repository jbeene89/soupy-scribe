import { useState } from 'react';
import { Shield, Stethoscope, ArrowRight, Brain, Scale, HeartPulse, Zap, CheckCircle2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  {
    id: 'psych' as AppMode,
    title: 'Behavioral Health',
    subtitle: 'Private Practice',
    description: 'Pre-submission audit checks and denial defense built for therapy, testing, and medication management claims.',
    icon: HeartPulse,
    highlights: [
      'Session documentation checklist',
      'CPT / time-match validation',
      'Authorization & credential tracking',
      'Denial risk scoring before filing',
    ],
    gradient: 'from-[hsl(270,40%,22%)] to-[hsl(270,35%,32%)]',
    accentBorder: 'border-[hsl(270,40%,50%)]',
    accentText: 'text-[hsl(270,40%,55%)]',
    accentBg: 'bg-[hsl(270,40%,50%)]',
    hoverRing: 'hover:ring-[hsl(270,40%,50%)]',
  },
] as const;

export function ModeSelectionGate({ onSelect }: Props) {
  const [hoveredMode, setHoveredMode] = useState<AppMode | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 overflow-y-auto">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
      {/* Header */}
      <div className="text-center mb-10 max-w-2xl animate-fade-in">
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <Brain className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SOUPY Audit</h1>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed mb-5">
          AI-powered multi-perspective audit engine. Select your workflow to get started.
        </p>

        {/* Neutrality statement */}
        <div className="inline-flex items-start gap-2.5 bg-secondary/60 border border-border/50 rounded-lg px-4 py-3 text-left max-w-lg">
          <Scale className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground/80">Neutral by design.</span>{' '}
            This engine evaluates clinical documentation, coding accuracy, and evidentiary completeness against published standards. It does not advocate for payer denial or provider reimbursement — it surfaces what the facts support.
          </p>
        </div>
      </div>

      {/* Mode Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full animate-fade-in" style={{ animationDelay: '150ms' }}>
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

      {/* Hero CTA — Standalone Pre-Submission Check */}
      <div className="mt-12 w-full max-w-3xl animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="relative rounded-2xl border-2 border-[hsl(270,40%,40%)] bg-gradient-to-br from-[hsl(270,30%,14%)] to-[hsl(260,25%,20%)] p-6 md:p-8 overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[hsl(270,50%,40%)]/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-6">
            {/* Left — copy */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[hsl(270,60%,70%)]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[hsl(270,50%,65%)]">
                  No integration required
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                Pre-Submission Claim Check
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                Upload a claim or session note, get a scored readiness report with denial risk, missed revenue opportunities, and the smallest fix before you file — in under 60 seconds.
              </p>

              <ul className="space-y-1.5 pt-1">
                {[
                  'Denial risk score + curable vs non-curable flags',
                  'MDM level review & undercoding detection',
                  'Payer-aware warnings before you submit',
                  'Downloadable anonymized readiness packet',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(270,50%,60%)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — pricing + CTA */}
            <div className="flex flex-col items-center gap-3 md:min-w-[180px]">
              <div className="text-center">
                <span className="text-2xl font-extrabold text-foreground">Free</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">No account required. Try it right now.</p>
              </div>

              <Button
                size="lg"
                onClick={() => onSelect('psych')}
                className="w-full bg-[hsl(270,45%,50%)] hover:bg-[hsl(270,45%,55%)] text-white font-semibold shadow-lg shadow-[hsl(270,50%,30%)]/30"
              >
                Try It Free
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>

              <p className="text-[10px] text-muted-foreground/70 text-center">
                Works for therapy, psych testing, med management & E/M visits
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-[10px] text-muted-foreground/60 animate-fade-in" style={{ animationDelay: '450ms' }}>
        You can switch modes at any time from within the application.
      </p>
      </div>


    </div>
  );
}
