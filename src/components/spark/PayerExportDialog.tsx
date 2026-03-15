import { useState } from 'react';
import type { AuditCase } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Layers, Check } from 'lucide-react';
import { toast } from 'sonner';

type PayerType = 'medicare' | 'medicaid' | 'commercial';

const PAYER_TEMPLATES: Record<PayerType, {
  id: PayerType;
  name: string;
  description: string;
  appealDeadlineDays: number;
  requiresFields: string[];
  complianceStandards: string[];
  submissionMethod: string[];
}> = {
  medicare: {
    id: 'medicare',
    name: 'Medicare (CMS)',
    description: 'Federal Medicare appeal format following CMS guidelines',
    appealDeadlineDays: 120,
    requiresFields: ['Beneficiary ID', 'Claim Number', 'Date of Service', 'Provider NPI', 'Medical Records', 'Attending Physician Statement'],
    complianceStandards: ['42 CFR §405.904', 'CMS IOM Pub 100-04', 'Medicare Claims Processing Manual Ch. 29'],
    submissionMethod: ['Electronic (esMD)', 'Mail to MAC'],
  },
  medicaid: {
    id: 'medicaid',
    name: 'Medicaid (State)',
    description: 'State Medicaid appeal format with state-specific requirements',
    appealDeadlineDays: 60,
    requiresFields: ['Medicaid ID', 'Prior Authorization Number', 'State Form ID', 'Clinical Documentation', 'Provider Enrollment ID'],
    complianceStandards: ['42 CFR §431.200', 'State Medicaid Manual', 'EPSDT Guidelines (if applicable)'],
    submissionMethod: ['State Portal', 'Certified Mail'],
  },
  commercial: {
    id: 'commercial',
    name: 'Commercial Insurance',
    description: 'Standard commercial payer appeal with ERISA compliance',
    appealDeadlineDays: 180,
    requiresFields: ['Member ID', 'Group Number', 'Claim Reference', 'Clinical Justification', 'Peer-Reviewed Literature'],
    complianceStandards: ['ERISA §503', '29 CFR §2560.503-1', 'NCQA Standards'],
    submissionMethod: ['Payer Portal', 'Fax', 'Mail'],
  },
};

interface PayerExportDialogProps {
  auditCase: AuditCase;
  trigger?: React.ReactNode;
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

function generatePayerExport(auditCase: AuditCase, payerType: PayerType): string {
  const payer = PAYER_TEMPLATES[payerType];
  const violations = auditCase.analyses.flatMap(a => a.violations);
  const metadata = auditCase.metadata as any;

  // V3 module data from metadata (populated by analyze-v3)
  const evidenceSuff = metadata?.evidenceSufficiency;
  const contradictions = metadata?.contradictions;
  const actionPathway = metadata?.actionPathway;
  const decisionTrace = metadata?.decisionTrace;

  let v3Section = '';
  if (evidenceSuff) {
    v3Section += `\nEVIDENCE SUFFICIENCY ANALYSIS
• Overall Score: ${evidenceSuff.overall_score || evidenceSuff.overallScore || 'N/A'}%
• Defensible: ${evidenceSuff.is_defensible ?? evidenceSuff.isDefensible ?? 'N/A'}
• Sufficiency for Approve: ${evidenceSuff.sufficiency_for_approve ?? 'N/A'}%
• Sufficiency for Appeal Defense: ${evidenceSuff.sufficiency_for_appeal_defense ?? 'N/A'}%
`;
  }
  if (contradictions && Array.isArray(contradictions) && contradictions.length > 0) {
    v3Section += `\nCONTRADICTIONS DETECTED (${contradictions.length})
${contradictions.map((c: any) => `• [${c.severity}] ${c.contradiction_type || c.type}: ${c.description}`).join('\n')}
`;
  }
  if (actionPathway) {
    v3Section += `\nENGINE RECOMMENDATION
• Action: ${actionPathway.recommended_action || actionPathway.recommendedAction}
• Rationale: ${actionPathway.action_rationale || actionPathway.actionRationale}
• Confidence: ${actionPathway.confidence_in_recommendation ?? actionPathway.confidence ?? 'N/A'}%
• Human Review Required: ${actionPathway.is_human_review_required ?? actionPathway.isHumanReviewRequired ?? 'N/A'}
`;
  }

  return `${payer.name.toUpperCase()} APPEAL PACKAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CASE INFORMATION
• Case: ${auditCase.caseNumber}
• Physician: ${auditCase.physicianName} (${auditCase.physicianId})
• Patient ID: ${auditCase.patientId}
• Date of Service: ${auditCase.dateOfService}
• Claim Amount: $${auditCase.claimAmount.toLocaleString()}
• CPT Codes: ${auditCase.cptCodes.join(', ')}
• ICD-10 Codes: ${auditCase.icdCodes.join(', ')}
• Consensus Score: ${auditCase.consensusScore}%
• Risk Score: ${auditCase.riskScore?.score ?? 'N/A'}

COMPLIANCE FRAMEWORK
${payer.complianceStandards.map(s => `• ${s}`).join('\n')}

APPEAL DEADLINE: ${payer.appealDeadlineDays} days from denial date
SUBMISSION: ${payer.submissionMethod.join(' | ')}

REQUIRED FIELDS
${payer.requiresFields.map(f => `☐ ${f}`).join('\n')}

AI ANALYSIS SUMMARY (${auditCase.analyses.length} roles)
${auditCase.analyses.map(a => `• ${a.role.toUpperCase()} (${a.model}): ${a.confidence}% confidence — ${a.overallAssessment?.substring(0, 120)}...`).join('\n')}

VIOLATIONS & DEFENSES (${violations.length} total)
${violations.map((v, i) => {
  const bestDefense = v.defenses && v.defenses.length > 0
    ? v.defenses.reduce((best, curr) => curr.strength > best.strength ? curr : best)
    : { strength: 0, strategy: 'No defense analysis available' };
  return `
${i + 1}. ${v.code} — ${v.type} (${v.severity})
   ${v.description}
   Regulation: ${v.regulationRef}
   Best Defense (${bestDefense.strength}%): ${bestDefense.strategy}`;
}).join('\n')}
${v3Section}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated: ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

export function PayerExportDialog({ auditCase, trigger }: PayerExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPayer, setSelectedPayer] = useState<PayerType | null>(null);

  const handlePayerExport = (payerType: PayerType) => {
    const content = generatePayerExport(auditCase, payerType);
    downloadTextFile(content, `${PAYER_TEMPLATES[payerType].name}_Appeal_${auditCase.caseNumber}_${Date.now()}.txt`);
    toast.success(`${PAYER_TEMPLATES[payerType].name} appeal package exported`);
    setOpen(false);
  };

  const handleMultiPayerExport = () => {
    (Object.keys(PAYER_TEMPLATES) as PayerType[]).forEach(type => {
      const content = generatePayerExport(auditCase, type);
      downloadTextFile(content, `${PAYER_TEMPLATES[type].name}_Appeal_${auditCase.caseNumber}_${Date.now()}.txt`);
    });
    toast.success('All 3 payer templates exported');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Appeal Package
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Export Appeal Package</DialogTitle>
          <DialogDescription>
            Choose a payer-specific template optimized for compliance with different insurance requirements
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Payer-Specific Templates</h3>
              <Button variant="outline" size="sm" onClick={handleMultiPayerExport} className="gap-2">
                <Layers className="h-4 w-4" />
                Export All 3 Templates
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.values(PAYER_TEMPLATES)).map((payer) => (
                <Card
                  key={payer.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedPayer === payer.id ? 'border-primary ring-2 ring-primary/20' : ''
                  }`}
                  onClick={() => setSelectedPayer(payer.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{payer.name}</CardTitle>
                      {selectedPayer === payer.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <CardDescription className="text-xs line-clamp-2">
                      {payer.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Appeal Deadline</span>
                        <Badge variant="secondary" className="text-xs">
                          {payer.appealDeadlineDays} days
                        </Badge>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Required Fields:</span>
                        <span className="ml-2 font-semibold">{payer.requiresFields.length}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Compliance Standards:</span>
                        <span className="ml-2 font-semibold">{payer.complianceStandards.length}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePayerExport(payer.id);
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export {payer.name}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {selectedPayer && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">
                  {PAYER_TEMPLATES[selectedPayer].name} Template Details
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Compliance Framework</p>
                    <div className="bg-muted rounded-md p-3 space-y-1">
                      {PAYER_TEMPLATES[selectedPayer].complianceStandards.map((standard, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">• {standard}</p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Required Documentation</p>
                    <div className="bg-muted rounded-md p-3 space-y-1">
                      {PAYER_TEMPLATES[selectedPayer].requiresFields.map((field, idx) => (
                        <p key={idx} className="text-xs text-muted-foreground">☐ {field}</p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Submission Methods</p>
                    <div className="flex flex-wrap gap-2">
                      {PAYER_TEMPLATES[selectedPayer].submissionMethod.map((method, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">{method}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h3 className="text-lg font-semibold mb-3">Generic Export</h3>
            <Button
              variant="outline"
              className="gap-2 justify-start h-auto py-3 w-full"
              onClick={() => {
                const content = `COMPLETE AUDIT PACKAGE\n\nCase: ${auditCase.caseNumber}\nPhysician: ${auditCase.physicianName}\nDOS: ${auditCase.dateOfService}\nClaim: $${auditCase.claimAmount.toLocaleString()}\nCPT: ${auditCase.cptCodes.join(', ')}\nICD-10: ${auditCase.icdCodes.join(', ')}\n\nAI Analyses: ${auditCase.analyses.length}\nViolations: ${auditCase.analyses.flatMap(a => a.violations).length}\n\nGenerated: ${new Date().toLocaleString()}`;
                downloadTextFile(content, `Audit_Package_${auditCase.caseNumber}_${Date.now()}.txt`);
                toast.success('Generic audit package exported');
                setOpen(false);
              }}
            >
              <FileText className="h-5 w-5" />
              <div className="text-left">
                <div className="font-semibold text-sm">Complete Text Package</div>
                <div className="text-xs text-muted-foreground">Full analysis with all AI perspectives</div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
