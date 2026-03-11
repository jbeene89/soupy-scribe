import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  ArrowDown,
  ArrowRight,
  Shield,
  Zap,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
  Server,
  Eye,
  BarChart3,
  RefreshCw,
  Lock,
  Cpu,
} from 'lucide-react';

/* ─── small reusable pieces ─── */

function PipelineStep({
  icon,
  title,
  desc,
  tag,
  tagColor = 'bg-muted text-muted-foreground',
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag?: string;
  tagColor?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-1.5 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        {tag && (
          <Badge variant="outline" className={`ml-auto text-[9px] px-1.5 py-0 ${tagColor}`}>
            {tag}
          </Badge>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function FlowConnector({ label, direction = 'down' }: { label?: string; direction?: 'down' | 'right' }) {
  if (direction === 'right') {
    return (
      <div className="hidden md:flex items-center gap-1 px-2 shrink-0">
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        {label && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{label}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-0.5 py-2">
      <ArrowDown className="h-4 w-4 text-muted-foreground" />
      {label && <span className="text-[9px] text-muted-foreground">{label}</span>}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {subtitle && <p className="text-[9px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─── main component ─── */

export function LyricAIIntegration() {
  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <Card className="border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-2.5 rounded-lg bg-primary/10 shrink-0">
              <Cpu className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold tracking-tight">How SOUPY Integrates Into Lyric's AI Pipeline</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                SOUPY doesn't replace any existing system. It sits as a reasoning layer between Lyric's current 
                rule engines and the final determination — adding adversarial depth, appeal defense, and auditability 
                to decisions that already flow through the platform.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0 border-accent/30 text-accent">
              Zero Disruption
            </Badge>
          </div>

          {/* ── STAGE 1: Existing Intake ── */}
          <SectionHeader
            icon={<Database className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Stage 1 — Claim Intake (Existing)"
            subtitle="No changes to current ingestion"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-2">
            <PipelineStep
              icon={<Server className="h-4 w-4 text-muted-foreground" />}
              title="835/837 Transaction Feed"
              desc="Existing claim data flows in through standard EDI pipelines — unchanged."
              tag="No Change"
            />
            <PipelineStep
              icon={<FileText className="h-4 w-4 text-muted-foreground" />}
              title="EHR / Clinical Records"
              desc="HL7 FHIR and document ingestion continue as-is into the Lyric data lake."
              tag="No Change"
            />
            <PipelineStep
              icon={<Database className="h-4 w-4 text-muted-foreground" />}
              title="KnowledgePacks & Concepts"
              desc="Lyric's proprietary clinical content libraries remain the source of truth."
              tag="No Change"
            />
          </div>

          <FlowConnector label="Claims flow into rule engine as they do today" />

          {/* ── STAGE 2: Current Rule Engine ── */}
          <SectionHeader
            icon={<Shield className="h-3.5 w-3.5 text-primary" />}
            title="Stage 2 — Deterministic Rule Engine (Existing)"
            subtitle="ClaimsXten, edits, and flags — all preserved"
          />
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 mb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PipelineStep
                icon={<Shield className="h-4 w-4 text-primary" />}
                title="ClaimsXten Rule Engine"
                desc="Deterministic edit rules fire on every claim — flags, bundles, denials generated as normal."
                tag="Existing"
                tagColor="bg-primary/10 text-primary border-primary/30"
              />
              <PipelineStep
                icon={<Eye className="h-4 w-4 text-primary" />}
                title="Replay Pattern Detection"
                desc="Historical pattern matching identifies recurring issues and provider behaviors."
                tag="Existing"
                tagColor="bg-primary/10 text-primary border-primary/30"
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
              Today, this is where the determination is made — a strong foundation ready for enhancement.
            </p>
          </div>

          <FlowConnector label="SOUPY intercepts here — before the final determination is locked" />

          {/* ── STAGE 3: SOUPY Layer (NEW) ── */}
          <SectionHeader
            icon={<Brain className="h-3.5 w-3.5 text-accent" />}
            title="Stage 3 — SOUPY Intelligence Layer (NEW)"
            subtitle="Multi-perspective adversarial reasoning on every flagged claim"
          />
          <div className="rounded-xl border-2 border-accent/30 bg-gradient-to-br from-accent/5 via-card to-primary/5 p-5 mb-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-lg border bg-card p-3 text-center space-y-1.5">
                <div className="mx-auto w-8 h-8 rounded-full bg-role-builder/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-[hsl(var(--role-builder))]" />
                </div>
                <p className="text-[11px] font-semibold">Builder</p>
                <p className="text-[9px] text-muted-foreground">Constructs the strongest case for the determination</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1.5">
                <div className="mx-auto w-8 h-8 rounded-full bg-role-redteam/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-[hsl(var(--role-redteam))]" />
                </div>
                <p className="text-[11px] font-semibold">Red Team</p>
                <p className="text-[9px] text-muted-foreground">Attacks the determination from every angle</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1.5">
                <div className="mx-auto w-8 h-8 rounded-full bg-role-analyst/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-[hsl(var(--role-analyst))]" />
                </div>
                <p className="text-[11px] font-semibold">Systems Analyst</p>
                <p className="text-[9px] text-muted-foreground">Maps systemic patterns and upstream causes</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center space-y-1.5">
                <div className="mx-auto w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-accent" />
                </div>
                <p className="text-[11px] font-semibold">Frame Breaker</p>
                <p className="text-[9px] text-muted-foreground">Challenges assumptions the others share</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card/80 p-3 space-y-1">
                <p className="text-[10px] font-semibold text-accent">Phase 1: Divergence</p>
                <p className="text-[9px] text-muted-foreground">
                  All four models analyze independently — no cross-contamination. Each produces its own
                  assessment, confidence score, and evidence map.
                </p>
              </div>
              <div className="rounded-lg border bg-card/80 p-3 space-y-1">
                <p className="text-[10px] font-semibold text-accent">Phase 2: Reality Anchoring</p>
                <p className="text-[9px] text-muted-foreground">
                  Evidence is validated against LCD/NCD databases and KnowledgePacks.
                  Code combinations are checked for known flag patterns.
                </p>
              </div>
              <div className="rounded-lg border bg-card/80 p-3 space-y-1">
                <p className="text-[10px] font-semibold text-accent">Phase 3: Adaptive Synthesis</p>
                <p className="text-[9px] text-muted-foreground">
                  Consensus score calculated. Disagreements preserved as risk factors.
                  Appeal defense pre-generated from Red Team arguments.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-accent/20 bg-accent/5 p-2.5 text-center">
              <p className="text-[10px] text-accent font-medium">
                Output: Enriched determination with consensus score, risk map, and pre-built appeal defense
              </p>
            </div>
          </div>

          <FlowConnector label="Enriched output flows back into the existing pipeline" />

          {/* ── STAGE 4: Output / Downstream ── */}
          <SectionHeader
            icon={<Zap className="h-3.5 w-3.5 text-consensus" />}
            title="Stage 4 — Enhanced Output (Existing Systems, Better Data)"
            subtitle="Same tools, dramatically better results"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <PipelineStep
              icon={<BarChart3 className="h-4 w-4 text-consensus" />}
              title="Virtuoso Analytics"
              desc="Now includes appeal-resilience metrics and consensus confidence scores from SOUPY."
              tag="Enhanced"
              tagColor="bg-consensus/10 text-consensus border-consensus/30"
            />
            <PipelineStep
              icon={<FileText className="h-4 w-4 text-consensus" />}
              title="Appeal Portal"
              desc="Pre-built defense letters generated at determination time — ready before appeal is filed."
              tag="New Capability"
              tagColor="bg-accent/10 text-accent border-accent/30"
            />
            <PipelineStep
              icon={<Lock className="h-4 w-4 text-consensus" />}
              title="Audit Trail"
              desc="Complete reasoning transcript — every perspective, every dissent, every evidence citation."
              tag="New Capability"
              tagColor="bg-accent/10 text-accent border-accent/30"
            />
          </div>
        </CardContent>
      </Card>

      {/* Technical Integration Card */}
      <Card className="border bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Technical Integration Points</h2>
              <p className="text-xs text-muted-foreground">How SOUPY plugs in without touching existing infrastructure</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Integration */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">API Integration</span>
              </div>
              <div className="space-y-2">
                <div className="rounded-md bg-muted/50 p-2.5 font-mono text-[10px] text-muted-foreground">
                  <p className="text-foreground font-semibold mb-1">// ClaimsXten fires a flag →</p>
                  <p>POST /soupy/analyze</p>
                  <p className="text-muted-foreground">{'{'} claim_id, cpt_codes, icd_codes,</p>
                  <p className="text-muted-foreground">  clinical_notes, flag_reason {'}'}</p>
                  <p className="mt-2 text-foreground font-semibold">// SOUPY returns enriched data →</p>
                  <p>{'{'} consensus_score, risk_map,</p>
                  <p>  perspectives[4], appeal_defense,</p>
                  <p>  evidence_chain, recommendation {'}'}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Single REST endpoint. SOUPY receives flagged claims, returns enriched determinations.
                  Existing systems consume the response — no pipeline changes needed.
                </p>
              </div>
            </div>

            {/* Data Flow */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Data Access Pattern</span>
              </div>
              <div className="space-y-2 text-[10px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-consensus mt-0.5 shrink-0" />
                  <p><span className="text-foreground font-medium">Read-only access</span> to KnowledgePacks and Concept Libraries — SOUPY never writes to Lyric's content stores</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-consensus mt-0.5 shrink-0" />
                  <p><span className="text-foreground font-medium">Own database</span> for reasoning transcripts, consensus scores, and appeal artifacts</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-consensus mt-0.5 shrink-0" />
                  <p><span className="text-foreground font-medium">Event-driven</span> — triggered by ClaimsXten flags, not polling. Zero load when no claims are flagged.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-consensus mt-0.5 shrink-0" />
                  <p><span className="text-foreground font-medium">Horizontally scalable</span> — each analysis is stateless. Can process thousands of claims in parallel.</p>
                </div>
              </div>
            </div>

            {/* Deployment */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Deployment Options</span>
              </div>
              <div className="space-y-2 text-[10px] text-muted-foreground">
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-primary flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  </div>
                  <p><span className="text-foreground font-medium">Cloud (Recommended)</span> — Deployed in Lyric's existing cloud VPC. HIPAA-compliant. Data never leaves the boundary.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground flex items-center justify-center shrink-0 mt-0.5" />
                  <p><span className="text-foreground font-medium">On-Premise</span> — Containerized deployment for air-gapped environments. Same API surface.</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground flex items-center justify-center shrink-0 mt-0.5" />
                  <p><span className="text-foreground font-medium">Hybrid</span> — Reasoning engine on-prem, analytics and reporting in cloud.</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold">Integration Timeline</span>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono font-bold text-accent w-14 shrink-0">Week 1-2</div>
                  <div className="flex-1 h-2 rounded-full bg-accent/20 overflow-hidden">
                    <div className="h-full w-full bg-accent rounded-full" />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">API Connection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono font-bold text-accent w-14 shrink-0">Week 3-4</div>
                  <div className="flex-1 h-2 rounded-full bg-accent/20 overflow-hidden">
                    <div className="h-full w-3/4 bg-accent rounded-full" />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">Content Library Sync</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono font-bold text-primary w-14 shrink-0">Week 5-6</div>
                  <div className="flex-1 h-2 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full w-1/2 bg-primary rounded-full" />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">Parallel Testing</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-mono font-bold text-consensus w-14 shrink-0">Week 7-8</div>
                  <div className="flex-1 h-2 rounded-full bg-consensus/20 overflow-hidden">
                    <div className="h-full w-1/4 bg-consensus rounded-full" />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-24 shrink-0">Production Rollout</span>
                </div>
                <p className="text-[9px] text-muted-foreground italic mt-1">
                  8 weeks from contract to production. No re-architecture. No migration.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom CTA */}
      <div className="rounded-lg border-2 border-dashed border-accent/20 bg-accent/5 p-4 text-center">
        <p className="text-sm font-semibold text-foreground mb-1">
          The shortest path to adversarial intelligence in production.
        </p>
        <p className="text-[11px] text-muted-foreground max-w-xl mx-auto">
          SOUPY plugs into Lyric's existing pipeline with a single API endpoint. No re-architecture, no data migration,
          no disruption to current operations. The reasoning engine runs alongside — enriching every determination 
          with multi-perspective depth that no competitor offers.
        </p>
      </div>
    </div>
  );
}
