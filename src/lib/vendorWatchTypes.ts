export type VendorWatchDocType =
  | 'contract'
  | 'fee_schedule'
  | 'remit'
  | 'eob'
  | 'correspondence'
  | 'other';

export type VendorWatchStatus = 'pending' | 'analyzing' | 'analyzed' | 'failed';

export type VendorWatchSeverity = 'low' | 'medium' | 'high' | 'critical';

export type VendorWatchAnalysis = {
  summary: string;
  document_kind: string;
  key_terms?: Array<{ label: string; value: string }>;
  findings?: Array<{
    finding_type: string;
    severity: VendorWatchSeverity;
    title: string;
    detail?: string;
    recommended_action?: string;
    dollar_impact?: number;
    quoted_language?: string;
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