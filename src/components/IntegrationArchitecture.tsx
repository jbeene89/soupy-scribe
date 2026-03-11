import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  FileText,
  Shield,
  ArrowRight,
  ArrowDown,
  Plug,
  Server,
  Brain,
  Building2,
  Stethoscope,
  CheckCircle2,
  Layers,
  Search,
  BarChart3,
  Zap,
  BookOpen,
} from 'lucide-react';

interface IntegrationNodeProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  status: 'live' | 'ready' | 'planned';
  color: string;
  isLyric?: boolean;
}

function IntegrationNode({ icon, label, sub, status, color, isLyric }: IntegrationNodeProps) {
  const statusMap = {
    live: { label: 'Live', class: 'bg-consensus/10 text-consensus border-consensus/30' },
    ready: { label: 'Ready', class: 'bg-primary/10 text-primary border-primary/30' },
    planned: { label: 'Planned', class: 'bg-muted text-muted-foreground border-border' },
  };
  const s = statusMap[status];

  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5 relative group hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${color}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{label}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${s.class}`}>
          {s.label}
        </Badge>
        {isLyric && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
            Lyric Product
          </Badge>
        )}
      </div>
    </div>
  );
}

function FlowArrow({ direction = 'right', label }: { direction?: 'right' | 'down'; label?: string }) {
  if (direction === 'down') {
    return (
      <div className="flex flex-col items-center gap-0.5 py-1">
        <ArrowDown className="h-4 w-4 text-muted-foreground" />
        {label && <span className="text-[9px] text-muted-foreground">{label}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-0.5 px-1">
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      {label && <span className="text-[9px] text-muted-foreground whitespace-nowrap">{label}</span>}
    </div>
  );
}

export function IntegrationArchitecture() {
  return (
    <Card className="border bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Integration Architecture</h2>
            <p className="text-xs text-muted-foreground">
              SOUPY enhances every Lyric product — replaces none of them
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">Additive Layer</Badge>
        </div>

        <div className="space-y-6">
          {/* Row 1: Existing Lyric Products SOUPY enhances */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Existing Lyric Products (Enhanced by SOUPY)
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <IntegrationNode
                icon={<Shield className="h-3.5 w-3.5 text-primary" />}
                label="ClaimsXten"
                sub="SOUPY adds adversarial depth to edits"
                status="ready"
                color="bg-primary/10"
                isLyric
              />
              <IntegrationNode
                icon={<Search className="h-3.5 w-3.5 text-primary" />}
                label="Replay"
                sub="SOUPY adds multi-perspective reasoning"
                status="ready"
                color="bg-primary/10"
                isLyric
              />
              <IntegrationNode
                icon={<BarChart3 className="h-3.5 w-3.5 text-primary" />}
                label="Virtuoso"
                sub="SOUPY feeds appeal-resilience metrics"
                status="ready"
                color="bg-primary/10"
                isLyric
              />
              <IntegrationNode
                icon={<Database className="h-3.5 w-3.5 text-primary" />}
                label="ClaimShark"
                sub="SOUPY adds transparent reasoning trails"
                status="ready"
                color="bg-primary/10"
                isLyric
              />
            </div>
          </div>

          <FlowArrow direction="down" label="SOUPY enhances output from each product" />

          {/* Row 2: SOUPY Intelligence Layer */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                SOUPY Intelligence Layer (What's New)
              </span>
            </div>
            <div className="rounded-xl border-2 border-accent/30 bg-gradient-to-r from-accent/5 via-card to-primary/5 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                  <Brain className="h-5 w-5 text-accent mx-auto" />
                  <p className="text-xs font-semibold">Adversarial AI Reasoning</p>
                  <p className="text-[10px] text-muted-foreground">
                    4 models debate every determination — surfaces weaknesses before providers do
                  </p>
                  <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent border-accent/30">
                    New Capability
                  </Badge>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                  <FileText className="h-5 w-5 text-consensus mx-auto" />
                  <p className="text-xs font-semibold">Pre-Built Appeal Defense</p>
                  <p className="text-[10px] text-muted-foreground">
                    Both sides argued at determination — appeal response ready before it's filed
                  </p>
                  <Badge variant="outline" className="text-[9px] bg-consensus/10 text-consensus border-consensus/30">
                    New Capability
                  </Badge>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                  <Stethoscope className="h-5 w-5 text-primary mx-auto" />
                  <p className="text-xs font-semibold">Provider Compliance Module</p>
                  <p className="text-[10px] text-muted-foreground">
                    Same engine, compliance posture — providers pre-validate against audit-grade AI
                  </p>
                  <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                    New Revenue
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <FlowArrow direction="down" label="Also consumes data from Lyric content libraries" />

          {/* Row 3: Data Sources + Content */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data Sources & Content Libraries
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <IntegrationNode
                icon={<BookOpen className="h-3.5 w-3.5 text-primary" />}
                label="KnowledgePacks"
                sub="Clinical content feeds SOUPY context"
                status="ready"
                color="bg-primary/10"
                isLyric
              />
              <IntegrationNode
                icon={<FileText className="h-3.5 w-3.5 text-primary" />}
                label="Concept Libraries"
                sub="Policy content for reasoning"
                status="ready"
                color="bg-primary/10"
                isLyric
              />
              <IntegrationNode
                icon={<Database className="h-3.5 w-3.5 text-accent" />}
                label="LCD / NCD Databases"
                sub="CMS coverage determinations"
                status="ready"
                color="bg-accent/10"
              />
              <IntegrationNode
                icon={<Server className="h-3.5 w-3.5 text-muted-foreground" />}
                label="835/837 & HL7 FHIR"
                sub="Existing claim feeds"
                status="ready"
                color="bg-muted"
              />
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div className="mt-5 rounded-md border-2 border-dashed border-accent/20 bg-accent/5 p-3">
          <p className="text-[11px] text-foreground font-medium">
            Additive, not disruptive.
            <span className="text-muted-foreground font-normal ml-1">
              SOUPY consumes output from your existing products and adds adversarial intelligence,
              appeal defense, and provider revenue — new capabilities that extend the current portfolio.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
