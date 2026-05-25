// Recovery Engine — orchestrates multiple revenue-leak "lenses" (HCC, CDI,
// Counterfactual, Contract, Modifier, Bundling, Clawback exposure, Policy
// Time Machine, Supply waste) in parallel against a single encounter, then
// dedupes + ranks the findings by recoverable $.
//
// V1 ships with internal AI-driven lenses called via Lovable AI Gateway,
// so it can run standalone on any uploaded encounter text. Existing lens
// edge functions stay untouched and remain available as their own modules.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type LensId =
  | "hcc"
  | "cdi"
  | "counterfactual"
  | "modifier"
  | "bundling"
  | "contract"
  | "clawback_exposure"
  | "policy_time"
  | "supply";

const LENS_CATEGORY: Record<LensId, string> = {
  hcc: "pre-bill",
  cdi: "pre-bill",
  counterfactual: "pre-bill",
  modifier: "pre-bill",
  bundling: "pre-bill",
  contract: "bill-vs-contract",
  clawback_exposure: "post-pay",
  policy_time: "post-pay",
  supply: "operational",
};

const LENS_PROMPTS: Record<LensId, { label: string; system: string }> = {
  hcc: {
    label: "HCC / RAF",
    system:
      "You are a senior CMS-HCC risk-adjustment auditor. Identify chronic conditions in the encounter that are HCC-mappable but missing MEAT (Monitor/Evaluate/Assess/Treat) documentation, or HCCs that should be re-captured. For each, estimate RAF weight and a dollar impact assuming $10,000 per RAF point. Return JSON only.",
  },
  cdi: {
    label: "CDI / Documentation Debt",
    system:
      "You are a senior CDI specialist. Identify diagnoses that are under-specified, missing CC/MCC severity, missing acuity qualifiers, or lacking linkage that would change DRG. Estimate dollar uplift per finding using typical DRG weight deltas. Return JSON only.",
  },
  counterfactual: {
    label: "Counterfactual Coding",
    system:
      "You are a coding optimization auditor. Find ICD-10 or CPT codes that, if swapped for a better-supported alternative present in the chart, would increase reimbursement without overcoding. Estimate dollar delta per swap. Return JSON only.",
  },
  modifier: {
    label: "Modifier Capture",
    system:
      "You are a CPT modifier auditor. Identify missed modifiers (-22, -25, -59, -PT, -XS/-XU, -50, -78, -79) supported by the documentation. Estimate dollar uplift. Return JSON only.",
  },
  bundling: {
    label: "Bundling / Unbundling",
    system:
      "You are an NCCI edit auditor. Identify services improperly bundled OR unbundled vs current NCCI/MUE policy that affect payment. Estimate dollar impact. Return JSON only.",
  },
  contract: {
    label: "Contract Leakage",
    system:
      "You are a managed-care contract analyst. Identify potential underpayment risk: services likely paid below fee schedule, missing carve-outs, stop-loss thresholds, or implant pass-through. Estimate dollar leakage. Return JSON only.",
  },
  clawback_exposure: {
    label: "Clawback Exposure",
    system:
      "You are a RAC/payer-audit defender. Identify documentation gaps that put existing reimbursement at risk of takeback or extrapolation. Estimate dollars-at-risk (negative recovery). Return JSON only.",
  },
  policy_time: {
    label: "Policy Time Machine",
    system:
      "You are a payer policy timeline analyst. Identify any payer policy criteria that may have been applied retroactively or that pre-date the DOS, creating appeal grounds. Estimate dollars recoverable. Return JSON only.",
  },
  supply: {
    label: "Supply / Implant Capture",
    system:
      "You are an OR/charge-capture auditor. Identify implants, devices, or high-cost supplies referenced in the documentation that are commonly missed on the claim. Estimate dollar uplift. Return JSON only.",
  },
};

const FINDING_SCHEMA = `Return JSON: {
  "findings": [
    {
      "title": "<short headline>",
      "description": "<1-3 sentences>",
      "evidence_snippet": "<short quote from the encounter or empty>",
      "code": "<ICD-10 / CPT / HCC / contract term, or empty>",
      "confidence": "high" | "medium" | "low",
      "dollars_at_risk": <number, dollars currently exposed>,
      "dollars_recoverable": <number, dollars recoverable if action taken>,
      "recommended_action": "<concrete next step>"
    }
  ]
}
Be conservative. If nothing applies, return {"findings": []}.`;

async function runLens(
  lens: LensId,
  encounterText: string,
  payer: string | null,
  dos: string | null,
  apiKey: string,
): Promise<any[]> {
  const cfg = LENS_PROMPTS[lens];
  const userPrompt = `PAYER: ${payer || "(unknown)"}
DATE OF SERVICE: ${dos || "(unknown)"}

ENCOUNTER / CHART TEXT:
${encounterText.slice(0, 60000)}

${FINDING_SCHEMA}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: cfg.system },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${lens} lens failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { parsed = {}; }
  return Array.isArray(parsed.findings) ? parsed.findings : [];
}

function normalize(s: any): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 64);
}

/**
 * Cluster findings that point to the same root issue (same code or fuzzy title)
 * across lenses. Within a cluster, keep the max dollar amount as primary so we
 * don't double-count. Other rows stay visible but flagged is_primary_in_cluster=false.
 */
function clusterFindings(rows: any[]): any[] {
  const clusters = new Map<string, any[]>();
  for (const r of rows) {
    const key = r.code
      ? `code:${normalize(r.code)}`
      : `title:${normalize(r.title)}`;
    r.dedup_cluster_key = key;
    const arr = clusters.get(key) || [];
    arr.push(r);
    clusters.set(key, arr);
  }
  const out: any[] = [];
  for (const arr of clusters.values()) {
    arr.sort((a, b) => Number(b.dollars_recoverable || 0) - Number(a.dollars_recoverable || 0));
    arr.forEach((r, i) => { r.is_primary_in_cluster = i === 0; });
    out.push(...arr);
  }
  return out;
}

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
      encounter_text = "",
      patient_ref = null,
      payer = null,
      date_of_service = null,
      lenses = ["hcc","cdi","counterfactual","modifier","bundling","contract","clawback_exposure","policy_time","supply"] as LensId[],
      notes = null,
    } = body || {};

    if (!encounter_text || String(encounter_text).trim().length < 40) {
      return new Response(JSON.stringify({ error: "encounter_text required (min 40 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Create run row
    const { data: run, error: runErr } = await sb.from("recovery_runs").insert({
      user_id: user.id,
      patient_ref,
      payer,
      date_of_service,
      encounter_excerpt: String(encounter_text).slice(0, 4000),
      lenses_run: lenses,
      status: "running",
      notes,
    }).select("*").single();
    if (runErr) throw runErr;

    // Fan out lenses in parallel
    const results = await Promise.allSettled(
      lenses.map((l: LensId) => runLens(l, encounter_text, payer, date_of_service, apiKey)),
    );

    const rows: any[] = [];
    const errors: Record<string, string> = {};
    results.forEach((r, i) => {
      const lens = lenses[i] as LensId;
      if (r.status === "fulfilled") {
        for (const f of r.value) {
          rows.push({
            run_id: run.id,
            user_id: user.id,
            lens,
            category: LENS_CATEGORY[lens] || "pre-bill",
            title: String(f.title || "(untitled)").slice(0, 240),
            description: String(f.description || "").slice(0, 4000),
            evidence_snippet: String(f.evidence_snippet || "").slice(0, 2000),
            code: String(f.code || "").slice(0, 64) || null,
            confidence: ["high","medium","low"].includes(f.confidence) ? f.confidence : "medium",
            dollars_at_risk: Math.max(0, Number(f.dollars_at_risk) || 0),
            dollars_recoverable: Math.max(0, Number(f.dollars_recoverable) || 0),
            recommended_action: String(f.recommended_action || "").slice(0, 2000),
          });
        }
      } else {
        errors[lens] = String(r.reason?.message || r.reason).slice(0, 400);
      }
    });

    const clustered = clusterFindings(rows);

    // Insert findings
    if (clustered.length) {
      const { error: insErr } = await sb.from("recovery_findings").insert(clustered);
      if (insErr) throw insErr;
    }

    // Rollup: only primary-in-cluster counts toward totals (prevents double-count)
    let totalAtRisk = 0, totalRecoverable = 0;
    for (const r of clustered) {
      if (r.is_primary_in_cluster) {
        totalAtRisk += Number(r.dollars_at_risk || 0);
        totalRecoverable += Number(r.dollars_recoverable || 0);
      }
    }

    const status = Object.keys(errors).length ? (clustered.length ? "partial" : "failed") : "completed";
    const { data: updated, error: updErr } = await sb.from("recovery_runs").update({
      total_dollars_at_risk: +totalAtRisk.toFixed(2),
      total_dollars_recoverable: +totalRecoverable.toFixed(2),
      status,
      error: Object.keys(errors).length ? JSON.stringify(errors) : null,
      metadata: { lens_errors: errors, finding_count: clustered.length },
    }).eq("id", run.id).select("*").single();
    if (updErr) throw updErr;

    return new Response(JSON.stringify({
      success: true,
      run: updated,
      findings: clustered,
      lens_errors: errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("recovery-engine error", e);
    return new Response(JSON.stringify({ error: e?.message || "Recovery run failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});