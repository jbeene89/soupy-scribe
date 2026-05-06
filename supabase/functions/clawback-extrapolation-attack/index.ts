// RAC Clawback Shield — Extrapolation Attack Engine
// Validates RAC compliance with CMS MPIM Ch.8 statistical sampling rules,
// recomputes point estimate + 90% CI lower bound from per-claim defense outcomes,
// and quantifies reduced exposure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-sided 90% t-critical (alpha=0.10) for df = sample_size - 1
function tCrit90(df: number): number {
  if (df <= 0) return 1.645;
  // Lookup for common df, fall back to z=1.282 (one-sided 90%) for large df
  const table: Record<number, number> = {
    1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476,
    10: 1.372, 15: 1.341, 20: 1.325, 25: 1.316, 30: 1.310,
    40: 1.303, 50: 1.299, 60: 1.296, 80: 1.292, 100: 1.290,
    200: 1.286, 500: 1.283, 1000: 1.282,
  };
  const keys = Object.keys(table).map(Number).sort((a,b)=>a-b);
  for (const k of keys) if (df <= k) return table[k];
  return 1.282;
}

function mean(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}
function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const sq = arr.reduce((s,x)=>s + (x-m)*(x-m), 0);
  return Math.sqrt(sq / (arr.length - 1));
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

    const { auditId } = await req.json();
    if (!auditId) return new Response(JSON.stringify({ error: "auditId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: audit, error: aErr } = await sb.from("clawback_audits").select("*").eq("id", auditId).single();
    if (aErr || !audit) throw aErr || new Error("Audit not found");

    const { data: claims, error: cErr } = await sb.from("clawback_claims").select("*").eq("audit_id", auditId);
    if (cErr) throw cErr;

    const N = audit.universe_size || 0;
    const n = audit.sample_size || (claims?.length ?? 0);
    const racDemand = Number(audit.demand_amount) || 0;

    // ─── 1. CMS Ch.8 Compliance Checks ───
    const compliance: Record<string, { ok: boolean; finding: string }> = {};
    const defects: Array<{ code: string; severity: "high" | "medium" | "low"; title: string; citation: string; description: string }> = [];

    // Universe definition
    compliance.universe_defined = {
      ok: N > 0,
      finding: N > 0 ? `Universe size of ${N} claims documented.` : "RAC failed to document universe size — facially defective sample (CMS MPIM Ch.8 §3.4.1.2).",
    };
    if (!compliance.universe_defined.ok) defects.push({
      code: "UNIVERSE_UNDEFINED", severity: "high",
      title: "Universe not properly defined",
      citation: "CMS MPIM Ch.8 §3.4.1.2",
      description: "RAC must document the sampling frame. Absence is grounds to invalidate the entire extrapolation.",
    });

    // Sample size adequacy (CMS does not mandate a minimum, but precision must be calculable)
    compliance.sample_size_documented = {
      ok: n >= 30,
      finding: n >= 30 ? `Sample of ${n} claims supports normal-approximation inference.` : `Sample of ${n} claims is below n=30 threshold — t-distribution required, precision suffers.`,
    };
    if (n < 30) defects.push({
      code: "SMALL_SAMPLE", severity: "medium",
      title: "Sample size below normal-approximation threshold",
      citation: "CMS MPIM Ch.8 §3.10.4",
      description: `Sample of ${n} requires t-distribution adjustments and yields wider confidence intervals — reducing the defensible recoupment.`,
    });

    // Stratification documentation
    const strat = (audit.stratification || {}) as Record<string, unknown>;
    const stratDocumented = strat && Object.keys(strat).length > 0;
    compliance.stratification_documented = {
      ok: stratDocumented,
      finding: stratDocumented ? "Stratification methodology provided." : "RAC did not disclose stratification details — replication impossible.",
    };
    if (!stratDocumented) defects.push({
      code: "STRATIFICATION_OPAQUE", severity: "high",
      title: "Stratification methodology not disclosed",
      citation: "CMS MPIM Ch.8 §3.4.3",
      description: "Without strata definitions and per-stratum sample sizes, the provider cannot replicate or challenge the estimator. Grounds for invalidation.",
    });

    // Random seed / RAT-STATS reproducibility
    const seed = (audit.metadata as any)?.rat_stats_seed;
    compliance.reproducible_sample = {
      ok: !!seed,
      finding: seed ? `RAT-STATS seed disclosed (${seed}).` : "RAT-STATS / random number seed not disclosed — sample non-reproducible.",
    };
    if (!seed) defects.push({
      code: "NON_REPRODUCIBLE_SAMPLE", severity: "medium",
      title: "Sample selection non-reproducible",
      citation: "CMS MPIM Ch.8 §3.5.2",
      description: "RAC must disclose sufficient detail (seed, software, parameters) for the provider to reproduce the sample. Procedural defect.",
    });

    // ─── 2. Recompute point estimate from defense outcomes ───
    // Per claim: overpayment_after_defense = rac_disallowed_amount * (1 - defense_credit)
    // defense_credit: full_defense=1.0, partial=0.5, weak=0.2, none=0.0
    const creditMap: Record<string, number> = {
      full_defense: 1.0,
      strong: 0.85,
      partial: 0.5,
      weak: 0.2,
      conceded: 0.0,
      pending: 0.3, // optimistic-of-pending; flagged separately
    };
    const perClaimOverpayments: number[] = [];
    let racTotalDisallowed = 0;
    let pendingCount = 0;
    for (const c of (claims ?? [])) {
      const disallowed = Number(c.rac_disallowed_amount) || 0;
      racTotalDisallowed += disallowed;
      const strength = (c.defense_strength || c.defense_status || "pending") as string;
      if (strength === "pending") pendingCount++;
      const credit = creditMap[strength] ?? 0.3;
      const remaining = Math.max(0, disallowed * (1 - credit));
      perClaimOverpayments.push(remaining);
    }

    const sampleMeanOverpayment = mean(perClaimOverpayments);
    const sampleSD = stddev(perClaimOverpayments);
    const standardError = n > 0 ? sampleSD / Math.sqrt(n) : 0;
    const tval = tCrit90(Math.max(1, n - 1));
    const marginOfError = tval * standardError;

    // Point estimate (extrapolated to universe)
    const recomputedPoint = N > 0 ? sampleMeanOverpayment * N : sampleMeanOverpayment * n;
    // Lower bound (one-sided 90% — what CMS actually uses to demand)
    const lowerCI = N > 0
      ? Math.max(0, (sampleMeanOverpayment - marginOfError) * N)
      : Math.max(0, (sampleMeanOverpayment - marginOfError) * n);

    const racPointEstimate = racDemand > 0 ? racDemand : (N > 0 ? (racTotalDisallowed / Math.max(n,1)) * N : racTotalDisallowed);
    const reducedExposure = lowerCI; // defensible position to settle at
    const exposureDelta = Math.max(0, racPointEstimate - reducedExposure);
    const precisionPct = recomputedPoint > 0 ? (marginOfError * (N || n)) / recomputedPoint * 100 : 0;

    // ─── 3. Leverage score ───
    // 0–100. Procedural defects (high-severity) carry the most weight because they
    // can invalidate the whole extrapolation outright.
    const highDefects = defects.filter(d => d.severity === "high").length;
    const medDefects = defects.filter(d => d.severity === "medium").length;
    const deltaPct = racPointEstimate > 0 ? (exposureDelta / racPointEstimate) * 100 : 0;
    let leverage = 0;
    leverage += Math.min(50, highDefects * 25);
    leverage += Math.min(20, medDefects * 8);
    leverage += Math.min(30, deltaPct * 0.4);
    leverage = Math.round(Math.min(100, leverage));

    const summaryParts: string[] = [];
    if (highDefects > 0) summaryParts.push(`${highDefects} high-severity procedural defect${highDefects>1?"s":""} identified — grounds to challenge the extrapolation outright.`);
    if (exposureDelta > 0) summaryParts.push(`Defensible exposure recomputed at $${Math.round(reducedExposure).toLocaleString()} vs. RAC demand of $${Math.round(racPointEstimate).toLocaleString()} — a $${Math.round(exposureDelta).toLocaleString()} reduction.`);
    if (precisionPct > 25) summaryParts.push(`Precision of ±${precisionPct.toFixed(1)}% exceeds typical 25% threshold — sample is insufficiently precise.`);
    if (pendingCount > 0) summaryParts.push(`${pendingCount} claim${pendingCount>1?"s":""} pending per-claim review — figures will tighten after analysis completes.`);
    const attackSummary = summaryParts.join(" ");

    // Upsert
    const payload = {
      audit_id: auditId,
      owner_id: user.id,
      cms_compliance: compliance,
      procedural_defects: defects,
      rac_point_estimate: racPointEstimate,
      rac_demand: racDemand,
      recomputed_point_estimate: recomputedPoint,
      recomputed_lower_ci: lowerCI,
      precision_pct: precisionPct,
      reduced_exposure: reducedExposure,
      exposure_delta: exposureDelta,
      leverage_score: leverage,
      attack_summary: attackSummary,
      details: {
        sample_mean_overpayment: sampleMeanOverpayment,
        sample_sd: sampleSD,
        standard_error: standardError,
        t_critical_90: tval,
        margin_of_error: marginOfError,
        n, N,
        pending_claims: pendingCount,
      },
    };
    const { error: upErr } = await sb.from("clawback_extrapolation").upsert(payload, { onConflict: "audit_id" });
    if (upErr) throw upErr;

    return new Response(JSON.stringify({ success: true, ...payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clawback-extrapolation-attack error", e);
    return new Response(JSON.stringify({ error: e?.message || "Attack engine failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});