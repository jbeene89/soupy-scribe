// AuditFinding — the structured, line-level contract every SoupyAudit finding
// must satisfy BEFORE any executive summary or prevention playbook is rendered.
//
// The prevention playbook is a *view* over AuditFinding[]. It can never report
// a category total without naming the contributing sourceIds.

export const DEFECT_TYPES = [
  "upcoding",
  "unbundling",
  "bundling",
  "modifier_abuse",
  "phantom_charge",
  "duplicate_charge",
  "vendor_overbilling",
  "vendor_duplicate",
  "policy_time",
  "contract_underpay",
  "documentation_gap",
  "medical_necessity",
  "other",
] as const;

export type DefectType = (typeof DEFECT_TYPES)[number];

export const SOURCE_TYPES = [
  "charge",
  "vendor",
  "note",
  "timesheet",
  "fhir",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type AuditFinding = {
  sourceId: string;
  sourceType: SourceType;
  defectType: DefectType | string;
  confidence: "high" | "medium" | "low";
  recoverableAmount: number;
  evidence: string;       // verbatim snippet from the row
  explanation: string;    // 1-2 sentence rationale
};

export type ValidationResult =
  | { ok: true; finding: AuditFinding }
  | { ok: false; reason: string; raw: unknown };

/**
 * Pull a stable per-row sourceId. Tries common column names; if none match,
 * falls back to a deterministic synthetic id like `{prefix}-row-{index}`.
 */
export function deriveSourceId(
  row: Record<string, unknown>,
  sourceType: SourceType,
  index: number,
): string {
  const prefix =
    sourceType === "charge" ? "chg" :
    sourceType === "vendor" ? "ven" :
    sourceType === "note" ? "note" :
    sourceType === "timesheet" ? "ts" :
    "fhir";

  const CANDIDATE_KEYS = [
    "sourceId", "source_id",
    "id",
    "charge_id", "chargeId",
    "invoice_id", "invoiceId",
    "vendor_invoice_id",
    "note_id", "noteId",
    "timesheet_id",
    "encounter_id", "encounterId",
    "line_id", "lineId",
  ];
  for (const k of CANDIDATE_KEYS) {
    const v = row[k];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return `${prefix}-row-${index}`;
}

/**
 * Validate one finding. The finding's sourceId must exist in knownSourceIds,
 * the evidence string must appear verbatim somewhere in the corresponding
 * row's serialized values, defectType must be non-empty, recoverableAmount
 * must be a non-negative number. Returns either a normalized finding or a
 * rejection with a reason.
 */
export function validateFinding(
  raw: unknown,
  rowsBySourceId: Map<string, Record<string, unknown>>,
): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "not_an_object", raw };
  }
  const r = raw as Record<string, unknown>;

  const sourceId = String(r.sourceId ?? "").trim();
  if (!sourceId) return { ok: false, reason: "missing_sourceId", raw };

  const row = rowsBySourceId.get(sourceId);
  if (!row) return { ok: false, reason: "sourceId_not_in_bundle", raw };

  const sourceType = String(r.sourceType ?? "").trim() as SourceType;
  if (!SOURCE_TYPES.includes(sourceType)) {
    return { ok: false, reason: "bad_sourceType", raw };
  }

  const defectType = String(r.defectType ?? "").trim();
  if (!defectType) return { ok: false, reason: "missing_defectType", raw };

  const evidence = String(r.evidence ?? "").trim();
  if (!evidence) return { ok: false, reason: "missing_evidence", raw };

  // Verbatim check: evidence must appear in the row text.
  const rowText = Object.values(row).map((v) => String(v ?? "")).join(" | ").toLowerCase();
  const needle = evidence.toLowerCase().replace(/\s+/g, " ").trim();
  if (needle.length >= 3 && !rowText.replace(/\s+/g, " ").includes(needle)) {
    return { ok: false, reason: "evidence_not_in_row", raw };
  }

  const recoverableAmount = Math.max(0, Number(r.recoverableAmount) || 0);

  const confRaw = String(r.confidence ?? "medium").toLowerCase();
  const confidence: AuditFinding["confidence"] =
    confRaw === "high" || confRaw === "low" ? confRaw : "medium";

  return {
    ok: true,
    finding: {
      sourceId,
      sourceType,
      defectType,
      confidence,
      recoverableAmount,
      evidence: evidence.slice(0, 1000),
      explanation: String(r.explanation ?? "").slice(0, 1000),
    },
  };
}

export type RollupRow = {
  defectType: string;
  totalRecoverable: number;
  count: number;
  sourceIds: string[];
};

/**
 * Group findings by defectType for the prevention playbook view.
 * Every group lists its contributing sourceIds — no orphan totals.
 */
export function rollupByDefectType(findings: AuditFinding[]): RollupRow[] {
  const map = new Map<string, RollupRow>();
  for (const f of findings) {
    const cur = map.get(f.defectType) ?? {
      defectType: f.defectType,
      totalRecoverable: 0,
      count: 0,
      sourceIds: [],
    };
    cur.totalRecoverable += f.recoverableAmount;
    cur.count += 1;
    cur.sourceIds.push(f.sourceId);
    map.set(f.defectType, cur);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.totalRecoverable - a.totalRecoverable,
  );
}

/**
 * Convert AuditFinding[] to the shape Code Bay's scoreDetector expects:
 * { sourceId, findingType, reasoning }.
 */
export function toDetectorFindings(
  findings: AuditFinding[],
): Array<{ sourceId: string; findingType: string; reasoning: string }> {
  return findings.map((f) => ({
    sourceId: f.sourceId,
    findingType: f.defectType,
    reasoning: f.explanation,
  }));
}