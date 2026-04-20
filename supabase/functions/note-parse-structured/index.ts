// Structured clinical note parser for the Crosswalk Engine.
// Extracts a strict, evidence-anchored representation of a behavioral health note
// (HPI, MSE, assessment, risk, plan, time statement, medication management,
// psychotherapy narrative). Used as the "clinical" side of the claim-clinical crosswalk.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Reject any caller that is not a signed-in user. Without this, the function is
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
- If multiple page images are provided, they are pages of the SAME note in order. Read every page before declaring a section absent — assessment, plan, signature, and addenda often live on later pages.

STANDARDIZED SCALE INTERPRETATION (CRITICAL — primary evidence):
Standardized psychiatric rating scales are PRIMARY evidence of severity. If a valid scale score appears anywhere in the note (narrative, header, flowsheet, attached form, score line, addendum), you MUST extract it and use it to determine severity.

Recognized scales and severity bands:
- PHQ-9 (depression, self-report): 0–4 minimal, 5–9 mild, 10–14 moderate, 15–19 moderately severe, 20–27 severe
- GAD-7 (anxiety, self-report): 0–4 minimal, 5–9 mild, 10–14 moderate, 15–21 severe
- Y-BOCS (OCD, clinician-administered): 0–7 subclinical, 8–15 mild, 16–23 moderate, 24–31 severe, 32–40 extreme
- PCL-5 (PTSD, self-report, 0–80): 0–30 minimal, 31–33 mild/threshold, 34–49 moderate, 50+ severe. Score ≥33 suggests probable PTSD.
- CAPS-5 (PTSD, clinician-administered): GOLD STANDARD — treat as high-confidence evidence for diagnosis, severity, and medical necessity. If both CAPS-5 and PCL-5 are present, prioritize CAPS-5.
- MDQ (bipolar screen, self-report): ≥7 with functional impairment item endorsed = positive screen
- Adult ADHD Rating Scale / ASRS (self-report): use documented thresholds if stated; otherwise treat elevated scores as "clinically significant ADHD symptoms present"
- Also capture if present: MoCA, MMSE, AUDIT, DAST, HAM-D, HAM-A, MADRS, EPDS, CSSRS

Hard rules:
1. Extract the raw score for each scale found.
2. Map the score to severity using the bands above.
3. Treat the derived severity as documented evidence — populate symptoms_documented severity AND functional_impairment when the scale supports it.
4. NEVER say "severity not documented" if a valid scale score is present. Reference the scale explicitly (e.g., "PHQ-9 = 18, moderately severe").
5. Clinician-administered scales (CAPS-5, Y-BOCS, HAM-D, HAM-A, MADRS) outweigh self-report scales (PHQ-9, GAD-7, PCL-5, MDQ, ASRS) when both address the same domain.
6. If the scale-derived severity contradicts the narrative severity (e.g., "mild anxiety" but GAD-7 = 17), record the contradiction in internal_contradictions.
7. The evidence_quote for a scale finding must be the verbatim score line from the note (e.g., "PHQ-9: 18").
8. NEVER fabricate a score or band that is not present in the note.`;
}

// ──────────── Standardized scale severity bands ────────────
type ScaleBand = {
  name: string;
  type: "self-report" | "clinician-administered";
  bands: Array<{ min: number; max: number; severity: string }>;
  threshold_note?: string;
};

const SCALE_BANDS: Record<string, ScaleBand> = {
  "PHQ-9": { name: "PHQ-9", type: "self-report", bands: [
    { min: 0, max: 4, severity: "minimal" },
    { min: 5, max: 9, severity: "mild" },
    { min: 10, max: 14, severity: "moderate" },
    { min: 15, max: 19, severity: "moderately severe" },
    { min: 20, max: 27, severity: "severe" },
  ]},
  "GAD-7": { name: "GAD-7", type: "self-report", bands: [
    { min: 0, max: 4, severity: "minimal" },
    { min: 5, max: 9, severity: "mild" },
    { min: 10, max: 14, severity: "moderate" },
    { min: 15, max: 21, severity: "severe" },
  ]},
  "Y-BOCS": { name: "Y-BOCS", type: "clinician-administered", bands: [
    { min: 0, max: 7, severity: "subclinical" },
    { min: 8, max: 15, severity: "mild" },
    { min: 16, max: 23, severity: "moderate" },
    { min: 24, max: 31, severity: "severe" },
    { min: 32, max: 40, severity: "extreme" },
  ]},
  "PCL-5": { name: "PCL-5", type: "self-report", bands: [
    { min: 0, max: 30, severity: "minimal" },
    { min: 31, max: 33, severity: "mild / threshold" },
    { min: 34, max: 49, severity: "moderate" },
    { min: 50, max: 80, severity: "severe" },
  ], threshold_note: "Score ≥33 suggests probable PTSD." },
  "MDQ": { name: "MDQ", type: "self-report", bands: [
    { min: 0, max: 6, severity: "negative screen" },
    { min: 7, max: 13, severity: "positive screen" },
  ]},
};

const SCALE_REGEXES: Array<{ key: string; re: RegExp }> = [
  { key: "PHQ-9", re: /\bPHQ[-\s]?9\b[^0-9]{0,15}(\d{1,2})\b/i },
  { key: "GAD-7", re: /\bGAD[-\s]?7\b[^0-9]{0,15}(\d{1,2})\b/i },
  { key: "Y-BOCS", re: /\bY[-\s]?BOCS\b[^0-9]{0,15}(\d{1,2})\b/i },
  { key: "PCL-5", re: /\bPCL[-\s]?5\b[^0-9]{0,15}(\d{1,3})\b/i },
  { key: "CAPS-5", re: /\bCAPS[-\s]?5\b[^0-9]{0,15}(\d{1,3})?/i },
  { key: "MDQ", re: /\bMDQ\b[^0-9]{0,15}(\d{1,2})\b/i },
  { key: "ASRS", re: /\b(?:ASRS|Adult ADHD(?:\s+Rating\s+Scale)?)\b[^0-9]{0,20}(\d{1,3})\b/i },
];

function deriveSeverity(scaleKey: string, score: number): string | null {
  const def = SCALE_BANDS[scaleKey];
  if (!def) return null;
  for (const b of def.bands) {
    if (score >= b.min && score <= b.max) return b.severity;
  }
  return null;
}

function getScaleType(scaleKey: string): "self-report" | "clinician-administered" {
  if (SCALE_BANDS[scaleKey]) return SCALE_BANDS[scaleKey].type;
  // Clinician-administered scales without numeric bands in our table
  if (/^(CAPS-5|HAM-D|HAM-A|MADRS|MMSE|MoCA)$/i.test(scaleKey)) return "clinician-administered";
  return "self-report";
}

function sweepStandardizedScales(note: any, raw: string): void {
  if (!note || typeof note !== "object" || !raw) return;
  const found: any[] = Array.isArray(note.standardized_scales) ? [...note.standardized_scales] : [];
  const seen = new Set(found.map((s: any) => `${s.scale}:${s.score ?? "noscore"}`));

  for (const { key, re } of SCALE_REGEXES) {
    const m = raw.match(re);
    if (!m) continue;
    const scoreRaw = m[1];
    const score = scoreRaw ? parseInt(scoreRaw, 10) : NaN;
    const hasScore = !Number.isNaN(score);
    const severity = hasScore ? deriveSeverity(key, score) : null;
    const id = `${key}:${hasScore ? score : "noscore"}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const entry: any = {
      scale: key,
      type: getScaleType(key),
      score: hasScore ? score : null,
      severity: severity ?? null,
      evidence_quote: m[0].slice(0, 80),
    };
    if (key === "PCL-5" && hasScore && score >= 33) {
      entry.threshold_flag = "≥33 suggests probable PTSD";
    }
    found.push(entry);
  }
  if (found.length > 0) note.standardized_scales = found;
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

        // Standardized rating scales (PHQ-9, GAD-7, Y-BOCS, PCL-5, CAPS-5, MDQ, ASRS, etc.)
        standardized_scales: {
          type: "array",
          description: "Each standardized scale documented in the note with score, type (self-report vs clinician-administered), and derived severity.",
          items: {
            type: "object",
            properties: {
              scale: { type: "string", description: "Scale name, e.g. PHQ-9, GAD-7, Y-BOCS, PCL-5, CAPS-5, MDQ, ASRS." },
              type: { type: ["string", "null"], description: "'self-report' or 'clinician-administered'. Clinician-administered outweighs self-report." },
              score: { type: ["integer", "null"] },
              severity: { type: ["string", "null"], description: "Severity band derived from the score using accepted clinical ranges." },
              threshold_flag: { type: ["string", "null"], description: "Diagnostic threshold note, e.g. PCL-5 ≥33 suggests probable PTSD." },
              evidence_quote: { type: "string", description: "Verbatim score line from the note." },
            },
            required: ["scale", "evidence_quote"],
            additionalProperties: false,
          },
        },

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

  const unauth = await requireAuth(req);
  if (unauth) return unauth;

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

    // Deterministic safety net: sweep raw text for CPTs/modifiers and standardized scales
    // the model may have missed, and re-derive severity bands from raw scores.
    if (hasText && sourceText) {
      try {
        sweepNoteCodes(note, sourceText);
        sweepStandardizedScales(note, sourceText);
      } catch (e) {
        console.error("Note deterministic sweep failed (non-fatal):", e);
      }
    }

    // Backfill severity, type, and threshold flag for any scale entries the model returned.
    if (Array.isArray(note?.standardized_scales)) {
      for (const s of note.standardized_scales) {
        if (!s || typeof s !== "object") continue;
        if (typeof s.score === "number" && (!s.severity || s.severity === "")) {
          const derived = deriveSeverity(s.scale, s.score);
          if (derived) s.severity = derived;
        }
        if (!s.type && typeof s.scale === "string") {
          s.type = getScaleType(s.scale);
        }
        if (s.scale === "PCL-5" && typeof s.score === "number" && s.score >= 33 && !s.threshold_flag) {
          s.threshold_flag = "≥33 suggests probable PTSD";
        }
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
