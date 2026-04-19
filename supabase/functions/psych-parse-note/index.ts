// Behavioral health session note parser — extracts structured audit fields via Lovable AI
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reject any caller that is not a signed-in user. Without this the function is
// publicly callable and anyone on the internet can burn Lovable AI credits.
async function requireAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

const SYSTEM_PROMPT = `You are a behavioral health claim parsing engine.

Your job is to extract ALL relevant claim and clinical data from a session note, superbill, or claim summary with HIGH accuracy.

STRICT RULES:
- Extract EXACTLY what is written
- Do NOT summarize loosely
- Do NOT infer missing data — if a value is not explicitly present, return null
- Do NOT combine fields
- Preserve multiple values as arrays
- Clearly distinguish documented facts from missing evidence

You will return structured JSON via the extract_claim tool. Populate every field you can find. Use null for anything not documented.`;

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_claim",
    description: "Extract structured claim and clinical data from a behavioral health session note.",
    parameters: {
      type: "object",
      properties: {
        // Patient
        patient_name: { type: ["string", "null"], description: "Full patient name as written, or null" },
        patient_id: { type: ["string", "null"] },
        patient_dob: { type: ["string", "null"] },
        patient_state: { type: ["string", "null"], description: "Two-letter US state code where patient was located during session" },

        // Payer & claim header
        payer_name: { type: ["string", "null"] },
        payer_type: { type: ["string", "null"], description: "commercial, medicare, medicaid, tricare, self-pay, etc." },
        authorization_number: { type: ["string", "null"] },
        claim_number: { type: ["string", "null"] },

        // Service
        date_of_service: { type: ["string", "null"], description: "ISO YYYY-MM-DD if possible" },
        session_start_time: { type: ["string", "null"] },
        session_stop_time: { type: ["string", "null"] },
        session_duration_minutes: { type: ["integer", "null"] },
        place_of_service: { type: ["string", "null"], description: "POS code, e.g. 10, 11, 02" },
        is_telehealth: { type: ["boolean", "null"] },
        is_audio_only: { type: ["boolean", "null"] },
        telehealth_platform: { type: ["string", "null"], description: "e.g. Doxy.me, Zoom, SimplePractice" },

        // Session classification
        session_type: {
          type: ["string", "null"],
          enum: ["individual_therapy", "group_therapy", "family_therapy", "intake_evaluation", "psych_testing", "medication_management", "crisis_intervention", null],
        },
        cpt_code: { type: ["string", "null"] },
        additional_cpt_codes: { type: "array", items: { type: "string" } },
        modifier_codes: { type: "array", items: { type: "string" } },
        diagnosis_codes: { type: "array", items: { type: "string" }, description: "ICD-10 codes like F33.1" },

        // Documentation status (true = explicitly present, false = explicitly missing/expired, null = not mentioned)
        has_current_treatment_plan: { type: ["boolean", "null"] },
        has_authorization_on_file: { type: ["boolean", "null"] },
        has_telehealth_consent: { type: ["boolean", "null"] },
        has_start_stop_time: { type: ["boolean", "null"] },
        has_crisis_safety_plan: { type: ["boolean", "null"] },
        has_emergency_contact: { type: ["boolean", "null"] },
        has_patient_location_documented: { type: ["boolean", "null"] },

        // Clinical content
        functional_impairment_documented: { type: ["boolean", "null"] },
        symptom_severity_documented: { type: ["boolean", "null"] },
        treatment_response_documented: { type: ["boolean", "null"] },
        mood_affect_documented: { type: ["boolean", "null"] },
        continued_care_rationale_documented: { type: ["boolean", "null"] },
        medical_necessity_statement_present: { type: ["boolean", "null"] },
        screening_tools_used: { type: "array", items: { type: "string" }, description: "e.g. PHQ-9, GAD-7, PCL-5" },
        interventions_documented: { type: "array", items: { type: "string" }, description: "e.g. CBT, behavioral activation" },
        risk_assessment_present: { type: ["boolean", "null"], description: "SI/HI assessment documented" },

        // Financials
        claim_amount: { type: ["number", "null"] },

        // Audit signals
        contradictions_detected: { type: "array", items: { type: "string" }, description: "Inconsistencies between fields (e.g. duration says 45 min but start/stop = 30 min)" },
        copy_forward_risk: { type: ["boolean", "null"], description: "True if note appears templated/cloned" },
        missing_evidence: { type: "array", items: { type: "string" }, description: "Fields materially needed for audit defense that are not documented" },
        audit_narrative: { type: "string", description: "2-4 sentence neutral summary of what is documented vs missing" },
      },
      required: ["session_type", "cpt_code", "diagnosis_codes", "session_duration_minutes", "is_telehealth", "place_of_service", "audit_narrative", "missing_evidence"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const unauth = await requireAuth(req);
  if (unauth) return unauth;

  try {
    const { sourceText } = await req.json();
    if (!sourceText || typeof sourceText !== "string" || sourceText.trim().length < 20) {
      return new Response(JSON.stringify({ error: "sourceText is required (min 20 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Parse this behavioral health document into structured audit evidence:\n\n${sourceText}` },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "extract_claim" } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
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
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("psych-parse-note error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
