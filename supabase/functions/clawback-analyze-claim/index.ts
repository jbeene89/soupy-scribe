// RAC Clawback Shield — per-claim defense analysis
// For one or more claims: pulls chart text (if available), runs adversarial defense
// reasoning via Lovable AI Gateway, persists result to clawback_claims.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a senior healthcare audit defense attorney with deep coding expertise (CCS, CPC).
You are reviewing a single claim contested by a Recovery Audit Contractor (RAC).
Your job: determine the strongest defensible position for this claim and quantify the defense strength.

Output JSON ONLY in this exact shape:
{
  "defense_strength": "full_defense" | "strong" | "partial" | "weak" | "conceded",
  "clinical_justification": "<2-4 sentence rationale citing what supports the original coding>",
  "defense_findings": [
    { "type": "supporting_evidence" | "rac_error" | "alternate_code" | "documentation_gap" | "regulatory_citation",
      "title": "<short title>",
      "detail": "<one sentence>" }
  ],
  "recommended_outcome": "<one of: defend in full, defend with alternate code, partial concession, concede>"
}

Calibration:
- full_defense: documentation clearly supports the billed code, RAC's finding is wrong on the merits.
- strong: documentation supports the code with minor ambiguity; RAC's finding is weak.
- partial: ~50/50; alternate lower-paying code may be appropriate but full disallowance unjustified.
- weak: documentation is thin; RAC has a point but extrapolation is still excessive.
- conceded: no defensible justification.

Be conservative. Do not invent documentation. If the chart is missing or empty, lean toward "weak" or "documentation_gap".`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { claimId, chartText } = await req.json();
    if (!claimId) return new Response(JSON.stringify({ error: "claimId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: claim, error: cErr } = await sb.from("clawback_claims").select("*").eq("id", claimId).single();
    if (cErr || !claim) throw cErr || new Error("Claim not found");

    const userPrompt = `CLAIM
- Number: ${claim.claim_number || "(unknown)"}
- DOS: ${claim.date_of_service || "(unknown)"}
- Billed: $${claim.billed_amount || 0}
- RAC disallowed: $${claim.rac_disallowed_amount || 0}
- CPT: ${(claim.cpt_codes || []).join(", ") || "(none)"}
- ICD: ${(claim.icd_codes || []).join(", ") || "(none)"}
- RAC finding code: ${claim.rac_finding_code || "(none)"}
- RAC finding text: ${claim.rac_finding_text || "(none)"}

CHART DOCUMENTATION
${chartText && chartText.trim().length > 0 ? chartText.slice(0, 18000) : "(No chart documentation provided.)"}

Produce the JSON defense assessment.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${t}`);
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const strength = ["full_defense","strong","partial","weak","conceded"].includes(parsed.defense_strength) ? parsed.defense_strength : "weak";
    const update = {
      defense_strength: strength,
      defense_status: "analyzed",
      clinical_justification: parsed.clinical_justification || "",
      defense_findings: parsed.defense_findings || [],
      recommended_outcome: parsed.recommended_outcome || "",
    };
    const { error: uErr } = await sb.from("clawback_claims").update(update).eq("id", claimId);
    if (uErr) throw uErr;

    return new Response(JSON.stringify({ success: true, claimId, ...update }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clawback-analyze-claim error", e);
    return new Response(JSON.stringify({ error: e?.message || "Analyze failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});