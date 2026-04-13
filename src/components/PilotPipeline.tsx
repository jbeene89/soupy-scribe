import { CheckCircle2, Clock, Plug, Upload, BarChart3, Zap, ArrowDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASES = [
  {
    phase: 'Phase 0',
    title: 'Shadow Audit (No Integration)',
    timeline: '1–2 weeks',
    effort: 'None',
    icon: Upload,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
    description: 'Upload historical claims or op notes directly. The engine runs multi-perspective analysis against your real data — no system access needed.',
    steps: [
      'Export a sample batch of closed cases (CSV, PDF, or structured text)',
      'Upload via the case intake UI — no PHI leaves your environment if self-hosted',
      'Engine returns consensus scores, risk flags, and evidence gaps',
      'Compare engine findings against your known outcomes',
    ],
    verifies: 'Analytical accuracy, finding relevance, false-positive rate',
  },
  {
    phase: 'Phase 1',
    title: 'Parallel Run (Light Integration)',
    timeline: '2–4 weeks',
    effort: 'Low',
    icon: BarChart3,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10',
    description: 'Run the engine alongside your existing workflow on live cases. No routing changes — just compare outputs side by side.',
    steps: [
      'Connect a read-only feed from your claims or coding queue',
      'Engine processes cases in parallel with your current reviewers',
      'Dashboard tracks agreement rate, catch rate, and time-to-finding',
      'Weekly calibration reviews with your compliance or RI team',
    ],
    verifies: 'Operational fit, reviewer agreement, incremental catch value',
  },
  {
    phase: 'Phase 2',
    title: 'Assisted Workflow (Moderate Integration)',
    timeline: '4–8 weeks',
    effort: 'Moderate',
    icon: Plug,
    color: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    description: 'Engine findings feed into reviewer queues. Humans still make every decision — the engine prioritizes, pre-scores, and flags.',
    steps: [
      'API integration with your case management or audit platform',
      'Configurable routing rules based on risk tier and confidence',
      'Pre-built defense packets attached to flagged cases',
      'Org-scoped dashboards for leadership visibility',
    ],
    verifies: 'Throughput improvement, reviewer efficiency, defensibility of outputs',
  },
  {
    phase: 'Phase 3',
    title: 'Full Pipeline (Deep Integration)',
    timeline: '8–12 weeks',
    effort: 'Full',
    icon: Zap,
    color: 'text-violet-400',
    borderColor: 'border-violet-500/30',
    bgColor: 'bg-violet-500/10',
    description: 'End-to-end automation with human oversight at governance checkpoints. Engine handles triage, analysis, and packet generation.',
    steps: [
      'Bi-directional integration with EHR, claims, and scheduling systems',
      'Automated case ingestion with real-time processing queue',
      'Operational modules (OR Readiness, Triage, Post-Op) running live',
      'Ghost case injection and gold-set calibration running continuously',
    ],
    verifies: 'ROI, sustained accuracy, audit defensibility at scale',
  },
];

const PRE_INTEGRATION_CHECKS = [
  {
    title: 'Historical Accuracy Test',
    description: 'Run 50–100 closed cases with known outcomes through the engine. Measure agreement rate.',
    icon: CheckCircle2,
  },
  {
    title: 'Payer Pattern Validation',
    description: 'Check if the engine\'s payer behavioral profiles match your top 5 payers\' actual denial patterns.',
    icon: Shield,
  },
  {
    title: 'Edge Case Stress Test',
    description: 'Submit your hardest cases — modifier stacking, bundling disputes, medical necessity gray zones — and evaluate reasoning quality.',
    icon: CheckCircle2,
  },
  {
    title: 'Turnaround Benchmark',
    description: 'Compare engine processing time against your current review cycle for equivalent case complexity.',
    icon: Clock,
  },
];

export function PilotPipeline() {
  return (
    <div className="w-full max-w-3xl mx-auto mt-6 px-2">
      {/* Section header */}
      <div className="text-center mb-8">
        <h2 className="text-lg font-bold text-foreground mb-1">Pilot Pipeline</h2>
        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
          Every engagement starts at Phase 0. No integration required to prove value — advance only when the data justifies it.
        </p>
      </div>

      {/* Timeline */}
      <div className="relative space-y-4">
        {PHASES.map((phase, i) => {
          const Icon = phase.icon;
          return (
            <div key={phase.phase}>
              <div className={cn(
                'relative border rounded-lg p-4 bg-card/50 backdrop-blur-sm transition-all',
                phase.borderColor,
              )}>
                {/* Phase badge */}
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn('p-2 rounded-md shrink-0', phase.bgColor)}>
                    <Icon className={cn('h-4 w-4', phase.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold uppercase tracking-wider', phase.color)}>
                        {phase.phase}
                      </span>
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="text-[10px] text-muted-foreground">{phase.timeline}</span>
                      <span className="text-[10px] text-muted-foreground/60">·</span>
                      <span className="text-[10px] text-muted-foreground">Integration: {phase.effort}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mt-0.5">{phase.title}</h3>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                  {phase.description}
                </p>

                {/* Steps */}
                <ol className="space-y-1.5 mb-3">
                  {phase.steps.map((step, j) => (
                    <li key={j} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className={cn('font-mono text-[10px] mt-px shrink-0', phase.color)}>{j + 1}.</span>
                      {step}
                    </li>
                  ))}
                </ol>

                {/* Verifies */}
                <div className="flex items-start gap-1.5 pt-2 border-t border-border/30">
                  <CheckCircle2 className={cn('h-3 w-3 mt-0.5 shrink-0', phase.color)} />
                  <span className="text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground/70">Verifies:</span> {phase.verifies}
                  </span>
                </div>
              </div>

              {/* Connector arrow */}
              {i < PHASES.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pre-integration verification */}
      <div className="mt-10 mb-6">
        <div className="text-center mb-5">
          <h3 className="text-sm font-bold text-foreground mb-1">Verify Fit Without Integration</h3>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
            These checks can be completed during Phase 0 with uploaded data only — no system access, no IT involvement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRE_INTEGRATION_CHECKS.map((check, i) => {
            const Icon = check.icon;
            return (
              <div key={i} className="border border-border/40 rounded-lg p-3 bg-card/30">
                <div className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-foreground mb-0.5">{check.title}</h4>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{check.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
