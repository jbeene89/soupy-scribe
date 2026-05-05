/**
 * Denial drift + reviewer fingerprint analysis.
 *
 * Operates on a list of denial events (synthesizable for demo, real in
 * pilot data). Surfaces:
 *   - Reason-code drift: which CARC/RARC codes are accelerating per payer
 *   - Reviewer fingerprints: clusters of denials with similar boilerplate,
 *     suggesting the same reviewer or template.
 */

export interface DenialEvent {
  date: string;        // ISO
  payer: string;
  cpt: string;
  reasonCode: string;  // CARC e.g. "50" "197" "B7"
  reviewerHint?: string; // letter signature, NPI, or "—"
  letterFingerprint?: string; // short hash of normalized boilerplate
}

export interface DriftPoint {
  weekStart: string;
  count: number;
}

export interface DriftSeries {
  payer: string;
  reasonCode: string;
  cpt?: string;
  weekly: DriftPoint[];
  totalLast30: number;
  totalPrev30: number;
  changePct: number;
  trend: "accelerating" | "stable" | "declining";
}

export interface ReviewerCluster {
  fingerprint: string;
  reviewerHint: string;
  payer: string;
  count: number;
  topReasonCodes: { code: string; count: number }[];
  overturnRateEstimate: number; // illustrative: derived from cluster size + reason mix
}

function isoWeekStart(d: Date): string {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export function computeDrift(events: DenialEvent[]): DriftSeries[] {
  const groups = new Map<string, DenialEvent[]>();
  for (const e of events) {
    const key = `${e.payer}|${e.reasonCode}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  const today = Date.now();
  const D30 = 30 * 86_400_000;
  const series: DriftSeries[] = [];

  for (const [key, list] of groups.entries()) {
    const [payer, reasonCode] = key.split("|");
    const weekly = new Map<string, number>();
    let last30 = 0, prev30 = 0;
    for (const ev of list) {
      const t = Date.parse(ev.date);
      if (Number.isNaN(t)) continue;
      const w = isoWeekStart(new Date(t));
      weekly.set(w, (weekly.get(w) ?? 0) + 1);
      if (today - t <= D30) last30++;
      else if (today - t <= 2 * D30) prev30++;
    }
    const change = prev30 === 0 ? (last30 > 0 ? 100 : 0) : ((last30 - prev30) / prev30) * 100;
    const trend: DriftSeries["trend"] =
      change > 25 ? "accelerating" : change < -25 ? "declining" : "stable";
    series.push({
      payer,
      reasonCode,
      weekly: Array.from(weekly.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([weekStart, count]) => ({ weekStart, count })),
      totalLast30: last30,
      totalPrev30: prev30,
      changePct: Math.round(change),
      trend,
    });
  }

  return series.sort((a, b) => b.changePct - a.changePct);
}

export function detectReviewerClusters(events: DenialEvent[]): ReviewerCluster[] {
  const map = new Map<string, DenialEvent[]>();
  for (const e of events) {
    if (!e.letterFingerprint) continue;
    const key = `${e.payer}|${e.letterFingerprint}|${e.reviewerHint ?? "unknown"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }

  const clusters: ReviewerCluster[] = [];
  for (const [key, list] of map.entries()) {
    if (list.length < 3) continue; // require at least 3 to call it a cluster
    const [payer, fingerprint, reviewerHint] = key.split("|");
    const reasonMap = new Map<string, number>();
    for (const e of list) reasonMap.set(e.reasonCode, (reasonMap.get(e.reasonCode) ?? 0) + 1);
    const topReasonCodes = Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code, count]) => ({ code, count }));
    // illustrative overturn estimate: more boilerplate = higher overturn (weak rationale)
    const overturnRateEstimate = Math.min(72, 22 + Math.floor(list.length * 1.4));
    clusters.push({ fingerprint, reviewerHint, payer, count: list.length, topReasonCodes, overturnRateEstimate });
  }

  return clusters.sort((a, b) => b.count - a.count);
}

/** Generate a deterministic demo dataset for the UI. */
export function generateDemoDenials(): DenialEvent[] {
  const payers = ["Aetna", "UHC", "BCBS-IL", "Cigna", "Humana"];
  const cpts = ["27447", "63030", "70553", "29881", "99285"];
  const reasons = ["50", "197", "B7", "16", "11"];
  const fingerprints = ["fp-aetna-spine-v1", "fp-uhc-ortho-v2", "fp-bcbs-imaging-v1", "fp-cigna-em-v3"];
  const reviewers = ["MD-A.K.", "MD-J.R.", "MD-S.P.", "MD-T.L.", "—"];
  const events: DenialEvent[] = [];
  const now = Date.now();
  for (let i = 0; i < 240; i++) {
    const ageDays = Math.floor((i / 240) * 75);
    const date = new Date(now - ageDays * 86_400_000).toISOString();
    const payer = payers[i % payers.length];
    // Force "Aetna 27447 reason 50" to spike in the last 30 days
    const isAetnaSpine = payer === "Aetna" && i % 3 === 0;
    events.push({
      date,
      payer,
      cpt: isAetnaSpine ? "27447" : cpts[i % cpts.length],
      reasonCode: isAetnaSpine && ageDays < 30 ? "50" : reasons[i % reasons.length],
      reviewerHint: reviewers[i % reviewers.length],
      letterFingerprint: fingerprints[i % fingerprints.length],
    });
  }
  return events;
}