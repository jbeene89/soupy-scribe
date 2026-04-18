import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  DollarSign, TrendingUp, Zap, Brain, BadgeAlert, Lightbulb, Wrench, Printer, FileText
} from 'lucide-react';
import type { PsychCaseInput, PsychAuditResult } from '@/lib/psychTypes';
import type { ParsedNote } from '@/lib/crosswalkTypes';
import { PsychTLDRCard } from './PsychTLDRCard';
import { StandardizedScalesPanel } from './StandardizedScalesPanel';
import { PsychAddDocumentDialog } from './PsychAddDocumentDialog';

type CaseData = {
  input: PsychCaseInput;
  result: PsychAuditResult;
  versions?: { version: number }[];
  addedDocuments?: { label: string; text: string; addedAt: string }[];
  clinicalNote?: ParsedNote | null;
};

export function PsychReadinessPacket({ caseData, onBack, onAddDocument }: {
  caseData: CaseData;
  onBack: () => void;
  onAddDocument?: (label: string, text: string) => void;
}) {
  const { input, result, versions = [], addedDocuments = [] } = caseData;
  const fails = result.checklist.filter(c => c.status === 'fail');
  const warnings = result.checklist.filter(c => c.status === 'warning');

  return (
    <div className="space-y-4 max-w-3xl mx-auto print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <div className="flex items-center gap-2">
          {onAddDocument && (
            <PsychAddDocumentDialog
              caseLabel={input.patientLabel || input.id || 'case'}
              currentVersion={versions.length || 1}
              onAddDocument={onAddDocument}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
        </div>
      </div>


      {/* Header */}
      <div className="text-center py-4 border-b">
        <h1 className="text-lg font-bold text-foreground">Pre-Submission Readiness Report</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {input.patientLabel || 'Unidentified'} · {input.cptCode} · {input.dateOfService || 'No date'} · {input.payerName || 'No payer'}
        </p>
        <p className="text-[10px] text-muted-foreground italic mt-2">
          This is a pre-submission review tool for documentation strengthening and denial prevention. It is not legal advice or autonomous billing approval.
        </p>
      </div>

      {/* TL;DR — first thing the reader sees in the printed packet */}
      <PsychTLDRCard result={result} />

      {/* Score & Recommendation */}

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-4xl font-bold text-foreground">{result.score}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Readiness Score</p>
            <Progress value={result.score} className="h-2 mt-2" />
          </CardContent>
        </Card>
        <Card className={cn(
          result.submitRecommendation === 'submit-now' ? 'border-emerald-500/30' :
          result.submitRecommendation === 'fix-first' ? 'border-amber-500/30' :
          'border-destructive/30'
        )}>
          <CardContent className="pt-4 text-center">
            {result.submitRecommendation === 'submit-now' ? <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" /> :
             result.submitRecommendation === 'fix-first' ? <Wrench className="h-8 w-8 text-amber-500 mx-auto" /> :
             <BadgeAlert className="h-8 w-8 text-destructive mx-auto" />}
            <p className="text-sm font-bold mt-2">
              {result.submitRecommendation === 'submit-now' ? 'Submit Now' :
               result.submitRecommendation === 'fix-first' ? 'Fix First' : 'Human Review'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fails.length} issues · {warnings.length} warnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Major Risk Factors */}
      {result.denialRiskFactors.length > 0 && (
        <Section icon={AlertTriangle} title="Major Denial Risk Factors" iconColor="text-destructive">
          <ul className="space-y-1">
            {result.denialRiskFactors.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Missing Items */}
      {fails.length > 0 && (
        <Section icon={FileText} title="Missing or Failed Items" iconColor="text-amber-500">
          <div className="space-y-1.5">
            {fails.map(item => (
              <div key={item.id} className="flex items-start gap-2 text-xs">
                <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{item.label}</span>
                  {item.isCurable && <Badge className="ml-1 text-[8px] bg-emerald-500/10 text-emerald-600 border-0 py-0">Curable</Badge>}
                  {item.correction && <p className="text-muted-foreground mt-0.5">{item.correction}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Smallest Fixes */}
      {result.smallestFixes.length > 0 && (
        <Section icon={Zap} title="Smallest Fix Before Submission" iconColor="text-amber-500">
          <ol className="space-y-1.5">
            {result.smallestFixes.map((fix, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-muted-foreground font-bold shrink-0">{fix.priority}.</span>
                <span className="text-foreground">{fix.description}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Payer Warnings */}
      {result.payerWarnings.length > 0 && (
        <Section icon={BadgeAlert} title="Payer-Sensitive Warnings" iconColor="text-amber-500">
          <ul className="space-y-1">
            {result.payerWarnings.map((w, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" /> {w}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* MDM Review */}
      {result.mdmReview && (
        <Section icon={Brain} title="E/M Medical Decision Making Review" iconColor="text-violet-500">
          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            {(['problemComplexity', 'dataComplexity', 'riskLevel'] as const).map(key => (
              <div key={key} className="text-center rounded-md border p-2">
                <p className="text-[10px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-xs font-bold capitalize">{result.mdmReview![key]}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{result.mdmReview.explanation}</p>
          {result.mdmReview.higherCodeOpportunity && (
            <p className="text-xs text-blue-500 mt-1">💰 {result.mdmReview.higherCodeOpportunity}</p>
          )}
        </Section>
      )}

      {/* Missed Revenue */}
      {result.missedRevenue.length > 0 && (
        <Section icon={DollarSign} title="Possible Missed Revenue" iconColor="text-blue-500">
          <p className="text-[10px] text-muted-foreground italic mb-2">Review recommended — not automatic billing advice.</p>
          {result.missedRevenue.map((m, i) => (
            <div key={i} className="text-xs mb-2">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[9px]">{m.currentCode}</Badge>
                {m.suggestedCode && <><span>→</span><Badge variant="outline" className="text-[9px]">{m.suggestedCode}</Badge></>}
                {m.estimatedDifference && <span className="text-blue-500 font-medium ml-1">+${m.estimatedDifference}</span>}
              </div>
              <p className="text-muted-foreground mt-0.5">{m.description}</p>
            </div>
          ))}
        </Section>
      )}

      {/* Footer */}
      <div className="text-center py-3 border-t text-[10px] text-muted-foreground">
        <p>Generated by SOUPY · Pre-Submission Payment Integrity Support · Not legal or clinical advice</p>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, iconColor, children }: { icon: any; title: string; iconColor: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Icon className={cn('h-4 w-4', iconColor)} /> {title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
