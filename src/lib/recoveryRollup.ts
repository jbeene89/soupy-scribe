import type { RecoveryFinding, RecoveryRun } from "./recoveryService";

export interface BatchRollup {
  perRunRecoverable: Map<string, number>;
  perRunAtRisk: Map<string, number>;
  liveRecoverable: number;
  liveAtRisk: number;
  liveCompleted: number;
  liveFailed: number;
  liveStuck: number;
}

/**
 * Pure rollup calculator. Source of truth is the kept+primary findings.
 * Run-level `total_dollars_*` columns are used only as a fallback when no
 * findings exist for a given run.
 *
 * Guarantees:
 * - Never returns a $0 recoverable total when any primary/kept finding
 *   carries real dollars (defends against stale batch metadata).
 * - Counts completed/partial as done; running/pending/queued as stuck;
 *   failed as failed.
 */
export function computeBatchRollup(
  runs: Pick<RecoveryRun, "id" | "status" | "total_dollars_recoverable" | "total_dollars_at_risk">[],
  findings: Pick<RecoveryFinding, "run_id" | "is_primary_in_cluster" | "adversarial_verdict" | "dollars_recoverable" | "dollars_at_risk">[],
): BatchRollup {
  const perRunRecoverable = new Map<string, number>();
  const perRunAtRisk = new Map<string, number>();
  for (const f of findings) {
    if (!f.is_primary_in_cluster || f.adversarial_verdict !== "kept") continue;
    perRunRecoverable.set(f.run_id, (perRunRecoverable.get(f.run_id) || 0) + Number(f.dollars_recoverable || 0));
    perRunAtRisk.set(f.run_id, (perRunAtRisk.get(f.run_id) || 0) + Number(f.dollars_at_risk || 0));
  }

  let liveRecoverable = 0;
  let liveAtRisk = 0;
  let liveCompleted = 0;
  let liveFailed = 0;
  let liveStuck = 0;
  for (const r of runs) {
    const status = String(r.status || "").toLowerCase();
    const recov = perRunRecoverable.get(r.id) ?? Number(r.total_dollars_recoverable || 0);
    const risk = perRunAtRisk.get(r.id) ?? Number(r.total_dollars_at_risk || 0);
    if (status === "failed") {
      liveFailed++;
    } else if (status === "running" || status === "pending" || status === "queued") {
      liveStuck++;
    } else {
      liveCompleted++;
      liveRecoverable += recov;
      liveAtRisk += risk;
    }
  }

  // Stale-metadata guard: if rollup came out $0 but we have real primary
  // finding dollars, fall back to the findings sum.
  if (liveRecoverable === 0 && perRunRecoverable.size > 0) {
    liveRecoverable = Array.from(perRunRecoverable.values()).reduce((s, v) => s + v, 0);
    liveAtRisk = Array.from(perRunAtRisk.values()).reduce((s, v) => s + v, 0);
    liveCompleted = Math.max(liveCompleted, perRunRecoverable.size);
  }

  return { perRunRecoverable, perRunAtRisk, liveRecoverable, liveAtRisk, liveCompleted, liveFailed, liveStuck };
}