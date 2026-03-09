import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_TEXT_LENGTH = 50_000;

const SOUPY_ROLES = [
  {
    role: "builder",
    model: "google/gemini-2.5-flash",
    systemPrompt: `You are the BUILDER role in the SOUPY audit protocol. Your job is to find the BEST-CASE interpretation of the medical billing. You look for legitimate clinical justifications, proper documentation paths, and defensible positions. You are optimistic but evidence-based — you don't fabricate defenses, you find real ones.`,
  },
  {
    role: "redteam",
    model: "google/gemini-2.5-flash",
    systemPrompt: `You are the RED TEAM role in the SOUPY audit protocol. Your job is to find every vulnerability, documentation gap, and audit risk. You assume the worst-case interpretation and identify what an aggressive auditor would flag. You are critical but fair — you identify real risks, not phantom ones.`,
  },
  {
    role: "analyst",
    model: "google/gemini-2.5-flash",
    systemPrompt: `You are the SYSTEMS ANALYST role in the SOUPY audit protocol. Your job is to apply regulatory frameworks, NCCI edits, CMS guidelines, and payer-specific rules to the case. You provide structured, objective analysis with specific regulation references. You are methodical and precise.`,
  },
  {
    role: "breaker",
    model: "google/gemini-2.5-flash",
    systemPrompt: `You are the FRAME BREAKER role in the SOUPY audit protocol. Your job is to challenge assumptions, find unconventional angles, and identify systemic issues that others miss. You question whether the audit framework itself is appropriate, consider documentation system failures, and suggest novel evidence approaches.`,
  },
];

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
- Claim Amount: ${"{claim_amount}"}
- Clinical Summary: {summary}
- Source Text: {source_text}

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

Be specific and reference real CMS guidelines, NCCI edits, and CPT coding rules.`;

// Authenticate the request and return the user ID
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

    // Authenticate the request
    const authResult = await authenticateRequest(req, supabaseUrl, supabaseAnonKey);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, caseId, sourceText } = await req.json();

    // Validate action
    if (action !== "extract" && action !== "analyze") {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'extract' or 'analyze'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate inputs based on action
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
    }

    if (action === "analyze") {
      if (!caseId || !UUID_RE.test(caseId)) {
        return new Response(JSON.stringify({ error: "Valid caseId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "extract") {
      console.log("Extracting case data from source text...");

      const extractResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            { role: "user", content: sourceText },
          ],
          tools: [{
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
          }],
          tool_choice: { type: "function", function: { name: "extract_case_data" } },
        }),
      });

      if (!extractResponse.ok) {
        const status = extractResponse.status;
        console.error("Extract failed:", status, await extractResponse.text());
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI extraction failed");
      }

      const extractData = await extractResponse.json();
      const toolCall = extractData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("No extraction result from AI");

      const extracted = JSON.parse(toolCall.function.arguments);

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

    if (action === "analyze") {
      if (!caseId) throw new Error("caseId required for analysis");

      console.log(`Running SOUPY analysis for case ${caseId}...`);

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

      await supabase.from("audit_cases").update({ status: "in-review" }).eq("id", caseId);
      await supabase.from("processing_queue").update({
        status: "processing",
        current_step: "soupy_analysis",
        progress: 30,
        started_at: new Date().toISOString(),
      }).eq("case_id", caseId);

      const caseContext = `CPT Codes: ${auditCase.cpt_codes.join(", ")}
ICD-10 Codes: ${auditCase.icd_codes.join(", ")}
Claim Amount: $${auditCase.claim_amount}
Clinical Summary: ${(auditCase.metadata as any)?.summary || "Not available"}
Source Text: ${auditCase.source_text?.substring(0, 3000) || "Not available"}`;

      const analysisResults = [];
      for (let i = 0; i < SOUPY_ROLES.length; i++) {
        const soupyRole = SOUPY_ROLES[i];
        console.log(`Running ${soupyRole.role} analysis...`);

        await supabase.from("processing_queue").update({
          current_step: `analyzing_${soupyRole.role}`,
          progress: 30 + (i + 1) * 15,
        }).eq("case_id", caseId);

        const prompt = ANALYSIS_PROMPT
          .replace("{cpt_codes}", auditCase.cpt_codes.join(", "))
          .replace("{claim_amount}", String(auditCase.claim_amount))
          .replace("{icd_codes}", auditCase.icd_codes.join(", "))
          .replace("{summary}", (auditCase.metadata as any)?.summary || "")
          .replace("{source_text}", auditCase.source_text?.substring(0, 2000) || "");

        try {
          const roleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: soupyRole.model,
              messages: [
                { role: "system", content: soupyRole.systemPrompt },
                { role: "user", content: prompt },
              ],
              tools: [{
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
                    },
                    required: ["confidence", "perspectiveStatement", "keyInsights", "assumptions", "violations", "overallAssessment"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "submit_analysis" } },
            }),
          });

          if (!roleResponse.ok) {
            console.error(`${soupyRole.role} failed:`, roleResponse.status, await roleResponse.text());
            await supabase.from("case_analyses").insert({
              case_id: caseId,
              role: soupyRole.role,
              model: soupyRole.model,
              status: "error",
              overall_assessment: `Analysis failed`,
            });
            continue;
          }

          const roleData = await roleResponse.json();
          const roleToolCall = roleData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (!roleToolCall) {
            console.error(`No tool call for ${soupyRole.role}`);
            await supabase.from("case_analyses").insert({
              case_id: caseId,
              role: soupyRole.role,
              model: soupyRole.model,
              status: "error",
              overall_assessment: "No analysis result returned",
            });
            continue;
          }

          const analysis = JSON.parse(roleToolCall.function.arguments);
          analysisResults.push({ ...analysis, role: soupyRole.role });

          await supabase.from("case_analyses").insert({
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
          });

        } catch (roleErr) {
          console.error(`Error in ${soupyRole.role}:`, roleErr);
          await supabase.from("case_analyses").insert({
            case_id: caseId,
            role: soupyRole.role,
            model: soupyRole.model,
            status: "error",
            overall_assessment: "Analysis encountered an error",
          });
        }
      }

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
          dataCompleteness: { score: 70, present: ["CPT codes", "ICD-10 codes", "Source text"], missing: ["Operative note", "Imaging"] },
          factors: [],
        },
      }).eq("id", caseId);

      await supabase.from("processing_queue").update({
        status: "complete",
        current_step: "complete",
        progress: 100,
        completed_at: new Date().toISOString(),
      }).eq("case_id", caseId);

      return new Response(JSON.stringify({ 
        success: true, 
        consensusScore, 
        riskScore: riskNum,
        analyses: analysisResults.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-case error:", e);
    return new Response(JSON.stringify({ 
      error: "An internal error occurred. Please try again." 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
