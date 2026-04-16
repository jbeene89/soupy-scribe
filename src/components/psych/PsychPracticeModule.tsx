import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Brain, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, DollarSign, FileText, ListChecks,
  TrendingUp, Clock, ArrowRight, ChevronDown, ChevronUp, Zap, Eye, BadgeAlert, Printer
} from 'lucide-react';
import type { PsychCaseInput, PsychAuditResult, PsychBatchSummary } from '@/lib/psychTypes';
import { runPsychAudit, computeBatchSummary } from '@/lib/psychAuditEngine';
import { DEMO_PSYCH_CASES } from '@/lib/psychDemoData';
import { PsychCaseForm } from './PsychCaseForm';
import { PsychCaseDetail } from './PsychCaseDetail';
import { PsychReadinessPacket } from './PsychReadinessPacket';

type ReviewedCase = { input: PsychCaseInput; result: PsychAuditResult };

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

export function PsychPracticeModule() {
  const [cases, setCases] = useState<ReviewedCase[]>(() =>
    DEMO_PSYCH_CASES.map(input => ({ input, result: runPsychAudit(input) }))
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPacket, setShowPacket] = useState<string | null>(null);

  const batch = useMemo(() => computeBatchSummary(cases), [cases]);
  const selectedCase = cases.find(c => c.input.id === selectedCaseId);

  const handleAddCase = (input: PsychCaseInput) => {
    const id = input.id || `case-${Date.now()}`;
    const newInput = { ...input, id };
    setCases(prev => [...prev, { input: newInput, result: runPsychAudit(newInput) }]);
    setShowForm(false);
  };

  const handleDeleteCase = (id: string) => {
    setCases(prev => prev.filter(c => c.input.id !== id));
    if (selectedCaseId === id) setSelectedCaseId(null);
  };

  // Show readiness packet
  if (showPacket) {
    const pc = cases.find(c => c.input.id === showPacket);
    if (pc) return <PsychReadinessPacket caseData={pc} onBack={() => setShowPacket(null)} />;
  }

  // Show case detail
  if (selectedCase) {
    return (
      <PsychCaseDetail
        caseData={selectedCase}
        onBack={() => setSelectedCaseId(null)}
        onViewPacket={() => { setShowPacket(selectedCaseId); setSelectedCaseId(null); }}
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
        <Button size="sm" onClick={() => setShowForm(true)}>
          <ListChecks className="h-4 w-4 mr-1.5" /> Add Claim
        </Button>
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
