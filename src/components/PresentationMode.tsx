import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConsensusMeter } from './ConsensusMeter';
import { RiskIndicator } from './RiskIndicator';
import { CPTCodeBadge } from './CPTCodeBadge';
import { PlatformValueCard } from './PlatformValueCard';
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
  {
    id: 'problem',
    label: 'The Problem',
  },
  {
    id: 'live-case',
    label: 'Live Case',
  },
  {
    id: 'single-vs-soupy',
    label: 'Single AI vs SOUPY',
  },
  {
    id: 'dual-market',
    label: 'Two Markets',
  },
  {
    id: 'flywheel',
    label: 'The Flywheel',
  },
  {
    id: 'numbers',
    label: 'The Numbers',
  },
];

export function PresentationMode({ onExit }: PresentationModeProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const next = () => setCurrentSlide(s => Math.min(s + 1, SLIDES.length - 1));
  const prev = () => setCurrentSlide(s => Math.max(s - 1, 0));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExit]);

  // Swipe support for phone
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
          {/* Progress dots */}
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
        {/* SLIDE 1: The Problem */}
        {currentSlide === 0 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-xs">The Problem</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                  Payment integrity runs on
                  <span className="text-destructive"> single-perspective AI</span>
                  <span className="text-muted-foreground">.</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                  One model. One viewpoint. One chance to get it right.
                  When that model has blind spots, you don't find out until the appeal lands on your desk.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { stat: '$4.7B', label: 'Annual appeal costs industry-wide', icon: DollarSign },
                  { stat: '38%', label: 'Of denials overturned on appeal', icon: TrendingDown },
                  { stat: '4.2 hrs', label: 'Average auditor time per contested case', icon: AlertTriangle },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-5 text-center space-y-2">
                      <item.icon className="h-6 w-6 mx-auto text-muted-foreground" />
                      <p className="text-2xl font-bold font-mono text-destructive">{item.stat}</p>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                  Real audit case. Real complexity.
                </h2>
                <p className="text-sm text-muted-foreground">
                  High-value ED + Critical Care combination — one of the most contested billing patterns in medicine.
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
                        4 AI models analyzed this case independently and reached {demoCase.consensusScore}% consensus.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Slide>
        )}

        {/* SLIDE 3: Single vs SOUPY */}
        {currentSlide === 2 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">The Difference</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Same case. <span className="text-accent">Dramatically different depth.</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Single model */}
                <Card className="border-muted-foreground/20">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">Standard AI</span>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold font-mono">{singleViolations.length}</p>
                      <p className="text-sm text-muted-foreground">violations found</p>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-3xl font-bold font-mono">{demoCase.analyses[0]?.confidence}%</p>
                      <p className="text-sm text-muted-foreground">confidence (single perspective)</p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      {['No adversarial challenge', 'No regulatory cross-check', 'No consensus measurement', 'Single point of failure'].map((item, i) => (
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
                      <span className="font-semibold text-sm text-accent">SOUPY ThinkTank</span>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold font-mono text-accent">{allViolations.length}</p>
                      <p className="text-sm text-muted-foreground">violations found</p>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-3xl font-bold font-mono text-accent">{demoCase.analyses.length}</p>
                      <p className="text-sm text-muted-foreground">independent perspectives</p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      {['Builder + Red Team + Analyst + Breaker', 'Regulatory framework validation', 'Consensus divergence mapped', 'Pre-built appeal defense'].map((item, i) => (
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
                  SOUPY found <span className="font-semibold text-accent">{allViolations.length - singleViolations.length} additional violations</span> that standard AI missed entirely.
                  Each one is a potential overturned appeal — or a missed recovery.
                </p>
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 4: Two Markets */}
        {currentSlide === 3 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">Market Architecture</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  One engine. <span className="text-primary">Two revenue surfaces.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  The same intelligence that strengthens payer determinations also eliminates provider friction — 
                  and providers will pay for that.
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
                        <p className="font-semibold">Payer Module</p>
                        <p className="text-xs text-muted-foreground">Sell to payment integrity teams</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {[
                        'Adversarial AI audit intelligence',
                        '3.2x faster determinations',
                        '72% fewer overturned appeals',
                        'Payer-specific export packages',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="border-accent/30">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Stethoscope className="h-6 w-6 text-accent" />
                      </div>
                      <div>
                        <p className="font-semibold">Provider Module</p>
                        <p className="text-xs text-muted-foreground">Payer sells to their provider network</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {[
                        'Pre-submission documentation validation',
                        '91% clean claim rate',
                        'Same AI — educational posture',
                        '$1.2M annual admin savings per facility',
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
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border bg-accent/5">
                  <Zap className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent">Zero incremental engineering between modules</span>
                </div>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 5: Flywheel */}
        {currentSlide === 4 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">The Flywheel</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Each payer deployment <span className="text-accent">creates provider demand.</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    step: '01',
                    icon: Building2,
                    title: 'Payer Adopts',
                    body: 'AI audit intelligence replaces rules-only approach. Fewer false flags, faster decisions.',
                    color: 'text-primary',
                  },
                  {
                    step: '02',
                    icon: Stethoscope,
                    title: 'Providers Want In',
                    body: 'Same engine offered as compliance tool. Natural channel partner upsell from every payer relationship.',
                    color: 'text-accent',
                  },
                  {
                    step: '03',
                    icon: TrendingDown,
                    title: 'Claims Improve',
                    body: 'Upstream documentation accuracy reduces payer audit volume by 40-60%. Less work for everyone.',
                    color: 'text-consensus',
                  },
                  {
                    step: '04',
                    icon: DollarSign,
                    title: 'Value Compounds',
                    body: 'Lower audit costs + provider retention + new revenue stream. Per payer. Recurring.',
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

              {/* Loop arrow */}
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

        {/* SLIDE 6: The Numbers */}
        {currentSlide === 5 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-2 text-center">
                <Badge variant="outline" className="text-xs">Bottom Line</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Ready to deploy. Ready to sell.
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { value: '2x', label: 'Revenue per deal', sub: 'Payer + Provider', color: 'text-primary' },
                  { value: '$0', label: 'Added eng. cost', sub: 'Same engine', color: 'text-consensus' },
                  { value: '4', label: 'AI perspectives', sub: 'Per case', color: 'text-accent' },
                  { value: '72%', label: 'Fewer overturns', sub: 'Defensible by design', color: 'text-consensus' },
                ].map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="p-5 text-center space-y-1">
                      <p className={cn('text-3xl sm:text-4xl font-bold font-mono', stat.color)}>{stat.value}</p>
                      <p className="text-sm font-semibold">{stat.label}</p>
                      <p className="text-xs text-muted-foreground">{stat.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-2 border-accent bg-accent/5">
                <CardContent className="p-6 text-center space-y-3">
                  <Brain className="h-8 w-8 text-accent mx-auto" />
                  <p className="text-lg font-semibold">
                    An intelligence layer that makes Lyric's audit determinations stronger
                    <span className="text-muted-foreground font-normal"> — while simultaneously making provider claims cleaner.</span>
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    Every case processed improves the system. Every payer deployed creates a new provider market. 
                    The platform pays for itself before the first appeal is filed.
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
