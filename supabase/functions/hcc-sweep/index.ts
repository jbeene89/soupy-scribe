// HCC / VBC Leak Detector — compares historical problem list vs current encounter
// note. Flags "Dropped HCC Suspects" using an AI adversarial sweep, recomputes
// estimated RAF impact, and persists a sweep + suspects rows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a senior HCC / Risk Adjustment auditor for a Medicare Advantage plan.
You are given a patient's HISTORICAL PROBLEM LIST (with dates and prior HCC mappings)
and the CURRENT ENCOUNTER NOTE for the same patient.

Your job: identify HCC conditions that were documented historically but are NOT
adequately documented in the current encounter (a "dropped HCC"), per CMS's MEAT
(Monitor / Evaluate / Assess / Treat) standard. Each HCC must be re-documented
annually with active management evidence.

Output JSON ONLY:
{
  "suspects": [
    {
      "hcc_code": "<CMS-HCC v24/v28 code if known, else null>",
      "hcc_label": "<short condition label>",
      "icd_code": "<best ICD-10 code or null>",
      "raf_weight": <number, CMS-HCC RAF weight estimate, 0..3>,
      "status": "dropped" | "possible" | "documented",
      "confidence": "high" | "medium" | "low",
      "evidence_snippet": "<exact quote from current note that confirms or contradicts; '' if absent>",
      "recapture_recommendation": "<specific action: e.g. 'Add active assessment + plan for morbid obesity'>"
    }
  ],
  "summary": "<one-paragraph clinician-facing summary>"
}

Calibration:
- "dropped": condition appears historically and there is NO active assessment / plan / management in the current note.
- "possible": indirect mention (e.g. medication implies condition) but no MEAT documentation.
- "documented": MEAT criteria met in current note — do not flag, but include for completeness only if asked.

Be precise. Do not invent codes. Use conservative RAF weights (CMS-HCC v24 is typical).`;

// Default RAF weight fallback if model omits it
const DEFAULT_WEIGHTS: Record<string, number> = {
  "morbid obesity": 0.273,
  "diabetes with complications": 0.302,
  "diabetes without complications": 0.105,
  "chf": 0.331,
  "ckd stage 3": 0.069,
  "ckd stage 4": 0.289,
  "copd": 0.335,
  "major depression": 0.309,
  "vascular disease": 0.288,
};

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
      patient_ref,
      payer = null,
      plan_year = new Date().getFullYear(),
      historical_problem_list = [],
      current_encounter_text = "",
      benchmark_per_raf = 10000,
      notes = null,
    } = body || {};

    if (!patient_ref || !current_encounter_text) {
      return new Response(JSON.stringify({ error: "patient_ref and current_encounter_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `HISTORICAL PROBLEM LIST (JSON):
${JSON.stringify(historical_problem_list, null, 2)}

CURRENT ENCOUNTER NOTE:
${String(current_encounter_text).slice(0, 200000)}

Identify dropped HCC suspects. Return JSON only.`;

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
    const suspects: any[] = Array.isArray(parsed.suspects) ? parsed.suspects : [];

    // Normalize + compute baseline/current RAF + impact
    let baselineRaf = 0;
    let currentRaf = 0;
    const enriched = suspects.map((s) => {
      const label = String(s.hcc_label || "").trim();
      const wRaw = Number(s.raf_weight);
      const w = Number.isFinite(wRaw) && wRaw > 0
        ? wRaw
        : DEFAULT_WEIGHTS[label.toLowerCase()] ?? 0.2;
      const status = ["dropped","possible","documented"].includes(s.status) ? s.status : "dropped";
      const dollar = +(w * Number(benchmark_per_raf || 10000)).toFixed(2);
      // baseline always counts the historical condition; current only counts if documented
      baselineRaf += w;
      if (status === "documented") currentRaf += w;
      return {
        hcc_code: s.hcc_code || null,
        hcc_label: label || "Unspecified",
        icd_code: s.icd_code || null,
        raf_weight: +w.toFixed(3),
        status,
        confidence: ["high","medium","low"].includes(s.confidence) ? s.confidence : "medium",
        evidence_snippet: s.evidence_snippet || "",
        recapture_recommendation: s.recapture_recommendation || "",
        estimated_dollar_impact: dollar,
      };
    });
    const rafDelta = +(baselineRaf - currentRaf).toFixed(3);
    const revenueImpact = +(rafDelta * Number(benchmark_per_raf || 10000)).toFixed(2);

    // Persist sweep
    const { data: sweep, error: sErr } = await sb.from("hcc_sweeps").insert({
      user_id: user.id,
      patient_ref,
      payer,
      plan_year,
      baseline_raf: +baselineRaf.toFixed(3),
      current_raf: +currentRaf.toFixed(3),
      raf_delta: rafDelta,
      estimated_revenue_impact: revenueImpact,
      benchmark_per_raf,
      historical_problem_list,
      current_encounter_text,
      status: "analyzed",
      notes,
      metadata: { summary: parsed.summary || "" },
    }).select("*").single();
    if (sErr) throw sErr;

    // Persist suspects
    if (enriched.length) {
      const rows = enriched.map((e) => ({
        sweep_id: sweep.id,
        user_id: user.id,
        ...e,
      }));
      const { error: suspErr } = await sb.from("hcc_suspects").insert(rows);
      if (suspErr) throw suspErr;
    }

    return new Response(JSON.stringify({
      success: true,
      sweep,
      suspects: enriched,
      summary: parsed.summary || "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("hcc-sweep error", e);
    return new Response(JSON.stringify({ error: e?.message || "Sweep failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});