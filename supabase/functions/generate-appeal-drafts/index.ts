import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROLE_LABELS: Record<string, string> = {
  builder: "Builder (best-case clinical defense)",
  redteam: "Red Team (payer counter-arguments to neutralize)",
  analyst: "Systems Analyst (regulatory + structural grounding)",
  breaker: "Frame Breaker (unconventional angles auditor may miss)",
};

const SYSTEM_PROMPT = `You are an enterprise medical-coding appeal drafting engine for SOUPY Audit.

For a single flagged coding violation, produce:
1. A formal, neutral appeal letter draft body (provider-to-payer voice). No PHI. No advocacy slogans. Cite the specific CPT/HCPCS/ICD-10 codes and the referenced regulation/policy when available. 4–8 short paragraphs. Plain text suitable for paste into a payer portal or letter.
2. Role-specific rationales — one short paragraph per role (builder, redteam, analyst, breaker). Each must be operationally distinct and reflect that role's perspective. Do not repeat the letter body verbatim.
3. A concise list of supporting evidence the provider should attach (3–7 items, specific document names/types).
4. A "rebuttal_to_payer" paragraph anticipating the strongest payer objection and addressing it directly.
5. A confidence score 0–100 reflecting defensibility based on the supplied analyst inputs.

Tone rules: factual, concise, vendor-neutral. Never claim certainty you cannot support from the inputs. If the inputs indicate the violation is non-defensible, say so plainly in the rationale and lower the confidence — do not fabricate support.`;

const draftToolSchema = {
  type: "function",
  function: {
    name: "submit_appeal_draft",
    description: "Submit a structured appeal defense draft for one violation",
    parameters: {
      type: "object",
      properties: {
        letterBody: { type: "string", description: "Full appeal letter draft, plain text, 4-8 short paragraphs." },
        roleRationales: {
          type: "object",
          properties: {
            builder: { type: "string" },
            redteam: { type: "string" },
            analyst: { type: "string" },
            breaker: { type: "string" },
          },
          required: ["builder", "redteam", "analyst", "breaker"],
          additionalProperties: false,
        },
        supportingEvidence: { type: "array", items: { type: "string" }, minItems: 3 },
        rebuttalToPayer: { type: "string" },
        confidence: { type: "number", minimum: 0, maximum: 100 },
        keyAuthorities: { type: "array", items: { type: "string" }, description: "Citations: CMS rule, NCD/LCD, CPT guideline, etc." },
      },
      required: ["letterBody", "roleRationales", "supportingEvidence", "rebuttalToPayer", "confidence", "keyAuthorities"],
      additionalProperties: false,
    },
  },
};

async function callAI(apiKey: string, model: string, userPrompt: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [draftToolSchema],
      tool_choice: { type: "function", function: { name: "submit_appeal_draft" } },
    }),
  });
  if (!response.ok) {
    const status = response.status;
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits in Lovable Cloud → Usage." };
    const t = await response.text();
    throw new Error(`AI call failed (${status}): ${t.slice(0, 200)}`);
  }
  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No structured draft returned");
  return JSON.parse(toolCall.function.arguments);
}

function buildViolationPrompt(args: {
  caseNumber: string;
  cptCodes: string[];
  icdCodes: string[];
  claimAmount: number;
  consensusScore: number | null;
  payerCode?: string;
  violation: any;
  defensesAcrossRoles: Array<{ role: string; strategy: string; strengths: string[]; weaknesses: string[]; strength: number }>;
  evidenceSuffSummary: string;
  contradictionsSummary: string;
}) {
  const { violation, defensesAcrossRoles } = args;
  const defenseBlock = defensesAcrossRoles.map(d =>
    `- ${ROLE_LABELS[d.role] || d.role} (strength ${d.strength}%):
   strategy: ${d.strategy}
   strengths: ${(d.strengths || []).join("; ") || "—"}
   weaknesses: ${(d.weaknesses || []).join("; ") || "—"}`
  ).join("\n");

  return `CASE: ${args.caseNumber}
CPT codes on claim: ${args.cptCodes.join(", ") || "—"}
ICD-10 codes: ${args.icdCodes.join(", ") || "—"}
Claim amount: $${args.claimAmount}
Consensus score: ${args.consensusScore ?? "N/A"}
Payer: ${args.payerCode || "Unspecified"}

FLAGGED VIOLATION
- Code under challenge: ${violation.code}
- Type: ${violation.type}
- Severity: ${violation.severity}
- Description: ${violation.description}
- Cited regulation/policy: ${violation.regulationRef || "—"}

EXISTING ROLE DEFENSE INPUTS
${defenseBlock || "(none)"}

SUPPORTING ANALYST CONTEXT
- Evidence sufficiency: ${args.evidenceSuffSummary}
- Contradictions: ${args.contradictionsSummary}

Draft the appeal for THIS violation only. Do not reference other violations.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { caseId, violationIds, regenerate } = await req.json();
    if (!caseId) {
      return new Response(JSON.stringify({ error: "caseId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: auditCase, error: caseErr } = await supabase
      .from("audit_cases").select("*").eq("id", caseId).single();

    if (caseErr || !auditCase) {
      return new Response(JSON.stringify({ error: "Case not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (auditCase.owner_id && auditCase.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: analyses } = await supabase
      .from("case_analyses").select("*").eq("case_id", caseId);
    const { data: contradictions } = await supabase
      .from("contradictions").select("*").eq("case_id", caseId);
    const { data: evidenceSuff } = await supabase
      .from("evidence_sufficiency").select("*").eq("case_id", caseId).limit(1).maybeSingle();

    // Aggregate violations across roles, keyed by code+type
    const byKey = new Map<string, { violation: any; defenses: any[] }>();
    for (const a of (analyses || [])) {
      const vs = (a.violations as any[]) || [];
      for (const v of vs) {
        const key = `${v.code}|${v.type}`;
        if (!byKey.has(key)) byKey.set(key, { violation: v, defenses: [] });
        for (const d of (v.defenses || [])) {
          byKey.get(key)!.defenses.push({ role: d.role, ...d });
        }
      }
    }

    let entries = Array.from(byKey.entries());
    if (Array.isArray(violationIds) && violationIds.length) {
      entries = entries.filter(([k, v]) => violationIds.includes(v.violation.id) || violationIds.includes(k));
    }

    if (entries.length === 0) {
      return new Response(JSON.stringify({ success: true, drafts: [], message: "No flagged violations to draft" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metadata = (auditCase.metadata as any) || {};
    const existing = (metadata.appealDrafts as any) || { drafts: {}, generatedAt: null };
    const evidenceSuffSummary = evidenceSuff
      ? `score ${evidenceSuff.overall_score}/100, defensible=${evidenceSuff.is_defensible}; missing=${JSON.stringify(evidenceSuff.missing_evidence || []).slice(0, 400)}`
      : "no evidence sufficiency data";
    const contradictionsSummary = (contradictions || []).length
      ? (contradictions || []).map((c: any) => `${c.contradiction_type}:${c.description}[${c.severity}]`).join("; ").slice(0, 600)
      : "none";

    const drafts: Record<string, any> = { ...(existing.drafts || {}) };
    const errors: Array<{ key: string; error: string }> = [];

    for (const [key, { violation, defenses }] of entries) {
      if (!regenerate && drafts[key]) continue;
      try {
        const userPrompt = buildViolationPrompt({
          caseNumber: auditCase.case_number,
          cptCodes: auditCase.cpt_codes || [],
          icdCodes: auditCase.icd_codes || [],
          claimAmount: Number(auditCase.claim_amount) || 0,
          consensusScore: auditCase.consensus_score,
          payerCode: (metadata as any)?.payerCode,
          violation,
          defensesAcrossRoles: defenses,
          evidenceSuffSummary,
          contradictionsSummary,
        });
        const draft = await callAI(LOVABLE_API_KEY, "google/gemini-2.5-flash", userPrompt);
        drafts[key] = {
          violationId: violation.id || key,
          code: violation.code,
          type: violation.type,
          severity: violation.severity,
          description: violation.description,
          regulationRef: violation.regulationRef,
          ...draft,
          generatedAt: new Date().toISOString(),
        };
      } catch (e: any) {
        console.error(`Draft failed for ${key}:`, e?.message || e);
        errors.push({ key, error: e?.message || "draft failed" });
      }
    }

    const appealDrafts = {
      drafts,
      generatedAt: new Date().toISOString(),
      caseNumber: auditCase.case_number,
    };

    await supabase.from("audit_cases").update({
      metadata: { ...metadata, appealDrafts },
    }).eq("id", caseId);

    return new Response(JSON.stringify({ success: true, appealDrafts, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-appeal-drafts error:", e);
    const status = e?.status || 500;
    return new Response(JSON.stringify({ error: e?.message || "An internal error occurred." }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});