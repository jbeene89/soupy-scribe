import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AuditCase, CodeViolation, RoleDefense } from '@/lib/types';
import type { ExportReadinessResult } from '@/lib/caseIntelligence';
import { Shield, Download, ChevronDown, AlertTriangle, CheckCircle, FileText, Copy, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EnhancedAppealSummaryProps {
  auditCase: AuditCase;
  exportReadiness?: ExportReadinessResult;
}

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString();
}

export function EnhancedAppealSummary({ auditCase, exportReadiness }: EnhancedAppealSummaryProps) {
  const allViolations = auditCase.analyses.flatMap(a => a.violations);

  const defaultDefense: RoleDefense = {
    role: 'builder',
    strategy: 'No defense analysis available yet.',
    strengths: [],
    weaknesses: [],
    strength: 0,
  };

  const violationDefenses: { violation: CodeViolation; bestDefense: RoleDefense }[] = allViolations.map(v => {
    if (!v.defenses || v.defenses.length === 0) {
      return { violation: v, bestDefense: defaultDefense };
    }
    const bestDefense = v.defenses.reduce((best, current) =>
      current.strength > best.strength ? current : best
    );
    return { violation: v, bestDefense };
  });

  const avgStrength = violationDefenses.length > 0
    ? Math.round(violationDefenses.reduce((sum, vd) => sum + vd.bestDefense.strength, 0) / violationDefenses.length)
    : 0;

  // Classify violations by defensibility
  const defensibleViolations = violationDefenses.filter(vd => vd.bestDefense.strength >= 50);
  const weakViolations = violationDefenses.filter(vd => vd.bestDefense.strength >= 25 && vd.bestDefense.strength < 50);
  const indefensibleViolations = violationDefenses.filter(vd => vd.bestDefense.strength < 25);

  const keyFlags = auditCase.riskScore?.factors
    .filter(f => f.triggered)
    .map(f => f.title) || [];

  const missingDocs = auditCase.riskScore?.dataCompleteness.missing || [];
  const presentDocs = auditCase.riskScore?.dataCompleteness.present || [];

  const generateDecisionMemo = () => {
    return `DECISION MEMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CASE SUMMARY
• Case: ${auditCase.caseNumber}
• Physician: ${auditCase.physicianName} (${auditCase.physicianId})
• Patient: ${auditCase.patientId}
• Date of Service: ${auditCase.dateOfService}
• Claim Amount: $${auditCase.claimAmount.toLocaleString()}
• CPT Codes: ${auditCase.cptCodes.join(', ')}
• ICD-10: ${auditCase.icdCodes.join(', ')}
• Risk Level: ${auditCase.riskScore?.level.toUpperCase() || 'UNKNOWN'}
• Risk Score: ${auditCase.riskScore?.score}/100 (${auditCase.riskScore?.percentile}th percentile)
• AI Consensus: ${auditCase.consensusScore}%
• Data Completeness: ${auditCase.riskScore?.dataCompleteness.score}%

KEY FLAGS
${keyFlags.length > 0 ? keyFlags.map(f => `• ${f}`).join('\n') : '• None triggered'}

EVIDENCE PRESENT
${presentDocs.map(d => `✓ ${d}`).join('\n')}

EVIDENCE MISSING
${missingDocs.length > 0 ? missingDocs.map(d => `☐ ${d}`).join('\n') : '• No gaps identified'}

VIOLATIONS ANALYZED: ${allViolations.length}
• Defensible (≥50% strength): ${defensibleViolations.length}
• Weak defense (25-49%): ${weakViolations.length}
• Likely indefensible (<25%): ${indefensibleViolations.length}
• Average defense strength: ${avgStrength}%

RECOMMENDATION
${auditCase.riskScore?.recommendation || 'No recommendation available'}

${exportReadiness ? `EXPORT STATUS: ${exportReadiness.label}
${exportReadiness.missingItems.length > 0 ? exportReadiness.missingItems.map(i => `⚠ ${i}`).join('\n') : ''}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: ${formatDateTime(Date.now())}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  };

  const generateDualVoicePackage = () => {
    let doc = `DUAL-VOICE APPEAL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case: ${auditCase.caseNumber} | Physician: ${auditCase.physicianName}
DOS: ${auditCase.dateOfService} | Claim: $${auditCase.claimAmount.toLocaleString()}
CPT Codes: ${auditCase.cptCodes.join(', ')} | ICD-10: ${auditCase.icdCodes.join(', ')}
Risk: ${auditCase.riskScore?.level.toUpperCase()} (${auditCase.riskScore?.score}/100)
Consensus: ${auditCase.consensusScore}%
${exportReadiness ? `Package Status: ${exportReadiness.label}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY FINDINGS
${keyFlags.map(f => `• ${f}`).join('\n') || '• No key flags triggered'}

EVIDENCE PRESENT: ${presentDocs.join(', ')}
EVIDENCE MISSING: ${missingDocs.length > 0 ? missingDocs.join(', ') : 'None identified'}

`;
    violationDefenses.forEach(({ violation, bestDefense }, idx) => {
      doc += `VIOLATION ${idx + 1}: ${violation.code} — ${violation.type}
Severity: ${violation.severity.toUpperCase()} | Regulation: ${violation.regulationRef}
Description: ${violation.description}

DEFENSE (Strength: ${bestDefense.strength}%):
${bestDefense.strategy}

Strengths:
${bestDefense.strengths.map((s, i) => `  ${i + 1}. ${s}`).join('\n') || '  None identified'}

Weaknesses / Likely Failure Points:
${bestDefense.weaknesses.map((w, i) => `  ${i + 1}. ${w}`).join('\n') || '  None identified'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    });

    doc += `\nGenerated: ${formatDateTime(Date.now())}`;
    return doc;
  };

  const downloadMemo = () => {
    downloadTextFile(generateDecisionMemo(), `Decision_Memo_${auditCase.caseNumber}_${Date.now()}.txt`);
    toast.success('Decision memo downloaded');
  };

  const downloadDualVoice = () => {
    downloadTextFile(generateDualVoicePackage(), `Dual_Voice_Appeal_${auditCase.caseNumber}_${Date.now()}.txt`);
    toast.success('Dual-voice appeal package downloaded');
  };

  const copyMemo = () => {
    navigator.clipboard.writeText(generateDecisionMemo());
    toast.success('Decision memo copied to clipboard');
  };

  // Show informative empty state instead of returning null
  if (allViolations.length === 0) {
    return (
      <Card className="border border-muted">
        <CardContent className="py-6 text-center">
          <Shield className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No Violations Identified</p>
          <p className="text-xs text-muted-foreground mt-1">
            AI analysis did not flag specific code violations for this case. This may indicate compliant billing
            or insufficient data for violation detection.
          </p>
          {missingDocs.length > 0 && (
            <div className="mt-3 text-left max-w-md mx-auto">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">Missing documentation that could affect assessment:</p>
              {missingDocs.map((d, i) => (
                <p key={i} className="text-[11px] text-muted-foreground">• {d}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-accent/30">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-accent" />
            <div>
              <CardTitle className="text-base">Dual-Voice Appeal Analysis</CardTitle>
              <CardDescription className="mt-0.5">
                {allViolations.length} violation{allViolations.length !== 1 ? 's' : ''} analyzed •
                {defensibleViolations.length} defensible • {weakViolations.length} weak • {indefensibleViolations.length} likely indefensible
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(
              'text-xs',
              avgStrength >= 60 ? 'bg-consensus text-consensus-foreground' :
              avgStrength >= 40 ? 'bg-disagreement text-disagreement-foreground' :
              'bg-destructive text-destructive-foreground'
            )}>
              {avgStrength}% Avg Strength
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-4">
        <Tabs defaultValue="dual-voice" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dual-voice">Dual-Voice Analysis</TabsTrigger>
            <TabsTrigger value="decision-memo">Decision Memo</TabsTrigger>
          </TabsList>

          <TabsContent value="dual-voice" className="space-y-3 mt-3">
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {violationDefenses.map(({ violation, bestDefense }) => (
                <Card key={violation.id} className="border">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-semibold bg-muted px-2 py-0.5 rounded">
                          {violation.code}
                        </code>
                        <span className="text-xs font-medium capitalize">{violation.type.replace('-', ' ')}</span>
                        <Badge variant={violation.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px]">
                          {violation.severity}
                        </Badge>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px]",
                        bestDefense.strength >= 50 ? "border-consensus/30 text-consensus" :
                        bestDefense.strength >= 25 ? "border-disagreement/30 text-disagreement" :
                        "border-violation/30 text-violation"
                      )}>
                        {bestDefense.strength}% strength
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 px-4 pb-3">
                    <p className="text-xs text-muted-foreground">{violation.description}</p>

                    <div className="p-2.5 bg-consensus/10 rounded-md border border-consensus/20">
                      <div className="flex items-center gap-2 mb-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-consensus" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">Defense Points</span>
                      </div>
                      <p className="text-xs">{bestDefense.strategy}</p>
                      {bestDefense.strengths.length > 0 && (
                        <ul className="text-[11px] mt-1.5 space-y-0.5 text-muted-foreground">
                          {bestDefense.strengths.slice(0, 3).map((s, idx) => (
                            <li key={idx}>• {s}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="p-2.5 bg-destructive/10 rounded-md border border-destructive/20">
                      <div className="flex items-center gap-2 mb-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        <span className="text-[10px] font-semibold uppercase tracking-wide">Likely Failure Points</span>
                      </div>
                      {bestDefense.weaknesses.length > 0 ? (
                        <ul className="text-xs space-y-0.5">
                          {bestDefense.weaknesses.map((w, idx) => (
                            <li key={idx}>• {w}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">
                          Requires complete documentation review to identify vulnerabilities.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="decision-memo" className="mt-3">
            <div className="p-3 bg-muted/50 rounded-md font-mono text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
              {generateDecisionMemo()}
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Package
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={downloadDualVoice}>
                <FileText className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">Dual-Voice Appeal Package</span>
                  <span className="text-xs text-muted-foreground">Defense + failure points</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadMemo}>
                <FileText className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">Decision Memo</span>
                  <span className="text-xs text-muted-foreground">Summary with evidence status</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyMemo}>
                <Copy className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">Copy Memo</span>
                  <span className="text-xs text-muted-foreground">Clipboard-ready</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
