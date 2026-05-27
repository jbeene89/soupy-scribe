import type { WriteoffEvent, WriteoffInput } from './writeoffTypes';
import { classifyWriteoff } from './writeoffTypes';

function mk(p: WriteoffInput & { daysAgo: number; patient_account?: string }): WriteoffEvent {
  const c = classifyWriteoff(p);
  return {
    id: crypto.randomUUID(),
    payer: p.payer,
    patient_account: p.patient_account,
    writeoff_type: p.writeoff_type,
    amount: p.amount,
    reason_code: p.reason_code,
    policy_basis: p.policy_basis,
    appeal_viable: p.appeal_viable ?? false,
    classification: c.classification,
    recoverable_estimate: c.recoverable_estimate,
    notes: p.notes,
    created_at: new Date(Date.now() - p.daysAgo * 86400000).toISOString(),
  };
}

export const mockWriteoffEvents: WriteoffEvent[] = [
  mk({ payer: 'BCBS', patient_account: 'P-44821', writeoff_type: 'admin', amount: 4820, appeal_viable: true, reason_code: 'CO-45', notes: 'Adjustment taken without contract reference.', daysAgo: 2 }),
  mk({ payer: 'UnitedHealthcare', patient_account: 'P-44910', writeoff_type: 'contractual', amount: 12400, appeal_viable: true, reason_code: 'CO-45', notes: 'Underpayment vs contracted rate per fee schedule.', daysAgo: 3 }),
  mk({ payer: 'Medicare', patient_account: 'P-44855', writeoff_type: 'timely_filing', amount: 6700, reason_code: 'CO-29', notes: 'Initial submission documented at day 88; appealable on receipt-of-record.', daysAgo: 4 }),
  mk({ payer: 'Aetna', patient_account: 'P-44980', writeoff_type: 'no_auth', amount: 8900, appeal_viable: true, reason_code: 'CO-197', notes: 'Service was urgent; retro-auth viable.', daysAgo: 5 }),
  mk({ payer: 'Cigna', patient_account: 'P-45011', writeoff_type: 'duplicate', amount: 1820, appeal_viable: true, notes: 'Posting error — same DOS billed twice, second auto-denied.', daysAgo: 6 }),
  mk({ payer: 'Self-Pay', patient_account: 'P-45044', writeoff_type: 'charity', amount: 3200, notes: 'No financial-assistance application on file; eligibility unknown.', daysAgo: 7 }),
  mk({ payer: 'BCBS', patient_account: 'P-45070', writeoff_type: 'small_balance', amount: 142, notes: 'Below $250 threshold — written off without review.', daysAgo: 8 }),
  mk({ payer: 'Humana', patient_account: 'P-45088', writeoff_type: 'courtesy', amount: 540, notes: 'Front-desk applied courtesy; no policy reference.', daysAgo: 9 }),
  mk({ payer: 'Medicaid', patient_account: 'P-45100', writeoff_type: 'contractual', amount: 980, policy_basis: 'State fee schedule confirmed.', daysAgo: 10 }),
  mk({ payer: 'UnitedHealthcare', patient_account: 'P-45123', writeoff_type: 'admin', amount: 7200, appeal_viable: true, notes: 'Billing supervisor adjustment, no documented rationale.', daysAgo: 11 }),
  mk({ payer: 'Tricare', patient_account: 'P-45140', writeoff_type: 'no_auth', amount: 4100, appeal_viable: true, daysAgo: 12 }),
  mk({ payer: 'BCBS', patient_account: 'P-45155', writeoff_type: 'small_balance', amount: 88, daysAgo: 13 }),
];