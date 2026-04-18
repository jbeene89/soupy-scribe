import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Stethoscope, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoteStandardizedScale } from '@/lib/crosswalkTypes';

/**
 * Surfaces standardized psychiatric rating scales (PHQ-9, GAD-7, Y-BOCS, PCL-5,
 * CAPS-5, MDQ, ASRS, etc.) at-a-glance, instead of leaving them buried in raw JSON.
 *
 * Severity bands are color-coded; clinician-administered scales get a ribbon
 * indicating they outweigh self-report.
 */
export function StandardizedScalesPanel({
  scales,
  compact = false,
}: {
  scales?: NoteStandardizedScale[] | null;
  /** Compact = inline strip suitable for the TL;DR card. Full = standalone Card. */
  compact?: boolean;
}) {
  if (!Array.isArray(scales) || scales.length === 0) return null;

  // Sort: clinician-administered first, then by score desc
  const ordered = [...scales].sort((a, b) => {
    const aClinic = a.type === 'clinician-administered' ? 0 : 1;
    const bClinic = b.type === 'clinician-administered' ? 0 : 1;
    if (aClinic !== bClinic) return aClinic - bClinic;
    return (b.score ?? 0) - (a.score ?? 0);
  });

  if (compact) {
    return (
      <div className="rounded-md border border-indigo-500/20 bg-indigo-500/5 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <ClipboardCheck className="h-3.5 w-3.5 text-indigo-500" />
          <p className="text-[11px] font-semibold text-foreground">Standardized scale evidence</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ordered.map((s, i) => (
            <ScaleChip key={`${s.scale}-${i}`} scale={s} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="py-4 px-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <ClipboardCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Standardized rating scales</p>
            <p className="text-[11px] text-muted-foreground">
              Validated scale scores override narrative severity. Clinician-administered scales outweigh self-report.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          {ordered.map((s, i) => (
            <ScaleRow key={`${s.scale}-${i}`} scale={s} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function severityTone(severity?: string | null): string {
  const v = (severity || '').toLowerCase();
  if (!v) return 'bg-muted text-muted-foreground border-border';
  if (v.includes('severe') || v.includes('extreme') || v.includes('positive screen')) {
    return 'bg-destructive/10 text-destructive border-destructive/30';
  }
  if (v.includes('moderate')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
  if (v.includes('mild') || v.includes('threshold')) return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
  if (v.includes('minimal') || v.includes('subclinical') || v.includes('negative')) {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function ScaleChip({ scale }: { scale: NoteStandardizedScale }) {
  const isClinician = scale.type === 'clinician-administered';
  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]', severityTone(scale.severity))}>
      <span className="font-mono font-semibold">{scale.scale}</span>
      {scale.score != null && <span className="font-mono">= {scale.score}</span>}
      {scale.severity && <span className="font-medium">· {scale.severity}</span>}
      {isClinician && (
        <Stethoscope className="h-2.5 w-2.5 ml-0.5" aria-label="Clinician-administered" />
      )}
    </div>
  );
}

function ScaleRow({ scale }: { scale: NoteStandardizedScale }) {
  const isClinician = scale.type === 'clinician-administered';
  return (
    <div className="rounded-md border bg-background/60 p-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-bold text-foreground">{scale.scale}</span>
          {scale.score != null && (
            <span className="font-mono text-sm text-foreground">= {scale.score}</span>
          )}
          {scale.severity && (
            <Badge variant="outline" className={cn('text-[10px]', severityTone(scale.severity))}>
              {scale.severity}
            </Badge>
          )}
          <Badge variant="outline" className="text-[9px] flex items-center gap-1">
            {isClinician ? (
              <>
                <Stethoscope className="h-2.5 w-2.5" /> Clinician-administered
              </>
            ) : (
              <>
                <User className="h-2.5 w-2.5" /> Self-report
              </>
            )}
          </Badge>
        </div>
      </div>
      {scale.threshold_flag && (
        <p className="text-[11px] text-foreground mt-1.5 font-medium">⚑ {scale.threshold_flag}</p>
      )}
      {scale.evidence_quote && (
        <p className="text-[10px] text-muted-foreground mt-1 italic leading-snug">
          “{scale.evidence_quote}”
        </p>
      )}
    </div>
  );
}
