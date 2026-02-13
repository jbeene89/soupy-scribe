import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckSquare, Gavel } from 'lucide-react';

// Inline payer template data (from Spark's payerExportTemplates)
const PAYER_TEMPLATES = {
  medicare: {
    id: 'medicare' as const,
    name: 'Medicare (CMS)',
    description: 'Federal Medicare appeal format following CMS guidelines',
    appealDeadlineDays: 120,
    requiresFields: ['Beneficiary ID', 'Claim Number', 'Date of Service', 'Provider NPI', 'Medical Records', 'Attending Physician Statement'],
    complianceStandards: ['42 CFR §405.904', 'CMS IOM Pub 100-04', 'Medicare Claims Processing Manual Ch. 29'],
    submissionMethod: ['Electronic (esMD)', 'Mail to MAC'],
  },
  medicaid: {
    id: 'medicaid' as const,
    name: 'Medicaid (State)',
    description: 'State Medicaid appeal format with state-specific requirements',
    appealDeadlineDays: 60,
    requiresFields: ['Medicaid ID', 'Prior Authorization Number', 'State Form ID', 'Clinical Documentation', 'Provider Enrollment ID'],
    complianceStandards: ['42 CFR §431.200', 'State Medicaid Manual', 'EPSDT Guidelines (if applicable)'],
    submissionMethod: ['State Portal', 'Certified Mail'],
  },
  commercial: {
    id: 'commercial' as const,
    name: 'Commercial Insurance',
    description: 'Standard commercial payer appeal with ERISA compliance',
    appealDeadlineDays: 180,
    requiresFields: ['Member ID', 'Group Number', 'Claim Reference', 'Clinical Justification', 'Peer-Reviewed Literature'],
    complianceStandards: ['ERISA §503', '29 CFR §2560.503-1', 'NCQA Standards'],
    submissionMethod: ['Payer Portal', 'Fax', 'Mail'],
  },
};

export function PayerTemplateInfo() {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <CardTitle className="text-lg">Payer-Specific Export Templates</CardTitle>
        </div>
        <CardDescription>
          Professional appeal packages tailored to Medicare, Medicaid, and Commercial insurance requirements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.values(PAYER_TEMPLATES).map((payer) => (
            <div key={payer.id} className="space-y-2">
              <div className="font-semibold text-sm flex items-center justify-between">
                <span>{payer.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {payer.appealDeadlineDays}d
                </Badge>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-start gap-1.5">
                  <CheckSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{payer.requiresFields.length} required fields</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Gavel className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>{payer.complianceStandards.length} compliance standards</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-background rounded-md p-3 text-xs space-y-2">
          <p className="font-semibold">What's included in each payer template:</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Payer-specific documentation checklists</li>
            <li>• Regulatory compliance framework citations</li>
            <li>• Required fields and submission instructions</li>
            <li>• AI-generated defense strategies validated for the payer type</li>
            <li>• Appeal deadline and submission method guidance</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
