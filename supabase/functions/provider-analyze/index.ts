import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SOURCE_TEXT_LENGTH = 50_000;

const PROVIDER_READINESS_PROMPT = `You are a medical compliance readiness advisor helping healthcare providers improve documentation quality, identify coding vulnerabilities, and assess appeal viability. You are NOT an auditor or enforcement agent. Your role is to help providers proactively strengthen their claims.

Use careful, provider-safe language:
- "documentation insufficiency" not "fraud"
- "coding vulnerability" not "violation"  
- "support gap" not "error"
- "readiness concern" not "failure"
- "additional support recommended" not "non-compliant"

Analyze the provided case and return a comprehensive compliance readiness assessment.`;

const EXTRACTION_PROMPT = `You are a medical coding expert. Extract structured data from this case file text.

Return structured data with: patient_id, physician_id, physician_name, date_of_service (YYYY-MM-DD), cpt_codes (string[]), icd_codes (string[]), claim_amount (number), summary (string), procedure_type (string), body_region (string - primary anatomical body region involved, e.g. "left testicle", "lumbar spine L4-L5", "right knee". Include laterality when documented.)

If information is missing, make reasonable inferences from the clinical context.`;

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
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseAuth.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return { userId: data.claims.sub as string };
}

async function callAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string, tools: any[], toolChoice: any) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], tools, tool_choice: toolChoice }),
  });
  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits in Settings." };
    throw new Error(`AI call failed: ${status}`);
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No result from AI");
  return JSON.parse(toolCall.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { action, sourceText, caseId } = await req.json();

    // ─── ACTION: submit — Extract case + create in DB ───
    if (action === "submit") {
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

      console.log("Provider: extracting case data...");
      const extracted = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", EXTRACTION_PROMPT, sourceText, [{
        type: "function",
        function: {
          name: "extract_case_data",
          description: "Extract structured medical case data",
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
      }], { type: "function", function: { name: "extract_case_data" } });

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
          metadata: { summary: extracted.summary, procedure_type: extracted.procedure_type, mode: "provider" },
          owner_id: userId,
        })
        .select()
        .single();

      if (caseError) {
        console.error("DB insert error:", caseError);
        throw new Error("Failed to create case");
      }

      return new Response(JSON.stringify({ success: true, caseId: newCase.id, extracted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── ACTION: analyze — Run provider compliance readiness analysis ───
    if (action === "analyze") {
      if (!caseId) {
        return new Response(JSON.stringify({ error: "caseId is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

      console.log(`Provider: running readiness analysis for ${caseId}...`);

      const caseContext = `
Case Details:
- CPT Codes: ${auditCase.cpt_codes.join(", ")}
- ICD-10 Codes: ${auditCase.icd_codes.join(", ")}
- Claim Amount: $${auditCase.claim_amount}
- Date of Service: ${auditCase.date_of_service}
- Physician: ${auditCase.physician_name}
- Clinical Summary: ${(auditCase.metadata as any)?.summary || "Not available"}
- Source Documentation: ${auditCase.source_text?.substring(0, 4000) || "Not available"}
`;

      const readinessResult = await callAI(
        LOVABLE_API_KEY,
        "google/gemini-3-flash-preview",
        PROVIDER_READINESS_PROMPT,
        caseContext,
        [{
          type: "function",
          function: {
            name: "submit_readiness_analysis",
            description: "Submit the provider compliance readiness analysis",
            parameters: {
              type: "object",
              properties: {
                documentationSufficiency: { type: "string", enum: ["strong", "moderate", "weak", "insufficient"] },
                timelineConsistency: { type: "string", enum: ["strong", "moderate", "weak", "insufficient"] },
                documentationAssessments: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      status: { type: "string", enum: ["strong", "moderate", "weak", "insufficient"] },
                      detail: { type: "string" },
                      whyItMatters: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["category", "status", "detail", "whyItMatters", "recommendation"],
                    additionalProperties: false,
                  },
                },
                codingVulnerabilities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      issue: { type: "string" },
                      severity: { type: "string", enum: ["strong", "moderate", "weak", "insufficient"] },
                      recommendation: { type: "string" },
                      isCorrectible: { type: "boolean" },
                    },
                    required: ["code", "issue", "severity", "recommendation", "isCorrectible"],
                    additionalProperties: false,
                  },
                },
                appealAssessment: {
                  type: "object",
                  properties: {
                    viability: { type: "string", enum: ["recommended", "conditional", "not-recommended"] },
                    estimatedSuccessRate: { type: "number" },
                    estimatedEffortHours: { type: "number" },
                    strengths: { type: "array", items: { type: "string" } },
                    weaknesses: { type: "array", items: { type: "string" } },
                    missingSupport: { type: "array", items: { type: "string" } },
                    recommendedAction: { type: "string", enum: ["do-not-appeal", "gather-records", "recode-resubmit", "seek-compliance-review", "educate-staff"] },
                    actionRationale: { type: "string" },
                  },
                  required: ["viability", "estimatedSuccessRate", "estimatedEffortHours", "strengths", "weaknesses", "missingSupport", "recommendedAction", "actionRationale"],
                  additionalProperties: false,
                },
                evidenceReadiness: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      record: { type: "string" },
                      category: { type: "string", enum: ["required", "helpful", "unlikely-to-help"] },
                      status: { type: "string", enum: ["present", "missing", "partial"] },
                      whyItMatters: { type: "string" },
                      whatItSupports: { type: "string" },
                      essentialForAppeal: { type: "boolean" },
                      materiallyImproves: { type: "boolean" },
                    },
                    required: ["record", "category", "status", "whyItMatters", "whatItSupports", "essentialForAppeal", "materiallyImproves"],
                    additionalProperties: false,
                  },
                },
                denialPressurePoints: { type: "array", items: { type: "string" } },
              },
              required: ["documentationSufficiency", "timelineConsistency", "documentationAssessments", "codingVulnerabilities", "appealAssessment", "evidenceReadiness", "denialPressurePoints"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "submit_readiness_analysis" } }
      );

      // Store the readiness result in case metadata
      await supabase.from("audit_cases").update({
        status: "reviewed",
        metadata: {
          ...(auditCase.metadata as any || {}),
          mode: "provider",
          providerReview: readinessResult,
        },
      }).eq("id", caseId);

      return new Response(JSON.stringify({ success: true, review: readinessResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use 'submit' or 'analyze'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("provider-analyze error:", e);
    const status = e?.status || 500;
    return new Response(JSON.stringify({ error: e?.message || "An internal error occurred." }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
