// RAC Clawback Shield — Extrapolation Attack Engine
// Validates RAC compliance with CMS MPIM Ch.8 statistical sampling rules,
// recomputes point estimate + 90% CI lower bound (simple OR stratified) from
// per-claim defense outcomes, and quantifies reduced exposure with multiple
// settlement scenarios (best/expected/concede-pending).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-sided 90% t-critical (alpha=0.10), df = n-1, log-linear interpolated.
function tCrit90(df: number): number {
  if (df <= 0) return 1.645;
  const table: Array<[number, number]> = [
    [1, 3.078], [2, 1.886], [3, 1.638], [4, 1.533], [5, 1.476],
    [6, 1.440], [8, 1.397], [10, 1.372], [12, 1.356], [15, 1.341],
    [20, 1.325], [25, 1.316], [30, 1.310], [40, 1.303], [50, 1.299],
    [60, 1.296], [80, 1.292], [100, 1.290], [200, 1.286], [500, 1.283], [1000, 1.282],
  ];
  if (df <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (df <= table[i][0]) {
      const [d0, t0] = table[i-1];
      const [d1, t1] = table[i];
      const w = (Math.log(df) - Math.log(d0)) / (Math.log(d1) - Math.log(d0));
      return t0 + (t1 - t0) * w;
    }
  }
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

const CREDIT_MAP: Record<string, number> = {
  full_defense: 1.0,
  strong: 0.85,
  partial: 0.5,
  weak: 0.2,
  conceded: 0.0,
  pending: 0.3,
};

// Compute mean / SE from per-claim residual overpayments, optionally stratified.
function estimate(values: number[], N: number, n: number, strata?: Array<{ N: number; values: number[] }>) {
  if (strata && strata.length >= 2) {
    // Stratified: total = sum_h N_h * mean_h ; var = sum_h (N_h^2 * (1 - n_h/N_h) * s_h^2 / n_h)
    let total = 0, varTotal = 0, totalN = 0, totalN_n = 0;
    for (const h of strata) {
      const n_h = h.values.length;
      if (n_h === 0) continue;
      const m_h = mean(h.values);
      const s_h = stddev(h.values);
      const fpc = h.N > 0 ? Math.max(0, 1 - n_h / h.N) : 1;
      total += h.N * m_h;
      varTotal += (h.N * h.N) * fpc * (s_h * s_h) / Math.max(1, n_h);
      totalN += h.N;
      totalN_n += n_h;
    }
    const se = Math.sqrt(Math.max(0, varTotal));
    return { point: total, se, df: Math.max(1, totalN_n - strata.length), method: "stratified", N: totalN };
  }
  const m = mean(values);
  const s = stddev(values);
  const fpc = N > 0 ? Math.max(0, 1 - n / N) : 1;
  const se = (s / Math.sqrt(Math.max(1, n))) * Math.sqrt(fpc);
  const point = (N > 0 ? N : n) * m;
  return { point, se: se * (N > 0 ? N : n), df: Math.max(1, n - 1), method: "simple", N: N || n };
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
    const stratificationCfg = (audit.stratification || {}) as Record<string, any>;
    // Optional explicit strata from intake: { strata: [{ key, N, claim_filter? }] }
    const explicitStrata: Array<{ key: string; N: number; field?: string; match?: string | string[] }> = Array.isArray(stratificationCfg.strata) ? stratificationCfg.strata : [];

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
    const stratDocumented = stratificationCfg && Object.keys(stratificationCfg).length > 0;
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
    const perClaimOverpayments: number[] = [];
    // Scenarios: pending claims treated three ways
    const perClaimBest: number[] = [];     // pending → full defense
    const perClaimWorst: number[] = [];    // pending → conceded
    let racTotalDisallowed = 0;
    let pendingCount = 0;
    for (const c of (claims ?? [])) {
      const disallowed = Number(c.rac_disallowed_amount) || 0;
      racTotalDisallowed += disallowed;
      const strength = (c.defense_strength || c.defense_status || "pending") as string;
      if (strength === "pending") pendingCount++;
      const credit = CREDIT_MAP[strength] ?? 0.3;
      const remaining = Math.max(0, disallowed * (1 - credit));
      perClaimOverpayments.push(remaining);
      perClaimBest.push(strength === "pending" ? 0 : remaining);
      perClaimWorst.push(strength === "pending" ? disallowed : remaining);
    }

    // Build strata buckets if explicit strata present and a routing field is given.
    function bucketize(values: number[]) {
      if (!explicitStrata.length) return undefined;
      const buckets = explicitStrata.map(s => ({ N: Number(s.N) || 0, values: [] as number[], key: s.key }));
      (claims ?? []).forEach((c, i) => {
        const val = values[i];
        let idx = -1;
        for (let k = 0; k < explicitStrata.length; k++) {
          const s = explicitStrata[k];
          const fld = s.field ? (c as any)[s.field] : null;
          const match = Array.isArray(s.match) ? s.match : (s.match ? [s.match] : null);
          if (!s.field || !match) { if (k === 0 && idx < 0) idx = k; continue; }
          if (match.map(String).includes(String(fld))) { idx = k; break; }
        }
        if (idx < 0) idx = 0;
        buckets[idx].values.push(val);
      });
      return buckets.filter(b => b.values.length > 0);
    }

    const expected = estimate(perClaimOverpayments, N, n, bucketize(perClaimOverpayments));
    const best = estimate(perClaimBest, N, n, bucketize(perClaimBest));
    const worst = estimate(perClaimWorst, N, n, bucketize(perClaimWorst));

    const sampleMeanOverpayment = mean(perClaimOverpayments);
    const sampleSD = stddev(perClaimOverpayments);
    const tval = tCrit90(expected.df);
    const marginOfError = tval * expected.se;

    const recomputedPoint = expected.point;
    const lowerCI = Math.max(0, expected.point - marginOfError);
    const bestLower = Math.max(0, best.point - tCrit90(best.df) * best.se);
    const worstLower = Math.max(0, worst.point - tCrit90(worst.df) * worst.se);

    const racPointEstimate = racDemand > 0 ? racDemand : (N > 0 ? (racTotalDisallowed / Math.max(n,1)) * N : racTotalDisallowed);
    const reducedExposure = lowerCI; // defensible position to settle at
    const exposureDelta = Math.max(0, racPointEstimate - reducedExposure);
    const precisionPct = recomputedPoint > 0 ? (marginOfError / recomputedPoint) * 100 : 0;

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
        standard_error: expected.se,
        t_critical_90: tval,
        margin_of_error: marginOfError,
        n, N,
        method: expected.method,
        df: expected.df,
        pending_claims: pendingCount,
        scenarios: {
          best_case_lower_ci: bestLower,
          expected_lower_ci: lowerCI,
          worst_case_lower_ci: worstLower,
          best_case_point: best.point,
          worst_case_point: worst.point,
        },
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