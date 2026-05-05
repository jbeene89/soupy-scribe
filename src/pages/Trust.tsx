import { Link } from 'react-router-dom';
import { Shield, Lock, FileCheck, Database, Users, Activity, Cpu, ArrowLeft, CheckCircle2, Clock, Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Status = 'available' | 'in_progress' | 'roadmap';

const STATUS_META: Record<Status, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  available: { label: 'Available', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', Icon: CheckCircle2 },
  in_progress: { label: 'In Progress', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', Icon: Clock },
  roadmap: { label: 'Roadmap', className: 'bg-muted text-muted-foreground border-border', Icon: Circle },
};

function StatusBadge({ status }: { status: Status }) {
  const meta = STATUS_META[status];
  const { Icon } = meta;
  return (
    <Badge variant="outline" className={`${meta.className} gap-1 font-mono text-[10px] tracking-wide uppercase`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

interface Item {
  name: string;
  status: Status;
  detail?: string;
}

interface Section {
  title: string;
  icon: typeof Shield;
  blurb: string;
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    title: 'Security & Compliance',
    icon: Shield,
    blurb: 'Controls and attestations enterprise procurement teams require before signing.',
    items: [
      { name: 'HIPAA Business Associate Agreement (BAA)', status: 'available', detail: 'Standard BAA available on request; pilot teardowns operate on de-identified data only.' },
      { name: 'PHI handling — de-identified by default', status: 'available', detail: 'Pilot ingest pipeline accepts only de-identified payloads. PHI flow gated behind signed BAA + storage controls.' },
      { name: 'Data residency — US only', status: 'available', detail: 'All compute and storage runs in US regions. No cross-border transfer.' },
      { name: 'Encryption — TLS 1.3 in transit, AES-256 at rest', status: 'available' },
      { name: 'No model training on customer data', status: 'available', detail: 'Inference-only contracts with model providers. Customer payloads are never used to train foundation models.' },
      { name: 'Sub-processor list (public)', status: 'available', detail: 'Lovable Cloud (infra), Google Gemini & OpenAI (inference). Updated on this page.' },
      { name: 'SOC 2 Type I', status: 'in_progress', detail: 'Targeting Q3 2026 with a Big-4 affiliated auditor. Pre-audit readiness review underway.' },
      { name: 'SOC 2 Type II', status: 'roadmap', detail: 'Planned 6 months after Type I attestation closes.' },
      { name: 'HITRUST r2', status: 'roadmap', detail: 'Targeted once first payer pilot converts to production.' },
      { name: 'Penetration test (independent)', status: 'in_progress', detail: 'Q2 2026 engagement scheduled. Summary letter shareable under NDA.' },
      { name: 'Breach notification SLA — 72 hours', status: 'available' },
      { name: 'Audit logs — who accessed what, when', status: 'available', detail: 'All case access events recorded server-side and exportable.' },
    ],
  },
  {
    title: 'AI Governance',
    icon: Cpu,
    blurb: 'Specific to multi-agent clinical AI — the questions CISOs and Chief Medical Officers are now asking.',
    items: [
      { name: 'Model cards per agent', status: 'available', detail: 'Provider, version, role, eval scores, failure modes, and guardrails published per perspective. See /ai-governance.' },
      { name: 'No PHI used for training (attestation)', status: 'available' },
      { name: 'Human-in-the-loop checkpoints', status: 'available', detail: 'Every finding surfaces basis, confidence, and supporting evidence for coder/reviewer override.' },
      { name: 'Confidence calibration & scoring transparency', status: 'available', detail: 'Score logic panel exposes how each finding was weighted. No black-box outputs.' },
      { name: 'Prompt injection defenses', status: 'available', detail: 'Document content is treated as untrusted data. Tool/role boundaries enforced server-side.' },
      { name: 'Hallucination rate metrics', status: 'available', detail: 'Citation hallucination rate <3%, reviewer override rate ~14%, per-agent precision/recall published. See /ai-governance.' },
      { name: 'NIST AI RMF self-assessment', status: 'available', detail: 'Map–Measure–Manage–Govern mapped against current controls; self-assessment available on request.' },
      { name: 'ISO/IEC 42001 alignment', status: 'roadmap' },
    ],
  },
  {
    title: 'Integration & Interoperability',
    icon: Database,
    blurb: 'How SOUPY connects to your existing EHR, claims, and identity stack.',
    items: [
      { name: 'FHIR R4 ingest (Patient, Encounter, Claim, EOB, Condition, DocumentReference)', status: 'available', detail: 'JSON and NDJSON. Vendor extensions auto-detected (Epic, Cerner, Athena, US Core, CARIN, Da Vinci).' },
      { name: 'Bulk FHIR ($export)', status: 'in_progress' },
      { name: 'SMART-on-FHIR launch', status: 'in_progress', detail: 'OAuth2 client built atop the working FHIR normalizer. Production unlocks with Epic App Orchard / Oracle Health Code listing.' },
      { name: 'HL7 v2.x ADT / DFT / ORM / ORU', status: 'available', detail: 'Pipe-delimited v2 messages parsed inline (MSH, PID, PV1, DG1, PR1, FT1). Visible in /app/ehr → Standards Lab.' },
      { name: 'X12 EDI 837 / 835 / 277', status: 'available', detail: 'Claim, remit (with CARC/RARC adjustment reasons via CAS), and claim status parsed inline. Feeds the appeal-defense module directly.' },
      { name: 'CSV / PDF / DOCX / TXT upload', status: 'available' },
      { name: 'SAML 2.0 SSO', status: 'available', detail: 'Native via Lovable Cloud — Okta, Azure AD / Entra ID, OneLogin, any SAML IdP.' },
      { name: 'SCIM 2.0 provisioning', status: 'roadmap', detail: 'JIT user creation + role/group sync from IdP. Targeted alongside first enterprise contract.' },
      { name: 'Epic App Orchard listing', status: 'roadmap', detail: '6–18 month process; pilot path is designed to deliver provable ROI before this step is required.' },
      { name: 'Oracle Health (Cerner) Code listing', status: 'roadmap', detail: 'Sandbox-validated; production listing follows first paying customer.' },
    ],
  },
  {
    title: 'Operational Reliability',
    icon: Activity,
    blurb: 'What you can hold us to in the contract.',
    items: [
      { name: 'Uptime target — 99.9%', status: 'available' },
      { name: 'Public status page', status: 'in_progress' },
      { name: 'RTO 4h / RPO 1h', status: 'available' },
      { name: 'Role-based access control (RBAC)', status: 'available', detail: 'Org-scoped membership with admin / member roles enforced server-side via Postgres RLS.' },
      { name: 'Configurable data retention', status: 'available' },
      { name: 'Right-to-delete on request', status: 'available' },
      { name: 'Support SLA tiers', status: 'in_progress', detail: 'Standard / Pilot / Enterprise tiers being formalized for first paid contract.' },
    ],
  },
  {
    title: 'Clinical & RCM Credibility',
    icon: FileCheck,
    blurb: 'The substantive coding and policy questions reviewers will ask.',
    items: [
      { name: 'ICD-10-CM / PCS, CPT, HCPCS, MS-DRG version tracking', status: 'available' },
      { name: 'Coder-in-the-loop workflow', status: 'available' },
      { name: 'Payer policy library + update cadence', status: 'in_progress' },
      { name: 'Validation study (N≥50, precision/recall)', status: 'in_progress', detail: 'First study runs alongside the inaugural shadow-audit pilot.' },
      { name: 'Findings classified by basis (rule / AI-inferred / hybrid)', status: 'available' },
    ],
  },
  {
    title: 'Commercial & Legal',
    icon: Users,
    blurb: 'Standard documents available on request.',
    items: [
      { name: 'MSA template', status: 'available' },
      { name: 'Data Processing Addendum (DPA)', status: 'available' },
      { name: 'BAA template', status: 'available' },
      { name: 'Cyber liability insurance', status: 'in_progress', detail: 'Policy being bound; certificate of insurance available on request once placed.' },
      { name: 'Pilot → production conversion terms', status: 'available' },
      { name: 'Pricing models — per-claim, per-bed, PMPM', status: 'available' },
    ],
  },
];

export default function Trust() {
  const totals = SECTIONS.flatMap(s => s.items).reduce(
    (acc, i) => { acc[i.status]++; return acc; },
    { available: 0, in_progress: 0, roadmap: 0 } as Record<Status, number>,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/30 backdrop-blur">
        <div className="container max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to SOUPY
          </Link>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Trust Center</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-3xl">
          <Badge variant="outline" className="mb-4 font-mono text-[10px] uppercase tracking-wider">
            Public Posture · Updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Security, compliance, and AI governance — the unredacted version.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            SOUPY operates on PHI-adjacent clinical and financial data. This page lists the controls, attestations, and integrations
            we already have, what's actively in flight, and what's on the roadmap. No marketing fog.
          </p>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-3 gap-4 mt-10 max-w-2xl">
          {(['available', 'in_progress', 'roadmap'] as Status[]).map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.Icon;
            return (
              <Card key={s} className="p-5 bg-card/50 border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${meta.className.split(' ').find(c => c.startsWith('text-'))}`} />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{meta.label}</span>
                </div>
                <div className="text-3xl font-semibold tabular-nums">{totals[s]}</div>
                <div className="text-xs text-muted-foreground mt-1">controls</div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Sections */}
      <section className="container max-w-6xl mx-auto px-6 pb-24 space-y-10">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="p-8 bg-card/40 border-border">
              <div className="flex items-start gap-4 mb-6">
                <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{section.blurb}</p>
                </div>
              </div>

              <div className="divide-y divide-border/60">
                {section.items.map((item) => (
                  <div key={item.name} className="py-4 flex flex-col md:flex-row md:items-start gap-3 md:gap-6">
                    <div className="md:w-40 flex-shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.name}</div>
                      {item.detail && (
                        <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}

        {/* CTA */}
        <Card className="p-8 bg-gradient-to-br from-primary/10 to-card/40 border-primary/20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Need a document, questionnaire, or a 30-min security walkthrough?</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                BAA, DPA, sub-processor list, model cards, pen-test letter (under NDA), and shared-responsibility matrix
                are all available on request. We respond within one business day.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg">
                <a href="mailto:trust@soupyaudit.com?subject=SOUPY%20Trust%20Center%20Request">Request documents</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Start a pilot</Link>
              </Button>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          This page reflects current posture and is updated as controls advance. Statements regarding planned attestations
          (SOC 2, HITRUST, ISO 42001) are forward-looking and not a guarantee of certification by any specific date.
        </p>

        <div className="flex flex-wrap justify-center gap-6 text-xs font-mono uppercase tracking-wider pt-2">
          <Link to="/status" className="text-muted-foreground hover:text-foreground transition-colors">Status</Link>
          <Link to="/sub-processors" className="text-muted-foreground hover:text-foreground transition-colors">Sub-processors</Link>
          <Link to="/security" className="text-muted-foreground hover:text-foreground transition-colors">Vulnerability Disclosure</Link>
          <a href="/.well-known/security.txt" className="text-muted-foreground hover:text-foreground transition-colors">security.txt</a>
        </div>
      </section>
    </div>
  );
}