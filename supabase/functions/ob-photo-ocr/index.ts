// OB Photo OCR — transcribes paper L&D chart photos (printed vitals strips,
// nursing sign-in sheets, MAR pages, paper flowsheets) into structured
// VitalsReading[] and CareEvent[] arrays that the L&D Fetal Audit can ingest.
// Uses the Lovable AI Gateway with a multimodal model + tool-calling.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  const { data, error } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

const SYSTEM_PROMPT = `You are a clinical-records OCR assistant for an L&D audit tool.
You receive ONE photo of a labor-and-delivery paper chart artifact — usually one of:
  • a printed bedside-monitor strip column showing timestamped vitals (NIBP, MSpO2, pulse)
  • a paper nursing flowsheet or MAR page
  • a "Birthing Room" sign-in / visitation log with name + date + time + notes
  • a handwritten note or order page

Your only job is to TRANSCRIBE what is visibly printed or written on this page into
structured rows. Do NOT diagnose, do NOT interpret, do NOT invent values. If a number
is illegible, omit that field rather than guessing. Times on monitor strips are usually
24-hour HH:MM. Sign-in sheet times may be 24-hour (e.g. 23:35) or 4-digit (0420 = 04:20).

If the photo is not legible at all, return empty arrays — do not fabricate rows.`;

const tool = {
  type: "function",
  function: {
    name: "transcribe_chart_photo",
    description: "Return structured vitals + care events extracted from a single L&D chart photo.",
    parameters: {
      type: "object",
      properties: {
        artifact_type: {
          type: "string",
          enum: ["vitals_strip", "flowsheet", "mar", "sign_in_log", "note", "other"],
          description: "What kind of paper artifact this photo shows.",
        },
        date_seen: {
          type: "string",
          description: "Any explicit date visible on the page in YYYY-MM-DD form, or empty string if none.",
        },
        vitals: {
          type: "array",
          description: "Timestamped maternal vitals rows visible on the page.",
          items: {
            type: "object",
            properties: {
              time: { type: "string", description: "24h HH:MM or MM-DD HH:MM as printed." },
              sbp: { type: "integer", minimum: 30, maximum: 260 },
              dbp: { type: "integer", minimum: 20, maximum: 180 },
              map: { type: "integer", minimum: 30, maximum: 200 },
              hr: { type: "integer", minimum: 20, maximum: 220 },
              spo2: { type: "integer", minimum: 50, maximum: 100 },
              tempF: { type: "number" },
              verbatim: { type: "string", description: "The full row as printed/written." },
            },
            required: ["time", "verbatim"],
            additionalProperties: false,
          },
        },
        care_events: {
          type: "array",
          description: "Care/staffing events with a timestamp — e.g. nurse entered room, provider notified, exam, consent, sign-in entry.",
          items: {
            type: "object",
            properties: {
              time: { type: "string", description: "24h HH:MM, MM-DD HH:MM, or YYYY-MM-DD HH:MM as printed." },
              date: { type: "string", description: "YYYY-MM-DD or MM-DD-YY as printed if a date is on the row." },
              kind: {
                type: "string",
                enum: [
                  "vitals_check","rn_at_bedside","provider_notified","cervical_exam",
                  "membrane_sweep","arom","cervidil_placed","cervidil_removed","epidural",
                  "consent_obtained","provider_order","iv_bolus","position_change",
                  "oxygen","reassessment","sign_in_entry","other",
                ],
              },
              staff: { type: "string", description: "Name / initials of staff, if visible." },
              description: { type: "string", description: "Verbatim line from the page." },
            },
            required: ["time", "kind", "description"],
            additionalProperties: false,
          },
        },
        notes: { type: "string", description: "Anything notable about legibility / partial rows / missing data." },
      },
      required: ["artifact_type", "vitals", "care_events"],
      additionalProperties: false,
    },
  },
} as const;

function toIso(time: string, anchorDate?: string, rowDate?: string): string | null {
  if (!time) return null;
  const v = time.trim();
  // Already a full timestamp
  const direct = new Date(v);
  if (!isNaN(direct.getTime()) && /\d{4}-\d{2}-\d{2}/.test(v)) return direct.toISOString();

  // Resolve date portion
  let datePart = '';
  if (rowDate) {
    const d = new Date(rowDate);
    if (!isNaN(d.getTime())) datePart = d.toISOString().slice(0, 10);
    else {
      // try MM-DD-YY or M-D-YY
      const m = rowDate.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
      if (m) {
        const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
        datePart = `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      }
    }
  }
  if (!datePart && anchorDate) datePart = anchorDate.slice(0, 10);
  if (!datePart) datePart = new Date().toISOString().slice(0, 10);

  // Parse time portion (HH:MM, HHMM, HH:MM:SS)
  let timePart = '';
  const hm = v.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (hm) {
    timePart = `${hm[1].padStart(2, '0')}:${hm[2]}:${hm[3] || '00'}`;
  } else {
    const four = v.match(/^(\d{2})(\d{2})$/);
    if (four) timePart = `${four[1]}:${four[2]}:00`;
  }
  if (!timePart) return null;

  const iso = new Date(`${datePart}T${timePart}`);
  if (isNaN(iso.getTime())) return null;
  return iso.toISOString();
}

async function ocrOne(apiKey: string, dataUrl: string): Promise<any> {
  const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe every legible row on this page. Return ONLY structured data via the tool call." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "transcribe_chart_photo" } },
    }),
  });

  if (!aiResp.ok) {
    const t = await aiResp.text();
    throw new Error(`AI gateway ${aiResp.status}: ${t.slice(0, 200)}`);
  }
  const aiJson = await aiResp.json();
  const call = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Error("AI returned no structured transcription");
  return JSON.parse(call.function.arguments);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResp = await requireAuth(req);
  if (authResp) return authResp;

  try {
    const body = await req.json();
    const images = body?.images;
    const anchorDate: string | undefined = body?.anchorDate;
    if (!Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "images[] required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const vitalsOut: any[] = [];
    const careOut: any[] = [];
    const perImage: any[] = [];
    const warnings: string[] = [];

    for (const im of images) {
      try {
        const result = await ocrOne(apiKey, im.dataUrl);
        const rowDate = result.date_seen || undefined;
        for (const v of result.vitals || []) {
          const iso = toIso(v.time, anchorDate, rowDate);
          if (!iso) { warnings.push(`${im.filename}: unparseable vitals time "${v.time}"`); continue; }
          vitalsOut.push({
            t: iso,
            sbp: v.sbp, dbp: v.dbp, hr: v.hr, spo2: v.spo2, tempF: v.tempF,
            evidence: v.verbatim || `${v.time} BP ${v.sbp}/${v.dbp} HR ${v.hr} SpO2 ${v.spo2}`,
          });
        }
        for (const c of result.care_events || []) {
          const iso = toIso(c.time, anchorDate, c.date || rowDate);
          if (!iso) { warnings.push(`${im.filename}: unparseable care time "${c.time}"`); continue; }
          careOut.push({
            t: iso,
            kind: c.kind,
            description: c.description,
            staff: c.staff || undefined,
            evidence: c.description,
          });
        }
        perImage.push({ filename: im.filename, artifact_type: result.artifact_type, vitalsCount: (result.vitals || []).length, careCount: (result.care_events || []).length, notes: result.notes || '' });
      } catch (e) {
        warnings.push(`${im.filename}: ${(e as Error).message}`);
        perImage.push({ filename: im.filename, error: (e as Error).message });
      }
    }

    // de-dup identical (t, evidence) rows in case the user uploads overlapping pages
    const dedup = <T extends { t: string; evidence?: string; description?: string }>(arr: T[]) => {
      const seen = new Set<string>();
      return arr.filter((r) => {
        const k = `${r.t}|${r.evidence || r.description || ''}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    };

    return new Response(JSON.stringify({
      vitalsReadings: dedup(vitalsOut).sort((a, b) => a.t.localeCompare(b.t)),
      careEvents: dedup(careOut).sort((a, b) => a.t.localeCompare(b.t)),
      perImage,
      warnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ob-photo-ocr error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});