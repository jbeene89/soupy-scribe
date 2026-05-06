export type ClawbackContractor = "cotiviti" | "performant" | "optum" | "humana_rac" | "other";

export interface ClawbackAudit {
  id: string;
  audit_name: string;
  contractor: string | null;
  contractor_type: string;
  demand_amount: number;
  universe_size: number | null;
  sample_size: number | null;
  stratification: Record<string, any>;
  audit_period_start: string | null;
  audit_period_end: string | null;
  notice_date: string | null;
  response_deadline: string | null;
  status: string;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export type DefenseStrength = "full_defense" | "strong" | "partial" | "weak" | "conceded" | "pending";

export interface ClawbackClaim {
  id: string;
  audit_id: string;
  claim_number: string | null;
  patient_ref: string | null;
  date_of_service: string | null;
  billed_amount: number;
  rac_disallowed_amount: number;
  cpt_codes: string[];
  icd_codes: string[];
  rac_finding_code: string | null;
  rac_finding_text: string | null;
  chart_file_path: string | null;
  defense_status: string;
  defense_strength: DefenseStrength | null;
  clinical_justification: string | null;
  defense_findings: any[];
  recommended_outcome: string | null;
  recovered_amount: number;
}

export interface ClawbackExtrapolation {
  audit_id: string;
  cms_compliance: Record<string, { ok: boolean; finding: string }>;
  procedural_defects: Array<{ code: string; severity: "high"|"medium"|"low"; title: string; citation: string; description: string }>;
  rac_point_estimate: number;
  rac_demand: number;
  recomputed_point_estimate: number;
  recomputed_lower_ci: number;
  precision_pct: number;
  reduced_exposure: number;
  exposure_delta: number;
  leverage_score: number;
  attack_summary: string;
  details: {
    sample_mean_overpayment?: number;
    sample_sd?: number;
    standard_error?: number;
    t_critical_90?: number;
    margin_of_error?: number;
    n?: number;
    N?: number;
    method?: "simple" | "stratified";
    df?: number;
    pending_claims?: number;
    scenarios?: {
      best_case_lower_ci: number;
      expected_lower_ci: number;
      worst_case_lower_ci: number;
      best_case_point: number;
      worst_case_point: number;
    };
  } & Record<string, any>;
}