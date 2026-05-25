// Payer Policy "Time Machine" — DOS-aware policy version mismatch detector.
// Cross-references the cited (current) policy text against the policy version
// active on the actual Date of Service to flag temporal mismatches.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a senior denials & appeals analyst specializing in PAYER POLICY TIMELINE auditing.
You are given a denied/contested claim's Date of Service (DOS) and TWO versions of the relevant payer
medical policy (LCD/NCD or commercial):
  (A) the policy version the payer CITED in the denial — usually the current version, and
  (B) the policy version that was ACTIVE on the DOS — what the provider was lawfully held to.

A "Policy Date Mismatch" exists when the payer applied a stricter, newer policy retroactively to a
claim whose DOS predates that version's effective date. This is regulatorily impermissible for most
CMS LCD/NCD applications and contractually defective for commercial policies.

Output JSON ONLY:
{
  "mismatch": true | false,
  "severity": "high" | "medium" | "low",
  "active_policy_version": "<version label or 'unknown'>",
  "active_policy_date": "<YYYY-MM-DD or null>",
  "diff_summary": "<2-4 sentences summarizing the substantive difference between cited vs active version that hurts the provider>",
  "recommendation": "<concrete appeal language citing temporal application doctrine>",
  "citations": [
    { "label": "<short>", "source": "CMS IOM | LCD | NCD | commercial policy | regulation", "detail": "<quote or pinpoint>" }
  ]
}

Calibration:
- high: cited version's effective date is AFTER the DOS AND the version materially tightens criteria.
- medium: minor wording change but criteria substantively the same; flag but de-emphasize.
- low: cited version is the same or older than DOS-active version; no temporal defect.

Be strict. Do not invent effective dates. If unknown, say so and lower severity.`;

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

    const body = await req.json();
    const {
      case_id = null,
      payer = null,
      policy_id,
      policy_type = "commercial",
      date_of_service,
      cited_policy_version = null,
      cited_policy_date = null,
      cited_policy_text = "",
      active_policy_text = "",
      active_policy_version = null,
      active_policy_date = null,
    } = body || {};

    if (!policy_id || !date_of_service || !cited_policy_text) {
      return new Response(JSON.stringify({ error: "policy_id, date_of_service, and cited_policy_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `CASE
- Payer: ${payer || "(unknown)"}
- Policy ID: ${policy_id}
- Policy type: ${policy_type}
- Date of Service (DOS): ${date_of_service}
- Cited policy version: ${cited_policy_version || "(unknown)"} ${cited_policy_date ? `(eff ${cited_policy_date})` : ""}
- Active-on-DOS version: ${active_policy_version || "(unknown / for you to infer from text)"} ${active_policy_date ? `(eff ${active_policy_date})` : ""}

CITED POLICY TEXT (what payer applied):
${String(cited_policy_text).slice(0, 120000)}

ACTIVE-ON-DOS POLICY TEXT (what was in force at DOS):
${active_policy_text ? String(active_policy_text).slice(0, 120000) : "(NOT PROVIDED — assess based on cited text and your knowledge of typical policy versioning; lower severity if unable to verify.)"}

Produce the JSON timeline assessment.`;

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

    const severity = ["high","medium","low"].includes(parsed.severity) ? parsed.severity : "low";
    const mismatch = Boolean(parsed.mismatch);

    const row = {
      user_id: user.id,
      case_id,
      payer,
      policy_id,
      policy_type,
      cited_policy_version,
      cited_policy_date,
      date_of_service,
      active_policy_version: parsed.active_policy_version || active_policy_version || null,
      active_policy_date: parsed.active_policy_date || active_policy_date || null,
      mismatch,
      severity,
      cited_policy_excerpt: String(cited_policy_text).slice(0, 4000),
      active_policy_excerpt: String(active_policy_text || "").slice(0, 4000) || null,
      diff_summary: parsed.diff_summary || "",
      recommendation: parsed.recommendation || "",
      citations: parsed.citations || [],
      metadata: {},
    };

    const { data: saved, error: insErr } = await sb.from("policy_timeline_checks").insert(row).select("*").single();
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, check: saved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("policy-time-machine error", e);
    return new Response(JSON.stringify({ error: e?.message || "Timeline check failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});