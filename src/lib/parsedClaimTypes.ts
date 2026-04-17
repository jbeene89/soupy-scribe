// Types for the structured Claim Upload Parser output.
// Mirrors the shape returned by the `claim-parser` edge function.

export interface ParsedField<T = string | number> {
  value: T | null;
  evidence_snippet?: string | null;
  source_location?: string | null;
  confidence?: number | null;
}

export interface ParsedFieldArray<T = string> {
  value: T[];
  evidence_snippet?: string | null;
  source_location?: string | null;
  confidence?: number | null;
}

export interface ParsedClaimHeader {
  payer_name?: ParsedField<string>;
  payer_type?: ParsedField<string>;
  claim_number?: ParsedField<string>;
  authorization_number?: ParsedField<string>;
  claim_status?: ParsedField<string>;
  denial_status?: ParsedField<string>;
  appeal_status?: ParsedField<string>;
  denial_reason_codes?: ParsedFieldArray<string>;
  denial_reason_text?: ParsedField<string>;
  filing_deadline?: ParsedField<string>;
  appeal_deadline?: ParsedField<string>;
}

export interface ParsedPatient {
  patient_name?: ParsedField<string>;
  patient_id?: ParsedField<string>;
  dob?: ParsedField<string>;
  sex?: ParsedField<string>;
}

export interface ParsedProvider {
  billing_provider?: ParsedField<string>;
  rendering_provider?: ParsedField<string>;
  facility_name?: ParsedField<string>;
  npi_numbers?: ParsedFieldArray<string>;
  tax_id?: ParsedField<string>;
}

export interface ParsedService {
  date_of_service_from?: ParsedField<string>;
  date_of_service_to?: ParsedField<string>;
  place_of_service?: ParsedField<string>;
  type_of_bill?: ParsedField<string>;
}

export interface ParsedFinancials {
  total_billed_amount?: ParsedField<number>;
  allowed_amount?: ParsedField<number>;
  paid_amount?: ParsedField<number>;
  denied_amount?: ParsedField<number>;
  patient_responsibility?: ParsedField<number>;
}

export interface ParsedCodes {
  cpt_codes?: ParsedFieldArray<string>;
  hcpcs_codes?: ParsedFieldArray<string>;
  modifier_codes?: ParsedFieldArray<string>;
  icd10_codes?: ParsedFieldArray<string>;
  diagnosis_pointers?: ParsedFieldArray<string>;
}

export interface ParsedLineItem {
  service_date?: string | null;
  procedure_code?: string | null;
  modifier?: string | null;
  units?: number | null;
  charge_amount?: number | null;
  allowed_amount?: number | null;
  paid_amount?: number | null;
  denied_amount?: number | null;
  diagnosis_pointer?: string | null;
  denial_reason?: string | null;
  evidence_snippet?: string | null;
  source_location?: string | null;
  confidence?: number | null;
}

export interface ParsedReviewFlag {
  field_path: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface ParsedClaim {
  claim_header: ParsedClaimHeader;
  patient: ParsedPatient;
  provider: ParsedProvider;
  service: ParsedService;
  financials: ParsedFinancials;
  codes: ParsedCodes;
  claim_line_items: ParsedLineItem[];
  review_flags: ParsedReviewFlag[];
  unmapped_text: string[];
  document_summary?: string;
}

/** Source document we render in the evidence drawer. */
export interface ParsedSourceDocument {
  fileName: string;
  /** "pdf" = renderable PDF, "image" = renderable image, "text" = pasted/plain text. */
  kind: "pdf" | "image" | "text";
  /** Object URL for pdf/image; absent for "text". */
  objectUrl?: string;
  /** For text-only sources, the full text used for highlighting. */
  rawText?: string;
}
