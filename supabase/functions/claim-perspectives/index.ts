// Claim Perspectives — runs 5 CDPT lenses over a single parsed claim.
// Lenses: Builder, Red Team, Systems, Frame Breaker, Empath.
// Each lens returns a short structured analysis grounded ONLY in the parsed claim
// (no external invention). A short synthesis is produced at the end.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Lens = "builder" | "red_team" | "systems" | "frame_breaker" | "empath" | "revenue";

function dateContext(): string {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const humanDate = today.toUTCString().slice(0, 16);
  return `CONTEXT: Today's date is ${humanDate} (${isoDate}). Do NOT flag current-year dates as "future-dated" unless they are strictly after ${isoDate}.`;
}

// Shared rule for every lens. The goal is improvement, not nitpicking.
const NO_NITPICK_RULE = `
IMPORTANT — DO NOT MANUFACTURE PROBLEMS:
- Your job is to help the provider find revenue they're missing or protect revenue at risk — NOT to nitpick a clean claim to death.
- If the claim looks correctly built and well-documented for its category, SAY SO. Return a short headline like "No material issues detected" and an empty or near-empty findings array.
- Only flag a finding if it would plausibly affect payment, compliance, or patient care. Skip stylistic preferences, formatting quibbles, and theoretical edge cases that don't apply to this claim.
- Severity must reflect actual risk: use "low" sparingly, "medium" only when there is a real exposure, "high" only when denial/clawback is likely. If you cannot justify medium or high, do not include the finding.
- It is fully acceptable — and often correct — to return zero findings. A clean claim is a valid outcome.

CRITICAL — NO HALLUCINATED CODES OR FIELDS:
- You may ONLY reference CPT, HCPCS, ICD-10, modifier, POS, or any other code/identifier that LITERALLY APPEARS in the parsed claim JSON (codes.cpt_codes, codes.hcpcs_codes, codes.icd10_codes, codes.modifier_codes, claim_line_items[].procedure_code, claim_line_items[].modifier, etc.).
- Do NOT invent codes the provider "could have used", "should have billed", or "might be missing" by writing a specific code number that is not in the JSON. If you want to suggest a category of service that wasn't billed, describe it in plain English (e.g. "consider whether an add-on service was performed") — never fabricate a code number.
- Do NOT reference patient names, dates, dollar amounts, payer names, or NPIs that are not present in the parsed claim. If a field is null or missing in the JSON, treat it as missing — do not guess.
- Every code or field you cite in a finding MUST be traceable to the JSON. If you cannot point to where it appears, do not cite it.
- Violating this rule produces false audit findings and destroys provider trust. Grounding is more important than thoroughness.`;

const LENS_PROMPTS: Record<Lens, { label: string; system: string }> = {
  builder: {
    label: "Builder — what's defensible",
    system: `You are the BUILDER lens for a behavioral-health claim audit.
Job: identify what is documented well, what supports payment, what makes this claim defensible.
Stay strictly grounded in the parsed claim JSON. Do NOT invent facts.
Be concise, neutral, enterprise tone. No sales language.${NO_NITPICK_RULE}`,
  },
  red_team: {
    label: "Red Team — denial vulnerabilities",
    system: `You are the RED TEAM lens for a behavioral-health claim audit.
Job: identify REAL denial vulnerabilities a payer (UHC/Optum/BCBS/Medicaid) would actually act on.
Cite the specific field path and what is missing or risky. Stay grounded in the JSON only.
Concise, neutral, enterprise tone.${NO_NITPICK_RULE}
Extra rule for Red Team: do not invent denial scenarios that aren't supported by the parsed data. If the claim is clean, say "No material denial vectors identified" and return zero findings.`,
  },
  systems: {
    label: "Systems — process & workflow gaps",
    system: `You are the SYSTEMS lens for a behavioral-health claim audit.
Job: identify upstream process gaps (intake, auth, scheduling, EHR template, supervision, credentialing)
that this claim's data actually points to. Stay grounded in the parsed claim. Concise, enterprise tone.${NO_NITPICK_RULE}`,
  },
  frame_breaker: {
    label: "Frame Breaker — what we may be missing",
    system: `You are the FRAME BREAKER lens for a behavioral-health claim audit.
Job: surface assumptions the parsing pipeline or reviewer may have made that materially affect the audit,
or non-obvious interpretations the reviewer should consider before accepting the result.
Stay grounded. Concise, enterprise tone.${NO_NITPICK_RULE}
Extra rule for Frame Breaker: skip philosophical or low-impact "what ifs". Only surface assumptions that, if wrong, would change the audit conclusion.`,
  },
  empath: {
    label: "Empath — patient & clinician impact",
    system: `You are the EMPATH lens for a behavioral-health claim audit.
Job: name the patient-experience and clinician-burden implications of this claim's denial risk
(e.g. delayed access, abandonment risk, clinician documentation burden) — only when those risks are real.
Stay grounded in the JSON. Concise, neutral, no melodrama.${NO_NITPICK_RULE}
Extra rule for Empath: if the claim shows no meaningful denial risk, the patient/clinician impact is "none material" — say so and stop.`,
  },
  revenue: {
    label: "Revenue — missed or under-billed opportunities",
    system: `You are the REVENUE OPPORTUNITY lens for a behavioral-health claim audit.
Your ONLY job is to help the provider find legitimate revenue they may have missed on THIS claim. You are NOT looking for problems — you are looking for value.

Look for things like:
- Add-on services that commonly accompany the billed CPT(s) but are not present on this claim (describe the CATEGORY in plain English — e.g. "interactive complexity add-on for sessions involving caregivers" — do NOT invent a code number).
- Modifiers that, if applicable to the documented service, could justify higher reimbursement (describe in plain English — do NOT cite a modifier code that isn't already on the claim).
- Time-based code tier mismatches (e.g. a session that may qualify for a longer-duration code if documentation supports it).
- Documentation elements that, if present in the underlying note, would unlock additional billable services.
- Whether the diagnosis pointers fully justify every billed service (or if a stronger Dx is documented elsewhere).

Hard rules:
- Do NOT invent specific CPT/HCPCS/modifier code numbers. Speak in service categories, not code numbers.
- If the claim looks fully optimized for what was documented, SAY SO. Headline: "No clear revenue opportunities identified — claim appears appropriately billed."
- Every opportunity must include WHAT to look for in the underlying documentation to confirm it's billable.
- Tone: opportunity-focused, not corrective. This is "here's revenue you may be leaving on the table" — not "here's what you did wrong."${NO_NITPICK_RULE}`,
  },
};

const LENS_TOOL = (lens: Lens) => ({
  type: "function" as const,
  function: {
    name: "lens_output",
    description: `Structured ${lens} analysis.`,
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "One-sentence summary (≤ 18 words)." },
        findings: {
          type: "array",
          description: "3–6 grounded findings.",
          items: {
            type: "object",
            properties: {
              point: { type: "string" },
              field_path: { type: ["string", "null"], description: "Optional dotted path into the claim (e.g. claim_header.denial_reason_codes)." },
              severity: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["point", "severity"],
            additionalProperties: false,
          },
        },
        recommended_actions: {
          type: "array",
          description: "0–4 concrete next actions for the reviewer.",
          items: { type: "string" },
        },
      },
      required: ["headline", "findings", "recommended_actions"],
      additionalProperties: false,
    },
  },
});

const SYNTH_TOOL = {
  type: "function" as const,
  function: {
    name: "synthesize",
    description: "Combine the five lens outputs into a unified, neutral audit posture.",
    parameters: {
      type: "object",
      properties: {
        overall_posture: {
          type: "string",
          enum: ["clean", "defensible", "needs_documentation", "high_denial_risk", "human_review_required"],
          description: "Use 'clean' when no material issues were identified across the lenses.",
        },
        confidence: { type: "number", description: "0.0–1.0" },
        headline: { type: "string", description: "One-sentence summary (≤ 22 words)." },
        agreement_points: { type: "array", items: { type: "string" } },
        tension_points: {
          type: "array",
          description: "Where lenses disagree or pull in different directions.",
          items: { type: "string" },
        },
        top_actions: { type: "array", description: "Up to 5 prioritized actions.", items: { type: "string" } },
      },
      required: ["overall_posture", "confidence", "headline", "agreement_points", "tension_points", "top_actions"],
      additionalProperties: false,
    },
  },
};

async function callGateway(messages: any[], tool: any, apiKey: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    const err: any = new Error(`AI gateway ${resp.status}: ${t}`);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No tool call returned");
  return JSON.parse(args);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const claim = body.claim;
    const fileName: string | undefined = body.fileName;
    if (!claim || typeof claim !== "object") {
      return new Response(JSON.stringify({ error: "Missing parsed claim payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const claimJson = JSON.stringify(claim);
    const userMsg = `Analyze this parsed behavioral-health claim. Stay grounded in the JSON ONLY.${
      fileName ? ` Source filename: ${fileName}.` : ""
    }\n\nPARSED_CLAIM:\n${claimJson}`;

    const lenses: Lens[] = ["builder", "red_team", "systems", "frame_breaker", "empath"];
    const dateNote = dateContext();

    // Run all 5 lenses in parallel
    const results = await Promise.allSettled(
      lenses.map((lens) =>
        callGateway(
          [
            { role: "system", content: `${LENS_PROMPTS[lens].system}\n\n${dateNote}` },
            { role: "user", content: userMsg },
          ],
          LENS_TOOL(lens),
          LOVABLE_API_KEY,
        ).then((r) => ({ lens, label: LENS_PROMPTS[lens].label, output: r }))
         .catch((e) => ({ lens, label: LENS_PROMPTS[lens].label, error: e?.message || "lens failed" })),
      ),
    );

    const perspectives: any[] = results.map((r) => r.status === "fulfilled" ? r.value : { lens: "unknown", error: "lens failed" });

    // Deterministic anti-hallucination filter:
    // Strip any finding that cites a CPT/HCPCS/ICD-10/modifier code that does not literally appear in the parsed claim.
    const allowedCodes = new Set<string>();
    const collect = (arr: any) => Array.isArray(arr) && arr.forEach((c: any) => c && allowedCodes.add(String(c).toUpperCase().trim()));
    collect(claim?.codes?.cpt_codes?.value);
    collect(claim?.codes?.hcpcs_codes?.value);
    collect(claim?.codes?.icd10_codes?.value);
    collect(claim?.codes?.modifier_codes?.value);
    if (Array.isArray(claim?.claim_line_items)) {
      for (const li of claim.claim_line_items) {
        if (li?.procedure_code) allowedCodes.add(String(li.procedure_code).toUpperCase().trim());
        if (li?.modifier) allowedCodes.add(String(li.modifier).toUpperCase().trim());
      }
    }
    // Match CPT (5 digits), HCPCS (letter+4 digits), ICD-10 (letter+2 digits with optional decimal)
    const codePattern = /\b([A-Z]\d{2}(?:\.\d{1,4})?|[A-Z]\d{4}|\d{5})\b/g;
    let strippedCount = 0;
    for (const p of perspectives) {
      if (!p?.output?.findings || !Array.isArray(p.output.findings)) continue;
      p.output.findings = p.output.findings.filter((f: any) => {
        const text = `${f?.point ?? ""} ${f?.field_path ?? ""}`.toUpperCase();
        const cited = text.match(codePattern) ?? [];
        for (const c of cited) {
          if (!allowedCodes.has(c)) {
            console.warn(`[claim-perspectives] Stripped hallucinated code "${c}" from ${p.lens} finding: ${f?.point}`);
            strippedCount++;
            return false;
          }
        }
        return true;
      });
    }
    if (strippedCount > 0) {
      console.log(`[claim-perspectives] Removed ${strippedCount} findings citing codes not present in parsed claim.`);
    }

    // Surface gateway-level errors first
    const rateLimited = results.find((r) => r.status === "rejected" && (r.reason as any)?.status === 429);
    const paymentRequired = results.find((r) => r.status === "rejected" && (r.reason as any)?.status === 402);
    if (rateLimited) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paymentRequired) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Workspace Settings." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Synthesis pass
    const synthInput = perspectives
      .filter((p: any) => p.output)
      .map((p: any) => `### ${p.label}\n${JSON.stringify(p.output, null, 2)}`)
      .join("\n\n");

    let synthesis: any = null;
    try {
      synthesis = await callGateway(
        [
          {
            role: "system",
            content:
              `You combine 5 perspective outputs into a single neutral audit posture. Stay grounded. Enterprise tone. No advocacy language.

IMPORTANT — DO NOT MANUFACTURE PROBLEMS:
- The goal is to improve on what's there, not to invent issues. If the lenses report no material findings, set overall_posture = "clean", give a short positive headline (e.g. "Claim appears correctly built — no material issues identified"), and return empty arrays for tension_points and top_actions (or only include genuinely useful next steps).
- Do not aggregate every minor lens observation into the action list. Only surface actions that meaningfully change payment, compliance, or care outcomes.
- A clean claim is a valid, expected outcome. Say so plainly when it applies.

${dateNote}`,
          },
          { role: "user", content: `Combine these lenses into a unified posture. Remember: if the claim is clean, say it's clean. Do not pad the output.\n\n${synthInput}` },
        ],
        SYNTH_TOOL,
        LOVABLE_API_KEY,
      );
    } catch (e) {
      console.error("synthesis failed", e);
    }

    return new Response(JSON.stringify({ perspectives, synthesis }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("claim-perspectives error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
