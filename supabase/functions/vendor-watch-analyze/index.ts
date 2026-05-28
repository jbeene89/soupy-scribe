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
or vendor correspondence) and must extract structured intelligence the revenue-cycle team
can act on.

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
impact — only estimate when the document supports it.`;

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
        confidence: { type: "number", description: "0-1 — how confident the analyzer is in the extraction." },
      },
      required: ["summary", "document_kind", "findings", "confidence"],
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

    const userMsg = [
      `Vendor: ${doc.vendor_name}`,
      `Stated document type: ${doc.doc_type}`,
      `File: ${doc.file_name}`,
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

    // Persist analysis blob on the document.
    await admin.from("vendor_watch_documents").update({
      status: "analyzed",
      analysis: report,
      error_message: null,
    }).eq("id", documentId);

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