import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  listGhostCases, injectGhostCase, validateGhostCase,
  getEngineHealth, type GhostCase, type EngineHealth
} from '@/lib/soupyEngineService';
import { runSOUPYAnalysis } from '@/lib/caseService';
import { supabase } from '@/integrations/supabase/client';
import {
  Ghost, Plus, Play, CheckCircle2, XCircle, BarChart3,
  RefreshCw, FlaskConical, Target, TrendingUp, AlertTriangle, Clock
} from 'lucide-react';

interface GhostCaseResult {
  id: string;
  ghost_case_id: string;
  case_id: string | null;
  accuracy_score: number;
  engine_output: any;
  expected_output: any;
  deviation_details: any[];
  created_at: string;
}

export function GhostCaseManager() {
  const [ghostCases, setGhostCases] = useState<GhostCase[]>([]);
  const [results, setResults] = useState<GhostCaseResult[]>([]);
  const [engineHealth, setEngineHealth] = useState<EngineHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [injecting, setInjecting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ghosts, health] = await Promise.all([
        listGhostCasesWithResults(),
        getEngineHealth(),
      ]);
      setGhostCases(ghosts.ghostCases);
      setResults(ghosts.results);
      setEngineHealth(health);
    } catch (err) {
      console.error('Failed to load ghost case data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleInjectAndTest = async (ghost: GhostCase) => {
    setInjecting(ghost.id);
    try {
      // 1. Inject ghost case as a real audit case
      const { caseId } = await injectGhostCase(ghost.id);
      toast.success('Ghost case injected, running SOUPY analysis...');

      // 2. Run SOUPY analysis on it
      await runSOUPYAnalysis(caseId);
      toast.success('Analysis complete, validating results...');

      // 3. Validate against known answer
      const validation = await validateGhostCase(caseId, ghost.id);
      if (validation.isCorrect) {
        toast.success(`✅ Engine passed! Accuracy: ${validation.accuracyScore}%`);
      } else {
        toast.warning(`⚠️ Engine deviated. Accuracy: ${validation.accuracyScore}%`);
      }

      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ghost case test failed');
    } finally {
      setInjecting(null);
    }
  };

  const avgAccuracy = ghostCases.length > 0
    ? ghostCases.reduce((s, g) => s + (g.accuracy_rate || 0), 0) / ghostCases.length
    : 0;

  const totalTests = ghostCases.reduce((s, g) => s + (g.times_tested || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Ghost className="h-4 w-4" />
              <span className="text-xs font-medium">Ghost Cases</span>
            </div>
            <p className="text-2xl font-bold">{ghostCases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FlaskConical className="h-4 w-4" />
              <span className="text-xs font-medium">Total Tests Run</span>
            </div>
            <p className="text-2xl font-bold">{totalTests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">Avg Accuracy</span>
            </div>
            <p className="text-2xl font-bold">
              {avgAccuracy > 0 ? `${avgAccuracy.toFixed(1)}%` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Engine Health</span>
            </div>
            <p className="text-2xl font-bold">
              {engineHealth?.health.ghostCaseAccuracy != null
                ? `${engineHealth.health.ghostCaseAccuracy.toFixed(0)}%`
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center gap-2">
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create Ghost Case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Ghost Case</DialogTitle>
            </DialogHeader>
            <CreateGhostCaseForm onCreated={() => { setShowCreate(false); loadData(); }} />
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs: Cases / Results */}
      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">
            Ghost Cases
            {ghostCases.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{ghostCases.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="results">
            Test Results
            {results.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{results.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-3 mt-4">
          {ghostCases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Ghost className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No ghost cases configured yet.</p>
                <p className="text-xs mt-1">Create a known-answer test case to validate engine accuracy.</p>
              </CardContent>
            </Card>
          ) : (
            ghostCases.map(ghost => (
              <GhostCaseCard
                key={ghost.id}
                ghost={ghost}
                onInject={handleInjectAndTest}
                isInjecting={injecting === ghost.id}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-3 mt-4">
          {results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No test results yet.</p>
                <p className="text-xs mt-1">Inject and run a ghost case to generate results.</p>
              </CardContent>
            </Card>
          ) : (
            results.map(result => (
              <ResultCard key={result.id} result={result} ghostCases={ghostCases} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Ghost Case Card ───

function GhostCaseCard({ ghost, onInject, isInjecting }: {
  ghost: GhostCase;
  onInject: (g: GhostCase) => void;
  isInjecting: boolean;
}) {
  const template = ghost.case_template as any;
  const known = ghost.known_answer as any;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Ghost className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold truncate">
                {template?.summary || template?.physician_name || 'Ghost Case'}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {ghost.difficulty}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {ghost.category}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {template?.cpt_codes?.length > 0 && (
                <span>CPT: {template.cpt_codes.join(', ')}</span>
              )}
              {known?.expected_risk_level && (
                <span>Expected Risk: <span className="font-medium text-foreground">{known.expected_risk_level}</span></span>
              )}
              {known?.expected_consensus_range && (
                <span>Expected Consensus: <span className="font-medium text-foreground">{known.expected_consensus_range[0]}–{known.expected_consensus_range[1]}</span></span>
              )}
              {known?.key_test && (
                <span>Key Test: <span className="font-medium text-foreground">{known.key_test}</span></span>
              )}
            </div>

            {/* Accuracy track record */}
            {ghost.times_tested > 0 && (
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 max-w-48">
                  <Progress value={ghost.accuracy_rate} className="h-1.5" />
                </div>
                <span className="text-xs text-muted-foreground">
                  {ghost.accuracy_rate.toFixed(0)}% accuracy ({ghost.times_correct}/{ghost.times_tested})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {ghost.last_injected_at && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(ghost.last_injected_at).toLocaleDateString()}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onInject(ghost)}
              disabled={isInjecting}
            >
              {isInjecting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {isInjecting ? 'Testing...' : 'Inject & Test'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Result Card ───

function ResultCard({ result, ghostCases }: { result: GhostCaseResult; ghostCases: GhostCase[] }) {
  const ghost = ghostCases.find(g => g.id === result.ghost_case_id);
  const isPass = (result.accuracy_score || 0) >= 70;
  const deviations = (result.deviation_details || []) as any[];

  return (
    <Card className={`border-l-4 ${isPass ? 'border-l-consensus' : 'border-l-destructive'}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {isPass ? (
                <CheckCircle2 className="h-4 w-4 text-consensus" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-semibold">
                {isPass ? 'PASS' : 'FAIL'} — {result.accuracy_score}%
              </span>
              {ghost && (
                <span className="text-xs text-muted-foreground">
                  ({(ghost.case_template as any)?.summary || 'Ghost Case'})
                </span>
              )}
            </div>

            {deviations.length > 0 && (
              <div className="mt-2 space-y-1">
                {deviations.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="font-medium text-foreground">{d.type}</span>
                      {' '}— expected: {JSON.stringify(d.expected)}, actual: {JSON.stringify(d.actual)}
                      {' '}(−{d.penalty}pts)
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground mt-2">
              {new Date(result.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Ghost Case Form ───

function CreateGhostCaseForm({ onCreated }: { onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    summary: '',
    physicianName: 'Test Physician',
    patientId: '',
    cptCodes: '',
    icdCodes: '',
    claimAmount: '',
    sourceText: '',
    dateOfService: new Date().toISOString().split('T')[0],
    difficulty: 'medium',
    category: 'general',
    // Known answer fields
    expectedRiskLevel: 'medium',
    expectedConsensusMin: '60',
    expectedConsensusMax: '85',
    expectedAction: '',
    expectedViolations: '',
    expectedContradictions: '',
    keyTest: '',
  });

  const handleSubmit = async () => {
    if (!form.summary) { toast.error('Summary is required'); return; }
    setSaving(true);
    try {
      const caseTemplate = {
        summary: form.summary,
        physician_name: form.physicianName,
        patient_id: form.patientId || `GHOST-PT-${Date.now()}`,
        cpt_codes: form.cptCodes.split(',').map(s => s.trim()).filter(Boolean),
        icd_codes: form.icdCodes.split(',').map(s => s.trim()).filter(Boolean),
        claim_amount: parseFloat(form.claimAmount) || 0,
        source_text: form.sourceText,
        date_of_service: form.dateOfService,
      };

      const knownAnswer: any = {
        expected_risk_level: form.expectedRiskLevel,
        expected_consensus_range: [
          parseInt(form.expectedConsensusMin) || 0,
          parseInt(form.expectedConsensusMax) || 100,
        ],
        key_test: form.keyTest,
      };
      if (form.expectedAction) knownAnswer.expected_action = form.expectedAction;
      if (form.expectedViolations) knownAnswer.expected_violations = parseInt(form.expectedViolations);
      if (form.expectedContradictions) knownAnswer.expected_contradictions = parseInt(form.expectedContradictions);

      await createGhostCase(caseTemplate, knownAnswer, form.difficulty, form.category);
      toast.success('Ghost case created');
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ghost case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Case Template */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Case Template</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs">Summary / Description *</Label>
            <Textarea
              value={form.summary}
              onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
              placeholder="Describe the test scenario..."
              className="mt-1 text-sm"
              rows={2}
            />
          </div>
          <div>
            <Label className="text-xs">Physician Name</Label>
            <Input value={form.physicianName} onChange={e => setForm(f => ({ ...f, physicianName: e.target.value }))} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Date of Service</Label>
            <Input type="date" value={form.dateOfService} onChange={e => setForm(f => ({ ...f, dateOfService: e.target.value }))} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">CPT Codes (comma-separated)</Label>
            <Input value={form.cptCodes} onChange={e => setForm(f => ({ ...f, cptCodes: e.target.value }))} placeholder="99213, 99214" className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">ICD Codes (comma-separated)</Label>
            <Input value={form.icdCodes} onChange={e => setForm(f => ({ ...f, icdCodes: e.target.value }))} placeholder="J06.9, R05.9" className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Claim Amount ($)</Label>
            <Input type="number" value={form.claimAmount} onChange={e => setForm(f => ({ ...f, claimAmount: e.target.value }))} placeholder="1500" className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Difficulty</Label>
            <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="upcoding">Upcoding</SelectItem>
                <SelectItem value="unbundling">Unbundling</SelectItem>
                <SelectItem value="medical-necessity">Medical Necessity</SelectItem>
                <SelectItem value="modifier-misuse">Modifier Misuse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Source Text / Clinical Notes</Label>
            <Textarea
              value={form.sourceText}
              onChange={e => setForm(f => ({ ...f, sourceText: e.target.value }))}
              placeholder="Clinical documentation for the ghost case..."
              className="mt-1 text-sm"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Known Answer */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Known Answer (Expected Outcome)</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Expected Risk Level</Label>
            <Select value={form.expectedRiskLevel} onValueChange={v => setForm(f => ({ ...f, expectedRiskLevel: v }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Expected Action</Label>
            <Select value={form.expectedAction || "any"} onValueChange={v => setForm(f => ({ ...f, expectedAction: v === "any" ? "" : v }))}>
              <SelectTrigger className="mt-1 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="approve">Approve</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
                <SelectItem value="request_info">Request Info</SelectItem>
                <SelectItem value="refer_to_medical_director">Refer to MD</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Consensus Range Min</Label>
            <Input type="number" value={form.expectedConsensusMin} onChange={e => setForm(f => ({ ...f, expectedConsensusMin: e.target.value }))} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Consensus Range Max</Label>
            <Input type="number" value={form.expectedConsensusMax} onChange={e => setForm(f => ({ ...f, expectedConsensusMax: e.target.value }))} className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Expected Violations</Label>
            <Input type="number" value={form.expectedViolations} onChange={e => setForm(f => ({ ...f, expectedViolations: e.target.value }))} placeholder="Optional" className="mt-1 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Expected Contradictions</Label>
            <Input type="number" value={form.expectedContradictions} onChange={e => setForm(f => ({ ...f, expectedContradictions: e.target.value }))} placeholder="Optional" className="mt-1 text-sm" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Key Test Description</Label>
            <Input value={form.keyTest} onChange={e => setForm(f => ({ ...f, keyTest: e.target.value }))} placeholder="What this ghost case specifically tests" className="mt-1 text-sm" />
          </div>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={saving} className="w-full gap-1.5">
        {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        {saving ? 'Creating...' : 'Create Ghost Case'}
      </Button>
    </div>
  );
}

// ─── Service helpers ───

async function listGhostCasesWithResults(): Promise<{ ghostCases: GhostCase[]; results: GhostCaseResult[] }> {
  const response = await supabase.functions.invoke('soupy-engine', {
    body: { action: 'list-ghost-cases' },
  });
  if (response.error) throw new Error(response.error.message);
  return { ghostCases: response.data.ghostCases || [], results: response.data.results || [] };
}

async function createGhostCase(
  caseTemplate: any, knownAnswer: any, difficulty: string, category: string
): Promise<void> {
  const response = await supabase.functions.invoke('soupy-engine', {
    body: { action: 'create-ghost-case', caseTemplate, knownAnswer, difficulty, category },
  });
  if (response.error) throw new Error(response.error.message);
}
