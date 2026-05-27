export type WriteoffType =
  | 'contractual'
  | 'admin'
  | 'charity'
  | 'small_balance'
  | 'courtesy'
  | 'timely_filing'
  | 'duplicate'
  | 'no_auth';

export type WriteoffClassification = 'leak' | 'review' | 'valid';

export interface WriteoffEvent {
  id: string;
  org_id?: string;
  case_id?: string;
  event_date?: string;
  payer: string;
  patient_account?: string;
  writeoff_type: WriteoffType;
  amount: number;
  recoverable_estimate: number;
  reason_code?: string;
  policy_basis?: string;
  appeal_viable: boolean;
  classification: WriteoffClassification;
  notes?: string;
  created_at: string;
}

export interface WriteoffInput {
  payer: string;
  patient_account?: string;
  writeoff_type: WriteoffType;
  amount: number;
  reason_code?: string;
  policy_basis?: string;
  appeal_viable?: boolean;
  notes?: string;
}

export interface WriteoffComputed {
  classification: WriteoffClassification;
  recoverable_estimate: number;
  rationale: string;
}

// Recovery rates by type when there's no documented basis / appeal is viable.
// Conservative estimates based on industry averages.
const RECOVERY_RATE: Record<WriteoffType, number> = {
  admin: 0.85,         // Admin write-offs frequently overturn-able
  contractual: 0.35,   // Underpayment vs contract — partial recovery typical
  charity: 0.50,       // Missed Medicaid/charity eligibility conversion
  small_balance: 0.40, // Aggregate recovery via batched appeal
  courtesy: 0.70,      // Often lacks policy basis
  timely_filing: 0.15, // Hard to overturn but appealable on receipt-of-record grounds
  duplicate: 0.95,     // Mechanical, near-certain recovery
  no_auth: 0.45,       // Retro-auth or medical-necessity appeal
};

export function classifyWriteoff(input: WriteoffInput): WriteoffComputed {
  const hasBasis = !!(input.policy_basis && input.policy_basis.trim().length > 0);
  const appealViable = input.appeal_viable ?? false;
  const rate = RECOVERY_RATE[input.writeoff_type] ?? 0;

  let classification: WriteoffClassification = 'review';
  let rationale = 'Needs review against contract / policy.';
  let recoverable_estimate = 0;

  if (hasBasis && !appealViable) {
    classification = 'valid';
    rationale = 'Policy basis documented; not flagged as appealable.';
    recoverable_estimate = 0;
  } else if (appealViable || !hasBasis) {
    classification = 'leak';
    recoverable_estimate = Math.round(input.amount * rate);
    rationale = appealViable
      ? `Marked appeal-viable; ${Math.round(rate * 100)}% typical recovery on ${input.writeoff_type.replace('_', ' ')} write-offs.`
      : `No documented policy basis; ${Math.round(rate * 100)}% typical recovery if pursued.`;
  }

  return { classification, recoverable_estimate, rationale };
}

export const WRITEOFF_TYPE_LABELS: Record<WriteoffType, string> = {
  contractual: 'Contractual adjustment',
  admin: 'Administrative write-off',
  charity: 'Charity / financial assistance',
  small_balance: 'Small-balance write-off',
  courtesy: 'Courtesy / professional',
  timely_filing: 'Timely filing',
  duplicate: 'Duplicate / posting error',
  no_auth: 'No authorization on file',
};

export const COMMON_PAYERS = [
  'Medicare', 'Medicaid', 'BCBS', 'UnitedHealthcare', 'Aetna', 'Cigna', 'Humana', 'Tricare', 'Self-Pay', 'Other Commercial',
];