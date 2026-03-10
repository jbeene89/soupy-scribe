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
import { Shield, Download, ChevronDown, AlertTriangle, CheckCircle, FileText, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface EnhancedAppealSummaryProps {
  auditCase: AuditCase;
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

export function EnhancedAppealSummary({ auditCase }: EnhancedAppealSummaryProps) {
  // Collect all violations with their best defenses
  const allViolations = auditCase.analyses.flatMap(a => a.violations);

  if (allViolations.length === 0) {
    return null;
  }

  const defaultDefense: RoleDefense = {
    role: 'builder',
    strategy: 'No defense analysis available yet.',
    strengths: [],
    weaknesses: [],
    strength: 0,
  };

  // Group defenses by violation
  const violationDefenses: { violation: CodeViolation; bestDefense: RoleDefense }[] = allViolations.map(v => {
    if (!v.defenses || v.defenses.length === 0) {
      return { violation: v, bestDefense: defaultDefense };
    }
    const bestDefense = v.defenses.reduce((best, current) =>
      current.strength > best.strength ? current : best
    );
    return { violation: v, bestDefense };
  });

  const avgStrength = Math.round(
    violationDefenses.reduce((sum, vd) => sum + vd.bestDefense.strength, 0) / violationDefenses.length
  );

  const generateDecisionMemo = () => {
    const keyFlags = auditCase.riskScore?.factors
      .filter(f => f.triggered)
      .map(f => f.title)
      .join(', ') || 'None';

    return `DECISION MEMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

KEY FLAGS TRIGGERED
${keyFlags}

VIOLATIONS ANALYZED
${allViolations.length} total violations with AI-generated defenses reviewed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: ${formatDateTime(Date.now())}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  };

  const generateDualVoicePackage = () => {
    let doc = `DUAL-VOICE APPEAL ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Case: ${auditCase.caseNumber} | Physician: ${auditCase.physicianName}
DOS: ${auditCase.dateOfService} | Claim: $${auditCase.claimAmount.toLocaleString()}
CPT Codes: ${auditCase.cptCodes.join(', ')} | ICD-10: ${auditCase.icdCodes.join(', ')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    violationDefenses.forEach(({ violation, bestDefense }, idx) => {
      doc += `VIOLATION ${idx + 1}: ${violation.code} - ${violation.type}
Severity: ${violation.severity.toUpperCase()} | Regulation: ${violation.regulationRef}
Description: ${violation.description}

DEFENSE (Strength: ${bestDefense.strength}%):
${bestDefense.strategy}

Strengths:
${bestDefense.strengths.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}

Weaknesses:
${bestDefense.weaknesses.map((w, i) => `  ${i + 1}. ${w}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  return (
    <Card className="border-2 border-accent bg-accent/5">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-accent" />
            <div>
              <CardTitle className="text-xl">Dual-Voice Appeal Analysis</CardTitle>
              <CardDescription className="mt-1">
                Defense strategies AND vulnerabilities for {allViolations.length} violation{allViolations.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
          </div>
          <Badge className={
            avgStrength >= 80 ? 'bg-consensus text-consensus-foreground' :
            avgStrength >= 60 ? 'bg-info-blue text-info-blue-foreground' :
            avgStrength >= 40 ? 'bg-disagreement text-disagreement-foreground' :
            'bg-destructive text-destructive-foreground'
          }>
            {avgStrength}% Avg Strength
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="dual-voice" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dual-voice">Dual-Voice Analysis</TabsTrigger>
            <TabsTrigger value="decision-memo">Decision Memo</TabsTrigger>
          </TabsList>

          <TabsContent value="dual-voice" className="space-y-4 mt-4">
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {violationDefenses.map(({ violation, bestDefense }) => (
                <Card key={violation.id} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-semibold bg-muted px-2 py-1 rounded">
                          {violation.code}
                        </code>
                        <span className="text-sm font-medium capitalize">{violation.type.replace('-', ' ')}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {bestDefense.strength}% strength
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-consensus/10 rounded-md border border-consensus/20">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-4 w-4 text-consensus" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          Defense (If Codes Correct)
                        </span>
                      </div>
                      <p className="text-sm">{bestDefense.strategy}</p>
                      {bestDefense.strengths.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-consensus/20">
                          <div className="text-xs font-medium mb-1">Strengths:</div>
                          <ul className="text-xs space-y-1">
                            {bestDefense.strengths.slice(0, 3).map((s, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <span>•</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-xs font-semibold uppercase tracking-wide">
                          Vulnerabilities (What Could Fail)
                        </span>
                      </div>
                      {bestDefense.weaknesses.length > 0 ? (
                        <ul className="text-sm space-y-1">
                          {bestDefense.weaknesses.map((w, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span>•</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">
                          Vulnerability analysis requires complete documentation review
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="decision-memo" className="mt-4">
            <div className="p-4 bg-muted/50 rounded-md font-mono text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
              {generateDecisionMemo()}
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
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
                  <span className="text-xs text-muted-foreground">Defense + vulnerabilities</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadMemo}>
                <FileText className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">1-Page Decision Memo</span>
                  <span className="text-xs text-muted-foreground">Summary with disposition</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyMemo}>
                <Copy className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span className="font-medium">Copy Decision Memo</span>
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
