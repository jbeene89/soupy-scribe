/**
 * Documentation debt scoring per physician.
 *
 * Aggregates counterfactual coding misses over time per physician and
 * produces a cumulative "dollars left on the table" metric. Pairs with
 * the Counterfactual Coding tool for individual-case analysis.
 */

export interface PhysicianDebtRecord {
  physicianId: string;
  physicianName: string;
  specialty: string;
  monthlyCases: number;
  topMissedCategories: string[];
  cumulativeDebt: number;        // 12-month rolling
  monthlyTrend: { month: string; debt: number }[];
  cmiOpportunity: number;
  trend: "improving" | "stable" | "worsening";
}

const SPECIALTIES_AND_MISSES: Array<{ specialty: string; misses: string[]; baseDebt: number }> = [
  { specialty: "Hospitalist", misses: ["sepsis specificity", "AKI staging", "acute respiratory failure"], baseDebt: 28000 },
  { specialty: "Cardiology", misses: ["acute on chronic HF", "CKD staging", "arrhythmia specificity"], baseDebt: 22000 },
  { specialty: "Orthopedic Surgery", misses: ["laterality", "modifier -25", "morbid obesity"], baseDebt: 14000 },
  { specialty: "Neurosurgery", misses: ["conservative therapy timeline", "imaging correlation", "neurological deficits"], baseDebt: 18000 },
  { specialty: "Emergency Medicine", misses: ["sepsis criteria", "modifier -25", "critical care time"], baseDebt: 16000 },
  { specialty: "Internal Medicine", misses: ["malnutrition severity", "BMI documentation", "diabetic complications"], baseDebt: 11000 },
];

const FIRST_NAMES = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H.", "J.", "K.", "L.", "M."];
const LAST_NAMES = ["Patel", "Chen", "Rodriguez", "Williams", "Johnson", "Smith", "Lee", "Brown", "Davis", "Garcia", "Wilson", "Anderson"];

export function generateDemoPhysicianDebt(): PhysicianDebtRecord[] {
  const records: PhysicianDebtRecord[] = [];
  for (let i = 0; i < 18; i++) {
    const spec = SPECIALTIES_AND_MISSES[i % SPECIALTIES_AND_MISSES.length];
    const monthlyCases = 20 + ((i * 7) % 80);
    const variance = ((i * 13) % 30) / 100; // -0.0 to 0.3
    const debt = Math.round(spec.baseDebt * (1 + variance));
    const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"];
    const monthlyTrend = months.map((m, idx) => {
      // Trend signal
      const trendFactor = i % 3 === 0 ? (12 - idx) / 12 : i % 3 === 1 ? idx / 12 : 0.5 + Math.sin(idx) * 0.1;
      return { month: m, debt: Math.round((debt / 12) * (0.7 + trendFactor * 0.6)) };
    });
    const trend: PhysicianDebtRecord["trend"] =
      i % 3 === 0 ? "improving" : i % 3 === 1 ? "worsening" : "stable";
    records.push({
      physicianId: `phys-${i + 1000}`,
      physicianName: `Dr. ${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[i % LAST_NAMES.length]}`,
      specialty: spec.specialty,
      monthlyCases,
      topMissedCategories: spec.misses,
      cumulativeDebt: debt,
      monthlyTrend,
      cmiOpportunity: Math.round((debt / 8000) * 10) / 100,
      trend,
    });
  }
  return records.sort((a, b) => b.cumulativeDebt - a.cumulativeDebt);
}

export interface DebtSummary {
  totalDebt: number;
  totalPhysicians: number;
  averageDebtPerPhysician: number;
  worsening: number;
  improving: number;
  bySpecialty: Array<{ specialty: string; debt: number; physicianCount: number }>;
}

export function summarizeDebt(records: PhysicianDebtRecord[]): DebtSummary {
  const totalDebt = records.reduce((a, r) => a + r.cumulativeDebt, 0);
  const bySpecMap = new Map<string, { debt: number; physicianCount: number }>();
  for (const r of records) {
    const acc = bySpecMap.get(r.specialty) ?? { debt: 0, physicianCount: 0 };
    acc.debt += r.cumulativeDebt;
    acc.physicianCount += 1;
    bySpecMap.set(r.specialty, acc);
  }
  return {
    totalDebt,
    totalPhysicians: records.length,
    averageDebtPerPhysician: Math.round(totalDebt / Math.max(1, records.length)),
    worsening: records.filter(r => r.trend === "worsening").length,
    improving: records.filter(r => r.trend === "improving").length,
    bySpecialty: Array.from(bySpecMap.entries())
      .map(([specialty, v]) => ({ specialty, ...v }))
      .sort((a, b) => b.debt - a.debt),
  };
}