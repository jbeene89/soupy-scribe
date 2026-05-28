// Vendor Watch — analyzes uploaded vendor documents (contracts, remits, EOBs,
// fee schedules) and writes structured findings via the Lovable AI gateway.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a payer-contract and revenue-cycle audit assistant.
You receive a single vendor document (payer contract, fee schedule, remittance / 835, EOB,
vendor invoice, or correspondence) AND a brief context list of the user's OTHER
previously-analyzed vendor documents (including any extracted rate schedules and line
items). You must:
 1. Auto-classify the document (detected_doc_type) and pull the real vendor / payer name
    from the document text (detected_vendor_name) — the user often does not know the
    correct label.
 2. Extract structured intelligence the revenue-cycle team can act on.
 3. EXTRACT STRUCTURED PAYLOADS so the reconciler can do exact math on later uploads:
    - For CONTRACTS / FEE SCHEDULES: populate rate_schedule[] with every service line
      you can read (service_code, service_name, unit_price OR basis+basis_value,
      effective dates).
    - For INVOICES / REMITS / EOBs: populate line_items[] with every billed line
      (service_code, service_name, quantity, unit_price, line_total, service_date,
      line_ref). Also set billing_period_start/end and invoice_total when present.
    Be exhaustive — partial extraction is worse than none. If a value is missing, omit
    that field rather than guessing.
 4. CROSS-REFERENCE the new document against the supplied context list. If a contract
    states a fee-schedule basis and a remit shows a different paid amount, flag it. If a
    new amendment supersedes an older contract, note it. If a fee schedule and remit agree,
    say so (relationship: "matches"). Always include related_file_name when citing another
    doc.
 5. DEDUP findings. Do NOT emit one finding per billed line. If the same issue affects
    multiple lines, emit ONE finding and list every line in affected_lines[] (use
    line_ref or service_code). The reconciler will compute dollars from the lines.
 6. finding_type MUST be one of:
    rate_variance, shadow_fee, duplicate_billing, unit_inflation, auto_renewal_trap,
    unfavorable_clause, missing_clause, timely_filing, recoupment_risk, sla_breach,
    price_creep, underpayment, denial_pattern, fee_schedule_drift, cross_doc_conflict,
    other.

For CONTRACTS / FEE SCHEDULES: extract effective dates, term length, payment terms (Net X),
timely-filing windows, appeal windows, fee-schedule basis (% of Medicare, fixed, per-diem),
carve-outs, termination clauses, and any unfavorable language (silent on appeals, one-sided
amendment rights, recoupment without notice, mandatory arbitration with vendor-chosen venue).

For REMITS / EOBs: extract claim count, total billed, total allowed, total paid, adjustment
codes used, denial reasons, and flag any underpayments vs the contract baseline, suspect
CARC/RARC patterns (CO-45 stacking, CO-97 bundling, CO-50 medical-necessity sweeps), and
timely-filing recoupments.

Severity scale: low = informational, medium = should be reviewed, high = likely revenue
leak or contract risk, critical = active financial loss or breach.

Be specific. Quote exact contract language when flagging issues. Conservative on dollar
impact — only estimate when the document supports it.

If the user's stated vendor name is "Auto-detecting…" or empty, you MUST populate
detected_vendor_name from the document. If the stated doc type is "other" but the document
is clearly a contract / remit / fee schedule / EOB / correspondence, set detected_doc_type
accordingly.`;

const ANOMALY_ENUM = [
  "rate_variance","shadow_fee","duplicate_billing","unit_inflation","auto_renewal_trap",
  "unfavorable_clause","missing_clause","timely_filing","recoupment_risk","sla_breach",
  "price_creep","underpayment","denial_pattern","fee_schedule_drift","cross_doc_conflict","other",
];

const tool = {
  type: "function",
  function: {
    name: "report_vendor_audit",
    description: "Return a structured vendor-document audit report.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "2-3 sentence executive summary." },
        document_kind: {
          type: "string",
          enum: ["contract", "fee_schedule", "remit", "eob", "correspondence", "unknown"],
        },
        detected_vendor_name: {
          type: "string",
          description: "The real vendor / payer name pulled from the document text. Empty string if not present.",
        },
        detected_doc_type: {
          type: "string",
          enum: ["contract", "fee_schedule", "remit", "eob", "correspondence", "other"],
        },
        key_terms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              value: { type: "string" },
            },
            required: ["label", "value"],
          },
        },
        rate_schedule: {
          type: "array",
          description: "Per-service contracted rates. Populate for contracts and fee schedules.",
          items: {
            type: "object",
            properties: {
              service_code: { type: "string" },
              service_name: { type: "string" },
              unit_price: { type: "number" },
              basis: { type: "string", description: "fixed | % Medicare | per-diem | percent_of_charges | other" },
              basis_value: { type: "number" },
              effective_start: { type: "string" },
              effective_end: { type: "string" },
              notes: { type: "string" },
            },
            required: ["service_name"],
          },
        },
        line_items: {
          type: "array",
          description: "Per-line billed items. Populate for invoices, remits, EOBs.",
          items: {
            type: "object",
            properties: {
              service_code: { type: "string" },
              service_name: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              line_total: { type: "number" },
              service_date: { type: "string" },
              line_ref: { type: "string" },
            },
            required: ["service_name"],
          },
        },
        billing_period_start: { type: "string" },
        billing_period_end: { type: "string" },
        invoice_total: { type: "number" },
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              finding_type: {
                type: "string",
                enum: ANOMALY_ENUM,
              },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              title: { type: "string" },
              detail: { type: "string" },
              recommended_action: { type: "string" },
              dollar_impact: { type: "number", description: "Annualized or per-incident dollars at risk. 0 if unknown." },
              quoted_language: { type: "string", description: "Exact text from the doc if applicable." },
              affected_lines: {
                type: "array",
                items: { type: "string" },
                description: "line_ref or service_code values for every line covered by this finding. Dedup signal.",
              },
            },
            required: ["finding_type", "severity", "title", "detail"],
          },
        },
        cross_references: {
          type: "array",
          description: "Relationships between this document and the user's other analyzed documents. Empty array if none.",
          items: {
            type: "object",
            properties: {
              related_document_id: { type: "string" },
              related_file_name: { type: "string" },
              related_vendor: { type: "string" },
              relationship: {
                type: "string",
                description: "rate_conflict | matches | supersedes | supports | contradicts | timely_filing_conflict | other",
              },
              detail: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              dollar_impact: { type: "number" },
            },
            required: ["relationship", "detail"],
          },
        },
        confidence: { type: "number", description: "0-1 — how confident the analyzer is in the extraction." },
      },
      required: ["summary", "document_kind", "detected_doc_type", "detected_vendor_name", "findings", "cross_references", "confidence"],
    },
  },
};

// ───────────────────────────────────────────────────────────────────────────
// Deterministic reconciler. Runs after the AI returns. Cross-matches the new
// doc's line_items against any rate_schedule from the user's OTHER documents
// for the same vendor (fuzzy name match), and emits hard-math findings with
// real $ impact. Also detects shadow fees (lines with no rate-schedule match).
// ───────────────────────────────────────────────────────────────────────────
function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): Set<string> {
  return new Set(normalize(s).split(" ").filter((t) => t.length >= 3));
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
function matchScore(li: any, rs: any): number {
  if (li.service_code && rs.service_code &&
      String(li.service_code).trim().toLowerCase() === String(rs.service_code).trim().toLowerCase()) {
    return 1;
  }
  return jaccard(tokens(li.service_name || ""), tokens(rs.service_name || ""));
}

const VARIANCE_THRESHOLD = 0.02; // 2%

type ReconFinding = {
  finding_type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  detail: string;
  recommended_action: string | null;
  dollar_impact: number;
  affected_lines: string[];
  source_file?: string;
};

function reconcileLineItems(opts: {
  newDoc: { vendor_name: string; doc_type: string; file_name: string };
  newLines: any[];
  otherDocs: Array<{ id: string; vendor_name: string; doc_type: string; file_name: string; analysis: any }>;
}): ReconFinding[] {
  const out: ReconFinding[] = [];
  if (!opts.newLines?.length) return out;

  const sameVendor = opts.otherDocs.filter((o) =>
    normalize(o.vendor_name) === normalize(opts.newDoc.vendor_name) && normalize(o.vendor_name) !== ""
  );

  // Build merged rate schedule across same-vendor contracts/fee_schedules.
  type RSEntry = { service_code?: string; service_name: string; unit_price?: number; basis?: string; basis_value?: number; source_file: string };
  const merged: RSEntry[] = [];
  for (const o of sameVendor) {
    if (o.doc_type !== "contract" && o.doc_type !== "fee_schedule") continue;
    const rs: any[] = Array.isArray(o.analysis?.rate_schedule) ? o.analysis.rate_schedule : [];
    for (const r of rs) {
      merged.push({
        service_code: r.service_code,
        service_name: r.service_name || "",
        unit_price: typeof r.unit_price === "number" ? r.unit_price : undefined,
        basis: r.basis,
        basis_value: typeof r.basis_value === "number" ? r.basis_value : undefined,
        source_file: o.file_name,
      });
    }
  }

  if (merged.length === 0) return out; // nothing to reconcile against

  // ── 1. Rate variance & shadow fees ──────────────────────────────────────
  const variances: Array<{ line: any; expected: number; actual: number; rs: RSEntry; delta: number }> = [];
  const shadow: any[] = [];

  for (const li of opts.newLines) {
    let best: { score: number; rs: RSEntry | null } = { score: 0, rs: null };
    for (const rs of merged) {
      const s = matchScore(li, rs);
      if (s > best.score) best = { score: s, rs };
    }
    if (best.score < 0.4 || !best.rs) {
      // No rate-schedule match → shadow fee candidate.
      if (typeof li.line_total === "number" && li.line_total > 0) shadow.push(li);
      continue;
    }
    const rs = best.rs;
    if (typeof rs.unit_price !== "number") continue; // can't math without a unit price
    const actualUnit = typeof li.unit_price === "number"
      ? li.unit_price
      : (typeof li.line_total === "number" && typeof li.quantity === "number" && li.quantity > 0
          ? li.line_total / li.quantity
          : undefined);
    if (typeof actualUnit !== "number") continue;
    const variance = actualUnit - rs.unit_price;
    const pct = rs.unit_price > 0 ? Math.abs(variance) / rs.unit_price : 0;
    if (pct < VARIANCE_THRESHOLD) continue;
    const qty = typeof li.quantity === "number" ? li.quantity : 1;
    variances.push({ line: li, expected: rs.unit_price, actual: actualUnit, rs, delta: variance * qty });
  }

  // Group variances by source file × direction (overcharge vs undercharge).
  const groupKey = (v: typeof variances[number]) =>
    `${v.rs.source_file}::${v.delta > 0 ? "overcharge" : "undercharge"}`;
  const groups = new Map<string, typeof variances>();
  for (const v of variances) {
    const k = groupKey(v);
    const arr = groups.get(k) ?? [];
    arr.push(v);
    groups.set(k, arr);
  }
  for (const [key, vs] of groups) {
    const overcharge = vs[0].delta > 0;
    const totalDelta = vs.reduce((s, v) => s + v.delta, 0);
    const dollars = Math.abs(totalDelta);
    const sev: ReconFinding["severity"] =
      dollars > 25_000 ? "critical" : dollars > 5_000 ? "high" : "medium";
    const lineRefs = vs.map((v) => v.line.line_ref || v.line.service_code || v.line.service_name).slice(0, 50);
    const exampleLine = vs[0].line;
    const dir = overcharge ? "overcharged" : "underpaid";
    out.push({
      finding_type: "rate_variance",
      severity: sev,
      title: `Rate variance vs ${vs[0].rs.source_file}: ${vs.length} line${vs.length === 1 ? "" : "s"} ${dir}`,
      detail:
        `${vs.length} line${vs.length === 1 ? "" : "s"} differ from contracted rates by ≥${(VARIANCE_THRESHOLD * 100).toFixed(0)}%. ` +
        `Example: "${exampleLine.service_name}" billed at $${vs[0].actual.toFixed(2)}/unit vs contracted $${vs[0].expected.toFixed(2)}/unit. ` +
        `Aggregate ${dir} amount on this invoice: $${dollars.toFixed(2)}.`,
      recommended_action: overcharge
        ? `Dispute against contracted rate schedule in ${vs[0].rs.source_file}; demand corrected invoice.`
        : `Submit underpayment recovery request citing rate schedule in ${vs[0].rs.source_file}.`,
      dollar_impact: Math.round(dollars),
      affected_lines: lineRefs,
      source_file: vs[0].rs.source_file,
    });
  }

  // ── 2. Shadow fees (lines with no rate-schedule match) ──────────────────
  if (shadow.length > 0) {
    const dollars = shadow.reduce((s, li) => s + (typeof li.line_total === "number" ? li.line_total : 0), 0);
    const sev: ReconFinding["severity"] =
      dollars > 10_000 ? "critical" : dollars > 1_000 ? "high" : "medium";
    const lineRefs = shadow.map((li) => li.line_ref || li.service_code || li.service_name).slice(0, 50);
    out.push({
      finding_type: "shadow_fee",
      severity: sev,
      title: `${shadow.length} line item${shadow.length === 1 ? "" : "s"} not found in any contracted rate schedule`,
      detail:
        `These charges do not match anything in the available contract / fee schedule for ${opts.newDoc.vendor_name}. ` +
        `Examples: ${shadow.slice(0, 3).map((l) => `"${l.service_name}"`).join(", ")}. ` +
        `Aggregate billed: $${dollars.toFixed(2)}.`,
      recommended_action:
        `Request contractual basis for these charges in writing. If none exists, dispute as out-of-scope.`,
      dollar_impact: Math.round(dollars),
      affected_lines: lineRefs,
    });
  }

  // ── 3. Duplicate billing (same service_code within this invoice on same date) ──
  const dupMap = new Map<string, any[]>();
  for (const li of opts.newLines) {
    const key = `${normalize(li.service_code || li.service_name)}::${li.service_date || ""}`;
    if (!key.startsWith("::")) {
      const arr = dupMap.get(key) ?? [];
      arr.push(li);
      dupMap.set(key, arr);
    }
  }
  const dupGroups = [...dupMap.values()].filter((g) => g.length > 1);
  if (dupGroups.length > 0) {
    const dupLines = dupGroups.flat();
    const dollars = dupGroups.reduce((s, g) => {
      // Conservatively count extra occurrences as duplicates.
      const lineTotal = g[0].line_total || (g[0].unit_price ?? 0) * (g[0].quantity ?? 1);
      return s + lineTotal * (g.length - 1);
    }, 0);
    out.push({
      finding_type: "duplicate_billing",
      severity: dollars > 5_000 ? "high" : "medium",
      title: `Possible duplicate billing on ${dupGroups.length} service line${dupGroups.length === 1 ? "" : "s"}`,
      detail:
        `Same service code billed multiple times on the same date of service. ` +
        `Total potential duplicate exposure: $${dollars.toFixed(2)}.`,
      recommended_action: `Verify each repeat line represents a distinct encounter; recoup duplicates if not.`,
      dollar_impact: Math.round(dollars),
      affected_lines: dupLines.map((l) => l.line_ref || l.service_code || l.service_name).slice(0, 50),
    });
  }

  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const claims = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.data?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { documentId } = body || {};
    if (!documentId || typeof documentId !== "string") {
      return new Response(JSON.stringify({ error: "documentId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch the document and confirm ownership.
    const { data: doc, error: docErr } = await admin
      .from("vendor_watch_documents")
      .select("*")
      .eq("id", documentId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!doc.raw_text || doc.raw_text.trim().length < 30) {
      await admin.from("vendor_watch_documents").update({
        status: "failed",
        error_message: "No readable text extracted from the file. Try a text-based PDF or paste the content.",
      }).eq("id", documentId);
      return new Response(JSON.stringify({ error: "No readable text in document" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("vendor_watch_documents").update({ status: "analyzing", error_message: null }).eq("id", documentId);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    // Cap text length sent to the model (keep ~120k chars / ~30k tokens).
    const text = doc.raw_text.length > 120_000 ? doc.raw_text.slice(0, 120_000) + "\n…[truncated]" : doc.raw_text;

    // Fetch up to 20 other analyzed docs from this owner for cross-referencing.
    const { data: otherDocs } = await admin
      .from("vendor_watch_documents")
      .select("id, vendor_name, doc_type, file_name, analysis, created_at")
      .eq("owner_id", userId)
      .neq("id", documentId)
      .eq("status", "analyzed")
      .order("created_at", { ascending: false })
      .limit(20);

    const contextLines: string[] = [];
    for (const o of otherDocs ?? []) {
      const a: any = o.analysis ?? {};
      const kt = Array.isArray(a.key_terms)
        ? a.key_terms.slice(0, 12).map((t: any) => `${t.label}: ${t.value}`).join(" · ")
        : "";
      contextLines.push(
        `- id=${o.id} vendor="${o.vendor_name}" type=${o.doc_type} file="${o.file_name}"\n` +
        `    summary: ${(a.summary || "").slice(0, 400)}\n` +
        (kt ? `    key terms: ${kt}\n` : ""),
      );
    }

    const userMsg = [
      `Stated vendor (may be "Auto-detecting…"): ${doc.vendor_name}`,
      `Stated document type (may be "other" placeholder): ${doc.doc_type}`,
      `File: ${doc.file_name}`,
      "",
      contextLines.length
        ? `--- USER'S OTHER ANALYZED VENDOR DOCUMENTS (for cross-reference) ---\n${contextLines.join("")}`
        : "--- No other analyzed vendor documents on file ---",
      "",
      "--- DOCUMENT TEXT ---",
      text,
    ].join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_vendor_audit" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error", aiResp.status, errText);
      await admin.from("vendor_watch_documents").update({
        status: "failed",
        error_message: aiResp.status === 429 ? "Rate limit reached. Try again in a minute."
          : aiResp.status === 402 ? "AI credits exhausted. Add funds in workspace settings."
          : `AI gateway error (${aiResp.status})`,
      }).eq("id", documentId);
      return new Response(JSON.stringify({ error: "AI gateway error", status: aiResp.status }), {
        status: aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error("AI returned no structured report");
    }
    const report = JSON.parse(call.function.arguments);

    // Apply auto-detected vendor/doc type back to the row when present.
    const ALLOWED_TYPES = ["contract", "fee_schedule", "remit", "eob", "correspondence", "other"];
    const updates: Record<string, unknown> = {
      status: "analyzed",
      analysis: report,
      error_message: null,
    };
    const detectedVendor = typeof report.detected_vendor_name === "string"
      ? report.detected_vendor_name.trim()
      : "";
    if (detectedVendor && (doc.vendor_name === "Auto-detecting…" || !doc.vendor_name)) {
      updates.vendor_name = detectedVendor.slice(0, 120);
      updates.vendor_key = detectedVendor
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "unclassified";
    }
    const detectedType = report.detected_doc_type;
    if (detectedType && ALLOWED_TYPES.includes(detectedType) && doc.doc_type === "other") {
      updates.doc_type = detectedType;
    }

    // Persist analysis blob on the document.
    await admin.from("vendor_watch_documents").update(updates).eq("id", documentId);

    // Insert findings.
    const findings = Array.isArray(report.findings) ? report.findings : [];
    if (findings.length) {
      const rows = findings.map((f: any) => ({
        document_id: documentId,
        owner_id: userId,
        finding_type: String(f.finding_type || "other").slice(0, 80),
        severity: ["low", "medium", "high", "critical"].includes(f.severity) ? f.severity : "medium",
        title: String(f.title || "Finding").slice(0, 280),
        detail: f.detail ? String(f.detail) : null,
        recommended_action: f.recommended_action ? String(f.recommended_action) : null,
        dollar_impact: typeof f.dollar_impact === "number" ? f.dollar_impact : null,
      }));
      await admin.from("vendor_watch_findings").insert(rows);
    }

    // Insert cross-reference findings as their own rows so they show up in the findings list & CSV.
    const xrefs = Array.isArray(report.cross_references) ? report.cross_references : [];
    if (xrefs.length) {
      const xrefRows = xrefs.map((x: any) => {
        const rel = String(x.relationship || "other");
        const sev = ["low", "medium", "high", "critical"].includes(x.severity)
          ? x.severity
          : (rel === "rate_conflict" || rel === "contradicts" || rel === "timely_filing_conflict")
            ? "high"
            : "low";
        const titlePrefix = x.related_file_name ? `↔ ${x.related_file_name}: ` : "Cross-reference: ";
        return {
          document_id: documentId,
          owner_id: userId,
          finding_type: `xref_${rel}`.slice(0, 80),
          severity: sev,
          title: (titlePrefix + rel.replace(/_/g, " ")).slice(0, 280),
          detail: String(x.detail || ""),
          recommended_action: null,
          dollar_impact: typeof x.dollar_impact === "number" ? x.dollar_impact : null,
        };
      });
      await admin.from("vendor_watch_findings").insert(xrefRows);
    }

    return new Response(JSON.stringify({ ok: true, findings_count: findings.length, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vendor-watch-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});