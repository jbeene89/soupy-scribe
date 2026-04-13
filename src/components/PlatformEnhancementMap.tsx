import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Shield,
  Search,
  BarChart3,
  Database,
  Brain,
  FileText,
  Stethoscope,
  Eye,
  CheckCircle,
  Plus,
  ArrowRight,
  Layers,
  Zap,
  TrendingUp,
  Lock,
} from 'lucide-react';

interface ProductData {
  id: string;
  name: string;
  icon: typeof Shield;
  tagline: string;
  whatItDoes: string[];
  whatItDoesnt: string[];
  soupyAdds: string[];
  animMetric: { before: string; after: string; label: string };
  color: string;
  bgColor: string;
}

const products: ProductData[] = [
  {
    id: 'rule-engine',
    name: 'Rule-Based Editing',
    icon: Shield,
    tagline: 'Deterministic payment editing engine',
    whatItDoes: [
      'Deterministic rule-based claim edits',
      'Pre-pay & post-pay editing',
      'High-volume automated processing',
      'Standardized flag generation',
    ],
    whatItDoesnt: [
      'Explain WHY a flag matters beyond the rule',
      'Adversarial challenge layer on each edit',
      'Pre-built appeal defense at point of determination',
      'Divergence mapping across multiple perspectives',
    ],
    soupyAdds: [
      'Multi-model reasoning validates each edit',
      'Surfaces which flags survive appeal scrutiny',
      'Auto-generates defense documentation',
      'Transparent reasoning trail for compliance',
    ],
    animMetric: { before: '1 perspective', after: '4 perspectives', label: 'per determination' },
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    id: 'audit-review',
    name: 'Internal Audit Review',
    icon: Search,
    tagline: 'AI-powered internal audit solution',
    whatItDoes: [
      'Scales audit teams with AI',
      'Identifies overpayments post-adjudication',
      'Reduces vendor dependency',
      'Boosts recovery savings',
    ],
    whatItDoesnt: [
      'Multi-model analysis per audit finding',
      'Adversarial stress-testing of each conclusion',
      'Prediction of which findings get overturned',
      'Pre-built appeal responses at determination',
    ],
    soupyAdds: [
      'Builder + Red Team + Analyst + Breaker debate each finding',
      'Consensus divergence shows appeal vulnerability',
      'Pre-argues both sides before provider responds',
      'Confidence scores backed by multi-model agreement',
    ],
    animMetric: { before: '1 model per audit', after: '4 models per audit', label: 'depth increase' },
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
  {
    id: 'analytics',
    name: 'Analytics Dashboard',
    icon: BarChart3,
    tagline: 'Payment integrity command center',
    whatItDoes: [
      'Unified PI operations dashboard',
      'Automated workflow orchestration',
      'Scalable platform management',
      'Performance analytics',
    ],
    whatItDoesnt: [
      'Appeal-resilience metrics per determination',
      'AI disagreement rate tracking',
      'Provider-side intelligence feeds',
      'Determination durability measurement',
    ],
    soupyAdds: [
      'Appeal vulnerability scores per determination',
      'AI consensus divergence analytics',
      'Provider compliance engagement metrics',
      'Determination durability tracking over time',
    ],
    animMetric: { before: 'Operational metrics', after: '+ Appeal resilience', label: 'dashboard depth' },
    color: 'text-consensus',
    bgColor: 'bg-consensus/10',
  },
  {
    id: 'transparency',
    name: 'Data Transparency',
    icon: Database,
    tagline: 'Transparency & integration platform',
    whatItDoes: [
      'Payment integrity transparency',
      'Integration hub for PI solutions',
      'Data precision for health plans',
      'Cross-system data normalization',
    ],
    whatItDoesnt: [
      'Reasoning transparency (WHY, not just WHAT)',
      'Provider-facing logic behind each flag',
      'Dual-sided communication channel',
      'AI reasoning audit trail',
    ],
    soupyAdds: [
      'Full reasoning chain visible to auditors',
      'Provider-facing explanation of every determination',
      'Dual-voice analysis (payer perspective + provider perspective)',
      'Exportable reasoning trail for legal defensibility',
    ],
    animMetric: { before: 'Data transparency', after: '+ Reasoning transparency', label: 'trust depth' },
    color: 'text-disagreement',
    bgColor: 'bg-disagreement/10',
  },
];

function EnhancementAnimation({ product, isActive }: { product: ProductData; isActive: boolean }) {
  const Icon = product.icon;

  return (
    <div className="relative h-32 rounded-lg border bg-muted/20 overflow-hidden">
      <div className={cn(
        'absolute inset-0 flex items-center justify-center transition-all duration-700',
        isActive ? 'translate-y-[-20%] scale-90 opacity-60' : 'translate-y-0 scale-100 opacity-100'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-lg', product.bgColor)}>
            <Icon className={cn('h-6 w-6', product.color)} />
          </div>
          <div>
            <p className="text-sm font-semibold">{product.name}</p>
            <p className="text-[10px] text-muted-foreground">{product.animMetric.before}</p>
          </div>
        </div>
      </div>

      <div className={cn(
        'absolute inset-0 flex flex-col items-center justify-center transition-all duration-700',
        isActive ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      )}>
        <div className="flex items-center gap-2 mb-2">
          <div className={cn('p-1.5 rounded-md', product.bgColor)}>
            <Icon className={cn('h-4 w-4', product.color)} />
          </div>
          <Plus className="h-3 w-3 text-muted-foreground" />
          <div className="p-1.5 rounded-md bg-accent/10">
            <Brain className="h-4 w-4 text-accent" />
          </div>
        </div>
        <p className="text-xs font-semibold text-accent">{product.animMetric.after}</p>
        <p className="text-[10px] text-muted-foreground">{product.animMetric.label}</p>

        <div className={cn(
          'absolute inset-0 rounded-lg border-2 transition-all duration-700',
          isActive ? 'border-accent/40 shadow-[inset_0_0_20px_rgba(var(--accent)/0.08)]' : 'border-transparent'
        )} />
      </div>
    </div>
  );
}

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  return isTouch;
}

function ProductRow({ product, index }: { product: ProductData; index: number }) {
  const [isActive, setIsActive] = useState(false);
  const isTouch = useIsTouchDevice();
  const Icon = product.icon;

  const handleTap = useCallback(() => {
    if (isTouch) setIsActive(prev => !prev);
  }, [isTouch]);

  return (
    <div
      className="opacity-0 animate-slide-up"
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
    >
      <Card
        className={cn(
          'transition-all duration-300 overflow-hidden cursor-pointer',
          isActive ? 'border-accent/40 shadow-md' : ''
        )}
        onMouseEnter={() => !isTouch && setIsActive(true)}
        onMouseLeave={() => !isTouch && setIsActive(false)}
        onClick={handleTap}
      >
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', product.bgColor)}>
                <Icon className={cn('h-5 w-5', product.color)} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{product.name}</h3>
                  <Badge variant="outline" className="text-[9px]">Existing Capability</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{product.tagline}</p>
              </div>
              <div className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-300',
                isActive ? 'bg-accent/10' : 'bg-transparent'
              )}>
                <Brain className={cn('h-3.5 w-3.5 transition-colors', isActive ? 'text-accent' : 'text-muted-foreground')} />
                <span className={cn('text-[10px] font-medium transition-colors', isActive ? 'text-accent' : 'text-muted-foreground')}>
                  + SOUPY
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-0">
            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Current Capability
              </p>
              <ul className="space-y-1.5">
                {product.whatItDoes.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px]">
                    <CheckCircle className={cn('h-3 w-3 mt-0.5 shrink-0', product.color)} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden lg:flex items-stretch">
              <div className="w-px bg-border" />
            </div>
            <div className="lg:hidden h-px bg-border mx-4" />

            <div className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-2">
                Opportunity
              </p>
              <ul className="space-y-1.5">
                {product.whatItDoesnt.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 text-primary/50" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden lg:flex items-stretch">
              <div className="w-px bg-border" />
            </div>
            <div className="lg:hidden h-px bg-border mx-4" />

            <div className={cn(
              'p-4 transition-colors duration-300',
              isActive ? 'bg-accent/5' : ''
            )}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-2">
                SOUPY Adds
              </p>
              <ul className="space-y-1.5">
                {product.soupyAdds.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11px]">
                    <Zap className="h-3 w-3 mt-0.5 shrink-0 text-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="px-4 pb-4">
            <EnhancementAnimation product={product} isActive={isActive} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function PlatformEnhancementMap() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-accent/10 shrink-0">
          <Layers className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold tracking-tight">Platform Enhancement Map</h2>
          <p className="text-xs text-muted-foreground">
            SOUPY enhances every layer of your payment integrity stack — hover each row to see the value it adds
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">Additive Only</Badge>
      </div>

      <div className="space-y-4">
        {products.map((product, i) => (
          <ProductRow key={product.id} product={product} index={i} />
        ))}
      </div>

      <Card
        className="border-2 border-accent/30 bg-accent/5 opacity-0 animate-slide-up"
        style={{ animationDelay: `${products.length * 150 + 200}ms`, animationFillMode: 'forwards' }}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Brain className="h-5 w-5 text-accent" />
            <p className="text-sm font-semibold">
              Net result: Every existing capability gets stronger. Nothing gets replaced.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Eye, label: 'Reasoning Transparency', desc: 'WHY, not just WHAT', color: 'text-primary' },
              { icon: Shield, label: 'Appeal Resilience', desc: 'Pre-tested determinations', color: 'text-consensus' },
              { icon: Stethoscope, label: 'Provider Revenue', desc: 'New market from same engine', color: 'text-accent' },
              { icon: Lock, label: 'Competitive Moat', desc: 'No comparable solution exists', color: 'text-disagreement' },
            ].map((item, i) => (
              <div key={i} className="rounded-md border bg-card p-3 text-center space-y-1">
                <item.icon className={cn('h-4 w-4 mx-auto', item.color)} />
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
