// Behavioral Health / Psych Practice types

export type SessionType =
  | 'individual_therapy'
  | 'group_therapy'
  | 'family_therapy'
  | 'psych_testing'
  | 'medication_management'
  | 'crisis_intervention'
  | 'telehealth'
  | 'intake_evaluation';

export type DenialReason =
  | 'medical_necessity'
  | 'frequency_exceeded'
  | 'auth_expired'
  | 'wrong_modifier'
  | 'incomplete_treatment_plan'
  | 'missing_progress_notes'
  | 'place_of_service'
  | 'timely_filing'
  | 'credential_issue'
  | 'bundling'
  | 'cloned_notes'
  | 'missing_start_stop_time'
  | 'diagnosis_service_mismatch'
  | 'non_covered_diagnosis'
  | 'missing_supervision'
  | 'telehealth_consent'
  | 'em_documentation_gap'
  | 'frequency_acuity_mismatch';

export type CaseClassification =
  | 'ready'
  | 'curable'
  | 'admin-fix'
  | 'high-denial-risk'
  | 'human-review';

export type MDMLevel = 'straightforward' | 'low' | 'moderate' | 'high';

export interface PsychChecklistItem {
  id: string;
  category: 'documentation' | 'coding' | 'authorization' | 'billing' | 'note-quality' | 'em-coding' | 'revenue' | 'telehealth';
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  sessionTypes: SessionType[];
  commonDenialReason?: DenialReason;
  whyItMatters: string;
  correction?: string;
  isCurable?: boolean;
}

export interface PsychCaseInput {
  id?: string;
  patientLabel?: string;
  sessionType: SessionType;
  cptCode: string;
  diagnosisCodes: string[];
  sessionDurationMinutes: number;
  hasCurrentTreatmentPlan: boolean;
  treatmentPlanExpiry?: string;
  hasAuthorizationOnFile: boolean;
  authExpiryDate?: string;
  authorizedSessionsRemaining?: number;
  hasProgressNotes: boolean;
  hasMedicalNecessityStatement: boolean;
  placeOfService: string;
  isTelehealth: boolean;
  payerName?: string;
  claimAmount?: number;
  dateOfService?: string;
  // Extended fields
  hasStartStopTime?: boolean;
  hasTelehealthConsent?: boolean;
  hasSupervisingProvider?: boolean;
  requiresSupervision?: boolean;
  noteQuality?: NoteQualityInput;
  emInput?: EMInput;
  sessionFrequencyPerWeek?: number;
  documentedAcuityLevel?: 'mild' | 'moderate' | 'severe';
  hasAddOnPsychotherapy?: boolean;
  addOnCptCode?: string;
  addOnMinutes?: number;
  // Telehealth-specific fields
  isAudioOnly?: boolean;
  patientState?: string;
  providerState?: string;
  telehealthPlatformDocumented?: boolean;
  hasCrisisSafetyPlan?: boolean;
  hasPatientLocationDocumented?: boolean;
  telehealthConsentDate?: string;
  consentReattestationDue?: string;
  hasEmergencyContactOnFile?: boolean;
  // Revenue lane fields
  hasCollaborativeCareAgreement?: boolean;
  hasCaregiverSessionDocumented?: boolean;
  hasPharmacogenomicTesting?: boolean;
  totalIntakeMinutes?: number;
  hasScreeningTools?: boolean;
  screeningToolsUsed?: string[];
}

export interface NoteQualityInput {
  hasFunctionalImpairment: boolean;
  hasSymptomSeverity: boolean;
  hasTreatmentResponse: boolean;
  hasMoodAffectDetail: boolean;
  hasSessionJustification: boolean;
  hasContinuedCareRationale: boolean;
  appearsCloned: boolean;
}

export interface EMInput {
  selectedEMCode: string;
  problemsAddressed: number;
  isNewProblem: boolean;
  dataReviewed: ('labs' | 'imaging' | 'records' | 'consult' | 'medication_history')[];
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high';
  hasIndependentInterpretation: boolean;
  totalTimeFaceToFace?: number;
  hasAssessmentPlan: boolean;
  documentedComplexity?: string;
}

export interface MDMReview {
  problemComplexity: MDMLevel;
  dataComplexity: MDMLevel;
  riskLevel: MDMLevel;
  overallMDM: MDMLevel;
  supportedEMCode: string;
  selectedEMCode: string;
  isUndercoded: boolean;
  isOvercoded: boolean;
  explanation: string;
  higherCodeOpportunity?: string;
  downgradeRisk?: string;
  supportStrength: 'strong' | 'moderate' | 'weak';
}

export interface ImplementationStep {
  step: number;
  action: string;
  detail: string;
}

export interface MissedRevenueItem {
  type: 'higher-em' | 'psychotherapy-time' | 'add-on-code' | 'complexity-undercoded' | 'prolonged-service' | 'collaborative-care' | 'caregiver-session' | 'screening-tools' | 'extended-intake' | 'pharmacogenomic' | 'chronic-care';
  description: string;
  currentCode: string;
  suggestedCode?: string;
  estimatedDifference?: number;
  confidence: 'likely' | 'possible' | 'review-recommended';
  requiredAction: string;
  implementationPlan?: ImplementationStep[];
  timeToImplement?: string;
  complexity?: 'same-day' | 'this-week' | '2-4 weeks' | '1-3 months';
}

export interface SmallestFix {
  priority: number;
  description: string;
  effort: 'quick' | 'moderate' | 'involved';
  impact: 'high' | 'medium' | 'low';
}

export interface PsychAuditResult {
  overallReadiness: 'ready' | 'needs-attention' | 'not-ready';
  classification: CaseClassification;
  score: number;
  checklist: (PsychChecklistItem & { status: 'pass' | 'fail' | 'warning' })[];
  denialRiskFactors: string[];
  recommendations: string[];
  mdmReview?: MDMReview;
  missedRevenue: MissedRevenueItem[];
  smallestFixes: SmallestFix[];
  payerWarnings: string[];
  noteQualityIssues: string[];
  submitRecommendation: 'submit-now' | 'fix-first' | 'human-review';
}

export interface RevenueLaneSummary {
  lane: string;
  label: string;
  totalPerCase: number;
  caseCount: number;
  monthlyEstimate: number;
  description: string;
}

export interface PsychBatchSummary {
  totalCases: number;
  readyToSubmit: number;
  needsFix: number;
  highRisk: number;
  undercoded: number;
  totalRevenueAtRisk: number;
  totalMissedRevenue: number;
  topDenialTriggers: { trigger: string; count: number }[];
  topMissingDocs: { doc: string; count: number }[];
  revenueLanes: RevenueLaneSummary[];
  totalMonthlyOpportunity: number;
}
