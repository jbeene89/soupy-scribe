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

type Lens = "builder" | "red_team" | "systems" | "frame_breaker" | "empath";

function dateContext(): string {
  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);
  const humanDate = today.toUTCString().slice(0, 16);
  return `CONTEXT: Today's date is ${humanDate} (${isoDate}). Do NOT flag current-year dates as "future-dated" unless they are strictly after ${isoDate}.`;
}

const LENS_PROMPTS: Record<Lens, { label: string; system: string }> = {
  builder: {
    label: "Builder — what's defensible",
    system: `You are the BUILDER lens for a behavioral-health claim audit.
Job: identify what is documented well, what supports payment, what makes this claim defensible.
Stay strictly grounded in the parsed claim JSON. Do NOT invent facts.
Be concise, neutral, enterprise tone. No sales language.`,
  },
  red_team: {
    label: "Red Team — denial vulnerabilities",
    system: `You are the RED TEAM lens for a behavioral-health claim audit.
Job: identify exactly how a payer (UHC/Optum/BCBS/Medicaid) could deny or downcode this claim.
Cite the specific field path and what is missing or risky. Stay grounded in the JSON only.
Concise, neutral, enterprise tone.`,
  },
  systems: {
    label: "Systems — process & workflow gaps",
    system: `You are the SYSTEMS lens for a behavioral-health claim audit.
Job: identify upstream process gaps (intake, auth, scheduling, EHR template, supervision, credentialing)
that this claim's data points to. Stay grounded in the parsed claim. Concise, enterprise tone.`,
  },
  frame_breaker: {
    label: "Frame Breaker — what we may be missing",
    system: `You are the FRAME BREAKER lens for a behavioral-health claim audit.
Job: surface assumptions the parsing pipeline or reviewer may have made,
non-obvious interpretations of the data, and questions a reviewer should ask before accepting the audit.
Stay grounded. Concise, enterprise tone.`,
  },
  empath: {
    label: "Empath — patient & clinician impact",
    system: `You are the EMPATH lens for a behavioral-health claim audit.
Job: name the patient-experience and clinician-burden implications of this claim's denial risk
(e.g. delayed access, abandonment risk, clinician documentation burden).
Stay grounded in the JSON. Concise, neutral, no melodrama.`,
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
          enum: ["defensible", "needs_documentation", "high_denial_risk", "human_review_required"],
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

    const perspectives = results.map((r) => r.status === "fulfilled" ? r.value : { lens: "unknown", error: "lens failed" });

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
              `You combine 5 perspective outputs into a single neutral audit posture. Stay grounded. Enterprise tone. No advocacy language.\n\n${dateNote}`,
          },
          { role: "user", content: `Combine these lenses into a unified posture:\n\n${synthInput}` },
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
