/**
 * Ops Center synthetic data + helpers.
 * All deterministic so demo screens render the same on every load.
 */

export type Rag = "red" | "amber" | "green";
export type Severity = "sev1" | "sev2" | "sev3" | "sev4";

export interface PayerScorecard {
  payer: string;
  denialRatePct: number;
  overturnRatePct: number;
  avgDaysToPay: number;
  contractDaysToPay: number;
  policyChurn30d: number;
  p2pResponseHrs: number;
  promptPayDefects: number;
  trend: "improving" | "stable" | "worsening";
  grade: "A" | "B" | "C" | "D" | "F";
}

export const PAYER_SCORECARDS: PayerScorecard[] = [
  { payer: "UnitedHealthcare", denialRatePct: 14.2, overturnRatePct: 62, avgDaysToPay: 38, contractDaysToPay: 30, policyChurn30d: 6, p2pResponseHrs: 71, promptPayDefects: 12, trend: "worsening", grade: "D" },
  { payer: "Aetna",            denialRatePct: 11.8, overturnRatePct: 58, avgDaysToPay: 32, contractDaysToPay: 30, policyChurn30d: 4, p2pResponseHrs: 48, promptPayDefects: 6,  trend: "stable",    grade: "C" },
  { payer: "Cigna",            denialRatePct: 9.4,  overturnRatePct: 71, avgDaysToPay: 27, contractDaysToPay: 30, policyChurn30d: 2, p2pResponseHrs: 36, promptPayDefects: 2,  trend: "improving", grade: "B" },
  { payer: "Anthem BCBS",      denialRatePct: 12.6, overturnRatePct: 55, avgDaysToPay: 35, contractDaysToPay: 30, policyChurn30d: 3, p2pResponseHrs: 52, promptPayDefects: 9,  trend: "stable",    grade: "C" },
  { payer: "Humana",           denialRatePct: 10.1, overturnRatePct: 64, avgDaysToPay: 29, contractDaysToPay: 30, policyChurn30d: 5, p2pResponseHrs: 44, promptPayDefects: 4,  trend: "stable",    grade: "B" },
  { payer: "BCBS Florida",     denialRatePct: 8.2,  overturnRatePct: 73, avgDaysToPay: 24, contractDaysToPay: 30, policyChurn30d: 1, p2pResponseHrs: 30, promptPayDefects: 1,  trend: "improving", grade: "A" },
  { payer: "Medicare Adv (Reg)", denialRatePct: 13.1, overturnRatePct: 60, avgDaysToPay: 33, contractDaysToPay: 30, policyChurn30d: 7, p2pResponseHrs: 60, promptPayDefects: 5, trend: "worsening", grade: "C" },
  { payer: "Medicaid MCO",     denialRatePct: 16.4, overturnRatePct: 51, avgDaysToPay: 41, contractDaysToPay: 45, policyChurn30d: 4, p2pResponseHrs: 86, promptPayDefects: 7,  trend: "stable",    grade: "D" },
];

export interface NocAlert {
  id: string;
  severity: Severity;
  payer: string;
  category: string;
  title: string;
  slaRemainingHrs: number; // negative = breached
  affectedClaims: number;
  dollarsAtRisk: number;
  opened: string; // ISO
}

export const NOC_ALERTS: NocAlert[] = [
  { id: "INC-2041", severity: "sev1", payer: "UnitedHealthcare", category: "Code line halt", title: "CARC-50 spike on 27447 — 18 denials in 6h", slaRemainingHrs: -3, affectedClaims: 18, dollarsAtRisk: 142000, opened: "2026-05-05T02:14:00Z" },
  { id: "INC-2042", severity: "sev2", payer: "Aetna",            category: "Auth posture shift", title: "PA now required on 64635 — 9 retro denials", slaRemainingHrs: 12, affectedClaims: 9,  dollarsAtRisk: 38000,  opened: "2026-05-05T01:02:00Z" },
  { id: "INC-2043", severity: "sev2", payer: "Anthem BCBS",      category: "Documentation gap", title: "Medical-necessity narrative missing — 11 denials", slaRemainingHrs: 22, affectedClaims: 11, dollarsAtRisk: 27500, opened: "2026-05-04T22:40:00Z" },
  { id: "INC-2044", severity: "sev3", payer: "Cigna",            category: "Bundling edit",     title: "NCCI edit on 99213+96372 — 4 denials",            slaRemainingHrs: 36, affectedClaims: 4,  dollarsAtRisk: 1200,  opened: "2026-05-04T18:20:00Z" },
  { id: "INC-2045", severity: "sev3", payer: "Humana",           category: "Timely filing risk", title: "12 claims approaching 90d window",                slaRemainingHrs: 18, affectedClaims: 12, dollarsAtRisk: 64000, opened: "2026-05-05T00:00:00Z" },
  { id: "INC-2046", severity: "sev4", payer: "BCBS Florida",     category: "Single denial",     title: "Coordination-of-benefits — 1 denial",             slaRemainingHrs: 60, affectedClaims: 1,  dollarsAtRisk: 480,   opened: "2026-05-04T16:10:00Z" },
];

export interface ServiceLineHealth {
  line: string;
  denialRatePct: number;
  arDays: number;
  appealWinPct: number;
  docDebtK: number;
  rag: Rag;
  trend: "up" | "flat" | "down";
}

export const SERVICE_LINES: ServiceLineHealth[] = [
  { line: "Orthopedics",       denialRatePct: 14.8, arDays: 52, appealWinPct: 58, docDebtK: 312, rag: "red",   trend: "up" },
  { line: "Cardiology",        denialRatePct: 9.2,  arDays: 41, appealWinPct: 71, docDebtK: 184, rag: "amber", trend: "flat" },
  { line: "Behavioral Health", denialRatePct: 12.4, arDays: 47, appealWinPct: 64, docDebtK: 96,  rag: "amber", trend: "down" },
  { line: "General Surgery",   denialRatePct: 7.1,  arDays: 36, appealWinPct: 76, docDebtK: 142, rag: "green", trend: "down" },
  { line: "Emergency Medicine",denialRatePct: 11.6, arDays: 44, appealWinPct: 62, docDebtK: 208, rag: "amber", trend: "flat" },
  { line: "Oncology",          denialRatePct: 8.4,  arDays: 39, appealWinPct: 79, docDebtK: 121, rag: "green", trend: "down" },
  { line: "Imaging / Rad",     denialRatePct: 13.2, arDays: 49, appealWinPct: 60, docDebtK: 167, rag: "red",   trend: "up" },
];

export interface MysteryShopperResult {
  payer: string;
  scenario: string;
  expectedOutcome: string;
  observedOutcome: string;
  drift: "none" | "minor" | "material";
  lastObserved: string;
}

export const MYSTERY_SHOPPER: MysteryShopperResult[] = [
  { payer: "UnitedHealthcare", scenario: "Clean 99213 + 90471, established pt", expectedOutcome: "Pay full, 14d", observedOutcome: "Pay full, 18d (+4d slip)",  drift: "minor",    lastObserved: "2026-05-04" },
  { payer: "UnitedHealthcare", scenario: "Inpt CHF DRG 291 w/ MCC",            expectedOutcome: "Pay DRG 291",   observedOutcome: "Downgrade DRG 293",          drift: "material", lastObserved: "2026-05-03" },
  { payer: "Aetna",            scenario: "Telehealth 99214 POS 10",            expectedOutcome: "Pay parity",    observedOutcome: "Pay parity",                  drift: "none",     lastObserved: "2026-05-04" },
  { payer: "Cigna",            scenario: "Outpt 64483 + 77003, lumbar ESI",    expectedOutcome: "Pay both",      observedOutcome: "Pay 64483, deny 77003",      drift: "material", lastObserved: "2026-05-02" },
  { payer: "Anthem BCBS",      scenario: "Screening colo G0121",                expectedOutcome: "Pay 100%",      observedOutcome: "Pay 100%",                    drift: "none",     lastObserved: "2026-05-04" },
  { payer: "Humana MA",        scenario: "Obs hour billing 99219 x36h",         expectedOutcome: "Pay obs",       observedOutcome: "Convert to inpt rule applied",drift: "material", lastObserved: "2026-05-03" },
];

export interface ShrinkageBucket {
  category: string;
  amount: number;
  pctOfTotal: number;
  preventable: boolean;
}

export const SHRINKAGE: ShrinkageBucket[] = [
  { category: "Underpayment vs contract", amount: 412000, pctOfTotal: 0, preventable: true  },
  { category: "Silent denials (zero-pay no CARC)", amount: 187000, pctOfTotal: 0, preventable: true },
  { category: "Documentation debt (DRG downshift)", amount: 268000, pctOfTotal: 0, preventable: true },
  { category: "Timely-filing miss",       amount:  74000, pctOfTotal: 0, preventable: true  },
  { category: "Appeal abandonment",       amount: 152000, pctOfTotal: 0, preventable: true  },
  { category: "Contract leakage (bundling)", amount: 96000, pctOfTotal: 0, preventable: true },
  { category: "Bad-debt write-off",       amount: 320000, pctOfTotal: 0, preventable: false },
];
(() => {
  const total = SHRINKAGE.reduce((s, b) => s + b.amount, 0);
  SHRINKAGE.forEach(b => { b.pctOfTotal = Math.round((b.amount / total) * 1000) / 10; });
})();

export interface Runbook {
  severity: Severity;
  trigger: string;
  pages: string[];           // who pages
  pulls: string[];           // what to pull
  template: string;          // appeal/template id
  slaHrs: number;
}

export const RUNBOOKS: Runbook[] = [
  { severity: "sev1", trigger: "≥10 same-CARC denials on one CPT in 24h, single payer", pages: ["RCM Director", "Service-line Chief", "Compliance"], pulls: ["Payer policy + version diff", "Last 30 successful claims for same CPT", "Contract section governing CPT"], template: "Mass-denial peer-to-peer + DOI prep", slaHrs: 4 },
  { severity: "sev2", trigger: "New PA requirement detected mid-cycle OR doc-gap pattern ≥5 claims", pages: ["RCM Lead", "CDI Lead"], pulls: ["Affected encounter list", "Templated narrative gap report"], template: "Standard appeal w/ narrative addendum", slaHrs: 12 },
  { severity: "sev3", trigger: "Bundling edit / single-payer pattern ≥3 claims OR timely-filing window <30d on ≥10 claims", pages: ["RCM Analyst"], pulls: ["NCCI edit reference", "Filing dates roster"], template: "Standard appeal letter", slaHrs: 24 },
  { severity: "sev4", trigger: "Single denial, no pattern", pages: ["Coder of record"], pulls: ["Encounter chart"], template: "Standard reconsideration", slaHrs: 72 },
];

export interface LostAppealRca {
  id: string;
  payer: string;
  cpt: string;
  denialReason: string;
  rootCause: string;
  contributingFactors: string[];
  preventionRule: string;
  lostAt: string;
  amount: number;
}

export const LOST_APPEAL_RCAS: LostAppealRca[] = [
  {
    id: "RCA-118", payer: "UnitedHealthcare", cpt: "27447", denialReason: "Not medically necessary",
    rootCause: "Conservative-care duration documented as 'several months' (non-quantified)",
    contributingFactors: ["No imaging report excerpt attached", "PT summary not included", "Peer-to-peer not requested within 5d"],
    preventionRule: "Pre-bill check: TKA submission must include quantified PT weeks ≥12 + imaging excerpt",
    lostAt: "2026-04-29", amount: 14200,
  },
  {
    id: "RCA-119", payer: "Aetna", cpt: "63685", denialReason: "Medical policy not met",
    rootCause: "Psych clearance present but not referenced in PA letter",
    contributingFactors: ["Letter relied on chart references rather than excerpts"],
    preventionRule: "SCS PA: extract psych-clearance excerpt verbatim into letter body",
    lostAt: "2026-04-22", amount: 9800,
  },
  {
    id: "RCA-120", payer: "Anthem BCBS", cpt: "70553", denialReason: "Conservative therapy not exhausted",
    rootCause: "PT documentation existed but was uploaded after determination",
    contributingFactors: ["Workflow gap: PT records lived in separate system"],
    preventionRule: "MRI PA: enforce PT-records attachment check before submission",
    lostAt: "2026-04-18", amount: 2200,
  },
];

export function gradeColor(g: PayerScorecard["grade"]) {
  if (g === "A") return "text-emerald-500 border-emerald-500/40 bg-emerald-500/10";
  if (g === "B") return "text-emerald-500 border-emerald-500/30 bg-emerald-500/5";
  if (g === "C") return "text-amber-500 border-amber-500/40 bg-amber-500/5";
  if (g === "D") return "text-orange-500 border-orange-500/40 bg-orange-500/10";
  return "text-red-500 border-red-500/50 bg-red-500/10";
}

export function ragClass(r: Rag) {
  if (r === "green") return "bg-emerald-500/15 text-emerald-500 border-emerald-500/40";
  if (r === "amber") return "bg-amber-500/15 text-amber-500 border-amber-500/40";
  return "bg-red-500/15 text-red-500 border-red-500/40";
}

export function severityClass(s: Severity) {
  if (s === "sev1") return "bg-red-500/20 text-red-500 border-red-500/50";
  if (s === "sev2") return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  if (s === "sev3") return "bg-amber-500/15 text-amber-500 border-amber-500/40";
  return "bg-muted text-muted-foreground border-border";
}

/* ───────────────────────── Vendor Watch ─────────────────────────
 * Adapted from retail vendor scorecards + IT/MSP procurement audits.
 * Catches price creep, shadow fees, contract drift, auto-renewal traps,
 * unearned rebates, and outright overbilling on RCM/clearinghouse/
 * coding/EHR/SaaS vendors.
 */

export type VendorRisk = "low" | "watch" | "high" | "critical";

/**
 * Stable vendor identifiers — used to join Contracts ↔ Anomalies ↔ Deals.
 * Display names can vary (long contract name vs. short brand) but vendorKey
 * is the single source of truth for cross-referencing.
 */
export type VendorKey =
  | "clearmd"
  | "coderight"
  | "revcycle"
  | "chartscribe"
  | "ehr-vendor"
  | "denial-boutique"
  | "transcription"
  | "multi-ancillary"
  | "cloud-edge";

export const VENDOR_DISPLAY: Record<VendorKey, string> = {
  "clearmd":         "ClearMD Clearinghouse",
  "coderight":       "CodeRight Coding",
  "revcycle":        "RevCycle Partners",
  "chartscribe":     "ChartScribe AI",
  "ehr-vendor":      "EHR Vendor",
  "denial-boutique": "Denial Mgmt Boutique",
  "transcription":   "Transcription Co.",
  "multi-ancillary": "Multi-vendor (Ancillary)",
  "cloud-edge":      "Cloud Compute (Edge AI)",
};

export interface VendorContract {
  vendorKey: VendorKey;
  vendor: string;
  category: string;            // e.g. Clearinghouse, Coding, RCM, EHR, SaaS
  spendAnnualK: number;        // $K/yr
  contractedRate: string;      // human-readable rate basis
  effectiveRate: string;       // what we are actually paying
  variancePct: number;         // negative = overbilled
  autoRenewDays: number;       // days until silent auto-renew window closes
  noticeRequiredDays: number;  // notice period to terminate
  risk: VendorRisk;
  flags: string[];             // specific findings
  estRecoveryK: number;        // $K recoverable if pursued
}

export const VENDOR_CONTRACTS: VendorContract[] = [
  {
    vendorKey: "clearmd",
    vendor: "ClearMD Clearinghouse", category: "Clearinghouse",
    spendAnnualK: 184, contractedRate: "$0.32 / claim",
    effectiveRate: "$0.41 / claim (+rejection re-fee)",
    variancePct: -28, autoRenewDays: 41, noticeRequiredDays: 90,
    risk: "critical",
    flags: [
      "Re-submission fee not in MSA — billed on every 277CA reject",
      "Tier-volume discount triggered Q3 but not applied",
      "Notice window (90d) exceeds auto-renew window (41d) — trap",
    ],
    estRecoveryK: 38,
  },
  {
    vendorKey: "coderight",
    vendor: "CodeRight Outsourced Coding", category: "Coding",
    spendAnnualK: 612, contractedRate: "$2.10 / chart, SLA 24h",
    effectiveRate: "$2.31 / chart, SLA 31h actual",
    variancePct: -10, autoRenewDays: 88, noticeRequiredDays: 60,
    risk: "high",
    flags: [
      "10% above contracted unit rate — invoice line 'complexity adj' undefined in SOW",
      "SLA missed 4 of last 6 months — credits owed not issued",
      "DRG accuracy below 95% threshold — not measured by vendor",
    ],
    estRecoveryK: 62,
  },
  {
    vendorKey: "revcycle",
    vendor: "RevCycle Partners (extended BO)", category: "RCM",
    spendAnnualK: 940, contractedRate: "4.5% net collections",
    effectiveRate: "4.5% gross collections",
    variancePct: -7, autoRenewDays: 122, noticeRequiredDays: 120,
    risk: "high",
    flags: [
      "Billing on gross instead of net — refunds/take-backs not deducted",
      "Charging on payer credits applied to OTHER claims",
      "Shadow 'lockbox handling' fee — not in pricing exhibit",
    ],
    estRecoveryK: 71,
  },
  {
    vendorKey: "chartscribe",
    vendor: "ChartScribe AI Documentation", category: "SaaS",
    spendAnnualK: 96, contractedRate: "$1,200 / provider / yr",
    effectiveRate: "$1,380 / provider / yr (auto CPI)",
    variancePct: -15, autoRenewDays: 19, noticeRequiredDays: 30,
    risk: "critical",
    flags: [
      "CPI escalator silently applied above MSA cap of 5%",
      "Renewal window closes in 19d but notice requires 30d — locks in auto-renew",
      "Inactive seats not credited (37 of 80 seats unused last 60d)",
    ],
    estRecoveryK: 22,
  },
  {
    vendorKey: "ehr-vendor",
    vendor: "EHR Vendor — Add-on Modules", category: "EHR",
    spendAnnualK: 1480, contractedRate: "Bundled enterprise license",
    effectiveRate: "Bundle + per-API-call overages",
    variancePct: -4, autoRenewDays: 210, noticeRequiredDays: 180,
    risk: "watch",
    flags: [
      "FHIR API overages billed despite enterprise bundle",
      "Sandbox env counted toward production seat limit",
    ],
    estRecoveryK: 28,
  },
  {
    vendorKey: "denial-boutique",
    vendor: "Denial Mgmt Boutique", category: "Appeals",
    spendAnnualK: 220, contractedRate: "20% of overturn $",
    effectiveRate: "20% of overturn + 'research' hourly",
    variancePct: -12, autoRenewDays: 64, noticeRequiredDays: 45,
    risk: "high",
    flags: [
      "Hourly research fee billed on cases that auto-overturn",
      "Charging on appeals we filed internally and assigned for tracking only",
    ],
    estRecoveryK: 18,
  },
  {
    vendorKey: "transcription",
    vendor: "Transcription Co.", category: "Ancillary",
    spendAnnualK: 74, contractedRate: "$0.09 / line",
    effectiveRate: "$0.09 / line",
    variancePct: 0, autoRenewDays: 175, noticeRequiredDays: 60,
    risk: "low",
    flags: ["Clean — last audit Q4 2025"],
    estRecoveryK: 0,
  },
];

export interface VendorAnomaly {
  id: string;
  vendorKey: VendorKey;
  vendor: string;
  detected: string;       // ISO date
  pattern: string;        // what was observed
  signal: "price-creep" | "shadow-fee" | "rebate-miss" | "sla-credit-miss" | "duplicate" | "scope-creep" | "auto-renew-trap";
  amountK: number;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

export const VENDOR_ANOMALIES: VendorAnomaly[] = [
  { id: "VA-401", vendorKey: "clearmd",         vendor: "ClearMD Clearinghouse", detected: "2026-05-04", pattern: "Per-claim rate drifted from $0.32 → $0.39 over 6 invoices without amendment", signal: "price-creep",     amountK: 11, confidence: "high",   evidence: "Invoices #4471–4476 vs MSA §3.1 pricing exhibit" },
  { id: "VA-402", vendorKey: "clearmd",         vendor: "ClearMD Clearinghouse", detected: "2026-05-03", pattern: "Re-submission fee billed on payer-side 277CA rejects", signal: "shadow-fee",      amountK:  9, confidence: "high",   evidence: "Invoice line 'RSF' not present in MSA fee schedule" },
  { id: "VA-403", vendorKey: "coderight",       vendor: "CodeRight Coding",       detected: "2026-05-02", pattern: "Volume tier 3 (>15K charts/mo) hit Q3, 8% rebate not credited", signal: "rebate-miss",     amountK: 41, confidence: "high",   evidence: "Volume report Q3 + MSA exhibit B" },
  { id: "VA-404", vendorKey: "coderight",       vendor: "CodeRight Coding",       detected: "2026-05-01", pattern: "SLA missed (31h vs 24h) for 4 months — 5% credit/mo not issued", signal: "sla-credit-miss", amountK: 24, confidence: "high",   evidence: "Vendor's own monthly SLA reports" },
  { id: "VA-405", vendorKey: "revcycle",        vendor: "RevCycle Partners",      detected: "2026-04-30", pattern: "Commission charged on gross including refunded $/take-backs",   signal: "scope-creep",     amountK: 52, confidence: "high",   evidence: "Remit-vs-commission reconciliation, Mar–Apr" },
  { id: "VA-406", vendorKey: "revcycle",        vendor: "RevCycle Partners",      detected: "2026-04-29", pattern: "Same encounter commissioned twice (re-billed after correction)", signal: "duplicate",       amountK:  7, confidence: "medium", evidence: "Encounters E-22817, E-22833 — two commission lines" },
  { id: "VA-407", vendorKey: "chartscribe",     vendor: "ChartScribe AI",         detected: "2026-04-28", pattern: "CPI uplift +9% applied; MSA caps at +5%",                       signal: "price-creep",     amountK:  6, confidence: "high",   evidence: "Renewal quote vs MSA §4.3" },
  { id: "VA-408", vendorKey: "chartscribe",     vendor: "ChartScribe AI",         detected: "2026-04-28", pattern: "Notice (30d) > auto-renew window (19d remaining) — trap",      signal: "auto-renew-trap", amountK: 16, confidence: "high",   evidence: "Calendar math, executed MSA dates" },
  { id: "VA-409", vendorKey: "ehr-vendor",      vendor: "EHR Vendor",             detected: "2026-04-26", pattern: "FHIR API overages billed despite enterprise-bundle clause",    signal: "shadow-fee",      amountK: 14, confidence: "medium", evidence: "Enterprise bundle §2.7 vs invoice 'API meter'" },
  { id: "VA-410", vendorKey: "denial-boutique", vendor: "Denial Mgmt Boutique",   detected: "2026-04-25", pattern: "'Research' hours billed on auto-overturn cases (no work product)", signal: "scope-creep",     amountK:  8, confidence: "medium", evidence: "Vendor work-product log shows zero deliverables on flagged cases" },
];

export interface VendorPlay {
  title: string;
  appliesTo: VendorAnomaly["signal"][];
  steps: string[];
  leverage: string;
}

export const VENDOR_PLAYS: VendorPlay[] = [
  {
    title: "Recover overbilling — formal notice + offset",
    appliesTo: ["price-creep", "shadow-fee", "duplicate"],
    steps: [
      "Pull executed MSA + active pricing exhibit (versioned).",
      "Compute variance: invoiced − contracted × volume, by month.",
      "Send dispute letter citing specific MSA section and dollar exposure.",
      "Withhold disputed amount from next remit; request signed credit memo.",
    ],
    leverage: "Most vendor MSAs allow good-faith dispute withholding for 30–60 days without breach.",
  },
  {
    title: "Trigger SLA credits owed",
    appliesTo: ["sla-credit-miss"],
    steps: [
      "Use vendor's OWN monthly SLA report as evidence.",
      "Apply credit formula from MSA exhibit (typically 5–10% per missed metric).",
      "Demand back-credits for full lookback period (often 12mo).",
    ],
    leverage: "Vendors rarely self-issue credits; written demand backed by their own report = high success.",
  },
  {
    title: "Claim earned rebate / volume discount",
    appliesTo: ["rebate-miss"],
    steps: [
      "Pull volume report; confirm tier crossed and date.",
      "Re-invoice retroactively from tier-crossing date per MSA exhibit B.",
      "Add to next QBR agenda for repeat enforcement.",
    ],
    leverage: "Volume rebates are objective math — vendor cannot dispute if MSA language is clean.",
  },
  {
    title: "Break the auto-renew trap",
    appliesTo: ["auto-renew-trap"],
    steps: [
      "Send conditional non-renewal notice TODAY (preserve optionality).",
      "Open re-negotiation in parallel with notice on file.",
      "Demand notice window be aligned to renewal window in next amendment.",
    ],
    leverage: "Notice on file forces vendor to compete or concede; can be withdrawn if terms improve.",
  },
  {
    title: "Right-size scope creep",
    appliesTo: ["scope-creep"],
    steps: [
      "Define commissionable base in writing (net cash, post-take-back).",
      "Demand monthly reconciliation report from vendor.",
      "Cap out-of-scope work product at named SOW deliverables only.",
    ],
    leverage: "Scope creep is the single biggest vendor leak — once defined in writing, it stops.",
  },
];

export interface VendorMarketBenchmark {
  category: string;
  metric: string;
  marketP25: string;
  marketMedian: string;
  marketP75: string;
  ourPosition: "above market" | "at market" | "below market";
  note: string;
}

export const VENDOR_BENCHMARKS: VendorMarketBenchmark[] = [
  { category: "Clearinghouse", metric: "Per-claim",          marketP25: "$0.18", marketMedian: "$0.27", marketP75: "$0.34", ourPosition: "above market", note: "Renegotiate at next renewal — 2 quotes in hand from comparable peers." },
  { category: "Coding",        metric: "Per-chart (E/M)",    marketP25: "$1.65", marketMedian: "$1.95", marketP75: "$2.25", ourPosition: "above market", note: "Tier discount + SLA credits will close the gap; deeper cut needs RFP." },
  { category: "RCM (extended)",metric: "% net collections",  marketP25: "3.5%",  marketMedian: "4.2%",  marketP75: "5.0%",  ourPosition: "at market",    note: "Rate is fair — fight is the gross-vs-net basis, not the rate." },
  { category: "Doc AI SaaS",   metric: "Per-provider/yr",    marketP25: "$960",  marketMedian: "$1,200",marketP75: "$1,500",ourPosition: "above market", note: "Inactive-seat true-up + CPI cap should pull us to median." },
  { category: "Appeals firm",  metric: "% of overturn $",    marketP25: "15%",   marketMedian: "20%",   marketP75: "25%",   ourPosition: "at market",    note: "Contingency rate fair; eliminate hourly add-on." },
];

/* ───────── Deals — negotiation & savings opportunities ───────── */

export type DealType =
  | "rfp-leverage"        // competing quote in hand
  | "consolidation"       // collapse multiple vendors
  | "bundle-unbundle"     // unbundle SaaS suite or bundle to discount
  | "term-extension"      // longer commit for lower rate
  | "rate-reset"          // benchmark-driven rate cut
  | "early-renewal"       // renew now to lock pre-CPI
  | "alt-vendor"          // switch vendor entirely
  | "vol-commit";         // commit volume for tiered discount

export interface VendorDeal {
  id: string;
  vendorKey: VendorKey;
  vendor: string;
  category: string;
  type: DealType;
  thesis: string;             // one-liner
  estAnnualSavingsK: number;
  oneTimeSavingsK: number;
  effortDays: number;
  confidence: "high" | "medium" | "low";
  triggerWindowDays: number;  // when leverage is best
  evidence: string;
  nextStep: string;
}

export const VENDOR_DEALS: VendorDeal[] = [
  {
    id: "DEAL-501", vendorKey: "clearmd", vendor: "ClearMD Clearinghouse", category: "Clearinghouse",
    type: "rfp-leverage",
    thesis: "Two peer quotes at $0.24/$0.26 per claim vs our $0.32 contracted / $0.41 effective.",
    estAnnualSavingsK: 52, oneTimeSavingsK: 38, effortDays: 14, confidence: "high", triggerWindowDays: 41,
    evidence: "Quote pack from Availity + Waystar (2026 Q1)",
    nextStep: "Issue RFP letter; CC current vendor with 60d non-renewal placeholder.",
  },
  {
    id: "DEAL-502", vendorKey: "coderight", vendor: "CodeRight Coding", category: "Coding",
    type: "vol-commit",
    thesis: "Q3 hit Tier 3 (>15K charts/mo). Lock 18mo commit at Tier 3 rate (-12%) + monthly SLA reconciliation.",
    estAnnualSavingsK: 73, oneTimeSavingsK: 41, effortDays: 10, confidence: "high", triggerWindowDays: 88,
    evidence: "MSA exhibit B tier table; Q3 volume report",
    nextStep: "Counter-offer: 18mo @ Tier 3 with auto-step at Tier 4 trigger.",
  },
  {
    id: "DEAL-503", vendorKey: "revcycle", vendor: "RevCycle Partners", category: "RCM",
    type: "rate-reset",
    thesis: "Market median is 4.2% NET; we pay 4.5% on GROSS (effective ~4.8% net).",
    estAnnualSavingsK: 48, oneTimeSavingsK: 71, effortDays: 30, confidence: "medium", triggerWindowDays: 122,
    evidence: "Benchmark median + remit reconciliation",
    nextStep: "Re-paper to 4.2% NET with explicit refund/take-back offset.",
  },
  {
    id: "DEAL-504", vendorKey: "chartscribe", vendor: "ChartScribe AI", category: "SaaS",
    type: "early-renewal",
    thesis: "Renew NOW pre-CPI; trade 2yr commit for cap on uplift + inactive-seat true-up.",
    estAnnualSavingsK: 18, oneTimeSavingsK: 22, effortDays: 5, confidence: "high", triggerWindowDays: 19,
    evidence: "MSA §4.3 CPI clause + seat utilization report",
    nextStep: "Send conditional 30d non-renewal to preserve optionality.",
  },
  {
    id: "DEAL-505", vendorKey: "chartscribe", vendor: "ChartScribe AI", category: "SaaS",
    type: "consolidation",
    thesis: "Replace with EHR-bundled ambient module already paid for in enterprise license.",
    estAnnualSavingsK: 96, oneTimeSavingsK: 0, effortDays: 60, confidence: "medium", triggerWindowDays: 19,
    evidence: "EHR enterprise bundle §2.7 covers ambient AI",
    nextStep: "Pilot EHR module with 10 providers; sunset ChartScribe at renewal.",
  },
  {
    id: "DEAL-506", vendorKey: "ehr-vendor", vendor: "EHR Vendor", category: "EHR",
    type: "bundle-unbundle",
    thesis: "Drop unused add-on modules (3 of 11), redirect spend to FHIR overage cap amendment.",
    estAnnualSavingsK: 184, oneTimeSavingsK: 14, effortDays: 45, confidence: "medium", triggerWindowDays: 210,
    evidence: "Module utilization report; overage invoices",
    nextStep: "Build module-by-module use case before next mid-year true-up.",
  },
  {
    id: "DEAL-507", vendorKey: "denial-boutique", vendor: "Denial Mgmt Boutique", category: "Appeals",
    type: "alt-vendor",
    thesis: "Switch to flat 18% contingency vendor with no hourly add-on; same overturn rate.",
    estAnnualSavingsK: 26, oneTimeSavingsK: 18, effortDays: 21, confidence: "medium", triggerWindowDays: 64,
    evidence: "Reference checks: 3 peer systems, 18 mo data",
    nextStep: "Run 60d parallel on 50 cases; compare overturn $ net of fees.",
  },
  {
    id: "DEAL-508", vendorKey: "multi-ancillary", vendor: "Multi-vendor (3)", category: "Ancillary",
    type: "consolidation",
    thesis: "Three transcription/translation/captioning vendors → one bundled MSA.",
    estAnnualSavingsK: 31, oneTimeSavingsK: 0, effortDays: 30, confidence: "medium", triggerWindowDays: 90,
    evidence: "Combined spend $148K/yr across 3 MSAs",
    nextStep: "RFP single MSA with carve-outs by service line.",
  },
  {
    id: "DEAL-509", vendorKey: "cloud-edge", vendor: "Cloud Compute (Edge AI)", category: "Infra",
    type: "term-extension",
    thesis: "3yr reserved-instance commit on baseline workload; on-demand for burst.",
    estAnnualSavingsK: 42, oneTimeSavingsK: 0, effortDays: 7, confidence: "high", triggerWindowDays: 365,
    evidence: "12mo utilization shows 70% baseline / 30% burst",
    nextStep: "Approve RI purchase via finance; document burst-budget guardrail.",
  },
];

export function dealTypeLabel(t: DealType) {
  return ({
    "rfp-leverage": "RFP leverage",
    "consolidation": "Consolidation",
    "bundle-unbundle": "Un/bundle",
    "term-extension": "Term extension",
    "rate-reset": "Rate reset",
    "early-renewal": "Early renewal",
    "alt-vendor": "Alt vendor",
    "vol-commit": "Volume commit",
  } as const)[t];
}

export function vendorRiskClass(r: VendorRisk) {
  if (r === "critical") return "bg-red-500/15 text-red-500 border-red-500/50";
  if (r === "high")     return "bg-orange-500/15 text-orange-500 border-orange-500/40";
  if (r === "watch")    return "bg-amber-500/15 text-amber-500 border-amber-500/40";
  return "bg-emerald-500/15 text-emerald-500 border-emerald-500/40";
}

export function vendorSignalLabel(s: VendorAnomaly["signal"]) {
  return ({
    "price-creep": "Price creep",
    "shadow-fee": "Shadow fee",
    "rebate-miss": "Unearned rebate",
    "sla-credit-miss": "SLA credit owed",
    "duplicate": "Duplicate billing",
    "scope-creep": "Scope creep",
    "auto-renew-trap": "Auto-renew trap",
  } as const)[s];
}

/** Deterministic weekly brief generator from current data. */
export function generateWeeklyBrief(): {
  whatChanged: string[];
  whatWeDid: string[];
  whatWeRecommend: string[];
  metrics: { label: string; value: string; delta?: string }[];
} {
  const worsening = PAYER_SCORECARDS.filter(p => p.trend === "worsening").map(p => p.payer);
  const sev1 = NOC_ALERTS.filter(a => a.severity === "sev1");
  const redLines = SERVICE_LINES.filter(l => l.rag === "red").map(l => l.line);
  const totalShrink = SHRINKAGE.reduce((s, b) => s + b.amount, 0);
  const preventable = SHRINKAGE.filter(b => b.preventable).reduce((s, b) => s + b.amount, 0);

  return {
    whatChanged: [
      `${worsening.length} payer(s) trending worse: ${worsening.join(", ") || "none"}.`,
      `${sev1.length} Sev1 incident(s) opened in the last 24h.`,
      `${MYSTERY_SHOPPER.filter(m => m.drift === "material").length} mystery-shopper scenarios detected material drift.`,
      `${redLines.length} service line(s) flipped to RED: ${redLines.join(", ") || "none"}.`,
    ],
    whatWeDid: [
      `Routed ${NOC_ALERTS.length} active incident(s) per Sev runbook.`,
      `Filed ${LOST_APPEAL_RCAS.length} blameless RCAs into the prevention library.`,
      `Generated draft DOI complaint for prompt-pay defects (UHC).`,
    ],
    whatWeRecommend: [
      `Open QBR with ${worsening[0] || "top-grade-D payer"} citing days-to-pay and overturn rate.`,
      `Promote ${LOST_APPEAL_RCAS[0].preventionRule} to mandatory pre-bill check.`,
      `Re-baseline contract for ${redLines[0] || "top-RED service line"} ahead of next renewal cycle.`,
    ],
    metrics: [
      { label: "Total revenue shrinkage (12mo)", value: `$${(totalShrink / 1000).toFixed(0)}K` },
      { label: "Preventable share", value: `${Math.round((preventable / totalShrink) * 100)}%` },
      { label: "Active Sev1/Sev2", value: `${NOC_ALERTS.filter(a => a.severity === "sev1" || a.severity === "sev2").length}` },
      { label: "Avg overturn rate", value: `${Math.round(PAYER_SCORECARDS.reduce((s, p) => s + p.overturnRatePct, 0) / PAYER_SCORECARDS.length)}%` },
    ],
  };
}