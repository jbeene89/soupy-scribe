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