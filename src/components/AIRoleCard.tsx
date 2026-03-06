import { cn } from '@/lib/utils';
import type { AIRoleAnalysis, SOUPYRole } from '@/lib/types';
import { ROLE_META } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb, ShieldAlert, Network, Sparkles, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { CPTCodeBadge } from './CPTCodeBadge';

const roleIcons: Record<SOUPYRole, React.ElementType> = {
  builder: Lightbulb,
  redteam: ShieldAlert,
  analyst: Network,
  breaker: Sparkles,
};

const roleIconBg: Record<SOUPYRole, string> = {
  builder: 'bg-role-builder/10',
  redteam: 'bg-role-redteam/10',
  analyst: 'bg-role-analyst/10',
  breaker: 'bg-role-breaker/10',
};

const roleCardClass: Record<SOUPYRole, string> = {
  builder: 'card-role-builder',
  redteam: 'card-role-redteam',
  analyst: 'card-role-analyst',
  breaker: 'card-role-breaker',
};

const severityConfig = {
  critical: { icon: XCircle, className: 'text-severity-critical', badge: 'bg-violation/15 text-violation border-violation/30' },
  warning: { icon: AlertTriangle, className: 'text-severity-warning', badge: 'bg-disagreement/15 text-disagreement border-disagreement/30' },
  info: { icon: CheckCircle, className: 'text-severity-info', badge: 'bg-info-blue/15 text-info-blue border-info-blue/30' },
};

interface AIRoleCardProps {
  analysis: AIRoleAnalysis;
  staggerIndex: number;
}

export function AIRoleCard({ analysis, staggerIndex }: AIRoleCardProps) {
  const meta = ROLE_META[analysis.role];
  const Icon = roleIcons[analysis.role];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card shadow-sm animate-fade-in opacity-0',
        roleCardClass[analysis.role],
        analysis.status === 'analyzing' && 'animate-pulse-border',
      )}
      style={{ animationDelay: `${staggerIndex * 120}ms`, animationFillMode: 'forwards' }}
    >
      {/* Header */}
      <div className="p-4 pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-md', roleIconBg[analysis.role])}>
            <Icon className="h-5 w-5" style={{ color: `hsl(var(--${meta.color}))` }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{meta.label}</h3>
              <Badge variant="outline" className="text-[10px] font-mono">{analysis.model}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
          </div>
          {analysis.status === 'complete' && (
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <p className="font-mono text-sm font-semibold">{analysis.confidence}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Perspective Statement */}
      <div className="px-4 py-3 border-b bg-muted/30">
        <p className="text-sm italic text-muted-foreground leading-relaxed">"{analysis.perspectiveStatement}"</p>
      </div>

      {/* Key Insights */}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Key Insights</p>
          <ul className="space-y-1.5">
            {analysis.keyInsights.map((insight, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-accent mt-0.5 shrink-0">→</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        {analysis.assumptions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Assumptions</p>
            <ul className="space-y-1">
              {analysis.assumptions.map((a, i) => (
                <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-disagreement">⚠</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Violations */}
        {analysis.violations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Code Findings ({analysis.violations.length})
            </p>
            <Accordion type="multiple" className="space-y-2">
              {analysis.violations.map(v => {
                const sev = severityConfig[v.severity];
                const SevIcon = sev.icon;
                const roleDefense = v.defenses.find(d => d.role === analysis.role);
                return (
                  <AccordionItem key={v.id} value={v.id} className="border rounded-md">
                    <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                      <div className="flex items-center gap-2 text-left">
                        <SevIcon className={cn('h-4 w-4 shrink-0', sev.className)} />
                        <CPTCodeBadge code={v.code} />
                        <span className="text-xs">{v.description.slice(0, 60)}...</span>
                        <Badge variant="outline" className={cn('text-[10px] ml-auto', sev.badge)}>
                          {v.severity}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 space-y-2">
                      <p className="text-sm text-muted-foreground">{v.description}</p>
                      <p className="text-xs font-mono text-muted-foreground">Ref: {v.regulationRef}</p>
                      {roleDefense && (
                        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Defense Strategy</span>
                            <Badge variant="outline" className={cn('text-[10px]',
                              roleDefense.strength >= 60 ? 'bg-consensus/15 text-consensus border-consensus/30' :
                              roleDefense.strength >= 40 ? 'bg-disagreement/15 text-disagreement border-disagreement/30' :
                              'bg-violation/15 text-violation border-violation/30'
                            )}>
                              {roleDefense.strength}%
                            </Badge>
                          </div>
                          <p className="text-sm">{roleDefense.strategy}</p>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        )}

        {/* Overall Assessment */}
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Assessment</p>
          <p className="text-sm">{analysis.overallAssessment}</p>
        </div>
      </div>
    </div>
  );
}
