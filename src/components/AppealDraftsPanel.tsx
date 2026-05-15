import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthGate } from '@/components/AuthGate';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ROLE_META, type AuditCase, type CodeViolation, type SOUPYRole } from '@/lib/types';
import {
  generateAppealDrafts,
  type AppealDraft,
  type AppealDraftsBundle,
} from '@/lib/appealDraftService';
import {
  FileText, Sparkles, RefreshCw, Copy, Download, Activity, ShieldAlert,
  ChevronDown, ChevronUp, Lightbulb, Network,
} from 'lucide-react';

interface AppealDraftsPanelProps {
  auditCase: AuditCase;
  isLiveCase: boolean;
  initialBundle?: AppealDraftsBundle | null;
}

const ROLE_ORDER: SOUPYRole[] = ['builder', 'redteam', 'analyst', 'breaker'];

const ROLE_ICON: Record<SOUPYRole, any> = {
  builder: Lightbulb,
  redteam: ShieldAlert,
  analyst: Network,
  breaker: Sparkles,
};

function dedupeViolations(auditCase: AuditCase): Array<{ key: string; v: CodeViolation }> {
  const seen = new Map<string, CodeViolation>();
  for (const a of auditCase.analyses) {
    for (const v of (a.violations || [])) {
      const key = `${v.code}|${v.type}`;
      if (!seen.has(key)) seen.set(key, v);
    }
  }
  return Array.from(seen.entries()).map(([key, v]) => ({ key, v }));
}

export function AppealDraftsPanel({ auditCase, isLiveCase, initialBundle }: AppealDraftsPanelProps) {
  const [bundle, setBundle] = useState<AppealDraftsBundle | null>(initialBundle || null);
  const [running, setRunning] = useState<'all' | string | null>(null);

  const violations = useMemo(() => dedupeViolations(auditCase), [auditCase]);

  const runGeneration = async (opts: { all?: boolean; key?: string; regenerate?: boolean }) => {
    if (!isLiveCase) {
      toast.error('Appeal drafts can only be generated for live cases stored in the backend.');
      return;
    }
    const label = opts.all ? 'all' : opts.key!;
    setRunning(label);
    try {
      const result = await generateAppealDrafts(auditCase.id, {
        regenerate: !!opts.regenerate,
        violationIds: opts.key ? [opts.key, violations.find(x => x.key === opts.key)?.v.id || ''] : undefined,
      });
      setBundle(result);
      toast.success(opts.all ? 'Appeal drafts generated' : 'Draft generated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Draft generation failed');
    } finally {
      setRunning(null);
    }
  };

  if (violations.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-2">
        <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground">No flagged violations to draft</p>
        <p className="text-xs text-muted-foreground">
          Run the SOUPY analysis to surface coding violations, then return here to auto-generate appeal defense drafts.
        </p>
      </div>
    );
  }

  const drafts = bundle?.drafts || {};
  const draftedCount = Object.keys(drafts).length;

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary/40">
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Auto-Generated Appeal Defense Drafts
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              One draft per flagged violation, with a role-specific rationale from each SOUPY perspective.
              {' '}{draftedCount} of {violations.length} drafted.
            </p>
          </div>
          <AuthGate>
            <Button
              size="sm"
              onClick={() => runGeneration({ all: true, regenerate: false })}
              disabled={running !== null || !isLiveCase}
              className="gap-1.5"
            >
              {running === 'all'
                ? <><Activity className="h-3.5 w-3.5 animate-spin" />Drafting…</>
                : <><Sparkles className="h-3.5 w-3.5" />Generate Missing</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => runGeneration({ all: true, regenerate: true })}
              disabled={running !== null || !isLiveCase}
              className="gap-1.5 ml-2"
            >
              <RefreshCw className="h-3.5 w-3.5" />Regenerate All
            </Button>
          </AuthGate>
        </CardContent>
      </Card>

      {!isLiveCase && (
        <Card className="border-disagreement/30 bg-disagreement/5">
          <CardContent className="py-2.5 px-3">
            <p className="text-[11px] text-muted-foreground">
              This case is in demo mode. Auto-drafting is disabled until the case is saved to the backend.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {violations.map(({ key, v }) => (
          <ViolationDraftCard
            key={key}
            violation={v}
            draft={drafts[key]}
            onGenerate={() => runGeneration({ key, regenerate: false })}
            onRegenerate={() => runGeneration({ key, regenerate: true })}
            isRunning={running === key}
            disabled={running !== null || !isLiveCase}
          />
        ))}
      </div>
    </div>
  );
}

function ViolationDraftCard({
  violation, draft, onGenerate, onRegenerate, isRunning, disabled,
}: {
  violation: CodeViolation;
  draft?: AppealDraft;
  onGenerate: () => void;
  onRegenerate: () => void;
  isRunning: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const sevColor =
    violation.severity === 'critical' ? 'border-violation/30 text-violation' :
    violation.severity === 'warning' ? 'border-disagreement/30 text-disagreement' :
    'border-info-blue/30 text-info-blue';

  const copyAll = () => {
    if (!draft) return;
    const text = formatDraftAsText(violation, draft);
    navigator.clipboard.writeText(text);
    toast.success('Draft copied to clipboard');
  };

  const downloadTxt = () => {
    if (!draft) return;
    const text = formatDraftAsText(violation, draft);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `appeal-${violation.code}-${violation.type}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={cn('border-l-2', draft ? 'border-l-primary/40' : 'border-l-muted')}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start gap-2 flex-wrap">
          <Badge variant="outline" className="font-mono text-[10px]">{violation.code}</Badge>
          <Badge variant="outline" className="text-[9px] capitalize">{violation.type.replace(/-/g, ' ')}</Badge>
          <Badge variant="outline" className={cn('text-[9px] capitalize', sevColor)}>{violation.severity}</Badge>
          {draft && (
            <Badge variant="outline" className="text-[9px] border-consensus/30 text-consensus">
              Drafted · {draft.confidence}%
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            {draft && (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyAll}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={downloadTxt}>
                  <Download className="h-3 w-3" />
                </Button>
              </>
            )}
            <AuthGate>
              {draft ? (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onRegenerate} disabled={disabled}>
                  {isRunning ? <Activity className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate
                </Button>
              ) : (
                <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={onGenerate} disabled={disabled}>
                  {isRunning ? <Activity className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Generate Draft
                </Button>
              )}
            </AuthGate>
          </div>
        </div>
        <CardTitle className="text-xs font-normal text-foreground leading-snug pt-1">
          {violation.description}
        </CardTitle>
        {violation.regulationRef && (
          <p className="text-[10px] text-muted-foreground">Cited: {violation.regulationRef}</p>
        )}
      </CardHeader>

      {draft && (
        <CardContent className="pt-0 pb-3 px-4">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? 'Hide draft' : 'View draft, role rationales & evidence'}
          </button>

          {open && (
            <div className="mt-3 animate-fade-in">
              <Tabs defaultValue="letter" className="space-y-2">
                <TabsList className="h-8">
                  <TabsTrigger value="letter" className="text-[11px]">Letter</TabsTrigger>
                  <TabsTrigger value="roles" className="text-[11px]">Role Rationales</TabsTrigger>
                  <TabsTrigger value="evidence" className="text-[11px]">Evidence</TabsTrigger>
                  <TabsTrigger value="rebuttal" className="text-[11px]">Rebuttal</TabsTrigger>
                </TabsList>

                <TabsContent value="letter">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-sans text-foreground">
                      {draft.letterBody}
                    </pre>
                  </div>
                  {draft.keyAuthorities?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                        Key Authorities
                      </p>
                      <ul className="space-y-0.5">
                        {draft.keyAuthorities.map((a, i) => (
                          <li key={i} className="text-[11px] text-muted-foreground">• {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="roles" className="space-y-2">
                  {ROLE_ORDER.map(role => {
                    const Icon = ROLE_ICON[role];
                    const text = draft.roleRationales?.[role];
                    if (!text) return null;
                    return (
                      <div key={role} className="rounded-md border bg-card p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[11px] font-semibold">{ROLE_META[role].label}</p>
                          <span className="text-[10px] text-muted-foreground">— {ROLE_META[role].description}</span>
                        </div>
                        <p className="text-[11px] text-foreground leading-relaxed">{text}</p>
                      </div>
                    );
                  })}
                </TabsContent>

                <TabsContent value="evidence">
                  <div className="rounded-md border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                      Attach to appeal packet
                    </p>
                    <ul className="space-y-1">
                      {draft.supportingEvidence.map((e, i) => (
                        <li key={i} className="text-[11px] text-foreground flex gap-2">
                          <span className="text-muted-foreground">{i + 1}.</span>
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="rebuttal">
                  <div className="rounded-md border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                      Anticipated payer counter & response
                    </p>
                    <p className="text-[11px] text-foreground leading-relaxed">{draft.rebuttalToPayer}</p>
                  </div>
                </TabsContent>
              </Tabs>

              <p className="text-[10px] text-muted-foreground mt-2">
                Generated {new Date(draft.generatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function formatDraftAsText(violation: CodeViolation, draft: AppealDraft): string {
  const lines: string[] = [];
  lines.push(`APPEAL DEFENSE DRAFT`);
  lines.push(`Code: ${violation.code}  |  Type: ${violation.type}  |  Severity: ${violation.severity}`);
  if (violation.regulationRef) lines.push(`Cited: ${violation.regulationRef}`);
  lines.push(`Confidence: ${draft.confidence}%`);
  lines.push('');
  lines.push('--- LETTER ---');
  lines.push(draft.letterBody);
  lines.push('');
  lines.push('--- ROLE RATIONALES ---');
  for (const r of ROLE_ORDER) {
    const t = draft.roleRationales?.[r];
    if (t) {
      lines.push(`[${ROLE_META[r].label}]`);
      lines.push(t);
      lines.push('');
    }
  }
  lines.push('--- SUPPORTING EVIDENCE ---');
  draft.supportingEvidence.forEach((e, i) => lines.push(`${i + 1}. ${e}`));
  lines.push('');
  lines.push('--- ANTICIPATED PAYER REBUTTAL ---');
  lines.push(draft.rebuttalToPayer);
  if (draft.keyAuthorities?.length) {
    lines.push('');
    lines.push('--- KEY AUTHORITIES ---');
    draft.keyAuthorities.forEach(a => lines.push(`• ${a}`));
  }
  return lines.join('\n');
}