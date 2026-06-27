import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Pencil, X, Plus, Download, ArrowLeft, Trophy } from 'lucide-react';
import {
  BUCKETS, BUCKET_COLORS, type FindingCard as FindingCardType,
} from '@/lib/patientSelfHelpTypes';
import {
  loadReviewerState, saveReviewerState, computeBonus, reviewProgress,
  applyReviewToCards, BONUS_RATES, BONUS_RATE_LABELS,
  type ReviewerState, type AIReview, type BonusFinding, type BonusSeverity,
} from '@/lib/reviewerState';
import {
  exportSelfHelpFindingsPDF, type SelfHelpResults,
} from '@/lib/exportPatientSelfHelpPDFs';

type CaseRow = {
  id: string;
  case_title: string | null;
  results: SelfHelpResults | null;
  status: string;
};

const SEVERITIES: BonusSeverity[] = ['low', 'medium', 'high'];

export default function AppReviewerConsole() {
  const { caseId } = useParams<{ caseId: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<CaseRow | null>(null);
  const [state, setState] = useState<ReviewerState>({ reviewerName: '', aiReviews: {}, bonusFindings: [] });

  // Bonus form
  const [bTitle, setBTitle] = useState('');
  const [bSeverity, setBSeverity] = useState<BonusSeverity>('medium');
  const [bBucket, setBBucket] = useState<typeof BUCKETS[number]>('Needs Clarification');
  const [bNotes, setBNotes] = useState('');
  const [bCite, setBCite] = useState('');

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('patient_self_help_cases')
        .select('id, case_title, results, status')
        .eq('id', caseId)
        .maybeSingle();
      if (error) toast({ title: 'Could not load case', description: error.message, variant: 'destructive' });
      setRow((data as any) ?? null);
      setState(loadReviewerState(caseId));
      setLoading(false);
    })();
  }, [caseId, toast]);

  const cards = useMemo<FindingCardType[]>(
    () => (row?.results?.cards ?? []) as FindingCardType[],
    [row],
  );

  const persist = (next: ReviewerState) => {
    setState(next);
    if (caseId) saveReviewerState(caseId, next);
  };

  const setReview = (idx: number, patch: Partial<AIReview>) => {
    const key = String(idx);
    const prev = state.aiReviews[key] || { decision: 'pending' as const };
    persist({
      ...state,
      aiReviews: { ...state.aiReviews, [key]: { ...prev, ...patch, reviewedAt: new Date().toISOString() } },
    });
  };

  const addBonus = () => {
    if (!bTitle.trim()) {
      toast({ title: 'Bonus finding needs a title', variant: 'destructive' });
      return;
    }
    const f: BonusFinding = {
      id: crypto.randomUUID(),
      title: bTitle.trim(),
      severity: bSeverity,
      bucket: bBucket,
      notes: bNotes.trim(),
      recordCitation: bCite.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    persist({ ...state, bonusFindings: [...state.bonusFindings, f] });
    setBTitle(''); setBNotes(''); setBCite('');
    toast({ title: 'Bonus finding added', description: `+$${BONUS_RATES[f.severity]}` });
  };

  const removeBonus = (id: string) => {
    persist({ ...state, bonusFindings: state.bonusFindings.filter(b => b.id !== id) });
  };

  const finalize = () => {
    persist({ ...state, finishedAt: new Date().toISOString(), startedAt: state.startedAt || new Date().toISOString() });
    toast({ title: 'Review marked complete', description: 'You can still edit later.' });
  };

  const exportReviewed = () => {
    if (!row?.results) return;
    const mergedCards = applyReviewToCards(cards, state);
    const merged: SelfHelpResults = { ...row.results, cards: mergedCards };
    const title = `${row.case_title || 'Case'} — reviewed by ${state.reviewerName || 'reviewer'}`;
    exportSelfHelpFindingsPDF(title, merged);
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading case…</div>;
  }
  if (!row) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm">Case not found.</p>
        <Button asChild variant="outline"><Link to="/app/patient-self-help"><ArrowLeft className="h-4 w-4 mr-1" /> Back to cases</Link></Button>
      </div>
    );
  }

  const { total: bonusTotal, counts } = computeBonus(state);
  const prog = reviewProgress(state, cards.length);

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-1">
            <Link to="/app/patient-self-help"><ArrowLeft className="h-4 w-4 mr-1" /> Cases</Link>
          </Button>
          <h1 className="text-2xl font-bold">Reviewer Console</h1>
          <p className="text-sm text-muted-foreground">
            {row.case_title || '(no title)'} · {cards.length} AI findings to fact-check.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportReviewed}><Download className="h-4 w-4 mr-1" /> Export reviewed PDF</Button>
          <Button onClick={finalize}><CheckCircle2 className="h-4 w-4 mr-1" /> Mark review complete</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-600" /> Reviewer tally</CardTitle>
          <CardDescription>Bonus pays per added finding. Low ${BONUS_RATES.low} · Medium ${BONUS_RATES.medium} · High ${BONUS_RATES.high}.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          <div>
            <Label className="text-xs">Reviewer name</Label>
            <Input value={state.reviewerName} onChange={(e) => persist({ ...state, reviewerName: e.target.value })} placeholder="e.g. Mom (RN)" />
          </div>
          <Stat label="Reviewed" value={`${prog.done} / ${prog.total}`} hint={`${prog.pct}%`} />
          <Stat label="Bonus — low" value={`${counts.low}`} hint={`$${counts.low * BONUS_RATES.low}`} />
          <Stat label="Bonus — med/high" value={`${counts.medium + counts.high}`} hint={`$${counts.medium * BONUS_RATES.medium + counts.high * BONUS_RATES.high}`} />
          <Stat label="Bonus total" value={`$${bonusTotal}`} hint={state.finishedAt ? 'review complete' : 'in progress'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add a bonus finding</CardTitle>
          <CardDescription>Anything the AI missed. Severity sets the bonus.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <Label className="text-xs">Title</Label>
            <Input value={bTitle} onChange={(e) => setBTitle(e.target.value)} placeholder="e.g. No FHR strip between 03:30–07:15" />
          </div>
          <div>
            <Label className="text-xs">Severity</Label>
            <Select value={bSeverity} onValueChange={(v) => setBSeverity(v as BonusSeverity)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEVERITIES.map(s => <SelectItem key={s} value={s}>{BONUS_RATE_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Bucket</Label>
            <Select value={bBucket} onValueChange={(v) => setBBucket(v as typeof BUCKETS[number])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUCKETS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6">
            <Label className="text-xs">What you saw / why it matters</Label>
            <Textarea rows={2} value={bNotes} onChange={(e) => setBNotes(e.target.value)} placeholder="In plain language." />
          </div>
          <div className="md:col-span-5">
            <Label className="text-xs">Record citation (optional)</Label>
            <Input value={bCite} onChange={(e) => setBCite(e.target.value)} placeholder="File · page · time" />
          </div>
          <div className="md:col-span-1 flex items-end">
            <Button onClick={addBonus} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>

          {state.bonusFindings.length > 0 && (
            <div className="md:col-span-6 space-y-2 pt-2 border-t">
              {state.bonusFindings.map(b => (
                <div key={b.id} className="flex items-start gap-2 border rounded px-3 py-2 text-sm">
                  <Badge variant="outline" className={BUCKET_COLORS[b.bucket]}>{b.bucket}</Badge>
                  <Badge variant="outline">{b.severity} · +${BONUS_RATES[b.severity]}</Badge>
                  <div className="flex-1">
                    <div className="font-medium">{b.title}</div>
                    {b.notes && <div className="text-xs text-muted-foreground">{b.notes}</div>}
                    {b.recordCitation && <div className="text-xs text-muted-foreground">Citation: {b.recordCitation}</div>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeBonus(b.id)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">AI findings — confirm, edit, or reject</h2>
        {cards.length === 0 && (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">No AI findings on this case yet.</CardContent></Card>
        )}
        {cards.map((c, i) => (
          <ReviewRow key={i} idx={i} card={c} review={state.aiReviews[String(i)]} onChange={setReview} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function ReviewRow({
  idx, card, review, onChange,
}: {
  idx: number;
  card: FindingCardType;
  review?: AIReview;
  onChange: (idx: number, patch: Partial<AIReview>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const decision = review?.decision || 'pending';

  return (
    <Card className={
      decision === 'confirmed' ? 'border-emerald-500/40' :
      decision === 'rejected' ? 'border-destructive/40 opacity-60' :
      decision === 'edited' ? 'border-amber-500/40' : ''
    }>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <Badge variant="outline" className={BUCKET_COLORS[card.bucket]}>{card.bucket}</Badge>
            <CardTitle className="text-sm">{review?.editedTitle || card.title}</CardTitle>
          </div>
          <Badge variant={decision === 'pending' ? 'secondary' : 'default'} className="text-[10px]">{decision}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="text-xs uppercase tracking-wide text-muted-foreground">Why it matters: </span>{review?.editedWhyItMatters || card.whyItMatters}</p>
        <p className="text-xs text-muted-foreground"><b>Record shows:</b> {card.whatRecordShows}</p>
        <p className="text-xs text-muted-foreground"><b>Does NOT prove:</b> {card.whatItDoesNotProve}</p>
        {(review?.editedAskNext || card.askNext) && (
          <p className="text-xs"><b>Ask next:</b> {review?.editedAskNext || card.askNext}</p>
        )}
        {card.sourceFile && (
          <p className="text-[11px] text-muted-foreground">{card.sourceFile}{card.sourcePages?.length ? ` · p.${card.sourcePages.join(',')}` : ''}</p>
        )}

        {editing && (
          <div className="space-y-2 pt-2 border-t">
            <div>
              <Label className="text-xs">Title</Label>
              <Input defaultValue={review?.editedTitle || card.title} onBlur={(e) => onChange(idx, { editedTitle: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Why it matters</Label>
              <Textarea rows={2} defaultValue={review?.editedWhyItMatters || card.whyItMatters} onBlur={(e) => onChange(idx, { editedWhyItMatters: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Ask next</Label>
              <Textarea rows={2} defaultValue={review?.editedAskNext || card.askNext} onBlur={(e) => onChange(idx, { editedAskNext: e.target.value })} />
            </div>
          </div>
        )}

        <div>
          <Label className="text-xs">Reviewer note (private)</Label>
          <Textarea rows={1} defaultValue={review?.note || ''} onBlur={(e) => onChange(idx, { note: e.target.value })} placeholder="Optional context for your record." />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant={decision === 'confirmed' ? 'default' : 'outline'} onClick={() => onChange(idx, { decision: 'confirmed' })}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Confirm
          </Button>
          <Button size="sm" variant={editing ? 'default' : 'outline'} onClick={() => { setEditing(e => !e); if (!editing) onChange(idx, { decision: 'edited' }); }}>
            <Pencil className="h-4 w-4 mr-1" /> {editing ? 'Done editing' : 'Edit'}
          </Button>
          <Button size="sm" variant={decision === 'rejected' ? 'destructive' : 'outline'} onClick={() => onChange(idx, { decision: 'rejected' })}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}