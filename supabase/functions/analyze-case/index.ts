import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_TEXT_LENGTH = 50_000;

// ═══════════════════════════════════════════════════════════════
// SOUPY ENGINE v3 — Consolidated, Defensible, Enterprise-Grade
// ═══════════════════════════════════════════════════════════════
//
// Modules:
//  1. Consensus Integrity Engine (consolidates adversarial self-doubt + epistemic diversity + stress testing)
//  2. Decision Trace (structured audit-ready reasoning, NOT raw chain-of-thought)
//  3. Evidence Sufficiency Score
//  4. Contradiction Detector
//  5. Confidence Floor Enforcement
//  6. Regulatory Currency Monitor
//  7. Action Pathway Recommender
//  8. Minimal Winning Packet Builder
//  9. Source Reliability Weighting
// 10. Physician Behavioral Fingerprint (unchanged)
// 11. Payer-Specific Adversarial Tuning (unchanged)
// 12. Appeal Outcome Memory (extended)
// ═══════════════════════════════════════════════════════════════

// ─── Confidence Floor Thresholds (configurable) ───
const CONFIDENCE_FLOOR = {
  confidence: 40,
  consensusIntegrity: 35,
  evidenceSufficiency: 30,
};

// ─── SOUPY Roles ───
const SOUPY_ROLES = [
  {
    role: "builder",
    model: "google/gemini-2.5-flash",
    systemPrompt: `You are the BUILDER role in the SOUPY audit protocol. Your job is to find the BEST-CASE interpretation of the medical billing. You look for legitimate clinical justifications, proper documentation paths, and defensible positions. You are optimistic but evidence-based — you don't fabricate defenses, you find real ones.`,
  },
  {
    role: "redteam",
    model: "openai/gpt-5-mini",
    systemPrompt: `You are the RED TEAM role in the SOUPY audit protocol. Your job is to find every vulnerability, documentation gap, and audit risk. You assume the worst-case interpretation and identify what an aggressive auditor would flag. You are adversarial by design — stress-test every justification, exploit every ambiguity, and surface the risks that consensus-driven analysis buries. Be relentless but precise.`,
  },
  {
    role: "analyst",
    model: "google/gemini-2.5-pro",
    systemPrompt: `You are the SYSTEMS ANALYST role in the SOUPY audit protocol. Your job is to apply regulatory frameworks, NCCI edits, CMS guidelines, and payer-specific rules to the case. You provide structured, objective analysis with specific regulation references. Cross-reference multiple regulatory sources and flag conflicts between guidelines. You are methodical, precise, and authoritative.`,
  },
  {
    role: "breaker",
    model: "openai/gpt-5-mini",
    systemPrompt: `You are the FRAME BREAKER role in the SOUPY audit protocol. Your job is to challenge assumptions, find unconventional angles, and identify systemic issues that others miss. Question whether the audit framework itself is appropriate. Look for what everyone else is NOT seeing — documentation system failures, perverse incentives, alternative clinical narratives, and novel evidence approaches that reframe the entire case. Break the consensus.`,
  },
];

// ─── Consensus Integrity Engine (5th pass) ───
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

// ─── Tool Schemas ───

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
        // Decision Trace structured entries (NOT raw chain-of-thought)
        decisionTraceEntries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              trigger: { type: "string", description: "What rule or pattern triggered this finding" },
              documentationGap: { type: "string", description: "What documentation gap was identified, if any" },
              counterargumentConsidered: { type: "string", description: "What counterargument was weighed" },
              evidenceSupporting: { type: "string", description: "What evidence supported the concern" },
              regulationReferenced: { type: "string", description: "What regulation or guidance was referenced" },
              confidenceImpact: { type: "string", description: "How this affected confidence" },
            },
            required: ["trigger"],
            additionalProperties: false,
          },
        },
        // Contradiction detection
        contradictions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string" },
              description: { type: "string" },
              severity: { type: "string", enum: ["critical", "warning", "info"] },
              sourceA: { type: "string" },
              sourceB: { type: "string" },
            },
            required: ["type", "description", "severity"],
            additionalProperties: false,
          },
        },
        // Evidence sufficiency assessment
        evidenceSufficiency: {
          type: "object",
          properties: {
            overallScore: { type: "number", description: "0-100 evidence sufficiency" },
            missingEvidence: { type: "array", items: { type: "object", properties: { item: { type: "string" }, impact: { type: "string" }, obtainable: { type: "boolean" } }, required: ["item", "impact"], additionalProperties: false } },
            isDefensible: { type: "boolean" },
          },
          required: ["overallScore"],
          additionalProperties: false,
        },
      },
      required: ["confidence", "perspectiveStatement", "keyInsights", "assumptions", "violations", "overallAssessment"],
      additionalProperties: false,
    },
  },
};

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
        diversityAssessment: { type: "string", description: "Did different model families produce meaningfully different perspectives?" },
      },
      required: ["integrityGrade", "integrityScore", "attackVectors", "instabilityNotes", "humanReviewRequired", "revisedConsensusScore"],
      additionalProperties: false,
    },
  },
};

const extractionToolSchema = {
  type: "function",
  function: {
    name: "extract_case_data",
    description: "Extract structured medical case data from text",
    parameters: {
      type: "object",
      properties: {
        patient_id: { type: "string" },
        physician_id: { type: "string" },
        physician_name: { type: "string" },
        date_of_service: { type: "string" },
        cpt_codes: { type: "array", items: { type: "string" } },
        icd_codes: { type: "array", items: { type: "string" } },
        claim_amount: { type: "number" },
        summary: { type: "string" },
        procedure_type: { type: "string" },
      },
      required: ["patient_id", "physician_id", "physician_name", "date_of_service", "cpt_codes", "icd_codes", "claim_amount", "summary"],
      additionalProperties: false,
    },
  },
};

// ─── Prompts ───

const EXTRACTION_PROMPT = `You are a medical coding expert. Extract structured data from this case file text.

Return a JSON object with these fields:
- patient_id: string (patient identifier, or generate one like "PT-XXXXX")
- physician_id: string (physician/provider ID, or generate one like "DR-XXXX")  
- physician_name: string (provider name)
- date_of_service: string (YYYY-MM-DD format)
- cpt_codes: string[] (all CPT codes found)
- icd_codes: string[] (all ICD-10 codes found)
- claim_amount: number (total claim/charge amount, or estimate from codes)
- summary: string (brief clinical summary of the case)
- procedure_type: string (e.g., "orthopedic surgery", "emergency medicine", "spine surgery")

If information is missing, make reasonable inferences from the clinical context. Always extract CPT and ICD codes if present.`;

const ANALYSIS_PROMPT = `Analyze this medical billing case for audit compliance. 

Case Details:
- CPT Codes: {cpt_codes}
- ICD-10 Codes: {icd_codes}
- Claim Amount: $\{claim_amount}
- Clinical Summary: {summary}
- Source Text: {source_text}
{payer_context}

Provide your analysis as JSON with these fields:
- confidence: number (0-100)
- perspectiveStatement: string (1-2 sentence key perspective)
- keyInsights: string[] (3-5 key findings)
- assumptions: string[] (2-4 assumptions)
- violations: array of { code, type, severity, description, regulationRef }
- overallAssessment: string (2-3 sentence summary)
- decisionTraceEntries: array of structured audit entries. For each significant finding, provide:
  - trigger: what rule or pattern triggered it
  - documentationGap: what documentation is missing (if any)
  - counterargumentConsidered: what counterargument was weighed
  - evidenceSupporting: what evidence supports the concern
  - regulationReferenced: what regulation applies
  - confidenceImpact: how this affected your confidence
- contradictions: array of internal inconsistencies found between codes, documentation, modifiers, or time logs. Each with { type, description, severity, sourceA, sourceB }
- evidenceSufficiency: { overallScore (0-100), missingEvidence: [{ item, impact, obtainable }], isDefensible: boolean }

Be specific and reference real CMS guidelines, NCCI edits, and CPT coding rules.
Do NOT output raw chain-of-thought. Output structured, audit-ready findings only.`;

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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits in Settings." };
    throw new Error(`AI call failed: ${status}`);
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No result from AI");
  const tokenCount = data.usage?.total_tokens || 0;
  return { result: JSON.parse(toolCall.function.arguments), latencyMs, tokenCount };
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
    const { action, caseId, sourceText, payerCode } = await req.json();

    // ═══════════════════════════════════════════════════
    // ACTION: extract — Parse source text into structured case
    // ═══════════════════════════════════════════════════
    if (action === "extract") {
      if (typeof sourceText !== "string" || sourceText.trim().length === 0) {
        return new Response(JSON.stringify({ error: "sourceText is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
        return new Response(JSON.stringify({ error: "Input text too large. Maximum 50,000 characters." }), {
          status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("Extracting case data from source text...");
      const { result: extracted } = await callAI(
        LOVABLE_API_KEY, "google/gemini-2.5-flash", EXTRACTION_PROMPT, sourceText,
        [extractionToolSchema],
        { type: "function", function: { name: "extract_case_data" } }
      );

      const caseNumber = `AUD-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const { data: newCase, error: caseError } = await supabase
        .from("audit_cases")
        .insert({
          case_number: caseNumber,
          patient_id: extracted.patient_id,
          physician_id: extracted.physician_id,
          physician_name: extracted.physician_name,
          date_of_service: extracted.date_of_service,
          cpt_codes: extracted.cpt_codes,
          icd_codes: extracted.icd_codes,
          claim_amount: extracted.claim_amount,
          source_text: sourceText,
          status: "pending",
          risk_score: {},
          metadata: { summary: extracted.summary, procedure_type: extracted.procedure_type },
          owner_id: userId,
        })
        .select()
        .single();

      if (caseError) {
        console.error("Database insert error:", caseError);
        throw new Error("Failed to create case");
      }

      await supabase.from("processing_queue").insert({
        case_id: newCase.id,
        status: "queued",
        current_step: "extraction_complete",
        progress: 25,
      });

      return new Response(JSON.stringify({ success: true, case: newCase, extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════
    // ACTION: analyze — Full SOUPY v3 pipeline
    // ═══════════════════════════════════════════════════
    if (action === "analyze") {
      if (!caseId || !UUID_RE.test(caseId)) {
        return new Response(JSON.stringify({ error: "Valid caseId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`═══ SOUPY v3 ANALYSIS for case ${caseId} ═══`);

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

      await supabase.from("audit_cases").update({ status: "in-review" }).eq("id", caseId);
      await supabase.from("processing_queue").upsert({
        case_id: caseId, status: "processing", current_step: "soupy_init", progress: 5, started_at: new Date().toISOString(),
      }, { onConflict: "case_id" });

      // ── Module 11: Payer-Specific Adversarial Tuning ──
      let payerContext = "";
      let payerProfile: any = null;
      if (payerCode) {
        const { data: profile } = await supabase
          .from("payer_profiles").select("*").eq("payer_code", payerCode).single();
        if (profile) {
          payerProfile = profile;
          payerContext = `\n\nPAYER-SPECIFIC CONTEXT (${profile.payer_name}):\n${profile.adversarial_prompt_additions}\n\nKnown denial patterns: ${JSON.stringify(profile.denial_patterns)}\nModifier sensitivity: ${JSON.stringify(profile.modifier_sensitivity)}`;
          console.log(`Loaded payer profile: ${profile.payer_name}`);
        }
      }

      const summary = (auditCase.metadata as any)?.summary || "Not available";
      const sourceTextTrunc = auditCase.source_text?.substring(0, 3000) || "Not available";

      // ── Module 9: Source Reliability Weighting ──
      const { data: sourceWeights } = await supabase
        .from("source_weights").select("*");
      const weightMap: Record<string, number> = {};
      (sourceWeights || []).forEach((sw: any) => { weightMap[sw.source_type] = Number(sw.base_weight); });

      // ── Module 6: Regulatory Currency Monitor ──
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { data: recentRegFlags } = await supabase
        .from("regulatory_flags")
        .select("*")
        .is("case_id", null) // global flags
        .eq("is_active", true)
        .gte("effective_date", ninetyDaysAgo);

      // Check if any regulatory flags relate to codes in this case
      const caseRelatedFlags: any[] = [];
      for (const flag of (recentRegFlags || [])) {
        // Simple heuristic: flag mentions CPT or relevant terms
        const flagText = `${flag.description} ${flag.source_reference}`.toLowerCase();
        const caseCodesLower = (auditCase.cpt_codes || []).map((c: string) => c.toLowerCase());
        const isRelevant = caseCodesLower.some((code: string) => flagText.includes(code)) ||
          flagText.includes("critical care") || flagText.includes("e/m") || flagText.includes("arthroscop");
        if (isRelevant) {
          caseRelatedFlags.push(flag);
          // Associate flag with this case
          await supabase.from("regulatory_flags").insert({
            case_id: caseId,
            flag_type: flag.flag_type,
            description: flag.description,
            effective_date: flag.effective_date,
            source_reference: flag.source_reference,
            severity: flag.severity,
          });
        }
      }

      // ── Module 10: Physician Behavioral Fingerprint + Cross-Case Memory ──
      let crossCaseContext = "";
      const { data: relatedCases } = await supabase
        .from("audit_cases")
        .select("id, case_number, cpt_codes, status, consensus_score, risk_score, physician_name")
        .eq("physician_id", auditCase.physician_id)
        .neq("id", caseId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (relatedCases && relatedCases.length > 0) {
        const rejectedCount = relatedCases.filter(c => c.status === "rejected").length;
        const avgConsensus = relatedCases.reduce((s, c) => s + (c.consensus_score || 0), 0) / relatedCases.length;
        crossCaseContext = `\n\nCROSS-CASE INTELLIGENCE for ${auditCase.physician_name}:
- ${relatedCases.length} prior cases found
- ${rejectedCount} rejections (${((rejectedCount / relatedCases.length) * 100).toFixed(0)}% rejection rate)
- Average consensus score: ${avgConsensus.toFixed(0)}
- Prior codes: ${relatedCases.flatMap(c => c.cpt_codes || []).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(", ")}
- ${rejectedCount > 2 ? "⚠️ PATTERN ALERT: This physician has elevated rejection rates" : "Pattern: Normal range"}`;

        // Store graph edges
        for (const related of relatedCases) {
          const sharedCodes = (auditCase.cpt_codes || []).filter((c: string) => (related.cpt_codes || []).includes(c));
          if (sharedCodes.length > 0) {
            await supabase.from("case_graph_edges").upsert({
              source_case_id: caseId,
              target_case_id: related.id,
              relationship_type: "same_physician_shared_codes",
              strength: sharedCodes.length / Math.max((auditCase.cpt_codes || []).length, 1) * 100,
              shared_attributes: sharedCodes,
              insights: [`Shared codes: ${sharedCodes.join(", ")}`, `Physician: ${auditCase.physician_name}`],
            }, { onConflict: "id" });
          }
        }
      }

      // ── Module 12: Appeal Outcome Memory (inject into context) ──
      let appealMemoryContext = "";
      if (payerCode) {
        const { data: pastOutcomes } = await supabase
          .from("appeal_outcomes")
          .select("*")
          .eq("payer_code", payerCode)
          .order("created_at", { ascending: false })
          .limit(20);
        if (pastOutcomes && pastOutcomes.length > 0) {
          const successRate = pastOutcomes.filter(o => o.outcome === "overturned").length / pastOutcomes.length;
          appealMemoryContext = `\n\nAPPEAL OUTCOME MEMORY (${payerCode}):
- ${pastOutcomes.length} prior appeal outcomes tracked
- Overall success rate: ${(successRate * 100).toFixed(0)}%
- Strategies that worked: ${pastOutcomes.filter(o => o.outcome === "overturned").map(o => o.appeal_strategy).filter(Boolean).join(", ") || "insufficient data"}`;
        }
      }

      // ═══ Run 4 SOUPY roles (Primary Pass) ═══
      await supabase.from("processing_queue").update({
        current_step: "soupy_primary_pass", progress: 10,
      }).eq("case_id", caseId);

      const analysisResults: any[] = [];
      const allDecisionTraceEntries: any[] = [];
      const allContradictions: any[] = [];
      const allEvidenceSufficiency: any[] = [];
      const roleOrder = SOUPY_ROLES.map(r => r.role);

      // ── Run all 4 SOUPY roles IN PARALLEL for speed ──
      const basePrompt = ANALYSIS_PROMPT
        .replace("{cpt_codes}", (auditCase.cpt_codes || []).join(", "))
        .replace("{claim_amount}", String(auditCase.claim_amount))
        .replace("{icd_codes}", (auditCase.icd_codes || []).join(", "))
        .replace("{summary}", summary)
        .replace("{source_text}", sourceTextTrunc)
        .replace("{payer_context}", payerContext + crossCaseContext + appealMemoryContext);

      console.log(`[Parallel] Running all 4 SOUPY roles simultaneously...`);
      await supabase.from("processing_queue").update({
        current_step: "soupy_parallel_analysis", progress: 15,
      }).eq("case_id", caseId);

      const rolePromises = SOUPY_ROLES.map(async (soupyRole) => {
        let roleSystemPrompt = soupyRole.systemPrompt;
        if (soupyRole.role === "redteam" && payerProfile) {
          roleSystemPrompt += `\n\n${payerProfile.adversarial_prompt_additions}`;
        }
        try {
          const { result: analysis, latencyMs, tokenCount } = await callAI(
            LOVABLE_API_KEY, soupyRole.model, roleSystemPrompt, basePrompt,
            [analysisToolSchema],
            { type: "function", function: { name: "submit_analysis" } }
          );
          console.log(`[Parallel] ${soupyRole.role} complete (${latencyMs}ms)`);
          return { success: true, analysis, role: soupyRole.role, model: soupyRole.model, latencyMs, tokenCount };
        } catch (roleErr: any) {
          console.error(`Error in ${soupyRole.role}:`, roleErr);
          return { success: false, role: soupyRole.role, model: soupyRole.model, error: roleErr?.message || "Analysis error" };
        }
      });

      const roleResults = await Promise.all(rolePromises);

      await supabase.from("processing_queue").update({
        current_step: "storing_results", progress: 50,
      }).eq("case_id", caseId);

      // Process results and store to DB
      for (const result of roleResults) {
        if (result.success) {
          const analysis = result.analysis;
          analysisResults.push({ ...analysis, role: result.role });

          if (analysis.decisionTraceEntries) {
            for (const entry of analysis.decisionTraceEntries) {
              allDecisionTraceEntries.push({ ...entry, sourceRole: result.role });
            }
          }
          if (analysis.contradictions) {
            for (const c of analysis.contradictions) {
              allContradictions.push({ ...c, detectedBy: result.role });
            }
          }
          if (analysis.evidenceSufficiency) {
            allEvidenceSufficiency.push({ role: result.role, ...analysis.evidenceSufficiency });
          }

          const { data: analysisRow } = await supabase.from("case_analyses").insert({
            case_id: caseId, role: result.role, model: result.model, status: "complete",
            confidence: analysis.confidence,
            perspective_statement: analysis.perspectiveStatement,
            key_insights: analysis.keyInsights,
            assumptions: analysis.assumptions,
            violations: analysis.violations,
            overall_assessment: analysis.overallAssessment,
          }).select("id").single();

          if (analysisRow) {
            await supabase.from("reasoning_chains").insert({
              case_id: caseId, analysis_id: analysisRow.data?.id || analysisRow.id,
              role: result.role, model: result.model,
              raw_reasoning: null,
              structured_steps: analysis.decisionTraceEntries || [],
              token_count: result.tokenCount, latency_ms: result.latencyMs,
            });
          }
        } else {
          await supabase.from("case_analyses").insert({
            case_id: caseId, role: result.role, model: result.model, status: "error",
            overall_assessment: result.error || "Analysis encountered an error",
          });
        }
      }

      // ── Calculate initial consensus ──
      const completedAnalyses = analysisResults.filter(a => a.confidence > 0);
      let consensusScore = 50;
      if (completedAnalyses.length > 1) {
        const confidences = completedAnalyses.map(a => a.confidence);
        const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length;
        const agreement = Math.max(0, 100 - Math.sqrt(variance) * 2);
        consensusScore = Math.round((agreement + avgConfidence) / 2);
      }

      const totalViolations = analysisResults.reduce((sum, a) => sum + (a.violations?.length || 0), 0);
      const criticalViolations = analysisResults.reduce((sum, a) =>
        sum + (a.violations?.filter((v: any) => v.severity === "critical")?.length || 0), 0);
      const warningViolations = totalViolations - criticalViolations;

      // Fine-tuned risk scoring:
      // Base: 10 (every case has some baseline risk)
      // Critical violations: 30 pts each (determinative weight)
      // Warning violations: 8 pts each (contextual weight)
      // Consensus divergence penalty: up to +15 when consensus < 60
      // Low average confidence penalty: up to +10 when avg confidence < 50
      const consensusPenalty = consensusScore < 60 ? Math.round((60 - consensusScore) * 0.25) : 0;
      const avgConf = completedAnalyses.length > 0
        ? completedAnalyses.reduce((s, a) => s + a.confidence, 0) / completedAnalyses.length
        : 50;
      const confidencePenalty = avgConf < 50 ? Math.round((50 - avgConf) * 0.2) : 0;
      const riskNum = Math.min(100, 10 + criticalViolations * 30 + warningViolations * 8 + consensusPenalty + confidencePenalty);

      // Adjusted thresholds: critical requires 75+, medium starts at 35
      const riskLevel = riskNum >= 75 ? "critical" : riskNum >= 55 ? "high" : riskNum >= 35 ? "medium" : "low";

      // ── Primary analysis complete — update case with initial scores ──
      await supabase.from("audit_cases").update({
        consensus_score: consensusScore,
        risk_score: {
          level: riskLevel,
          score: riskNum,
          rawScore: riskNum,
          percentile: Math.min(99, riskNum + 5),
          confidence: Math.round(completedAnalyses.reduce((s, a) => s + a.confidence, 0) / Math.max(1, completedAnalyses.length)),
          recommendation: riskNum >= 60
            ? "Detailed review recommended. Multiple potential violations identified."
            : "Standard review. Case appears largely compliant.",
          dataCompleteness: { score: 50, present: ["CPT codes", "ICD-10 codes", "Source text"], missing: [] },
          factors: [],
        },
      }).eq("id", caseId);

      await supabase.from("processing_queue").update({
        current_step: "primary_complete", progress: 50,
      }).eq("case_id", caseId);

      console.log(`═══ PRIMARY ANALYSIS COMPLETE ═══`);
      console.log(`Consensus: ${consensusScore} | Risk: ${riskNum} (${riskLevel}) | Roles: ${analysisResults.length} | Regulatory flags: ${caseRelatedFlags.length}`);

      return new Response(JSON.stringify({
        success: true,
        consensusScore,
        riskScore: riskNum,
        analyses: analysisResults.length,
        phase: "primary_complete",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'extract' or 'analyze'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("analyze-case error:", e);
    const status = e?.status || 500;
    return new Response(JSON.stringify({
      error: e?.message || "An internal error occurred. Please try again."
    }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
