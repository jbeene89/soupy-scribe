import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Stethoscope, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DualRiskNarrative } from '@/lib/psychTypes';

/**
 * Renders the SAFETY lens (suicide risk) and BILLING lens (medical necessity)
 * side by side. The whole point: never let one drive the other.
 */
export function DualRiskCard({ dual }: { dual: DualRiskNarrative }) {
  const safety = SAFETY_STYLES[dual.suicide.level];
  const need = NECESSITY_STYLES[dual.necessity.level];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-violet-500" />
          Risk Assessment — Two Separate Lenses
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Combined narrative */}
        <p className="text-xs text-foreground leading-relaxed bg-secondary/40 rounded-md px-3 py-2">
          {dual.combinedNarrative}
        </p>

        {/* Cross-contamination guardrail */}
        {dual.crossContaminationFlag && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              <span className="font-semibold">Reasoning check: </span>{dual.crossContaminationReason}
            </p>
          </div>
        )}

        {/* Two side-by-side cards */}
        <div className="grid sm:grid-cols-2 gap-2">
          {/* SAFETY LENS */}
          <div className={cn('rounded-md border-l-4 p-3 space-y-1.5', safety.border, safety.bg)}>
            <div className="flex items-center gap-1.5">
              <Shield className={cn('h-3.5 w-3.5', safety.text)} />
              <p className="text-[11px] font-semibold text-foreground">Safety Lens</p>
              <Badge variant="outline" className="text-[9px]">Suicide Risk</Badge>
            </div>
            <p className={cn('text-sm font-bold capitalize', safety.text)}>
              {dual.suicide.level}
              {dual.suicide.inferred && <span className="text-[10px] text-muted-foreground font-normal ml-1">(no evidence in note)</span>}
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              <li className="flex justify-between"><span>Ideation</span><span className={dual.suicide.ideation ? 'text-destructive font-medium' : 'text-foreground/60'}>{dual.suicide.ideation ? 'Yes' : 'No'}</span></li>
              <li className="flex justify-between"><span>Plan</span><span className={dual.suicide.plan ? 'text-destructive font-medium' : 'text-foreground/60'}>{dual.suicide.plan ? 'Yes' : 'No'}</span></li>
              <li className="flex justify-between"><span>Intent</span><span className={dual.suicide.intent ? 'text-destructive font-medium' : 'text-foreground/60'}>{dual.suicide.intent ? 'Yes' : 'No'}</span></li>
              <li className="flex justify-between"><span>Safety plan</span><span className={dual.suicide.safetyPlanDocumented ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>{dual.suicide.safetyPlanDocumented ? 'Documented' : 'Not noted'}</span></li>
            </ul>
            {dual.suicide.protectiveFactors.length > 0 && (
              <p className="text-[10px] text-muted-foreground italic">
                Protective: {dual.suicide.protectiveFactors.join(', ')}
              </p>
            )}
            <p className="text-[9px] text-muted-foreground/80 italic flex items-start gap-1 pt-1 border-t">
              <Info className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              For patient safety + liability — does NOT drive billing level.
            </p>
          </div>

          {/* BILLING / NECESSITY LENS */}
          <div className={cn('rounded-md border-l-4 p-3 space-y-1.5', need.border, need.bg)}>
            <div className="flex items-center gap-1.5">
              <Stethoscope className={cn('h-3.5 w-3.5', need.text)} />
              <p className="text-[11px] font-semibold text-foreground">Billing Lens</p>
              <Badge variant="outline" className="text-[9px]">Medical Necessity</Badge>
            </div>
            <p className={cn('text-sm font-bold capitalize', need.text)}>
              {dual.necessity.level}
              {dual.necessity.inferred && <span className="text-[10px] text-muted-foreground font-normal ml-1">(no evidence in note)</span>}
            </p>
            {dual.necessity.scaleEvidence.filter(s => s.score != null).length > 0 && (
              <ul className="text-[11px] text-muted-foreground space-y-0.5">
                {dual.necessity.scaleEvidence.filter(s => s.score != null).map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{s.scale}</span>
                    <span className="font-medium text-foreground">{s.score}{s.severity ? ` · ${s.severity}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            {dual.necessity.symptomSeverity && (
              <p className="text-[11px] text-muted-foreground">
                Symptom severity: <span className="capitalize text-foreground">{dual.necessity.symptomSeverity}</span>
              </p>
            )}
            {dual.necessity.functionalImpairment && dual.necessity.functionalImpairment !== 'none' && (
              <p className="text-[11px] text-muted-foreground">
                Functional impairment: <span className="capitalize text-foreground">{dual.necessity.functionalImpairment}</span>
              </p>
            )}
            <p className="text-[9px] text-muted-foreground/80 italic flex items-start gap-1 pt-1 border-t">
              <Info className="h-2.5 w-2.5 mt-0.5 shrink-0" />
              For CPT-level support (e.g. 99213 vs 99214) — independent of suicide risk.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const SAFETY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  low:      { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400' },
  moderate: { border: 'border-l-amber-500',   bg: 'bg-amber-500/5',   text: 'text-amber-600 dark:text-amber-400' },
  high:     { border: 'border-l-destructive', bg: 'bg-destructive/5', text: 'text-destructive' },
};
const NECESSITY_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  mild:     { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-600 dark:text-emerald-400' },
  moderate: { border: 'border-l-blue-500',    bg: 'bg-blue-500/5',    text: 'text-blue-600 dark:text-blue-400' },
  severe:   { border: 'border-l-violet-500',  bg: 'bg-violet-500/5',  text: 'text-violet-600 dark:text-violet-400' },
};
