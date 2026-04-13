import { Check, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIERS = [
  {
    name: 'Shadow Audit',
    phase: 'Phase 0',
    price: 'Free',
    priceSub: 'No commitment',
    description: 'Prove value on your historical data before any integration.',
    features: [
      'Upload up to 100 cases',
      'Full multi-perspective analysis',
      'Consensus scoring & risk flags',
      'Evidence gap identification',
      'PDF export of findings',
    ],
    cta: 'Start Shadow Audit',
    highlighted: false,
    borderColor: 'border-border/50',
  },
  {
    name: 'Parallel Run',
    phase: 'Phase 1',
    price: '$3K',
    priceSub: '/ month flat',
    description: 'Run alongside your current workflow. Compare outputs side by side.',
    features: [
      'Everything in Shadow Audit',
      'Unlimited case volume',
      'Parallel processing pipeline',
      'Weekly calibration reports',
      'Agreement rate tracking',
      'Dedicated onboarding call',
    ],
    cta: 'Request Pilot',
    highlighted: true,
    borderColor: 'border-primary/40',
  },
  {
    name: 'Production',
    phase: 'Phase 2+',
    price: '$5–12',
    priceSub: '/ case processed',
    description: 'Full workflow integration with human-in-the-loop governance.',
    features: [
      'Everything in Parallel Run',
      'API integration support',
      'Configurable routing rules',
      'Defense packet generation',
      'Operational modules (OR, Triage, Post-Op)',
      'Org-scoped dashboards',
      'Ghost case calibration',
    ],
    cta: 'Contact Us',
    highlighted: false,
    borderColor: 'border-border/50',
  },
];

export function PricingSection() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-8 px-2">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-foreground mb-1">Pricing</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Start free. Pay only when value is proven. No multi-year lock-ins.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              'relative border rounded-lg p-4 bg-card/50 flex flex-col',
              tier.borderColor,
              tier.highlighted && 'ring-1 ring-primary/20 bg-primary/[0.02]',
            )}
          >
            {tier.highlighted && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Zap className="h-2.5 w-2.5" /> Recommended
                </span>
              </div>
            )}

            <div className="mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tier.phase}
              </span>
              <h3 className="text-sm font-bold text-foreground">{tier.name}</h3>
            </div>

            <div className="flex items-baseline gap-1 mb-2">
              <span className={cn('text-xl font-bold', tier.highlighted ? 'text-primary' : 'text-foreground')}>
                {tier.price}
              </span>
              <span className="text-[10px] text-muted-foreground">{tier.priceSub}</span>
            </div>

            <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">{tier.description}</p>

            <ul className="space-y-1.5 mb-4 flex-1">
              {tier.features.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                  <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <button
              className={cn(
                'w-full flex items-center justify-center gap-1.5 rounded-md py-2 text-[11px] font-semibold transition-colors',
                tier.highlighted
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-secondary text-foreground hover:bg-accent',
              )}
            >
              {tier.cta}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center">
        <p className="text-[10px] text-muted-foreground/50">
          Enterprise volume pricing available. All plans include the neutrality guarantee — same engine, same evidence standards, regardless of mode.
        </p>
      </div>
    </div>
  );
}
