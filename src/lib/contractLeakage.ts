/**
 * Contract leakage detector.
 *
 * Compares paid amounts on parsed 835 service lines against an expected
 * fee schedule (CPT -> allowed amount) and flags underpayments. Also
 * surfaces "silent" denials embedded in CAS adjustments where the payer
 * reduced payment without an explicit denial letter.
 */

import type { X12IngestResult, X12Claim } from "./x12Ingest";

export interface FeeScheduleEntry {
  code: string;
  expectedAllowed: number;
}

export interface LeakageFinding {
  claimId: string;
  patient: string;
  code: string;
  modifier?: string;
  charged: number;
  paid: number;
  expected: number;
  underpayment: number;
  underpaymentPct: number;
  adjustments: string[];
  severity: "low" | "medium" | "high";
}

export interface LeakageReport {
  totalClaimsScanned: number;
  totalLinesScanned: number;
  totalUnderpayment: number;
  totalExpected: number;
  totalPaid: number;
  leakageRatePct: number;
  findings: LeakageFinding[];
  byCode: Array<{ code: string; lines: number; underpayment: number }>;
}

export function defaultFeeSchedule(): FeeScheduleEntry[] {
  // Conservative CMS-anchored reference rates (2024 national average, illustrative).
  // Real deployments load the provider's own contracted fee schedule.
  return [
    { code: "99284", expectedAllowed: 220 },
    { code: "99285", expectedAllowed: 350 },
    { code: "99213", expectedAllowed: 92 },
    { code: "99214", expectedAllowed: 131 },
    { code: "27447", expectedAllowed: 1450 },   // total knee
    { code: "27130", expectedAllowed: 1390 },   // total hip
    { code: "63030", expectedAllowed: 980 },    // lumbar discectomy
    { code: "29881", expectedAllowed: 580 },    // knee scope w meniscectomy
    { code: "71046", expectedAllowed: 56 },     // chest x-ray 2 view
    { code: "73721", expectedAllowed: 280 },    // MRI lower extremity
    { code: "70553", expectedAllowed: 410 },    // MRI brain
    { code: "45378", expectedAllowed: 380 },    // diagnostic colonoscopy
    { code: "43239", expectedAllowed: 290 },    // EGD with biopsy
    { code: "90837", expectedAllowed: 162 },    // psychotherapy 60 min
    { code: "90834", expectedAllowed: 122 },    // psychotherapy 45 min
  ];
}

export function detectLeakage(parsed: X12IngestResult, schedule: FeeScheduleEntry[]): LeakageReport {
  const map = new Map(schedule.map(e => [e.code, e.expectedAllowed]));
  const findings: LeakageFinding[] = [];
  const byCodeMap = new Map<string, { lines: number; underpayment: number }>();
  let totalLines = 0;
  let totalExpected = 0;
  let totalPaid = 0;

  for (const claim of parsed.claims) {
    for (const line of claim.serviceLines) {
      totalLines++;
      const expected = map.get(line.code);
      const paid = parseFloat(line.paid ?? "0") || 0;
      const charged = parseFloat(line.charge ?? "0") || 0;
      if (expected === undefined) continue; // unknown code, skip

      totalExpected += expected;
      totalPaid += paid;

      const underpayment = Math.max(0, expected - paid);
      const pct = expected > 0 ? (underpayment / expected) * 100 : 0;
      if (underpayment < 1) continue;

      const severity: LeakageFinding["severity"] =
        pct >= 25 ? "high" : pct >= 10 ? "medium" : "low";

      findings.push({
        claimId: claim.claimId,
        patient: claim.patient.name || "—",
        code: line.code,
        modifier: line.modifier,
        charged,
        paid,
        expected,
        underpayment,
        underpaymentPct: Math.round(pct * 10) / 10,
        adjustments: line.adjustments,
        severity,
      });

      const acc = byCodeMap.get(line.code) ?? { lines: 0, underpayment: 0 };
      acc.lines++;
      acc.underpayment += underpayment;
      byCodeMap.set(line.code, acc);
    }
  }

  const totalUnderpayment = findings.reduce((a, f) => a + f.underpayment, 0);
  const leakageRatePct = totalExpected > 0 ? (totalUnderpayment / totalExpected) * 100 : 0;

  return {
    totalClaimsScanned: parsed.claims.length,
    totalLinesScanned: totalLines,
    totalUnderpayment,
    totalExpected,
    totalPaid,
    leakageRatePct: Math.round(leakageRatePct * 10) / 10,
    findings: findings.sort((a, b) => b.underpayment - a.underpayment),
    byCode: Array.from(byCodeMap.entries())
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.underpayment - a.underpayment),
  };
}