// Imaging Audit — AI vision analysis for clinical images (X-rays, intra-op photos).
// Uses the Lovable AI Gateway with a multimodal model and tool-calling for
// strict structured output. Requires an authenticated caller.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

const SYSTEM_PROMPT = `You are a clinical-imaging audit assistant for an orthopedic / surgical practice.
You receive a single clinical image (typically a post-op X-ray, intra-op photo, or fluoro snapshot) plus
context about the procedure that was billed.

Your job is to flag DEFENSIBILITY and OPERATIONAL issues a coder, surgeon, or compliance reviewer would
want to know BEFORE the claim is submitted or the patient leaves recovery. You are NOT a radiologist
and you do NOT make diagnoses. You describe what is visible and whether it MATCHES the billed procedure.

Focus on:
 - Implant count (e.g. "billed bilateral TKA, only ONE knee implant visible").
 - Hardware type vs billed implant (cage vs plate, screws count, stem vs resurfacing).
 - Side of body (left vs right) vs claim laterality.
 - Obvious positioning, alignment, or retained-foreign-body concerns that would block billing.
 - Documentation gaps the image suggests (e.g. missing post-op view, no marker visible).

Be concise, specific, and conservative. If you are unsure, say so and lower your confidence — never fabricate
findings. Severity scale: low = informational, medium = should be reviewed, high = likely blocks clean billing,
critical = patient-safety or fraud-risk concern.`;

const tool = {
  type: "function",
  function: {
    name: "report_imaging_audit",
    description: "Return a structured imaging-audit report.",
    parameters: {
      type: "object",
      properties: {
        ai_summary: { type: "string", description: "One-sentence headline finding." },
        body_region: { type: "string", description: "knee, hip, shoulder, spine, foot, hand, other" },
        detected_implant_count: { type: "integer", minimum: 0 },
        ai_confidence: { type: "integer", minimum: 0, maximum: 100 },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        ai_findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              detail: { type: "string" },
              matches_billing: { type: "boolean" },
            },
            required: ["label", "severity", "detail"],
            additionalProperties: false,
          },
        },
      },
      required: ["ai_summary", "ai_findings", "ai_confidence", "severity", "detected_implant_count"],
      additionalProperties: false,
    },
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResp = await requireAuth(req);
  if (authResp) return authResp;

  try {
    const body = await req.json();
    const {
      imageDataUrl,
      procedureLabel,
      bodyRegion,
      expectedImplantCount,
      cptCodes,
      physicianName,
      patientId,
    } = body || {};

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return new Response(JSON.stringify({ error: "imageDataUrl required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const userText = [
      `Procedure billed: ${procedureLabel || "unspecified"}`,
      bodyRegion ? `Body region: ${bodyRegion}` : null,
      expectedImplantCount != null ? `Expected implants per the claim: ${expectedImplantCount}` : null,
      Array.isArray(cptCodes) && cptCodes.length ? `CPT codes: ${cptCodes.join(", ")}` : null,
      physicianName ? `Surgeon: ${physicianName}` : null,
      patientId ? `Patient: ${patientId}` : null,
      "",
      "Audit this image against what was billed and return the structured report.",
    ].filter(Boolean).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_imaging_audit" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      throw new Error("AI returned no structured report");
    }
    const report = JSON.parse(call.function.arguments);

    // Estimate operational loss: implant mismatch is the big one, then severity.
    const implantMismatch =
      typeof expectedImplantCount === "number" &&
      typeof report.detected_implant_count === "number" &&
      report.detected_implant_count < expectedImplantCount;
    let estimated_loss = 0;
    if (implantMismatch) {
      const missing = expectedImplantCount - report.detected_implant_count;
      estimated_loss += missing * 4500; // avg implant + denial-rework cost
    }
    const sevLoss: Record<string, number> = { low: 0, medium: 350, high: 1400, critical: 4200 };
    estimated_loss += sevLoss[report.severity] ?? 0;

    return new Response(JSON.stringify({ report: { ...report, estimated_loss, implant_mismatch: implantMismatch } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("imaging-analyze error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});