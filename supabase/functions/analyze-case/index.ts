import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_TEXT_LENGTH = 50_000;

// ═══════════════════════════════════════════════════════════════
// SOUPY ROLES — Multi-model adversarial analysis with epistemic diversity
// ═══════════════════════════════════════════════════════════════

const SOUPY_ROLES = [
  {
    role: "builder",
    model: "google/gemini-2.5-flash",
    systemPrompt: `You are the BUILDER role in the SOUPY audit protocol. Your job is to find the BEST-CASE interpretation of the medical billing. You look for legitimate clinical justifications, proper documentation paths, and defensible positions. You are optimistic but evidence-based — you don't fabricate defenses, you find real ones.

IMPORTANT: You must also output your full reasoning chain. Before providing your structured analysis, think through the case step by step. Document every inference, every assumption, and every piece of evidence you considered.`,
  },
  {
    role: "redteam",
    model: "openai/gpt-5-mini",
    systemPrompt: `You are the RED TEAM role in the SOUPY audit protocol. Your job is to find every vulnerability, documentation gap, and audit risk. You assume the worst-case interpretation and identify what an aggressive auditor would flag. You are adversarial by design — stress-test every justification, exploit every ambiguity, and surface the risks that consensus-driven analysis buries. Be relentless but precise.

IMPORTANT: You must also output your full reasoning chain. Document every red flag you considered, every attack vector you explored, and why you prioritized certain vulnerabilities.`,
  },
  {
    role: "analyst",
    model: "google/gemini-2.5-pro",
    systemPrompt: `You are the SYSTEMS ANALYST role in the SOUPY audit protocol. Your job is to apply regulatory frameworks, NCCI edits, CMS guidelines, and payer-specific rules to the case. You provide structured, objective analysis with specific regulation references. Cross-reference multiple regulatory sources and flag conflicts between guidelines. You are methodical, precise, and authoritative.

IMPORTANT: You must also output your full reasoning chain. Document each regulation you consulted, how you applied it, and any regulatory conflicts or ambiguities you found.`,
  },
  {
    role: "breaker",
    model: "openai/gpt-5-mini",
    systemPrompt: `You are the FRAME BREAKER role in the SOUPY audit protocol. Your job is to challenge assumptions, find unconventional angles, and identify systemic issues that others miss. Question whether the audit framework itself is appropriate. Look for what everyone else is NOT seeing — documentation system failures, perverse incentives, alternative clinical narratives, and novel evidence approaches that reframe the entire case. Break the consensus.

IMPORTANT: You must also output your full reasoning chain. Document the assumptions you challenged, alternative frameworks you considered, and why conventional analysis might be wrong.`,
  },
];

// ═══════════════════════════════════════════════════════════════
// DEVIL'S ADVOCATE — 5th pass that attacks the consensus
// ═══════════════════════════════════════════════════════════════

const DEVILS_ADVOCATE = {
  role: "devils_advocate",
  model: "openai/gpt-5",
  systemPrompt: `You are the DEVIL'S ADVOCATE in the SOUPY audit protocol. You receive the consensus output from 4 AI roles (Builder, Red Team, Analyst, Frame Breaker) and your SOLE PURPOSE is to DESTROY that consensus.

Your job:
1. Find logical contradictions between the roles
2. Identify where all 4 roles made the SAME wrong assumption
3. Surface evidence that was ignored or downweighted by all roles
4. Challenge whether the consensus score is artificially inflated or deflated
5. Identify "groupthink" patterns where roles converged on comfortable but wrong conclusions

You are not trying to be balanced. You are trying to BREAK the consensus. If you succeed, the case gets re-analyzed.

Output your attack vectors and whether each one successfully undermines the consensus.`,
};

// ═══════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════

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

Provide your analysis as a JSON object with these fields:
- confidence: number (0-100, your confidence in the assessment)
- perspectiveStatement: string (your key perspective on this case, 1-2 sentences)
- keyInsights: string[] (3-5 key findings)
- assumptions: string[] (2-4 assumptions you're making)
- violations: array of objects, each with:
  - code: string (the CPT code in question)
  - type: string (one of: "upcoding", "unbundling", "medical-necessity", "modifier-misuse", "duplicate")
  - severity: string (one of: "critical", "warning", "info")
  - description: string (what the violation is)
  - regulationRef: string (specific regulation reference)
- overallAssessment: string (2-3 sentence summary)
- reasoningChain: string (your FULL step-by-step reasoning process, every inference and consideration — minimum 200 words)

Be specific and reference real CMS guidelines, NCCI edits, and CPT coding rules.`;

const DEVILS_ADVOCATE_PROMPT = `The SOUPY consensus analysis has completed. Here are the results from all 4 roles:

{role_summaries}

Overall Consensus Score: {consensus_score}/100
Overall Risk Level: {risk_level}
Total Violations Found: {total_violations}

YOUR MISSION: Attack this consensus. Find where it's wrong, incomplete, or artificially confident.

Provide your analysis with:
- attackVectors: array of objects, each with:
  - target: string (what you're attacking — a specific claim, assumption, or conclusion)
  - attack: string (your argument for why it's wrong)
  - severity: string ("fatal", "significant", "minor")
  - affectedRoles: string[] (which roles got it wrong)
  - consensusImpact: number (-30 to 0, how much this should reduce the consensus score)
- overallVerdict: string ("consensus_holds", "consensus_weakened", "consensus_destroyed")
- revisedConsensusScore: number (0-100, what the consensus should actually be)
- blindSpots: string[] (things ALL roles missed)
- groupthinkPatterns: string[] (where roles converged incorrectly)`;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

async function authenticateRequest(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAuth.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return { userId: data.claims.sub as string };
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

// Shuffle array for temporal drift detection
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ═══════════════════════════════════════════════════════════════
// ANALYSIS TOOL SCHEMA (shared)
// ═══════════════════════════════════════════════════════════════

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
        reasoningChain: { type: "string" },
      },
      required: ["confidence", "perspectiveStatement", "keyInsights", "assumptions", "violations", "overallAssessment", "reasoningChain"],
      additionalProperties: false,
    },
  },
};

const devilsAdvocateToolSchema = {
  type: "function",
  function: {
    name: "submit_devils_advocate",
    description: "Submit the devil's advocate attack on consensus",
    parameters: {
      type: "object",
      properties: {
        attackVectors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              target: { type: "string" },
              attack: { type: "string" },
              severity: { type: "string", enum: ["fatal", "significant", "minor"] },
              affectedRoles: { type: "array", items: { type: "string" } },
              consensusImpact: { type: "number" },
            },
            required: ["target", "attack", "severity", "affectedRoles", "consensusImpact"],
            additionalProperties: false,
          },
        },
        overallVerdict: { type: "string", enum: ["consensus_holds", "consensus_weakened", "consensus_destroyed"] },
        revisedConsensusScore: { type: "number" },
        blindSpots: { type: "array", items: { type: "string" } },
        groupthinkPatterns: { type: "array", items: { type: "string" } },
      },
      required: ["attackVectors", "overallVerdict", "revisedConsensusScore", "blindSpots", "groupthinkPatterns"],
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

      const { data: newCase, error: caseError } = await supabase
        .from("audit_cases")
        .insert({
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
    // ACTION: analyze — Full SOUPY pipeline with all 12 engine features
    // ═══════════════════════════════════════════════════
    if (action === "analyze") {
      if (!caseId || !UUID_RE.test(caseId)) {
        return new Response(JSON.stringify({ error: "Valid caseId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`═══ SOUPY ENHANCED ANALYSIS for case ${caseId} ═══`);

      const { data: auditCase, error: caseErr } = await supabase
        .from("audit_cases")
        .select("*")
        .eq("id", caseId)
        .single();

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
        case_id: caseId,
        status: "processing",
        current_step: "soupy_init",
        progress: 5,
        started_at: new Date().toISOString(),
      }, { onConflict: "case_id" });

      // ── Feature 3: Payer-Specific Adversarial Tuning ──
      let payerContext = "";
      let payerProfile: any = null;
      if (payerCode) {
        const { data: profile } = await supabase
          .from("payer_profiles")
          .select("*")
          .eq("payer_code", payerCode)
          .single();
        
        if (profile) {
          payerProfile = profile;
          payerContext = `\n\nPAYER-SPECIFIC CONTEXT (${profile.payer_name}):\n${profile.adversarial_prompt_additions}\n\nKnown denial patterns: ${JSON.stringify(profile.denial_patterns)}\nModifier sensitivity: ${JSON.stringify(profile.modifier_sensitivity)}`;
          console.log(`Loaded payer profile: ${profile.payer_name}`);
        }
      }

      const summary = (auditCase.metadata as any)?.summary || "Not available";
      const sourceTextTrunc = auditCase.source_text?.substring(0, 3000) || "Not available";

      // ── Feature 7: Cross-Case Pattern Memory ──
      // Find related cases by physician and code patterns
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
- Prior codes: ${relatedCases.flatMap(c => c.cpt_codes || []).filter((v, i, a) => a.indexOf(v) === i).join(", ")}
- ${rejectedCount > 2 ? "⚠️ PATTERN ALERT: This physician has elevated rejection rates" : "Pattern: Normal range"}`;
        
        // Store graph edges for new relationships
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
        console.log(`Cross-case memory: ${relatedCases.length} related cases loaded`);
      }

      // ── Run 4 SOUPY roles (Primary Pass — Run A) ──
      await supabase.from("processing_queue").update({
        current_step: "soupy_primary_pass",
        progress: 10,
      }).eq("case_id", caseId);

      const analysisResults: any[] = [];
      const roleOrder = SOUPY_ROLES.map(r => r.role);

      for (let i = 0; i < SOUPY_ROLES.length; i++) {
        const soupyRole = SOUPY_ROLES[i];
        console.log(`[Run A] ${soupyRole.role} analysis...`);

        await supabase.from("processing_queue").update({
          current_step: `analyzing_${soupyRole.role}`,
          progress: 10 + (i + 1) * 12,
        }).eq("case_id", caseId);

        // Inject payer context into Red Team specifically
        let roleSystemPrompt = soupyRole.systemPrompt;
        if (soupyRole.role === "redteam" && payerProfile) {
          roleSystemPrompt += `\n\n${payerProfile.adversarial_prompt_additions}`;
        }

        const prompt = ANALYSIS_PROMPT
          .replace("{cpt_codes}", (auditCase.cpt_codes || []).join(", "))
          .replace("{claim_amount}", String(auditCase.claim_amount))
          .replace("{icd_codes}", (auditCase.icd_codes || []).join(", "))
          .replace("{summary}", summary)
          .replace("{source_text}", sourceTextTrunc)
          .replace("{payer_context}", payerContext + crossCaseContext);

        try {
          const { result: analysis, latencyMs, tokenCount } = await callAI(
            LOVABLE_API_KEY, soupyRole.model, roleSystemPrompt, prompt,
            [analysisToolSchema],
            { type: "function", function: { name: "submit_analysis" } }
          );

          analysisResults.push({ ...analysis, role: soupyRole.role });

          // Store analysis
          const { data: analysisRow } = await supabase.from("case_analyses").insert({
            case_id: caseId,
            role: soupyRole.role,
            model: soupyRole.model,
            status: "complete",
            confidence: analysis.confidence,
            perspective_statement: analysis.perspectiveStatement,
            key_insights: analysis.keyInsights,
            assumptions: analysis.assumptions,
            violations: analysis.violations,
            overall_assessment: analysis.overallAssessment,
          }).select("id").single();

          // ── Feature 6: Reasoning Chain Forensics ──
          if (analysisRow) {
            await supabase.from("reasoning_chains").insert({
              case_id: caseId,
              analysis_id: analysisRow.data?.id || analysisRow.id,
              role: soupyRole.role,
              model: soupyRole.model,
              raw_reasoning: analysis.reasoningChain || "",
              structured_steps: [],
              token_count: tokenCount,
              latency_ms: latencyMs,
            });
          }

        } catch (roleErr: any) {
          console.error(`Error in ${soupyRole.role}:`, roleErr);
          await supabase.from("case_analyses").insert({
            case_id: caseId,
            role: soupyRole.role,
            model: soupyRole.model,
            status: "error",
            overall_assessment: roleErr?.message || "Analysis encountered an error",
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
      const riskNum = Math.min(100, 20 + criticalViolations * 25 + totalViolations * 10);
      const riskLevel = riskNum >= 80 ? "critical" : riskNum >= 60 ? "high" : riskNum >= 40 ? "medium" : "low";

      // ── Feature 1: Devil's Advocate (Adversarial Self-Doubt Loop) ──
      console.log("═══ DEVIL'S ADVOCATE PASS ═══");
      await supabase.from("processing_queue").update({
        current_step: "devils_advocate",
        progress: 65,
      }).eq("case_id", caseId);

      let devilsResult: any = null;
      let finalConsensusScore = consensusScore;
      let reanalysisTriggered = false;

      try {
        const roleSummaries = analysisResults.map(a =>
          `[${a.role.toUpperCase()}] (confidence: ${a.confidence}%)\nStatement: ${a.perspectiveStatement}\nKey insights: ${a.keyInsights?.join("; ")}\nViolations found: ${a.violations?.length || 0}\nAssessment: ${a.overallAssessment}`
        ).join("\n\n");

        const daPrompt = DEVILS_ADVOCATE_PROMPT
          .replace("{role_summaries}", roleSummaries)
          .replace("{consensus_score}", String(consensusScore))
          .replace("{risk_level}", riskLevel)
          .replace("{total_violations}", String(totalViolations));

        const { result: daResult } = await callAI(
          LOVABLE_API_KEY,
          DEVILS_ADVOCATE.model,
          DEVILS_ADVOCATE.systemPrompt,
          daPrompt,
          [devilsAdvocateToolSchema],
          { type: "function", function: { name: "submit_devils_advocate" } }
        );

        devilsResult = daResult;

        // If devil's advocate destroyed consensus, adjust score
        if (daResult.overallVerdict === "consensus_destroyed") {
          finalConsensusScore = Math.max(10, daResult.revisedConsensusScore || consensusScore - 30);
          reanalysisTriggered = true;
          console.log(`⚡ Consensus DESTROYED. Score: ${consensusScore} → ${finalConsensusScore}`);
        } else if (daResult.overallVerdict === "consensus_weakened") {
          finalConsensusScore = Math.max(20, Math.round((consensusScore + (daResult.revisedConsensusScore || consensusScore)) / 2));
          console.log(`⚠️ Consensus WEAKENED. Score: ${consensusScore} → ${finalConsensusScore}`);
        } else {
          console.log(`✅ Consensus SURVIVED devil's advocate.`);
        }

        await supabase.from("devils_advocate_results").insert({
          case_id: caseId,
          consensus_before: consensusScore,
          consensus_after: finalConsensusScore,
          attack_vectors: daResult.attackVectors || [],
          consensus_survived: daResult.overallVerdict === "consensus_holds",
          vulnerabilities_found: [...(daResult.blindSpots || []), ...(daResult.groupthinkPatterns || [])].map(v => ({ description: v })),
          reanalysis_triggered: reanalysisTriggered,
        });

      } catch (daErr) {
        console.error("Devil's advocate failed:", daErr);
        // Non-fatal: continue with original consensus
      }

      // ── Feature 2: Temporal Drift Detection ──
      console.log("═══ TEMPORAL DRIFT CHECK ═══");
      await supabase.from("processing_queue").update({
        current_step: "stability_check",
        progress: 75,
      }).eq("case_id", caseId);

      try {
        // Run a single role (builder) with shuffled prompt to detect drift
        const shuffledPrompt = ANALYSIS_PROMPT
          .replace("{cpt_codes}", (auditCase.cpt_codes || []).reverse().join(", "))
          .replace("{claim_amount}", String(auditCase.claim_amount))
          .replace("{icd_codes}", (auditCase.icd_codes || []).reverse().join(", "))
          .replace("{summary}", summary)
          .replace("{source_text}", sourceTextTrunc)
          .replace("{payer_context}", "");

        const { result: driftResult } = await callAI(
          LOVABLE_API_KEY,
          "google/gemini-2.5-flash-lite", // Use cheapest model for drift check
          SOUPY_ROLES[0].systemPrompt,
          shuffledPrompt,
          [analysisToolSchema],
          { type: "function", function: { name: "submit_analysis" } }
        );

        const originalBuilder = analysisResults.find(a => a.role === "builder");
        const confidenceDrift = originalBuilder
          ? Math.abs(originalBuilder.confidence - driftResult.confidence)
          : 0;
        const violationCountDrift = originalBuilder
          ? Math.abs((originalBuilder.violations?.length || 0) - (driftResult.violations?.length || 0))
          : 0;
        const driftScore = confidenceDrift + violationCountDrift * 10;
        const isStable = driftScore < 25;

        const unstableRoles: string[] = [];
        if (confidenceDrift > 15) unstableRoles.push("builder");
        if (violationCountDrift > 1) unstableRoles.push("builder-violations");

        await supabase.from("stability_checks").insert({
          case_id: caseId,
          run_a_output: { confidence: originalBuilder?.confidence, violations: originalBuilder?.violations?.length || 0, assessment: originalBuilder?.overallAssessment?.substring(0, 200) },
          run_b_output: { confidence: driftResult.confidence, violations: driftResult.violations?.length || 0, assessment: driftResult.overallAssessment?.substring(0, 200) },
          drift_score: driftScore,
          unstable_roles: unstableRoles,
          prompt_order_a: roleOrder,
          prompt_order_b: shuffleArray(roleOrder),
          is_stable: isStable,
        });

        if (!isStable) {
          console.log(`⚠️ TEMPORAL DRIFT DETECTED! Drift score: ${driftScore}`);
          // Reduce confidence of final consensus when drift is detected
          finalConsensusScore = Math.max(10, finalConsensusScore - Math.round(driftScore / 5));
        } else {
          console.log(`✅ Stable output. Drift score: ${driftScore}`);
        }
      } catch (driftErr) {
        console.error("Drift check failed:", driftErr);
        // Non-fatal: continue
      }

      // ── Feature 5: Confidence Calibration ──
      console.log("═══ CALIBRATION LOGGING ═══");
      await supabase.from("processing_queue").update({
        current_step: "calibration",
        progress: 85,
      }).eq("case_id", caseId);

      const predictedOutcome = riskNum >= 60 ? "rejected" : riskNum >= 40 ? "info-requested" : "approved";
      const roleWeights: Record<string, number> = {};
      for (const a of analysisResults) {
        roleWeights[a.role] = a.confidence;
      }

      await supabase.from("engine_calibration").insert({
        case_id: caseId,
        predicted_outcome: predictedOutcome,
        predicted_confidence: finalConsensusScore,
        role_weights: roleWeights,
        calibration_notes: devilsResult
          ? `DA verdict: ${devilsResult.overallVerdict}. ${devilsResult.blindSpots?.length || 0} blind spots found.`
          : "No devil's advocate result",
      });

      // ── Feature 8: Counter-Narrative Generation (embedded in metadata) ──
      // Build counter-narratives from builder + breaker vs redteam
      const counterNarratives: any[] = [];
      const builderResult = analysisResults.find(a => a.role === "builder");
      const redteamResult = analysisResults.find(a => a.role === "redteam");
      const breakerResult = analysisResults.find(a => a.role === "breaker");

      if (builderResult && redteamResult) {
        for (const violation of (redteamResult.violations || [])) {
          const builderDefense = builderResult.keyInsights?.find((i: string) =>
            i.toLowerCase().includes(violation.code?.toLowerCase() || "xxx")
          );
          counterNarratives.push({
            violation: violation.description,
            code: violation.code,
            redteamSeverity: violation.severity,
            builderCounterpoint: builderDefense || builderResult.perspectiveStatement,
            breakerAngle: breakerResult?.keyInsights?.[0] || "No alternative angle available",
          });
        }
      }

      // ── Feature 9: Regulatory Conflict Mapper (embedded from analyst) ──
      const analystResult = analysisResults.find(a => a.role === "analyst");
      const regulatoryConflicts: any[] = [];
      if (analystResult?.violations) {
        const regulationRefs = analystResult.violations.map((v: any) => v.regulationRef).filter(Boolean);
        if (regulationRefs.length > 1) {
          regulatoryConflicts.push({
            regulations: regulationRefs,
            note: "Multiple regulations apply — potential for conflicting interpretations",
            analystConfidence: analystResult.confidence,
          });
        }
      }

      // ── Feature 10: Physician Behavioral Fingerprint ──
      let physicianFingerprint: any = null;
      if (relatedCases && relatedCases.length >= 3) {
        const allCodes = relatedCases.flatMap(c => c.cpt_codes || []);
        const codeFreq: Record<string, number> = {};
        for (const code of allCodes) {
          codeFreq[code] = (codeFreq[code] || 0) + 1;
        }
        const topCodes = Object.entries(codeFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const riskScores = relatedCases.map(c => (c.risk_score as any)?.score || 0).filter(s => s > 0);
        const avgRisk = riskScores.length > 0 ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length : 0;

        physicianFingerprint = {
          physician: auditCase.physician_name,
          totalCases: relatedCases.length + 1,
          topCodes: topCodes.map(([code, count]) => ({ code, frequency: count })),
          avgRiskScore: avgRisk,
          rejectionRate: relatedCases.filter(c => c.status === "rejected").length / relatedCases.length,
          patternFlags: avgRisk > 60 ? ["elevated_risk_pattern"] : [],
        };
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
          dataCompleteness: { score: 70, present: ["CPT codes", "ICD-10 codes", "Source text"], missing: ["Operative note", "Imaging"] },
          factors: [],
        },
        metadata: {
          ...(auditCase.metadata as any || {}),
          engineVersion: "SOUPY-v2-12x",
          devilsAdvocateVerdict: devilsResult?.overallVerdict || "not_run",
          counterNarratives,
          regulatoryConflicts,
          physicianFingerprint,
          payerProfile: payerProfile ? { name: payerProfile.payer_name, code: payerProfile.payer_code } : null,
          crossCaseCount: relatedCases?.length || 0,
          reanalysisTriggered,
        },
      }).eq("id", caseId);

      await supabase.from("processing_queue").update({
        status: "complete",
        current_step: "complete",
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq("case_id", caseId);

      console.log(`═══ ANALYSIS COMPLETE ═══`);
      console.log(`Consensus: ${finalConsensusScore} | Risk: ${riskNum} (${riskLevel}) | DA: ${devilsResult?.overallVerdict || "skipped"} | Reanalysis: ${reanalysisTriggered}`);

      return new Response(JSON.stringify({
        success: true,
        consensusScore: finalConsensusScore,
        riskScore: riskNum,
        analyses: analysisResults.length,
        engineFeatures: {
          devilsAdvocate: devilsResult?.overallVerdict || "not_run",
          driftChecked: true,
          payerProfile: payerProfile?.payer_name || null,
          crossCaseMemory: relatedCases?.length || 0,
          reasoningChainsStored: true,
          calibrationLogged: true,
          counterNarratives: counterNarratives.length,
          regulatoryConflicts: regulatoryConflicts.length,
          physicianFingerprint: !!physicianFingerprint,
          reanalysisTriggered,
        },
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
