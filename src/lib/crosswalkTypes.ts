// Types for the Claim-to-Clinical Crosswalk Engine.
// These mirror the tool-call schemas in:
//   - supabase/functions/note-parse-structured (ParsedNote)
//   - supabase/functions/claim-clinical-crosswalk (CrosswalkVerdict)

/* ──────────── Parsed clinical note ──────────── */

export interface NoteEvidenceBlock {
  text: string | null;
  evidence_quote: string | null;
  present: boolean;
}

export interface NoteMSE {
  appearance?: NoteEvidenceBlock;
  behavior?: NoteEvidenceBlock;
  speech?: NoteEvidenceBlock;
  mood?: NoteEvidenceBlock;
  affect?: NoteEvidenceBlock;
  thought_process?: NoteEvidenceBlock;
  thought_content?: NoteEvidenceBlock;
  cognition?: NoteEvidenceBlock;
  insight?: NoteEvidenceBlock;
  judgment?: NoteEvidenceBlock;
}

export interface NoteSymptom {
  symptom: string;
  duration?: string | null;
  severity?: string | null;
  evidence_quote: string;
}

export interface NoteFunctionalImpairment {
  documented: boolean;
  domains_affected?: string[];
  evidence_quote?: string | null;
}

export interface NoteRisk {
  assessed: boolean;
  si_documented?: boolean | null;
  hi_documented?: boolean | null;
  risk_level_stated?: string | null;
  safety_plan_present?: boolean | null;
  evidence_quote?: string | null;
}

export interface NoteDiagnosis {
  code?: string | null;
  label: string;
  evidence_quote: string;
}

export interface NotePsychotherapy {
  present: boolean;
  modality?: string | null;
  interventions?: string[];
  patient_response?: string | null;
  evidence_quote?: string | null;
}

export interface NoteMedManagement {
  medications_reviewed?: boolean | null;
  medications_listed?: string[];
  changes_made?: boolean | null;
  change_details?: string | null;
  rationale_documented?: boolean | null;
  rationale_quote?: string | null;
  side_effects_discussed?: boolean | null;
  adherence_discussed?: boolean | null;
  evidence_quote?: string | null;
}

export interface NoteTimeBlock {
  start_time?: string | null;
  stop_time?: string | null;
  total_minutes?: number | null;
  psychotherapy_minutes?: number | null;
  em_minutes?: number | null;
  time_statement_present: boolean;
  evidence_quote?: string | null;
}

export interface NoteContradiction {
  statement_a: string;
  statement_b: string;
  why_it_contradicts: string;
}

export interface ParsedNote {
  visit_type?: string | null;
  visit_type_evidence?: string | null;
  date_of_service?: string | null;
  time_documented: NoteTimeBlock;
  hpi?: NoteEvidenceBlock;
  mse: NoteMSE;
  symptoms_documented: NoteSymptom[];
  functional_impairment: NoteFunctionalImpairment;
  risk_assessment: NoteRisk;
  assessment?: NoteEvidenceBlock;
  diagnoses_in_note: NoteDiagnosis[];
  medical_necessity_statement?: NoteEvidenceBlock;
  treatment_plan?: NoteEvidenceBlock;
  psychotherapy_narrative: NotePsychotherapy;
  medication_management: NoteMedManagement;
  cpt_codes_in_note?: string[];
  modifiers_in_note?: string[];
  copy_forward_indicators: string[];
  internal_contradictions: NoteContradiction[];
  document_summary: string;
}

/* ──────────── Crosswalk verdict ──────────── */

export type SupportLevel = "supported" | "weakly_supported" | "unsupported";
export type StrengthLevel = "strong" | "moderate" | "weak";
export type StrengthOrNA = StrengthLevel | "not_applicable";
export type TimeVerdict = "valid" | "questionable" | "unsupported" | "not_applicable";
export type DiagnosisStrength = "strong" | "moderate" | "weak";
export type Decision =
  | "ready_to_submit"
  | "needs_fix"
  | "high_denial_risk"
  | "undercoded"
  | "not_defensible";
export type Priority = "high" | "medium" | "low";

export interface ServiceMatch {
  verdict: SupportLevel;
  cpt_under_review: string;
  why: string;
  visit_type_documented?: string | null;
  modifier_issues: string[];
}

export interface DiagnosisSupportRow {
  diagnosis: string;
  supported_by: string[];
  missing_support: string[];
  contradictions: string[];
  support_strength: DiagnosisStrength;
}

export interface MedicalNecessity {
  verdict: StrengthLevel;
  symptom_severity_documented: boolean;
  functional_impairment_documented: boolean;
  risk_level_documented: boolean;
  treatment_justification_documented: boolean;
  missing_elements: string[];
  why: string;
}

export interface MedManagementSupport {
  applies: boolean;
  verdict: StrengthOrNA;
  medication_review_documented?: boolean | null;
  changes_documented?: boolean | null;
  rationale_documented?: boolean | null;
  side_effects_documented?: boolean | null;
  adherence_documented?: boolean | null;
  missing_elements: string[];
}

export interface TimeSupport {
  verdict: TimeVerdict;
  time_statement_present: boolean;
  documented_minutes?: number | null;
  required_minutes_for_billed_code?: number | null;
  issues: string[];
}

export interface CrosswalkContradiction {
  type: "claim_vs_note" | "internal_to_note" | "internal_to_claim";
  statement_a: string;
  statement_b: string;
  why: string;
  severity: "low" | "medium" | "high";
}

export interface PreSubmissionDecision {
  decision: Decision;
  confidence: number;
  headline: string;
  why: string;
}

export interface CrosswalkAction {
  issue: string;
  action: string;
  priority: Priority;
}

export interface AppealReadiness {
  applicable: boolean;
  strength: StrengthOrNA;
  argument?: string | null;
  evidence_to_cite: string[];
  what_is_missing: string[];
}

export interface CrosswalkVerdict {
  service_match: ServiceMatch;
  diagnosis_support_matrix: DiagnosisSupportRow[];
  medical_necessity: MedicalNecessity;
  med_management_support: MedManagementSupport;
  time_support: TimeSupport;
  contradictions: CrosswalkContradiction[];
  pre_submission_decision: PreSubmissionDecision;
  actions: CrosswalkAction[];
  appeal_readiness: AppealReadiness;
}

/* ──────────── UI helpers ──────────── */

export const DECISION_META: Record<Decision, { label: string; tone: string; badge: string }> = {
  ready_to_submit: {
    label: "Ready to Submit",
    tone: "text-emerald-600 border-emerald-500/40 bg-emerald-500/5",
    badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  },
  needs_fix: {
    label: "Needs Fix",
    tone: "text-amber-600 border-amber-500/40 bg-amber-500/5",
    badge: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  high_denial_risk: {
    label: "High Denial Risk",
    tone: "text-destructive border-destructive/40 bg-destructive/5",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
  },
  undercoded: {
    label: "Undercoded",
    tone: "text-blue-600 border-blue-500/40 bg-blue-500/5",
    badge: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  },
  not_defensible: {
    label: "Not Defensible",
    tone: "text-destructive border-destructive/60 bg-destructive/10",
    badge: "bg-destructive/20 text-destructive border-destructive/50",
  },
};

export function strengthTone(level: StrengthLevel | SupportLevel | DiagnosisStrength): string {
  if (level === "strong" || level === "supported") return "text-emerald-600 bg-emerald-500/10 border-emerald-500/30";
  if (level === "moderate" || level === "weakly_supported") return "text-amber-600 bg-amber-500/10 border-amber-500/30";
  return "text-destructive bg-destructive/10 border-destructive/30";
}

export function priorityTone(p: Priority): string {
  if (p === "high") return "text-destructive bg-destructive/10 border-destructive/30";
  if (p === "medium") return "text-amber-600 bg-amber-500/10 border-amber-500/30";
  return "text-muted-foreground bg-muted border-border";
}
