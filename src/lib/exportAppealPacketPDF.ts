// Appeal Packet PDF export — produced from a crosswalk verdict + parsed claim + parsed note.
// Uses the standardized pdfHelpers theme so it matches every other export in the app.
import {
  createPDFContext, addDocumentHeader, addSectionHeader, addBody, addBullet,
  addBadge, addAlertBox, addKeyValueGrid, addTable, addSpacer, addFooter,
  addScoreCards, addDivider, addTitle,
} from "./pdfHelpers";
import type { ParsedClaim } from "./parsedClaimTypes";
import type { CrosswalkVerdict, ParsedNote } from "./crosswalkTypes";

export interface AppealPacketArgs {
  claim: ParsedClaim;
  note: ParsedNote | null;
  verdict: CrosswalkVerdict;
  sourceFileName?: string;
  noteFileName?: string;
}

export function exportAppealPacketPDF(args: AppealPacketArgs) {
  const { claim, note, verdict } = args;
  const ctx = createPDFContext("portrait");

  const payer = claim.claim_header.payer_name?.value || "Payer";
  const cpt = verdict.service_match.cpt_under_review || claim.codes.cpt_codes?.value?.[0] || "—";
  const dos = claim.service.date_of_service_from?.value || "—";

  addDocumentHeader(ctx, "Appeal Packet", `${payer} · CPT ${cpt} · DOS ${dos}`);

  // Posture cards
  addScoreCards(ctx, [
    { label: "Decision",    value: verdict.pre_submission_decision.decision.replace(/_/g, " "), color: decisionColor(verdict.pre_submission_decision.decision) },
    { label: "Confidence",  value: `${Math.round((verdict.pre_submission_decision.confidence || 0) * 100)}%`, color: "brand" },
    { label: "Service",     value: verdict.service_match.verdict.replace(/_/g, " "), color: supportColor(verdict.service_match.verdict) },
    { label: "Med. Nec.",   value: verdict.medical_necessity.verdict, color: strengthColor(verdict.medical_necessity.verdict) },
    { label: "Appeal",      value: verdict.appeal_readiness.strength.replace(/_/g, " "), color: strengthColor(verdict.appeal_readiness.strength === "not_applicable" ? "weak" : verdict.appeal_readiness.strength) },
  ]);

  addAlertBox(ctx, verdict.pre_submission_decision.headline, decisionSeverity(verdict.pre_submission_decision.decision), "Auditor headline");
  addBody(ctx, verdict.pre_submission_decision.why);

  // Claim summary
  addSectionHeader(ctx, "Claim Under Appeal");
  addKeyValueGrid(ctx, [
    ["Payer",              payer],
    ["Claim #",            claim.claim_header.claim_number?.value || "—"],
    ["Authorization #",    claim.claim_header.authorization_number?.value || "—"],
    ["CPT under review",   cpt],
    ["Date of service",    dos],
    ["Place of service",   claim.service.place_of_service?.value || "—"],
    ["Total billed",       claim.financials.total_billed_amount?.value != null ? `$${claim.financials.total_billed_amount.value.toLocaleString()}` : "—"],
    ["Denied amount",      claim.financials.denied_amount?.value != null ? `$${claim.financials.denied_amount.value.toLocaleString()}` : "—"],
    ["Denial reason",      claim.claim_header.denial_reason_text?.value || (claim.claim_header.denial_reason_codes?.value || []).join(", ") || "—"],
    ["Appeal deadline",    claim.claim_header.appeal_deadline?.value || "—"],
  ]);

  // Appeal argument
  if (verdict.appeal_readiness.applicable) {
    addSectionHeader(ctx, "Appeal Argument");
    if (verdict.appeal_readiness.argument) {
      addBody(ctx, verdict.appeal_readiness.argument);
    } else {
      addBody(ctx, "No specific appeal argument was generated. See evidence and gaps below.");
    }

    if (verdict.appeal_readiness.evidence_to_cite.length > 0) {
      addSpacer(ctx, 4);
      addTitle(ctx, "Evidence to cite", 11);
      verdict.appeal_readiness.evidence_to_cite.forEach((e) => addBullet(ctx, e));
    }

    if (verdict.appeal_readiness.what_is_missing.length > 0) {
      addSpacer(ctx, 4);
      addTitle(ctx, "Documentation gaps to address before submission", 11);
      verdict.appeal_readiness.what_is_missing.forEach((e) => addBullet(ctx, e));
    }
  }

  // Service validation
  addSectionHeader(ctx, "Service Validation");
  addBody(ctx, verdict.service_match.why);
  if (verdict.service_match.modifier_issues.length > 0) {
    addSpacer(ctx, 2);
    addTitle(ctx, "Modifier issues", 11);
    verdict.service_match.modifier_issues.forEach((m) => addBullet(ctx, m));
  }

  // Diagnosis matrix
  if (verdict.diagnosis_support_matrix.length > 0) {
    addSectionHeader(ctx, "Diagnosis Support Matrix");
    verdict.diagnosis_support_matrix.forEach((dx) => {
      addTitle(ctx, `${dx.diagnosis} — ${dx.support_strength.toUpperCase()}`, 11);
      if (dx.supported_by.length > 0) {
        addBody(ctx, "Supported by:");
        dx.supported_by.forEach((s) => addBullet(ctx, s));
      }
      if (dx.missing_support.length > 0) {
        addBody(ctx, "Missing support:");
        dx.missing_support.forEach((s) => addBullet(ctx, s));
      }
      if (dx.contradictions.length > 0) {
        addBody(ctx, "Contradictions:");
        dx.contradictions.forEach((s) => addBullet(ctx, s));
      }
      addSpacer(ctx, 4);
    });
  }

  // Medical necessity
  addSectionHeader(ctx, "Medical Necessity");
  addBody(ctx, verdict.medical_necessity.why);
  addKeyValueGrid(ctx, [
    ["Symptom severity documented",       verdict.medical_necessity.symptom_severity_documented ? "Yes" : "No"],
    ["Functional impairment documented",  verdict.medical_necessity.functional_impairment_documented ? "Yes" : "No"],
    ["Risk level documented",             verdict.medical_necessity.risk_level_documented ? "Yes" : "No"],
    ["Treatment justified",               verdict.medical_necessity.treatment_justification_documented ? "Yes" : "No"],
  ]);
  if (verdict.medical_necessity.missing_elements.length > 0) {
    addTitle(ctx, "Missing elements", 11);
    verdict.medical_necessity.missing_elements.forEach((m) => addBullet(ctx, m));
  }

  // Time
  addSectionHeader(ctx, "Time Validation");
  addTable(ctx,
    [
      { header: "Field", width: ctx.maxWidth * 0.5 },
      { header: "Value", width: ctx.maxWidth * 0.5 },
    ],
    [
      ["Verdict",               verdict.time_support.verdict.replace(/_/g, " ")],
      ["Time statement present", verdict.time_support.time_statement_present ? "Yes" : "No"],
      ["Documented minutes",    verdict.time_support.documented_minutes != null ? String(verdict.time_support.documented_minutes) : "—"],
      ["Required minutes",      verdict.time_support.required_minutes_for_billed_code != null ? String(verdict.time_support.required_minutes_for_billed_code) : "—"],
    ]
  );
  if (verdict.time_support.issues.length > 0) {
    addTitle(ctx, "Issues", 11);
    verdict.time_support.issues.forEach((i) => addBullet(ctx, i));
  }

  // Med management (if applicable)
  if (verdict.med_management_support.applies) {
    addSectionHeader(ctx, "Medication Management Support");
    addKeyValueGrid(ctx, [
      ["Verdict",                verdict.med_management_support.verdict],
      ["Review documented",      yn(verdict.med_management_support.medication_review_documented)],
      ["Changes documented",     yn(verdict.med_management_support.changes_documented)],
      ["Rationale documented",   yn(verdict.med_management_support.rationale_documented)],
      ["Side effects discussed", yn(verdict.med_management_support.side_effects_documented)],
      ["Adherence discussed",    yn(verdict.med_management_support.adherence_documented)],
    ]);
    if (verdict.med_management_support.missing_elements.length > 0) {
      addTitle(ctx, "Missing elements", 11);
      verdict.med_management_support.missing_elements.forEach((m) => addBullet(ctx, m));
    }
  }

  // Contradictions
  if (verdict.contradictions.length > 0) {
    addSectionHeader(ctx, "Contradictions");
    verdict.contradictions.forEach((c) => {
      addAlertBox(ctx, `A: ${c.statement_a}\nB: ${c.statement_b}\n\nWhy: ${c.why}`, c.severity === "high" ? "error" : c.severity === "medium" ? "warning" : "info", `${c.type.replace(/_/g, " ")} · ${c.severity}`);
    });
  }

  // Action checklist
  if (verdict.actions.length > 0) {
    addSectionHeader(ctx, "Action Checklist");
    verdict.actions.forEach((a, i) => {
      addBullet(ctx, `[${a.priority.toUpperCase()}] ${a.action}  —  Issue: ${a.issue}`);
    });
  }

  // Note signals
  if (note) {
    addDivider(ctx);
    addSectionHeader(ctx, "Clinical Note Signals");
    addKeyValueGrid(ctx, [
      ["Visit type",                  note.visit_type || "—"],
      ["Time statement present",      note.time_documented?.time_statement_present ? "Yes" : "No"],
      ["Documented minutes",          note.time_documented?.total_minutes != null ? String(note.time_documented.total_minutes) : "—"],
      ["Functional impairment",       note.functional_impairment?.documented ? "Yes" : "No"],
      ["Risk assessed",               note.risk_assessment?.assessed ? "Yes" : "No"],
      ["Psychotherapy narrative",     note.psychotherapy_narrative?.present ? `Yes (${note.psychotherapy_narrative.modality || "modality unspecified"})` : "No"],
      ["Symptoms documented",         String((note.symptoms_documented || []).length)],
      ["Diagnoses in note",           String((note.diagnoses_in_note || []).length)],
    ]);
    if ((note.copy_forward_indicators || []).length > 0) {
      addTitle(ctx, "Copy-forward indicators", 11);
      note.copy_forward_indicators.forEach((c) => addBullet(ctx, c));
    }
  }

  addFooter(ctx, "Generated by SOUPY Audit · For internal use only · Strict-auditor crosswalk verdict.");

  const fname = `appeal-packet-${cpt}-${dos}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
  ctx.doc.save(fname);
}

function yn(b?: boolean | null): string {
  if (b === true) return "Yes";
  if (b === false) return "No";
  return "—";
}

function decisionColor(d: CrosswalkVerdict["pre_submission_decision"]["decision"]): "red" | "amber" | "green" | "blue" | "brand" {
  if (d === "ready_to_submit") return "green";
  if (d === "needs_fix") return "amber";
  if (d === "high_denial_risk" || d === "not_defensible") return "red";
  if (d === "undercoded") return "blue";
  return "brand";
}

function decisionSeverity(d: CrosswalkVerdict["pre_submission_decision"]["decision"]): "info" | "warning" | "error" | "success" {
  if (d === "ready_to_submit") return "success";
  if (d === "needs_fix" || d === "undercoded") return "warning";
  return "error";
}

function supportColor(s: string): "red" | "amber" | "green" | "blue" | "brand" {
  if (s === "supported") return "green";
  if (s === "weakly_supported") return "amber";
  return "red";
}

function strengthColor(s: string): "red" | "amber" | "green" | "blue" | "brand" {
  if (s === "strong") return "green";
  if (s === "moderate") return "amber";
  return "red";
}
