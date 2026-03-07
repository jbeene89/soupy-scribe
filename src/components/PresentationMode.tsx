import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConsensusMeter } from './ConsensusMeter';
import { RiskIndicator } from './RiskIndicator';
import { CPTCodeBadge } from './CPTCodeBadge';
import { mockCases, mockCodeCombinations } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Scale,
  Brain,
  Shield,
  Building2,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  ArrowRight,
  TrendingDown,
  DollarSign,
  Eye,
  Layers,
  Monitor,
  Sparkles,
  Lock,
  Users,
  GitCompare,
} from 'lucide-react';

const demoCase = mockCases.find(c => c.analyses.length > 0)!;

interface PresentationModeProps {
  onExit: () => void;
}

interface SlideProps {
  children: React.ReactNode;
  className?: string;
}

function Slide({ children, className }: SlideProps) {
  return (
    <div className={cn('animate-fade-in min-h-[60vh] flex flex-col', className)}>
      {children}
    </div>
  );
}

const SLIDES = [
  { id: 'gap', label: 'The Gap' },
  { id: 'live-case', label: 'Live Case' },
  { id: 'single-vs-soupy', label: 'The Blindspot' },
  { id: 'appeal-defense', label: 'Appeal Defense' },
  { id: 'provider-revenue', label: 'New Revenue' },
  { id: 'flywheel', label: 'The Flywheel' },
  { id: 'exclusivity', label: 'The Offer' },
];

export function PresentationMode({ onExit }: PresentationModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const next = () => setCurrentSlide(s => Math.min(s + 1, SLIDES.length - 1));
  const prev = () => setCurrentSlide(s => Math.max(s - 1, 0));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExit]);

  useEffect(() => {
    let startX = 0;
    const touchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const touchEnd = (e: TouchEvent) => {
      const diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) next();
        else prev();
      }
    };
    window.addEventListener('touchstart', touchStart);
    window.addEventListener('touchend', touchEnd);
    return () => {
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchend', touchEnd);
    };
  }, []);

  const allViolations = demoCase.analyses.flatMap(a => a.violations);
  const singleViolations = demoCase.analyses[0]?.violations || [];

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-card/90 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary">
            <Scale className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Lyric AI</span>
          <Badge variant="outline" className="text-[10px] ml-2">Executive Preview</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 mr-3">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setCurrentSlide(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === currentSlide ? 'w-6 bg-accent' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-mono mr-2">
            {currentSlide + 1}/{SLIDES.length}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExit}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Slide content */}
      <div className="container mx-auto px-6 sm:px-10 py-8 max-w-5xl">

        {/* SLIDE 1: The Gap — what Lyric doesn't have */}
        {currentSlide === 0 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-xs">The Capability Gap</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                  ClaimsXten finds violations.
                  <br />
                  <span className="text-muted-foreground">It can't </span>
                  <span className="text-destructive">defend them.</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                  Replay audits. Virtuoso orchestrates. ClaimsXten edits.
                  But when a provider appeals, the determination stands on a single AI perspective
                  with no adversarial stress-testing and no pre-built defense.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    stat: '40%+',
                    label: 'Of denials overturned on appeal',
                    sub: 'KFF / CMS Marketplace data, 2023',
                    icon: TrendingDown,
                    color: 'text-destructive',
                    source: 'kff.org',
                  },
                  {
                    stat: '1',
                    label: 'AI perspective per determination',
                    sub: 'Single model = single point of failure',
                    icon: Monitor,
                    color: 'text-muted-foreground',
                  },
                  {
                    stat: '$0',
                    label: 'Revenue from provider side',
                    sub: 'Providers are audited — not served',
                    icon: Stethoscope,
                    color: 'text-accent',
                  },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-5 text-center space-y-2">
                      <item.icon className="h-6 w-6 mx-auto text-muted-foreground" />
                      <p className={cn('text-2xl font-bold font-mono', item.color)}>{item.stat}</p>
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                      {'source' in item && item.source && (
                        <p className="text-[9px] text-muted-foreground/60 italic">Source: {item.source}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <p className="text-sm text-muted-foreground italic max-w-2xl">
                This isn't about replacing what works. It's about adding the layer that's missing —
                the adversarial intelligence that makes every determination appeal-proof and opens
                an entirely new revenue channel.
              </p>
            </div>
          </Slide>
        )}

        {/* SLIDE 2: Live Case */}
        {currentSlide === 1 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">Live Case</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  What ClaimsXten flags. What SOUPY <span className="text-accent">reveals.</span>
                </h2>
                <p className="text-sm text-muted-foreground">
                  High-value ED + Critical Care combination — ClaimsXten catches the edit.
                  SOUPY stress-tests whether it holds up under appeal.
                </p>
              </div>

              <Card className="border-2">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-semibold text-lg font-mono">{demoCase.caseNumber}</p>
                      <p className="text-sm text-muted-foreground">{demoCase.physicianName} • {demoCase.dateOfService}</p>
                    </div>
                    <p className="text-2xl font-bold font-mono">${demoCase.claimAmount.toLocaleString()}</p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {demoCase.cptCodes.map(c => <CPTCodeBadge key={c} code={c} />)}
                    <Separator orientation="vertical" className="h-5" />
                    {demoCase.icdCodes.map(c => (
                      <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RiskIndicator riskScore={demoCase.riskScore} />
                    <div>
                      <ConsensusMeter score={demoCase.consensusScore} />
                      <p className="text-xs text-muted-foreground mt-2">
                        4 AI models analyzed this case independently and reached {demoCase.consensusScore}% consensus —
                        disagreement zones are where appeals succeed.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Slide>
        )}

        {/* SLIDE 3: The Blindspot — single AI vs adversarial */}
        {currentSlide === 2 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">The Blindspot</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Your AI agrees with itself.
                  <span className="text-accent"> That's the problem.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Current AI gives one answer with high confidence. SOUPY forces 4 independent
                  perspectives to disagree — surfacing the exact weaknesses a provider attorney will exploit.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Current state */}
                <Card className="border-muted-foreground/20">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">Current: Single-Model AI</span>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold font-mono">{singleViolations.length}</p>
                      <p className="text-sm text-muted-foreground">violations found</p>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-3xl font-bold font-mono">{demoCase.analyses[0]?.confidence}%</p>
                      <p className="text-sm text-muted-foreground">confidence (untested)</p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      {[
                        'No adversarial challenge to its own assumptions',
                        'Can\'t predict which findings survive appeal',
                        'No divergence measurement between perspectives',
                        'Provider attorney finds the weakness first',
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* SOUPY */}
                <Card className="border-2 border-accent">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-accent" />
                      <span className="font-semibold text-sm text-accent">+ SOUPY Layer</span>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold font-mono text-accent">{allViolations.length}</p>
                      <p className="text-sm text-muted-foreground">violations stress-tested</p>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-3xl font-bold font-mono text-accent">{demoCase.analyses.length}</p>
                      <p className="text-sm text-muted-foreground">adversarial perspectives</p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      {[
                        'Builder defends, Red Team attacks, Analyst maps regs',
                        'Consensus divergence shows appeal vulnerability',
                        'Every determination pre-tested against challenge',
                        'Appeal defense auto-generated with evidence trail',
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-consensus shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  SOUPY found <span className="font-semibold text-accent">{allViolations.length - singleViolations.length} additional risk vectors</span> and
                  identified exactly which findings would survive appeal — and which wouldn't.
                  <span className="font-medium text-foreground"> That's the layer ClaimsXten doesn't have.</span>
                </p>
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 4: Appeal Defense — nobody does this */}
        {currentSlide === 3 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-xs">New Capability</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                  The first AI that builds
                  <span className="text-accent"> the defense</span> before
                  <span className="text-muted-foreground"> the appeal arrives.</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                  Today, when a provider appeals, your team starts from scratch — pulling documentation,
                  building arguments, researching regulations. SOUPY generates the defense package
                  at the moment of determination.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <span className="font-semibold text-sm">Current Appeal Response</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { step: 'Appeal arrives', time: 'Day 0' },
                        { step: 'Pull original claim + notes', time: '2-4 hrs' },
                        { step: 'Research regulatory basis', time: '1-2 hrs' },
                        { step: 'Draft response', time: '2-3 hrs' },
                        { step: 'Legal review', time: '1-2 days' },
                        { step: 'Send response', time: 'Day 3-5' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5">
                          <span className="text-muted-foreground">{item.step}</span>
                          <span className="font-mono text-xs text-destructive">{item.time}</span>
                        </div>
                      ))}
                      <p className="text-xs font-semibold text-destructive pt-1">Total: 3-5 business days per appeal</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-accent">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-accent" />
                      <span className="font-semibold text-sm text-accent">SOUPY Appeal Defense</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { step: 'Defense generated at determination', time: 'Instant' },
                        { step: 'Both sides pre-argued (payer + provider)', time: 'Included' },
                        { step: 'Regulatory citations auto-attached', time: 'Included' },
                        { step: 'Evidence checklist with gap analysis', time: 'Included' },
                        { step: 'Payer-specific format (UHC, Aetna, etc.)', time: 'Included' },
                        { step: 'Export-ready when appeal arrives', time: 'Day 0' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5">
                          <span>{item.step}</span>
                          <span className="font-mono text-xs text-consensus">{item.time}</span>
                        </div>
                      ))}
                      <p className="text-xs font-semibold text-consensus pt-1">Appeal response ready before the appeal is filed</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <p className="text-sm text-muted-foreground italic text-center">
                No product in your portfolio generates the defense. SOUPY is the only system that argues both sides
                at the point of determination — making every audit decision pre-tested against challenge.
              </p>
            </div>
          </Slide>
        )}

        {/* SLIDE 5: Provider Revenue — entirely new market */}
        {currentSlide === 4 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">New Revenue Stream</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Every provider you audit is a
                  <span className="text-accent"> customer you're not selling to.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Lyric audits providers. But providers would pay to validate their claims
                  against the same AI before submission — eliminating flags at the source.
                  That's a new revenue surface from every existing payer relationship.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-primary/30">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Existing: Payer Module</p>
                        <p className="text-xs text-muted-foreground">What Lyric does today</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {[
                        'SOUPY enhances ClaimsXten determinations',
                        'Adversarial stress-testing on every flag',
                        'Pre-built appeal defense packages',
                        'Transparent reasoning trails for compliance',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-2 border-accent relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-2 py-1 bg-accent text-accent-foreground text-[10px] font-semibold rounded-bl-lg">
                    NEW MARKET
                  </div>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Stethoscope className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold">New: Provider Module</p>
                        <p className="text-xs text-muted-foreground">Same engine — compliance posture</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {[
                        'Pre-submission validation against audit-grade AI',
                        'Documentation guidance that prevents flags at source',
                        '"Audit insurance" — providers pay to avoid surprises',
                        'Sold through existing payer channel relationships',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-center gap-3 py-2">
                <div className="h-px flex-1 bg-border" />
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-dashed border-accent/30 bg-accent/5">
                  <Zap className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent">Zero incremental engineering — same AI, different posture</span>
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: '2x', label: 'Revenue per payer deal', sub: 'Payer + their provider network', color: 'text-primary' },
                  { value: '$0', label: 'Added engineering cost', sub: 'One engine, two products', color: 'text-consensus' },
                  { value: '$1.2M', label: 'Provider savings per facility/yr', sub: 'They\'ll pay for that', color: 'text-accent' },
                ].map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 text-center space-y-1">
                      <p className={cn('text-2xl font-bold font-mono', stat.color)}>{stat.value}</p>
                      <p className="text-xs font-semibold">{stat.label}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 6: Flywheel */}
        {currentSlide === 5 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">The Flywheel</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Each payer deployment <span className="text-accent">creates provider demand.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Providers who get audited by SOUPY-enhanced determinations see the reasoning transparency
                  and want the same AI validating their claims before submission.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    step: '01',
                    icon: Layers,
                    title: 'SOUPY Enhances Stack',
                    body: 'Sits on top of ClaimsXten + Replay + Virtuoso. Adds adversarial depth — no rip and replace.',
                    color: 'text-primary',
                  },
                  {
                    step: '02',
                    icon: Shield,
                    title: 'Appeals Drop',
                    body: 'Determinations are pre-tested against challenge. Providers see transparent reasoning. Fewer fights.',
                    color: 'text-consensus',
                  },
                  {
                    step: '03',
                    icon: Stethoscope,
                    title: 'Providers Want In',
                    body: 'Same engine, compliance mode. Pre-submission validation as "audit insurance." New revenue from existing relationships.',
                    color: 'text-accent',
                  },
                  {
                    step: '04',
                    icon: DollarSign,
                    title: 'Value Compounds',
                    body: 'Cleaner claims → fewer audits → lower cost. Plus provider revenue. Per payer. Recurring.',
                    color: 'text-disagreement',
                  },
                ].map((item, i) => (
                  <Card key={i} className="relative overflow-hidden">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-mono font-bold', item.color)}>{item.step}</span>
                        <item.icon className={cn('h-4 w-4', item.color)} />
                      </div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                      {i < 3 && (
                        <ArrowRight className="absolute top-1/2 -right-3 h-5 w-5 text-muted-foreground/30 hidden lg:block" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-center">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-dashed border-accent/30 bg-accent/5">
                  <ArrowRight className="h-4 w-4 text-accent rotate-[225deg]" />
                  <span className="text-xs font-semibold text-accent">Cycle repeats with each new payer</span>
                  <ArrowRight className="h-4 w-4 text-accent rotate-[-45deg]" />
                </div>
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 7: The Offer — exclusivity */}
        {currentSlide === 6 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-2 text-center">
                <Badge variant="outline" className="text-xs">The Offer</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Three things no one else can offer you.
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    icon: Brain,
                    title: 'Adversarial AI Layer',
                    body: 'Multi-model debate that stress-tests every determination before it ships. Not a replacement — an enhancement to your entire stack.',
                    color: 'text-accent',
                  },
                  {
                    icon: Users,
                    title: 'Provider Revenue Channel',
                    body: 'Turn every provider you audit into a paying customer. Same engine, compliance posture. Zero incremental build.',
                    color: 'text-primary',
                  },
                  {
                    icon: Lock,
                    title: 'Market Exclusivity',
                    body: 'Full non-compete in health insurance payment integrity. No competitor gets this technology. Lyric only.',
                    color: 'text-consensus',
                  },
                ].map((item, i) => (
                  <Card key={i} className="border-2">
                    <CardContent className="p-6 space-y-3 text-center">
                      <item.icon className={cn('h-8 w-8 mx-auto', item.color)} />
                      <p className="font-semibold text-lg">{item.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-2 border-accent bg-accent/5">
                <CardContent className="p-6 text-center space-y-3">
                  <Sparkles className="h-8 w-8 text-accent mx-auto" />
                  <p className="text-lg font-semibold">
                    This isn't a feature request.
                    <span className="text-muted-foreground font-normal"> It's a capability that doesn't exist in your portfolio —</span>
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    adversarial AI reasoning, pre-built appeal defense, and a provider revenue channel.
                    Three things ClaimsXten, Replay, Virtuoso, and ClaimShark weren't designed to do.
                    Built to sit on top of all of them.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Slide>
        )}
      </div>

      {/* Navigation footer */}
      <div className="sticky bottom-0 bg-card/90 backdrop-blur-sm border-t px-4 py-3">
        <div className="container mx-auto max-w-5xl flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={currentSlide === 0}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{currentSlide > 0 ? SLIDES[currentSlide - 1].label : ''}</span>
          </Button>

          <div className="flex items-center gap-1.5 sm:hidden">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === currentSlide ? 'w-4 bg-accent' : 'w-1.5 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          <Button
            variant={currentSlide === SLIDES.length - 1 ? 'ghost' : 'default'}
            size="sm"
            onClick={currentSlide === SLIDES.length - 1 ? onExit : next}
            className="gap-1.5"
          >
            <span className="hidden sm:inline">
              {currentSlide === SLIDES.length - 1 ? 'Exit Presentation' : SLIDES[currentSlide + 1]?.label}
            </span>
            {currentSlide === SLIDES.length - 1 ? (
              <X className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
