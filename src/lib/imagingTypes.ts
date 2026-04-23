// Types for the Imaging Audit module.
// An ImagingFinding represents one clinical image (X-ray, intra-op photo) that
// was analyzed by the AI vision pipeline and (optionally) tied to a billing
// case via case_id, patient_id, or physician_name. Cross-module linkage flows
// through these identifiers into systemImpactService.

export type ImagingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ImagingStatus = 'analyzing' | 'analyzed' | 'reviewed' | 'dismissed';

export interface ImagingSubFinding {
  label: string;
  severity: ImagingSeverity;
  detail: string;
  matches_billing?: boolean;
}

/**
 * Failure-to-Diagnose second-opinion screen.
 * SCREENING AID ONLY — never a diagnosis. Every flagged item must be
 * reviewed by a licensed clinician.
 */
export interface FtdMissedFinding {
  label: string;
  severity: ImagingSeverity;
  detail: string;
  region?: string;
  recommend_human_review: boolean;
}

export interface FtdReview {
  summary: string;
  confidence: number;
  possible_missed_findings: FtdMissedFinding[];
  disclaimer: string;
  reviewed_at: string;
  model: string;
}

export interface ImagingFinding {
  id: string;
  case_id?: string;
  org_id?: string;
  patient_id?: string;
  physician_name?: string;
  procedure_label?: string;
  body_region?: string;
  expected_implant_count: number;
  detected_implant_count: number;
  image_storage_path?: string;
  image_file_name?: string;
  image_mime_type?: string;
  image_preview_url?: string; // signed URL or data URL for display
  ai_summary?: string;
  ai_findings: ImagingSubFinding[];
  ai_confidence: number; // 0-100
  estimated_loss: number; // $ impact
  severity: ImagingSeverity;
  status: ImagingStatus;
  reviewer_notes?: string;
  cpt_codes?: string[]; // copied from linked case for display
  ftd_review?: FtdReview;
  created_at: string;
  updated_at?: string;
}

export const BODY_REGIONS = [
  'knee',
  'hip',
  'shoulder',
  'spine',
  'foot',
  'hand',
  'wrist',
  'elbow',
  'ankle',
  'other',
] as const;

export const SEVERITY_LABELS: Record<ImagingSeverity, string> = {
  low: 'Informational',
  medium: 'Review Recommended',
  high: 'Likely Blocks Billing',
  critical: 'Patient-Safety / Fraud Risk',
};