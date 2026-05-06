import {
  createPDFContext, addDocumentHeader, addSectionHeader, addTitle, addSubtitle,
  addBody, addBullet, addKeyValueGrid, addAlertBox, addBadge, addDivider, addSpacer,
  addFooter, addTable, severityColor, checkPage, addScoreCards,
} from "./pdfHelpers";
import type { ClawbackAudit, ClawbackClaim, ClawbackExtrapolation } from "./clawbackTypes";

const fmtMoney = (n: number) => `$${Math.round(n || 0).toLocaleString()}`;
const fmtPct = (n: number) => `${(n || 0).toFixed(1)}%`;

const STRENGTH_LABEL: Record<string, string> = {
  full_defense: "Full Defense",
  strong: "Strong",
  partial: "Partial",
  weak: "Weak",
  conceded: "Conceded",
  pending: "Pending",
};

export function exportClawbackPacketPDF(opts: {
  audit: ClawbackAudit;
  claims: ClawbackClaim[];
  extrapolation: ClawbackExtrapolation | null;
}): Blob {
  const { audit, claims, extrapolation } = opts;
  const ctx = createPDFContext("portrait");

  // ─── Cover Page ───
  addDocumentHeader(ctx, "RAC Clawback Defense Packet", `${audit.audit_name}${audit.contractor ? " · " + audit.contractor : ""}`);
  addSpacer(ctx, 8);
  if (extrapolation) {
    addScoreCards(ctx, [
      { label: "RAC Demand", value: fmtMoney(extrapolation.rac_point_estimate), color: "red" },
      { label: "Defensible (90% LCB)", value: fmtMoney(extrapolation.reduced_exposure), color: "green" },
      { label: "Liability Reduced", value: fmtMoney(extrapolation.exposure_delta), color: "amber" },
      { label: "Leverage", value: `${extrapolation.leverage_score}/100`, color: "blue" },
    ]);
  }
  addSubtitle(ctx, "Audit Particulars");
  addKeyValueGrid(ctx, [
    ["Audit", audit.audit_name],
    ["Contractor", audit.contractor || "—"],
    ["Audit Period", `${audit.audit_period_start || "—"} → ${audit.audit_period_end || "—"}`],
    ["Notice Date", audit.notice_date || "—"],
    ["Response Deadline", audit.response_deadline || "—"],
    ["Sample / Universe", `${audit.sample_size ?? "—"} / ${audit.universe_size ?? "—"}`],
    ["Claims Reviewed", String(claims.length)],
    ["Status", audit.status],
  ]);
  addSpacer(ctx, 8);
  addAlertBox(
    ctx,
    "This packet is prepared under attorney work-product privilege and is intended for use in administrative appeal, ALJ hearing, or settlement negotiation. Statistical recomputation follows CMS MPIM Ch.8 conventions.",
    "info",
    "Use & Privilege",
  );
  ctx.doc.addPage();
  ctx.pageNumber++;
  ctx.y = 44;

  // ─── Executive Summary ───
  addSectionHeader(ctx, "Executive Summary");
  if (extrapolation) {
    addKeyValueGrid(ctx, [
      ["RAC Demand", fmtMoney(extrapolation.rac_point_estimate)],
      ["Defensible Exposure (90% LCB)", fmtMoney(extrapolation.reduced_exposure)],
      ["Reduction in Liability", fmtMoney(extrapolation.exposure_delta)],
      ["Settlement Leverage Score", `${extrapolation.leverage_score}/100`],
      ["Sample Size (n)", String(extrapolation.details?.n ?? audit.sample_size ?? "—")],
      ["Universe Size (N)", String(extrapolation.details?.N ?? audit.universe_size ?? "—")],
      ["Sample Precision", fmtPct(extrapolation.precision_pct)],
      ["Procedural Defects", String((extrapolation.procedural_defects || []).length)],
    ]);
    if (extrapolation.attack_summary) {
      addSpacer(ctx, 6);
      addAlertBox(ctx, extrapolation.attack_summary, "warning", "Defense Position");
    }
  } else {
    addBody(ctx, "Extrapolation attack has not yet been run.");
  }
  addSpacer(ctx, 10);

  // ─── Statistical Attack ───
  if (extrapolation) {
    addSectionHeader(ctx, "Statistical Attack on Extrapolation");
    addSubtitle(ctx, "CMS MPIM Ch.8 Compliance Review");
    addSpacer(ctx, 4);
    const compRows: string[][] = Object.entries(extrapolation.cms_compliance || {}).map(([k, v]) => [
      k.replace(/_/g, " "),
      v.ok ? "OK" : "DEFECT",
      v.finding,
    ]);
    if (compRows.length) {
      addTable(ctx,
        [
          { header: "Check", width: 130 },
          { header: "Status", width: 60 },
          { header: "Finding", width: 0 },
        ],
        compRows
      );
    }
    addSpacer(ctx, 8);

    const defects = extrapolation.procedural_defects || [];
    if (defects.length) {
      addSubtitle(ctx, "Procedural Defects Identified");
      defects.forEach((d) => {
        checkPage(ctx, 50);
        addBadge(ctx, d.severity.toUpperCase(), severityColor(d.severity));
        addSpacer(ctx, 4);
        addBody(ctx, `${d.title} — ${d.citation}`);
        addBullet(ctx, d.description, 9, 8);
        addSpacer(ctx, 4);
      });
    }
    addSpacer(ctx, 6);

    addSubtitle(ctx, "Recomputed Estimator");
    addKeyValueGrid(ctx, [
      ["Method", String(extrapolation.details?.method || "simple").toUpperCase()],
      ["Degrees of Freedom", String(extrapolation.details?.df ?? "—")],
      ["Sample Mean Overpayment (post-defense)", fmtMoney(extrapolation.details?.sample_mean_overpayment || 0)],
      ["Sample Std. Dev.", fmtMoney(extrapolation.details?.sample_sd || 0)],
      ["Standard Error (extrapolated)", fmtMoney(extrapolation.details?.standard_error || 0)],
      ["t-critical (90%, one-sided)", String((extrapolation.details?.t_critical_90 || 0).toFixed(3))],
      ["Margin of Error", fmtMoney(extrapolation.details?.margin_of_error || 0)],
      ["Recomputed Point Estimate", fmtMoney(extrapolation.recomputed_point_estimate)],
      ["90% Lower Confidence Bound", fmtMoney(extrapolation.recomputed_lower_ci)],
    ]);
    if (extrapolation.details?.scenarios) {
      addSpacer(ctx, 8);
      addSubtitle(ctx, "Settlement Scenarios");
      const s = extrapolation.details.scenarios;
      addKeyValueGrid(ctx, [
        ["Best Case — pending claims fully defended (LCB)", fmtMoney(s.best_case_lower_ci)],
        ["Expected — current per-claim outcomes (LCB)", fmtMoney(s.expected_lower_ci)],
        ["Worst Case — pending claims conceded (LCB)", fmtMoney(s.worst_case_lower_ci)],
      ]);
    }
    addSpacer(ctx, 10);
  }

  // ─── Per-Claim Defense Summary ───
  addSectionHeader(ctx, "Exhibit A — Per-Claim Defense Roster");
  const counts: Record<string, number> = {};
  claims.forEach((c) => {
    const k = c.defense_strength || c.defense_status || "pending";
    counts[k] = (counts[k] || 0) + 1;
  });
  const summaryPairs: [string, string][] = Object.entries(counts).map(([k, v]) => [STRENGTH_LABEL[k] || k, String(v)]);
  if (summaryPairs.length) addKeyValueGrid(ctx, summaryPairs);
  addSpacer(ctx, 8);

  // Sortable summary table
  const claimRows: string[][] = claims.map((c, i) => [
    `A-${String(i + 1).padStart(3, "0")}`,
    c.claim_number || "—",
    c.date_of_service || "—",
    fmtMoney(Number(c.rac_disallowed_amount) || 0),
    (c.cpt_codes || []).slice(0, 3).join(", "),
    STRENGTH_LABEL[c.defense_strength || "pending"] || "Pending",
    c.recommended_outcome || "—",
  ]);
  addTable(ctx,
    [
      { header: "Exhibit", width: 50 },
      { header: "Claim #", width: 70 },
      { header: "DOS", width: 56 },
      { header: "Disallowed", width: 58 },
      { header: "CPT", width: 60 },
      { header: "Defense", width: 56 },
      { header: "Outcome", width: 0 },
    ],
    claimRows
  );
  addSpacer(ctx, 12);

  // ─── Detailed claim defenses ───
  addSectionHeader(ctx, "Exhibit B — Claim-Level Clinical Justifications");
  claims.forEach((c, i) => {
    if (!c.clinical_justification && !(c.defense_findings || []).length) return;
    checkPage(ctx, 80);
    addTitle(ctx, `Exhibit A-${String(i + 1).padStart(3, "0")} · Claim ${c.claim_number || "(unnumbered)"}${c.date_of_service ? " · " + c.date_of_service : ""}`, 11);
    addBody(ctx, `RAC finding: ${c.rac_finding_text || c.rac_finding_code || "—"}`);
    if (c.clinical_justification) {
      addBody(ctx, `Defense: ${c.clinical_justification}`);
    }
    (c.defense_findings || []).forEach((f: any) => {
      addBullet(ctx, `[${f.type || "finding"}] ${f.title || ""} — ${f.detail || ""}`, 9, 8);
    });
    addSpacer(ctx, 6);
  });

  addFooter(ctx, "SOUPY Audit · Confidential — Attorney Work Product");
  return ctx.doc.output("blob");
}