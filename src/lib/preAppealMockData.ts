import type { PreAppealResolution } from './preAppealTypes';

// Case 1: Denial resolved with one missing document
const case001Resolution: PreAppealResolution = {
  caseId: 'AUD-2024-001',
  denialReason: 'Insufficient documentation to support medical necessity for arthroscopic procedure',
  curability: 'curable-with-records',
  issues: [
    {
      id: 'iss-1',
      category: 'missing-documentation',
      title: 'Missing pre-operative MRI report',
      description: 'The MRI confirming internal derangement was not included in the original submission. This is typically the primary support for arthroscopic intervention.',
      isCurable: true,
      clarificationNeeded: 'Submit MRI report showing structural findings that justified surgical intervention',
      supportingEvidence: ['MRI dated within 90 days of procedure'],
    },
    {
      id: 'iss-2',
      category: 'medical-necessity',
      title: 'Conservative treatment timeline unclear',
      description: 'Documentation does not clearly establish the duration and failure of conservative treatment prior to surgical intervention.',
      isCurable: true,
      clarificationNeeded: 'Provide physical therapy records or office notes showing conservative treatment course',
      supportingEvidence: ['PT records', 'Office visit notes over 6-week period'],
    },
  ],
  resolution: {
    likelihood: 'likely-resolvable-records',
    confidence: 82,
    whatIsMissing: ['Pre-operative MRI report', 'Conservative treatment documentation'],
    whatWouldChangeResult: ['MRI showing meniscal tear or structural pathology', 'Documentation of 6+ weeks conservative treatment failure'],
  },
  evidenceChecklist: [
    { id: 'ev-1', record: 'Pre-operative MRI report', priority: 'required', whyItMatters: 'Primary imaging evidence supporting surgical necessity', linkedIssueCategory: 'missing-documentation', supportsQuickReconsideration: true, absencePushesToAppeal: true },
    { id: 'ev-2', record: 'Physical therapy records', priority: 'required', whyItMatters: 'Demonstrates conservative treatment was attempted and failed', linkedIssueCategory: 'medical-necessity', supportsQuickReconsideration: true, absencePushesToAppeal: true },
    { id: 'ev-3', record: 'Operative report', priority: 'helpful', whyItMatters: 'Confirms findings consistent with pre-op imaging', linkedIssueCategory: 'medical-necessity', supportsQuickReconsideration: true, absencePushesToAppeal: false },
    { id: 'ev-4', record: 'Post-operative follow-up notes', priority: 'unlikely-to-change-outcome', whyItMatters: 'Supports procedure appropriateness but not decisive for reconsideration', linkedIssueCategory: 'medical-necessity', supportsQuickReconsideration: false, absencePushesToAppeal: false },
  ],
  recommendedDisposition: 'gather-more-records',
  providerSummary: {
    whyResolvableQuickly: 'This denial appears to stem primarily from missing imaging documentation. The procedure itself is well-supported by the operative findings; the gap is in the pre-operative record submission.',
    exactlyNeeded: ['Pre-operative MRI report', 'Physical therapy or conservative treatment records covering at least 6 weeks'],
    doNotWasteTimeOn: ['Peer-to-peer review at this stage', 'Drafting a formal appeal letter before gathering records'],
    appearsCurable: true,
    fullAppealPoorUse: true,
  },
  payerSummary: {
    issueAppearsCurable: true,
    clarificationNeeded: ['Pre-operative imaging confirming structural pathology', 'Conservative treatment course documentation'],
    partialReversalPossible: false,
    denialStandsWithoutSupport: true,
    moveToStandardAppeal: false,
  },
};

// Case 2: Denial resolved through coding clarification
const case002Resolution: PreAppealResolution = {
  caseId: 'AUD-2024-002',
  denialReason: 'Modifier 59 applied without sufficient documentation of distinct procedural service',
  curability: 'curable-with-coding',
  issues: [
    {
      id: 'iss-3',
      category: 'coding-clarification',
      title: 'Modifier 59 support insufficient',
      description: 'The claim includes Modifier 59 on the secondary procedure but the operative note does not clearly delineate separate procedural sites or sessions.',
      isCurable: true,
      clarificationNeeded: 'Clarify that procedures were performed at anatomically distinct sites or through separate incisions',
      supportingEvidence: ['Operative note with distinct site documentation'],
    },
    {
      id: 'iss-4',
      category: 'modifier-support',
      title: 'Consider XS modifier substitution',
      description: 'CMS guidance recommends XS (separate structure) modifier when applicable, which may be more precise than Modifier 59 for this scenario.',
      isCurable: true,
      clarificationNeeded: 'Evaluate whether XS modifier more accurately describes the distinct service',
      supportingEvidence: ['CMS NCCI modifier guidelines'],
    },
  ],
  resolution: {
    likelihood: 'likely-resolvable-clarification',
    confidence: 88,
    whatIsMissing: ['Clear operative note language describing distinct sites', 'Appropriate modifier selection documentation'],
    whatWouldChangeResult: ['Operative report addendum clarifying distinct procedural sites', 'Coding correction from Mod 59 to XS if more appropriate'],
  },
  evidenceChecklist: [
    { id: 'ev-5', record: 'Operative report with site differentiation', priority: 'required', whyItMatters: 'Must clearly show procedures were at separate sites', linkedIssueCategory: 'coding-clarification', supportsQuickReconsideration: true, absencePushesToAppeal: true },
    { id: 'ev-6', record: 'Coding rationale letter', priority: 'helpful', whyItMatters: 'Explains modifier selection and clinical justification', linkedIssueCategory: 'modifier-support', supportsQuickReconsideration: true, absencePushesToAppeal: false },
  ],
  recommendedDisposition: 'correct-and-resubmit',
  providerSummary: {
    whyResolvableQuickly: 'This appears to be a modifier documentation issue rather than a substantive clinical concern. Clarifying the distinct procedural sites in the operative report should resolve the denial.',
    exactlyNeeded: ['Operative report showing distinct anatomical sites', 'Consider modifier correction from 59 to XS'],
    doNotWasteTimeOn: ['Full medical necessity appeal', 'Peer-to-peer before coding clarification'],
    appearsCurable: true,
    fullAppealPoorUse: true,
  },
  payerSummary: {
    issueAppearsCurable: true,
    clarificationNeeded: ['Operative note language confirming distinct procedural sites'],
    partialReversalPossible: false,
    denialStandsWithoutSupport: true,
    moveToStandardAppeal: false,
  },
};

// Case 3: Partial resolution through downcode
const case003Resolution: PreAppealResolution = {
  caseId: 'AUD-2024-003',
  denialReason: 'E/M level 99215 not supported by documentation; insufficient complexity elements documented',
  curability: 'partial-resolution',
  issues: [
    {
      id: 'iss-5',
      category: 'documentation-contradiction',
      title: 'MDM complexity not fully supported',
      description: 'The visit note documents moderate complexity MDM elements but the billed level requires high complexity. Two of three MDM elements meet moderate, not high, threshold.',
      isCurable: false,
      clarificationNeeded: 'Review whether additional complexity elements were present but undocumented',
      supportingEvidence: ['Visit note', 'Problem list', 'Orders placed during visit'],
    },
    {
      id: 'iss-6',
      category: 'coding-clarification',
      title: 'Potential downcode to 99214',
      description: 'Documentation appears to support 99214 (moderate complexity) rather than the billed 99215 (high complexity).',
      isCurable: true,
      clarificationNeeded: 'Accept downcode to 99214 or provide additional MDM documentation',
      supportingEvidence: ['Revised coding worksheet'],
    },
  ],
  resolution: {
    likelihood: 'partially-resolvable',
    confidence: 75,
    whatIsMissing: ['Documentation of high-complexity MDM elements', 'Data reviewed and ordered during encounter'],
    whatWouldChangeResult: ['Addendum documenting additional data reviewed', 'Acceptance of 99214 payment level'],
  },
  evidenceChecklist: [
    { id: 'ev-7', record: 'Complete visit note with MDM documentation', priority: 'required', whyItMatters: 'Must show all three MDM elements to support 99215', linkedIssueCategory: 'documentation-contradiction', supportsQuickReconsideration: true, absencePushesToAppeal: true },
    { id: 'ev-8', record: 'Data reviewed log or EHR audit trail', priority: 'helpful', whyItMatters: 'May demonstrate additional complexity not captured in note', linkedIssueCategory: 'coding-clarification', supportsQuickReconsideration: true, absencePushesToAppeal: false },
  ],
  recommendedDisposition: 'correct-and-resubmit',
  providerSummary: {
    whyResolvableQuickly: 'The documentation supports a moderate-complexity visit but not the billed high-complexity level. A partial resolution through downcode acceptance may be the most efficient path.',
    exactlyNeeded: ['Decision on whether to accept 99214 downcode', 'If contesting: addendum with additional MDM documentation'],
    doNotWasteTimeOn: ['Full appeal for 99215 unless additional MDM elements can be documented', 'Peer-to-peer without updated documentation'],
    appearsCurable: true,
    fullAppealPoorUse: false,
  },
  payerSummary: {
    issueAppearsCurable: true,
    clarificationNeeded: ['MDM element documentation for high complexity threshold'],
    partialReversalPossible: true,
    denialStandsWithoutSupport: true,
    moveToStandardAppeal: false,
  },
};

// Case 4: Should go to formal appeal
const case004Resolution: PreAppealResolution = {
  caseId: 'AUD-2024-004',
  denialReason: 'Procedure deemed not medically necessary based on clinical criteria; patient did not meet InterQual threshold',
  curability: 'formal-appeal-appropriate',
  issues: [
    {
      id: 'iss-7',
      category: 'medical-necessity',
      title: 'Clinical criteria threshold not met per payer guidelines',
      description: 'The payer applied InterQual criteria and determined the patient did not meet the medical necessity threshold for inpatient admission. The provider disagrees with the clinical determination.',
      isCurable: false,
      clarificationNeeded: 'This requires clinical review and peer-to-peer discussion, not simple documentation submission',
      supportingEvidence: ['Complete inpatient record', 'Physician attestation', 'Clinical guidelines supporting admission'],
    },
    {
      id: 'iss-8',
      category: 'likely-formal-appeal',
      title: 'Substantive clinical disagreement',
      description: 'The core issue is a clinical judgment disagreement between the treating physician and the payer review criteria. This type of dispute typically requires formal appeal with clinical argumentation.',
      isCurable: false,
      clarificationNeeded: 'Formal appeal with peer-to-peer review recommended',
      supportingEvidence: ['Peer-reviewed literature', 'Specialty society guidelines', 'Attending physician statement'],
    },
  ],
  resolution: {
    likelihood: 'requires-formal-appeal',
    confidence: 90,
    whatIsMissing: ['Formal clinical argumentation against InterQual criteria application'],
    whatWouldChangeResult: ['Peer-to-peer review with favorable outcome', 'External review determination supporting medical necessity'],
  },
  evidenceChecklist: [
    { id: 'ev-9', record: 'Complete inpatient medical record', priority: 'required', whyItMatters: 'Foundation for any clinical appeal', linkedIssueCategory: 'medical-necessity', supportsQuickReconsideration: false, absencePushesToAppeal: true },
    { id: 'ev-10', record: 'Attending physician statement', priority: 'required', whyItMatters: 'Clinical rationale for admission decision', linkedIssueCategory: 'likely-formal-appeal', supportsQuickReconsideration: false, absencePushesToAppeal: true },
  ],
  recommendedDisposition: 'pursue-formal-appeal',
  providerSummary: {
    whyResolvableQuickly: 'This denial involves a substantive clinical disagreement that is unlikely to be resolved through targeted documentation alone. A formal appeal with peer-to-peer review is the recommended path.',
    exactlyNeeded: ['Complete inpatient record', 'Attending physician attestation', 'Supporting clinical literature'],
    doNotWasteTimeOn: ['Pre-appeal resolution submission for this case', 'Coding corrections—this is not a coding issue'],
    appearsCurable: false,
    fullAppealPoorUse: false,
  },
  payerSummary: {
    issueAppearsCurable: false,
    clarificationNeeded: [],
    partialReversalPossible: false,
    denialStandsWithoutSupport: true,
    moveToStandardAppeal: true,
  },
};

// Case 5: Not likely supportable
const case005Resolution: PreAppealResolution = {
  caseId: 'AUD-2024-005',
  denialReason: 'Duplicate billing for same service on same date; no documentation supports separate encounters',
  curability: 'not-likely-supportable',
  issues: [
    {
      id: 'iss-9',
      category: 'likely-non-curable',
      title: 'Duplicate claim submission confirmed',
      description: 'Review confirms that the same service was billed twice for the same patient on the same date of service. The operative report documents a single procedure.',
      isCurable: false,
      clarificationNeeded: 'No clarification is likely to resolve a confirmed duplicate submission',
      supportingEvidence: [],
    },
    {
      id: 'iss-10',
      category: 'administrative-correction',
      title: 'Billing system error likely',
      description: 'This appears to be an administrative/billing system error rather than a clinical documentation issue. The duplicate should be written off.',
      isCurable: false,
      clarificationNeeded: 'Internal billing review and correction',
      supportingEvidence: ['Billing system audit log'],
    },
  ],
  resolution: {
    likelihood: 'not-supportable',
    confidence: 95,
    whatIsMissing: [],
    whatWouldChangeResult: ['Documentation of a genuinely separate encounter—which does not appear to exist'],
  },
  evidenceChecklist: [
    { id: 'ev-11', record: 'Billing system records', priority: 'helpful', whyItMatters: 'Confirms whether this was a system error', linkedIssueCategory: 'administrative-correction', supportsQuickReconsideration: false, absencePushesToAppeal: false },
  ],
  recommendedDisposition: 'do-not-pursue',
  providerSummary: {
    whyResolvableQuickly: 'This denial is not recommended for further pursuit. The duplicate submission appears to be an administrative error. Resources are better directed toward correcting the billing process to prevent recurrence.',
    exactlyNeeded: ['Internal billing system audit to prevent future duplicates'],
    doNotWasteTimeOn: ['Appeal of any kind', 'Gathering additional clinical documentation'],
    appearsCurable: false,
    fullAppealPoorUse: true,
  },
  payerSummary: {
    issueAppearsCurable: false,
    clarificationNeeded: [],
    partialReversalPossible: false,
    denialStandsWithoutSupport: false,
    moveToStandardAppeal: false,
  },
};

export const preAppealResolutions: Record<string, PreAppealResolution> = {
  'AUD-2024-001': case001Resolution,
  'AUD-2024-002': case002Resolution,
  'AUD-2024-003': case003Resolution,
  'AUD-2024-004': case004Resolution,
  'AUD-2024-005': case005Resolution,
};
