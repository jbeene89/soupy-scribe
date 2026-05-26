import { describe, it, expect } from "vitest";
import { computeBatchRollup } from "./recoveryRollup";

const run = (id: string, status: string, recov = 0, risk = 0) => ({
  id,
  status,
  total_dollars_recoverable: recov,
  total_dollars_at_risk: risk,
});

const finding = (
  run_id: string,
  dollars_recoverable: number,
  opts: Partial<{ is_primary_in_cluster: boolean; adversarial_verdict: "kept" | "demoted" | "removed" | "pending"; dollars_at_risk: number }> = {},
) => ({
  run_id,
  dollars_recoverable,
  dollars_at_risk: opts.dollars_at_risk ?? dollars_recoverable,
  is_primary_in_cluster: opts.is_primary_in_cluster ?? true,
  adversarial_verdict: opts.adversarial_verdict ?? ("kept" as const),
});

describe("computeBatchRollup", () => {
  it("reproduces the $0 rollup bug: stale run totals + real primary findings should NOT export $0", () => {
    // Bug scenario: edge function died before recomputing run totals, so every
    // run row has total_dollars_recoverable = 0, but the findings table has
    // the real primary/kept dollars. Status is also stuck on 'running'.
    const runs = [
      run("r1", "running", 0, 0),
      run("r2", "running", 0, 0),
    ];
    const findings = [
      finding("r1", 50_000),
      finding("r2", 99_825),
    ];

    const rollup = computeBatchRollup(runs, findings);

    expect(rollup.liveRecoverable).toBe(149_825);
    expect(rollup.liveAtRisk).toBe(149_825);
    expect(rollup.liveCompleted).toBe(2);
  });

  it("computes totals from primary+kept findings, ignoring stale run column", () => {
    const runs = [run("r1", "completed", 999_999, 999_999)];
    const findings = [finding("r1", 1_000), finding("r1", 2_500)];

    const rollup = computeBatchRollup(runs, findings);

    // Findings win over stale run.total_dollars_*
    expect(rollup.liveRecoverable).toBe(3_500);
    expect(rollup.perRunRecoverable.get("r1")).toBe(3_500);
  });

  it("excludes non-primary and non-kept findings", () => {
    const runs = [run("r1", "completed")];
    const findings = [
      finding("r1", 1_000), // counted
      finding("r1", 5_000, { is_primary_in_cluster: false }), // duplicate cluster
      finding("r1", 7_000, { adversarial_verdict: "removed" }),
      finding("r1", 9_000, { adversarial_verdict: "demoted" }),
      finding("r1", 4_000, { adversarial_verdict: "pending" }),
    ];

    const rollup = computeBatchRollup(runs, findings);

    expect(rollup.liveRecoverable).toBe(1_000);
  });

  it("falls back to run column when a run has no findings", () => {
    const runs = [run("r1", "completed", 4_200, 4_200)];
    const rollup = computeBatchRollup(runs, []);
    expect(rollup.liveRecoverable).toBe(4_200);
  });

  it("categorizes statuses: completed/partial done, running/pending/queued stuck, failed failed", () => {
    const runs = [
      run("a", "completed", 100),
      run("b", "partial", 200),
      run("c", "running"),
      run("d", "pending"),
      run("e", "queued"),
      run("f", "failed"),
    ];
    const rollup = computeBatchRollup(runs, []);
    expect(rollup.liveCompleted).toBe(2);
    expect(rollup.liveStuck).toBe(3);
    expect(rollup.liveFailed).toBe(1);
    expect(rollup.liveRecoverable).toBe(300);
  });

  it("does NOT trigger the stale-metadata guard when there are zero findings", () => {
    const runs = [run("r1", "completed", 0, 0)];
    const rollup = computeBatchRollup(runs, []);
    expect(rollup.liveRecoverable).toBe(0);
    expect(rollup.liveCompleted).toBe(1);
  });

  it("triggers stale-metadata guard when every run is stuck/failed but findings exist", () => {
    // Worst case: nothing counted as 'completed' but findings are real.
    const runs = [run("r1", "running"), run("r2", "failed")];
    const findings = [finding("r1", 10_000), finding("r2", 5_000)];
    const rollup = computeBatchRollup(runs, findings);
    expect(rollup.liveRecoverable).toBe(15_000);
    expect(rollup.liveCompleted).toBeGreaterThanOrEqual(2);
  });
});