import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, XCircle, CheckCircle2, DollarSign,
  TrendingUp, Zap, FileText, Brain, Printer, BadgeAlert, Lightbulb, Wrench,
  ChevronDown, ChevronUp, Clock, ListChecks
} from 'lucide-react';
import type { PsychCaseInput, PsychAuditResult, MissedRevenueItem } from '@/lib/psychTypes';
import { PsychTLDRCard } from './PsychTLDRCard';

type CaseData = { input: PsychCaseInput; result: PsychAuditResult };

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warning' }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === 'fail') return <XCircle className="h-4 w-4 text-destructive" />;
  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
}

function readinessInfo(r: PsychAuditResult) {
  if (r.overallReadiness === 'ready') return { color: 'text-emerald-500', label: 'Ready to Submit', bg: 'bg-emerald-500/10' };
  if (r.overallReadiness === 'needs-attention') return { color: 'text-amber-500', label: 'Fix Before Submitting', bg: 'bg-amber-500/10' };
  return { color: 'text-destructive', label: 'Not Ready — Fix Issues First', bg: 'bg-destructive/10' };
}

export function PsychCaseDetail({ caseData, onBack, onViewPacket }: {
  caseData: CaseData; onBack: () => void; onViewPacket: () => void;
}) {
  const { input, result } = caseData;
  const ri = readinessInfo(result);
  const fails = result.checklist.filter(c => c.status === 'fail');
  const warnings = result.checklist.filter(c => c.status === 'warning');
  const passes = result.checklist.filter(c => c.status === 'pass');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <Button variant="outline" size="sm" onClick={onViewPacket}><Printer className="h-4 w-4 mr-1" /> Submission Packet</Button>
      </div>

      {/* TL;DR — top-of-page bullet summary for non-coders */}
      <PsychTLDRCard result={result} />


      {/* Score */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center', ri.bg)}>
                <ShieldCheck className={cn('h-5 w-5', ri.color)} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{input.patientLabel || input.id}</p>
                <p className={cn('text-xs font-bold', ri.color)}>{ri.label}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground">{result.score}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score</p>
            </div>
          </div>
          <Progress value={result.score} className="h-2" />
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>{input.cptCode} · {input.sessionDurationMinutes} min · {input.payerName || 'No payer'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Submit Recommendation */}
      <Card className={cn(
        result.submitRecommendation === 'submit-now' ? 'border-emerald-500/30 bg-emerald-500/5' :
        result.submitRecommendation === 'fix-first' ? 'border-amber-500/30 bg-amber-500/5' :
        'border-destructive/30 bg-destructive/5'
      )}>
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2">
            {result.submitRecommendation === 'submit-now' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
             result.submitRecommendation === 'fix-first' ? <Wrench className="h-4 w-4 text-amber-500" /> :
             <BadgeAlert className="h-4 w-4 text-destructive" />}
            <p className="text-sm font-medium">
              {result.submitRecommendation === 'submit-now' ? 'This claim looks ready to submit.' :
               result.submitRecommendation === 'fix-first' ? 'Fix the issues below before submitting — most are correctable.' :
               'This claim needs human review before submission.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Smallest Fixes */}
      {result.smallestFixes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> Smallest Fix Before Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {result.smallestFixes.map((fix, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <Badge variant="outline" className="text-[9px] mt-0.5 shrink-0">#{fix.priority}</Badge>
                  <div>
                    <p className="text-foreground">{fix.description}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-[9px]">{fix.effort} fix</Badge>
                      <Badge variant={fix.impact === 'high' ? 'destructive' : 'secondary'} className="text-[9px]">{fix.impact} impact</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* MDM Review */}
      {result.mdmReview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Brain className="h-4 w-4 text-violet-500" /> E/M Medical Decision Making Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <MDMCell label="Problems" level={result.mdmReview.problemComplexity} />
              <MDMCell label="Data" level={result.mdmReview.dataComplexity} />
              <MDMCell label="Risk" level={result.mdmReview.riskLevel} />
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">Overall MDM:</p>
              <Badge className="capitalize">{result.mdmReview.overallMDM}</Badge>
              <span className="text-xs">→</span>
              <Badge variant="outline">{result.mdmReview.supportedEMCode}</Badge>
              <Badge variant={result.mdmReview.supportStrength === 'strong' ? 'default' : result.mdmReview.supportStrength === 'weak' ? 'destructive' : 'secondary'} className="text-[9px]">
                {result.mdmReview.supportStrength} support
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{result.mdmReview.explanation}</p>
            {result.mdmReview.higherCodeOpportunity && (
              <div className="rounded-md bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400 flex items-start gap-2">
                <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {result.mdmReview.higherCodeOpportunity}
              </div>
            )}
            {result.mdmReview.downgradeRisk && (
              <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {result.mdmReview.downgradeRisk}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Missed Revenue */}
      {result.missedRevenue.length > 0 && (
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-blue-500" /> Possible Missed Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground mb-3 italic">These are coding opportunities for review — not automatic billing advice.</p>
            <div className="space-y-3">
              {result.missedRevenue.map((m, i) => (
                <RevenueOpportunityCard key={i} item={m} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payer Warnings */}
      {result.payerWarnings.length > 0 && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><BadgeAlert className="h-4 w-4 text-amber-500" /> Payer-Specific Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground mb-2 italic">Based on common payer review behavior — not guaranteed payer rules.</p>
            <ul className="space-y-1.5">
              {result.payerWarnings.map((w, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Note Quality */}
      {result.noteQualityIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-violet-500" /> Note Quality Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground mb-2 italic">Constructive suggestions to strengthen your documentation.</p>
            <ul className="space-y-1.5">
              {result.noteQualityIssues.map((issue, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                  <Lightbulb className="h-3 w-3 text-violet-400 mt-0.5 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Full Checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" /> Full Pre-Submission Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {result.checklist
              .sort((a, b) => ({ fail: 0, warning: 1, pass: 2 }[a.status] - { fail: 0, warning: 1, pass: 2 }[b.status]))
              .map(item => (
                <div key={item.id} className={cn(
                  'rounded-md border-l-4 p-3',
                  item.status === 'fail' ? 'border-l-destructive bg-destructive/5' :
                  item.status === 'warning' ? 'border-l-amber-500 bg-amber-500/5' :
                  'border-l-emerald-500'
                )}>
                  <div className="flex items-start gap-2">
                    <StatusIcon status={item.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-foreground">{item.label}</span>
                        <Badge variant="outline" className="text-[9px] capitalize">{item.category}</Badge>
                        {item.status !== 'pass' && item.isCurable && (
                          <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 border-0">Curable</Badge>
                        )}
                      </div>
                      {item.status !== 'pass' && (
                        <>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{item.detail}</p>
                          {item.correction && (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-start gap-1">
                              <Wrench className="h-3 w-3 mt-0.5 shrink-0" /> {item.correction}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MDMCell({ label, level }: { label: string; level: string }) {
  const color = level === 'high' ? 'text-destructive' : level === 'moderate' ? 'text-amber-500' : 'text-emerald-500';
  return (
    <div className="text-center rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-xs font-bold capitalize', color)}>{level}</p>
    </div>
  );
}

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'same-day': { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Same Day' },
  'this-week': { bg: 'bg-blue-500/10', text: 'text-blue-600', label: 'This Week' },
  '2-4 weeks': { bg: 'bg-amber-500/10', text: 'text-amber-600', label: '2–4 Weeks' },
  '1-3 months': { bg: 'bg-violet-500/10', text: 'text-violet-600', label: '1–3 Months' },
};

function RevenueOpportunityCard({ item }: { item: MissedRevenueItem }) {
  const [expanded, setExpanded] = useState(false);
  const cx = item.complexity ? COMPLEXITY_COLORS[item.complexity] : null;

  return (
    <div className="rounded-md border p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant="outline" className="text-[9px]">{item.currentCode}</Badge>
          {item.suggestedCode && <><span>→</span><Badge className="text-[9px] bg-blue-500/10 text-blue-600 border-0">{item.suggestedCode}</Badge></>}
          {item.estimatedDifference && <span className="text-blue-500 font-medium">+${item.estimatedDifference}</span>}
        </div>
        {cx && (
          <Badge className={cn('text-[9px] border-0 shrink-0', cx.bg, cx.text)}>
            <Clock className="h-2.5 w-2.5 mr-1" />
            {cx.label}
          </Badge>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-foreground">{item.description}</p>

      {/* Timeline */}
      {item.timeToImplement && (
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground bg-secondary/50 rounded px-2.5 py-1.5">
          <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/70" />
          <span><span className="font-medium text-foreground/80">Timeline:</span> {item.timeToImplement}</span>
        </div>
      )}

      {/* Action + confidence */}
      <p className="text-[10px] text-muted-foreground">{item.requiredAction}</p>
      <Badge variant="secondary" className="text-[9px] capitalize">{item.confidence.replace('-', ' ')}</Badge>

      {/* Implementation plan toggle */}
      {item.implementationPlan && item.implementationPlan.length > 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-[10px] text-muted-foreground h-7 mt-1"
            onClick={() => setExpanded(!expanded)}
          >
            <ListChecks className="h-3 w-3 mr-1" />
            {expanded ? 'Hide' : 'Show'} Implementation Plan ({item.implementationPlan.length} steps)
            {expanded ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>

          {expanded && (
            <div className="space-y-2 pt-1 border-t border-border/50">
              {item.implementationPlan.map((step) => (
                <div key={step.step} className="flex gap-2.5">
                  <div className="flex flex-col items-center shrink-0">
                    <div className="h-5 w-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-bold text-blue-600">
                      {step.step}
                    </div>
                    {step.step < item.implementationPlan!.length && <div className="w-px flex-1 bg-border/50 mt-0.5" />}
                  </div>
                  <div className="pb-2 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">{step.action}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
