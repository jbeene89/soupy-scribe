import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Brain, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, FileDown, ClipboardCheck, Stethoscope } from 'lucide-react';
import type { PsychCaseInput, SessionType, PsychAuditResult } from '@/lib/psychTypes';
import { runPsychAudit } from '@/lib/psychAuditEngine';

const SESSION_TYPES: { value: SessionType; label: string }[] = [
  { value: 'individual_therapy', label: 'Individual Therapy' },
  { value: 'group_therapy', label: 'Group Therapy' },
  { value: 'family_therapy', label: 'Family / Couples Therapy' },
  { value: 'psych_testing', label: 'Psychological Testing' },
  { value: 'medication_management', label: 'Medication Management' },
  { value: 'crisis_intervention', label: 'Crisis Intervention' },
  { value: 'telehealth', label: 'Telehealth Session' },
  { value: 'intake_evaluation', label: 'Intake / Evaluation' },
];

const COMMON_CPT: Record<SessionType, string[]> = {
  individual_therapy: ['90834', '90837', '90832'],
  group_therapy: ['90853'],
  family_therapy: ['90847', '90846'],
  psych_testing: ['96130', '96131', '96136', '96137'],
  medication_management: ['99213', '99214', '90863'],
  crisis_intervention: ['90839', '90840'],
  telehealth: ['90834', '90837'],
  intake_evaluation: ['90791', '90792'],
};

const DEFAULT_INPUT: PsychCaseInput = {
  sessionType: 'individual_therapy',
  cptCode: '90834',
  diagnosisCodes: ['F33.1'],
  sessionDurationMinutes: 45,
  hasCurrentTreatmentPlan: true,
  hasAuthorizationOnFile: true,
  hasProgressNotes: true,
  hasMedicalNecessityStatement: true,
  placeOfService: '11',
  isTelehealth: false,
};

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warning' }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
}

export function PsychPracticeModule() {
  const [input, setInput] = useState<PsychCaseInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<PsychAuditResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleRunAudit = () => {
    const auditResult = runPsychAudit(input);
    setResult(auditResult);
    setActiveCategory(null);
  };

  const update = (partial: Partial<PsychCaseInput>) => setInput((prev) => ({ ...prev, ...partial }));

  const categories = result
    ? [...new Set(result.checklist.map((c) => c.category))]
    : [];

  const readinessColor = result?.overallReadiness === 'ready'
    ? 'text-emerald-500'
    : result?.overallReadiness === 'needs-attention'
    ? 'text-amber-500'
    : 'text-destructive';

  const readinessLabel = result?.overallReadiness === 'ready'
    ? 'Ready to Submit'
    : result?.overallReadiness === 'needs-attention'
    ? 'Needs Attention'
    : 'Not Ready — Fix Issues First';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Brain className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Behavioral Health Pre-Submission Audit</h1>
          <p className="text-xs text-muted-foreground">Check your session documentation before you file — catch denials before they happen.</p>
        </div>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Session Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Session Type */}
            <div className="space-y-1.5">
              <Label className="text-xs">Session Type</Label>
              <Select
                value={input.sessionType}
                onValueChange={(v) => {
                  const st = v as SessionType;
                  const codes = COMMON_CPT[st];
                  update({ sessionType: st, cptCode: codes[0] || '' });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CPT Code */}
            <div className="space-y-1.5">
              <Label className="text-xs">CPT Code</Label>
              <Select value={input.cptCode} onValueChange={(v) => update({ cptCode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_CPT[input.sessionType].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label className="text-xs">Session Duration (minutes)</Label>
              <Input
                type="number"
                value={input.sessionDurationMinutes}
                onChange={(e) => update({ sessionDurationMinutes: parseInt(e.target.value) || 0 })}
              />
            </div>

            {/* Place of Service */}
            <div className="space-y-1.5">
              <Label className="text-xs">Place of Service</Label>
              <Select value={input.placeOfService} onValueChange={(v) => update({ placeOfService: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="11">11 — Office</SelectItem>
                  <SelectItem value="10">10 — Telehealth (Patient Home)</SelectItem>
                  <SelectItem value="02">02 — Telehealth (Other)</SelectItem>
                  <SelectItem value="12">12 — Patient Home</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {[
              { key: 'hasCurrentTreatmentPlan', label: 'Current treatment plan on file' },
              { key: 'hasAuthorizationOnFile', label: 'Prior authorization obtained' },
              { key: 'hasProgressNotes', label: 'Progress notes completed' },
              { key: 'hasMedicalNecessityStatement', label: 'Medical necessity documented' },
              { key: 'isTelehealth', label: 'Telehealth session' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label className="text-xs">{label}</Label>
                <Switch
                  checked={input[key as keyof PsychCaseInput] as boolean}
                  onCheckedChange={(v) => update({ [key]: v })}
                />
              </div>
            ))}
          </div>

          <Button onClick={handleRunAudit} className="w-full">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Run Pre-Submission Check
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Score Overview */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className={cn('h-6 w-6', readinessColor)} />
                  <div>
                    <p className={cn('text-sm font-bold', readinessColor)}>{readinessLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.checklist.filter(c => c.status === 'fail').length} issues found · {result.checklist.filter(c => c.status === 'warning').length} warnings
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">{result.score}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
                </div>
              </div>
              <Progress value={result.score} className="h-2" />
            </CardContent>
          </Card>

          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={activeCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(null)}
              className="text-xs"
            >
              All ({result.checklist.length})
            </Button>
            {categories.map((cat) => {
              const count = result.checklist.filter((c) => c.category === cat).length;
              const fails = result.checklist.filter((c) => c.category === cat && c.status === 'fail').length;
              return (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className="text-xs capitalize"
                >
                  {cat} ({count})
                  {fails > 0 && (
                    <Badge variant="destructive" className="ml-1.5 text-[9px] px-1 py-0">{fails}</Badge>
                  )}
                </Button>
              );
            })}
          </div>

          {/* Checklist Items */}
          <div className="space-y-2">
            {result.checklist
              .filter((c) => !activeCategory || c.category === activeCategory)
              .sort((a, b) => {
                const order = { fail: 0, warning: 1, pass: 2 };
                return order[a.status] - order[b.status];
              })
              .map((item) => (
                <Card key={item.id} className={cn(
                  'border-l-4',
                  item.status === 'fail' ? 'border-l-destructive' :
                  item.status === 'warning' ? 'border-l-amber-500' :
                  'border-l-emerald-500'
                )}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <StatusIcon status={item.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-semibold text-foreground">{item.label}</p>
                          <Badge variant="outline" className="text-[9px] capitalize">{item.category}</Badge>
                          <Badge
                            variant={item.severity === 'critical' ? 'destructive' : 'secondary'}
                            className="text-[9px]"
                          >
                            {item.severity}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{item.detail}</p>
                        {item.status !== 'pass' && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 italic">
                            Why it matters: {item.whyItMatters}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>

          {/* Denial Risk Summary */}
          {result.denialRiskFactors.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Denial Risk Factors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {result.denialRiskFactors.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
