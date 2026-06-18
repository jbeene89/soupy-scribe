import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { extractText, getDocumentProxy } from "npm:unpdf";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const BUCKET = "patient-self-help";
const MODEL_FAST = "google/gemini-2.5-flash";
const MODEL_SYNTH = "google/gemini-2.5-pro";
const CHUNK_PAGES = 10;
const CHUNKS_PER_RUN = 2; // process at most N chunks per invocation, then self-reinvoke

type ChunkExtract = {
  events: Array<{ timestamp?: string; event: string; quote?: string; pages?: number[] }>;
  deviations: Array<{
    title: string;
    severity: "critical" | "high" | "moderate" | "low";
    plainLanguage: string;
    standardCited?: string;
    evidenceQuote?: string;
    pages?: number[];
  }>;
  notes?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(messages: any[], model = MODEL_FAST, asJson = true): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(asJson ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function safeParseJson<T>(s: string, fallback: T): T {
  try {
    const cleaned = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

async function extractPdfPages(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return Array.isArray(text) ? text : [String(text)];
}

const CHUNK_SYSTEM = `You review a chunk of a patient's medical record looking for deviations from standard of care.
You are NOT giving medical or legal advice. You are extracting facts and flagging items that appear inconsistent with widely accepted standards.
Use neutral, evidence-based language. Quote the record verbatim when possible. Never invent timestamps, names, doses, or vitals that are not in the text.
Return ONLY JSON matching this shape:
{
  "events": [{"timestamp": "ISO or as-written", "event": "what happened", "quote": "verbatim from record", "pages": [1,2]}],
  "deviations": [{
    "title": "short label",
    "severity": "critical|high|moderate|low",
    "plainLanguage": "explain to a non-clinician what looks off and why it matters",
    "standardCited": "name the standard/guideline at a high level (e.g. ACOG, AWHONN, Joint Commission, hospital P&P)",
    "evidenceQuote": "verbatim from record",
    "pages": [3]
  }],
  "notes": "anything important the next reviewer should know"
}
If nothing notable, return empty arrays.`;

const SYNTH_SYSTEM = `You are a senior patient-safety reviewer. You will receive:
- a patient/family narrative of what happened
- structured extractions from each chunk of their medical records
- transcribed photos / monitor strips

Produce four outputs, in neutral evidence-based language, suitable for a non-clinician patient to read AND to forward to a hospital risk department or attorney. Do NOT give medical or legal advice. Do NOT fabricate facts. Cite the file and page each finding comes from.

Return ONLY JSON matching this shape:
{
  "summary": "2-3 sentence plain-language summary",
  "findings": [{"title":"","severity":"critical|high|moderate|low","plainLanguage":"","standardCited":"","evidenceQuote":"","sourceFile":"","sourcePages":[1]}],
  "timeline": [{"timestamp":"","event":"","sourceFile":"","sourcePages":[1]}],
  "complaintPacket": {
    "intro": "neutral opening paragraph the patient could send to hospital patient relations / state DOH",
    "sections": [{"heading":"","body":""}],
    "requestedActions": ["what the patient is asking for"]
  },
  "attorneySummary": {
    "caseTheory": "one paragraph framing what the deviation appears to be",
    "keyDeviations": [{"title":"","whyItMatters":"","recordCitation":""}],
    "damagesNarrative": "what the patient describes happening as a result",
    "recordsCited": ["file name :: pages"]
  }
}`;

function selfReinvoke(case_id: string, access_token: string) {
  const url = `${SUPABASE_URL}/functions/v1/patient-self-help-process`;
  // Fire-and-forget. EdgeRuntime.waitUntil keeps it alive after we return.
  // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime.
  const p = fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ case_id, access_token }),
  }).catch((e) => console.error("self-reinvoke failed", e));
  try {
    // @ts-ignore
    EdgeRuntime?.waitUntil?.(p);
  } catch { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let caseIdForError: string | null = null;
  try {
    const body = await req.json();
    const { case_id, access_token } = body ?? {};
    caseIdForError = case_id ?? null;
    if (!case_id || !access_token) return jsonResponse({ error: "case_id and access_token required" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: caseRow, error: cErr } = await admin
      .from("patient_self_help_cases")
      .select("*")
      .eq("id", case_id)
      .eq("access_token", access_token)
      .maybeSingle();
    if (cErr || !caseRow) return jsonResponse({ error: "case not found" }, 404);

    if (caseRow.status === "complete") return jsonResponse({ ok: true, status: "complete" });

    const setStatus = (status: string, progress_message: string, extra: Record<string, unknown> = {}) =>
      admin
        .from("patient_self_help_cases")
        .update({ status, progress_message, ...extra })
        .eq("id", case_id);

    const { data: filesRaw } = await admin
      .from("patient_self_help_files")
      .select("*")
      .eq("case_id", case_id)
      .order("created_at", { ascending: true });
    const files = filesRaw ?? [];

    let workDone = 0;
    let moreWork = false;

    for (const f of files) {
      if (workDone >= CHUNKS_PER_RUN) { moreWork = true; break; }
      if (f.file_status === "done" || f.file_status === "error") continue;

      const type = (f.file_type || "").toLowerCase();
      const isPdf = type.includes("pdf") || (f.file_name || "").toLowerCase().endsWith(".pdf");
      const isImage = type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(f.file_name || "");

      try {
        if (isPdf) {
          // Ensure pages cached
          let pages: string[] | null = null;
          if (!f.chunks_total || f.chunks_total === 0) {
            await setStatus("processing", `Reading PDF: ${f.file_name}`);
            const { data: dl, error: dlErr } = await admin.storage.from(BUCKET).download(f.storage_path);
            if (dlErr || !dl) throw new Error(`download failed: ${dlErr?.message ?? "unknown"}`);
            const buf = new Uint8Array(await dl.arrayBuffer());
            pages = await extractPdfPages(buf);
            const total = Math.max(1, Math.ceil(pages.length / CHUNK_PAGES));
            await admin
              .from("patient_self_help_files")
              .update({
                page_count: pages.length,
                chunks_total: total,
                file_status: "processing",
                extracted_text: pages.join("\n\n--- PAGE BREAK ---\n\n").slice(0, 400000),
              })
              .eq("id", f.id);
            f.chunks_total = total;
            f.page_count = pages.length;
          } else {
            // Reconstruct pages from cached extracted_text
            const cached = (f.extracted_text || "") as string;
            pages = cached.split("\n\n--- PAGE BREAK ---\n\n");
            if (pages.length < (f.page_count || pages.length)) {
              // cache truncated; redownload
              const { data: dl } = await admin.storage.from(BUCKET).download(f.storage_path);
              if (dl) {
                const buf = new Uint8Array(await dl.arrayBuffer());
                pages = await extractPdfPages(buf);
              }
            }
          }

          // Process next batch of chunks for this file
          while (workDone < CHUNKS_PER_RUN && f.chunks_done < f.chunks_total) {
            const idx = f.chunks_done;
            const startPage = idx * CHUNK_PAGES + 1;
            const endPage = Math.min((idx + 1) * CHUNK_PAGES, f.page_count || pages.length);
            await setStatus("processing", `Analyzing ${f.file_name} pages ${startPage}-${endPage}`);

            const slice = (pages || []).slice(startPage - 1, endPage);
            const userText =
              `FILE: ${f.file_name}\nPAGES: ${startPage}-${endPage}\n\n` +
              slice
                .map((t, i) => `=== PAGE ${startPage + i} ===\n${(t || "").slice(0, 8000)}`)
                .join("\n\n");

            const content = await callAI(
              [
                { role: "system", content: CHUNK_SYSTEM },
                { role: "user", content: userText },
              ],
              MODEL_FAST,
              true,
            );
            const parsed = safeParseJson<ChunkExtract>(content, { events: [], deviations: [] });

            const newResults = [
              ...(Array.isArray(f.chunk_results) ? f.chunk_results : []),
              { chunkLabel: `pages ${startPage}-${endPage}`, extract: parsed },
            ];
            const newDone = idx + 1;
            await admin
              .from("patient_self_help_files")
              .update({
                chunk_results: newResults,
                chunks_done: newDone,
                file_status: newDone >= f.chunks_total ? "done" : "processing",
              })
              .eq("id", f.id);
            f.chunk_results = newResults;
            f.chunks_done = newDone;
            workDone += 1;
          }

          if (f.chunks_done < f.chunks_total) {
            moreWork = true;
            break;
          }
        } else if (isImage) {
          await setStatus("processing", `Reading photo: ${f.file_name}`);
          const { data: dl, error: dlErr } = await admin.storage.from(BUCKET).download(f.storage_path);
          if (dlErr || !dl) throw new Error(`download failed: ${dlErr?.message ?? "unknown"}`);
          const buf = new Uint8Array(await dl.arrayBuffer());
          let binary = "";
          for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
          const b64 = btoa(binary);
          const mime = type.startsWith("image/") ? type : "image/jpeg";
          const dataUrl = `data:${mime};base64,${b64}`;

          const content = await callAI(
            [
              { role: "system", content: CHUNK_SYSTEM + "\n\nThis input is a photograph of a paper medical record, monitor strip, or sign-in sheet. Transcribe everything you can read and then flag anything that appears off." },
              {
                role: "user",
                content: [
                  { type: "text", text: `FILE: ${f.file_name}\n\nTranscribe verbatim, then return JSON.` },
                  { type: "image_url", image_url: { url: dataUrl } },
                ],
              },
            ],
            MODEL_FAST,
            true,
          );
          const parsed = safeParseJson<ChunkExtract>(content, { events: [], deviations: [] });
          await admin
            .from("patient_self_help_files")
            .update({
              chunk_results: [{ chunkLabel: "image", extract: parsed }],
              chunks_done: 1,
              chunks_total: 1,
              file_status: "done",
              ocr_text: parsed.notes || "",
            })
            .eq("id", f.id);
          workDone += 1;
        } else {
          await setStatus("processing", `Reading text: ${f.file_name}`);
          const { data: dl, error: dlErr } = await admin.storage.from(BUCKET).download(f.storage_path);
          if (dlErr || !dl) throw new Error(`download failed: ${dlErr?.message ?? "unknown"}`);
          const buf = new Uint8Array(await dl.arrayBuffer());
          const text = new TextDecoder().decode(buf).slice(0, 60000);
          const content = await callAI(
            [
              { role: "system", content: CHUNK_SYSTEM },
              { role: "user", content: `FILE: ${f.file_name}\n\n${text}` },
            ],
            MODEL_FAST,
            true,
          );
          const parsed = safeParseJson<ChunkExtract>(content, { events: [], deviations: [] });
          await admin
            .from("patient_self_help_files")
            .update({
              chunk_results: [{ chunkLabel: "text", extract: parsed }],
              chunks_done: 1,
              chunks_total: 1,
              file_status: "done",
              extracted_text: text,
            })
            .eq("id", f.id);
          workDone += 1;
        }
      } catch (e) {
        console.error("file processing failed", f.file_name, e);
        await admin
          .from("patient_self_help_files")
          .update({
            file_status: "error",
            chunk_results: [
              ...(Array.isArray(f.chunk_results) ? f.chunk_results : []),
              { chunkLabel: "error", extract: { events: [], deviations: [], notes: `Could not process: ${e instanceof Error ? e.message : String(e)}` } },
            ],
          })
          .eq("id", f.id);
      }
    }

    // If any file still not done, schedule next run
    const { data: remaining } = await admin
      .from("patient_self_help_files")
      .select("id, file_status")
      .eq("case_id", case_id)
      .not("file_status", "in", "(done,error)");
    if ((remaining ?? []).length > 0 || moreWork) {
      await setStatus("processing", caseRow.progress_message || "Continuing review");
      selfReinvoke(case_id, access_token);
      return jsonResponse({ ok: true, more: true });
    }

    // All files done -> synthesize
    await setStatus("synthesizing", "Combining findings into your report");

    const { data: finalFiles } = await admin
      .from("patient_self_help_files")
      .select("file_name, chunk_results")
      .eq("case_id", case_id);

    const allExtracts: Array<{ file: string; chunkLabel: string; extract: unknown }> = [];
    for (const ff of finalFiles ?? []) {
      const arr = Array.isArray(ff.chunk_results) ? ff.chunk_results : [];
      for (const c of arr) {
        allExtracts.push({ file: ff.file_name, chunkLabel: (c as any).chunkLabel, extract: (c as any).extract });
      }
    }

    const synthUser = JSON.stringify({
      case_title: caseRow.case_title,
      scope: caseRow.scope,
      narrative: caseRow.narrative,
      extracts: allExtracts,
    }).slice(0, 600000);

    let synthRaw = "";
    try {
      synthRaw = await callAI(
        [
          { role: "system", content: SYNTH_SYSTEM },
          { role: "user", content: synthUser },
        ],
        MODEL_SYNTH,
        true,
      );
    } catch (e) {
      console.warn("synth pro failed, retrying with flash", e);
      synthRaw = await callAI(
        [
          { role: "system", content: SYNTH_SYSTEM },
          { role: "user", content: synthUser },
        ],
        MODEL_FAST,
        true,
      );
    }

    const results = safeParseJson<Record<string, unknown>>(synthRaw, {
      summary: "Report could not be generated.",
      findings: [],
      timeline: [],
      complaintPacket: { intro: "", sections: [], requestedActions: [] },
      attorneySummary: { caseTheory: "", keyDeviations: [], damagesNarrative: "", recordsCited: [] },
    });

    await admin
      .from("patient_self_help_cases")
      .update({
        status: "complete",
        progress_message: "Review complete",
        results: { ...results, generatedAt: new Date().toISOString(), chunkCount: allExtracts.length },
      })
      .eq("id", case_id);

    return jsonResponse({ ok: true, status: "complete" });
  } catch (e) {
    console.error("processor error", e);
    if (caseIdForError) {
      try {
        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await admin
          .from("patient_self_help_cases")
          .update({ status: "error", error: e instanceof Error ? e.message : String(e), progress_message: "Failed" })
          .eq("id", caseIdForError);
      } catch { /* ignore */ }
    }
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
