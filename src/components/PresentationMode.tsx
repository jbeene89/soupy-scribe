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
  ArrowDown,
  TrendingDown,
  DollarSign,
  Eye,
  Layers,
  Monitor,
  Sparkles,
  Lock,
  Users,
  
  Cpu,
  Server,
  FileText,
  Database,
  BarChart3,
  RefreshCw,
  FileSearch,
  Clock,
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
  { id: 'opportunity', label: 'The Opportunity' },
  { id: 'live-case', label: 'Live Case' },
  { id: 'next-layer', label: 'Next Layer' },
  { id: 'appeal-defense', label: 'Appeal Defense' },
  { id: 'pre-appeal', label: 'Pre-Appeal Resolution' },
  { id: 'provider-revenue', label: 'New Revenue' },
  { id: 'flywheel', label: 'The Flywheel' },
  { id: 'ai-integration', label: 'Integration' },
  { id: 'pilot', label: 'Pilot Program' },
  { id: 'exclusivity', label: 'The Offer' },
  { id: 'sources', label: 'Sources' },
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

  // No swipe handlers — removed per request

  const allViolations = demoCase.analyses.flatMap(a => a.violations);
  const singleViolations = demoCase.analyses[0]?.violations || [];

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 z-50 bg-card/90 backdrop-blur-sm border-b px-4 py-2 flex items-center justify-between">
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

      {/* Main content area with side arrows */}
      <div className="flex-1 relative overflow-hidden">
        {/* Left arrow */}
        <button
          onClick={prev}
          disabled={currentSlide === 0}
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 z-40 rounded-full border bg-card/90 backdrop-blur-sm shadow-lg p-2 sm:p-3 transition-all hover:bg-muted',
            currentSlide === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
        </button>

        {/* Right arrow */}
        <button
          onClick={next}
          disabled={currentSlide === SLIDES.length - 1}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 z-40 rounded-full border bg-card/90 backdrop-blur-sm shadow-lg p-2 sm:p-3 transition-all hover:bg-muted',
            currentSlide === SLIDES.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'
          )}
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-foreground" />
        </button>

        {/* Scrollable slide content */}
        <div className="h-full overflow-y-auto px-12 sm:px-16 py-8">
          <div className="container mx-auto max-w-5xl">

        {/* SLIDE 1: The Opportunity */}
        {currentSlide === 0 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="text-xs">The Opportunity</Badge>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                  Your stack finds the violations.
                  <br />
                  <span className="text-muted-foreground">Now they can </span>
                  <span className="text-accent">defend themselves.</span>
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
                  Replay audits. Virtuoso orchestrates. ClaimsXten edits.
                  You've built the strongest payment integrity platform in the market.
                  SOUPY adds the adversarial layer that makes every determination appeal-ready
                  and opens an entirely new revenue channel.
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
                    sub: 'Industry standard — room to expand',
                    icon: Monitor,
                    color: 'text-muted-foreground',
                  },
                  {
                    stat: '$0',
                    label: 'Provider-side revenue today',
                    sub: 'Untapped provider demand',
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
                This isn't about replacing what you've built. It's about amplifying it —
                adding adversarial intelligence that makes every determination appeal-proof
                and unlocks an entirely new revenue channel from your existing relationships.
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

        {/* SLIDE 3: The Next Layer */}
        {currentSlide === 2 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">The Next Layer</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  What if your AI could
                  <span className="text-accent"> challenge itself?</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Today's AI delivers strong, high-confidence determinations. SOUPY adds a second step:
                  4 independent perspectives that stress-test each finding — surfacing appeal vulnerabilities
                  before a provider attorney does.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-muted-foreground/20">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">Today: Strong Foundation</span>
                    </div>
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold font-mono">{singleViolations.length}</p>
                      <p className="text-sm text-muted-foreground">violations found</p>
                    </div>
                    <div className="text-center py-2">
                      <p className="text-3xl font-bold font-mono">{demoCase.analyses[0]?.confidence}%</p>
                      <p className="text-sm text-muted-foreground">confidence</p>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      {[
                        'Proven, high-accuracy determination engine',
                        'Opportunity to add adversarial validation',
                        'Opportunity to measure cross-perspective divergence',
                        'Opportunity to pre-test against appeal challenge',
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

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
                  SOUPY adds <span className="font-semibold text-accent">{allViolations.length - singleViolations.length} additional risk vectors</span> on top of
                  your existing findings — and identifies exactly which determinations will hold up under appeal and which need reinforcement.
                  <span className="font-medium text-foreground"> That's the amplification layer.</span>
                </p>
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 4: Appeal Defense */}
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
                  Today, appeal responses require manual effort — pulling documentation,
                  building arguments, researching regulations. SOUPY generates the defense package
                  automatically at the moment of determination, so your team is always ready.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">Industry-Standard Appeal Response</span>
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
                          <span className="font-mono text-xs text-muted-foreground">{item.time}</span>
                        </div>
                      ))}
                      <p className="text-xs font-semibold text-muted-foreground pt-1">Industry average: 3-5 business days per appeal</p>
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
                This is a net-new capability that extends your existing stack. SOUPY argues both sides
                at the point of determination — so every audit decision is pre-tested against challenge before it ships.
              </p>
            </div>
          </Slide>
        )}

        {/* SLIDE 5: Pre-Appeal Resolution — NEW */}
        {currentSlide === 4 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">Premium Add-On</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Resolve denials <span className="text-accent">before</span> they become appeals.
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Not every denial needs a full formal appeal. Pre-Appeal Resolution identifies which denials 
                  are curable through targeted documentation or coding clarification — saving both sides time and money.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card className="border-muted-foreground/20">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold text-sm">Today: Every Denial → Full Appeal</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { issue: 'Missing one document', result: 'Full appeal filed' },
                        { issue: 'Modifier coding clarification', result: 'Full appeal filed' },
                        { issue: 'Simple date mismatch', result: 'Full appeal filed' },
                        { issue: 'Administrative correction needed', result: 'Full appeal filed' },
                        { issue: 'Structurally unsupportable claim', result: 'Full appeal filed' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5">
                          <span className="text-muted-foreground">{item.issue}</span>
                          <span className="font-mono text-[10px] text-violation">{item.result}</span>
                        </div>
                      ))}
                      <p className="text-xs font-semibold text-muted-foreground pt-1">Every denial gets the same expensive process</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-accent">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-accent" />
                      <span className="font-semibold text-sm text-accent">Pre-Appeal Resolution</span>
                    </div>
                    <div className="space-y-2">
                      {[
                        { issue: 'Missing one document', result: 'Targeted record request' },
                        { issue: 'Modifier coding clarification', result: 'Correct & resubmit' },
                        { issue: 'Simple date mismatch', result: 'Administrative fix' },
                        { issue: 'Additional records strengthen case', result: 'Gather then resolve' },
                        { issue: 'Structurally unsupportable claim', result: 'Stop — save resources' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5">
                          <span>{item.issue}</span>
                          <span className="font-mono text-[10px] text-consensus">{item.result}</span>
                        </div>
                      ))}
                      <p className="text-xs font-semibold text-consensus pt-1">Right resolution path for each denial type</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Key capabilities */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: FileSearch, title: 'Issue Classification', desc: '9 denial categories auto-classified', color: 'text-accent' },
                  { icon: BarChart3, title: 'Resolution Likelihood', desc: 'AI confidence on curability', color: 'text-consensus' },
                  { icon: FileText, title: 'Submission Builder', desc: 'Guided reconsideration packets', color: 'text-primary' },
                  { icon: Shield, title: 'Payer Review Panel', desc: '7 structured response types', color: 'text-disagreement' },
                ].map((cap, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 text-center space-y-1.5">
                      <cap.icon className={cn('h-5 w-5 mx-auto', cap.color)} />
                      <p className="text-[11px] font-semibold">{cap.title}</p>
                      <p className="text-[9px] text-muted-foreground">{cap.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: '60%+', label: 'Of denials may be resolvable without full appeal', sub: 'Modeled from curable issue categories', color: 'text-accent' },
                  { value: '3-5 days', label: 'Saved per curable denial', sub: 'vs. standard appeal timeline', color: 'text-consensus' },
                  { value: '$0', label: 'Wasted on unsupportable appeals', sub: 'AI identifies dead-end cases before effort', color: 'text-primary' },
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

              <p className="text-sm text-muted-foreground italic text-center max-w-2xl mx-auto">
                Pre-Appeal Resolution preserves all standard appeal rights. It's an optional accelerated path
                that reduces unnecessary labor while ensuring cases that need formal appeal still get it.
              </p>
            </div>
          </Slide>
        )}

        {/* SLIDE 6: Provider Revenue (was 5) */}
        {currentSlide === 5 && (
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
                  { value: '2x', label: 'Revenue opportunity per deal', sub: 'Payer + their provider network (modeled)', color: 'text-primary' },
                  { value: 'Marginal', label: 'Added engineering cost', sub: 'Shared engine — incremental config only', color: 'text-consensus' },
                  { value: '$20B', label: 'Industry denial management cost', sub: 'AHA estimate, 2024 — addressable market', color: 'text-accent', source: 'aha.org' },
                ].map((stat, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 text-center space-y-1">
                      <p className={cn('text-2xl font-bold font-mono', stat.color)}>{stat.value}</p>
                      <p className="text-xs font-semibold">{stat.label}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
                      {'source' in stat && stat.source && (
                        <p className="text-[9px] text-muted-foreground/60 italic">Source: {stat.source}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 7: Flywheel (was 6) */}
        {currentSlide === 6 && (
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

        {/* SLIDE 8: AI Integration Pipeline (was 7) */}
        {currentSlide === 7 && (
          <Slide>
            <div className="space-y-6">
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">Technical Architecture</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  How SOUPY plugs into <span className="text-accent">your existing pipeline.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-2xl">
                  Zero disruption. SOUPY sits as a reasoning layer between Lyric's current rule engines
                  and the final determination — no re-architecture, no migration.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage 1 — Claim Intake</span>
                      <Badge variant="outline" className="ml-auto text-[9px]">No Change</Badge>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2"><Server className="h-3.5 w-3.5 shrink-0" /><span>835/837 Transaction Feed — unchanged</span></div>
                      <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 shrink-0" /><span>EHR / HL7 FHIR ingestion — unchanged</span></div>
                      <div className="flex items-center gap-2"><Database className="h-3.5 w-3.5 shrink-0" /><span>KnowledgePacks & Concepts — unchanged</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-primary/30">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stage 2 — Rule Engine</span>
                      <Badge variant="outline" className="ml-auto text-[9px] border-primary/30 text-primary">Existing</Badge>
                    </div>
                    <div className="space-y-1.5 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 shrink-0 text-primary" /><span>ClaimsXten fires deterministic edit rules</span></div>
                      <div className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 shrink-0 text-primary" /><span>Replay pattern detection on historical data</span></div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic mt-1">Today, this is where the determination is made — a strong foundation.</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col items-center gap-0.5">
                <ArrowDown className="h-5 w-5 text-accent" />
                <span className="text-[10px] text-accent font-medium">SOUPY intercepts here</span>
              </div>

              <Card className="border-2 border-accent">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-accent" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-accent">Stage 3 — SOUPY Intelligence Layer (NEW)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { icon: Shield, name: 'Builder', desc: 'Constructs strongest case', color: 'text-primary' },
                      { icon: AlertTriangle, name: 'Red Team', desc: 'Attacks from every angle', color: 'text-destructive' },
                      { icon: BarChart3, name: 'Analyst', desc: 'Maps systemic patterns', color: 'text-consensus' },
                      { icon: RefreshCw, name: 'Frame Breaker', desc: 'Challenges shared assumptions', color: 'text-accent' },
                    ].map((role, i) => (
                      <div key={i} className="rounded-lg border bg-card p-3 text-center space-y-1">
                        <role.icon className={`h-4 w-4 mx-auto ${role.color}`} />
                        <p className="text-[11px] font-semibold">{role.name}</p>
                        <p className="text-[9px] text-muted-foreground">{role.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="rounded-md border bg-card/80 p-2">
                      <p className="font-semibold text-accent">1. Divergence</p>
                      <p className="text-muted-foreground">4 models analyze independently — no cross-contamination</p>
                    </div>
                    <div className="rounded-md border bg-card/80 p-2">
                      <p className="font-semibold text-accent">2. Reality Anchoring</p>
                      <p className="text-muted-foreground">Evidence validated against LCD/NCD & KnowledgePacks</p>
                    </div>
                    <div className="rounded-md border bg-card/80 p-2">
                      <p className="font-semibold text-accent">3. Adaptive Synthesis</p>
                      <p className="text-muted-foreground">Consensus scored, dissent preserved, appeal defense generated</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col items-center gap-0.5">
                <ArrowDown className="h-5 w-5 text-consensus" />
                <span className="text-[10px] text-muted-foreground">Enriched output flows back into existing systems</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: BarChart3, title: 'Virtuoso Analytics', desc: 'Now with appeal-resilience metrics', tag: 'Enhanced', color: 'text-consensus' },
                  { icon: FileText, title: 'Appeal Portal', desc: 'Pre-built defense letters at determination time', tag: 'New', color: 'text-accent' },
                  { icon: Lock, title: 'Audit Trail', desc: 'Complete reasoning transcript — every perspective', tag: 'New', color: 'text-accent' },
                ].map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                        <span className="text-[11px] font-semibold">{item.title}</span>
                        <Badge variant="outline" className={`ml-auto text-[8px] px-1 py-0 ${item.tag === 'New' ? 'border-accent/30 text-accent' : 'border-consensus/30 text-consensus'}`}>{item.tag}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border-2 border-dashed border-accent/30 bg-accent/5">
                  <Cpu className="h-4 w-4 text-accent" />
                  <span className="text-xs font-semibold text-accent">8 weeks from contract to production — single REST endpoint</span>
                </div>
              </div>
            </div>
          </Slide>
        )}

        {/* SLIDE 9: The Offer (was 8) */}
        {currentSlide === 8 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8">
              <div className="space-y-2 text-center">
                <Badge variant="outline" className="text-xs">The Offer</Badge>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Three capabilities that amplify what you've built.
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
                    <span className="text-muted-foreground font-normal"> It's the next evolution of what you've already built —</span>
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                    adversarial AI reasoning, pre-built appeal defense, and a provider revenue channel.
                    Designed to amplify ClaimsXten, Replay, Virtuoso, and ClaimShark.
                    Built to sit on top of all of them.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Slide>
        )}

        {/* SLIDE 10: Sources (was 9) */}
        {currentSlide === 9 && (
          <Slide>
            <div className="flex-1 flex flex-col justify-center space-y-8 max-w-2xl mx-auto">
              <div className="space-y-2 text-center">
                <Badge variant="outline" className="text-xs">References</Badge>
                <h2 className="text-2xl font-bold tracking-tight">Sources & Citations</h2>
                <p className="text-sm text-muted-foreground">
                  All figures in this presentation are sourced from published industry data.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  {
                    org: 'Kaiser Family Foundation (KFF)',
                    title: 'Claims Denials and Appeals in ACA Marketplace Plans in 2023',
                    detail: 'Appeal overturn rates, denial frequency, and consumer appeal behavior across HealthCare.gov issuers.',
                    url: 'kff.org/private-insurance/claims-denials-and-appeals-in-aca-marketplace-plans-in-2023',
                    date: 'January 2025',
                  },
                  {
                    org: 'American Hospital Association (AHA)',
                    title: 'Payer Denial Tactics — How to Confront a $20 Billion Problem',
                    detail: 'Industry-wide cost of denial management, administrative burden on providers, and systemic payer practices.',
                    url: 'aha.org/aha-center-health-innovation-market-scan/2024-04-02-payer-denial-tactics-how-confront-20-billion-problem',
                    date: 'April 2024',
                  },
                  {
                    org: 'CMS / HealthCare.gov',
                    title: 'Transparency in Coverage — Marketplace Public Use Files',
                    detail: 'Underlying data for denial rates, in-network vs out-of-network claim outcomes.',
                    url: 'cms.gov/cciio/resources/data-resources/marketplace-puf',
                    date: 'Ongoing',
                  },
                ].map((source, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-accent">{source.org}</p>
                        <Badge variant="outline" className="text-[10px]">{source.date}</Badge>
                      </div>
                      <p className="text-sm font-medium">{source.title}</p>
                      <p className="text-xs text-muted-foreground">{source.detail}</p>
                      <p className="text-[10px] text-muted-foreground/60 font-mono break-all">{source.url}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground/50 text-center italic">
                Projected figures (revenue opportunity, engineering cost) are modeled estimates based on platform architecture — not published benchmarks.
              </p>
            </div>
          </Slide>
        )}

          </div>
        </div>
      </div>

      {/* Bottom next button */}
      <div className="shrink-0 bg-card/90 backdrop-blur-sm border-t px-4 py-3">
        <div className="container mx-auto max-w-5xl flex items-center justify-center">
          <Button
            variant={currentSlide === SLIDES.length - 1 ? 'outline' : 'default'}
            size="lg"
            onClick={currentSlide === SLIDES.length - 1 ? onExit : next}
            className="gap-2 min-w-[200px]"
          >
            {currentSlide === SLIDES.length - 1 ? (
              <>
                Exit Presentation
                <X className="h-4 w-4" />
              </>
            ) : (
              <>
                {SLIDES[currentSlide + 1]?.label}
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
