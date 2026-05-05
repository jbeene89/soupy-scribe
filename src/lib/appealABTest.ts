/**
 * Appeal letter A/B testing.
 *
 * Tracks variants of appeal letters per (payer, denial-reason) combo and
 * records overturn outcomes. Surfaces which variant wins for which combo.
 * Demo dataset is generated deterministically so the UI works without
 * pilot data.
 */

export interface AppealVariant {
  id: string;
  name: string;            // "Clinical-heavy", "Policy-citation-first", "Concise-3-paragraph"
  payer: string;
  reasonCode: string;
  attempts: number;
  overturned: number;
  partial: number;
  upheld: number;
  avgDaysToDecision: number;
}

export interface VariantWinner {
  payer: string;
  reasonCode: string;
  bestVariant: AppealVariant;
  liftOverWorst: number; // percentage points
  confidence: "low" | "moderate" | "high";
}

const VARIANT_TEMPLATES = [
  "Clinical-heavy (op note + nexus letter first)",
  "Policy-citation-first (payer policy + NCD/LCD)",
  "Concise 3-paragraph (rebut + cite + request)",
  "Peer-to-peer transcript embedded",
];

export function generateDemoAppealData(): AppealVariant[] {
  const payers = ["Aetna", "UHC", "BCBS-IL", "Cigna", "Humana"];
  const reasons = ["50", "197", "B7", "16", "11"];
  const variants: AppealVariant[] = [];
  let id = 0;
  for (const p of payers) {
    for (const r of reasons) {
      for (let v = 0; v < VARIANT_TEMPLATES.length; v++) {
        const attempts = 18 + ((id * 7) % 22);
        // Deterministic but varied overturn rates
        const baseRate = ((id * 13) % 45) + 18;
        const variantBoost = v === 1 && r === "50" ? 22 : v === 0 && r === "197" ? 15 : v === 2 ? 6 : 0;
        const rate = Math.min(82, baseRate + variantBoost);
        const overturned = Math.floor((attempts * rate) / 100);
        const partial = Math.floor(attempts * 0.12);
        const upheld = attempts - overturned - partial;
        variants.push({
          id: `v-${id++}`,
          name: VARIANT_TEMPLATES[v],
          payer: p,
          reasonCode: r,
          attempts,
          overturned,
          partial,
          upheld,
          avgDaysToDecision: 14 + ((id * 3) % 18),
        });
      }
    }
  }
  return variants;
}

export function computeWinners(variants: AppealVariant[]): VariantWinner[] {
  const groups = new Map<string, AppealVariant[]>();
  for (const v of variants) {
    const key = `${v.payer}|${v.reasonCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(v);
  }

  const winners: VariantWinner[] = [];
  for (const [key, list] of groups.entries()) {
    if (list.length < 2) continue;
    const ranked = list
      .map(v => ({ v, rate: (v.overturned / Math.max(1, v.attempts)) * 100 }))
      .sort((a, b) => b.rate - a.rate);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const lift = Math.round(best.rate - worst.rate);
    const totalAttempts = list.reduce((a, v) => a + v.attempts, 0);
    const confidence: VariantWinner["confidence"] =
      totalAttempts >= 200 ? "high" : totalAttempts >= 80 ? "moderate" : "low";
    const [payer, reasonCode] = key.split("|");
    winners.push({ payer, reasonCode, bestVariant: best.v, liftOverWorst: lift, confidence });
  }
  return winners.sort((a, b) => b.liftOverWorst - a.liftOverWorst);
}