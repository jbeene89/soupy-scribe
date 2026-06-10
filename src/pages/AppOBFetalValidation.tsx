import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Play, CheckCircle2, XCircle, AlertTriangle, FlaskConical, Download } from 'lucide-react';
import { toast } from 'sonner';
import { SEO } from '@/components/SEO';
import { runOBAudit } from '@/lib/obFetalService';
import type { OBAuditResult, MAREvent, StripSample, MedName } from '@/lib/obFetalTypes';

// ── Types for the labeled synthetic bench ──────────────────────────────
type ExpectedLabel =
  | 'NEGATIVE_CONTROL'
  | 'TRUE_POSITIVE'
  | 'DELAYED_ACTION'
  | 'APPROPRIATE_STOP'
  | 'CONTEXT_FLAG';

interface LabelRow {
  caseId: string;
  t: string;
  eventType: string;
  pitocinAfter: number;
  context: string;
  contraindication: string;
  expectedAction: string;
  expectedLabel: ExpectedLabel;
}

interface CaseRun {
  caseId: string;
  title: string;
  status: 'idle' | 'running' | 'done' | 'error';
  labelRows: LabelRow[];
  result?: OBAuditResult;
  error?: string;
  comparison?: LabelComparison[];
  metrics?: { tp: number; fn: number; fp: number; tn: number; agreement: number };
}

interface LabelComparison {
  label: LabelRow;
  /** Engine violations that fall in a +/- 20 min window of the label timestamp. */
  matchedViolations: { rule: string; severity: string; t: string; ruleCode?: string }[];
  verdict: 'agree' | 'miss' | 'extra' | 'context';
  note: string;
}

const CASE_TITLES: Record<string, string> = {
  CASE_01: 'Appropriate Pitocin with reassuring tracing',
  CASE_02: 'Tachysystole + recurrent late decels after escalation',
  CASE_03: 'Pre-existing Category II variables before Pitocin start',
  CASE_04: 'Hypertonic uterus / tetanic pattern with prolonged decel',
  CASE_05: 'Absent/minimal variability + recurrent late decels',
  CASE_06: 'Adequate uterine activity / no progress with escalation',
  CASE_07: 'Premature Pitocin restart after unresolved tachysystole',
  CASE_08: 'Baseline fetal tachycardia / minimal variability before start',
};

function parseCsv(text: string): string[][] {
  // Handles quoted commas (label CSV has them in context column).
  const out: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const row: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { row.push(cur); cur = ''; continue; }
      cur += ch;
    }
    row.push(cur);
    out.push(row.map((c) => c.trim()));
  }
  return out;
}

function eventTypeToAction(t: string): MAREvent['action'] | null {
  if (t === 'pitocin_start') return 'start';
  if (t === 'pitocin_increase') return 'increase';
  if (t === 'pitocin_stop') return 'discontinue';
  if (t === 'pitocin_restart') return 'resume';
  if (t === 'prolonged_deceleration_begins') return null;
  return null;
}

async function loadBench(): Promise<{ samplesByCase: Record<string, StripSample[]>; labelsByCase: Record<string, LabelRow[]> }> {
  const [stripRes, labelRes] = await Promise.all([
    fetch('/validation/strip.csv'),
    fetch('/validation/labels.csv'),
  ]);
  if (!stripRes.ok || !labelRes.ok) throw new Error('Validation files not found in /validation/.');
  const stripText = await stripRes.text();
  const labelText = await labelRes.text();

  const stripRows = parseCsv(stripText);
  const sH = stripRows[0];
  const ci = sH.indexOf('case_id');
  const ti = sH.indexOf('timestamp');
  const fi = sH.indexOf('fhr_bpm');
  const ui = sH.indexOf('uterine_activity_external_toco_0_100');
  const samplesByCase: Record<string, StripSample[]> = {};
  for (let r = 1; r < stripRows.length; r++) {
    const row = stripRows[r];
    if (!row[ci]) continue;
    const t = new Date(row[ti]).toISOString();
    const fhr = Number(row[fi]);
    const uc = Number(row[ui]);
    (samplesByCase[row[ci]] ||= []).push({ t, fhr: isFinite(fhr) ? fhr : null, uc: isFinite(uc) ? uc : null });
  }

  const labelRows = parseCsv(labelText);
  const lH = labelRows[0];
  const lci = lH.indexOf('case_id');
  const lti = lH.indexOf('timestamp');
  const lei = lH.indexOf('event_type');
  const lpi = lH.indexOf('pitocin_mU_min_after_event');
  const lctx = lH.indexOf('preceding_or_current_strip_context');
  const lcon = lH.indexOf('contraindication_or_caution');
  const lact = lH.indexOf('expected_clinical_action_for_training_label');
  const llab = lH.indexOf('expected_audit_label');
  const labelsByCase: Record<string, LabelRow[]> = {};
  for (let r = 1; r < labelRows.length; r++) {
    const row = labelRows[r];
    if (!row[lci]) continue;
    (labelsByCase[row[lci]] ||= []).push({
      caseId: row[lci],
      t: new Date(row[lti]).toISOString(),
      eventType: row[lei],
      pitocinAfter: Number(row[lpi]),
      context: row[lctx],
      contraindication: row[lcon],
      expectedAction: row[lact],
      expectedLabel: row[llab] as ExpectedLabel,
    });
  }

  return { samplesByCase, labelsByCase };
}

function labelsToMar(labels: LabelRow[]): MAREvent[] {
  const out: MAREvent[] = [];
  for (const l of labels) {
    const action = eventTypeToAction(l.eventType);
    if (!action) continue;
    const med: MedName = 'pitocin';
    out.push({
      t: l.t,
      medication: med,
      medicationLabel: 'Oxytocin (Pitocin)',
      action,
      amount: l.pitocinAfter,
      unit: 'mU/min',
      evidence: `${l.t} Pitocin ${action} → ${l.pitocinAfter} mU/min · ${l.context}`,
    });
  }
  return out;
}

function compareCase(result: OBAuditResult, labels: LabelRow[]): { comparison: LabelComparison[]; metrics: CaseRun['metrics'] } {
  const WINDOW_MS = 20 * 60_000;
  const violations = result.violations;
  const comparison: LabelComparison[] = [];
  let tp = 0, fn = 0, fp = 0, tn = 0;
  const matchedIdx = new Set<number>();

  for (const l of labels) {
    const lt = new Date(l.t).getTime();
    const matches = violations
      .map((v, idx) => ({ v, idx, dt: Math.abs(new Date(v.t).getTime() - lt) }))
      .filter((m) => m.dt <= WINDOW_MS);
    matches.forEach((m) => matchedIdx.add(m.idx));
    const matchedViolations = matches.map((m) => ({ rule: m.v.rule, severity: m.v.severity, t: m.v.t, ruleCode: m.v.ruleCode }));

    let verdict: LabelComparison['verdict'];
    let note = '';
    if (l.expectedLabel === 'TRUE_POSITIVE' || l.expectedLabel === 'DELAYED_ACTION') {
      if (matches.length > 0) { verdict = 'agree'; tp++; note = 'Engine flagged within ±20 min of expected stop-rule event.'; }
      else { verdict = 'miss'; fn++; note = 'Engine did not flag a violation near this event — false negative.'; }
    } else if (l.expectedLabel === 'NEGATIVE_CONTROL' || l.expectedLabel === 'APPROPRIATE_STOP') {
      if (matches.length === 0) { verdict = 'agree'; tn++; note = 'Engine correctly stayed silent.'; }
      else { verdict = 'extra'; fp++; note = 'Engine flagged a violation where the label says no action was needed.'; }
    } else {
      verdict = 'context';
      note = 'Context label — not counted in precision/recall (provider judgment required).';
    }
    comparison.push({ label: l, matchedViolations, verdict, note });
  }

  const counted = tp + fn + fp + tn;
  const agreement = counted === 0 ? 0 : Math.round(((tp + tn) / counted) * 100);
  return { comparison, metrics: { tp, fn, fp, tn, agreement } };
}

function badgeFor(verdict: LabelComparison['verdict']) {
  switch (verdict) {
    case 'agree': return { Icon: CheckCircle2, cls: 'text-emerald-600', label: 'Agree' };
    case 'miss': return { Icon: XCircle, cls: 'text-destructive', label: 'Missed' };
    case 'extra': return { Icon: AlertTriangle, cls: 'text-amber-600', label: 'Over-flag' };
    case 'context': return { Icon: FlaskConical, cls: 'text-muted-foreground', label: 'Context' };
  }
}

export default function AppOBFetalValidation() {
  const [runs, setRuns] = useState<CaseRun[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  async function runBench() {
    setRunning(true);
    setRuns([]);
    setProgress(0);
    try {
      const { samplesByCase, labelsByCase } = await loadBench();
      const caseIds = Object.keys(samplesByCase).sort();
      const initial: CaseRun[] = caseIds.map((id) => ({
        caseId: id,
        title: CASE_TITLES[id] || id,
        status: 'idle',
        labelRows: labelsByCase[id] || [],
      }));
      setRuns(initial);

      for (let i = 0; i < caseIds.length; i++) {
        const id = caseIds[i];
        setRuns((prev) => prev.map((r) => r.caseId === id ? { ...r, status: 'running' } : r));
        try {
          const samples = samplesByCase[id];
          // Sub-sample to 1/min to keep payload light (data is 15s sampled).
          const minuteSamples = samples.filter((_, idx) => idx % 4 === 0);
          const mar = labelsToMar(labelsByCase[id] || []);
          const result = await runOBAudit({
            stripSamples: minuteSamples,
            marEvents: mar,
            windowMinutes: 10,
            caseHeader: { patientInitials: id, narrative: CASE_TITLES[id] },
          });
          const { comparison, metrics } = compareCase(result, labelsByCase[id] || []);
          setRuns((prev) => prev.map((r) => r.caseId === id ? { ...r, status: 'done', result, comparison, metrics } : r));
        } catch (e) {
          setRuns((prev) => prev.map((r) => r.caseId === id ? { ...r, status: 'error', error: (e as Error).message } : r));
        }
        setProgress(Math.round(((i + 1) / caseIds.length) * 100));
      }
      toast.success('Validation bench complete.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function downloadCsv() {
    const rows: string[] = ['case_id,timestamp,event_type,expected_label,verdict,matched_rules,note'];
    for (const r of runs) {
      for (const c of r.comparison || []) {
        const matched = c.matchedViolations.map((m) => `${m.ruleCode || m.rule} (${m.severity})`).join(' | ');
        rows.push([
          r.caseId, c.label.t, c.label.eventType, c.label.expectedLabel,
          c.verdict, `"${matched}"`, `"${c.note.replace(/"/g, "'")}"`,
        ].join(','));
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ob-fetal-validation.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // Aggregate metrics across all completed cases.
  const totals = runs.reduce((acc, r) => {
    if (!r.metrics) return acc;
    acc.tp += r.metrics.tp; acc.fn += r.metrics.fn; acc.fp += r.metrics.fp; acc.tn += r.metrics.tn;
    return acc;
  }, { tp: 0, fn: 0, fp: 0, tn: 0 });
  const totalCounted = totals.tp + totals.fn + totals.fp + totals.tn;
  const sensitivity = totals.tp + totals.fn === 0 ? 0 : (totals.tp / (totals.tp + totals.fn)) * 100;
  const specificity = totals.tn + totals.fp === 0 ? 0 : (totals.tn / (totals.tn + totals.fp)) * 100;
  const agreement = totalCounted === 0 ? 0 : ((totals.tp + totals.tn) / totalCounted) * 100;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <SEO path="/app/ob-fetal-validation" title="OB Fetal Audit Validation — SOUPY Audit" description="Validate the OB Fetal audit engine against a labeled synthetic bench of 8 Pitocin tracing scenarios." />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            OB Fetal Audit — Validation Bench
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Runs the engine against 8 labeled synthetic Pitocin cases (one reassuring control, six clinically-flagged
            scenarios, one delayed/over-flag context case) and compares the engine's output to the expected audit
            label for every Pitocin event. A match within ±20 min counts as agreement.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {runs.some((r) => r.status === 'done') && (
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          )}
          <Button onClick={runBench} disabled={running}>
            <Play className="h-4 w-4 mr-1.5" /> {running ? 'Running bench…' : 'Run validation bench'}
          </Button>
        </div>
      </div>

      {running && <Progress value={progress} />}

      {totalCounted > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Tile label="Sensitivity" value={`${sensitivity.toFixed(0)}%`} tone={sensitivity >= 80 ? 'ok' : 'warn'} />
          <Tile label="Specificity" value={`${specificity.toFixed(0)}%`} tone={specificity >= 80 ? 'ok' : 'warn'} />
          <Tile label="Overall agreement" value={`${agreement.toFixed(0)}%`} tone={agreement >= 80 ? 'ok' : 'warn'} />
          <Tile label="True positives" value={String(totals.tp)} tone="ok" />
          <Tile label="Missed / over-flag" value={`${totals.fn} / ${totals.fp}`} tone={totals.fn + totals.fp === 0 ? 'ok' : 'warn'} />
        </div>
      )}

      <div className="space-y-4">
        {runs.map((r) => (
          <Card key={r.caseId} className="p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  {r.caseId}
                  <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                  {r.metrics && <Badge variant="secondary" className="text-[10px]">{r.metrics.agreement}% agreement</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{r.title}</div>
              </div>
              {r.result && (
                <div className="text-xs text-muted-foreground">
                  {r.result.violations.length} engine violations · {r.result.summary.catII} Cat II · {r.result.summary.catIII} Cat III · {r.result.summary.tachysystoleWindows} tachy
                </div>
              )}
            </div>
            {r.error && <div className="text-xs text-destructive">Error: {r.error}</div>}
            {r.comparison && (
              <div className="space-y-1.5">
                {r.comparison.map((c, i) => {
                  const b = badgeFor(c.verdict);
                  const Icon = b.Icon;
                  return (
                    <div key={i} className="flex items-start gap-2 text-xs border-l-2 pl-2 py-1" style={{ borderColor: 'currentColor' }}>
                      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${b.cls}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{new Date(c.label.t).toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-[10px]">{c.label.eventType}</Badge>
                          <Badge variant="outline" className="text-[10px]">expected: {c.label.expectedLabel}</Badge>
                          <span className={`font-semibold ${b.cls}`}>{b.label}</span>
                        </div>
                        <div className="text-muted-foreground mt-0.5">{c.note}</div>
                        {c.matchedViolations.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {c.matchedViolations.map((m, j) => (
                              <li key={j} className="text-[11px]">
                                → <span className="font-mono">{m.ruleCode || 'rule'}</span> [{m.severity}] {m.rule}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </div>

      {runs.length === 0 && !running && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Press <span className="font-semibold">Run validation bench</span> to score the engine against the 8 labeled
          synthetic Pitocin cases.
        </Card>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'bad' }) {
  const cls =
    tone === 'bad' ? 'border-destructive/40 bg-destructive/5 text-destructive'
    : tone === 'warn' ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
    : 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';
  return (
    <Card className={`p-3 border ${cls}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
    </Card>
  );
}