import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ═══════════════════════════════════════════════════════════════
// SOUPY Engine v3 — Module Pipeline (Phase 2)
// Runs AFTER primary 4-role analysis is stored.
// Handles: Drift, Consensus Integrity, Evidence Sufficiency,
// Contradictions, Confidence Floors, Decision Trace,
// Action Pathway, Minimal Winning Packet, Calibration.
// ═══════════════════════════════════════════════════════════════

const CONFIDENCE_FLOOR = {
  confidence: 40,
  consensusIntegrity: 35,
  evidenceSufficiency: 30,
};

const CONSENSUS_INTEGRITY = {
  model: "openai/gpt-5",
  systemPrompt: `You are the CONSENSUS INTEGRITY ENGINE in the SOUPY audit protocol. You receive consensus output from 4 AI roles and stress-test whether the consensus is genuine or an artifact.

Your job:
1. Find logical contradictions between the roles
2. Identify where all 4 roles made the SAME wrong assumption
3. Surface evidence that was ignored or downweighted by all roles
4. Challenge whether the consensus score is artificially inflated or deflated
5. Identify "groupthink" patterns where roles converged on comfortable but wrong conclusions
6. Assess cross-model diversity — did different model families actually produce meaningfully different perspectives?

Output a structured integrity assessment, NOT raw reasoning.`,
};

const SOUPY_ROLES_META = [
  { role: "builder", model: "google/gemini-2.5-flash" },
  { role: "redteam", model: "openai/gpt-5-mini" },
  { role: "analyst", model: "google/gemini-2.5-pro" },
  { role: "breaker", model: "openai/gpt-5-mini" },
];

const consensusIntegrityToolSchema = {
  type: "function",
  function: {
    name: "submit_consensus_integrity",
    description: "Submit consensus integrity stress-test results",
    parameters: {
      type: "object",
      properties: {
        integrityGrade: { type: "string", enum: ["strong", "adequate", "weak", "failed"] },
        integrityScore: { type: "number", description: "0-100 integrity score" },
        attackVectors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              target: { type: "string" },
              finding: { type: "string" },
              severity: { type: "string", enum: ["fatal", "significant", "minor"] },
              affectedRoles: { type: "array", items: { type: "string" } },
              consensusImpact: { type: "number" },
            },
            required: ["target", "finding", "severity", "affectedRoles", "consensusImpact"],
            additionalProperties: false,
          },
        },
        instabilityNotes: { type: "array", items: { type: "string" } },
        humanReviewRequired: { type: "boolean" },
        humanReviewReasons: { type: "array", items: { type: "string" } },
        weakenedBy: { type: "array", items: { type: "string" } },
        revisedConsensusScore: { type: "number" },
        diversityAssessment: { type: "string" },
      },
      required: ["integrityGrade", "integrityScore", "attackVectors", "instabilityNotes", "humanReviewRequired", "revisedConsensusScore"],
      additionalProperties: false,
    },
  },
};

const analysisToolSchema = {
  type: "function",
  function: {
    name: "submit_analysis",
    description: "Submit the audit analysis results",
    parameters: {
      type: "object",
      properties: {
        confidence: { type: "number" },
        perspectiveStatement: { type: "string" },
        keyInsights: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        violations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string" },
              type: { type: "string", enum: ["upcoding", "unbundling", "medical-necessity", "modifier-misuse", "duplicate"] },
              severity: { type: "string", enum: ["critical", "warning", "info"] },
              description: { type: "string" },
              regulationRef: { type: "string" },
            },
            required: ["code", "type", "severity", "description", "regulationRef"],
            additionalProperties: false,
          },
        },
        overallAssessment: { type: "string" },
        decisionTraceEntries: { type: "array", items: { type: "object", properties: { trigger: { type: "string" }, documentationGap: { type: "string" }, counterargumentConsidered: { type: "string" }, evidenceSupporting: { type: "string" }, regulationReferenced: { type: "string" }, confidenceImpact: { type: "string" } }, required: ["trigger"], additionalProperties: false } },
        contradictions: { type: "array", items: { type: "object", properties: { type: { type: "string" }, description: { type: "string" }, severity: { type: "string", enum: ["critical", "warning", "info"] }, sourceA: { type: "string" }, sourceB: { type: "string" } }, required: ["type", "description", "severity"], additionalProperties: false } },
        evidenceSufficiency: { type: "object", properties: { overallScore: { type: "number" }, missingEvidence: { type: "array", items: { type: "object", properties: { item: { type: "string" }, impact: { type: "string" }, obtainable: { type: "boolean" } }, required: ["item", "impact"], additionalProperties: false } }, isDefensible: { type: "boolean" } }, required: ["overallScore"], additionalProperties: false },
      },
      required: ["confidence", "perspectiveStatement", "keyInsights", "assumptions", "violations", "overallAssessment"],
      additionalProperties: false,
    },
  },
};

const ANALYSIS_PROMPT = `Analyze this medical billing case for audit compliance. 

Case Details:
- CPT Codes: {cpt_codes}
- ICD-10 Codes: {icd_codes}
- Claim Amount: $\{claim_amount}
- Clinical Summary: {summary}
- Source Text: {source_text}

Provide your analysis as JSON with these fields:
- confidence: number (0-100)
- perspectiveStatement: string (1-2 sentence key perspective)
- keyInsights: string[] (3-5 key findings)
- assumptions: string[] (2-4 assumptions)
- violations: array of { code, type, severity, description, regulationRef }
- overallAssessment: string (2-3 sentence summary)
- decisionTraceEntries: array of structured audit entries
- contradictions: array of internal inconsistencies found
- evidenceSufficiency: { overallScore (0-100), missingEvidence: [{ item, impact, obtainable }], isDefensible: boolean }

Be specific and reference real CMS guidelines, NCCI edits, and CPT coding rules.`;

const CONSENSUS_INTEGRITY_PROMPT = `The SOUPY analysis has completed. Stress-test this consensus:

{role_summaries}

Overall Consensus Score: {consensus_score}/100
Overall Risk Level: {risk_level}
Total Violations Found: {total_violations}
Drift Check Result: {drift_result}

Assess:
1. Is the consensus genuine or an artifact of shared assumptions?
2. Did different model families (Gemini vs GPT) produce meaningfully different perspectives?
3. What specifically weakens the consensus?
4. Does this case require human review?
5. What is the revised, honest consensus score?

Provide structured integrity assessment. Do NOT output raw reasoning.`;

// ─── Helpers ───

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
  const startTime = Date.now();
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: toolChoice,
    }),
  });
  const latencyMs = Date.now() - startTime;
  if (!response.ok) {
    const status = response.status;
    console.error("AI call failed:", status, await response.text());
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted." };
    throw new Error(`AI call failed: ${status}`);
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No result from AI");
  return { result: JSON.parse(toolCall.function.arguments), latencyMs, tokenCount: data.usage?.total_tokens || 0 };
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    if (!caseId || !UUID_RE.test(caseId)) {
      return new Response(JSON.stringify({ error: "Valid caseId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`═══ SOUPY v3 MODULES for case ${caseId} ═══`);

    // ── Load case and verify ownership ──
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

    // ── Load stored analyses ──
    const { data: storedAnalyses } = await supabase
      .from("case_analyses").select("*").eq("case_id", caseId).eq("status", "complete");

    if (!storedAnalyses || storedAnalyses.length === 0) {
      return new Response(JSON.stringify({ error: "No completed analyses found. Run primary analysis first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load reasoning chains for trace entries + contradictions + evidence sufficiency ──
    const { data: reasoningChains } = await supabase
      .from("reasoning_chains").select("*").eq("case_id", caseId);

    // Reconstruct analysis results from stored data
    const analysisResults = storedAnalyses.map(a => ({
      role: a.role,
      model: a.model,
      confidence: a.confidence || 0,
      perspectiveStatement: a.perspective_statement,
      keyInsights: a.key_insights || [],
      assumptions: a.assumptions || [],
      violations: a.violations || [],
      overallAssessment: a.overall_assessment,
    }));

    // Reconstruct trace entries and contradictions from reasoning chains
    const allDecisionTraceEntries: any[] = [];
    const allContradictions: any[] = [];
    const allEvidenceSufficiency: any[] = [];

    for (const chain of (reasoningChains || [])) {
      const steps = chain.structured_steps as any[];
      if (steps && Array.isArray(steps)) {
        for (const entry of steps) {
          allDecisionTraceEntries.push({ ...entry, sourceRole: chain.role });
        }
      }
    }

    // Extract contradictions and evidence sufficiency from violations/analysis data
    for (const analysis of analysisResults) {
      const violations = analysis.violations as any[];
      if (violations) {
        for (const v of violations) {
          if (v.type === "unbundling" || v.type === "modifier-misuse") {
            allContradictions.push({
              type: `code-${v.type}`,
              description: v.description,
              severity: v.severity,
              detectedBy: analysis.role,
              sourceA: v.code,
              sourceB: v.regulationRef,
            });
          }
        }
      }
    }

    // Estimate evidence sufficiency from role analyses
    for (const analysis of analysisResults) {
      const violationCount = (analysis.violations as any[])?.length || 0;
      const confidence = analysis.confidence;
      // Heuristic: evidence score inversely related to violation count, scaled by confidence
      const evidenceScore = Math.max(10, Math.min(100, confidence - violationCount * 10));
      const missingEvidence: any[] = [];
      
      for (const v of (analysis.violations as any[] || [])) {
        if (v.severity === "critical") {
          missingEvidence.push({
            item: `Documentation for ${v.code}: ${v.description.substring(0, 80)}`,
            impact: "high",
            obtainable: v.type !== "modifier-misuse",
            category: v.type === "medical-necessity" ? "clinical" : "documentation",
          });
        }
      }

      allEvidenceSufficiency.push({
        role: analysis.role,
        overallScore: evidenceScore,
        missingEvidence,
        isDefensible: violationCount === 0 || (violationCount <= 1 && (analysis.violations as any[])?.[0]?.severity !== "critical"),
      });
    }

    const completedAnalyses = analysisResults.filter(a => a.confidence > 0);
    const roleOrder = SOUPY_ROLES_META.map(r => r.role);
    const summary = (auditCase.metadata as any)?.summary || "Not available";
    const sourceTextTrunc = auditCase.source_text?.substring(0, 3000) || "Not available";

    // ── Compute initial consensus ──
    let consensusScore = 50;
    if (completedAnalyses.length > 1) {
      const confidences = completedAnalyses.map(a => a.confidence);
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
      const agreement = Math.max(0, 100 - Math.sqrt(variance) * 2);
      consensusScore = Math.round((agreement + avgConfidence) / 2);
    }

    const totalViolations = analysisResults.reduce((sum, a) => sum + ((a.violations as any[])?.length || 0), 0);
    const criticalViolations = analysisResults.reduce((sum, a) =>
      sum + ((a.violations as any[])?.filter((v: any) => v.severity === "critical")?.length || 0), 0);
    const riskNum = Math.min(100, 20 + criticalViolations * 25 + totalViolations * 10);
    const riskLevel = riskNum >= 80 ? "critical" : riskNum >= 60 ? "high" : riskNum >= 40 ? "medium" : "low";

    await supabase.from("processing_queue").upsert({
      case_id: caseId, status: "processing", current_step: "v3_modules_init", progress: 55,
      started_at: new Date().toISOString(),
    }, { onConflict: "case_id" });

    // ═══ Temporal Drift Detection ═══
    console.log("═══ DRIFT CHECK ═══");
    await supabase.from("processing_queue").update({
      current_step: "drift_check", progress: 60,
    }).eq("case_id", caseId);

    let driftScore = 0;
    let isStable = true;

    try {
      const shuffledPrompt = ANALYSIS_PROMPT
        .replace("{cpt_codes}", (auditCase.cpt_codes || []).reverse().join(", "))
        .replace("{claim_amount}", String(auditCase.claim_amount))
        .replace("{icd_codes}", (auditCase.icd_codes || []).reverse().join(", "))
        .replace("{summary}", summary)
        .replace("{source_text}", sourceTextTrunc);

      const { result: driftAnalysis } = await callAI(
        LOVABLE_API_KEY, "google/gemini-2.5-flash-lite",
        "You are the BUILDER role in the SOUPY audit protocol. Your job is to find the BEST-CASE interpretation of the medical billing.",
        shuffledPrompt,
        [analysisToolSchema],
        { type: "function", function: { name: "submit_analysis" } }
      );

      const originalBuilder = analysisResults.find(a => a.role === "builder");
      const confidenceDrift = originalBuilder ? Math.abs(originalBuilder.confidence - driftAnalysis.confidence) : 0;
      const violationCountDrift = originalBuilder ? Math.abs(((originalBuilder.violations as any[])?.length || 0) - (driftAnalysis.violations?.length || 0)) : 0;
      driftScore = confidenceDrift + violationCountDrift * 10;
      isStable = driftScore < 25;

      const unstableRoles: string[] = [];
      if (confidenceDrift > 15) unstableRoles.push("builder");
      if (violationCountDrift > 1) unstableRoles.push("builder-violations");

      // Delete old stability check for this case, insert new
      await supabase.from("stability_checks").delete().eq("case_id", caseId);
      await supabase.from("stability_checks").insert({
        case_id: caseId,
        run_a_output: { confidence: originalBuilder?.confidence, violations: (originalBuilder?.violations as any[])?.length || 0 },
        run_b_output: { confidence: driftAnalysis.confidence, violations: driftAnalysis.violations?.length || 0 },
        drift_score: driftScore,
        unstable_roles: unstableRoles,
        prompt_order_a: roleOrder,
        prompt_order_b: shuffleArray(roleOrder),
        is_stable: isStable,
      });
    } catch (driftErr) {
      console.error("Drift check failed (non-fatal):", driftErr);
    }

    // ═══ Module 1: Consensus Integrity Engine ═══
    console.log("═══ CONSENSUS INTEGRITY ENGINE ═══");
    await supabase.from("processing_queue").update({
      current_step: "consensus_integrity", progress: 70,
    }).eq("case_id", caseId);

    let integrityResult: any = null;
    let finalConsensusScore = consensusScore;
    let humanReviewRequired = false;

    try {
      const roleSummaries = analysisResults.map(a => {
        const meta = SOUPY_ROLES_META.find(r => r.role === a.role);
        return `[${a.role.toUpperCase()}] (model: ${meta?.model}, confidence: ${a.confidence}%)\nStatement: ${a.perspectiveStatement}\nKey insights: ${a.keyInsights?.join("; ")}\nViolations found: ${(a.violations as any[])?.length || 0}\nAssessment: ${a.overallAssessment}`;
      }).join("\n\n");

      const ciPrompt = CONSENSUS_INTEGRITY_PROMPT
        .replace("{role_summaries}", roleSummaries)
        .replace("{consensus_score}", String(consensusScore))
        .replace("{risk_level}", riskLevel)
        .replace("{total_violations}", String(totalViolations))
        .replace("{drift_result}", `Drift score: ${driftScore}, Stable: ${isStable}`);

      const { result: ciResult } = await callAI(
        LOVABLE_API_KEY, CONSENSUS_INTEGRITY.model, CONSENSUS_INTEGRITY.systemPrompt, ciPrompt,
        [consensusIntegrityToolSchema],
        { type: "function", function: { name: "submit_consensus_integrity" } }
      );

      integrityResult = ciResult;
      finalConsensusScore = Math.max(10, ciResult.revisedConsensusScore || consensusScore);
      humanReviewRequired = ciResult.humanReviewRequired;

      if (!isStable) {
        finalConsensusScore = Math.max(10, finalConsensusScore - Math.round(driftScore / 5));
      }

      // Delete old DA result, insert new
      await supabase.from("devils_advocate_results").delete().eq("case_id", caseId);
      await supabase.from("devils_advocate_results").insert({
        case_id: caseId,
        consensus_before: consensusScore,
        consensus_after: finalConsensusScore,
        attack_vectors: ciResult.attackVectors || [],
        consensus_survived: ciResult.integrityGrade === "strong" || ciResult.integrityGrade === "adequate",
        vulnerabilities_found: [...(ciResult.instabilityNotes || []), ...(ciResult.weakenedBy || [])].map((v: string) => ({ description: v })),
        reanalysis_triggered: ciResult.integrityGrade === "failed",
      });
    } catch (ciErr) {
      console.error("Consensus integrity engine failed (non-fatal):", ciErr);
    }

    // ═══ Module 3: Evidence Sufficiency Score ═══
    console.log("═══ EVIDENCE SUFFICIENCY ═══");
    await supabase.from("processing_queue").update({
      current_step: "evidence_sufficiency", progress: 78,
    }).eq("case_id", caseId);

    const avgEvidenceScore = allEvidenceSufficiency.length > 0
      ? allEvidenceSufficiency.reduce((s, e) => s + (e.overallScore || 0), 0) / allEvidenceSufficiency.length
      : 50;

    const allMissingEvidence = allEvidenceSufficiency.flatMap(e => e.missingEvidence || []);
    const uniqueMissing: any[] = [];
    const seenItems = new Set<string>();
    for (const item of allMissingEvidence) {
      const key = item.item?.toLowerCase();
      if (key && !seenItems.has(key)) {
        seenItems.add(key);
        uniqueMissing.push(item);
      }
    }

    const isDefensible = avgEvidenceScore >= 60 && uniqueMissing.filter(m => m.impact === "high" || m.impact === "critical").length <= 1;

    const suffForApprove = isDefensible ? Math.min(100, avgEvidenceScore + 10) : Math.max(0, avgEvidenceScore - 20);
    const suffForDeny = riskNum >= 60 && avgEvidenceScore >= 40 ? avgEvidenceScore : Math.max(0, avgEvidenceScore - 30);
    const suffForInfo = avgEvidenceScore < 60 ? 80 : 40;
    const suffForAppealDefense = isDefensible ? avgEvidenceScore : Math.max(0, avgEvidenceScore - 25);
    const suffForAppealNotRec = !isDefensible && avgEvidenceScore < 40 ? 80 : 30;

    // Clean old data and insert fresh
    await supabase.from("evidence_sufficiency").delete().eq("case_id", caseId);
    await supabase.from("evidence_sufficiency").insert({
      case_id: caseId,
      overall_score: avgEvidenceScore,
      sufficiency_for_approve: suffForApprove,
      sufficiency_for_deny: suffForDeny,
      sufficiency_for_info_request: suffForInfo,
      sufficiency_for_appeal_defense: suffForAppealDefense,
      sufficiency_for_appeal_not_recommended: suffForAppealNotRec,
      missing_evidence: uniqueMissing,
      is_defensible: isDefensible,
      is_under_supported: avgEvidenceScore < 50,
      source_weights_applied: {},
    });

    // ═══ Module 4: Contradiction Detector ═══
    console.log("═══ CONTRADICTION DETECTOR ═══");
    await supabase.from("contradictions").delete().eq("case_id", caseId);
    for (const c of allContradictions) {
      await supabase.from("contradictions").insert({
        case_id: caseId,
        contradiction_type: c.type || "general",
        description: c.description,
        explanation: c.explanation || null,
        severity: c.severity || "warning",
        source_a: c.sourceA || c.source_a || null,
        source_b: c.sourceB || c.source_b || null,
      });
    }

    // ═══ Module 5: Confidence Floor Enforcement ═══
    console.log("═══ CONFIDENCE FLOOR CHECK ═══");
    await supabase.from("processing_queue").update({
      current_step: "confidence_floor", progress: 82,
    }).eq("case_id", caseId);

    const confidenceFloorEvents: any[] = [];
    const avgConfidence = completedAnalyses.length > 0
      ? completedAnalyses.reduce((s, a) => s + a.confidence, 0) / completedAnalyses.length
      : 0;

    if (avgConfidence < CONFIDENCE_FLOOR.confidence) {
      humanReviewRequired = true;
      const event = {
        case_id: caseId,
        floor_type: "confidence",
        threshold_value: CONFIDENCE_FLOOR.confidence,
        actual_value: avgConfidence,
        uncertainty_drivers: completedAnalyses.filter(a => a.confidence < 50).map(a => ({ role: a.role, confidence: a.confidence })),
        routed_to_human: true,
        explanation: `Average role confidence (${avgConfidence.toFixed(0)}%) is below the ${CONFIDENCE_FLOOR.confidence}% threshold.`,
      };
      confidenceFloorEvents.push(event);
      await supabase.from("confidence_floor_events").insert(event);
    }

    const integrityScore = integrityResult?.integrityScore || finalConsensusScore;
    if (integrityScore < CONFIDENCE_FLOOR.consensusIntegrity) {
      humanReviewRequired = true;
      const event = {
        case_id: caseId,
        floor_type: "consensus_integrity",
        threshold_value: CONFIDENCE_FLOOR.consensusIntegrity,
        actual_value: integrityScore,
        uncertainty_drivers: integrityResult?.instabilityNotes?.map((n: string) => ({ note: n })) || [],
        routed_to_human: true,
        explanation: `Consensus integrity (${integrityScore}%) is below the ${CONFIDENCE_FLOOR.consensusIntegrity}% threshold.`,
      };
      confidenceFloorEvents.push(event);
      await supabase.from("confidence_floor_events").insert(event);
    }

    if (avgEvidenceScore < CONFIDENCE_FLOOR.evidenceSufficiency) {
      humanReviewRequired = true;
      const event = {
        case_id: caseId,
        floor_type: "evidence_sufficiency",
        threshold_value: CONFIDENCE_FLOOR.evidenceSufficiency,
        actual_value: avgEvidenceScore,
        uncertainty_drivers: uniqueMissing.slice(0, 5).map((m: any) => ({ missing: m.item, impact: m.impact })),
        routed_to_human: true,
        explanation: `Evidence sufficiency (${avgEvidenceScore.toFixed(0)}%) is below the ${CONFIDENCE_FLOOR.evidenceSufficiency}% threshold.`,
      };
      confidenceFloorEvents.push(event);
      await supabase.from("confidence_floor_events").insert(event);
    }

    // ═══ Module 2: Decision Trace ═══
    console.log("═══ DECISION TRACE ═══");
    await supabase.from("processing_queue").update({
      current_step: "decision_trace", progress: 86,
    }).eq("case_id", caseId);

    const integrityGrade = integrityResult?.integrityGrade || "not_assessed";

    await supabase.from("decision_traces").delete().eq("case_id", caseId);
    await supabase.from("decision_traces").insert({
      case_id: caseId,
      trace_entries: allDecisionTraceEntries,
      final_recommendation: humanReviewRequired ? "route_to_human" : (riskNum >= 60 ? "detailed_review" : "standard_review"),
      recommendation_rationale: humanReviewRequired
        ? `Confidence floor breached: ${confidenceFloorEvents.map(e => e.floor_type).join(", ")}. Human review required.`
        : `Risk: ${riskLevel} (${riskNum}), Consensus integrity: ${integrityGrade}, Evidence sufficiency: ${avgEvidenceScore.toFixed(0)}%`,
      confidence_at_completion: finalConsensusScore,
      consensus_integrity_grade: integrityGrade,
    });

    // ═══ Module 7: Action Pathway Recommender ═══
    console.log("═══ ACTION PATHWAY ═══");
    await supabase.from("processing_queue").update({
      current_step: "action_pathway", progress: 90,
    }).eq("case_id", caseId);

    let recommendedAction = "route_to_human";
    let actionRationale = "";
    let actionConfidence = 0;

    if (humanReviewRequired) {
      recommendedAction = "route_to_human";
      actionRationale = "Confidence floor enforcement triggered. Case complexity exceeds automated determination thresholds.";
      actionConfidence = 30;
    } else if (riskNum < 30 && avgEvidenceScore >= 70 && allContradictions.length === 0) {
      recommendedAction = "approve";
      actionRationale = "Low risk, sufficient evidence, no contradictions detected. Claim appears supportable.";
      actionConfidence = Math.min(90, finalConsensusScore);
    } else if (allContradictions.some(c => c.severity === "critical")) {
      recommendedAction = "pend_for_records";
      actionRationale = `Critical contradictions detected (${allContradictions.filter(c => c.severity === "critical").length}). Additional documentation needed.`;
      actionConfidence = 60;
    } else if (avgEvidenceScore < 50) {
      recommendedAction = "pend_for_records";
      actionRationale = `Evidence sufficiency is low (${avgEvidenceScore.toFixed(0)}%). Key documentation gaps must be resolved.`;
      actionConfidence = 55;
    } else if (riskNum >= 60 && isDefensible) {
      recommendedAction = "build_pre_appeal";
      actionRationale = "High risk but defensible with available evidence. Consider building pre-appeal documentation.";
      actionConfidence = 50;
    } else if (riskNum >= 60 && !isDefensible) {
      recommendedAction = "not_recommended_for_appeal";
      actionRationale = "High risk with insufficient evidence to support an appeal defense.";
      actionConfidence = 65;
    } else if (analysisResults.some(a => (a.violations as any[])?.some((v: any) => v.type === "modifier-misuse"))) {
      recommendedAction = "modifier_clarification";
      actionRationale = "Modifier-related issues identified. Clarification may resolve without full appeal.";
      actionConfidence = 55;
    } else {
      recommendedAction = "admin_correction";
      actionRationale = "Issues appear correctable through administrative channels.";
      actionConfidence = 50;
    }

    const alternativeActions: any[] = [];
    if (recommendedAction !== "approve" && riskNum < 50) {
      alternativeActions.push({ action: "approve", rationale: "Risk is moderate; may be approvable with additional review." });
    }
    if (recommendedAction !== "pend_for_records" && avgEvidenceScore < 60) {
      alternativeActions.push({ action: "pend_for_records", rationale: "Evidence gaps could be resolved with additional documentation." });
    }

    await supabase.from("action_pathways").delete().eq("case_id", caseId);
    await supabase.from("action_pathways").insert({
      case_id: caseId,
      recommended_action: recommendedAction,
      action_rationale: actionRationale,
      confidence_in_recommendation: actionConfidence,
      input_factors: {
        riskScore: riskNum,
        riskLevel,
        evidenceSufficiency: avgEvidenceScore,
        contradictionCount: allContradictions.length,
        confidenceFloorBreached: confidenceFloorEvents.length > 0,
        consensusIntegrityGrade: integrityGrade,
        driftStable: isStable,
      },
      alternative_actions: alternativeActions,
      is_human_review_required: humanReviewRequired,
    });

    // ═══ Module 8: Minimal Winning Packet Builder ═══
    console.log("═══ MINIMAL WINNING PACKET ═══");
    const packetChecklist: any[] = [];
    for (const missing of uniqueMissing) {
      const isCurable = missing.obtainable !== false;
      const effort = missing.impact === "high" || missing.impact === "critical" ? "high" : "low";
      packetChecklist.push({
        item: missing.item,
        category: missing.category || "documentation",
        priority: missing.impact === "high" || missing.impact === "critical" ? "high" : missing.impact === "medium" ? "medium" : "low",
        isMissing: true,
        isCurable,
        effort,
        impactIfObtained: missing.impact || "unknown",
      });
    }

    packetChecklist.sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      if (a.isCurable !== b.isCurable) return a.isCurable ? -1 : 1;
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    const curableCount = packetChecklist.filter(p => p.isCurable).length;
    const notWorthChasing = packetChecklist.filter(p => !p.isCurable || p.priority === "low").length;

    await supabase.from("minimal_winning_packets").delete().eq("case_id", caseId);
    await supabase.from("minimal_winning_packets").insert({
      case_id: caseId,
      checklist: packetChecklist,
      top_priority_item: packetChecklist[0]?.item || null,
      estimated_curable_count: curableCount,
      estimated_not_worth_chasing: notWorthChasing,
    });

    // ═══ Calibration Logging ═══
    console.log("═══ CALIBRATION LOGGING ═══");
    await supabase.from("processing_queue").update({
      current_step: "calibration", progress: 94,
    }).eq("case_id", caseId);

    const predictedOutcome = humanReviewRequired ? "human-review" : (riskNum >= 60 ? "rejected" : riskNum >= 40 ? "info-requested" : "approved");
    const roleWeights: Record<string, number> = {};
    for (const a of analysisResults) {
      roleWeights[a.role] = a.confidence;
    }

    await supabase.from("engine_calibration").delete().eq("case_id", caseId);
    await supabase.from("engine_calibration").insert({
      case_id: caseId,
      predicted_outcome: predictedOutcome,
      predicted_confidence: finalConsensusScore,
      role_weights: roleWeights,
      calibration_notes: `CI grade: ${integrityGrade}. Evidence sufficiency: ${avgEvidenceScore.toFixed(0)}%. Contradictions: ${allContradictions.length}. Action: ${recommendedAction}.`,
    });

    // ── Physician Behavioral Fingerprint ──
    let physicianFingerprint: any = null;
    const { data: relatedCases } = await supabase
      .from("audit_cases")
      .select("id, case_number, cpt_codes, status, consensus_score, risk_score, physician_name")
      .eq("physician_id", auditCase.physician_id)
      .neq("id", caseId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (relatedCases && relatedCases.length >= 3) {
      const allCodes = relatedCases.flatMap(c => c.cpt_codes || []);
      const codeFreq: Record<string, number> = {};
      for (const code of allCodes) codeFreq[code] = (codeFreq[code] || 0) + 1;
      const topCodes = Object.entries(codeFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const riskScores = relatedCases.map(c => (c.risk_score as any)?.score || 0).filter((s: number) => s > 0);
      const avgRisk = riskScores.length > 0 ? riskScores.reduce((a: number, b: number) => a + b, 0) / riskScores.length : 0;

      physicianFingerprint = {
        physician: auditCase.physician_name,
        totalCases: relatedCases.length + 1,
        topCodes: topCodes.map(([code, count]) => ({ code, frequency: count })),
        avgRiskScore: avgRisk,
        rejectionRate: relatedCases.filter(c => c.status === "rejected").length / relatedCases.length,
        patternFlags: avgRisk > 60 ? ["elevated_risk_pattern"] : [],
      };
    }

    // ── Load source weights for metadata ──
    const { data: sourceWeights } = await supabase.from("source_weights").select("*");
    const weightMap: Record<string, number> = {};
    (sourceWeights || []).forEach((sw: any) => { weightMap[sw.source_type] = Number(sw.base_weight); });

    // ── Update evidence_sufficiency with source weights ──
    if (Object.keys(weightMap).length > 0) {
      await supabase.from("evidence_sufficiency").update({
        source_weights_applied: weightMap,
      }).eq("case_id", caseId);
    }

    // ── Update case with final results ──
    await supabase.from("audit_cases").update({
      consensus_score: finalConsensusScore,
      risk_score: {
        level: riskLevel,
        score: riskNum,
        rawScore: riskNum,
        percentile: Math.min(99, riskNum + 5),
        confidence: Math.round(completedAnalyses.reduce((s, a) => s + a.confidence, 0) / Math.max(1, completedAnalyses.length)),
        recommendation: riskNum >= 60
          ? "Detailed review recommended. Multiple potential violations identified."
          : "Standard review. Case appears largely compliant.",
        dataCompleteness: { score: Math.round(avgEvidenceScore), present: ["CPT codes", "ICD-10 codes", "Source text"], missing: uniqueMissing.map((m: any) => m.item) },
        factors: [],
      },
      metadata: {
        ...(auditCase.metadata as any || {}),
        engineVersion: "SOUPY-v3",
        consensusIntegrityGrade: integrityGrade,
        evidenceSufficiencyScore: avgEvidenceScore,
        contradictionsFound: allContradictions.length,
        recommendedAction,
        humanReviewRequired,
        confidenceFloorEvents: confidenceFloorEvents.length,
        physicianFingerprint,
        payerProfile: (auditCase.metadata as any)?.payerProfile || null,
        crossCaseCount: relatedCases?.length || 0,
        driftStable: isStable,
        driftScore,
      },
    }).eq("id", caseId);

    await supabase.from("processing_queue").update({
      status: "complete", current_step: "complete", progress: 100, completed_at: new Date().toISOString(),
    }).eq("case_id", caseId);

    console.log(`═══ V3 MODULES COMPLETE ═══`);
    console.log(`Consensus: ${finalConsensusScore} | Risk: ${riskNum} (${riskLevel}) | CI: ${integrityGrade} | Evidence: ${avgEvidenceScore.toFixed(0)}% | Contradictions: ${allContradictions.length} | Action: ${recommendedAction} | Human: ${humanReviewRequired}`);

    return new Response(JSON.stringify({
      success: true,
      consensusScore: finalConsensusScore,
      riskScore: riskNum,
      engineFeatures: {
        engineVersion: "SOUPY-v3",
        consensusIntegrity: integrityGrade,
        evidenceSufficiency: avgEvidenceScore,
        contradictionsFound: allContradictions.length,
        recommendedAction,
        humanReviewRequired,
        confidenceFloorBreached: confidenceFloorEvents.length > 0,
        driftStable: isStable,
        physicianFingerprint: !!physicianFingerprint,
        calibrationLogged: true,
        minimalWinningPacket: packetChecklist.length > 0,
        sourceWeightsApplied: Object.keys(weightMap).length > 0,
        decisionTraceStored: true,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("analyze-v3 error:", e);
    const status = e?.status || 500;
    return new Response(JSON.stringify({
      error: e?.message || "An internal error occurred during v3 module processing."
    }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
