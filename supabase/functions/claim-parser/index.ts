// Claim Upload Parser — structured claim extraction with evidence snippets.
// Accepts plain text OR image data (base64 data URL) and returns a strict claim shape.
// Behavioral-health-friendly but generic across payer claims/EOBs/remits/denial letters.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a medical claim parsing engine.

Your job is to extract ALL relevant claim data from the provided document with HIGH accuracy.

STRICT RULES:
- Extract EXACTLY what is written
- Do NOT summarize
- Do NOT skip fields
- Do NOT infer missing data — if a value is not explicitly present, return null
- Preserve multiple values as arrays
- Do NOT combine unrelated fields
- Capture ALL claim line items (do not stop at the first one)
- If multiple claims exist, capture them all in claim_line_items with distinguishing context

CODE EXTRACTION (CRITICAL — most common failure mode):
- A CPT/HCPCS code is a 5-character code: 5 digits (e.g. 99214, 90834) OR 1 letter + 4 digits (e.g. J3490, G0438).
- A modifier is a 2-character code that follows a CPT, often after a hyphen, dash, comma, space, or in its own column. Examples: 95, 25, 59, GT, GQ, 26, TC, KX, XS, XU.
- Telehealth modifier 95 is REQUIRED when place of service is 02 or 10. Always look for it.
- Modifiers can appear inline (e.g. "99214-95", "99214 95", "99214, mod 95") or in a separate "Mod" column on a CMS-1500 / superbill. Capture them in BOTH codes.modifier_codes AND on the matching claim_line_items[].modifier.
- An ICD-10 code is 1 letter + 2 digits + optional ".xx" suffix (e.g. F33.1, F41.1, M54.5, Z79.899).
- Every CPT code you find MUST also produce a claim_line_items entry. Never report CPTs in codes.cpt_codes without a matching line item.

For every extracted field that has a value, also return:
- evidence_snippet: the EXACT verbatim quote from the source document where the value appears (3-15 words is ideal)
- source_location: a human-readable hint of where it came from (e.g. "Page 1", "Page 2 — Service Lines table", "Header section")
- confidence: a number from 0.0 to 1.0 reflecting how certain the extraction is

If you cannot find a field, set value to null and omit evidence_snippet/source_location/confidence.

VALIDATION: Before finishing, re-scan the document and confirm:
- ALL CPT/HCPCS codes captured (use the 5-character pattern above)
- ALL ICD-10 codes captured
- ALL modifiers captured (especially 95 for telehealth)
- ALL dollar amounts captured
- ALL claim line items captured (one per CPT occurrence)
- Denial reason codes AND denial reason text both captured if present

Return your output via the extract_claim tool.`;

// Wrapped value type used everywhere (value + traceability)
const wrapped = (valueType: string | string[]) => ({
  type: "object",
  properties: {
    value: { type: Array.isArray(valueType) ? valueType : [valueType, "null"] },
    evidence_snippet: { type: ["string", "null"] },
    source_location: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
  },
  required: ["value"],
  additionalProperties: false,
});

const wrappedArray = (itemType: string) => ({
  type: "object",
  properties: {
    value: { type: "array", items: { type: itemType } },
    evidence_snippet: { type: ["string", "null"] },
    source_location: { type: ["string", "null"] },
    confidence: { type: ["number", "null"] },
  },
  required: ["value"],
  additionalProperties: false,
});

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_claim",
    description: "Extract a structured medical claim with field-level evidence snippets.",
    parameters: {
      type: "object",
      properties: {
        claim_header: {
          type: "object",
          properties: {
            payer_name: wrapped("string"),
            payer_type: wrapped("string"),
            claim_number: wrapped("string"),
            authorization_number: wrapped("string"),
            claim_status: wrapped("string"),
            denial_status: wrapped("string"),
            appeal_status: wrapped("string"),
            denial_reason_codes: wrappedArray("string"),
            denial_reason_text: wrapped("string"),
            filing_deadline: wrapped("string"),
            appeal_deadline: wrapped("string"),
          },
          required: [],
          additionalProperties: false,
        },
        patient: {
          type: "object",
          properties: {
            patient_name: wrapped("string"),
            patient_id: wrapped("string"),
            dob: wrapped("string"),
            sex: wrapped("string"),
          },
          required: [],
          additionalProperties: false,
        },
        provider: {
          type: "object",
          properties: {
            billing_provider: wrapped("string"),
            rendering_provider: wrapped("string"),
            facility_name: wrapped("string"),
            npi_numbers: wrappedArray("string"),
            tax_id: wrapped("string"),
          },
          required: [],
          additionalProperties: false,
        },
        service: {
          type: "object",
          properties: {
            date_of_service_from: wrapped("string"),
            date_of_service_to: wrapped("string"),
            place_of_service: wrapped("string"),
            type_of_bill: wrapped("string"),
          },
          required: [],
          additionalProperties: false,
        },
        financials: {
          type: "object",
          properties: {
            total_billed_amount: wrapped("number"),
            allowed_amount: wrapped("number"),
            paid_amount: wrapped("number"),
            denied_amount: wrapped("number"),
            patient_responsibility: wrapped("number"),
          },
          required: [],
          additionalProperties: false,
        },
        codes: {
          type: "object",
          properties: {
            cpt_codes: wrappedArray("string"),
            hcpcs_codes: wrappedArray("string"),
            modifier_codes: wrappedArray("string"),
            icd10_codes: wrappedArray("string"),
            diagnosis_pointers: wrappedArray("string"),
          },
          required: [],
          additionalProperties: false,
        },
        claim_line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              service_date: { type: ["string", "null"] },
              procedure_code: { type: ["string", "null"] },
              modifier: { type: ["string", "null"] },
              units: { type: ["number", "null"] },
              charge_amount: { type: ["number", "null"] },
              allowed_amount: { type: ["number", "null"] },
              paid_amount: { type: ["number", "null"] },
              denied_amount: { type: ["number", "null"] },
              diagnosis_pointer: { type: ["string", "null"] },
              denial_reason: { type: ["string", "null"] },
              evidence_snippet: { type: ["string", "null"] },
              source_location: { type: ["string", "null"] },
              confidence: { type: ["number", "null"] },
            },
            required: [],
            additionalProperties: false,
          },
        },
        review_flags: {
          type: "array",
          description: "Specific issues the human should review (low-confidence fields, missing critical data, code mismatches).",
          items: {
            type: "object",
            properties: {
              field_path: { type: "string", description: "e.g. claim_header.denial_reason_codes" },
              reason: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["field_path", "reason", "severity"],
            additionalProperties: false,
          },
        },
        unmapped_text: {
          type: "array",
          description: "Substantial text from the document that did not map cleanly to any structured field but may matter (e.g. appeal language, remarks, EOB notes).",
          items: { type: "string" },
        },
        document_summary: {
          type: "string",
          description: "2-4 sentence neutral description of what kind of document this is and what claims it contains.",
        },
      },
      required: ["claim_header", "patient", "provider", "service", "financials", "codes", "claim_line_items", "review_flags", "unmapped_text", "document_summary"],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const sourceText: string | undefined = body.sourceText;
    const imageDataUrl: string | undefined = body.imageDataUrl; // data:image/...;base64,...
    const fileName: string | undefined = body.fileName;

    const hasText = typeof sourceText === "string" && sourceText.trim().length >= 20;
    const hasImage = typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:");

    if (!hasText && !hasImage) {
      return new Response(JSON.stringify({ error: "Provide sourceText (min 20 chars) or imageDataUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Vision uses the multimodal content array; text uses a string.
    const userContent: any = hasImage
      ? [
          {
            type: "text",
            text: `Parse this claim document into structured claim data with evidence snippets. ${
              fileName ? `Filename: ${fileName}.` : ""
            } ${hasText ? `Additional extracted text:\n\n${sourceText}` : ""}`,
          },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]
      : `Parse this claim document into structured claim data with evidence snippets. ${
          fileName ? `Filename: ${fileName}.\n\n` : ""
        }${sourceText}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: hasImage ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
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

    const claim = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ claim }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("claim-parser error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
