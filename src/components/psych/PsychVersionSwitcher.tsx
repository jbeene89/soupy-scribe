import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, ArrowUp, ArrowDown, Minus, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PsychAuditResult } from '@/lib/psychTypes';

export interface PsychCaseVersion {
  version: number;
  createdAt: string; // ISO
  result: PsychAuditResult;
  addedDocLabel?: string; // What document was added to create this version (undefined for v1)
}

interface PsychVersionSwitcherProps {
  versions: PsychCaseVersion[];
  activeVersion: number;
  onSelectVersion: (version: number) => void;
}

export function PsychVersionSwitcher({ versions, activeVersion, onSelectVersion }: PsychVersionSwitcherProps) {
  if (versions.length <= 1) return null;

  const active = versions.find((v) => v.version === activeVersion) ?? versions[versions.length - 1];
  const previous = versions.find((v) => v.version === active.version - 1);
  const latest = versions[versions.length - 1];

  const scoreDelta = previous ? active.result.score - previous.result.score : 0;
  const failsActive = active.result.checklist.filter((c) => c.status === 'fail').length;
  const failsPrev = previous ? previous.result.checklist.filter((c) => c.status === 'fail').length : failsActive;
  const failsDelta = failsActive - failsPrev;

  return (
    <Card className="border-violet-500/30 bg-violet-500/5">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Left: Version selector */}
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-medium text-foreground">Audit history</span>
            <Select
              value={String(activeVersion)}
              onValueChange={(v) => onSelectVersion(Number(v))}
            >
              <SelectTrigger className="h-7 text-xs w-auto min-w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[...versions].reverse().map((v) => (
                  <SelectItem key={v.version} value={String(v.version)} className="text-xs">
                    <div className="flex items-center gap-2">
                      <span>v{v.version}</span>
                      {v.version === latest.version && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">latest</Badge>
                      )}
                      <span className="text-muted-foreground text-[10px]">
                        · score {v.result.score}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {active.version !== latest.version && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[10px]"
                onClick={() => onSelectVersion(latest.version)}
              >
                Jump to latest
              </Button>
            )}
          </div>

          {/* Right: Delta vs previous version */}
          {previous && (
            <div className="flex items-center gap-3 text-[11px]">
              <DeltaIndicator
                label="Score"
                delta={scoreDelta}
                positiveIsGood={true}
                value={`${previous.result.score} → ${active.result.score}`}
              />
              <DeltaIndicator
                label="Issues"
                delta={failsDelta}
                positiveIsGood={false}
                value={`${failsPrev} → ${failsActive}`}
              />
            </div>
          )}
        </div>

        {/* What changed */}
        {active.addedDocLabel && (
          <div className="mt-2 pt-2 border-t border-violet-500/20 flex items-start gap-2">
            <FileText className="h-3 w-3 text-violet-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground">v{active.version}</span> added:{' '}
              <span className="font-medium">{active.addedDocLabel}</span>
              {active.createdAt && (
                <span className="text-muted-foreground/70"> · {formatRelative(active.createdAt)}</span>
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeltaIndicator({
  label,
  delta,
  positiveIsGood,
  value,
}: {
  label: string;
  delta: number;
  positiveIsGood: boolean;
  value: string;
}) {
  const isGood = positiveIsGood ? delta > 0 : delta < 0;
  const isBad = positiveIsGood ? delta < 0 : delta > 0;
  const color = delta === 0 ? 'text-muted-foreground' : isGood ? 'text-emerald-500' : 'text-destructive';
  const Icon = delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground tabular-nums">{value}</span>
      <Icon className={cn('h-3 w-3', color)} />
      <span className={cn('font-semibold tabular-nums', color)}>
        {delta > 0 ? '+' : ''}{delta}
      </span>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}
