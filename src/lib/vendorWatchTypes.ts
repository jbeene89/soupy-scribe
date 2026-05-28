export type VendorWatchDocType =
  | 'contract'
  | 'fee_schedule'
  | 'remit'
  | 'eob'
  | 'correspondence'
  | 'other';

export type VendorWatchStatus = 'pending' | 'analyzing' | 'analyzed' | 'failed';

export type VendorWatchSeverity = 'low' | 'medium' | 'high' | 'critical';

// Canonical vendor-anomaly taxonomy. The AI MUST emit one of these for
// finding_type; anything else is coerced to 'other'. Keeping this enum small
// and stable is what lets the dashboard / CSV / reconciler dedupe correctly.
export const VENDOR_ANOMALIES = [
  'rate_variance',          // billed/paid != contracted rate
  'shadow_fee',             // line item not in contract / fee schedule
  'duplicate_billing',      // same service billed >1x in same period
  'unit_inflation',         // qty / units exceed expected
  'auto_renewal_trap',      // notice-to-cancel window > standard
  'unfavorable_clause',     // one-sided terms, silent on appeals, etc.
  'missing_clause',         // expected protection absent
  'timely_filing',          // filing window too short / inconsistent
  'recoupment_risk',        // recoupment without notice / offset rights
  'sla_breach',             // SLA credits owed, downtime, etc.
  'price_creep',            // rate increased vs prior period
  'underpayment',           // paid < allowed
  'denial_pattern',         // suspicious CARC/RARC clustering
  'fee_schedule_drift',     // schedule diverges from contract basis
  'cross_doc_conflict',     // contradiction across documents
  'other',
] as const;
export type VendorAnomalyType = typeof VENDOR_ANOMALIES[number];

export interface RateScheduleEntry {
  service_code?: string;       // CPT/HCPCS/internal SKU
  service_name: string;        // human-readable name (used for fuzzy match)
  unit_price?: number;         // contracted per-unit rate
  basis?: string;              // "% Medicare", "fixed", "per-diem", etc.
  basis_value?: number;        // e.g. 110 for "110% Medicare"
  effective_start?: string;
  effective_end?: string;
  notes?: string;
}

export interface InvoiceLineItem {
  service_code?: string;
  service_name: string;
  quantity?: number;
  unit_price?: number;
  line_total?: number;
  service_date?: string;
  line_ref?: string;           // invoice line number / claim ID
}

export type VendorWatchAnalysis = {
  summary: string;
  document_kind: string;
  detected_vendor_name?: string;
  detected_doc_type?: VendorWatchDocType;
  key_terms?: Array<{ label: string; value: string }>;
  // Structured payloads the reconciler uses on future uploads.
  rate_schedule?: RateScheduleEntry[];     // populated for contracts / fee schedules
  line_items?: InvoiceLineItem[];          // populated for invoices / remits / EOBs
  billing_period_start?: string;
  billing_period_end?: string;
  invoice_total?: number;
  findings?: Array<{
    finding_type: VendorAnomalyType | string;
    severity: VendorWatchSeverity;
    title: string;
    detail?: string;
    recommended_action?: string;
    dollar_impact?: number;
    quoted_language?: string;
    affected_lines?: string[];             // line_ref / service_code refs (dedup)
  }>;
  cross_references?: Array<{
    related_document_id?: string;
    related_file_name?: string;
    related_vendor?: string;
    relationship: string;     // e.g. "rate_conflict", "matches", "supersedes", "supports", "contradicts"
    detail: string;
    severity?: VendorWatchSeverity;
    dollar_impact?: number;
  }>;
  confidence: number;
};

export interface VendorWatchDocument {
  id: string;
  owner_id: string;
  vendor_key: string;
  vendor_name: string;
  doc_type: VendorWatchDocType;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  raw_text: string | null;
  status: VendorWatchStatus;
  analysis: VendorWatchAnalysis | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorWatchFinding {
  id: string;
  document_id: string;
  owner_id: string;
  finding_type: string;
  severity: VendorWatchSeverity;
  title: string;
  detail: string | null;
  recommended_action: string | null;
  dollar_impact: number | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export const DOC_TYPE_LABELS: Record<VendorWatchDocType, string> = {
  contract: 'Contract',
  fee_schedule: 'Fee schedule',
  remit: 'Remittance / 835',
  eob: 'EOB',
  correspondence: 'Correspondence',
  other: 'Other',
};