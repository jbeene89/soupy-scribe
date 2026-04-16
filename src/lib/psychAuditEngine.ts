import type { PsychCaseInput, PsychAuditResult, PsychChecklistItem } from './psychTypes';

const MASTER_CHECKLIST: PsychChecklistItem[] = [
  // Documentation
  {
    id: 'treatment-plan-current',
    category: 'documentation',
    label: 'Current treatment plan on file',
    detail: 'Treatment plan must be signed, dated, and not expired. Most payers require renewal every 90 days.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'telehealth'],
    commonDenialReason: 'incomplete_treatment_plan',
    whyItMatters: 'Without a current treatment plan, payers deny on medical necessity grounds — this is the #1 psych denial reason.',
  },
  {
    id: 'progress-notes',
    category: 'documentation',
    label: 'Session progress notes completed',
    detail: 'Progress notes must document interventions used, patient response, and tie back to treatment plan goals.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'crisis_intervention', 'telehealth'],
    commonDenialReason: 'missing_progress_notes',
    whyItMatters: 'Progress notes prove the session happened and was medically necessary. Missing notes = automatic denial on audit.',
  },
  {
    id: 'medical-necessity',
    category: 'documentation',
    label: 'Medical necessity clearly documented',
    detail: 'Document symptoms, functional impairment, and why continued treatment is needed. Avoid boilerplate language.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'medication_management', 'telehealth'],
    commonDenialReason: 'medical_necessity',
    whyItMatters: 'Payers look for specific, measurable impairment. Vague statements like "patient is anxious" get denied.',
  },
  {
    id: 'intake-complete',
    category: 'documentation',
    label: 'Intake evaluation documented',
    detail: 'Initial evaluation must include presenting problem, history, mental status exam, diagnosis, and treatment recommendations.',
    severity: 'high',
    sessionTypes: ['intake_evaluation'],
    whyItMatters: 'The intake sets the foundation for medical necessity. Incomplete intakes weaken every subsequent claim.',
  },
  {
    id: 'psych-testing-report',
    category: 'documentation',
    label: 'Testing report with clinical rationale',
    detail: 'Psychological testing must include why testing was needed, instruments used, results, and clinical implications.',
    severity: 'critical',
    sessionTypes: ['psych_testing'],
    commonDenialReason: 'medical_necessity',
    whyItMatters: 'Psych testing is heavily scrutinized. Without clear clinical rationale, payers deny as "not medically necessary."',
  },

  // Coding
  {
    id: 'cpt-session-match',
    category: 'coding',
    label: 'CPT code matches session duration',
    detail: '90834 = 38–52 min, 90837 = 53+ min. Session time in notes must match the billed code.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'telehealth'],
    commonDenialReason: 'wrong_modifier',
    whyItMatters: 'Billing 90837 for a 40-minute session is the most common psych coding error and triggers audits.',
  },
  {
    id: 'place-of-service',
    category: 'coding',
    label: 'Place of service code correct',
    detail: 'Telehealth requires POS 10 (telehealth in patient home) or POS 02. In-office is POS 11.',
    severity: 'high',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'telehealth', 'medication_management'],
    commonDenialReason: 'place_of_service',
    whyItMatters: 'Wrong POS code on telehealth claims is a common denial trigger, especially post-COVID policy changes.',
  },
  {
    id: 'modifier-95-gt',
    category: 'coding',
    label: 'Telehealth modifier applied correctly',
    detail: 'Use modifier 95 for synchronous telehealth. Some payers still require GT. Check payer-specific rules.',
    severity: 'high',
    sessionTypes: ['telehealth'],
    commonDenialReason: 'wrong_modifier',
    whyItMatters: 'Missing or wrong telehealth modifier causes clean claims to deny unnecessarily.',
  },
  {
    id: 'diagnosis-specificity',
    category: 'coding',
    label: 'Diagnosis codes at highest specificity',
    detail: 'Use specific ICD-10 codes (e.g., F33.1 not F33). Unspecified codes trigger medical necessity reviews.',
    severity: 'medium',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'medication_management', 'telehealth', 'intake_evaluation'],
    whyItMatters: 'Unspecified diagnosis codes signal incomplete clinical documentation to payers.',
  },
  {
    id: 'testing-code-units',
    category: 'coding',
    label: 'Testing units match time documented',
    detail: '96130/96131 are per-hour codes. Document exact time spent on each testing activity.',
    severity: 'critical',
    sessionTypes: ['psych_testing'],
    commonDenialReason: 'bundling',
    whyItMatters: 'Payers audit testing hours aggressively. Undocumented time = denied units.',
  },

  // Authorization
  {
    id: 'auth-on-file',
    category: 'authorization',
    label: 'Prior authorization obtained',
    detail: 'Verify authorization is active for the date of service and covers the specific service type.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'psych_testing', 'medication_management', 'telehealth'],
    commonDenialReason: 'auth_expired',
    whyItMatters: 'Services without valid authorization are denied regardless of medical necessity.',
  },
  {
    id: 'sessions-remaining',
    category: 'authorization',
    label: 'Authorized sessions not exhausted',
    detail: 'Track remaining authorized sessions. Request re-authorization before the last session.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'telehealth'],
    commonDenialReason: 'auth_expired',
    whyItMatters: 'Exceeding authorized sessions means the payer owes you nothing for those visits.',
  },
  {
    id: 'frequency-limits',
    category: 'authorization',
    label: 'Session frequency within payer limits',
    detail: 'Most payers allow 1x/week for individual therapy. More frequent sessions need documented justification.',
    severity: 'high',
    sessionTypes: ['individual_therapy', 'telehealth'],
    commonDenialReason: 'frequency_exceeded',
    whyItMatters: 'Billing more than allowed frequency without justification triggers automatic denials.',
  },

  // Billing
  {
    id: 'timely-filing',
    category: 'billing',
    label: 'Within timely filing deadline',
    detail: 'Most payers require claims within 90–180 days. Medicare allows 365 days. Check each payer.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'psych_testing', 'medication_management', 'telehealth', 'intake_evaluation', 'crisis_intervention'],
    commonDenialReason: 'timely_filing',
    whyItMatters: 'Timely filing denials are almost never overturnable. This is money lost permanently.',
  },
  {
    id: 'credential-active',
    category: 'billing',
    label: 'Provider credentialed with payer',
    detail: 'Verify active credentialing status before seeing patients. Retroactive credentialing is rarely granted.',
    severity: 'critical',
    sessionTypes: ['individual_therapy', 'group_therapy', 'family_therapy', 'psych_testing', 'medication_management', 'telehealth', 'intake_evaluation', 'crisis_intervention'],
    commonDenialReason: 'credential_issue',
    whyItMatters: 'Seeing patients before credentialing is complete means you may never get paid for those sessions.',
  },
];

export function runPsychAudit(input: PsychCaseInput): PsychAuditResult {
  const applicableItems = MASTER_CHECKLIST.filter(
    (item) => item.sessionTypes.includes(input.sessionType)
  );

  const evaluated = applicableItems.map((item) => {
    let status: 'pass' | 'fail' | 'warning' = 'pass';

    switch (item.id) {
      case 'treatment-plan-current':
        if (!input.hasCurrentTreatmentPlan) status = 'fail';
        else if (input.treatmentPlanExpiry) {
          const exp = new Date(input.treatmentPlanExpiry);
          const daysUntilExpiry = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (daysUntilExpiry < 0) status = 'fail';
          else if (daysUntilExpiry < 14) status = 'warning';
        }
        break;
      case 'progress-notes':
        if (!input.hasProgressNotes) status = 'fail';
        break;
      case 'medical-necessity':
        if (!input.hasMedicalNecessityStatement) status = 'fail';
        break;
      case 'cpt-session-match':
        if (input.cptCode === '90837' && input.sessionDurationMinutes < 53) status = 'fail';
        else if (input.cptCode === '90834' && (input.sessionDurationMinutes < 38 || input.sessionDurationMinutes > 52)) status = 'warning';
        break;
      case 'place-of-service':
        if (input.isTelehealth && !['10', '02'].includes(input.placeOfService)) status = 'fail';
        else if (!input.isTelehealth && input.placeOfService !== '11') status = 'warning';
        break;
      case 'modifier-95-gt':
        if (!input.isTelehealth) status = 'pass'; // N/A
        break;
      case 'auth-on-file':
        if (!input.hasAuthorizationOnFile) status = 'fail';
        break;
      case 'sessions-remaining':
        if (input.authorizedSessionsRemaining !== undefined && input.authorizedSessionsRemaining <= 0) status = 'fail';
        else if (input.authorizedSessionsRemaining !== undefined && input.authorizedSessionsRemaining <= 2) status = 'warning';
        break;
      case 'auth-expired':
        if (input.authExpiryDate) {
          const exp = new Date(input.authExpiryDate);
          if (exp.getTime() < Date.now()) status = 'fail';
        }
        break;
    }

    return { ...item, status };
  });

  const failCount = evaluated.filter((e) => e.status === 'fail').length;
  const criticalFails = evaluated.filter((e) => e.status === 'fail' && e.severity === 'critical').length;
  const warnCount = evaluated.filter((e) => e.status === 'warning').length;

  const score = Math.max(0, Math.round(100 - (criticalFails * 20) - (failCount * 10) - (warnCount * 3)));

  const overallReadiness: PsychAuditResult['overallReadiness'] =
    criticalFails > 0 ? 'not-ready' :
    failCount > 0 || warnCount > 2 ? 'needs-attention' :
    'ready';

  const denialRiskFactors = evaluated
    .filter((e) => e.status === 'fail' && e.commonDenialReason)
    .map((e) => e.whyItMatters);

  const recommendations = evaluated
    .filter((e) => e.status === 'fail' || e.status === 'warning')
    .map((e) => `${e.label}: ${e.detail}`);

  return {
    overallReadiness,
    score,
    checklist: evaluated,
    denialRiskFactors,
    recommendations,
  };
}
