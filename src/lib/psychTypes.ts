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
  | 'bundling';

export interface PsychChecklistItem {
  id: string;
  category: 'documentation' | 'coding' | 'authorization' | 'billing';
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium';
  sessionTypes: SessionType[];
  commonDenialReason?: DenialReason;
  whyItMatters: string;
}

export interface PsychCaseInput {
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
}

export interface PsychAuditResult {
  overallReadiness: 'ready' | 'needs-attention' | 'not-ready';
  score: number;
  checklist: (PsychChecklistItem & { status: 'pass' | 'fail' | 'warning' })[];
  denialRiskFactors: string[];
  recommendations: string[];
}
