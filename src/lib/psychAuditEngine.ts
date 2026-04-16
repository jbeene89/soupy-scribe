import type {
  PsychCaseInput, PsychAuditResult, PsychChecklistItem,
  MDMReview, MissedRevenueItem, SmallestFix, MDMLevel,
  CaseClassification, PsychBatchSummary,
} from './psychTypes';

// ── Master checklist ──
const MASTER_CHECKLIST: PsychChecklistItem[] = [
  // Documentation
  { id: 'treatment-plan-current', category: 'documentation', label: 'Current treatment plan on file', detail: 'Treatment plan must be signed, dated, and not expired. Most payers require renewal every 90 days.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth'], commonDenialReason: 'incomplete_treatment_plan', whyItMatters: 'Without a current treatment plan, payers deny on medical necessity grounds — this is the #1 psych denial reason.', correction: 'Update and sign the treatment plan with current goals, objectives, and a date within the payer window.', isCurable: true },
  { id: 'progress-notes', category: 'documentation', label: 'Session progress notes completed', detail: 'Progress notes must document interventions used, patient response, and tie back to treatment plan goals.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','crisis_intervention','telehealth'], commonDenialReason: 'missing_progress_notes', whyItMatters: 'Progress notes prove the session happened and was medically necessary. Missing notes = automatic denial on audit.', correction: 'Complete progress notes with interventions, patient response, and treatment plan goal alignment.', isCurable: true },
  { id: 'medical-necessity', category: 'documentation', label: 'Medical necessity clearly documented', detail: 'Document symptoms, functional impairment, and why continued treatment is needed. Avoid boilerplate language.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','medication_management','telehealth'], commonDenialReason: 'medical_necessity', whyItMatters: 'Payers look for specific, measurable impairment. Vague statements like "patient is anxious" get denied.', correction: 'Add specific symptom severity, functional limitations, and measurable treatment goals.', isCurable: true },
  { id: 'intake-complete', category: 'documentation', label: 'Intake evaluation documented', detail: 'Initial evaluation must include presenting problem, history, mental status exam, diagnosis, and treatment recommendations.', severity: 'high', sessionTypes: ['intake_evaluation'], whyItMatters: 'The intake sets the foundation for medical necessity. Incomplete intakes weaken every subsequent claim.', correction: 'Ensure all required intake sections are completed with clinical detail.', isCurable: true },
  { id: 'psych-testing-report', category: 'documentation', label: 'Testing report with clinical rationale', detail: 'Psychological testing must include why testing was needed, instruments used, results, and clinical implications.', severity: 'critical', sessionTypes: ['psych_testing'], commonDenialReason: 'medical_necessity', whyItMatters: 'Psych testing is heavily scrutinized. Without clear clinical rationale, payers deny as "not medically necessary."', correction: 'Document clinical rationale, instrument selection logic, results interpretation, and clinical implications.', isCurable: true },
  { id: 'start-stop-time', category: 'documentation', label: 'Start and stop time documented', detail: 'Payers increasingly require exact start/stop times for time-based codes, especially 90837 and prolonged services.', severity: 'high', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','crisis_intervention'], commonDenialReason: 'missing_start_stop_time', whyItMatters: 'Without start/stop times, payers can deny any time-based code. This is especially risky for 90837 claims.', correction: 'Add exact start and stop times to the session documentation.', isCurable: true },
  { id: 'telehealth-consent', category: 'documentation', label: 'Telehealth consent documented', detail: 'Most states and payers require documented patient consent for telehealth services.', severity: 'high', sessionTypes: ['telehealth'], commonDenialReason: 'telehealth_consent', whyItMatters: 'Missing telehealth consent is an increasingly common audit finding that can result in recoupment.', correction: 'Obtain and document verbal or written telehealth consent with date.', isCurable: true },
  { id: 'supervising-provider', category: 'documentation', label: 'Supervising provider documented', detail: 'If the rendering provider requires supervision, the supervising clinician must be identified on the claim.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], commonDenialReason: 'missing_supervision', whyItMatters: 'Claims billed under a supervised provider without proper documentation face denial and potential fraud scrutiny.', correction: 'Add supervising provider name, credentials, and NPI to the claim.', isCurable: true },

  // Coding
  { id: 'cpt-session-match', category: 'coding', label: 'CPT code matches session duration', detail: '90834 = 38–52 min, 90837 = 53+ min. Session time in notes must match the billed code.', severity: 'critical', sessionTypes: ['individual_therapy','telehealth'], commonDenialReason: 'wrong_modifier', whyItMatters: 'Billing 90837 for a 40-minute session is the most common psych coding error and triggers audits.', correction: 'Adjust CPT to match documented time, or update documentation to reflect actual session length.', isCurable: true },
  { id: 'place-of-service', category: 'coding', label: 'Place of service code correct', detail: 'Telehealth requires POS 10 (telehealth in patient home) or POS 02. In-office is POS 11.', severity: 'high', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], commonDenialReason: 'place_of_service', whyItMatters: 'Wrong POS code on telehealth claims is a common denial trigger, especially post-COVID policy changes.', correction: 'Correct the Place of Service code to match the actual service location.', isCurable: true },
  { id: 'modifier-95-gt', category: 'coding', label: 'Telehealth modifier applied correctly', detail: 'Use modifier 95 for synchronous telehealth. Some payers still require GT. Check payer-specific rules.', severity: 'high', sessionTypes: ['telehealth'], commonDenialReason: 'wrong_modifier', whyItMatters: 'Missing or wrong telehealth modifier causes clean claims to deny unnecessarily.', correction: 'Add the appropriate telehealth modifier (95 or GT) based on payer requirements.', isCurable: true },
  { id: 'diagnosis-specificity', category: 'coding', label: 'Diagnosis codes at highest specificity', detail: 'Use specific ICD-10 codes (e.g., F33.1 not F33). Unspecified codes trigger medical necessity reviews.', severity: 'medium', sessionTypes: ['individual_therapy','group_therapy','family_therapy','medication_management','telehealth','intake_evaluation'], whyItMatters: 'Unspecified diagnosis codes signal incomplete clinical documentation to payers.', correction: 'Update to the most specific ICD-10 code supported by the clinical documentation.', isCurable: true },
  { id: 'testing-code-units', category: 'coding', label: 'Testing units match time documented', detail: '96130/96131 are per-hour codes. Document exact time spent on each testing activity.', severity: 'critical', sessionTypes: ['psych_testing'], commonDenialReason: 'bundling', whyItMatters: 'Payers audit testing hours aggressively. Undocumented time = denied units.', correction: 'Document exact time for each testing activity broken out by code.', isCurable: true },
  { id: 'diagnosis-service-match', category: 'coding', label: 'Diagnosis supports billed service', detail: 'The primary diagnosis must justify the service provided. Z-codes and V-codes often do not support therapy claims.', severity: 'high', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], commonDenialReason: 'diagnosis_service_mismatch', whyItMatters: 'Diagnosis-to-service mismatch is a top-5 behavioral health denial reason across most payers.', correction: 'Ensure the primary diagnosis is a covered behavioral health condition that justifies the service.', isCurable: true },
  { id: 'addon-documentation', category: 'coding', label: 'E/M + psychotherapy add-on aligned', detail: 'When billing an E/M code with psychotherapy add-on (90833/90836/90838), documentation must support both components separately.', severity: 'high', sessionTypes: ['medication_management','individual_therapy'], commonDenialReason: 'em_documentation_gap', whyItMatters: 'Add-on codes without separate documentation for each component are denied or recouped on audit.', correction: 'Document the E/M component and psychotherapy component separately in the note.', isCurable: true },

  // Authorization
  { id: 'auth-on-file', category: 'authorization', label: 'Prior authorization obtained', detail: 'Verify authorization is active for the date of service and covers the specific service type.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','psych_testing','medication_management','telehealth'], commonDenialReason: 'auth_expired', whyItMatters: 'Services without valid authorization are denied regardless of medical necessity.', correction: 'Obtain prior authorization or verify existing authorization covers this date and service.', isCurable: true },
  { id: 'sessions-remaining', category: 'authorization', label: 'Authorized sessions not exhausted', detail: 'Track remaining authorized sessions. Request re-authorization before the last session.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth'], commonDenialReason: 'auth_expired', whyItMatters: 'Exceeding authorized sessions means the payer owes you nothing for those visits.', correction: 'Check remaining sessions and request re-authorization if needed.', isCurable: true },
  { id: 'frequency-limits', category: 'authorization', label: 'Session frequency within payer limits', detail: 'Most payers allow 1x/week for individual therapy. More frequent sessions need documented justification.', severity: 'high', sessionTypes: ['individual_therapy','telehealth'], commonDenialReason: 'frequency_exceeded', whyItMatters: 'Billing more than allowed frequency without justification triggers automatic denials.', correction: 'Add clinical justification for increased frequency or reduce to payer-allowed limits.', isCurable: true },
  { id: 'frequency-acuity-match', category: 'authorization', label: 'Frequency matches documented acuity', detail: 'Session frequency should be consistent with the documented severity of the condition.', severity: 'medium', sessionTypes: ['individual_therapy','telehealth'], commonDenialReason: 'frequency_acuity_mismatch', whyItMatters: 'Payers flag frequent sessions when notes describe mild symptoms — this invites medical necessity review.', correction: 'Ensure documented acuity level supports the current session frequency, or adjust frequency.', isCurable: true },

  // Billing
  { id: 'timely-filing', category: 'billing', label: 'Within timely filing deadline', detail: 'Most payers require claims within 90–180 days. Medicare allows 365 days. Check each payer.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','psych_testing','medication_management','telehealth','intake_evaluation','crisis_intervention'], commonDenialReason: 'timely_filing', whyItMatters: 'Timely filing denials are almost never overturnable. This is money lost permanently.', correction: 'Submit the claim immediately if approaching the filing deadline.', isCurable: false },
  { id: 'credential-active', category: 'billing', label: 'Provider credentialed with payer', detail: 'Verify active credentialing status before seeing patients. Retroactive credentialing is rarely granted.', severity: 'critical', sessionTypes: ['individual_therapy','group_therapy','family_therapy','psych_testing','medication_management','telehealth','intake_evaluation','crisis_intervention'], commonDenialReason: 'credential_issue', whyItMatters: 'Seeing patients before credentialing is complete means you may never get paid for those sessions.', correction: 'Verify credentialing status with the payer before submitting.', isCurable: false },

  // ── Telehealth-specific checks ──
  { id: 'pos-02-vs-10', category: 'telehealth', label: 'Place of service 02 vs 10 verified', detail: 'Medicare and some payers require POS 10 (patient at home) since 2022. POS 02 (telehealth facility) pays at facility rate which is lower. Verify payer rules.', severity: 'high', sessionTypes: ['telehealth','individual_therapy','group_therapy','family_therapy','medication_management'], whyItMatters: 'Wrong POS on telehealth claims can mean lower reimbursement (POS 02 vs 10) or outright denial. Post-2022 Medicare rules specifically distinguish these.', correction: 'Verify payer POS requirements. Use POS 10 for patient-at-home telehealth unless the payer specifically requires 02.', isCurable: true },
  { id: 'audio-only-billing', category: 'telehealth', label: 'Audio-only session billed correctly', detail: 'Phone-only sessions may require different CPT codes (98966-98968 for non-physician, 99441-99443 for physician) or modifier 93. Not all payers cover audio-only.', severity: 'high', sessionTypes: ['telehealth','individual_therapy','medication_management'], commonDenialReason: 'wrong_modifier', whyItMatters: 'Billing standard therapy codes (90834/90837) for audio-only sessions gets denied by payers that distinguish audio from video.', correction: 'If the session was audio-only, verify the payer covers it and use the correct code or modifier (e.g., modifier 93 for audio-only).', isCurable: true },
  { id: 'interstate-license', category: 'telehealth', label: 'Provider licensed in patient state', detail: 'Telehealth requires the provider to be licensed in the state where the patient is located at time of service, not where the provider sits.', severity: 'critical', sessionTypes: ['telehealth','individual_therapy','group_therapy','family_therapy','medication_management'], whyItMatters: 'Providing services to a patient in a state where you are not licensed is a compliance risk that can result in board action and claim recoupment.', correction: 'Confirm patient location and verify your license covers that state. Document patient state in the session record.', isCurable: false },
  { id: 'telehealth-platform-doc', category: 'telehealth', label: 'HIPAA-compliant platform documented', detail: 'Some payers and state boards require documentation that the telehealth platform used is HIPAA-compliant.', severity: 'medium', sessionTypes: ['telehealth','individual_therapy','group_therapy','family_therapy','medication_management'], whyItMatters: 'Audit findings sometimes include technology compliance. Documenting the platform proactively protects against recoupment.', correction: 'Add a note identifying the telehealth platform used (e.g., "Session conducted via [Platform], a HIPAA-compliant video platform").', isCurable: true },
  { id: 'crisis-safety-plan', category: 'telehealth', label: 'Crisis/safety plan and patient location documented', detail: 'Telehealth sessions should document the patient\'s physical location and emergency contact in case of crisis, since the provider cannot physically intervene.', severity: 'high', sessionTypes: ['telehealth','individual_therapy','crisis_intervention'], whyItMatters: 'Missing patient location and safety plan documentation is a growing audit and liability concern for telehealth-only practices.', correction: 'Document patient physical location (city/state) and confirm emergency contact is on file at the start of each session.', isCurable: true },
  { id: 'consent-reattestion', category: 'telehealth', label: 'Telehealth consent re-attestation current', detail: 'Many payers and states require annual re-consent for telehealth services. Initial consent is not sufficient indefinitely.', severity: 'medium', sessionTypes: ['telehealth','individual_therapy','group_therapy','family_therapy','medication_management'], whyItMatters: 'Expired telehealth consent can be flagged during audits, especially for Medicare and Medicaid patients.', correction: 'Check the original consent date and obtain re-attestation if more than 12 months have passed.', isCurable: true },
  { id: 'telehealth-parity-warning', category: 'telehealth', label: 'Telehealth reimbursement parity checked', detail: 'Some payers reimburse telehealth at reduced rates compared to in-person. Know your contracted rates.', severity: 'low', sessionTypes: ['telehealth','individual_therapy','group_therapy','family_therapy','medication_management'], whyItMatters: 'If a payer applies telehealth rate reductions, you may be leaving money on the table or need to adjust your scheduling volume.', correction: 'Review your payer contracts for telehealth rate parity. If rates are reduced, factor this into scheduling decisions.', isCurable: false },

  { id: 'functional-impairment', category: 'note-quality', label: 'Functional impairment documented', detail: 'Notes should describe how symptoms impact daily functioning — work, relationships, self-care, etc.', severity: 'high', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], commonDenialReason: 'medical_necessity', whyItMatters: 'Payers use functional impairment as the key measure of medical necessity. Without it, continued care looks unjustified.', correction: 'Add 1-2 sentences describing how symptoms affect the patient\'s daily functioning.', isCurable: true },
  { id: 'symptom-severity', category: 'note-quality', label: 'Symptom severity documented', detail: 'Use specific severity descriptors or validated scales (PHQ-9, GAD-7) rather than vague language.', severity: 'high', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], commonDenialReason: 'medical_necessity', whyItMatters: 'Saying "patient reports anxiety" without severity context makes it hard to justify ongoing treatment.', correction: 'Add severity rating, scale score, or specific symptom frequency/intensity descriptors.', isCurable: true },
  { id: 'treatment-response', category: 'note-quality', label: 'Treatment response documented', detail: 'Notes should show whether the patient is improving, stable, or declining and what is being done about it.', severity: 'medium', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], whyItMatters: 'Without treatment response, payers question whether continued sessions are warranted.', correction: 'Document patient progress relative to treatment goals and any plan adjustments.', isCurable: true },
  { id: 'cloned-note-risk', category: 'note-quality', label: 'Note does not appear cloned', detail: 'Notes should be individualized to each session. Repetitive language across sessions triggers audit flags.', severity: 'high', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth','medication_management'], commonDenialReason: 'cloned_notes', whyItMatters: 'Cloned or copy-forward notes are a top audit red flag and can lead to recoupment of multiple claims.', correction: 'Individualize the note with session-specific content, patient quotes, or unique observations.', isCurable: true },
  { id: 'session-justification', category: 'note-quality', label: 'Session length justified in note', detail: 'For longer sessions (90837, crisis), the note should reflect content complexity that justifies extended time.', severity: 'medium', sessionTypes: ['individual_therapy','telehealth','crisis_intervention'], whyItMatters: 'Payers review whether note content justifies the billed session length, especially for 90837.', correction: 'Ensure note content depth and complexity reflects the billed session time.', isCurable: true },
  { id: 'continued-care-rationale', category: 'note-quality', label: 'Continued care rationale present', detail: 'Notes should explain why ongoing treatment is needed and what the plan is for frequency and duration.', severity: 'medium', sessionTypes: ['individual_therapy','group_therapy','family_therapy','telehealth'], whyItMatters: 'Without a clear rationale, payers may deny future sessions as not medically necessary.', correction: 'Add a brief statement about why ongoing sessions are clinically indicated.', isCurable: true },
];

// ── E/M coding logic ──
function assessMDM(input: PsychCaseInput): MDMReview | undefined {
  const em = input.emInput;
  if (!em) return undefined;

  // Problem complexity
  let problemComplexity: MDMLevel = 'straightforward';
  if (em.problemsAddressed >= 3 || em.isNewProblem) problemComplexity = 'moderate';
  else if (em.problemsAddressed >= 2) problemComplexity = 'low';
  if (em.problemsAddressed >= 4 && em.isNewProblem) problemComplexity = 'high';

  // Data complexity
  let dataComplexity: MDMLevel = 'straightforward';
  const dataCount = em.dataReviewed.length;
  if (dataCount >= 3 || em.hasIndependentInterpretation) dataComplexity = 'moderate';
  else if (dataCount >= 1) dataComplexity = 'low';
  if (dataCount >= 4 && em.hasIndependentInterpretation) dataComplexity = 'high';

  // Risk
  const riskMap: Record<string, MDMLevel> = { minimal: 'straightforward', low: 'low', moderate: 'moderate', high: 'high' };
  const riskLevel = riskMap[em.riskLevel] || 'low';

  // Overall MDM = 2 of 3 rule
  const levels: MDMLevel[] = [problemComplexity, dataComplexity, riskLevel];
  const levelOrder: MDMLevel[] = ['straightforward', 'low', 'moderate', 'high'];
  levels.sort((a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b));
  const overallMDM = levels[1]; // median = 2 of 3

  // Map MDM to E/M code
  const mdmToEM: Record<MDMLevel, string> = {
    straightforward: '99212',
    low: '99213',
    moderate: '99214',
    high: '99215',
  };
  const supportedEMCode = mdmToEM[overallMDM];
  const selectedIdx = levelOrder.indexOf(mdmToEM[overallMDM] === em.selectedEMCode ? overallMDM : 'low');

  const emLevelOrder = ['99211', '99212', '99213', '99214', '99215'];
  const selectedRank = emLevelOrder.indexOf(em.selectedEMCode);
  const supportedRank = emLevelOrder.indexOf(supportedEMCode);

  const isUndercoded = supportedRank > selectedRank;
  const isOvercoded = supportedRank < selectedRank;

  let explanation = `Based on the documented problems (${em.problemsAddressed}), data reviewed (${dataCount} sources), and risk level (${em.riskLevel}), the documentation supports a ${overallMDM} level of medical decision making.`;
  let supportStrength: 'strong' | 'moderate' | 'weak' = 'strong';
  let higherCodeOpportunity: string | undefined;
  let downgradeRisk: string | undefined;

  if (isUndercoded) {
    higherCodeOpportunity = `Documentation appears to support ${supportedEMCode}. Consider reviewing whether this higher code is appropriate — it could mean additional revenue per visit.`;
    supportStrength = 'strong';
  } else if (isOvercoded) {
    downgradeRisk = `Documentation may not fully support ${em.selectedEMCode}. The MDM analysis suggests ${supportedEMCode} is the best-supported level. Submitting at the higher level risks denial or recoupment.`;
    supportStrength = 'weak';
  } else {
    explanation += ` This aligns with the selected code ${em.selectedEMCode}.`;
  }

  return {
    problemComplexity, dataComplexity, riskLevel, overallMDM,
    supportedEMCode, selectedEMCode: em.selectedEMCode,
    isUndercoded, isOvercoded, explanation,
    higherCodeOpportunity, downgradeRisk, supportStrength,
  };
}

// ── Revenue capture ──
function detectMissedRevenue(input: PsychCaseInput, mdm?: MDMReview): MissedRevenueItem[] {
  const items: MissedRevenueItem[] = [];

  // Psychotherapy time mismatch
  if (['90834', '90832'].includes(input.cptCode) && input.sessionDurationMinutes >= 53) {
    items.push({
      type: 'psychotherapy-time', description: `Session lasted ${input.sessionDurationMinutes} minutes but billed as ${input.cptCode}. Documentation may support 90837.`,
      currentCode: input.cptCode, suggestedCode: '90837', estimatedDifference: 35,
      confidence: 'likely', requiredAction: 'Verify documented time supports 90837 (53+ minutes) and update CPT.',
    });
  }
  if (input.cptCode === '90832' && input.sessionDurationMinutes >= 38) {
    items.push({
      type: 'psychotherapy-time', description: `Session lasted ${input.sessionDurationMinutes} minutes. Documentation may support 90834 instead of 90832.`,
      currentCode: '90832', suggestedCode: '90834', estimatedDifference: 20,
      confidence: 'likely', requiredAction: 'Verify documented time supports 90834 (38-52 minutes).',
    });
  }

  // E/M undercoding
  if (mdm?.isUndercoded) {
    items.push({
      type: 'higher-em', description: `Documentation appears to support ${mdm.supportedEMCode} but ${mdm.selectedEMCode} was selected.`,
      currentCode: mdm.selectedEMCode, suggestedCode: mdm.supportedEMCode, estimatedDifference: 40,
      confidence: 'review-recommended', requiredAction: 'Review MDM components to confirm higher-level code is justified.',
    });
  }

  // Add-on code opportunity
  if (input.emInput && input.sessionDurationMinutes >= 25 && !input.hasAddOnPsychotherapy && 
      ['99213','99214','99215'].includes(input.emInput.selectedEMCode)) {
    items.push({
      type: 'add-on-code', description: 'E/M visit includes therapy time that may qualify for a psychotherapy add-on code (90833/90836/90838).',
      currentCode: input.emInput.selectedEMCode, suggestedCode: '90833',
      confidence: 'possible', requiredAction: 'If psychotherapy was provided during the E/M visit, consider adding the appropriate add-on code.',
    });
  }

  return items;
}

// ── Smallest fixes ──
function computeSmallestFixes(checklist: (PsychChecklistItem & { status: string })[]): SmallestFix[] {
  return checklist
    .filter(c => c.status === 'fail' && c.isCurable && c.correction)
    .sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sevOrder[a.severity] || 3) - (sevOrder[b.severity] || 3);
    })
    .map((c, i) => ({
      priority: i + 1,
      description: c.correction!,
      effort: c.category === 'coding' || c.category === 'billing' ? 'quick' as const : 'moderate' as const,
      impact: c.severity === 'critical' ? 'high' as const : c.severity === 'high' ? 'medium' as const : 'low' as const,
    }));
}

// ── Note quality checks ──
function checkNoteQuality(input: PsychCaseInput): string[] {
  const issues: string[] = [];
  const nq = input.noteQuality;
  if (!nq) return issues;

  if (!nq.hasFunctionalImpairment) issues.push('Note lacks documentation of functional impairment — add how symptoms affect daily life.');
  if (!nq.hasSymptomSeverity) issues.push('Symptom severity is not clearly described — use specific severity language or validated scales.');
  if (!nq.hasTreatmentResponse) issues.push('No treatment response documented — describe whether patient is improving, stable, or declining.');
  if (!nq.hasMoodAffectDetail) issues.push('Mood and affect documentation is generic — add specific observations beyond "anxious" or "depressed."');
  if (!nq.hasSessionJustification && input.sessionDurationMinutes >= 53) issues.push('Extended session (53+ min) lacks justification for the additional time.');
  if (!nq.hasContinuedCareRationale) issues.push('No rationale for continued care — explain why ongoing sessions are clinically needed.');
  if (nq.appearsCloned) issues.push('Note appears to use copy-forward or template language — individualize with session-specific content.');

  return issues;
}

// ── Payer warnings ──
function generatePayerWarnings(input: PsychCaseInput): string[] {
  const warnings: string[] = [];
  const payer = (input.payerName || '').toLowerCase();

  if (payer.includes('united') || payer.includes('uhc') || payer.includes('optum')) {
    warnings.push('UnitedHealthcare/Optum: Known for strict medical necessity reviews on 90837. Ensure note clearly justifies extended session.');
    if (input.cptCode === '90837') warnings.push('UHC frequently downcodes 90837 to 90834. Document start/stop times and session content detail.');
  }
  if (payer.includes('aetna')) {
    warnings.push('Aetna: Requires authorization for psychological testing. Verify auth covers specific test codes.');
  }
  if (payer.includes('cigna') || payer.includes('evernorth')) {
    warnings.push('Cigna/Evernorth: Strict visit-limit enforcement. Track authorized sessions carefully.');
  }
  if (payer.includes('anthem') || payer.includes('elevance') || payer.includes('bcbs') || payer.includes('blue cross')) {
    warnings.push('Anthem/BCBS: Treatment plan reviews are common. Keep plans current and goals measurable.');
  }
  if (payer.includes('medicaid')) {
    warnings.push('Medicaid: Supervision requirements vary by state. Verify rendering provider eligibility.');
    warnings.push('Medicaid: Prior authorization requirements and session limits are often stricter than commercial payers.');
  }
  if (payer.includes('medicare')) {
    warnings.push('Medicare: Does not cover marriage counseling (90847 with relational Z-code as primary). Verify diagnosis supports service.');
    warnings.push('Medicare: Incident-to billing has specific supervision requirements. Verify compliance.');
  }
  if (payer.includes('tricare')) {
    warnings.push('TRICARE: Requires referral from PCM for behavioral health services. Verify referral is on file.');
  }

  // General warnings
  if (input.isTelehealth && !payer) {
    warnings.push('Telehealth billing rules vary significantly by payer. Verify modifier and POS requirements before submission.');
  }
  if (input.sessionFrequencyPerWeek && input.sessionFrequencyPerWeek > 1) {
    warnings.push('Based on common payer review behavior: sessions more than 1x/week typically require documented clinical justification.');
  }

  return warnings;
}

// ── Main audit function ──
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
          const days = (exp.getTime() - Date.now()) / 864e5;
          if (days < 0) status = 'fail';
          else if (days < 14) status = 'warning';
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
        if (input.isTelehealth && !['10','02'].includes(input.placeOfService)) status = 'fail';
        else if (!input.isTelehealth && input.placeOfService !== '11') status = 'warning';
        break;
      case 'modifier-95-gt':
        if (!input.isTelehealth) status = 'pass';
        break;
      case 'auth-on-file':
        if (!input.hasAuthorizationOnFile) status = 'fail';
        break;
      case 'sessions-remaining':
        if (input.authorizedSessionsRemaining !== undefined && input.authorizedSessionsRemaining <= 0) status = 'fail';
        else if (input.authorizedSessionsRemaining !== undefined && input.authorizedSessionsRemaining <= 2) status = 'warning';
        break;
      case 'start-stop-time':
        if (input.hasStartStopTime === false) status = 'fail';
        else if (input.hasStartStopTime === undefined && input.cptCode === '90837') status = 'warning';
        break;
      case 'telehealth-consent':
        if (input.isTelehealth && input.hasTelehealthConsent === false) status = 'fail';
        break;
      case 'supervising-provider':
        if (input.requiresSupervision && !input.hasSupervisingProvider) status = 'fail';
        break;
      case 'frequency-limits':
        if (input.sessionFrequencyPerWeek && input.sessionFrequencyPerWeek > 2) status = 'fail';
        else if (input.sessionFrequencyPerWeek && input.sessionFrequencyPerWeek > 1) status = 'warning';
        break;
      case 'frequency-acuity-match':
        if (input.sessionFrequencyPerWeek && input.sessionFrequencyPerWeek > 1 && input.documentedAcuityLevel === 'mild') status = 'fail';
        else if (input.sessionFrequencyPerWeek && input.sessionFrequencyPerWeek > 1 && input.documentedAcuityLevel === 'moderate') status = 'warning';
        break;
      case 'diagnosis-service-match': {
        const zOrV = input.diagnosisCodes.some(d => d.startsWith('Z') || d.startsWith('V'));
        if (zOrV && ['individual_therapy','group_therapy','family_therapy'].includes(input.sessionType)) status = 'warning';
        break;
      }
      case 'addon-documentation':
        if (input.hasAddOnPsychotherapy && !input.addOnMinutes) status = 'fail';
        break;
      // Telehealth-specific checks
      case 'pos-02-vs-10':
        if (input.isTelehealth && input.placeOfService === '02') status = 'warning';
        break;
      case 'audio-only-billing':
        if (input.isAudioOnly && ['90834','90837','90832'].includes(input.cptCode)) status = 'fail';
        break;
      case 'interstate-license':
        if (input.isTelehealth && input.patientState && input.providerState && input.patientState !== input.providerState) status = 'fail';
        else if (input.isTelehealth && !input.patientState) status = 'warning';
        break;
      case 'telehealth-platform-doc':
        if (input.isTelehealth && input.telehealthPlatformDocumented === false) status = 'warning';
        break;
      case 'crisis-safety-plan':
        if (input.isTelehealth && !input.hasCrisisSafetyPlan) status = 'fail';
        else if (input.isTelehealth && !input.hasPatientLocationDocumented) status = 'warning';
        break;
      case 'consent-reattestion':
        if (input.isTelehealth && input.consentReattestationDue) {
          const due = new Date(input.consentReattestationDue);
          if (due.getTime() < Date.now()) status = 'fail';
          else if ((due.getTime() - Date.now()) / 864e5 < 30) status = 'warning';
        }
        break;
      case 'telehealth-parity-warning':
        // Informational — always pass but payer warnings handle this
        break;
      // Note quality items
      case 'functional-impairment':
        if (input.noteQuality && !input.noteQuality.hasFunctionalImpairment) status = 'fail';
        break;
      case 'symptom-severity':
        if (input.noteQuality && !input.noteQuality.hasSymptomSeverity) status = 'fail';
        break;
      case 'treatment-response':
        if (input.noteQuality && !input.noteQuality.hasTreatmentResponse) status = 'warning';
        break;
      case 'cloned-note-risk':
        if (input.noteQuality?.appearsCloned) status = 'fail';
        break;
      case 'session-justification':
        if (input.noteQuality && !input.noteQuality.hasSessionJustification && input.sessionDurationMinutes >= 53) status = 'warning';
        break;
      case 'continued-care-rationale':
        if (input.noteQuality && !input.noteQuality.hasContinuedCareRationale) status = 'warning';
        break;
    }

    return { ...item, status };
  });

  const failCount = evaluated.filter(e => e.status === 'fail').length;
  const criticalFails = evaluated.filter(e => e.status === 'fail' && e.severity === 'critical').length;
  const warnCount = evaluated.filter(e => e.status === 'warning').length;

  const score = Math.max(0, Math.round(100 - (criticalFails * 20) - (failCount * 10) - (warnCount * 3)));

  const overallReadiness: PsychAuditResult['overallReadiness'] =
    criticalFails > 0 ? 'not-ready' : failCount > 0 || warnCount > 2 ? 'needs-attention' : 'ready';

  // Classification
  let classification: CaseClassification = 'ready';
  if (criticalFails > 0) {
    const allCurable = evaluated.filter(e => e.status === 'fail' && e.severity === 'critical').every(e => e.isCurable);
    classification = allCurable ? 'curable' : 'high-denial-risk';
  } else if (failCount > 0) {
    const allAdmin = evaluated.filter(e => e.status === 'fail').every(e => e.category === 'billing' || e.category === 'coding');
    classification = allAdmin ? 'admin-fix' : 'curable';
  } else if (warnCount > 2) {
    classification = 'human-review';
  }

  const denialRiskFactors = evaluated
    .filter(e => e.status === 'fail' && e.commonDenialReason)
    .map(e => e.whyItMatters);

  const recommendations = evaluated
    .filter(e => e.status === 'fail' || e.status === 'warning')
    .map(e => `${e.label}: ${e.detail}`);

  const mdmReview = assessMDM(input);
  const missedRevenue = detectMissedRevenue(input, mdmReview);
  const smallestFixes = computeSmallestFixes(evaluated);
  const payerWarnings = generatePayerWarnings(input);
  const noteQualityIssues = checkNoteQuality(input);

  const submitRecommendation: PsychAuditResult['submitRecommendation'] =
    classification === 'ready' ? 'submit-now' :
    classification === 'high-denial-risk' || classification === 'human-review' ? 'human-review' :
    'fix-first';

  return {
    overallReadiness, classification, score, checklist: evaluated,
    denialRiskFactors, recommendations, mdmReview, missedRevenue,
    smallestFixes, payerWarnings, noteQualityIssues, submitRecommendation,
  };
}

// ── Batch summary ──
export function computeBatchSummary(cases: { input: PsychCaseInput; result: PsychAuditResult }[]): PsychBatchSummary {
  const triggerMap = new Map<string, number>();
  const docMap = new Map<string, number>();
  let totalRisk = 0;
  let totalMissed = 0;

  for (const { input, result } of cases) {
    result.denialRiskFactors.forEach(f => triggerMap.set(f, (triggerMap.get(f) || 0) + 1));
    result.checklist.filter(c => c.status === 'fail' && c.category === 'documentation')
      .forEach(c => docMap.set(c.label, (docMap.get(c.label) || 0) + 1));
    if (result.overallReadiness !== 'ready') totalRisk += (input.claimAmount || 150);
    result.missedRevenue.forEach(m => totalMissed += (m.estimatedDifference || 0));
  }

  return {
    totalCases: cases.length,
    readyToSubmit: cases.filter(c => c.result.classification === 'ready').length,
    needsFix: cases.filter(c => ['curable','admin-fix'].includes(c.result.classification)).length,
    highRisk: cases.filter(c => ['high-denial-risk','human-review'].includes(c.result.classification)).length,
    undercoded: cases.filter(c => c.result.missedRevenue.length > 0).length,
    totalRevenueAtRisk: totalRisk,
    totalMissedRevenue: totalMissed,
    topDenialTriggers: [...triggerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([trigger, count]) => ({ trigger, count })),
    topMissingDocs: [...docMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([doc, count]) => ({ doc, count })),
  };
}
