import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Brain, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, DollarSign, FileText, ListChecks,
  TrendingUp, Clock, ArrowRight, ChevronDown, ChevronUp, Zap, Eye, BadgeAlert, Printer, Sparkles, Info, FileSearch
} from 'lucide-react';
import type { PsychCaseInput, PsychAuditResult, PsychBatchSummary, RevenueLaneSummary } from '@/lib/psychTypes';
import { runPsychAudit, computeBatchSummary, CPT_REFERENCE_RATES } from '@/lib/psychAuditEngine';
import { DEMO_PSYCH_CASES } from '@/lib/psychDemoData';
import { PsychCaseForm } from './PsychCaseForm';
import { PsychCaseDetail } from './PsychCaseDetail';
import { PsychReadinessPacket } from './PsychReadinessPacket';
import { ClaimParserView } from '../claim-parser/ClaimParserView';
import type { PsychCaseVersion } from './PsychVersionSwitcher';
import { useAuth } from '@/hooks/useAuth';
import type { ParsedClaim } from '@/lib/parsedClaimTypes';
import type { LensResult, PerspectiveSynthesis } from '../claim-parser/PerspectivesPanel';
import { fetchParsedClaims, deleteParsedClaim } from '@/lib/parsedClaimService';
import { toast } from 'sonner';

export type ReviewedCase = {
  input: PsychCaseInput;
  result: PsychAuditResult;
  versions: PsychCaseVersion[];
  activeVersion: number;
  addedDocuments: { label: string; text: string; addedAt: string }[];
  /** Present when this case originated from the Claim Upload Parser. */
  parsedClaim?: ParsedClaim;
  perspectives?: LensResult[];
  synthesis?: PerspectiveSynthesis | null;
  sourceFileName?: string;
  /** audit_cases.id when persisted. */
  persistedCaseId?: string;
};

function classColor(c: string) {
  if (c === 'ready') return 'text-emerald-500 bg-emerald-500/10';
  if (c === 'curable' || c === 'admin-fix') return 'text-amber-500 bg-amber-500/10';
  return 'text-destructive bg-destructive/10';
}

function classLabel(c: string) {
  const map: Record<string, string> = {
    'ready': 'Ready', 'curable': 'Curable', 'admin-fix': 'Admin Fix',
    'high-denial-risk': 'High Risk', 'human-review': 'Review Needed',
  };
  return map[c] || c;
}

function buildInitialCase(input: PsychCaseInput): ReviewedCase {
  const result = runPsychAudit(input);
  return {
    input,
    result,
    versions: [{ version: 1, createdAt: new Date().toISOString(), result }],
    activeVersion: 1,
    addedDocuments: [],
  };
}

export function PsychPracticeModule() {
  const { isAuthenticated } = useAuth();
  // Live users (signed-in) start with an empty caseload — no sample patients.
  // Demo/visitor mode shows the seeded sample cases so prospects can explore.
  const [cases, setCases] = useState<ReviewedCase[]>(() =>
    isAuthenticated ? [] : DEMO_PSYCH_CASES.map(buildInitialCase)
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showPacket, setShowPacket] = useState<string | null>(null);
  // When set, opens the parser pre-loaded with this saved claim (re-view mode).
  const [reviewingParsedId, setReviewingParsedId] = useState<string | null>(null);

  const batch = useMemo(() => computeBatchSummary(cases), [cases]);
  const selectedCase = cases.find(c => c.input.id === selectedCaseId);
  const reviewingCase = cases.find(c => c.input.id === reviewingParsedId);

  // Hydrate previously-saved parsed claims from the database for signed-in users.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const persisted = await fetchParsedClaims();
        if (cancelled || persisted.length === 0) return;
        setCases(prev => {
          const existingIds = new Set(prev.map(c => c.input.id));
          const hydrated: ReviewedCase[] = persisted
            .filter(p => !existingIds.has(p.caseId))
            .map(p => {
              const input = { ...p.psychInput, id: p.caseId };
              const result = runPsychAudit(input);
              return {
                input,
                result,
                versions: [{ version: 1, createdAt: p.createdAt, result }],
                activeVersion: 1,
                addedDocuments: [],
                parsedClaim: p.parsedClaim,
                perspectives: p.perspectives,
                synthesis: p.synthesis,
                sourceFileName: p.sourceFileName,
                persistedCaseId: p.caseId,
              };
            });
          return [...hydrated, ...prev];
        });
      } catch (e: any) {
        console.error("Failed to load saved parsed claims:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const handleAddCase = (input: PsychCaseInput, extras?: Partial<ReviewedCase>) => {
    const id = input.id || `case-${Date.now()}`;
    const newInput = { ...input, id };
    const base = buildInitialCase(newInput);
    setCases(prev => [...prev, { ...base, ...extras }]);
    setShowForm(false);
    // Auto-open the new case so the user immediately sees the audit report.
    setSelectedCaseId(id);
  };

  const handleDeleteCase = (id: string) => {
    const target = cases.find(c => c.input.id === id);
    setCases(prev => prev.filter(c => c.input.id !== id));
    if (selectedCaseId === id) setSelectedCaseId(null);
    // Best-effort: also delete the persisted row in the background.
    if (target?.persistedCaseId) {
      deleteParsedClaim(target.persistedCaseId).catch(e => {
        console.error("Failed to delete persisted claim:", e);
        toast.error("Removed locally but failed to delete saved copy");
      });
    }
  };

  /**
   * Add a new document to a case, re-run audit, store as new version.
   * Latest version becomes active automatically.
   */
  const handleAddDocument = (caseId: string, docLabel: string, docText: string) => {
    setCases(prev => prev.map(c => {
      if (c.input.id !== caseId) return c;
      const addedAt = new Date().toISOString();
      const newDocs = [...c.addedDocuments, { label: docLabel, text: docText, addedAt }];
      // Re-run engine. (Future: parse the new doc to update structured input fields like CPT
      // from a superbill. For now we re-run on the same input but snapshot the result so the
      // user sees the audit was refreshed and the doc is on file.)
      const result = runPsychAudit(c.input);
      const nextVersion = c.versions.length + 1;
      const newVersion = { version: nextVersion, createdAt: addedAt, result, addedDocLabel: docLabel };
      return {
        ...c,
        result,
        versions: [...c.versions, newVersion],
        activeVersion: nextVersion,
        addedDocuments: newDocs,
      };
    }));
  };

  /** Switch which version of a case is displayed. Other versions remain stored. */
  const handleSelectVersion = (caseId: string, version: number) => {
    setCases(prev => prev.map(c => {
      if (c.input.id !== caseId) return c;
      const v = c.versions.find(vv => vv.version === version);
      if (!v) return c;
      return { ...c, activeVersion: version, result: v.result };
    }));
  };

  // Show readiness packet
  if (showPacket) {
    const pc = cases.find(c => c.input.id === showPacket);
    if (pc) return (
      <PsychReadinessPacket
        caseData={pc}
        onBack={() => setShowPacket(null)}
        onAddDocument={(label, text) => handleAddDocument(pc.input.id!, label, text)}
      />
    );
  }

  // Show case detail
  if (selectedCase) {
    return (
      <PsychCaseDetail
        caseData={selectedCase}
        onBack={() => setSelectedCaseId(null)}
        onViewPacket={() => { setShowPacket(selectedCaseId); setSelectedCaseId(null); }}
        onAddDocument={(label, text) => handleAddDocument(selectedCase.input.id!, label, text)}
        onSelectVersion={(version) => handleSelectVersion(selectedCase.input.id!, version)}
      />
    );
  }

  // Show add form
  if (showForm) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>← Back to Dashboard</Button>
        <PsychCaseForm onSubmit={handleAddCase} />
      </div>
    );
  }

  // Show Claim Upload Parser (multi-file + 5-perspective)
  if (showUpload) {
    return (
      <ClaimParserView
        onBack={() => setShowUpload(false)}
        onCaseCreated={(input) => handleAddCase(input)}
      />
    );
  }

  // Dashboard
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Brain className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Behavioral Health Practice Manager</h1>
            <p className="text-xs text-muted-foreground">Pre-submission checks · Denial prevention · Revenue capture</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowUpload(true)} className="gap-1.5">
            <FileText className="h-4 w-4" /> Upload Claims
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <ListChecks className="h-4 w-4 mr-1.5" /> Manual Entry
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={CheckCircle2} label="Ready to Submit" value={batch.readyToSubmit} color="text-emerald-500" bg="bg-emerald-500/10" />
        <SummaryCard icon={AlertTriangle} label="Needs Fix" value={batch.needsFix} color="text-amber-500" bg="bg-amber-500/10" />
        <SummaryCard icon={XCircle} label="High Denial Risk" value={batch.highRisk} color="text-destructive" bg="bg-destructive/10" />
        <SummaryCard icon={TrendingUp} label="May Be Undercoded" value={batch.undercoded} color="text-blue-500" bg="bg-blue-500/10" />
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-amber-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Revenue at Risk This Week</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${batch.totalRevenueAtRisk.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Claims with issues that may delay or prevent payment</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Possible Missed Revenue</span>
            </div>
            <p className="text-2xl font-bold text-foreground">${batch.totalMissedRevenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Documentation may support higher or additional codes</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Opportunity */}
      {batch.revenueLanes.length > 0 && (
        <MonthlyRevenueCard batch={batch} />
      )}

      {/* CPT Reference Rates */}
      <CPTReferenceCard />

      {/* Top Issues */}
      {batch.topDenialTriggers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BadgeAlert className="h-4 w-4 text-amber-500" />
              Most Common Denial Triggers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {batch.topDenialTriggers.slice(0, 3).map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="text-[10px] min-w-[20px] justify-center">{t.count}</Badge>
                  <span className="text-muted-foreground line-clamp-1">{t.trigger}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case Queue */}
      <Tabs defaultValue="all">
        <TabsList className="mb-3">
          <TabsTrigger value="all" className="text-xs">All ({cases.length})</TabsTrigger>
          <TabsTrigger value="fix" className="text-xs">Fix First ({batch.needsFix + batch.highRisk})</TabsTrigger>
          <TabsTrigger value="ready" className="text-xs">Ready ({batch.readyToSubmit})</TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs">Revenue Opp ({batch.undercoded})</TabsTrigger>
        </TabsList>

        {['all', 'fix', 'ready', 'revenue'].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-2">
            {cases
              .filter(c => {
                if (tab === 'fix') return ['curable', 'admin-fix', 'high-denial-risk', 'human-review'].includes(c.result.classification);
                if (tab === 'ready') return c.result.classification === 'ready';
                if (tab === 'revenue') return c.result.missedRevenue.length > 0;
                return true;
              })
              .sort((a, b) => a.result.score - b.result.score)
              .map(c => (
                <CaseRow
                  key={c.input.id}
                  caseData={c}
                  onSelect={() => setSelectedCaseId(c.input.id!)}
                  onDelete={() => handleDeleteCase(c.input.id!)}
                  onPacket={() => setShowPacket(c.input.id!)}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: number; color: string; bg: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 flex items-center gap-3">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div>
          <p className="text-xl font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CaseRow({ caseData, onSelect, onDelete, onPacket }: {
  caseData: ReviewedCase; onSelect: () => void; onDelete: () => void; onPacket: () => void;
}) {
  const { input, result } = caseData;
  const fails = result.checklist.filter(c => c.status === 'fail').length;

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onSelect}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="text-right shrink-0 w-10">
              <p className="text-lg font-bold text-foreground">{result.score}</p>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{input.patientLabel || input.id}</span>
                <Badge variant="outline" className="text-[9px]">{input.cptCode}</Badge>
                <Badge className={cn('text-[9px] border-0', classColor(result.classification))}>
                  {classLabel(result.classification)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span>{input.sessionDurationMinutes} min</span>
                <span>·</span>
                <span>{input.payerName || 'No payer'}</span>
                {fails > 0 && <><span>·</span><span className="text-destructive">{fails} issues</span></>}
                {result.missedRevenue.length > 0 && <><span>·</span><span className="text-blue-500">${result.missedRevenue.reduce((s, m) => s + (m.estimatedDifference || 0), 0)} possible</span></>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); onPacket(); }}>
              <Printer className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyRevenueCard({ batch }: { batch: PsychBatchSummary }) {
  const [expanded, setExpanded] = useState(false);
  const topLanes = expanded ? batch.revenueLanes : batch.revenueLanes.slice(0, 3);
  const maxMonthly = Math.max(...batch.revenueLanes.map(l => l.monthlyEstimate), 1);

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Monthly Revenue Opportunity
          </CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-600">${batch.totalMonthlyOpportunity.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">estimated per month</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Based on your current case volume, here are revenue lanes you may not be capturing.
          These are estimates — review each opportunity with your billing team.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {topLanes.map((lane) => (
          <div key={lane.lane} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{lane.label}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{lane.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-emerald-600">+${lane.monthlyEstimate.toLocaleString()}/mo</p>
                <p className="text-[10px] text-muted-foreground">{lane.caseCount} case{lane.caseCount !== 1 ? 's' : ''} · ~${lane.totalPerCase}/ea</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/60 transition-all"
                style={{ width: `${(lane.monthlyEstimate / maxMonthly) * 100}%` }}
              />
            </div>
          </div>
        ))}

        {batch.revenueLanes.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `Show ${batch.revenueLanes.length - 3} More Lanes`}
            {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        )}

        <div className="border-t border-border/50 pt-2 mt-2">
          <p className="text-[10px] text-muted-foreground italic">
            Projections based on current batch size extrapolated monthly. Actual revenue depends on payer contracts, patient mix, and clinical appropriateness. This is not billing advice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CPTReferenceCard() {
  const [expanded, setExpanded] = useState(false);
  const coreRates = ['90834', '90837', '90832', '90791', '99214', '96127'];
  const allCodes = Object.keys(CPT_REFERENCE_RATES);
  const displayCodes = expanded ? allCodes : coreRates;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          2026 CPT Reference Rates
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">
          Medicare CY2026 Final Rule rates. Commercial payer rates vary by contract — ranges shown are typical.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {displayCodes.map(code => {
            const r = CPT_REFERENCE_RATES[code];
            if (!r) return null;
            return (
              <div key={code} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/30 last:border-0">
                <Badge variant="outline" className="font-mono text-[10px] shrink-0 w-14 justify-center">{r.code}</Badge>
                <span className="text-muted-foreground flex-1 min-w-0 truncate">{r.description}</span>
                <span className="font-semibold text-foreground shrink-0">${r.medicare2026.toFixed(2)}</span>
                <span className="text-[10px] text-muted-foreground shrink-0 w-20 text-right">{r.commercialRange}</span>
              </div>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground mt-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Core Codes' : `Show All ${allCodes.length} Codes`}
          {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
        </Button>
        <p className="text-[9px] text-muted-foreground mt-1 italic">
          Source: CMS CY2026 Physician Fee Schedule Final Rule (10/31/2025). Rates are national averages — actual reimbursement varies by locality (GPCI).
        </p>
      </CardContent>
    </Card>
  );
}
