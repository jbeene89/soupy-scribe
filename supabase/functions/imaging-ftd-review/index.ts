// Imaging FTD (Failure-to-Diagnose) Second-Opinion Review.
// A separate, adversarial vision pass over an existing imaging finding,
// looking ONLY for things the first read might have missed. This is a
// screening aid — it never produces a diagnosis and the disclaimer is
// embedded in every response.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DISCLAIMER =
  "AI screening aid only. NOT a medical diagnosis. Findings flagged here are possibilities for a licensed clinician to confirm or rule out — do not act on them without independent review. Absence of findings does not rule out disease.";

const SYSTEM_PROMPT = `You are a SECOND-OPINION reviewer for a clinical imaging audit platform. Your only job is to look for findings the FIRST read may have MISSED — a "failure-to-diagnose" screen.

You are NOT a radiologist. You do NOT make diagnoses. You only flag possibilities that a licensed clinician should confirm or rule out.

Look specifically for things commonly missed on first pass:
 - Subtle/non-displaced fractures, hairline cracks, cortical step-offs.
 - Secondary lesions outside the area the surgeon was focused on (e.g. lung nodule on a shoulder X-ray, lytic lesion adjacent to the implant bed).
 - Retained foreign bodies (gauze, broken instrument tips, drill bits).
 - Hardware issues: loosening lucency, screw backing-out, malposition, periprosthetic fracture.
 - Soft-tissue findings: significant effusion/hematoma, subcutaneous gas, gross asymmetry.
 - Wrong-site / wrong-side concerns relative to the stated procedure.
 - Missing standard views or cropping that hides anatomy.

Be conservative. If you see nothing concerning, say so plainly with high confidence and an empty findings list. Do NOT invent findings. Every flagged item MUST include "recommend_human_review": true.

Severity scale: low = informational note, medium = clinician should look, high = clinician should look promptly, critical = potential patient-safety concern requiring immediate clinician attention.`;

const tool = {
  type: "function",
  function: {
    name: "report_ftd_review",
    description: "Return a structured failure-to-diagnose second-opinion screening report.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-sentence overall impression of the second-opinion screen." },
        confidence: { type: "integer", minimum: 0, maximum: 100, description: "How confident you are in this second-opinion assessment." },
        possible_missed_findings: {
          type: "array",
          description: "Findings the first read may have missed. Empty array if none.",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
              detail: { type: "string", description: "What you see and why it could matter — phrased as a possibility, not a diagnosis." },
              region: { type: "string", description: "Anatomic region or quadrant of the image." },
              recommend_human_review: { type: "boolean", description: "MUST be true for every flagged item." },
            },
            required: ["label", "severity", "detail", "recommend_human_review"],
            additionalProperties: false,
          },
        },
      },
      required: ["summary", "confidence", "possible_missed_findings"],
      additionalProperties: false,
    },
  },
} as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { findingId } = await req.json();
    if (!findingId) {
      return new Response(JSON.stringify({ error: "findingId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the finding via the user's client (RLS enforces ownership/org access).
    const { data: finding, error: findErr } = await userClient
      .from("imaging_findings")
      .select("id, image_storage_path, image_mime_type, procedure_label, body_region, ai_summary, ai_findings, expected_implant_count, detected_implant_count")
      .eq("id", findingId)
      .single();
    if (findErr || !finding) {
      return new Response(JSON.stringify({ error: "Finding not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!finding.image_storage_path) {
      return new Response(JSON.stringify({ error: "Finding has no stored image to review" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull the image bytes via the service-role client (bucket is private).
    const adminClient = createClient(supabaseUrl, supabaseService);
    const { data: blob, error: dlErr } = await adminClient.storage
      .from("case-files")
      .download(finding.image_storage_path);
    if (dlErr || !blob) {
      return new Response(JSON.stringify({ error: `Could not load stored image: ${dlErr?.message ?? "unknown"}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const buf = new Uint8Array(await blob.arrayBuffer());
    // Base64-encode in chunks to avoid call-stack issues on large files.
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    const mime = finding.image_mime_type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const firstReadSummary =
      `First read summary: ${finding.ai_summary ?? "(none)"}\n` +
      `First read flagged ${Array.isArray(finding.ai_findings) ? finding.ai_findings.length : 0} item(s).\n` +
      `Procedure context: ${finding.procedure_label ?? "unspecified"} (${finding.body_region ?? "region n/a"}).`;

    const userText = [
      firstReadSummary,
      "",
      "Run a SECOND-OPINION screen looking ONLY for things the first read might have MISSED.",
      "Do not repeat findings the first read already captured. Be conservative — empty findings is a valid answer.",
    ].join("\n");

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
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_ftd_review" } },
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
    if (!call?.function?.arguments) throw new Error("AI returned no structured report");
    const report = JSON.parse(call.function.arguments);

    const ftd_review = {
      ...report,
      disclaimer: DISCLAIMER,
      reviewed_at: new Date().toISOString(),
      model: "google/gemini-2.5-pro",
    };

    // Persist via user client (RLS check applies).
    const { error: updErr } = await userClient
      .from("imaging_findings")
      .update({ ftd_review })
      .eq("id", findingId);
    if (updErr) {
      console.error("Failed to persist ftd_review", updErr);
      return new Response(JSON.stringify({ error: `Persist failed: ${updErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ftd_review }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("imaging-ftd-review error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});