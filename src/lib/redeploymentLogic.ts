import type { CapacityEvent } from './capacityTypes';
import { NURSE_HOURLY_LOADED, SHIFT_HOURS } from './capacityTypes';

export interface RedeployTarget {
  id: string;
  title: string;
  description: string;
  skillGap: 'none' | 'training-light' | 'cert-required';
  recoveryPerFtePerYear: number;
  fromFunctions: string[];
}

// Annual revenue-protecting impact per redeployed FTE (industry midpoints).
export const REDEPLOY_TARGETS: RedeployTarget[] = [
  {
    id: 'underpayment-recovery',
    title: 'Underpayment / Contract Variance Recovery',
    description: 'Audit contracted reimbursement vs. paid; recover 1–5% of net patient revenue currently lost as contractual write-offs.',
    skillGap: 'training-light',
    recoveryPerFtePerYear: 480_000,
    fromFunctions: ['Billing', 'Scheduling', 'Patient Access'],
  },
  {
    id: 'denial-prevention',
    title: 'Front-End Denial Prevention',
    description: 'Deep insurance verification + prior-auth confirmation before service. Each prevented denial saves $180–$1,500 rework.',
    skillGap: 'none',
    recoveryPerFtePerYear: 260_000,
    fromFunctions: ['Scheduling', 'Registration', 'Patient Access'],
  },
  {
    id: 'concurrent-overturn',
    title: 'Concurrent Denial Overturn',
    description: 'Address denials while patient is still inpatient — overturn rate 2–3× retrospective appeal.',
    skillGap: 'training-light',
    recoveryPerFtePerYear: 410_000,
    fromFunctions: ['Case Management Admin', 'Billing'],
  },
  {
    id: 'adr-response',
    title: 'ADR / Records Request Response',
    description: 'Assemble and ship Additional Document Requests on time — unanswered ADRs auto-convert to denials.',
    skillGap: 'none',
    recoveryPerFtePerYear: 320_000,
    fromFunctions: ['Health Information Management', 'Medical Records'],
  },
  {
    id: 'eligibility-conversion',
    title: 'Charity / Medicaid Eligibility Conversion',
    description: 'Screen self-pay AR for charity / Medicaid eligibility — converts bad-debt write-offs into reimbursed encounters.',
    skillGap: 'training-light',
    recoveryPerFtePerYear: 290_000,
    fromFunctions: ['Financial Counseling', 'Patient Access'],
  },
  {
    id: 'pre-bill-audit',
    title: 'Pre-Bill / DRG Validation',
    description: 'Catch under-coding and missed CCs/MCCs before claim drop. Recovers 1–3% of net patient revenue.',
    skillGap: 'cert-required',
    recoveryPerFtePerYear: 540_000,
    fromFunctions: ['Coding', 'CDI Support'],
  },
  {
    id: 'rac-defense',
    title: 'Internal RAC / MAC / TPE Audit Prep',
    description: 'Pre-empt payer takebacks with internal audit defense queue. One prevented RAC = $50K–$500K.',
    skillGap: 'training-light',
    recoveryPerFtePerYear: 380_000,
    fromFunctions: ['Quality', 'Compliance Admin'],
  },
];

export interface RedeploymentSummary {
  slackFteWeekly: number;        // FTE-equivalent of dormant clinical capacity per week
  slackHoursWeekly: number;
  slackLaborCostWeekly: number;  // Already-paid labor cost being burned weekly
  annualizedSlackCost: number;
  topTargets: (RedeployTarget & { potentialAnnualRecovery: number })[];
}

// One US FTE = 36 productive hours/week (40 minus PTO/admin).
const FTE_HOURS_WEEK = 36;

export function computeRedeployment(events: CapacityEvent[]): RedeploymentSummary {
  // Aggregate surplus nurse hours from under_ratio events (proxy for dormant capacity).
  let surplusNurseShifts = 0;
  for (const e of events) {
    if (e.classification !== 'under_ratio') continue;
    const needed = e.target_ratio > 0 ? e.occupied_beds / e.target_ratio : 0;
    const surplus = Math.max(0, e.nurses_on_shift - needed);
    surplusNurseShifts += surplus;
  }
  // Convert shift-units to weekly hours assuming the sample roughly represents a week of operations.
  // If events span multiple weeks, this still scales linearly as a "per logged-week" rate.
  const slackHoursWeekly = surplusNurseShifts * SHIFT_HOURS;
  const slackFteWeekly = Number((slackHoursWeekly / FTE_HOURS_WEEK).toFixed(2));
  const slackLaborCostWeekly = Math.round(slackHoursWeekly * NURSE_HOURLY_LOADED);
  const annualizedSlackCost = slackLaborCostWeekly * 52;

  // Rank targets by recovery potential, scaled to slack FTE.
  const topTargets = [...REDEPLOY_TARGETS]
    .map(t => ({ ...t, potentialAnnualRecovery: Math.round(t.recoveryPerFtePerYear * slackFteWeekly) }))
    .sort((a, b) => b.potentialAnnualRecovery - a.potentialAnnualRecovery);

  return { slackFteWeekly, slackHoursWeekly, slackLaborCostWeekly, annualizedSlackCost, topTargets };
}