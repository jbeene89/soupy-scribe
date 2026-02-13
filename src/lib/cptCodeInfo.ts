export interface CPTCodeInfo {
  code: string;
  shortDescriptor: string;
  whyAudited: string;
  commonFailures: string[];
  requiredDocumentation: string[];
}

export const CPT_DATABASE: Record<string, CPTCodeInfo> = {
  '99285': {
    code: '99285',
    shortDescriptor: 'Emergency dept visit, high severity',
    whyAudited: 'Highest-level ED code; frequently upcoded from 99284',
    commonFailures: [
      'Insufficient documentation of threat to life/function',
      'Missing critical decision-making complexity',
      'No documentation of multiple interventions',
    ],
    requiredDocumentation: ['Chief complaint with acuity', 'Medical decision-making complexity', 'Interventions performed', 'Time documentation if applicable'],
  },
  '99291': {
    code: '99291',
    shortDescriptor: 'Critical care, first 30-74 minutes',
    whyAudited: 'High-value code requiring precise time documentation',
    commonFailures: [
      'No start/stop times for critical care',
      'Overlap with billable procedures not excluded',
      'Condition does not meet critical care criteria',
    ],
    requiredDocumentation: ['Critical care time statement', 'Start/stop times', 'Separately billable procedures excluded from time', 'Acuity of illness documentation'],
  },
  '99292': {
    code: '99292',
    shortDescriptor: 'Critical care, each additional 30 min',
    whyAudited: 'Add-on code frequently billed without adequate time support',
    commonFailures: [
      'Time not documented separately from 99291',
      'Total time doesn\'t support additional units',
      'Activities during time not critical care',
    ],
    requiredDocumentation: ['Additional time documentation', 'Activities performed during additional time', 'Continuous critical care justification'],
  },
  '36415': {
    code: '36415',
    shortDescriptor: 'Venipuncture, routine collection',
    whyAudited: 'Low-value code sometimes bundled improperly',
    commonFailures: ['Billed separately when included in other services', 'Duplicate billing with 36416'],
    requiredDocumentation: ['Order for laboratory testing', 'Documentation of venous access'],
  },
  '36416': {
    code: '36416',
    shortDescriptor: 'Capillary blood collection (finger/heel)',
    whyAudited: 'May be billed alongside venipuncture inappropriately',
    commonFailures: ['Billed same day as 36415 without justification', 'Not medically necessary given patient access'],
    requiredDocumentation: ['Clinical reason for capillary vs venous', 'Order documentation'],
  },
  '43235': {
    code: '43235',
    shortDescriptor: 'Upper GI endoscopy, diagnostic',
    whyAudited: 'Base procedure that may be unbundled from therapeutic versions',
    commonFailures: ['Billed separately when therapeutic endoscopy performed', 'Medical necessity not documented'],
    requiredDocumentation: ['Indication for procedure', 'Findings documented', 'Medical necessity statement'],
  },
  '43239': {
    code: '43239',
    shortDescriptor: 'Upper GI endoscopy with biopsy',
    whyAudited: 'Often billed with diagnostic scope; biopsy must be justified',
    commonFailures: ['Biopsy not clinically indicated', 'Diagnostic scope billed separately', 'Specimen not sent to pathology'],
    requiredDocumentation: ['Biopsy indication', 'Specimen sent to pathology', 'Pathology report', 'Separate findings requiring biopsy'],
  },
  '29880': {
    code: '29880',
    shortDescriptor: 'Knee arthroscopy, meniscectomy medial & lateral',
    whyAudited: 'High-value surgical code with modifier scrutiny',
    commonFailures: ['Bilateral billing without modifier 50', 'Unbundled from more comprehensive procedures', 'Op note doesn\'t support both compartments'],
    requiredDocumentation: ['Operative note with compartment detail', 'Pre-op imaging', 'Intraoperative findings', 'Medical necessity for surgical approach'],
  },
  '29881': {
    code: '29881',
    shortDescriptor: 'Knee arthroscopy, meniscectomy medial OR lateral',
    whyAudited: 'Must document single compartment vs bilateral work',
    commonFailures: ['Billed with 29880 for same knee', 'Compartment not specified', 'Op note contradicts code selection'],
    requiredDocumentation: ['Specific compartment identified', 'Operative note detail', 'Pre-operative diagnosis', 'Distinct work documentation'],
  },
};

export function getCPTInfo(code: string): CPTCodeInfo | undefined {
  return CPT_DATABASE[code];
}
