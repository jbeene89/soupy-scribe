// Shared types and constants for the Patient Self-Help record-reconciliation flow.

export const WORRIES = [
  { value: 'med_before_consent', label: 'Medication before consent' },
  { value: 'procedure_without_consent', label: 'Procedure without consent' },
  { value: 'wrong_diagnosis', label: 'Wrong diagnosis' },
  { value: 'missing_test', label: 'Missing test or missing result' },
  { value: 'chart_mismatch', label: '"They said X but chart says Y"' },
  { value: 'billing', label: 'Billing / charges look wrong' },
  { value: 'unsure', label: "I don't know, just check it" },
] as const;

export type WorryValue = typeof WORRIES[number]['value'];

export const DOC_TYPES = [
  { value: 'auto', label: 'Let the system detect' },
  { value: 'clinical_record', label: 'Clinical medical record / chart release' },
  { value: 'bill_eob', label: 'Itemized bill / EOB / UB-04 / CMS-1500' },
  { value: 'lab_report', label: 'Lab report' },
  { value: 'imaging_report', label: 'Imaging report' },
  { value: 'discharge_instructions', label: 'Discharge instructions' },
  { value: 'consent_packet', label: 'Consent packet' },
  { value: 'portal_message', label: 'Portal message / screenshot' },
  { value: 'insurance_denial', label: 'Insurance denial' },
  { value: 'unknown', label: 'Unknown / mixed' },
] as const;

export type DocType = typeof DOC_TYPES[number]['value'];

export const BUCKETS = [
  'Looks Routine',
  'Needs Clarification',
  'Record Mismatch',
  'Consent / Patient-Rights Flag',
  'Missing Source Document',
  'Ask For This Next',
] as const;

export type Bucket = typeof BUCKETS[number];

export type FindingCard = {
  bucket: Bucket;
  title: string;
  whyItMatters: string;
  whatRecordShows: string;
  whatItDoesNotProve: string;
  askNext: string;
  severity?: 'high-documentation-issue' | 'moderate' | 'low' | 'informational';
  sourceFile?: string;
  sourcePages?: number[];
};

export type Recollection = {
  approxTime?: string;
  whoPresent?: string;
  whatWasSaid?: string;
  whatYouConsentedTo?: string;
  whatYouWereNotTold?: string;
  quote?: string;
};

export type AnalysisModes = {
  clinical: boolean;
  billing: boolean;
  consent: boolean;
};

export type StructuredSummary = {
  supports: string;
  contains: string[];
  doesNotInclude: string[];
  disabledModes: string[];
  headlineAsks: string[];
};

export const BUCKET_COLORS: Record<Bucket, string> = {
  'Looks Routine': 'bg-muted text-muted-foreground border-muted-foreground/20',
  'Needs Clarification': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  'Record Mismatch': 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  'Consent / Patient-Rights Flag': 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
  'Missing Source Document': 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  'Ask For This Next': 'bg-primary/10 text-primary border-primary/30',
};

export const BUCKET_BLURB: Record<Bucket, string> = {
  'Looks Routine': 'Normal admin, forms, or expected language. Flagged so you can see what was reviewed.',
  'Needs Clarification': 'Something is documented, but the record alone is not enough to verify.',
  'Record Mismatch': 'One part of the chart says a thing happened; another part fails to show the receipt.',
  'Consent / Patient-Rights Flag': 'Consent is missing, late, generic, or out of order relative to what was done.',
  'Missing Source Document': 'The chart references a document that should exist elsewhere but is not in this export.',
  'Ask For This Next': 'Exact records to request, written so you can copy and send.',
};

export const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label]),
);

export const WORRY_LABEL: Record<string, string> = Object.fromEntries(
  WORRIES.map((w) => [w.value, w.label]),
);