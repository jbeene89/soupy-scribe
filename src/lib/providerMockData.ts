import type {
  ProviderCaseReview,
  ProviderDashboardStats,
  RecurringIssue,
} from './providerTypes';

// ──────────────────────────────────────────────
// Sample 1: Well-documented, likely supportable
// ──────────────────────────────────────────────
export const providerReview_case3: ProviderCaseReview = {
  caseId: '3', // AUD-2024-003 (approved GI case)
  documentationSufficiency: 'strong',
  documentationAssessments: [
    { category: 'Operative Note', status: 'strong', detail: 'Complete endoscopy report with findings, biopsy sites, and indications documented.', whyItMatters: 'Primary evidence supporting billed procedures.', recommendation: 'No action needed — documentation is thorough.' },
    { category: 'Pathology Report', status: 'strong', detail: 'Biopsy specimens match reported sites with pathologist interpretation.', whyItMatters: 'Confirms medical necessity for biopsy codes.', recommendation: 'Retain on file for any audit response.' },
    { category: 'Prior Authorization', status: 'moderate', detail: 'Authorization not on file but procedure type may not require it.', whyItMatters: 'Some payers require prior auth for endoscopy with biopsy.', recommendation: 'Verify payer-specific authorization requirements for future claims.' },
  ],
  codingVulnerabilities: [],
  appealAssessment: {
    viability: 'recommended',
    estimatedSuccessRate: 92,
    estimatedEffortHours: 1,
    strengths: ['Complete operative note', 'Pathology confirms necessity', 'Standard procedure combination', 'ICD codes align with findings'],
    weaknesses: ['Prior authorization not documented'],
    missingSupport: [],
    recommendedAction: 'do-not-appeal',
    actionRationale: 'Claim was approved. No appeal needed. Documentation is strong and would withstand audit review.',
  },
  evidenceReadiness: [
    { id: 'er1', record: 'Endoscopy operative report', category: 'required', status: 'present', whyItMatters: 'Primary procedural documentation', whatItSupports: 'Medical necessity for 43235 and 43239', essentialForAppeal: true, materiallyImproves: true },
    { id: 'er2', record: 'Pathology report with specimen details', category: 'required', status: 'present', whyItMatters: 'Confirms biopsy was performed and medically necessary', whatItSupports: 'CPT 43239 biopsy add-on', essentialForAppeal: true, materiallyImproves: true },
    { id: 'er3', record: 'Prior authorization documentation', category: 'helpful', status: 'missing', whyItMatters: 'Demonstrates payer pre-approval', whatItSupports: 'Procedural authorization compliance', essentialForAppeal: false, materiallyImproves: false },
  ],
  timelineConsistency: 'strong',
  denialPressurePoints: [],
};

// ──────────────────────────────────────────────
// Sample 2: Weak — likely not worth appealing
// ──────────────────────────────────────────────
export const providerReview_case4: ProviderCaseReview = {
  caseId: '4', // AUD-2024-004 (rejected knee case)
  documentationSufficiency: 'weak',
  documentationAssessments: [
    { category: 'Operative Note', status: 'moderate', detail: 'Operative note present but does not clearly distinguish work in separate compartments.', whyItMatters: 'Billing both 29880 and 29881 requires proof of distinct compartment procedures.', recommendation: 'Ensure operative notes describe each compartment separately with distinct findings.' },
    { category: 'Compartment Documentation', status: 'weak', detail: 'No explicit documentation of medial vs. lateral compartment meniscectomy.', whyItMatters: '29880 includes all compartments unless 29881 documents a distinct additional procedure.', recommendation: 'For future cases, document each compartment with separate headings and distinct clinical findings.' },
    { category: 'Pre-operative Imaging', status: 'strong', detail: 'MRI showing meniscal tears in both compartments is on file.', whyItMatters: 'Imaging supports medical necessity but operative note must correlate.', recommendation: 'Reference pre-op imaging findings explicitly in operative note.' },
  ],
  codingVulnerabilities: [
    { code: '29881', issue: 'Potential unbundling — 29880 typically includes both meniscectomy compartments without a separately documented distinct procedure.', severity: 'weak', recommendation: 'Review operative note and confirm distinct compartment work is documented before resubmission.', isCorrectible: false },
  ],
  appealAssessment: {
    viability: 'not-recommended',
    estimatedSuccessRate: 15,
    estimatedEffortHours: 8,
    strengths: ['Pre-op MRI shows bilateral tears'],
    weaknesses: ['Operative note does not describe distinct compartments', '29880 is considered inclusive of both compartments by most payers', 'NCCI edit directly bundles these codes'],
    missingSupport: ['Compartment-specific operative documentation', 'Modifier 59 justification', 'Distinct findings per compartment'],
    recommendedAction: 'educate-staff',
    actionRationale: 'The appeal is structurally weak. The core issue is that the operative note was not written to support bilateral compartment billing. This is a documentation practice issue, not a clinical issue. Staff education on compartment-specific documentation would prevent this in future cases.',
  },
  evidenceReadiness: [
    { id: 'er4', record: 'Compartment-specific operative documentation', category: 'required', status: 'missing', whyItMatters: 'Without distinct compartment descriptions, billing both codes is unsupported', whatItSupports: 'Separate billing of 29880 + 29881', essentialForAppeal: true, materiallyImproves: true },
    { id: 'er5', record: 'Pre-operative MRI', category: 'helpful', status: 'present', whyItMatters: 'Shows bilateral tears which supports medical necessity', whatItSupports: 'Medical necessity for both compartments', essentialForAppeal: false, materiallyImproves: false },
    { id: 'er6', record: 'Modifier 59 documentation', category: 'required', status: 'missing', whyItMatters: 'NCCI edit requires modifier justification for separate billing', whatItSupports: 'Distinct procedural service claim', essentialForAppeal: true, materiallyImproves: true },
  ],
  timelineConsistency: 'moderate',
  denialPressurePoints: ['NCCI bundling edit', 'Operative note lacks compartment distinction', 'High claim amount relative to single-compartment median'],
};

// ──────────────────────────────────────────────
// Sample 3: Improvable with additional records
// ──────────────────────────────────────────────
export const providerReview_case1: ProviderCaseReview = {
  caseId: '1', // AUD-2024-001 (ED + critical care)
  documentationSufficiency: 'moderate',
  documentationAssessments: [
    { category: 'Critical Care Time Log', status: 'weak', detail: 'No explicit start/stop times for critical care documented.', whyItMatters: 'CMS requires contemporaneous time documentation for 99291/99292 billing.', recommendation: 'Implement critical care time tracking in EHR templates. Document start/stop times in real-time.' },
    { category: 'ED to Critical Care Transition', status: 'moderate', detail: 'Clinical notes suggest escalation but transition point is not explicitly documented.', whyItMatters: 'Same-day ED + critical care requires clear documentation of when care transitioned.', recommendation: 'Add a transition note template that captures the exact point of escalation.' },
    { category: 'Medical Decision Making', status: 'moderate', detail: 'High-complexity MDM elements are present but not explicitly linked to Level 5 criteria.', whyItMatters: 'ED Level 5 (99285) requires documented immediate, significant threat to life.', recommendation: 'Use structured MDM templates that map directly to E/M level criteria.' },
  ],
  codingVulnerabilities: [
    { code: '99291', issue: 'Missing contemporaneous time documentation creates denial risk for critical care billing.', severity: 'moderate', recommendation: 'Attempt to reconstruct time from nursing notes, MAR, and EHR timestamps. If >30 minutes of qualifying time can be documented, code is defensible.', isCorrectible: true },
    { code: '99292', issue: 'Add-on critical care time requires documentation of activities during additional 30-minute period.', severity: 'weak', recommendation: 'Without explicit time log, consider dropping 99292 and billing 99291 only to reduce audit risk.', isCorrectible: true },
  ],
  appealAssessment: {
    viability: 'conditional',
    estimatedSuccessRate: 55,
    estimatedEffortHours: 4,
    strengths: ['STEMI presentation strongly supports critical care', 'ICD codes align with high-acuity scenario', 'Clinical outcome consistent with billed services'],
    weaknesses: ['No critical care time log', 'ED-to-critical-care transition unclear', 'MDM not explicitly mapped to Level 5'],
    missingSupport: ['Critical care time reconstruction', 'Nursing notes with timestamps', 'EHR audit trail'],
    recommendedAction: 'gather-records',
    actionRationale: 'This appeal becomes significantly stronger if critical care time can be reconstructed from nursing notes, medication administration records, and EHR timestamps. The clinical scenario strongly supports the billing — the gap is documentation, not clinical care.',
  },
  evidenceReadiness: [
    { id: 'er7', record: 'Critical care time log', category: 'required', status: 'missing', whyItMatters: 'CMS requires contemporaneous time documentation for critical care billing', whatItSupports: 'CPT 99291 and 99292', essentialForAppeal: true, materiallyImproves: true },
    { id: 'er8', record: 'Nursing notes with timestamps', category: 'helpful', status: 'missing', whyItMatters: 'Can serve as secondary evidence for time reconstruction', whatItSupports: 'Critical care time verification', essentialForAppeal: false, materiallyImproves: true },
    { id: 'er9', record: 'Medication administration record', category: 'helpful', status: 'missing', whyItMatters: 'Timestamps on medication administration help establish critical care timeline', whatItSupports: 'Time reconstruction for 99291', essentialForAppeal: false, materiallyImproves: true },
    { id: 'er10', record: 'EHR audit trail', category: 'helpful', status: 'missing', whyItMatters: 'System timestamps can corroborate clinical timeline', whatItSupports: 'Independent time verification', essentialForAppeal: false, materiallyImproves: true },
  ],
  timelineConsistency: 'moderate',
  denialPressurePoints: ['Missing time documentation', 'Same-day ED + critical care audit target', 'Weekend service higher scrutiny'],
};

// ──────────────────────────────────────────────
// Sample 4: Recurring documentation issue → staff education
// ──────────────────────────────────────────────
export const providerReview_case6: ProviderCaseReview = {
  caseId: '6', // AUD-2024-006 (TKA + bone graft)
  documentationSufficiency: 'weak',
  documentationAssessments: [
    { category: 'Bone Graft Source Documentation', status: 'insufficient', detail: 'No documentation of where bone graft was harvested or whether it was autograft vs. allograft.', whyItMatters: 'Separate billing of 20930 with TKA requires proof that graft was from a distinct site, not the surgical bed.', recommendation: 'Document graft source, type (auto/allo), and site in every case where bone graft is used. Include lot numbers for allograft.' },
    { category: 'Tendon Repair Justification', status: 'insufficient', detail: 'No pre-existing tendon pathology documented. 27380 appears to be standard TKA closure technique.', whyItMatters: 'Billing tendon repair separately from TKA requires documented pre-existing condition.', recommendation: 'Do not bill 27380 with TKA unless pre-op imaging shows tendon tear and operative note documents repair as distinct from standard closure.' },
    { category: 'Implant Manifest', status: 'weak', detail: 'Implant log referenced but lot numbers not included in chart.', whyItMatters: 'Implant details corroborate that billed procedures were actually performed.', recommendation: 'Include complete implant manifest with lot numbers, manufacturer, and quantities in every surgical chart.' },
  ],
  codingVulnerabilities: [
    { code: '20930', issue: 'NCCI bundles bone graft with TKA. Separate billing requires distinct site documentation and modifier 59.', severity: 'weak', recommendation: 'Do not bill 20930 with 27447 unless you can document a separate incision and distinct graft site. Review NCCI edits before submitting.', isCorrectible: false },
    { code: '27380', issue: 'Infrapatellar tendon suture is integral to TKA technique. Separate billing is unsupported without pre-existing pathology.', severity: 'insufficient', recommendation: 'Remove 27380 from TKA claims unless pre-operative MRI or documented tendon tear supports separate billing.', isCorrectible: false },
  ],
  appealAssessment: {
    viability: 'not-recommended',
    estimatedSuccessRate: 12,
    estimatedEffortHours: 12,
    strengths: ['Primary TKA code (27447) is well-supported', 'Implant invoice exists for allograft'],
    weaknesses: ['NCCI edits directly bundle both add-on codes', 'No modifier 59 documentation', 'No pre-existing tendon pathology documented', 'Pattern of similar billing raises systemic concern'],
    missingSupport: ['Distinct graft site operative documentation', 'Pre-op imaging showing tendon tear', 'Modifier 59 justification', 'Complete implant manifest'],
    recommendedAction: 'seek-compliance-review',
    actionRationale: 'The add-on codes are structurally unsupported. This is not a documentation gap that can be cured — the coding itself may be incorrect. Recommend compliance review of TKA billing practices to prevent recurring denials and potential audit exposure.',
  },
  evidenceReadiness: [
    { id: 'er11', record: 'Distinct bone graft site documentation', category: 'required', status: 'missing', whyItMatters: 'Without proof of separate graft site, 20930 is bundled into TKA', whatItSupports: 'Separate billing of 20930', essentialForAppeal: true, materiallyImproves: true },
    { id: 'er12', record: 'Pre-operative MRI showing tendon pathology', category: 'required', status: 'missing', whyItMatters: 'Must prove tendon repair was not standard TKA closure', whatItSupports: 'Separate billing of 27380', essentialForAppeal: true, materiallyImproves: true },
    { id: 'er13', record: 'Implant manifest with lot numbers', category: 'helpful', status: 'partial', whyItMatters: 'Confirms allograft was actually used', whatItSupports: 'Corroborates 20930 procedure', essentialForAppeal: false, materiallyImproves: false },
  ],
  timelineConsistency: 'moderate',
  denialPressurePoints: ['NCCI bundling edits', 'Pattern of add-on billing with TKA', 'Missing modifier documentation', 'High claim amount outlier'],
};

// Map case IDs to reviews
export const providerReviews: Record<string, ProviderCaseReview> = {
  '1': providerReview_case1,
  '3': providerReview_case3,
  '4': providerReview_case4,
  '6': providerReview_case6,
};

// ──────────────────────────────────────────────
// Recurring Issues (Education / Pattern Insights)
// ──────────────────────────────────────────────
export const recurringIssues: RecurringIssue[] = [
  {
    id: 'ri1',
    category: 'documentation-gap',
    title: 'Missing Critical Care Time Logs',
    description: 'Critical care billing (99291/99292) submitted without contemporaneous start/stop time documentation. Time-based codes require real-time documentation per CMS guidelines.',
    frequency: 3,
    impact: 'high',
    educationOpportunity: 'Implement critical care time documentation templates in EHR. Train ED and ICU staff to document start/stop times at point of care. Consider automated time tracking tools.',
  },
  {
    id: 'ri2',
    category: 'addon-vulnerability',
    title: 'Add-on Codes Billed Without Modifier Documentation',
    description: 'Add-on procedure codes billed alongside primary procedures without the required modifier 59/XE/XS documentation to justify separate billing. NCCI edits flag these combinations automatically.',
    frequency: 4,
    impact: 'high',
    educationOpportunity: 'Train coding staff on NCCI column 1/column 2 edits. Require modifier documentation checklist before submitting add-on codes. Implement pre-submission edit checks.',
  },
  {
    id: 'ri3',
    category: 'medical-necessity',
    title: 'Weak Medical Necessity Support for High-Level E/M',
    description: 'Level 5 ED visits (99285) billed without explicit documentation mapping to 2021 E/M MDM criteria for immediate, significant threat to life or physiologic function.',
    frequency: 2,
    impact: 'medium',
    educationOpportunity: 'Provide 2021 E/M guideline training. Use structured MDM templates that auto-map to level criteria. Conduct quarterly chart reviews for ED Level 5 compliance.',
  },
  {
    id: 'ri4',
    category: 'modifier-misuse',
    title: 'Modifier 59 Applied Without Distinct Service Documentation',
    description: 'Modifier 59 used to override NCCI edits but the underlying operative documentation does not support distinct procedural services.',
    frequency: 2,
    impact: 'high',
    educationOpportunity: 'Train surgeons on modifier 59 requirements. Document distinct incisions, separate operative steps, and independent medical necessity for each procedure. Use XE/XS/XP/XU modifiers when more specific.',
  },
  {
    id: 'ri5',
    category: 'em-separation',
    title: 'E/M and Procedure on Same Day Without Separation',
    description: 'Evaluation and Management codes billed same day as procedures without documentation showing E/M was for a separately identifiable service.',
    frequency: 2,
    impact: 'medium',
    educationOpportunity: 'Train providers on modifier 25 requirements for E/M + procedure same-day billing. Document distinct decision-making separate from pre-procedural assessment.',
  },
  {
    id: 'ri6',
    category: 'time-element',
    title: 'Time-Based Codes Without Duration Documentation',
    description: 'Time-based procedure codes submitted without documented procedure duration or face-to-face time with the patient.',
    frequency: 3,
    impact: 'medium',
    educationOpportunity: 'Implement time tracking in EHR. Train staff on which codes are time-based vs. content-based. Require time documentation for all time-dependent billing.',
  },
];

// ──────────────────────────────────────────────
// Provider Dashboard Summary Stats
// ──────────────────────────────────────────────
import {
  enrichThemes, buildCorrectablePatterns, buildHighRiskBehaviors,
  generateInterventions, computeDenialBreakdown,
} from './providerReadinessEngine';

const enrichedThemes = enrichThemes(recurringIssues, 5800);

export const providerDashboardStats: ProviderDashboardStats = {
  totalCasesReviewed: 8,
  documentationWeakCases: 4,
  codingVulnerableCases: 3,
  appealsNotWorthPursuing: 2,
  estimatedAvoidableDenialCost: 23450,
  staffEducationOpportunities: 6,
  recurringThemes: enrichedThemes,
  topVulnerabilities: [
    'Critical care time documentation',
    'Add-on code modifier justification',
    'Compartment-specific operative notes',
    'Implant manifest completeness',
  ],
  correctablePatterns: buildCorrectablePatterns(enrichedThemes, 5800),
  highRiskBehaviors: buildHighRiskBehaviors(enrichedThemes),
  recommendedInterventions: generateInterventions(enrichedThemes),
  avoidableDenialBreakdown: computeDenialBreakdown(enrichedThemes, 5800),
};
