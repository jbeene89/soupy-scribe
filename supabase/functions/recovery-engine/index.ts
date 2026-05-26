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

// ===== Inference provider routing =====
// If CUSTOM_INFERENCE_URL is set (e.g. an AMD Developer Cloud GPU running
// vLLM / Ollama / TGI with an OpenAI-compatible /v1/chat/completions API),
// route all model calls there instead of Lovable AI Gateway. Falls back to
// Lovable AI when the custom secrets are not configured.
function getInferenceConfig(lovableKey: string) {
  const customUrl = Deno.env.get("CUSTOM_INFERENCE_URL");
  const customKey = Deno.env.get("CUSTOM_INFERENCE_API_KEY");
  const customModel = Deno.env.get("CUSTOM_INFERENCE_MODEL");
  if (customUrl && customKey && customModel) {
    return { url: customUrl, key: customKey, model: customModel, provider: "custom" as const };
  }
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    key: lovableKey,
    model: "google/gemini-2.5-flash",
    provider: "lovable" as const,
  };
}

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
      "evidence_snippet": "<MUST be a verbatim quote from the encounter; if no quote supports it, OMIT this finding entirely>",
      "code": "<ICD-10 / CPT / HCC / contract term, or empty>",
      "confidence": "high" | "medium" | "low",
      "dollars_at_risk": <number, dollars currently exposed>,
      "dollars_recoverable": <number, dollars recoverable if action taken>,
      "recommended_action": "<concrete next step>"
    }
  ]
}
Be conservative. NEVER fabricate a finding without a verbatim evidence quote. If nothing applies, return {"findings": []}.`;

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

  const inf = getInferenceConfig(apiKey);
  const res = await fetch(inf.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${inf.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: inf.model,
      messages: [
        { role: "system", content: cfg.system },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000), // 90s per lens — prevents a hung gateway call from holding the whole encounter
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
 * Adversarial second-pass: send all candidate findings + encounter to the
 * model and ask it to grade each finding as kept / demoted / removed.
 * - kept: solid, evidence holds up
 * - demoted: real issue but dollar amount or confidence is overstated → excluded from rollup
 * - removed: not supported by the chart → excluded from rollup, hidden by default
 */
async function adversarialReview(
  rows: any[],
  encounterText: string,
  apiKey: string,
): Promise<Record<number, { verdict: string; note: string }>> {
  if (rows.length === 0) return {};
  const compact = rows.map((r, i) => ({
    i,
    lens: r.lens,
    title: r.title,
    code: r.code,
    evidence: r.evidence_snippet,
    dollars: r.dollars_recoverable,
    confidence: r.confidence,
  }));
  const sys =
    "You are an adversarial reviewer of revenue-recovery findings. For each finding, " +
    "decide: 'kept' (evidence holds, dollar plausible), 'demoted' (real issue but inflated " +
    "$ or weak evidence), or 'removed' (not actually supported by the chart). Be strict. " +
    "Return JSON only.";
  const user = `ENCOUNTER:
${encounterText.slice(0, 50000)}

FINDINGS:
${JSON.stringify(compact, null, 2)}

Return JSON: {"verdicts":[{"i":<index>,"verdict":"kept"|"demoted"|"removed","note":"<one-sentence reason>"}]}`;
  try {
    const inf = getInferenceConfig(apiKey);
    const res = await fetch(inf.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${inf.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: inf.model,
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return {};
    const json = await res.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || "{}");
    const out: Record<number, { verdict: string; note: string }> = {};
    for (const v of parsed.verdicts || []) {
      const verdict = ["kept", "demoted", "removed"].includes(v.verdict) ? v.verdict : "kept";
      out[Number(v.i)] = { verdict, note: String(v.note || "").slice(0, 500) };
    }
    return out;
  } catch (e) {
    console.error("adversarial review failed", e);
    return {};
  }
}

async function runSingleEncounter(
  sb: any,
  userId: string,
  apiKey: string,
  params: {
    encounter_text: string;
    patient_ref: string | null;
    payer: string | null;
    date_of_service: string | null;
    lenses: LensId[];
    notes: string | null;
    batch_id: string | null;
    onRunCreated?: (id: string) => void;
  },
) {
  const { encounter_text, patient_ref, payer, date_of_service, lenses, notes, batch_id, onRunCreated } = params;

  // Auto-detect payer from the encounter text when caller didn't provide one.
  // Looks for common commercial + government payer names and explicit "Payer:" /
  // "Insurance:" / "Plan:" labels. First strong hit wins.
  const detectedPayer = payer && payer.trim() ? payer.trim() : detectPayerFromText(encounter_text);
  const effectivePayer = detectedPayer || null;

  const { data: run, error: runErr } = await sb.from("recovery_runs").insert({
    user_id: userId,
    batch_id,
    patient_ref,
    payer: effectivePayer,
    date_of_service,
    encounter_excerpt: String(encounter_text).slice(0, 4000),
    lenses_run: lenses,
    status: "running",
    notes,
    metadata: {
      payer_source: payer && payer.trim()
        ? "caller"
        : detectedPayer
        ? "auto-detected"
        : "unknown",
    },
  }).select("*").single();
  if (runErr) throw runErr;
  if (onRunCreated) onRunCreated(run.id);

  const results = await Promise.allSettled(
    lenses.map((l) => runLens(l, encounter_text, effectivePayer, date_of_service, apiKey)),
  );

  const rows: any[] = [];
  const errors: Record<string, string> = {};
  results.forEach((r, i) => {
    const lens = lenses[i];
    if (r.status === "fulfilled") {
      for (const f of r.value) {
        const evidence = String(f.evidence_snippet || "").trim();
        if (!evidence) continue; // enforce evidence requirement
        rows.push({
          run_id: run.id,
          user_id: userId,
          lens,
          category: LENS_CATEGORY[lens] || "pre-bill",
          title: String(f.title || "(untitled)").slice(0, 240),
          description: String(f.description || "").slice(0, 4000),
          evidence_snippet: evidence.slice(0, 2000),
          code: String(f.code || "").slice(0, 64) || null,
          confidence: ["high", "medium", "low"].includes(f.confidence) ? f.confidence : "medium",
          dollars_at_risk: Math.max(0, Number(f.dollars_at_risk) || 0),
          dollars_recoverable: Math.max(0, Number(f.dollars_recoverable) || 0),
          recommended_action: String(f.recommended_action || "").slice(0, 2000),
        });
      }
    } else {
      errors[lens] = String(r.reason?.message || r.reason).slice(0, 400);
    }
  });

  // Adversarial pass
  const verdicts = await adversarialReview(rows, encounter_text, apiKey);
  const checkedAt = new Date().toISOString();
  rows.forEach((r, i) => {
    const v = verdicts[i];
    r.adversarial_verdict = v?.verdict || "kept";
    r.adversarial_note = v?.note || null;
    r.adversarial_checked_at = checkedAt;
  });

  const clustered = clusterFindings(rows);

  if (clustered.length) {
    const { error: insErr } = await sb.from("recovery_findings").insert(clustered);
    if (insErr) throw insErr;
  }

  // Rollup: only primary AND kept findings count
  let totalAtRisk = 0, totalRecoverable = 0;
  for (const r of clustered) {
    if (r.is_primary_in_cluster && r.adversarial_verdict === "kept") {
      totalAtRisk += Number(r.dollars_at_risk || 0);
      totalRecoverable += Number(r.dollars_recoverable || 0);
    }
  }

  const status = Object.keys(errors).length ? (clustered.length ? "partial" : "failed") : "completed";
  const { data: updated } = await sb.from("recovery_runs").update({
    total_dollars_at_risk: +totalAtRisk.toFixed(2),
    total_dollars_recoverable: +totalRecoverable.toFixed(2),
    status,
    error: Object.keys(errors).length ? JSON.stringify(errors) : null,
    metadata: {
      lens_errors: errors,
      finding_count: clustered.length,
      kept_count: clustered.filter((r) => r.adversarial_verdict === "kept").length,
      demoted_count: clustered.filter((r) => r.adversarial_verdict === "demoted").length,
      removed_count: clustered.filter((r) => r.adversarial_verdict === "removed").length,
    },
  }).eq("id", run.id).select("*").single();

  return { run: updated, findings: clustered, errors, totalAtRisk, totalRecoverable, status };
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
    const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    const hasCustom = !!(Deno.env.get("CUSTOM_INFERENCE_URL") && Deno.env.get("CUSTOM_INFERENCE_API_KEY") && Deno.env.get("CUSTOM_INFERENCE_MODEL"));
    if (!apiKey && !hasCustom) {
      throw new Error("No inference provider configured (set LOVABLE_API_KEY or CUSTOM_INFERENCE_URL + CUSTOM_INFERENCE_API_KEY + CUSTOM_INFERENCE_MODEL)");
    }

    const DEFAULT_LENSES: LensId[] = ["hcc","cdi","counterfactual","modifier","bundling","contract","clawback_exposure","policy_time","supply"];
    const lenses = (Array.isArray(body?.lenses) && body.lenses.length ? body.lenses : DEFAULT_LENSES) as LensId[];

    // ============ BATCH MODE ============
    if (Array.isArray(body?.encounters) && body.encounters.length) {
      const label = String(body.batch_label || `Batch ${new Date().toISOString().slice(0, 16).replace("T", " ")}`).slice(0, 240);
      // Hard cap each encounter to 80k chars (model only reads 60k anyway).
      // Without this, large MIMIC-style concatenated CSVs OOM the edge worker.
      const MAX_ENC_CHARS = 80_000;
      const encounters = body.encounters
        .filter((e: any) => e && typeof e.encounter_text === "string" && e.encounter_text.trim().length >= 40)
        .map((e: any) => ({
          ...e,
          encounter_text: e.encounter_text.length > MAX_ENC_CHARS
            ? e.encounter_text.slice(0, MAX_ENC_CHARS) + `\n\n[…truncated from ${e.encounter_text.length.toLocaleString()} to ${MAX_ENC_CHARS.toLocaleString()} chars for analysis]`
            : e.encounter_text,
        }));
      if (!encounters.length) {
        return new Response(JSON.stringify({ error: "No valid encounters (each needs ≥40 chars of text)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // If client passes an existing batch_id, attach new encounters to it
      // (retry / append flow). Otherwise create a fresh batch.
      let batch: any;
      const existingBatchId = typeof body.batch_id === "string" ? body.batch_id : null;
      if (existingBatchId) {
        const { data: existing, error: exErr } = await sb
          .from("recovery_batches")
          .select("*")
          .eq("id", existingBatchId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (exErr) throw exErr;
        if (!existing) {
          return new Response(JSON.stringify({ error: "Batch not found or not owned by you" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        batch = existing;
        // Bump the planned count + flip back to running while we process.
        await sb.from("recovery_batches").update({
          status: "running",
          encounter_count: (existing.encounter_count || 0) + encounters.length,
        }).eq("id", batch.id);
      } else {
        const { data: created, error: batchErr } = await sb.from("recovery_batches").insert({
          user_id: user.id,
          label,
          status: "running",
          encounter_count: encounters.length,
        }).select("*").single();
        if (batchErr) throw batchErr;
        batch = created;
      }

      const runSummaries: any[] = [];

      // Concurrency from client (1 = sequential / rate-limit-safe, higher = turbo)
      const concurrency = Math.min(8, Math.max(1, Number(body.concurrency) || 1));

      async function processOne(enc: any) {
        let runIdForFailure: string | null = null;
        try {
          const result = await runSingleEncounter(sb, user.id, apiKey, {
            encounter_text: String(enc.encounter_text),
            patient_ref: enc.patient_ref || null,
            payer: enc.payer || body.payer || null,
            date_of_service: enc.date_of_service || body.date_of_service || null,
            lenses,
            notes: enc.notes || null,
            batch_id: batch.id,
            onRunCreated: (id: string) => { runIdForFailure = id; },
          });
          runSummaries.push({ run_id: result.run.id, patient_ref: enc.patient_ref, status: result.status, recoverable: result.totalRecoverable });
        } catch (e: any) {
          const msg = String(e?.message || e).slice(0, 300);
          // CRITICAL: if the run row was already inserted, mark it failed so it
          // doesn't stay stuck on "running" forever (the previous bug).
          if (runIdForFailure) {
            try {
              await sb.from("recovery_runs").update({ status: "failed", error: msg }).eq("id", runIdForFailure);
            } catch (_) { /* best effort */ }
          }
          runSummaries.push({ patient_ref: enc.patient_ref, status: "failed", error: String(e?.message || e).slice(0, 300) });
        }
      }

      // Simple worker-pool: N workers pull from a shared queue
      const queue = [...encounters];
      const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length) {
          const enc = queue.shift();
          if (!enc) break;
          await processOne(enc);
        }
      });
      await Promise.all(workers);

      // Recompute totals from ALL runs in the batch (handles append + retry).
      const { data: allRuns } = await sb
        .from("recovery_runs")
        .select("status,total_dollars_at_risk,total_dollars_recoverable")
        .eq("batch_id", batch.id);
      let totalAtRisk = 0, totalRecoverable = 0, completed = 0, failed = 0;
      for (const r of allRuns || []) {
        if (r.status === "completed" || r.status === "partial") {
          completed++;
          totalAtRisk += Number(r.total_dollars_at_risk || 0);
          totalRecoverable += Number(r.total_dollars_recoverable || 0);
        } else if (r.status === "failed") {
          failed++;
        }
      }
      const batchStatus = failed === 0 ? "completed" : completed === 0 ? "failed" : "partial";
      const { data: updatedBatch } = await sb.from("recovery_batches").update({
        status: batchStatus,
        completed_count: completed,
        failed_count: failed,
        total_dollars_at_risk: +totalAtRisk.toFixed(2),
        total_dollars_recoverable: +totalRecoverable.toFixed(2),
        metadata: { runs: runSummaries },
      }).eq("id", batch.id).select("*").single();

      return new Response(JSON.stringify({
        success: true,
        mode: "batch",
        batch: updatedBatch,
        runs: runSummaries,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============ SINGLE MODE ============
    const encounter_text = String(body?.encounter_text || "");
    if (encounter_text.trim().length < 40) {
      return new Response(JSON.stringify({ error: "encounter_text required (min 40 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await runSingleEncounter(sb, user.id, apiKey, {
      encounter_text,
      patient_ref: body.patient_ref || null,
      payer: body.payer || null,
      date_of_service: body.date_of_service || null,
      lenses,
      notes: body.notes || null,
      batch_id: null,
    });

    return new Response(JSON.stringify({
      success: true,
      mode: "single",
      run: result.run,
      findings: result.findings,
      lens_errors: result.errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("recovery-engine error", e);
    return new Response(JSON.stringify({ error: e?.message || "Recovery run failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});