/**
 * Regulatory clock tracker.
 *
 * Computes appeal deadlines, prompt-pay clocks, and external-review windows
 * given a denial date, payer type, and state. The values below are
 * conservative defaults distilled from publicly known state insurance
 * commissioner rules. Real deployments should overlay the provider's
 * specific contract terms which often shorten or lengthen these clocks.
 */

export type PayerType = "commercial-fully-insured" | "self-funded-erisa" | "medicare-advantage" | "medicaid-managed-care" | "medicaid-fee-for-service" | "tricare";

export interface ClockRule {
  label: string;
  daysFromDenial: number;
  basis: string;
  severity: "info" | "deadline" | "regulatory";
}

const COMMON_RULES: Record<PayerType, ClockRule[]> = {
  "commercial-fully-insured": [
    { label: "First-level internal appeal", daysFromDenial: 180, basis: "ACA standard for non-grandfathered plans", severity: "deadline" },
    { label: "External review request", daysFromDenial: 120, basis: "Federal external review (45 CFR 147.136) — clock starts at final internal denial", severity: "deadline" },
    { label: "Provider corrected-claim window (typical)", daysFromDenial: 90, basis: "Most commercial contracts; verify in payer manual", severity: "info" },
  ],
  "self-funded-erisa": [
    { label: "First-level internal appeal", daysFromDenial: 180, basis: "ERISA 29 CFR 2560.503-1", severity: "deadline" },
    { label: "Plan must respond to non-urgent appeal", daysFromDenial: 60, basis: "ERISA full and fair review (counted from appeal filing, not denial)", severity: "regulatory" },
    { label: "Plan must respond to urgent appeal", daysFromDenial: 3, basis: "ERISA urgent care 72-hour rule", severity: "regulatory" },
  ],
  "medicare-advantage": [
    { label: "Reconsideration (Level 1)", daysFromDenial: 60, basis: "42 CFR 422.582", severity: "deadline" },
    { label: "ALJ hearing (Level 3)", daysFromDenial: 60, basis: "After IRE decision", severity: "info" },
    { label: "Expedited reconsideration response", daysFromDenial: 3, basis: "72 hours for urgent cases", severity: "regulatory" },
  ],
  "medicaid-managed-care": [
    { label: "MCO appeal", daysFromDenial: 60, basis: "42 CFR 438.402 (state may shorten)", severity: "deadline" },
    { label: "State fair hearing request", daysFromDenial: 120, basis: "After MCO appeal decision", severity: "deadline" },
  ],
  "medicaid-fee-for-service": [
    { label: "State fair hearing", daysFromDenial: 90, basis: "Most state Medicaid plans", severity: "deadline" },
  ],
  "tricare": [
    { label: "Reconsideration request", daysFromDenial: 90, basis: "TRICARE Operations Manual Ch 12", severity: "deadline" },
    { label: "Formal review", daysFromDenial: 60, basis: "After reconsideration decision", severity: "info" },
  ],
};

// Clean-claim prompt-pay clocks — conservative ranges by state. Default 30 days where unknown.
const PROMPT_PAY_DAYS: Record<string, number> = {
  CA: 30, FL: 20, NY: 30, TX: 30, GA: 15, IL: 30, OH: 30, PA: 45,
  NJ: 30, NC: 30, MI: 45, WA: 30, MA: 30, AZ: 30, CO: 30, OR: 30,
  VA: 30, TN: 30, IN: 30, MO: 30, MD: 30, MN: 30, WI: 30, AL: 30,
  KY: 30, SC: 30, OK: 45, CT: 45, IA: 30,
};

export interface ClockEvent {
  label: string;
  dueDate: Date;
  daysRemaining: number;
  basis: string;
  severity: "info" | "deadline" | "regulatory" | "expired";
}

export function computeClocks(opts: {
  denialDate: Date;
  payerType: PayerType;
  state?: string;
  cleanClaimDate?: Date;
}): ClockEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const events: ClockEvent[] = [];
  for (const rule of COMMON_RULES[opts.payerType] ?? []) {
    const due = new Date(opts.denialDate);
    due.setDate(due.getDate() + rule.daysFromDenial);
    const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
    events.push({
      label: rule.label,
      dueDate: due,
      daysRemaining: days,
      basis: rule.basis,
      severity: days < 0 ? "expired" : rule.severity,
    });
  }

  if (opts.cleanClaimDate && opts.state) {
    const ppDays = PROMPT_PAY_DAYS[opts.state.toUpperCase()] ?? 30;
    const due = new Date(opts.cleanClaimDate);
    due.setDate(due.getDate() + ppDays);
    const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
    events.push({
      label: `${opts.state.toUpperCase()} prompt-pay clean-claim deadline (${ppDays}d)`,
      dueDate: due,
      daysRemaining: days,
      basis: "State insurance department prompt-pay rule",
      severity: days < 0 ? "regulatory" : "regulatory",
    });
  }

  return events.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export const PAYER_TYPES: { value: PayerType; label: string }[] = [
  { value: "commercial-fully-insured", label: "Commercial (fully-insured)" },
  { value: "self-funded-erisa", label: "Self-funded / ERISA" },
  { value: "medicare-advantage", label: "Medicare Advantage" },
  { value: "medicaid-managed-care", label: "Medicaid Managed Care" },
  { value: "medicaid-fee-for-service", label: "Medicaid (FFS)" },
  { value: "tricare", label: "TRICARE" },
];

export const STATES = ["CA","FL","NY","TX","GA","IL","OH","PA","NJ","NC","MI","WA","MA","AZ","CO","OR","VA","TN","IN","MO","MD","MN","WI","AL","KY","SC","OK","CT","IA"];