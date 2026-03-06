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
  Circle,
  Layers,
} from 'lucide-react';

interface IntegrationNodeProps {
  icon: React.ReactNode;
  label: string;
  sub: string;
  status: 'live' | 'ready' | 'planned';
  color: string;
}

function IntegrationNode({ icon, label, sub, status, color }: IntegrationNodeProps) {
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
      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${s.class}`}>
        {s.label}
      </Badge>
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
              Plugs into existing infrastructure — no rip-and-replace required
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-[10px]">Enterprise Ready</Badge>
        </div>

        {/* Data Sources → SOUPY Engine → Outputs */}
        <div className="space-y-6">
          {/* Row 1: Data Ingestion */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data Ingestion Layer
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <IntegrationNode
                icon={<FileText className="h-3.5 w-3.5 text-primary" />}
                label="835/837 Claims Feeds"
                sub="Real-time claim ingestion"
                status="ready"
                color="bg-primary/10"
              />
              <IntegrationNode
                icon={<Server className="h-3.5 w-3.5 text-primary" />}
                label="HL7 FHIR / EHR"
                sub="Epic, Cerner, athenahealth"
                status="planned"
                color="bg-primary/10"
              />
              <IntegrationNode
                icon={<Database className="h-3.5 w-3.5 text-accent" />}
                label="LCD / NCD Databases"
                sub="CMS coverage determinations"
                status="ready"
                color="bg-accent/10"
              />
              <IntegrationNode
                icon={<Building2 className="h-3.5 w-3.5 text-accent" />}
                label="Payer Policy Libraries"
                sub="Internal medical policies"
                status="planned"
                color="bg-accent/10"
              />
            </div>
          </div>

          {/* Arrow down */}
          <FlowArrow direction="down" label="Normalized claim + clinical data" />

          {/* Row 2: Core Engine */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                SOUPY Intelligence Engine
              </span>
            </div>
            <div className="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-card to-accent/5 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                  <Shield className="h-5 w-5 text-primary mx-auto" />
                  <p className="text-xs font-semibold">ClaimsXten Enhancement</p>
                  <p className="text-[10px] text-muted-foreground">
                    AI reasoning on top of existing rules engine — catches what deterministic logic misses
                  </p>
                  <Badge variant="outline" className="text-[9px] bg-consensus/10 text-consensus border-consensus/30">
                    Direct Integration
                  </Badge>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                  <Layers className="h-5 w-5 text-accent mx-auto" />
                  <p className="text-xs font-semibold">Lyric 42 Pipeline</p>
                  <p className="text-[10px] text-muted-foreground">
                    Pre-submission validation — flag issues before they become audit targets
                  </p>
                  <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                    API Ready
                  </Badge>
                </div>
                <div className="rounded-lg border bg-card p-3 text-center space-y-1">
                  <Brain className="h-5 w-5 text-foreground mx-auto" />
                  <p className="text-xs font-semibold">Multi-Agent Debate</p>
                  <p className="text-[10px] text-muted-foreground">
                    4 adversarial AI roles stress-test every decision for defensibility
                  </p>
                  <Badge variant="outline" className="text-[9px] bg-consensus/10 text-consensus border-consensus/30">
                    Live
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow down */}
          <FlowArrow direction="down" label="Audit decisions + appeal packages + compliance signals" />

          {/* Row 3: Output Destinations */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-consensus" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Output Destinations
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <IntegrationNode
                icon={<Building2 className="h-3.5 w-3.5 text-primary" />}
                label="Payer Case Management"
                sub="Audit decisions + evidence"
                status="ready"
                color="bg-primary/10"
              />
              <IntegrationNode
                icon={<FileText className="h-3.5 w-3.5 text-accent" />}
                label="Appeal Portal Export"
                sub="Pre-built defense packages"
                status="ready"
                color="bg-accent/10"
              />
              <IntegrationNode
                icon={<Stethoscope className="h-3.5 w-3.5 text-consensus" />}
                label="Provider Dashboard"
                sub="Compliance coaching feed"
                status="live"
                color="bg-consensus/10"
              />
              <IntegrationNode
                icon={<Database className="h-3.5 w-3.5 text-muted-foreground" />}
                label="Data Warehouse / BI"
                sub="Pattern analytics export"
                status="planned"
                color="bg-muted"
              />
            </div>
          </div>
        </div>

        {/* Bottom note */}
        <div className="mt-5 rounded-md border-2 border-dashed border-primary/20 bg-primary/5 p-3">
          <p className="text-[11px] text-foreground font-medium">
            Zero infrastructure disruption.
            <span className="text-muted-foreground font-normal ml-1">
              SOUPY sits alongside existing systems as an intelligence layer — API-first architecture means integration in weeks, not quarters.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
