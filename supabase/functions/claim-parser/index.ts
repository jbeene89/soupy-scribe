// Claim Upload Parser — structured claim extraction with evidence snippets.
// Accepts plain text OR image data (base64 data URL) and returns a strict claim shape.
// Behavioral-health-friendly but generic across payer claims/EOBs/remits/denial letters.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ──────────── Deterministic code sweep (safety net for the LLM) ────────────
// CPT/HCPCS = 5 chars: 5 digits OR 1 letter + 4 digits (e.g. 99214, J3490, G0438).
const CPT_RE = /\b([0-9]{5}|[A-Z][0-9]{4})\b/g;

// US ZIP code = 5 digits in known assignable ranges (00501–99950).
// CPT codes live in 00100–99607 (numeric range), but the *assigned* CPT space
// excludes the bulk of 5-digit numbers that look like ZIPs. We treat any
// 5-digit number that (a) is a plausible US ZIP AND (b) is NOT in our
// KNOWN_CPT allowlist AND (c) appears near address/location context as a ZIP
// and refuse to classify it as a CPT/HCPCS/ICD code.
const ZIP_RE = /\b[0-9]{5}\b/;
function looksLikeZip(token: string): boolean {
  if (!/^[0-9]{5}$/.test(token)) return false;
  const n = parseInt(token, 10);
  // US ZIPs span roughly 00501 (Holtsville, NY) to 99950 (Ketchikan, AK)
  return n >= 501 && n <= 99950;
}
function isZipInContext(token: string, raw: string): boolean {
  if (!looksLikeZip(token)) return false;
  // Find every occurrence of the token and check ~40 chars of surrounding context.
  const ctxRe = new RegExp(`.{0,40}\\b${token}\\b.{0,40}`, "gi");
  const matches = raw.match(ctxRe) || [];
  if (matches.length === 0) return false;
  // Address/location signals that mean this is a ZIP, not a procedure code.
  const ZIP_CTX = /\b(zip|postal|address|addr|street|st\.?|ave|avenue|blvd|road|rd\.?|suite|ste\.?|city|state|[A-Z]{2}\s+[0-9]{5})\b/i;
  // US state abbreviation immediately before the number: "NY 10001", "CA 90210"
  const STATE_BEFORE = new RegExp(`\\b(A[KLRZ]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AT]|W[AIVY])\\s+${token}\\b`);
  return matches.some((m) => ZIP_CTX.test(m)) || STATE_BEFORE.test(raw);
}
// Modifier = 2 chars after a CPT, separated by hyphen/space/dash/comma. Captures common modifiers.
// Also matches a column-style "Mod: 95" or "Modifier 95".
const MOD_AFTER_CPT_RE = /\b(?:[0-9]{5}|[A-Z][0-9]{4})\s*[-–,\s]\s*([0-9A-Z]{2})\b/g;
const MOD_LABEL_RE = /\bmod(?:ifier)?[:\s-]*([0-9A-Z]{2})\b/gi;
// ICD-10 = 1 letter + 2 digits + optional .xxx
const ICD_RE = /\b([A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)\b/g;

// Common CPT codes that should never be filtered out.
const KNOWN_CPT = new Set<string>([
  "99202","99203","99204","99205","99211","99212","99213","99214","99215",
  "99421","99422","99423","99441","99442","99443",
  "90791","90792","90832","90834","90837","90839","90840","90846","90847","90853",
  "96127","96130","96131","96136","96137","96138","96139",
  "G0438","G0439","G0444","G0506",
]);

// Reasonable modifier whitelist (we don't want to pull random 2-char tokens).
const KNOWN_MODS = new Set<string>([
  "22","24","25","26","27","32","33","47","50","51","52","53","54","55","56","57","58","59","62","63","66","73","74","76","77","78","79","80","81","82",
  "90","91","92","93","95","99",
  "AA","AD","AS","AT","CR","CS","CT","ET","FX","FY","GA","GC","GE","GG","GH","GJ","GN","GO","GP","GQ","GR","GS","GT","GV","GW","GX","GY","GZ",
  "HA","HB","HD","HE","HF","HG","HH","HI","HJ","HK","HL","HM","HN","HO","HP","HQ","HR","HS","HT","HU","HV","HW","HX","HY","HZ",
  "JA","JB","JW","KX","LT","RT","NU","RR","UE","TA","T1","T2","T3","T4","T5","T6","T7","T8","T9","TC","XE","XP","XS","XU",
]);

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function sweepCodesIntoClaim(claim: any, raw: string): void {
  if (!claim || typeof claim !== "object") return;
  claim.codes ??= {};
  claim.claim_line_items ??= [];

  const text = raw;

  // ── ZIP scrub: strip any LLM-returned 5-digit ZIP-shaped numbers from
  //     CPT / HCPCS / ICD fields and from line items. Address numerics must
  //     never appear as procedure or diagnosis codes.
  const scrubZipFromArrayField = (field: any): any => {
    if (!field || !Array.isArray(field.value)) return field;
    const cleaned = field.value.filter((c: string) => {
      const s = String(c || "").trim();
      if (!s) return false;
      if (KNOWN_CPT.has(s)) return true;
      if (/^[0-9]{5}$/.test(s) && isZipInContext(s, text)) return false;
      return true;
    });
    return { ...field, value: cleaned };
  };
  if (claim.codes?.cpt_codes)   claim.codes.cpt_codes   = scrubZipFromArrayField(claim.codes.cpt_codes);
  if (claim.codes?.hcpcs_codes) claim.codes.hcpcs_codes = scrubZipFromArrayField(claim.codes.hcpcs_codes);
  if (claim.codes?.icd10_codes) claim.codes.icd10_codes = scrubZipFromArrayField(claim.codes.icd10_codes);
  if (Array.isArray(claim.claim_line_items)) {
    claim.claim_line_items = claim.claim_line_items.filter((li: any) => {
      const code = String(li?.procedure_code || "").trim();
      if (!code) return true; // keep blanks; sweep may fill them
      if (KNOWN_CPT.has(code)) return true;
      if (/^[0-9]{5}$/.test(code) && isZipInContext(code, text)) return false;
      return true;
    });
  }

  // CPTs — exclude 5-digit numbers that look like US ZIP codes in address context.
  const cptHits = dedupe(Array.from(text.matchAll(CPT_RE), (m) => m[1]))
    .filter((c) => {
      if (!/^[0-9]{5}$/.test(c)) return true; // letter-prefixed HCPCS (J/G/etc.) cannot be a ZIP
      if (KNOWN_CPT.has(c)) return true;       // explicit allowlist always wins
      if (isZipInContext(c, text)) return false; // ZIP in address context → drop
      return true;
    });

  // Modifiers (two passes: after-cpt and labelled)
  const modHits = dedupe([
    ...Array.from(text.matchAll(MOD_AFTER_CPT_RE), (m) => m[1].toUpperCase()),
    ...Array.from(text.matchAll(MOD_LABEL_RE), (m) => m[1].toUpperCase()),
  ]).filter((m) => KNOWN_MODS.has(m));

  // ICDs
  const icdHits = dedupe(Array.from(text.matchAll(ICD_RE), (m) => m[1]))
    .filter((c) => c.includes(".") || /^[FGHIJKLMNRSTZ][0-9]{2}$/.test(c)); // bias toward likely codes

  const wrapField = (existing: any, found: string[], snippetHint: string) => {
    const current: string[] = Array.isArray(existing?.value) ? existing.value : [];
    const merged = dedupe([...current, ...found]);
    if (merged.length === current.length) return existing;
    return {
      value: merged,
      evidence_snippet: existing?.evidence_snippet || snippetHint,
      source_location: existing?.source_location || "Code sweep (deterministic)",
      confidence: Math.max(existing?.confidence ?? 0.85, 0.85),
    };
  };

  if (cptHits.length) {
    claim.codes.cpt_codes = wrapField(claim.codes.cpt_codes, cptHits, `Found in document: ${cptHits.slice(0, 3).join(", ")}`);
  }
  if (modHits.length) {
    claim.codes.modifier_codes = wrapField(claim.codes.modifier_codes, modHits, `Found in document: ${modHits.slice(0, 3).join(", ")}`);
  }
  if (icdHits.length) {
    claim.codes.icd10_codes = wrapField(claim.codes.icd10_codes, icdHits, `Found in document: ${icdHits.slice(0, 3).join(", ")}`);
  }

  // Ensure every CPT has at least a stub line item
  const existingProcs = new Set<string>(
    (claim.claim_line_items || []).map((li: any) => (li.procedure_code || "").toString()).filter(Boolean)
  );
  const allCpts: string[] = Array.isArray(claim.codes?.cpt_codes?.value) ? claim.codes.cpt_codes.value : [];
  for (const cpt of allCpts) {
    if (!existingProcs.has(cpt)) {
      // Try to attach the most likely modifier — prefer one adjacent to this CPT in the text.
      const adj = new RegExp(`\\b${cpt}\\s*[-–,\\s]\\s*([0-9A-Z]{2})\\b`).exec(text);
      const adjMod = adj && KNOWN_MODS.has(adj[1].toUpperCase()) ? adj[1].toUpperCase() : null;
      claim.claim_line_items.push({
        service_date: null,
        procedure_code: cpt,
        modifier: adjMod,
        units: null,
        charge_amount: null,
        allowed_amount: null,
        paid_amount: null,
        denied_amount: null,
        diagnosis_pointer: null,
        denial_reason: null,
        evidence_snippet: `Recovered by code sweep: ${cpt}${adjMod ? ` modifier ${adjMod}` : ""}`,
        source_location: "Code sweep (deterministic)",
        confidence: 0.8,
      });
    }
  }
}

function buildSystemPrompt(): string {
  // Inject today's date so the model doesn't false-flag current dates as "in the future".
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const humanDate = today.toUTCString().slice(0, 16); // e.g. "Thu, 17 Apr 2026"
  return `You are a medical claim parsing engine.

CONTEXT: Today's date is ${humanDate} (${isoDate}). Treat any service date or signature date on or before today as a normal past/present date — do NOT flag current-year dates as "in the future" unless they are strictly AFTER today's date. Only dates strictly after ${isoDate} should be flagged as future-dated.

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
- ZIP CODE GUARD: A 5-digit number that appears next to address words ("Address", "Street", "Suite", "City", a 2-letter US state like "NY 10001" or "CA 90210", or "ZIP/Postal") is a ZIP code, NOT a CPT/HCPCS/ICD code. Classify it as address/location only. NEVER place ZIP-shaped numerics into codes.cpt_codes, codes.hcpcs_codes, codes.icd10_codes, or claim_line_items[].procedure_code.
- Every CPT code you find MUST also produce a claim_line_items entry. Never report CPTs in codes.cpt_codes without a matching line item.

⚠️ BILLED CODES vs REFERENCE CODES — DO NOT CONFUSE THEM:
A document can contain TWO very different kinds of code listings. You must extract ONLY from the billed-claim region.

EXTRACT CODES ONLY FROM these BILLED regions:
  • CMS-1500 / HCFA-1500 boxes 24A–24J (the service-lines grid in the lower half of the form).
  • UB-04 form locators 42–47 (revenue codes / HCPCS / service lines).
  • A "Service Lines", "Claim Lines", "Procedures Performed", "Procedures Billed", "Charges", or "Line Items" table.
  • An EOB / remittance advice "Service Detail" or "Claim Detail" section that shows charge → allowed → paid per line.
  • A superbill section explicitly checked, circled, marked, or filled in by the provider.

NEVER extract codes from these REFERENCE regions (they are NOT what was billed):
  • Fee schedules — any table titled "Fee Schedule", "CPT Reference Rates", "Medicare Rates", "Allowable Amounts", "Pricing", "Rate Sheet", "2026 CPT Rates", or similar.
  • Code lookup tables, code dictionaries, or "Common Codes" appendices.
  • Pre-printed lists of every CPT a practice could bill (e.g. an unmarked superbill template with the full list of psychotherapy codes 90791, 90792, 90832, 90834, 90837, 90846, 90847, 90853, 90785, 90839, 90840, etc.).
  • A practice-management dashboard that displays a CPT rate reference (e.g. "2026 CPT Reference Rates: 90791 \$173.35, 90832 \$85.84, …") — this is a price list, not a billed claim.
  • Educational text, footnotes, billing tips, prior authorization forms, or appeal templates that mention codes as examples.
  • Any code that appears WITHOUT a matching service date, units, OR charge amount tied specifically to that line.

DECISION RULE: For every CPT candidate, ask yourself:
  1. Is this code inside a billed-claim region (above)? If NO → discard it.
  2. Does this specific code have a service date OR units OR a charge amount tied to THIS line (not just listed in a price column)? If NO → discard it.
  3. Does the surrounding context describe what the provider actually performed for THIS patient on THIS date? If NO → discard it.
Only codes that pass all three checks belong in codes.cpt_codes and claim_line_items.

ADD-ON CODE SANITY: Codes like 90785 (interactive complexity), 90833/90836/90838 (psychotherapy add-ons), 99354–99357, 99417, G0463 add-ons, etc. are ADD-ON codes. They cannot be billed alone. If you only see an add-on code with no companion primary E/M or psychotherapy code in the same billed line, you are almost certainly looking at a reference/fee-schedule list — discard it.

If the document is ENTIRELY a fee schedule, dashboard, or reference sheet with no actual billed claim, return claim_line_items: [] and codes.cpt_codes.value: [], and add a high-severity review_flag explaining "No billed claim detected — document appears to be a reference/fee schedule."

PATIENT DEMOGRAPHICS — DATE OF BIRTH (common failure mode):
- DOB is almost always present on a billed claim. Look HARD before returning null.
- On CMS-1500: DOB is in BOX 3 ("PATIENT'S BIRTH DATE / SEX"), printed as MM | DD | YYYY in three small boxes near the top-left, just under the patient name (Box 2). The three segments are visually separated by vertical lines — read them as a single date, not three separate numbers.
- On UB-04: DOB is in form locator 10 ("BIRTHDATE"), formatted MMDDYYYY (8 digits, no separators).
- On EOBs / remits / superbills: look for labels "DOB", "D.O.B.", "Birth Date", "Date of Birth", "Born", or "Patient DOB" — value usually follows on the same line or the line below.
- Accept ANY of these formats and normalize to MM/DD/YYYY in the value: "01/15/1985", "1-15-1985", "01151985", "Jan 15, 1985", "January 15 1985", "1985-01-15", "15/01/1985" (only when context clearly indicates non-US format).
- Do NOT confuse DOB with: date of service (Box 24A / FL 45), date of injury (Box 14), signature date (Box 31), claim filing date, or "date received" stamps.
- If the form has a DOB field/box but it is blank, return null with a review_flag — do not guess.
- Sanity check: a valid DOB should produce a patient age between 0 and 120 years relative to the service date. If the parsed DOB falls outside this range, you likely misread it — re-examine.

MULTI-PAGE DOCUMENTS:
- If multiple page images are provided, they are pages of the SAME document in order. Read every page before deciding a field is missing — values often live on page 2 or later (e.g. attached EOBs, remit advice, signature pages).

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
}

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
          description: "Specific issues the human should review (low-confidence fields, missing critical data, code mismatches). DO NOT manufacture flags. If the parsed claim looks complete and internally consistent, return an empty array. A clean claim is a valid outcome — do not pad this list with stylistic or theoretical concerns.",
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
    const imageDataUrl: string | undefined = body.imageDataUrl; // legacy single-image
    const imageDataUrlsRaw: unknown = body.imageDataUrls;       // new multi-page array
    const fileName: string | undefined = body.fileName;

    // Normalize images into a single array (multi-page wins; falls back to legacy single image)
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
            } ${imageList.length > 1 ? `${imageList.length} page images attached — read EVERY page before deciding any field is missing.` : ""} ${
              hasText ? `Additional extracted text:\n\n${sourceText}` : ""
            }`,
          },
          ...imageList.map((url) => ({ type: "image_url", image_url: { url } })),
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
          { role: "system", content: buildSystemPrompt() },
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

    // ──────────── Deterministic safety net ────────────
    // The model occasionally misses CPTs/modifiers/ICDs that are clearly in the text.
    // Sweep the raw source text for known patterns and merge anything missing.
    //
    // SAFETY: only run the sweep if the LLM already identified at least one billed line item.
    // If the LLM returned zero line items, the document is likely a fee schedule / reference sheet
    // and we must NOT manufacture billed codes from raw regex hits against price-list text.
    const llmLineItemCount = Array.isArray(claim?.claim_line_items) ? claim.claim_line_items.length : 0;
    if (hasText && sourceText && llmLineItemCount > 0) {
      try {
        sweepCodesIntoClaim(claim, sourceText);
      } catch (e) {
        console.error("Code sweep failed (non-fatal):", e);
      }
    }

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
