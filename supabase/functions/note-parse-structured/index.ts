// Structured clinical note parser for the Crosswalk Engine.
// Extracts a strict, evidence-anchored representation of a behavioral health note
// (HPI, MSE, assessment, risk, plan, time statement, medication management,
// psychotherapy narrative). Used as the "clinical" side of the claim-clinical crosswalk.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────── Deterministic note-code sweep ────────────
const NOTE_CPT_RE = /\b([0-9]{5}|[A-Z][0-9]{4})\b/g;
const NOTE_MOD_AFTER_CPT_RE = /\b(?:[0-9]{5}|[A-Z][0-9]{4})\s*[-–,\s]\s*([0-9A-Z]{2})\b/g;
const NOTE_MOD_LABEL_RE = /\bmod(?:ifier)?[:\s-]*([0-9A-Z]{2})\b/gi;
const KNOWN_NOTE_MODS = new Set<string>([
  "22","24","25","26","27","32","33","51","52","53","57","58","59","62","76","77","78","79",
  "90","91","92","93","95","99","GT","GQ","KX","XS","XU","XE","XP","TC",
]);
const KNOWN_NOTE_CPT_PREFIX = /^(9[09][0-9]{3}|G[0-9]{4}|H[0-9]{4})$/i;

function sweepNoteCodes(note: any, raw: string): void {
  if (!note || typeof note !== "object") return;
  const cpts = Array.from(new Set(
    Array.from(raw.matchAll(NOTE_CPT_RE), (m) => m[1])
      .filter((c) => KNOWN_NOTE_CPT_PREFIX.test(c))
  ));
  const mods = Array.from(new Set([
    ...Array.from(raw.matchAll(NOTE_MOD_AFTER_CPT_RE), (m) => m[1].toUpperCase()),
    ...Array.from(raw.matchAll(NOTE_MOD_LABEL_RE), (m) => m[1].toUpperCase()),
  ])).filter((m) => KNOWN_NOTE_MODS.has(m));

  const existingCpts: string[] = Array.isArray(note.cpt_codes_in_note) ? note.cpt_codes_in_note : [];
  const existingMods: string[] = Array.isArray(note.modifiers_in_note) ? note.modifiers_in_note : [];

  note.cpt_codes_in_note = Array.from(new Set([...existingCpts, ...cpts]));
  note.modifiers_in_note = Array.from(new Set([...existingMods, ...mods]));
}

function buildSystemPrompt(): string {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const humanDate = today.toUTCString().slice(0, 16);
  return `You are a strict behavioral-health documentation parser.
You extract ONLY what is explicitly documented in the clinical note.
You NEVER infer, summarize loosely, or fabricate clinical content.
If a section is not present, return it as null/empty — do not guess.
Every extracted item must have an evidence_quote (verbatim from the note, ≤25 words).

CONTEXT: Today's date is ${humanDate} (${isoDate}). Treat any date on or before today as a normal past/present session date — do NOT flag current-year dates as "in the future" unless they are strictly AFTER ${isoDate}.

CODE CAPTURE (CRITICAL — do not skip):
- A CPT code is 5 characters: 5 digits (e.g. 99214, 90834, 90837) OR 1 letter + 4 digits (e.g. G0438).
- A modifier is 2 characters following a CPT, often after a hyphen, dash, comma, space, or in a separate field (e.g. "99214-95", "99214 95", "Modifier: 95"). Capture ALL of them in modifiers_in_note.
- Telehealth modifier 95 is REQUIRED when the note documents a telehealth visit. Always look for it in the note header, billing section, signature block, or anywhere else.
- If you see ANY 5-character CPT-shaped token in the note (header, footer, billing line, addendum), include it in cpt_codes_in_note.
- Do not omit codes just because they appear outside the clinical narrative — billing strips and footers count.

MULTI-PAGE NOTES:
- If multiple page images are provided, they are pages of the SAME note in order. Read every page before declaring a section absent — assessment, plan, signature, and addenda often live on later pages.`;
}

const wrappedText = {
  type: "object",
  properties: {
    text: { type: ["string", "null"] },
    evidence_quote: { type: ["string", "null"] },
    present: { type: "boolean" },
  },
  required: ["present"],
  additionalProperties: false,
};

const wrappedBool = {
  type: "object",
  properties: {
    value: { type: ["boolean", "null"] },
    evidence_quote: { type: ["string", "null"] },
  },
  required: [],
  additionalProperties: false,
};

const EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "extract_note",
    description: "Extract structured clinical note content with evidence quotes.",
    parameters: {
      type: "object",
      properties: {
        // Visit identification
        visit_type: {
          type: ["string", "null"],
          description: "Documented visit type: psychotherapy, med management, intake, family, group, crisis, combined E/M+psychotherapy, etc.",
        },
        visit_type_evidence: { type: ["string", "null"] },

        date_of_service: { type: ["string", "null"] },

        // Time documentation (critical for time-based codes)
        time_documented: {
          type: "object",
          properties: {
            start_time: { type: ["string", "null"] },
            stop_time: { type: ["string", "null"] },
            total_minutes: { type: ["integer", "null"] },
            psychotherapy_minutes: { type: ["integer", "null"], description: "Time spent on psychotherapy specifically (when E/M+psychotherapy)." },
            em_minutes: { type: ["integer", "null"], description: "Time spent on E/M specifically (when E/M+psychotherapy)." },
            time_statement_present: { type: "boolean", description: "True only if note explicitly states time." },
            evidence_quote: { type: ["string", "null"] },
          },
          required: ["time_statement_present"],
          additionalProperties: false,
        },

        // HPI
        hpi: wrappedText,

        // Mental Status Exam (per-domain)
        mse: {
          type: "object",
          properties: {
            appearance: wrappedText,
            behavior: wrappedText,
            speech: wrappedText,
            mood: wrappedText,
            affect: wrappedText,
            thought_process: wrappedText,
            thought_content: wrappedText,
            cognition: wrappedText,
            insight: wrappedText,
            judgment: wrappedText,
          },
          required: [],
          additionalProperties: false,
        },

        // Symptoms (each diagnosis claim must be defended by symptoms)
        symptoms_documented: {
          type: "array",
          description: "Distinct symptoms explicitly documented in the note.",
          items: {
            type: "object",
            properties: {
              symptom: { type: "string" },
              duration: { type: ["string", "null"], description: "e.g. '6 weeks', 'ongoing for 3 months'." },
              severity: { type: ["string", "null"] },
              evidence_quote: { type: "string" },
            },
            required: ["symptom", "evidence_quote"],
            additionalProperties: false,
          },
        },

        // Functional impairment evidence
        functional_impairment: {
          type: "object",
          properties: {
            documented: { type: "boolean" },
            domains_affected: { type: "array", items: { type: "string" }, description: "e.g. work, school, sleep, relationships, ADLs." },
            evidence_quote: { type: ["string", "null"] },
          },
          required: ["documented"],
          additionalProperties: false,
        },

        // Risk
        risk_assessment: {
          type: "object",
          properties: {
            assessed: { type: "boolean" },
            si_documented: { type: ["boolean", "null"] },
            hi_documented: { type: ["boolean", "null"] },
            risk_level_stated: { type: ["string", "null"], description: "Risk level as documented (low/moderate/high)." },
            safety_plan_present: { type: ["boolean", "null"] },
            evidence_quote: { type: ["string", "null"] },
          },
          required: ["assessed"],
          additionalProperties: false,
        },

        // Assessment / diagnoses with their support
        assessment: wrappedText,
        diagnoses_in_note: {
          type: "array",
          description: "ICD-10 codes explicitly stated in the note (with the diagnosis text).",
          items: {
            type: "object",
            properties: {
              code: { type: ["string", "null"], description: "ICD-10 code if written." },
              label: { type: "string" },
              evidence_quote: { type: "string" },
            },
            required: ["label", "evidence_quote"],
            additionalProperties: false,
          },
        },

        // Medical necessity statement
        medical_necessity_statement: wrappedText,

        // Treatment plan
        treatment_plan: wrappedText,

        // Psychotherapy narrative (REQUIRED for psychotherapy CPT codes)
        psychotherapy_narrative: {
          type: "object",
          properties: {
            present: { type: "boolean" },
            modality: { type: ["string", "null"], description: "e.g. CBT, DBT, supportive, psychodynamic." },
            interventions: { type: "array", items: { type: "string" }, description: "Specific interventions documented." },
            patient_response: { type: ["string", "null"] },
            evidence_quote: { type: ["string", "null"] },
          },
          required: ["present"],
          additionalProperties: false,
        },

        // Medication management (REQUIRED for E/M / med management CPT codes)
        medication_management: {
          type: "object",
          properties: {
            medications_reviewed: { type: ["boolean", "null"] },
            medications_listed: { type: "array", items: { type: "string" } },
            changes_made: { type: ["boolean", "null"] },
            change_details: { type: ["string", "null"] },
            rationale_documented: { type: ["boolean", "null"] },
            rationale_quote: { type: ["string", "null"] },
            side_effects_discussed: { type: ["boolean", "null"] },
            adherence_discussed: { type: ["boolean", "null"] },
            evidence_quote: { type: ["string", "null"] },
          },
          required: [],
          additionalProperties: false,
        },

        // Modifiers / coding signals in the note
        cpt_codes_in_note: { type: "array", items: { type: "string" } },
        modifiers_in_note: { type: "array", items: { type: "string" } },

        // Quality / integrity signals
        copy_forward_indicators: {
          type: "array",
          description: "Specific phrases or patterns that suggest cloned/copy-forward documentation.",
          items: { type: "string" },
        },
        internal_contradictions: {
          type: "array",
          description: "Two statements within the note that contradict each other.",
          items: {
            type: "object",
            properties: {
              statement_a: { type: "string" },
              statement_b: { type: "string" },
              why_it_contradicts: { type: "string" },
            },
            required: ["statement_a", "statement_b", "why_it_contradicts"],
            additionalProperties: false,
          },
        },

        document_summary: {
          type: "string",
          description: "2-3 sentence neutral description of what the note documents.",
        },
      },
      required: [
        "time_documented",
        "mse",
        "symptoms_documented",
        "functional_impairment",
        "risk_assessment",
        "diagnoses_in_note",
        "psychotherapy_narrative",
        "medication_management",
        "copy_forward_indicators",
        "internal_contradictions",
        "document_summary",
      ],
      additionalProperties: false,
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const sourceText: string | undefined = body.sourceText;
    const imageDataUrl: string | undefined = body.imageDataUrl;
    const imageDataUrlsRaw: unknown = body.imageDataUrls;
    const fileName: string | undefined = body.fileName;

    const imageList: string[] = Array.isArray(imageDataUrlsRaw)
      ? imageDataUrlsRaw.filter((s): s is string => typeof s === "string" && s.startsWith("data:"))
      : [];
    if (imageList.length === 0 && typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:")) {
      imageList.push(imageDataUrl);
    }

    const hasText = typeof sourceText === "string" && sourceText.trim().length >= 20;
    const hasImage = imageList.length > 0;

    if (!hasText && !hasImage) {
      return new Response(JSON.stringify({ error: "Provide sourceText (min 20 chars) or imageDataUrl(s)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userContent: any = hasImage
      ? [
          {
            type: "text",
            text: `Parse this behavioral health clinical note into the strict structure. ${
              fileName ? `Filename: ${fileName}.` : ""
            } ${imageList.length > 1 ? `${imageList.length} page images attached — read EVERY page before deciding a section is absent.` : ""} ${
              hasText ? `Additional extracted text:\n\n${sourceText}` : ""
            }`,
          },
          ...imageList.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : `Parse this behavioral health clinical note into the strict structure.${
          fileName ? ` Filename: ${fileName}.` : ""
        }\n\n${sourceText}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: hasImage ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userContent },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "extract_note" } },
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
      return new Response(JSON.stringify({ error: "AI extraction failed" }), {
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

    const note = JSON.parse(toolCall.function.arguments);

    // Deterministic safety net: sweep raw text for CPTs/modifiers the model may have missed.
    if (hasText && sourceText) {
      try {
        sweepNoteCodes(note, sourceText);
      } catch (e) {
        console.error("Note code sweep failed (non-fatal):", e);
      }
    }

    return new Response(JSON.stringify({ note }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("note-parse-structured error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
