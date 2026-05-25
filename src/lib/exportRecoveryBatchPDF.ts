import {
  addBody,
  addDocumentHeader,
  addFooter,
  addScoreCards,
  addSectionHeader,
  addSpacer,
  addTable,
  createPDFContext,
} from "./pdfHelpers";
import {
  listFindings,
  listRunsInBatch,
  finalizeStuckBatch,
  type RecoveryBatch,
  type RecoveryFinding,
  type RecoveryRun,
} from "./recoveryService";
import { LENS_LABELS } from "./recoveryService";

function fmtMoney(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export async function exportRecoveryBatchPDF(batch: RecoveryBatch) {
  // Auto-finalize any stuck runs first so the rollup reflects reality.
  try { await finalizeStuckBatch(batch.id); } catch { /* non-fatal */ }

  // Pull all runs + all primary/kept findings across the batch
  const runs: RecoveryRun[] = await listRunsInBatch(batch.id);
  const allFindings: (RecoveryFinding & { _patient_ref?: string | null })[] = [];
  for (const r of runs) {
    try {
      const f = await listFindings(r.id);
      for (const x of f) allFindings.push({ ...x, _patient_ref: r.patient_ref });
    } catch { /* skip */ }
  }

  const keptPrimary = allFindings.filter(f => f.is_primary_in_cluster && f.adversarial_verdict === "kept");
  const top = [...keptPrimary]
    .sort((a, b) => Number(b.dollars_recoverable || 0) - Number(a.dollars_recoverable || 0))
    .slice(0, 25);

  // Per-run rollup from findings (source of truth — survives stale run totals
  // and status-string mismatches).
  const perRunRecoverable = new Map<string, number>();
  const perRunAtRisk = new Map<string, number>();
  for (const f of keptPrimary) {
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
      // completed / partial / anything else with findings → count as done
      liveCompleted++;
      liveRecoverable += recov;
      liveAtRisk += risk;
    }
  }

  // By-lens rollup
  const byLens: Record<string, { count: number; dollars: number }> = {};
  for (const f of keptPrimary) {
    const k = f.lens;
    byLens[k] = byLens[k] || { count: 0, dollars: 0 };
    byLens[k].count++;
    byLens[k].dollars += Number(f.dollars_recoverable || 0);
  }
  const lensRows = Object.entries(byLens)
    .sort((a, b) => b[1].dollars - a[1].dollars)
    .map(([lens, v]) => [
      LENS_LABELS[lens as keyof typeof LENS_LABELS] || lens,
      String(v.count),
      fmtMoney(v.dollars),
    ]);

  const ctx = createPDFContext("portrait");
  addDocumentHeader(
    ctx,
    "Portfolio Shadow Audit Summary",
    `${batch.label || "Untitled batch"} · ${new Date(batch.created_at).toLocaleDateString()}`,
  );

  // Executive metrics
  addSectionHeader(ctx, "Portfolio Rollup");
  const avg = liveCompleted ? liveRecoverable / liveCompleted : 0;
  const encSub =
    liveStuck > 0
      ? `${liveStuck} stuck${liveFailed ? ` · ${liveFailed} failed` : ""}`
      : liveFailed
        ? `${liveFailed} failed`
        : "all succeeded";
  addScoreCards(ctx, [
    { label: "Recoverable", value: fmtMoney(liveRecoverable), color: "green" },
    { label: "At Risk", value: fmtMoney(liveAtRisk), color: "amber" },
    { label: "Encounters", value: `${liveCompleted}/${runs.length || batch.encounter_count}`, sublabel: encSub, color: "blue" },
    { label: "Avg / Encounter", value: fmtMoney(avg), color: "green" },
  ]);

  addSpacer(ctx, 4);
  addBody(
    ctx,
    "Every encounter was scanned in parallel by nine independent revenue-leak lenses, deduplicated across overlapping findings, then put through an adversarial second-pass review. Only findings that survived the adversarial check and are unique in their cluster are counted toward the portfolio rollup.",
  );

  // By-lens table
  if (lensRows.length) {
    addSectionHeader(ctx, "Recoverable $ by Lens");
    addTable(
      ctx,
      [
        { header: "Lens", width: ctx.maxWidth * 0.5 },
        { header: "Findings", width: ctx.maxWidth * 0.2, align: "right" },
        { header: "$ Recoverable", width: ctx.maxWidth * 0.3, align: "right" },
      ],
      lensRows,
    );
  }

  // Per-encounter table
  addSectionHeader(ctx, "Per-Encounter Results");
  addTable(
    ctx,
    [
      { header: "Patient Ref", width: ctx.maxWidth * 0.35 },
      { header: "Status", width: ctx.maxWidth * 0.15 },
      { header: "Findings", width: ctx.maxWidth * 0.15, align: "right" },
      { header: "$ At Risk", width: ctx.maxWidth * 0.175, align: "right" },
      { header: "$ Recoverable", width: ctx.maxWidth * 0.175, align: "right" },
    ],
    runs.map(r => {
      const count = allFindings.filter(f => f.run_id === r.id && f.is_primary_in_cluster && f.adversarial_verdict === "kept").length;
      const recov = perRunRecoverable.get(r.id) ?? Number(r.total_dollars_recoverable || 0);
      const risk = perRunAtRisk.get(r.id) ?? Number(r.total_dollars_at_risk || 0);
      return [
        r.patient_ref || "—",
        r.status,
        String(count),
        fmtMoney(risk),
        fmtMoney(recov),
      ];
    }),
  );

  // Top findings table
  if (top.length) {
    addSectionHeader(ctx, `Top ${top.length} Findings (Adversarially Verified)`);
    addTable(
      ctx,
      [
        { header: "Patient", width: ctx.maxWidth * 0.15 },
        { header: "Lens", width: ctx.maxWidth * 0.15 },
        { header: "Finding", width: ctx.maxWidth * 0.4 },
        { header: "Code", width: ctx.maxWidth * 0.1 },
        { header: "Conf.", width: ctx.maxWidth * 0.08, align: "center" },
        { header: "$ Recov.", width: ctx.maxWidth * 0.12, align: "right" },
      ],
      top.map(f => [
        f._patient_ref || "—",
        LENS_LABELS[f.lens] || f.lens,
        f.title,
        f.code || "—",
        f.confidence,
        fmtMoney(f.dollars_recoverable),
      ]),
    );
  }

  addFooter(
    ctx,
    `SOUPY Audit · Shadow audit results are estimates based on documentation analysis. Validate against contract terms and payer fee schedules before action. Generated ${new Date().toLocaleString()}.`,
  );

  const safeLabel = (batch.label || "portfolio").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60);
  ctx.doc.save(`SOUPY_PortfolioAudit_${safeLabel}_${batch.id.slice(0, 8)}.pdf`);
}