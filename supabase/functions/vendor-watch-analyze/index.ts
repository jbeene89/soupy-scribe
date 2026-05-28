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
or vendor correspondence) AND a brief context list of the user's OTHER previously-analyzed
vendor documents. You must:
 1. Auto-classify the document (detected_doc_type) and pull the real vendor / payer name
    from the document text (detected_vendor_name) — the user often does not know the
    correct label.
 2. Extract structured intelligence the revenue-cycle team can act on.
 3. CROSS-REFERENCE the new document against the supplied context list. If a contract
    states a fee-schedule basis and a remit shows a different paid amount, flag it. If a
    new amendment supersedes an older contract, note it. If a fee schedule and remit agree,
    say so (relationship: "matches"). Always include related_file_name when citing another
    doc.

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
        findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              finding_type: {
                type: "string",
                description: "e.g. underpayment, unfavorable_clause, denial_pattern, missing_clause, timely_filing, recoupment, fee_variance",
              },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              title: { type: "string" },
              detail: { type: "string" },
              recommended_action: { type: "string" },
              dollar_impact: { type: "number", description: "Annualized or per-incident dollars at risk. 0 if unknown." },
              quoted_language: { type: "string", description: "Exact text from the doc if applicable." },
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