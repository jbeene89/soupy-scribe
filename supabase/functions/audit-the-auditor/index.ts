import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a payer-conduct auditor. You read denial letters, EOBs, and adverse determinations issued by health insurers and evaluate them against:

1) The payer's own published medical policy (when cited or inferable from the letter).
2) Standard CMS/NCD/LCD coverage rules where the payer references them.
3) Generally applicable state prompt-pay law (clean-claim clocks, interest accrual, written-determination requirements).
4) ERISA / ACA full-and-fair-review obligations for self-funded and marketplace plans.
5) Plain-language adequacy: does the letter actually explain WHY in a way a clinician could rebut?

You are NOT advocating. You are auditing. Be neutral, cite specific defects, and assign each defect a severity (low / medium / high / regulatory).

For each denial letter you receive, return a structured audit with:
- Self-contradictions inside the letter
- Misapplications of the payer's own cited policy
- Missing required elements (clinical rationale specificity, reviewer credentials, appeal-rights disclosure, deadline disclosure, peer-to-peer offer where applicable)
- Likely state prompt-pay or ERISA exposure (if signals exist)
- A neutral "regulatory complaint draft" the provider could file with their state Department of Insurance — only if defects warrant it
- An overturn-likelihood estimate with reasoning, NOT a guarantee.

Be specific. Quote the letter. Do not invent text that is not present.`;

const TOOL = {
  type: "function",
  function: {
    name: "submit_payer_audit",
    description: "Submit a structured audit of a payer denial letter",
    parameters: {
      type: "object",
      properties: {
        denialSummary: { type: "string", description: "1-2 sentence neutral summary of what the payer denied and why they say so" },
        payerNamed: { type: "string", description: "Payer name as it appears in the letter, or 'Unknown'" },
        policyCited: { type: "string", description: "Policy / bulletin / NCD-LCD number cited by the payer, or 'None cited'" },
        defects: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["self-contradiction", "policy-misapplication", "missing-clinical-rationale", "missing-reviewer-credentials", "missing-appeal-rights", "missing-deadline-disclosure", "missing-peer-to-peer-offer", "prompt-pay-violation", "erisa-full-fair-review", "vague-boilerplate", "factual-error"] },
              severity: { type: "string", enum: ["low", "medium", "high", "regulatory"] },
              quote: { type: "string", description: "Direct quote from the letter that establishes the defect, or 'Not present in letter' if the defect is an omission" },
              explanation: { type: "string" },
            },
            required: ["category", "severity", "quote", "explanation"],
          },
        },
        promptPayRisk: {
          type: "object",
          properties: {
            triggered: { type: "boolean" },
            reasoning: { type: "string" },
            stateLawHook: { type: "string", description: "Generic description of the prompt-pay rule that may apply (e.g. 'most states require written determination on clean claims within 30-45 days'). Do not cite a specific statute unless the letter itself names the state." },
          },
          required: ["triggered", "reasoning"],
        },
        erisaRisk: {
          type: "object",
          properties: {
            triggered: { type: "boolean" },
            reasoning: { type: "string" },
          },
          required: ["triggered", "reasoning"],
        },
        overturnLikelihood: {
          type: "object",
          properties: {
            estimate: { type: "string", enum: ["low", "moderate", "elevated", "high"] },
            confidence: { type: "number", minimum: 0, maximum: 100 },
            reasoning: { type: "string" },
          },
          required: ["estimate", "confidence", "reasoning"],
        },
        regulatoryComplaintDraft: {
          type: "object",
          properties: {
            warranted: { type: "boolean" },
            draft: { type: "string", description: "A neutral, factual draft suitable for filing with a state Department of Insurance. Empty string if not warranted." },
          },
          required: ["warranted", "draft"],
        },
        overallScore: { type: "number", minimum: 0, maximum: 100, description: "Letter quality score: 100 = fully compliant and well-reasoned, 0 = severely defective" },
      },
      required: ["denialSummary", "payerNamed", "policyCited", "defects", "promptPayRisk", "erisaRisk", "overturnLikelihood", "regulatoryComplaintDraft", "overallScore"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { letterText, additionalContext } = await req.json();
    if (!letterText || typeof letterText !== "string" || letterText.length < 50) {
      return new Response(JSON.stringify({ error: "letterText is required and must be at least 50 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `DENIAL LETTER / EOB TEXT:\n\n${letterText.slice(0, 40000)}\n\n${additionalContext ? `ADDITIONAL CONTEXT FROM PROVIDER:\n${additionalContext.slice(0, 4000)}\n\n` : ""}Audit this payer communication. Be neutral and specific.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "submit_payer_audit" } },
      }),
    });

    if (!resp.ok) {
      const status = resp.status;
      const body = await resp.text();
      const msg = status === 429 ? "Rate limit exceeded. Try again in a moment."
        : status === 402 ? "AI credits exhausted. Add credits in Settings."
        : `AI call failed: ${status} ${body.slice(0, 200)}`;
      return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured result returned");
    const audit = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, audit }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("audit-the-auditor error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});