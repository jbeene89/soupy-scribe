import { useState, useMemo } from 'react';
import type { AuditCase } from '@/lib/types';
import type { EvidenceSufficiency, Contradiction } from '@/lib/soupyEngineService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ClipboardCheck, AlertTriangle, FileWarning, ShieldAlert } from 'lucide-react';

interface FixItem {
  id: string;
  label: string;
  detail: string;
  source: 'contradiction' | 'evidence' | 'risk' | 'analysis';
  severity: 'critical' | 'high' | 'medium';
}

interface FixBeforeSubmissionChecklistProps {
  auditCase: AuditCase;
  evidenceSuff: EvidenceSufficiency | null;
  contradictions: Contradiction[];
}

function extractFixItems(
  auditCase: AuditCase,
  evidenceSuff: EvidenceSufficiency | null,
  contradictions: Contradiction[],
): FixItem[] {
  const items: FixItem[] = [];

  // From contradictions
  contradictions.forEach((c, i) => {
    items.push({
      id: `contradiction-${i}`,
      label: `Resolve ${c.contradiction_type.replace(/_/g, ' ')} contradiction`,
      detail: c.description,
      source: 'contradiction',
      severity: c.severity === 'critical' ? 'critical' : 'high',
    });
  });

  // From missing evidence
  if (evidenceSuff) {
    evidenceSuff.missing_evidence.forEach((m, i) => {
      items.push({
        id: `evidence-${i}`,
        label: `Add missing: ${m.item}`,
        detail: m.impact || 'Required to reach defensible evidence threshold',
        source: 'evidence',
        severity: i < 2 ? 'high' : 'medium',
      });
    });

    if (!evidenceSuff.is_defensible) {
      items.push({
        id: 'evidence-overall',
        label: 'Strengthen overall evidence package',
        detail: `Current score ${Math.round(evidenceSuff.overall_score)}/100 — below defensible threshold. Address the missing items above to improve.`,
        source: 'evidence',
        severity: 'high',
      });
    }
  }

  // From AI analysis violations
  auditCase.analyses.forEach((analysis) => {
    const violations = analysis.violations || [];
    violations.forEach((v: any, i: number) => {
      const desc = typeof v === 'string' ? v : v.description || v.rule || JSON.stringify(v);
      if (desc && !items.some(item => item.detail === desc)) {
        items.push({
          id: `analysis-${analysis.role}-${i}`,
          label: `Address ${analysis.role} finding`,
          detail: desc,
          source: 'analysis',
          severity: (v.severity === 'critical' || analysis.confidence < 40) ? 'critical' : 'medium',
        });
      }
    });
  });

  // From high risk score
  if (auditCase.riskScore.score > 70) {
    items.push({
      id: 'risk-overall',
      label: 'Reduce overall risk score',
      detail: `Risk score is ${auditCase.riskScore.score}/100. Review documentation completeness, code-diagnosis alignment, and modifier usage.`,
      source: 'risk',
      severity: auditCase.riskScore.score > 85 ? 'critical' : 'high',
    });
  }

  // Sort: critical first, then high, then medium
  const order = { critical: 0, high: 1, medium: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity]);

  return items;
}

const SEVERITY_STYLES = {
  critical: { badge: 'destructive' as const, dot: 'bg-violation' },
  high: { badge: 'default' as const, dot: 'bg-disagreement' },
  medium: { badge: 'outline' as const, dot: 'bg-muted-foreground' },
};

const SOURCE_ICONS = {
  contradiction: AlertTriangle,
  evidence: FileWarning,
  risk: ShieldAlert,
  analysis: ClipboardCheck,
};

export function FixBeforeSubmissionChecklist({
  auditCase,
  evidenceSuff,
  contradictions,
}: FixBeforeSubmissionChecklistProps) {
  const fixItems = useMemo(
    () => extractFixItems(auditCase, evidenceSuff, contradictions),
    [auditCase, evidenceSuff, contradictions],
  );

  const [checked, setChecked] = useState<Set<string>>(new Set());

  if (fixItems.length === 0) return null;

  const progress = fixItems.length > 0 ? Math.round((checked.size / fixItems.length) * 100) : 0;
  const criticalCount = fixItems.filter(i => i.severity === 'critical').length;
  const checkedCritical = fixItems.filter(i => i.severity === 'critical' && checked.has(i.id)).length;

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <Card className="border-disagreement/30">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-disagreement" />
            Fix Before Submission ({checked.size}/{fixItems.length})
          </CardTitle>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {criticalCount - checkedCritical} critical remaining
            </Badge>
          )}
        </div>
        <Progress value={progress} className="h-1.5 mt-2" />
      </CardHeader>
      <CardContent className="pb-4 space-y-2">
        {fixItems.map((item) => {
          const Icon = SOURCE_ICONS[item.source];
          const isChecked = checked.has(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-md border p-3 flex items-start gap-3 transition-all cursor-pointer",
                isChecked
                  ? "bg-muted/30 border-muted opacity-60"
                  : item.severity === 'critical'
                    ? "border-violation/20 bg-violation/5"
                    : "border-border"
              )}
              onClick={() => toggle(item.id)}
            >
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => toggle(item.id)}
                className="mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className={cn(
                    "text-xs font-medium",
                    isChecked && "line-through text-muted-foreground"
                  )}>
                    {item.label}
                  </span>
                  <Badge
                    variant={SEVERITY_STYLES[item.severity].badge}
                    className="text-[9px] px-1.5 py-0 ml-auto shrink-0"
                  >
                    {item.severity}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
