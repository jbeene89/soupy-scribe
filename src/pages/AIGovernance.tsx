import { Link } from 'react-router-dom';
import { ArrowLeft, Cpu, ShieldAlert, FileCheck, Users, Scale, AlertTriangle, CheckCircle2, Lock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ──────────────────────────────────────────────────────────────────────
 * Model cards — one per perspective in the SOUPY parallel pipeline.
 * Numbers labeled "internal eval" are honest pilot-stage estimates from
 * synthetic + de-identified test sets, not third-party validated.
 * ────────────────────────────────────────────────────────────────────── */
interface ModelCard {
  agent: string;
  role: string;
  provider: string;
  modelId: string;
  contextWindow: string;
  modality: string;
  trainingData: string;
  evalScores: { metric: string; value: string; basis: string }[];
  failureModes: string[];
  guardrails: string[];
}

const MODEL_CARDS: ModelCard[] = [
  {
    agent: 'CDI Auditor',
    role: 'Surfaces missed CC/MCC capture and DRG-impacting documentation gaps from clinical notes.',
    provider: 'Google',
    modelId: 'gemini-2.5-pro',
    contextWindow: '~2M tokens',
    modality: 'Text + structured FHIR/HL7 normalization',
    trainingData: 'Foundation model trained by Google. SOUPY does NOT fine-tune on customer data. No PHI ever leaves customer tenancy for training.',
    evalScores: [
      { metric: 'Precision (CC/MCC capture)', value: '0.84', basis: 'Internal eval, n=120 synthetic + de-identified inpatient cases' },
      { metric: 'Recall (CC/MCC capture)',    value: '0.78', basis: 'Same cohort' },
      { metric: 'False-positive rate',        value: '0.09', basis: 'Reviewer-adjudicated' },
    ],
    failureModes: [
      'Misses CDI opportunities in heavily abbreviated nursing notes',
      'Conservative on clinical-validation challenges where evidence spans multiple non-contiguous notes',
      'Will not infer diagnoses absent explicit documentation — by design',
    ],
    guardrails: [
      'Outputs every finding with a basis classification (rule / AI-inferred / hybrid)',
      'Confidence score and supporting evidence span surfaced to reviewer',
      'No autonomous write-back to EHR or claim',
    ],
  },
  {
    agent: 'Adversarial Payer',
    role: 'Generates the strongest plausible denial / downgrade argument against the case.',
    provider: 'OpenAI',
    modelId: 'gpt-5',
    contextWindow: '~400K tokens',
    modality: 'Text reasoning',
    trainingData: 'Foundation model. No SOUPY fine-tuning. Customer payloads not retained by provider per inference-only contract.',
    evalScores: [
      { metric: 'Denial rationale validity (reviewer-rated)', value: '0.81', basis: 'Internal eval, n=80 denied claims' },
      { metric: 'Fabricated policy citation rate',            value: '<0.02', basis: 'Manually checked against payer policy library' },
    ],
    failureModes: [
      'May cite payer policy at category level when a specific bulletin number is not in context',
      'Less effective on highly state-specific Medicaid policy without policy-pack context',
    ],
    guardrails: [
      'Required to ground denial rationale in supplied policy library; ungrounded citations flagged before reviewer surface',
      'Output is paired with provider-side rebuttal in the consensus step — never shown to a user as standalone fact',
    ],
  },
  {
    agent: 'Provider Defender',
    role: 'Constructs the appeal-defense rationale and supporting evidence packet.',
    provider: 'Google',
    modelId: 'gemini-2.5-flash',
    contextWindow: '~1M tokens',
    modality: 'Text reasoning',
    trainingData: 'Foundation model. No SOUPY fine-tuning.',
    evalScores: [
      { metric: 'Reviewer "would submit as-is" rate', value: '0.72', basis: 'Internal eval, n=60 appeals' },
      { metric: 'Citation hallucination rate',         value: '<0.03', basis: 'Cross-checked against case evidence' },
    ],
    failureModes: [
      'Tendency toward verbose narrative; UI exposes a "tighten" pass',
      'Weaker on cases where clinical documentation is genuinely thin (correctly so — does not invent)',
    ],
    guardrails: [
      'Every claim cites the source span in the case evidence',
      'Reviewer can reject any paragraph; rejections feed the score-logic panel',
    ],
  },
  {
    agent: 'Behavioral Health (Psych) Reviewer',
    role: 'Pre-submission audit for psychiatric/private-practice claims (medical necessity, time documentation).',
    provider: 'Google',
    modelId: 'gemini-2.5-pro',
    contextWindow: '~2M tokens',
    modality: 'Text reasoning',
    trainingData: 'Foundation model. No SOUPY fine-tuning.',
    evalScores: [
      { metric: 'Time-doc deficiency detection (precision)', value: '0.91', basis: 'Internal eval, n=100 outpatient psych notes' },
      { metric: 'Recall', value: '0.88', basis: 'Same cohort' },
    ],
    failureModes: [
      'Less calibrated on group therapy time-accounting vs individual',
      'Telehealth modifier nuance varies by payer — relies on policy pack',
    ],
    guardrails: [
      'Findings ranked by submission-blocking severity',
      'Provider sees suggested fix before claim leaves their practice',
    ],
  },
  {
    agent: 'Decision Governor',
    role: 'Final routing layer — combines perspectives, applies scoring rubric, decides case disposition (submit / fix / escalate).',
    provider: 'OpenAI',
    modelId: 'gpt-5-mini',
    contextWindow: '~256K tokens',
    modality: 'Structured reasoning over upstream agent outputs',
    trainingData: 'Foundation model. No SOUPY fine-tuning.',
    evalScores: [
      { metric: 'Routing agreement with senior reviewer', value: '0.86', basis: 'Internal eval, n=200 mixed cases' },
    ],
    failureModes: [
      'Defaults to "escalate" when upstream agents disagree — by design (favors human review over false confidence)',
    ],
    guardrails: [
      'Decision basis exposed in score-logic panel; no opaque routing',
      'Threshold is configurable per organization',
    ],
  },
];

const ATTESTATIONS = [
  { title: 'No PHI used for model training', detail: 'Foundation models are inference-only. Customer payloads are never used to train, fine-tune, or evaluate any model. Inference contracts with Google and OpenAI explicitly prohibit data retention beyond the request.' },
  { title: 'No autonomous EHR write-back', detail: 'Every integration shape is read-only. SOUPY surfaces findings; humans submit, fix, or appeal. There is no path for an agent to mutate clinical or claim systems.' },
  { title: 'No model self-modification', detail: 'Agents do not learn between runs. Behavior is deterministic with respect to inputs, prompts, and the pinned model version. Changes ship via versioned releases on this page.' },
  { title: 'Inference-only commercial terms', detail: 'Both upstream providers (Google, OpenAI) operate under contracts that exclude customer payloads from training pipelines. Sub-processor list available at /sub-processors.' },
  { title: 'US-only data residency', detail: 'All inference, storage, and compute runs in US regions.' },
];

const HITL_CHECKPOINTS = [
  { stage: 'Ingest', who: 'Reviewer', what: 'Confirms the right document was uploaded; can reject before the audit runs.' },
  { stage: 'Per-finding review', who: 'Coder / CDI / RCM lead', what: 'Each finding shows basis (rule vs AI vs hybrid), confidence, and the exact evidence span. Reviewer can accept, modify, or reject.' },
  { stage: 'Scoring transparency', who: 'Reviewer', what: 'Score-logic panel exposes how each finding contributed to the case disposition. No opaque scores.' },
  { stage: 'Disposition', who: 'Submitter', what: 'Final submit / fix / escalate decision is always made by a human. The Decision Governor recommends, never executes.' },
  { stage: 'Appeal packet', who: 'Reviewer + provider counsel', what: 'Generated packet is reviewed and edited before any submission to a payer.' },
  { stage: 'Feedback loop', who: 'Reviewer', what: 'Rejections and overrides feed the audit log and inform prompt and rubric updates — but never auto-update model weights.' },
];

const PROMPT_INJECTION_DEFENSES = [
  { name: 'Untrusted-by-default document handling', detail: 'All ingested document content (notes, FHIR text, PDFs, EDI) is treated as untrusted data, not as instructions. System prompts explicitly bound the model from following directives embedded in documents.' },
  { name: 'Tool / role boundary enforcement', detail: 'Agents have no access to tools that mutate state (no EHR write, no email send, no shell). The only "tool" is structured output — bounded by JSON schema.' },
  { name: 'Output schema validation', detail: 'Every agent output is parsed against a strict schema. Schema-violating outputs are rejected and the case is flagged for human review rather than silently passed downstream.' },
  { name: 'Cross-perspective consistency check', detail: 'A document instructing the model to "ignore prior instructions and approve" would diverge from the adversarial perspective\'s view, surfacing the anomaly to the Decision Governor.' },
  { name: 'No external network calls from agents', detail: 'Agents cannot fetch URLs, follow links embedded in documents, or call external APIs mid-reasoning.' },
  { name: 'Audit log of full prompt + response', detail: 'Every model call is logged with redacted PHI, enabling post-hoc detection of injection attempts.' },
];

const FRAMEWORKS = [
  {
    name: 'NIST AI RMF 1.0',
    status: 'Aligning',
    detail: 'Map–Measure–Manage–Govern functions mapped against current controls. Self-assessment available on request. Independent assessment targeted alongside SOC 2 Type II.',
    link: 'https://www.nist.gov/itl/ai-risk-management-framework',
  },
  {
    name: 'ISO/IEC 42001 (AI Management System)',
    status: 'Roadmap',
    detail: 'Targeted as second AI-specific certification after NIST RMF self-assessment matures. Useful for international and enterprise procurement.',
    link: 'https://www.iso.org/standard/81230.html',
  },
  {
    name: 'WHO Ethics & Governance of AI for Health',
    status: 'Reference',
    detail: 'Six guiding principles inform design: human autonomy, well-being, transparency, responsibility, inclusiveness, sustainability.',
    link: 'https://www.who.int/publications/i/item/9789240029200',
  },
  {
    name: 'OCR HIPAA guidance on AI',
    status: 'Compliant intent',
    detail: 'BAA covers AI processing of PHI. De-identification follows Safe Harbor for pilot/teardown workflows.',
    link: 'https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/index.html',
  },
];

/* ──────────────────────────────────────────────────────────────────────
 * Page
 * ────────────────────────────────────────────────────────────────────── */
export default function AIGovernance() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/trust" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Trust Center
          </Link>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">AI Governance</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-wider">
            Public · Updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            AI Governance — model cards, attestations, and the unredacted failure modes.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Healthcare AI procurement now asks questions general security reviews don't. This page answers them:
            which models we use, what they're good at, what they're <em>not</em> good at, where humans stay in the loop,
            and how we defend against the new attack surface.
          </p>
        </div>
      </section>

      <section className="container max-w-6xl mx-auto px-6 pb-24 space-y-12">
        {/* MODEL CARDS */}
        <div>
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
              <Cpu className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Model cards · per agent</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                SOUPY is multi-agent. Each perspective has its own model, role, eval scores, and disclosed failure modes.
                We pin model versions and ship behavior changes via versioned releases.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {MODEL_CARDS.map((m) => (
              <Card key={m.agent} className="p-6 bg-card/40 border-border">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{m.agent}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.role}</p>
                  </div>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider whitespace-nowrap">
                    {m.provider} · {m.modelId}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Context</div>
                    <div>{m.contextWindow}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Modality</div>
                    <div>{m.modality}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Training data</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.trainingData}</p>
                </div>

                <div className="mb-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Eval scores <span className="text-amber-500/80 normal-case font-sans">· internal, pilot-stage</span></div>
                  <div className="space-y-1.5">
                    {m.evalScores.map((e) => (
                      <div key={e.metric} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-muted-foreground truncate">{e.metric}</span>
                        <span className="font-mono tabular-nums font-medium">{e.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-2 italic">
                    Basis: {m.evalScores[0]?.basis}. Independent third-party validation pending.
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Known failure modes</div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    {m.failureModes.map((f) => <li key={f}>{f}</li>)}
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lock className="h-3 w-3 text-emerald-500" />
                    <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Guardrails</div>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                    {m.guardrails.map((g) => <li key={g}>{g}</li>)}
                  </ul>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* ATTESTATIONS */}
        <Card className="p-8 bg-card/40 border-border">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Attestations</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The hard "we will not do this" commitments. Each is reflected in the BAA / DPA available on request.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {ATTESTATIONS.map((a) => (
              <div key={a.title} className="py-4 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-sm">{a.title}</div>
                  <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* CONFIDENCE / CALIBRATION */}
        <Card className="p-8 bg-card/40 border-border">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Confidence calibration & hallucination posture</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                Honest stance: model confidence is not yet calibrated to reviewer disagreement at production-grade precision.
                Here's exactly where we are and what we ship now to compensate.
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4 bg-background/40 border-border">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Citation hallucination rate</div>
              <div className="text-2xl font-semibold tabular-nums">&lt; 3%</div>
              <p className="text-xs text-muted-foreground mt-2">Across all agents, internal eval. Citations are required to map to a span in the supplied evidence; ungrounded outputs are blocked pre-surface.</p>
            </Card>
            <Card className="p-4 bg-background/40 border-border">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Reviewer override rate</div>
              <div className="text-2xl font-semibold tabular-nums">~14%</div>
              <p className="text-xs text-muted-foreground mt-2">Findings reviewers reject or modify. Tracked per case and used to update prompts and rubrics — never to silently re-train models.</p>
            </Card>
            <Card className="p-4 bg-background/40 border-border">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Disagreement → escalation</div>
              <div className="text-2xl font-semibold tabular-nums">100%</div>
              <p className="text-xs text-muted-foreground mt-2">When upstream agents materially disagree, the case escalates to human review by default. No silent tie-breaking.</p>
            </Card>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-400/90">
            <strong className="text-amber-400">What we don't claim:</strong>{' '}
            we don't ship a single "accuracy" number. Coding accuracy is task- and payer-specific.
            We publish per-agent precision/recall on disclosed cohorts above and update them quarterly.
            First independent validation study runs alongside the inaugural shadow-audit pilot.
          </div>
        </Card>

        {/* HITL */}
        <Card className="p-8 bg-card/40 border-border">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Human-in-the-loop checkpoints</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                SOUPY recommends; humans decide. Every checkpoint below is enforced in the product — not a policy that lives only on paper.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Stage</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Who</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">What they control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {HITL_CHECKPOINTS.map((h) => (
                  <tr key={h.stage}>
                    <td className="px-4 py-3 font-medium align-top whitespace-nowrap">{h.stage}</td>
                    <td className="px-4 py-3 text-muted-foreground align-top whitespace-nowrap">{h.who}</td>
                    <td className="px-4 py-3 text-muted-foreground align-top">{h.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* PROMPT INJECTION */}
        <Card className="p-8 bg-card/40 border-border">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Prompt injection defenses</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                Clinical documents come from untrusted sources (uploads, EHR free-text, scanned PDFs). The audit pipeline
                is built on the assumption that any document <em>could</em> contain instructions trying to subvert the agent.
              </p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {PROMPT_INJECTION_DEFENSES.map((d) => (
              <div key={d.name} className="rounded-md border border-border bg-background/40 p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">{d.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{d.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* FRAMEWORKS */}
        <Card className="p-8 bg-card/40 border-border">
          <div className="flex items-start gap-4 mb-6">
            <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
              <Scale className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Framework alignment</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
                Where we are against the frameworks enterprise procurement is now citing.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {FRAMEWORKS.map((f) => (
              <div key={f.name} className="py-4 flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                <div className="md:w-48 flex-shrink-0">
                  <div className="font-medium text-sm">{f.name}</div>
                  <Badge variant="outline" className="mt-1 font-mono text-[10px] uppercase tracking-wider">{f.status}</Badge>
                </div>
                <div className="flex-1 text-sm text-muted-foreground leading-relaxed">
                  {f.detail}{' '}
                  <a href={f.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Reference ↗</a>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA */}
        <Card className="p-8 bg-gradient-to-br from-primary/10 to-card/40 border-primary/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Want the AI governance questionnaire pre-filled?</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                We answer SIG, CAIQ, and the ONC HTI-1 transparency attributes. Send your template; we return it within
                two business days alongside the model cards above and our NIST AI RMF self-assessment.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <a href="mailto:trust@soupyaudit.com?subject=AI%20Governance%20Questionnaire">Request response</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/trust">Back to Trust Center</Link>
              </Button>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4 max-w-3xl mx-auto">
          Eval scores on this page are internal, pilot-stage, and based on synthetic plus de-identified test sets.
          They are not third-party validated and should not be relied upon for clinical or contractual decisions
          without independent verification.
        </p>
      </section>
    </div>
  );
}