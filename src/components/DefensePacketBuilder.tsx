import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AuditCase } from '@/lib/types';
import type { EvidenceSufficiency, Contradiction, MinimalWinningPacket } from '@/lib/soupyEngineService';
import {
  buildDefensePacket,
  CLASSIFICATION_CONFIG,
  type DefensePacketSummary,
  type DefenseSupportItem,
  type SupportClassification,
} from '@/lib/defensePacketBuilder';
import {
  Shield, FileText, AlertTriangle, CheckCircle, XCircle, ChevronDown,
  ChevronUp, ArrowRight, Package, Target, TrendingDown, Eye,
} from 'lucide-react';

interface DefensePacketBuilderProps {
  auditCase: AuditCase;
  evidenceSuff?: EvidenceSufficiency | null;
  contradictions?: Contradiction[];
  winningPacket?: MinimalWinningPacket | null;
}

export function DefensePacketBuilder({
  auditCase, evidenceSuff, contradictions, winningPacket,
}: DefensePacketBuilderProps) {
  const packet = useMemo(() => buildDefensePacket(auditCase, {
    evidenceSuff, contradictions, winningPacket,
  }), [auditCase, evidenceSuff, contradictions, winningPacket]);

  if (packet.supportItems.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-3">
        <Package className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">No support items identified</p>
        <p className="text-xs text-muted-foreground">
          Run the full analysis to generate defense packet recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══ Disposition Banner ═══ */}
      <DispositionBanner packet={packet} />

      {/* ═══ Summary Metrics ═══ */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <MetricCard label="Essential" value={packet.requiredCount} color="text-violation" />
        <MetricCard label="Supporting" value={packet.supportingCount} color="text-info-blue" />
        <MetricCard label="Low-Recovery" value={packet.lowValueCount} color="text-muted-foreground" />
        <MetricCard label="Non-Curable" value={packet.notCurableCount} color="text-destructive" />
        <MetricCard label="Defense Strength" value={`${packet.overallDefenseStrength}%`} color={
          packet.overallDefenseStrength >= 70 ? 'text-consensus' :
          packet.overallDefenseStrength >= 40 ? 'text-disagreement' : 'text-violation'
        } />
      </div>

      {/* ═══ Summary Notes ═══ */}
      {packet.summaryNotes.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="space-y-1.5">
              {packet.summaryNotes.map((note, i) => (
                <p key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/60" />
                  {note}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="space-y-3">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All Items ({packet.supportItems.length})</TabsTrigger>
          <TabsTrigger value="required">
            Essential ({packet.requiredCount})
          </TabsTrigger>
          <TabsTrigger value="services">
            Services at Risk ({packet.servicesAtRisk.length})
          </TabsTrigger>
          <TabsTrigger value="not-worth">
            Low-Recovery Value ({packet.lowValueCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-2">
          {packet.supportItems.map(item => (
            <SupportItemCard key={item.id} item={item} />
          ))}
        </TabsContent>

        <TabsContent value="required" className="space-y-2">
          {packet.supportItems
            .filter(i => i.classification === 'required_to_defend' || i.classification === 'human_review_required')
            .map(item => (
              <SupportItemCard key={item.id} item={item} />
            ))}
          {packet.requiredCount === 0 && packet.humanReviewCount === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No required items identified.</p>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-2">
          {packet.servicesAtRisk.map((svc, i) => (
            <ServiceAtRiskCard key={i} service={svc} />
          ))}
          {packet.servicesAtRisk.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No services at risk identified.</p>
          )}
        </TabsContent>

        <TabsContent value="not-worth" className="space-y-2">
          {packet.notWorthChasingItems.length > 0 ? (
            <>
              <Card className="border-muted">
                <CardContent className="py-3 px-4">
                  <p className="text-[11px] text-muted-foreground">
                    These items have been assessed as low-value for defense purposes. Effort to obtain them
                    likely exceeds potential benefit. Do not delay case resolution for these items.
                  </p>
                </CardContent>
              </Card>
              {packet.notWorthChasingItems.map(item => (
                <SupportItemCard key={item.id} item={item} />
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No low-value items identified.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───

function DispositionBanner({ packet }: { packet: DefensePacketSummary }) {
  const dispositionColor = {
    defend_as_billed: 'text-consensus border-consensus/30 bg-consensus/5',
    defend_with_packet: 'text-info-blue border-info-blue/30 bg-info-blue/5',
    downgrade_resubmit: 'text-disagreement border-disagreement/30 bg-disagreement/5',
    route_to_human: 'text-violation border-violation/30 bg-violation/5',
    appeal_not_recommended: 'text-destructive border-destructive/30 bg-destructive/5',
  }[packet.disposition];

  const DispositionIcon = {
    defend_as_billed: CheckCircle,
    defend_with_packet: Shield,
    downgrade_resubmit: TrendingDown,
    route_to_human: Eye,
    appeal_not_recommended: XCircle,
  }[packet.disposition];

  return (
    <Card className={cn('border-l-4', dispositionColor)}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          <DispositionIcon className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{packet.dispositionLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{packet.dispositionDescription}</p>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span>Defense Strength: <span className="font-semibold text-foreground">{packet.overallDefenseStrength}%</span></span>
              <span>•</span>
              <span>Curable: <span className="font-semibold text-foreground">{packet.curedIfObtainedEstimate}%</span></span>
              <span>•</span>
              <span>Items: <span className="font-semibold text-foreground">{packet.supportItems.length}</span></span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SupportItemCard({ item }: { item: DefenseSupportItem }) {
  const [expanded, setExpanded] = useState(false);
  const config = CLASSIFICATION_CONFIG[item.classification];

  return (
    <Card className={cn('border-l-2', config.borderClass)}>
      <CardContent className="py-2.5 px-3">
        <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {item.relatedCodes.map(c => (
                  <Badge key={c} variant="outline" className="font-mono text-[10px]">{c}</Badge>
                ))}
                <Badge variant="outline" className={cn('text-[9px]', config.colorClass, config.borderClass)}>
                  {config.label}
                </Badge>
                <Badge variant="outline" className="text-[9px]">{item.priority}</Badge>
              </div>
              <p className="text-xs text-foreground leading-snug">{item.issueDescription}</p>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                <span>Impact: <span className="font-semibold">{item.estimatedImpact}%</span></span>
                <span>•</span>
                <span className="capitalize">{item.obtainability.replace(/_/g, ' ')}</span>
                <span>•</span>
                <span className="capitalize">{item.curability.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <div className="shrink-0 mt-1">
              {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </div>
        </button>

        {expanded && (
          <div className="mt-2 pt-2 border-t border-border space-y-2 animate-fade-in">
            <DetailRow label="Required Documentation" value={item.requiredDocumentation} />
            <DetailRow label="Missing Evidence" value={item.missingEvidence} />
            <DetailRow label="Estimated Impact" value={item.estimatedImpactLabel} />
            <DetailRow label="Obtainability" value={item.obtainabilityLabel} />
            <DetailRow label="Curability" value={item.curabilityLabel} />
            <DetailRow label="Delay Resolution?" value={item.shouldDelayResolution ? 'Yes — obtain before finalizing' : 'No — do not hold case'} />
            <Separator />
            <div className="rounded-md border bg-muted/30 p-2">
              <p className="text-[10px] text-muted-foreground font-medium">Suggested Next Step</p>
              <p className="text-[11px] text-foreground mt-0.5">{item.suggestedNextStep}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceAtRiskCard({ service }: { service: { code: string; description: string; riskLevel: string; missingDocCount: number; primaryGap: string; recommendedAttachments: string[] } }) {
  const riskColor = service.riskLevel === 'high' ? 'text-violation border-violation/30' :
    service.riskLevel === 'medium' ? 'text-disagreement border-disagreement/30' : 'text-consensus border-consensus/30';

  return (
    <Card>
      <CardContent className="py-2.5 px-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant="outline" className="font-mono text-xs">{service.code}</Badge>
          <Badge variant="outline" className={cn('text-[9px] capitalize', riskColor)}>{service.riskLevel} risk</Badge>
          <span className="text-[10px] text-muted-foreground ml-auto">{service.missingDocCount} gap(s)</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Primary gap: {service.primaryGap}</p>
        {service.recommendedAttachments.length > 0 && (
          <div className="mt-1.5">
            <p className="text-[10px] text-muted-foreground font-medium">Recommended attachments:</p>
            <ul className="mt-0.5 space-y-0.5">
              {service.recommendedAttachments.map((a, i) => (
                <li key={i} className="text-[10px] text-muted-foreground">• {a}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-muted-foreground font-medium shrink-0 w-32">{label}</span>
      <span className="text-[11px] text-foreground">{value}</span>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5 text-center">
      <p className={cn('text-lg font-semibold font-mono', color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
