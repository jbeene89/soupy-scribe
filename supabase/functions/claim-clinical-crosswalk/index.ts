// Claim-to-Clinical Crosswalk Engine
// Takes a parsed claim + parsed clinical note and produces a strict auditor's verdict:
// service validation, diagnosis support matrix, medical necessity, time validation,
// med management support, contradictions, pre-submission decision, fix actions, appeal readiness.
//
// HARD RULES (enforced in the system prompt):
// - Trust ONLY documented evidence
// - If not documented → treat as missing
// - Do NOT infer clinical support
// - Strict like an auditor, not generous like a clinician
// - Every conclusion must be tied to evidence
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildSystemPrompt(): string {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const humanDate = today.toUTCString().slice(0, 16);
  return `You are a STRICT behavioral health claim auditor. You compare a billed claim against the clinician's documented note and produce a defensibility verdict.

CONTEXT: Today's date is ${humanDate} (${isoDate}). Treat any service date or signature date on or before today as a normal past/present date. Only dates strictly AFTER ${isoDate} should be flagged as future-dated. Do NOT raise denial risk for current-year dates that are simply in the present.

ABSOLUTE RULES:
1. Trust ONLY documented evidence from the parsed note.
2. If something is not documented → treat it as MISSING. Do not infer it from the diagnosis, the CPT, or "what was probably done".
3. Do NOT be generous like a clinician. Be strict like an auditor whose job is to flag denial risk.
4. Every conclusion must cite specific evidence (a quote or a field path) or call out the absence of evidence.
5. Time-based codes (90832, 90834, 90837, 90847, prolonged service codes) require an explicit time statement in the note. If absent → time_support is "unsupported".
6. Psychotherapy CPT codes require a psychotherapy narrative (modality + interventions). If absent → service_match for that CPT is "unsupported".
7. E/M and med-management codes require documented medication review + rationale for any changes. If absent → med_management_support is "weak" or worse.
8. Diagnoses without documented symptoms → support_strength is "weak" with explicit missing_support.
9. Contradictions must be REAL — only include them if the two statements genuinely conflict.
10. Output enterprise tone, no advocacy, no melodrama. Neutral auditor voice.

You will return your verdict via the crosswalk_verdict tool.`;
}

const VERDICT_TOOL = {
  type: "function",
  function: {
    name: "crosswalk_verdict",
    description: "Strict auditor verdict comparing a billed claim against documented clinical note.",
    parameters: {
      type: "object",
      properties: {
        // STEP 1
        service_match: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["supported", "weakly_supported", "unsupported"] },
            cpt_under_review: { type: "string", description: "Primary CPT being audited." },
            why: { type: "string", description: "Specific evidence-based reasoning. Cite what IS documented and what IS NOT." },
            visit_type_documented: { type: ["string", "null"] },
            modifier_issues: { type: "array", items: { type: "string" } },
          },
          required: ["verdict", "cpt_under_review", "why", "modifier_issues"],
          additionalProperties: false,
        },

        // STEP 2
        diagnosis_support_matrix: {
          type: "array",
          items: {
            type: "object",
            properties: {
              diagnosis: { type: "string", description: "ICD-10 code + label." },
              supported_by: { type: "array", items: { type: "string" }, description: "Specific symptoms/findings from note that support this dx." },
              missing_support: { type: "array", items: { type: "string" }, description: "What's missing — duration, impairment, specific criteria." },
              contradictions: { type: "array", items: { type: "string" }, description: "Note evidence that contradicts this dx." },
              support_strength: { type: "string", enum: ["strong", "moderate", "weak"] },
            },
            required: ["diagnosis", "supported_by", "missing_support", "contradictions", "support_strength"],
            additionalProperties: false,
          },
        },

        // STEP 3
        medical_necessity: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["strong", "moderate", "weak"] },
            symptom_severity_documented: { type: "boolean" },
            functional_impairment_documented: { type: "boolean" },
            risk_level_documented: { type: "boolean" },
            treatment_justification_documented: { type: "boolean" },
            missing_elements: { type: "array", items: { type: "string" } },
            why: { type: "string" },
          },
          required: ["verdict", "symptom_severity_documented", "functional_impairment_documented", "risk_level_documented", "treatment_justification_documented", "missing_elements", "why"],
          additionalProperties: false,
        },

        // STEP 4
        med_management_support: {
          type: "object",
          properties: {
            applies: { type: "boolean", description: "False if no E/M / med-management code is billed." },
            verdict: { type: "string", enum: ["strong", "moderate", "weak", "not_applicable"] },
            medication_review_documented: { type: ["boolean", "null"] },
            changes_documented: { type: ["boolean", "null"] },
            rationale_documented: { type: ["boolean", "null"] },
            side_effects_documented: { type: ["boolean", "null"] },
            adherence_documented: { type: ["boolean", "null"] },
            missing_elements: { type: "array", items: { type: "string" } },
          },
          required: ["applies", "verdict", "missing_elements"],
          additionalProperties: false,
        },

        // STEP 5
        time_support: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["valid", "questionable", "unsupported", "not_applicable"] },
            time_statement_present: { type: "boolean" },
            documented_minutes: { type: ["integer", "null"] },
            required_minutes_for_billed_code: { type: ["integer", "null"] },
            issues: { type: "array", items: { type: "string" } },
          },
          required: ["verdict", "time_statement_present", "issues"],
          additionalProperties: false,
        },

        // STEP 6 — only REAL contradictions
        contradictions: {
          type: "array",
          description: "Real contradictions between claim and note, OR within the note itself. Empty if none.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["claim_vs_note", "internal_to_note", "internal_to_claim"] },
              statement_a: { type: "string" },
              statement_b: { type: "string" },
              why: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["type", "statement_a", "statement_b", "why", "severity"],
            additionalProperties: false,
          },
        },

        // STEP 7
        pre_submission_decision: {
          type: "object",
          properties: {
            decision: {
              type: "string",
              enum: ["ready_to_submit", "needs_fix", "high_denial_risk", "undercoded", "not_defensible"],
            },
            confidence: { type: "number", description: "0.0 to 1.0" },
            headline: { type: "string", description: "One sentence, ≤22 words." },
            why: { type: "string" },
          },
          required: ["decision", "confidence", "headline", "why"],
          additionalProperties: false,
        },

        // STEP 8
        actions: {
          type: "array",
          description: "Concrete next actions, ordered by priority (high first).",
          items: {
            type: "object",
            properties: {
              issue: { type: "string", description: "What is wrong or missing." },
              action: { type: "string", description: "Exactly what to do." },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["issue", "action", "priority"],
            additionalProperties: false,
          },
        },

        // STEP 9
        appeal_readiness: {
          type: "object",
          properties: {
            applicable: { type: "boolean", description: "True if claim is denied or at risk." },
            strength: { type: "string", enum: ["strong", "moderate", "weak", "not_applicable"] },
            argument: { type: ["string", "null"], description: "What to argue on appeal." },
            evidence_to_cite: { type: "array", items: { type: "string" }, description: "Specific quotes / sections to cite." },
            what_is_missing: { type: "array", items: { type: "string" }, description: "Documentation gaps that weaken the appeal." },
          },
          required: ["applicable", "strength", "evidence_to_cite", "what_is_missing"],
          additionalProperties: false,
        },
      },
      required: [
        "service_match",
        "diagnosis_support_matrix",
        "medical_necessity",
        "med_management_support",
        "time_support",
        "contradictions",
        "pre_submission_decision",
        "actions",
        "appeal_readiness",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const claim = body.claim;
    const note = body.note;

    if (!claim || typeof claim !== "object") {
      return new Response(JSON.stringify({ error: "Missing parsed claim" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!note || typeof note !== "object") {
      return new Response(JSON.stringify({ error: "Missing parsed clinical note" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userMsg = `Audit this billed claim against the clinical note. Apply ALL rules strictly.

PARSED_CLAIM:
${JSON.stringify(claim)}

PARSED_NOTE:
${JSON.stringify(note)}

Produce the full crosswalk verdict via the crosswalk_verdict tool. Be strict. Cite evidence or call out absence of evidence for every conclusion.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // High-stakes audit call: use Pro for reasoning depth.
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userMsg },
        ],
        tools: [VERDICT_TOOL],
        tool_choice: { type: "function", function: { name: "crosswalk_verdict" } },
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Workspace Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI audit failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verdict = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ verdict }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("claim-clinical-crosswalk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
