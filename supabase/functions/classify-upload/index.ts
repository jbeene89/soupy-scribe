// Classifies an uploaded file (text snippet + filename) into one of the
// SOUPY modules so the Smart Upload page can either auto-route or confirm
// the user's manual choice. Pure classifier — does not store anything.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODULES = [
  "vendor_watch",   // contracts, fee schedules, remits, EOBs, vendor invoices, payer correspondence
  "clawback",       // RAC / Cotiviti audit rosters, extrapolation notices, demand letters w/ claim lists
  "imaging",        // radiology reports, imaging orders, peer-review denials on imaging
  "cases",          // a single clinical claim / chart / denial packet to audit
  "psych",          // behavioral-health note, psych eval, therapy progress note
  "ehr",            // FHIR bundle, HL7v2, C-CDA, EHR export
  "unknown",
] as const;

const SYSTEM = `You are a router. You see the first chunk of an uploaded file plus its filename.
Decide which SOUPY module should handle it. Return STRICT JSON only.

Modules:
- vendor_watch: payer/vendor CONTRACTS, fee schedules, remittance advice (835), EOBs, vendor invoices, payer correspondence about rates or terms.
- clawback: RAC / Cotiviti / MAC AUDIT rosters, extrapolation demand letters with sampled claim lists, overpayment notices.
- imaging: radiology reports, imaging orders, peer-review denials on CT/MRI/PET, modality utilization data.
- cases: a SINGLE clinical claim or chart for adversarial audit (denial packet, op note + claim, single EOB w/ chart).
- psych: behavioral-health / psychiatry / therapy notes, psych eval, PHQ-9 / GAD-7 packets, behavioral pre-submission audit.
- ehr: FHIR Bundle / NDJSON, HL7 v2 message, C-CDA, raw EHR export of multiple resources.
- unknown: if nothing fits.

Output JSON shape (no prose, no markdown):
{
  "module": "<one of the modules above>",
  "doc_type": "<short label, e.g. 'contract', 'fee_schedule', 'remit', 'eob', 'audit_roster', 'imaging_report', 'fhir_bundle', 'psych_note', 'claim_packet'>",
  "detected_vendor_name": "<vendor/payer/contractor name if obvious, else empty string>",
  "summary": "<one sentence telling the user what this file is>",
  "confidence": <number 0-1>,
  "reasoning": "<one short sentence citing what in the file gave it away>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, filename, mimeType } = await req.json();
    const snippet = (text || "").slice(0, 8000);
    if (!snippet || snippet.trim().length < 20) {
      return Response.json({
        module: "unknown",
        doc_type: "unknown",
        detected_vendor_name: "",
        summary: "No readable text could be extracted from this file.",
        confidence: 0,
        reasoning: "Empty or unreadable extraction.",
      }, { headers: corsHeaders });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Filename: ${filename || "(none)"}\nMIME: ${mimeType || "(none)"}\n\nFirst chunk of file:\n---\n${snippet}\n---\n\nClassify it. JSON only.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gateway ${resp.status}: ${errText.slice(0, 300)}`);
    }
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const module = (MODULES as readonly string[]).includes(parsed.module) ? parsed.module : "unknown";
    return Response.json({
      module,
      doc_type: String(parsed.doc_type || "unknown"),
      detected_vendor_name: String(parsed.detected_vendor_name || ""),
      summary: String(parsed.summary || ""),
      confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0.5,
      reasoning: String(parsed.reasoning || ""),
    }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500, headers: corsHeaders });
  }
});