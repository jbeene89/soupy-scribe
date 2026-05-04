export type RIFindingType =
  | 'underpayment'
  | 'drg_downgrade'
  | 'missed_charge'
  | 'duplicate_denial'
  | 'modifier_drop'
  | 'timely_filing_risk';

export type RIFindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RIFindingStatus = 'open' | 'in_review' | 'recovered' | 'written_off' | 'dismissed';

export interface RevenueIntegrityFinding {
  id: string;
  owner_id: string | null;
  org_id: string | null;
  claim_id: string | null;
  patient_id: string | null;
  payer_code: string | null;
  payer_name: string | null;
  finding_type: RIFindingType;
  severity: RIFindingSeverity;
  expected_amount: number;
  paid_amount: number;
  variance_amount: number;
  description: string | null;
  source_data: Record<string, unknown>;
  status: RIFindingStatus;
  notes: string | null;
  date_of_service: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemitRow {
  claim_id: string;
  patient_id?: string;
  payer_code?: string;
  payer_name?: string;
  cpt_code?: string;
  drg_billed?: string;
  drg_paid?: string;
  expected_amount: number;
  paid_amount: number;
  date_of_service?: string;
  denial_reason?: string;
  modifier_billed?: string;
  modifier_paid?: string;
}

export interface RIDetectionResult {
  findings: Omit<RevenueIntegrityFinding, 'id' | 'created_at' | 'updated_at' | 'owner_id' | 'org_id'>[];
  summary: {
    total_claims: number;
    flagged_claims: number;
    total_variance: number;
    by_type: Record<RIFindingType, { count: number; variance: number }>;
  };
}

const UNDERPAYMENT_THRESHOLD_PCT = 0.02; // 2% variance
const UNDERPAYMENT_THRESHOLD_ABS = 25;   // or $25

function emptyByType(): RIDetectionResult['summary']['by_type'] {
  return {
    underpayment: { count: 0, variance: 0 },
    drg_downgrade: { count: 0, variance: 0 },
    missed_charge: { count: 0, variance: 0 },
    duplicate_denial: { count: 0, variance: 0 },
    modifier_drop: { count: 0, variance: 0 },
    timely_filing_risk: { count: 0, variance: 0 },
  };
}

function severityFor(variance: number): RIFindingSeverity {
  const v = Math.abs(variance);
  if (v >= 5000) return 'critical';
  if (v >= 1000) return 'high';
  if (v >= 250) return 'medium';
  return 'low';
}

/**
 * Rule-based detection of revenue leaks from a remit/claim batch.
 * Conservative — only flags clear, defensible variances.
 */
export function detectRevenueLeaks(rows: RemitRow[]): RIDetectionResult {
  const findings: RIDetectionResult['findings'] = [];
  const by_type = emptyByType();
  const denialCounts = new Map<string, number>();

  // First pass — count duplicate denials by claim_id
  for (const r of rows) {
    if (r.denial_reason) {
      denialCounts.set(r.claim_id, (denialCounts.get(r.claim_id) || 0) + 1);
    }
  }

  for (const r of rows) {
    const variance = (r.expected_amount || 0) - (r.paid_amount || 0);
    const pctVariance = r.expected_amount > 0 ? variance / r.expected_amount : 0;

    const base = {
      claim_id: r.claim_id,
      patient_id: r.patient_id ?? null,
      payer_code: r.payer_code ?? null,
      payer_name: r.payer_name ?? null,
      expected_amount: r.expected_amount || 0,
      paid_amount: r.paid_amount || 0,
      variance_amount: variance,
      date_of_service: r.date_of_service ?? null,
      status: 'open' as RIFindingStatus,
      notes: null,
      source_data: { ...r },
    };

    // 1. DRG downgrade — billed DRG != paid DRG
    if (r.drg_billed && r.drg_paid && r.drg_billed !== r.drg_paid) {
      findings.push({
        ...base,
        finding_type: 'drg_downgrade',
        severity: severityFor(variance),
        description: `DRG downgraded from ${r.drg_billed} to ${r.drg_paid}. Variance $${variance.toFixed(2)}.`,
      });
      by_type.drg_downgrade.count++;
      by_type.drg_downgrade.variance += variance;
      continue;
    }

    // 2. Modifier drop — billed modifier missing from paid
    if (r.modifier_billed && r.modifier_paid !== undefined && r.modifier_billed !== r.modifier_paid) {
      findings.push({
        ...base,
        finding_type: 'modifier_drop',
        severity: severityFor(variance),
        description: `Modifier "${r.modifier_billed}" billed, "${r.modifier_paid || 'none'}" reimbursed. Variance $${variance.toFixed(2)}.`,
      });
      by_type.modifier_drop.count++;
      by_type.modifier_drop.variance += variance;
      continue;
    }

    // 3. Duplicate denial — same claim denied 2+ times
    if ((denialCounts.get(r.claim_id) || 0) >= 2 && r.denial_reason) {
      findings.push({
        ...base,
        finding_type: 'duplicate_denial',
        severity: 'high',
        description: `Claim denied ${denialCounts.get(r.claim_id)}× — reason: "${r.denial_reason}". Pattern suggests upstream root cause.`,
      });
      by_type.duplicate_denial.count++;
      by_type.duplicate_denial.variance += variance;
      denialCounts.set(r.claim_id, -1); // dedupe
      continue;
    }

    // 4. Missed charge — expected = 0 and paid = 0 with a CPT (likely never billed)
    if (r.expected_amount === 0 && r.paid_amount === 0 && r.cpt_code) {
      findings.push({
        ...base,
        finding_type: 'missed_charge',
        severity: 'medium',
        description: `CPT ${r.cpt_code} present in record but no charge captured.`,
        expected_amount: 0,
        paid_amount: 0,
        variance_amount: 0,
      });
      by_type.missed_charge.count++;
      continue;
    }

    // 5. Underpayment — variance > threshold
    if (variance > UNDERPAYMENT_THRESHOLD_ABS && pctVariance > UNDERPAYMENT_THRESHOLD_PCT) {
      findings.push({
        ...base,
        finding_type: 'underpayment',
        severity: severityFor(variance),
        description: `Underpaid by $${variance.toFixed(2)} (${(pctVariance * 100).toFixed(1)}% of expected).`,
      });
      by_type.underpayment.count++;
      by_type.underpayment.variance += variance;
    }
  }

  return {
    findings,
    summary: {
      total_claims: rows.length,
      flagged_claims: findings.length,
      total_variance: findings.reduce((s, f) => s + f.variance_amount, 0),
      by_type,
    },
  };
}

export function parseRemitCSV(text: string): RemitRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: RemitRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim());
    const get = (k: string) => {
      const idx = header.indexOf(k);
      return idx >= 0 ? cells[idx] : '';
    };
    const claim_id = get('claim_id') || get('claim');
    if (!claim_id) continue;
    rows.push({
      claim_id,
      patient_id: get('patient_id') || undefined,
      payer_code: get('payer_code') || get('payer') || undefined,
      payer_name: get('payer_name') || undefined,
      cpt_code: get('cpt') || get('cpt_code') || undefined,
      drg_billed: get('drg_billed') || undefined,
      drg_paid: get('drg_paid') || undefined,
      expected_amount: Number(get('expected_amount') || get('expected') || 0),
      paid_amount: Number(get('paid_amount') || get('paid') || 0),
      date_of_service: get('date_of_service') || get('dos') || undefined,
      denial_reason: get('denial_reason') || undefined,
      modifier_billed: get('modifier_billed') || undefined,
      modifier_paid: get('modifier_paid') || undefined,
    });
  }
  return rows;
}

export const DEMO_REMIT: RemitRow[] = [
  { claim_id: 'CLM-001', patient_id: 'P-1001', payer_code: 'BCBS', payer_name: 'BCBS', cpt_code: '47562', expected_amount: 2400, paid_amount: 2150, date_of_service: '2025-08-12' },
  { claim_id: 'CLM-002', patient_id: 'P-1002', payer_code: 'AETNA', payer_name: 'Aetna', drg_billed: '470', drg_paid: '469', expected_amount: 14200, paid_amount: 11800, date_of_service: '2025-08-15' },
  { claim_id: 'CLM-003', patient_id: 'P-1003', payer_code: 'UHC', payer_name: 'UnitedHealthcare', cpt_code: '29827', modifier_billed: '59', modifier_paid: '', expected_amount: 1850, paid_amount: 925, date_of_service: '2025-08-18' },
  { claim_id: 'CLM-004', patient_id: 'P-1004', payer_code: 'CIGNA', payer_name: 'Cigna', cpt_code: '64483', expected_amount: 720, paid_amount: 720, date_of_service: '2025-08-20', denial_reason: 'Medical necessity' },
  { claim_id: 'CLM-004', patient_id: 'P-1004', payer_code: 'CIGNA', payer_name: 'Cigna', cpt_code: '64483', expected_amount: 720, paid_amount: 0, date_of_service: '2025-08-25', denial_reason: 'Medical necessity' },
  { claim_id: 'CLM-005', patient_id: 'P-1005', payer_code: 'MEDICARE', payer_name: 'Medicare', cpt_code: '99232', expected_amount: 0, paid_amount: 0, date_of_service: '2025-08-22' },
  { claim_id: 'CLM-006', patient_id: 'P-1006', payer_code: 'BCBS', payer_name: 'BCBS', cpt_code: '27447', expected_amount: 18500, paid_amount: 17200, date_of_service: '2025-08-24' },
  { claim_id: 'CLM-007', patient_id: 'P-1007', payer_code: 'AETNA', payer_name: 'Aetna', drg_billed: '247', drg_paid: '246', expected_amount: 22100, paid_amount: 18400, date_of_service: '2025-08-28' },
];