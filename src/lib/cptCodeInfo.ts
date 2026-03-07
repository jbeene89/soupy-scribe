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
  '27447': {
    code: '27447',
    shortDescriptor: 'Total knee arthroplasty (TKA)',
    whyAudited: 'High-value joint replacement with frequent add-on code unbundling',
    commonFailures: ['Bone graft billed separately without distinct site', 'Tendon repair bundled into closure billed as separate procedure', 'Implant costs inflated'],
    requiredDocumentation: ['Complete operative note', 'Implant manifest with lot numbers', 'Pre-op imaging', 'Medical necessity for any add-on codes'],
  },
  '20930': {
    code: '20930',
    shortDescriptor: 'Allograft bone, morselized',
    whyAudited: 'Frequently unbundled from arthroplasty and fusion procedures',
    commonFailures: ['Billed with procedures where bone graft is included', 'No separate harvest site documentation', 'Missing implant invoice'],
    requiredDocumentation: ['Graft source and lot number', 'Separate operative indication', 'Invoice for allograft material', 'Modifier 59 documentation if NCCI edit applies'],
  },
  '27380': {
    code: '27380',
    shortDescriptor: 'Suture of infrapatellar tendon',
    whyAudited: 'Almost never billed separately with TKA — typically included in closure',
    commonFailures: ['Billed as add-on to TKA without pre-existing pathology', 'No pre-op imaging showing tendon tear', 'Considered standard closure technique'],
    requiredDocumentation: ['Pre-op MRI showing tendon pathology', 'Separate diagnosis code', 'Distinct operative note section'],
  },
  '22612': {
    code: '22612',
    shortDescriptor: 'Posterior lumbar interbody fusion',
    whyAudited: 'Spine surgery is the #1 audited surgical specialty — multi-code submissions are automatically flagged',
    commonFailures: ['Decompression bundled into fusion approach', 'Incomplete level documentation', 'Missing fluoroscopy confirmation'],
    requiredDocumentation: ['Level-by-level operative documentation', 'Fluoroscopic confirmation images', 'Medical necessity letter', 'Pre-op imaging with measurements'],
  },
  '22614': {
    code: '22614',
    shortDescriptor: 'Posterior fusion, each additional level',
    whyAudited: 'Add-on code requiring independent documentation per level',
    commonFailures: ['Level not separately documented', 'No fluoroscopy for additional level', 'Bundled into primary fusion documentation'],
    requiredDocumentation: ['Separate operative steps per level', 'Intraoperative fluoroscopy per level', 'Medical necessity for multi-level fusion'],
  },
  '22842': {
    code: '22842',
    shortDescriptor: 'Posterior segmental instrumentation, 3-6 vertebral segments',
    whyAudited: 'High-value implant code requiring implant documentation',
    commonFailures: ['Missing implant manifest', 'No lot numbers for screws/rods', 'Segments instrumented not matching operative note'],
    requiredDocumentation: ['Implant manifest with lot numbers', 'Levels instrumented documented', 'Post-op X-ray showing hardware', 'Medical necessity for instrumentation'],
  },
  '63047': {
    code: '63047',
    shortDescriptor: 'Laminectomy, single lumbar segment',
    whyAudited: 'May be bundled with fusion when performed at same level',
    commonFailures: ['Billed with fusion at same level without modifier', 'Decompression considered part of fusion approach', 'Level documentation missing'],
    requiredDocumentation: ['Separate indication for decompression', 'Level documentation with fluoroscopy', 'Modifier 59 if same level as fusion'],
  },
  '44204': {
    code: '44204',
    shortDescriptor: 'Laparoscopic colectomy, partial, with anastomosis',
    whyAudited: 'Conversion to open procedure may not be reflected in coding — upcoding risk',
    commonFailures: ['Laparoscopic code used for converted-to-open procedure', 'Colostomy bundled into Hartmann\'s', 'Anesthesia time inconsistent with laparoscopic approach'],
    requiredDocumentation: ['Operative note confirming laparoscopic completion', 'Intraoperative photos', 'Anesthesia record correlation', 'Conversion documentation if applicable'],
  },
  '44180': {
    code: '44180',
    shortDescriptor: 'Laparoscopic colostomy creation',
    whyAudited: 'Frequently bundled into colectomy when part of planned procedure',
    commonFailures: ['Part of Hartmann\'s procedure billed separately', 'No separate medical necessity', 'Planned colostomy not a distinct service'],
    requiredDocumentation: ['Medical necessity for diversion', 'Documentation of colostomy as separate decision', 'Payer bundling rules checked'],
  },
  '27130': {
    code: '27130',
    shortDescriptor: 'Total hip arthroplasty (THA)',
    whyAudited: 'High-value procedure with potential ORIF unbundling in trauma cases',
    commonFailures: ['ORIF billed separately when THA treats fracture', 'Missing implant documentation', 'Fracture classification not documented'],
    requiredDocumentation: ['Pre-op imaging with fracture classification', 'Operative note with approach', 'Implant manifest', 'Medical necessity if trauma case'],
  },
  '27236': {
    code: '27236',
    shortDescriptor: 'ORIF, femoral fracture, proximal end',
    whyAudited: 'May be unbundled from THA when THA is the definitive fracture treatment',
    commonFailures: ['Billed with THA for simple femoral neck fracture', 'No separate anatomic zone documentation', 'Missing fracture classification'],
    requiredDocumentation: ['AO/OTA fracture classification', 'Pre-op CT showing fracture extent', 'Documentation of separate fixation need', 'Intraoperative fluoroscopy'],
  },
};

export function getCPTInfo(code: string): CPTCodeInfo | undefined {
  return CPT_DATABASE[code];
}
