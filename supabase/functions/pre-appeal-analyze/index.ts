import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { prepareLongContext } from "../_shared/longContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRE_APPEAL_PROMPT = `You are a pre-appeal resolution specialist for healthcare claims. You analyze denied or flagged claims to determine whether the denial can be resolved through targeted documentation, coding clarification, or administrative correction — WITHOUT a formal appeal.

Your role:
1. Assess CURABILITY — can this denial be resolved with specific records, coding corrections, or clarifications?
2. Classify each issue by category (missing documentation, coding clarification, modifier support, medical necessity, timeline mismatch, documentation contradiction, administrative correction)
3. Determine resolution likelihood and confidence
4. Build a rapid resolution evidence checklist with priorities
5. Generate separate provider and payer summaries

Use precise, operational language. Be honest about cases that require formal appeal or are not supportable.`;

async function authenticateRequest(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabaseAuth.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: user.id };
}

async function callAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string, tools: any[], toolChoice: any) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], tools, tool_choice: toolChoice }),
  });
  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits in Settings." };
    throw new Error(`AI call failed: ${status}`);
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No result from AI");
  return JSON.parse(toolCall.function.arguments);
}

const preAppealToolSchema = {
  type: "function",
  function: {
    name: "submit_pre_appeal_resolution",
    description: "Submit pre-appeal resolution analysis",
    parameters: {
      type: "object",
      properties: {
        denialReason: { type: "string", description: "The denial/rejection reason" },
        curability: {
          type: "string",
          enum: ["curable-with-records", "curable-with-coding", "partial-resolution", "structurally-weak", "formal-appeal-appropriate", "not-likely-supportable"],
        },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              category: { type: "string", enum: ["missing-documentation", "documentation-contradiction", "coding-clarification", "modifier-support", "medical-necessity", "timeline-mismatch", "likely-non-curable", "likely-formal-appeal", "administrative-correction"] },
              title: { type: "string" },
              description: { type: "string" },
              isCurable: { type: "boolean" },
              clarificationNeeded: { type: "string" },
              supportingEvidence: { type: "array", items: { type: "string" } },
            },
            required: ["id", "category", "title", "description", "isCurable", "clarificationNeeded", "supportingEvidence"],
            additionalProperties: false,
          },
        },
        resolution: {
          type: "object",
          properties: {
            likelihood: { type: "string", enum: ["likely-resolvable-clarification", "likely-resolvable-records", "partially-resolvable", "weak-candidate", "requires-formal-appeal", "not-supportable"] },
            confidence: { type: "number" },
            whatIsMissing: { type: "array", items: { type: "string" } },
            whatWouldChangeResult: { type: "array", items: { type: "string" } },
          },
          required: ["likelihood", "confidence", "whatIsMissing", "whatWouldChangeResult"],
          additionalProperties: false,
        },
        evidenceChecklist: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              record: { type: "string" },
              priority: { type: "string", enum: ["required", "helpful", "unlikely-to-change-outcome"] },
              whyItMatters: { type: "string" },
              linkedIssueCategory: { type: "string" },
              supportsQuickReconsideration: { type: "boolean" },
              absencePushesToAppeal: { type: "boolean" },
            },
            required: ["id", "record", "priority", "whyItMatters", "linkedIssueCategory", "supportsQuickReconsideration", "absencePushesToAppeal"],
            additionalProperties: false,
          },
        },
        recommendedDisposition: { type: "string", enum: ["submit-pre-appeal", "gather-more-records", "correct-and-resubmit", "pursue-formal-appeal", "do-not-pursue", "escalate-internally"] },
        providerSummary: {
          type: "object",
          properties: {
            whyResolvableQuickly: { type: "string" },
            exactlyNeeded: { type: "array", items: { type: "string" } },
            doNotWasteTimeOn: { type: "array", items: { type: "string" } },
            appearsCurable: { type: "boolean" },
            fullAppealPoorUse: { type: "boolean" },
          },
          required: ["whyResolvableQuickly", "exactlyNeeded", "doNotWasteTimeOn", "appearsCurable", "fullAppealPoorUse"],
          additionalProperties: false,
        },
        payerSummary: {
          type: "object",
          properties: {
            issueAppearsCurable: { type: "boolean" },
            clarificationNeeded: { type: "array", items: { type: "string" } },
            partialReversalPossible: { type: "boolean" },
            denialStandsWithoutSupport: { type: "boolean" },
            moveToStandardAppeal: { type: "boolean" },
          },
          required: ["issueAppearsCurable", "clarificationNeeded", "partialReversalPossible", "denialStandsWithoutSupport", "moveToStandardAppeal"],
          additionalProperties: false,
        },
      },
      required: ["denialReason", "curability", "issues", "resolution", "evidenceChecklist", "recommendedDisposition", "providerSummary", "payerSummary"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authResult = await authenticateRequest(req, supabaseUrl, supabaseAnonKey);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { caseId } = await req.json();

    if (!caseId) {
      return new Response(JSON.stringify({ error: "caseId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: auditCase, error: caseErr } = await supabase
      .from("audit_cases").select("*").eq("id", caseId).single();

    if (caseErr || !auditCase) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (auditCase.owner_id && auditCase.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing analyses for context
    const { data: analyses } = await supabase
      .from("case_analyses").select("*").eq("case_id", caseId);

    // Fetch contradictions and evidence sufficiency if available
    const { data: contradictions } = await supabase
      .from("contradictions").select("*").eq("case_id", caseId);
    const { data: evidenceSuff } = await supabase
      .from("evidence_sufficiency").select("*").eq("case_id", caseId).limit(1).maybeSingle();
    const { data: actionPath } = await supabase
      .from("action_pathways").select("*").eq("case_id", caseId).limit(1).maybeSingle();

    const metadata = auditCase.metadata as any;
    const summary = metadata?.summary || "Not available";

    const roleInsights = (analyses || [])
      .filter((a: any) => a.status === "complete")
      .map((a: any) => `${a.role.toUpperCase()} (${a.model}): Confidence ${a.confidence}% — ${a.overall_assessment}`)
      .join("\n");

    const contradictionsSummary = (contradictions || []).length > 0
      ? `Contradictions detected (${contradictions!.length}): ${contradictions!.map((c: any) => `${c.contradiction_type}: ${c.description} [${c.severity}]`).join("; ")}`
      : "No contradictions detected";

    const evidenceSummary = evidenceSuff
      ? `Evidence sufficiency: ${evidenceSuff.overall_score}% | Defensible: ${evidenceSuff.is_defensible} | Missing: ${JSON.stringify(evidenceSuff.missing_evidence)}`
      : "No evidence sufficiency data";

    const actionSummary = actionPath
      ? `Engine recommendation: ${actionPath.recommended_action} — ${actionPath.action_rationale}`
      : "No action pathway data";

    const caseContext = `
Case: ${auditCase.case_number}
CPT Codes: ${auditCase.cpt_codes.join(", ")}
ICD-10 Codes: ${auditCase.icd_codes.join(", ")}
Claim Amount: $${auditCase.claim_amount}
Date of Service: ${auditCase.date_of_service}
Physician: ${auditCase.physician_name}
Clinical Summary: ${summary}
Status: ${auditCase.status}
Consensus Score: ${auditCase.consensus_score || "N/A"}
Risk Score: ${(auditCase.risk_score as any)?.score || "N/A"}

SOUPY Analysis Results:
${roleInsights || "No analysis available"}

${contradictionsSummary}
${evidenceSummary}
${actionSummary}

Source Documentation: ${auditCase.source_text ? (await prepareLongContext(auditCase.source_text, LOVABLE_API_KEY)).prepared : "Not available"}

Based on all of the above, analyze this case for pre-appeal resolution potential. Determine whether the denial/flag can be resolved without a formal appeal, what specific records or corrections would resolve it, and provide actionable guidance for both the provider and payer sides.`;

    console.log(`Pre-appeal analysis for case ${caseId}...`);

    const resolution = await callAI(
      LOVABLE_API_KEY,
      "google/gemini-2.5-flash",
      PRE_APPEAL_PROMPT,
      caseContext,
      [preAppealToolSchema],
      { type: "function", function: { name: "submit_pre_appeal_resolution" } }
    );

    // Add caseId to resolution
    resolution.caseId = auditCase.case_number;

    // Store in metadata
    await supabase.from("audit_cases").update({
      metadata: {
        ...(metadata || {}),
        preAppealResolution: resolution,
      },
    }).eq("id", caseId);

    console.log(`Pre-appeal analysis complete: ${resolution.curability} — ${resolution.recommendedDisposition}`);

    return new Response(JSON.stringify({ success: true, resolution }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("pre-appeal-analyze error:", e);
    const status = e?.status || 500;
    return new Response(JSON.stringify({ error: e?.message || "An internal error occurred." }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
