import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { extractText, getDocumentProxy } from "npm:unpdf";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const BUCKET = "patient-self-help";
const MODEL_FAST = "google/gemini-2.5-flash";
const MODEL_CLASSIFY = "google/gemini-2.5-flash-lite";
const MODEL_SYNTH = "google/gemini-2.5-pro";
const CHUNK_PAGES = 10;
const CHUNKS_PER_RUN = 2; // process at most N chunks per invocation, then self-reinvoke

const DOC_TYPES = [
  "clinical_record",
  "bill_eob",
  "lab_report",
  "imaging_report",
  "discharge_instructions",
  "consent_packet",
  "portal_message",
  "insurance_denial",
  "unknown",
] as const;
type DocType = typeof DOC_TYPES[number];

const BILLING_DOC_TYPES: DocType[] = ["bill_eob", "insurance_denial"];
const CLINICAL_DOC_TYPES: DocType[] = ["clinical_record", "lab_report", "imaging_report", "discharge_instructions"];
const CONSENT_DOC_TYPES: DocType[] = ["consent_packet", "clinical_record"];

type ChunkExtract = {
  events: Array<{ timestamp?: string; event: string; quote?: string; pages?: number[] }>;
  observations: Array<{
    bucketHint?: string;
    title: string;
    whatRecordShows: string;
    evidenceQuote?: string;
    pages?: number[];
    relatedWorry?: string;
  }>;
  notes?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callAI(messages: any[], model: string = MODEL_FAST, asJson = true): Promise<string> {
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

const CLASSIFY_SYSTEM = `You classify a single patient-uploaded document into ONE of these types based on the first pages of text and the file name:
clinical_record, bill_eob, lab_report, imaging_report, discharge_instructions, consent_packet, portal_message, insurance_denial, unknown.

Rules:
- "bill_eob" = itemized bill, EOB, UB-04, CMS-1500, 837, charge detail, line-item charges with CPT/HCPCS/revenue codes.
- "clinical_record" = chart release, EMR export, nursing/physician notes, MAR, orders, H&P, discharge summary.
- "consent_packet" = signed consent forms only, no clinical narrative.
- If mixed, choose the dominant type and list "mixed_signals" in signals.
- Do NOT guess "clinical_record" just because medical words appear; check for chart structure (timestamps, providers, sections like Assessment/Plan).

Return ONLY JSON:
{ "doc_type": "...", "confidence": 0-1, "signals": ["short reasons"], "mixed_signals": ["other types observed"] }`;

function buildChunkSystem(args: {
  worries: string[];
  recollection: Record<string, unknown>;
  docType: DocType;
  modes: { clinical: boolean; billing: boolean; consent: boolean };
}) {
  const { worries, recollection, docType, modes } = args;
  const focusList = worries.length ? worries.join(", ") : "(none specified — extract anything notable)";
  const recallText = Object.entries(recollection)
    .filter(([, v]) => typeof v === "string" && (v as string).trim())
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `You review a chunk of a patient-uploaded document. You are doing RECORDS RECONCILIATION, not medical or legal judgment. You never say "malpractice", "wrong care", or "below standard". You extract what the document shows and flag what does not reconcile.

Document type for this file: ${docType}
Analysis modes enabled for this case: clinical=${modes.clinical}, billing=${modes.billing}, consent=${modes.consent}
Patient's worries: ${focusList}
${recallText ? `What the patient remembers:\n${recallText}` : ""}

Hard rules:
- Quote the record verbatim. Never invent times, doses, names, vitals, or signatures.
- If a value or event is not visible in this chunk, say it is not visible here. Do NOT infer it.
- If billing is NOT enabled, ignore charge/EOB content entirely.
- If clinical is NOT enabled, do not extract clinical narrative beyond what is plainly on the page.
- Tag each observation with a bucketHint from this exact list when applicable:
  "Looks Routine" | "Needs Clarification" | "Record Mismatch" | "Consent / Patient-Rights Flag" | "Missing Source Document"
- Tag relatedWorry with one of the patient's worry codes if the observation maps to it; otherwise omit.

Return ONLY JSON:
{
  "events": [{"timestamp": "ISO or as-written", "event": "what happened in record terms", "quote": "verbatim", "pages": [1]}],
  "observations": [{
    "bucketHint": "Needs Clarification",
    "title": "short label",
    "whatRecordShows": "what the document plainly states in this chunk",
    "evidenceQuote": "verbatim",
    "pages": [3],
    "relatedWorry": "med_before_consent"
  }],
  "notes": "anything important for the synthesizer"
}
If nothing notable, return empty arrays.`;
}

function buildSynthSystem(args: {
  worries: string[];
  modes: { clinical: boolean; billing: boolean; consent: boolean };
  disabledReason: string;
  docTypeCounts: Record<string, number>;
}) {
  const { worries, modes, disabledReason, docTypeCounts } = args;
  const docMix = Object.entries(docTypeCounts).map(([k, v]) => `${k}=${v}`).join(", ");
  return `You are a records-reconciliation reviewer for a NON-CLINICIAN PATIENT. Your job is NOT to decide if care was wrong. Your job is to tell the patient what their record says, what it does not show, what does not reconcile, and what to ask for next.

Forbidden phrases and behavior:
- Never say "malpractice", "negligence", "below the standard of care", "wrong care", "lawsuit", or "you have a case".
- Never recommend medical action.
- Never assert a billing problem unless billing=true. Never assert a clinical problem unless clinical=true.
- Never invent facts not present in the extracts.

Case context:
- Patient worries: ${worries.join(", ") || "(none specified)"}
- Analysis modes enabled: clinical=${modes.clinical}, billing=${modes.billing}, consent=${modes.consent}
- Documents reviewed: ${docMix || "(none)"}
- Modes disabled because: ${disabledReason || "(nothing disabled)"}

Produce a structured patient-facing report. Every finding card MUST have a bucket from this exact list:
"Looks Routine" | "Needs Clarification" | "Record Mismatch" | "Consent / Patient-Rights Flag" | "Missing Source Document" | "Ask For This Next"

Every card MUST include a non-empty whatItDoesNotProve sentence — this is the trust mechanic. If a card has nothing to disclaim, write what additional evidence would be needed to confirm or rule out.

Every "Missing Source Document" card MUST also produce a matching "Ask For This Next" card with copy-paste-ready request language.

Return ONLY JSON matching this exact shape:
{
  "summary": "one-sentence plain-language headline",
  "structuredSummary": {
    "supports": "what the record DOES support, plain language",
    "contains": ["key clinical/admin language actually found in record"],
    "doesNotInclude": ["important documents or data not present in this export"],
    "disabledModes": ["short reasons the disabled analysis modes were skipped"],
    "headlineAsks": ["top 3-5 records to request, copy-paste ready"]
  },
  "cards": [{
    "bucket": "Record Mismatch",
    "title": "short label",
    "whyItMatters": "one or two sentences for a non-clinician",
    "whatRecordShows": "concrete record contents with timestamps where present",
    "whatItDoesNotProve": "required — what this finding does NOT prove without more evidence",
    "askNext": "exact records or details to request next, written so the patient can copy-paste",
    "severity": "high-documentation-issue|moderate|low|informational",
    "sourceFile": "filename",
    "sourcePages": [1]
  }],
  "timeline": [{"timestamp":"","event":"","sourceFile":"","sourcePages":[1]}],
  "complaintPacket": {
    "intro": "neutral opening paragraph the patient could send to hospital patient relations",
    "sections": [{"heading":"","body":""}],
    "requestedActions": ["what the patient is asking for"]
  },
  "attorneySummary": {
    "caseTheory": "neutral framing of what the record does and does not show",
    "keyDeviations": [{"title":"","whyItMatters":"","recordCitation":""}],
    "damagesNarrative": "what the patient describes happening, in their own words",
    "recordsCited": ["file name :: pages"]
  }
}`;
}

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

async function getClassificationSample(admin: any, f: any): Promise<string> {
  // Use cached extracted_text first if present.
  const cached = typeof f.extracted_text === "string" ? f.extracted_text : "";
  if (cached) return cached.slice(0, 3000);

  const type = (f.file_type || "").toLowerCase();
  const name = (f.file_name || "").toLowerCase();
  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
  const isImage = type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(name);

  try {
    const { data: dl } = await admin.storage.from(BUCKET).download(f.storage_path);
    if (!dl) return "";
    const buf = new Uint8Array(await dl.arrayBuffer());
    if (isPdf) {
      const pages = await extractPdfPages(buf);
      return pages.slice(0, 2).join("\n\n").slice(0, 3000);
    }
    if (isImage) {
      // Skip image classification text extraction; rely on filename + extension.
      return `(image file; will be transcribed at extraction time)`;
    }
    return new TextDecoder().decode(buf).slice(0, 3000);
  } catch (e) {
    console.warn("classify sample failed", f.file_name, e);
    return "";
  }
}

// Billing-specific tokens. Use word boundaries so "discharge", "in charge of",
// "chart", etc. do NOT trip the filter. "Ask For This Next" cards are exempt
// because they may legitimately reference billing artifacts the patient should
// request even when no bill was uploaded.
const BILLING_TOKENS = [
  /\beob\b/i,
  /\bub-?04\b/i,
  /\bcms-?1500\b/i,
  /\b837\b/i,
  /\bitemized bill\b/i,
  /\bcopay\b/i,
  /\bdeductible\b/i,
  /\binsurance claim\b/i,
  /\bbilling code\b/i,
  /\bbilled amount\b/i,
  /\$\s?\d/,
];

function looksLikeBillingFinding(c: any): boolean {
  if (!c) return false;
  if (c.bucket === "Ask For This Next") return false;
  const blob = `${c.title || ""} ${c.whyItMatters || ""} ${c.whatRecordShows || ""}`;
  return BILLING_TOKENS.some((rx) => rx.test(blob));
}

function isValidCard(c: any, modes: { billing: boolean }): boolean {
  if (!c || typeof c !== "object") return false;
  if (typeof c.bucket !== "string" || !c.bucket) return false;
  if (typeof c.title !== "string" || !c.title.trim()) return false;
  if (typeof c.whatItDoesNotProve !== "string" || !c.whatItDoesNotProve.trim()) return false;
  if (typeof c.askNext !== "string" || !c.askNext.trim()) return false;
  if (!modes.billing && looksLikeBillingFinding(c)) return false;
  return true;
}

function validateCards(cards: any[], modes: { billing: boolean }): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!Array.isArray(cards)) return { ok: false, reasons: ["cards is not an array"] };
  let missingDisclaimer = 0;
  let missingAsk = 0;
  let billingLeak = 0;
  let missingDocsWithoutAsk = 0;
  const askTitles = new Set(
    cards.filter((c) => c?.bucket === "Ask For This Next").map((c) => (c.title || "").toLowerCase())
  );
  for (const c of cards) {
    if (!c?.whatItDoesNotProve || !String(c.whatItDoesNotProve).trim()) missingDisclaimer += 1;
    if (!c?.askNext || !String(c.askNext).trim()) missingAsk += 1;
    if (!modes.billing && looksLikeBillingFinding(c)) billingLeak += 1;
    if (c?.bucket === "Missing Source Document") {
      const t = (c.title || "").toLowerCase();
      if (!askTitles.has(t) && !Array.from(askTitles).some((x) => x.includes(t.slice(0, 16)))) {
        missingDocsWithoutAsk += 1;
      }
    }
  }
  if (missingDisclaimer) reasons.push(`${missingDisclaimer} card(s) missing whatItDoesNotProve`);
  if (missingAsk) reasons.push(`${missingAsk} card(s) missing askNext`);
  if (billingLeak) reasons.push(`${billingLeak} card(s) contain billing content when billing mode is disabled`);
  // Note: missingDocsWithoutAsk is intentionally NOT included as a hard
  // validation failure — title-matching is too brittle and was silently
  // dropping legitimate cards. The synth prompt still asks for pairing.
  return { ok: reasons.length === 0, reasons };
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

    const worries: string[] = Array.isArray((caseRow as any).worries) ? (caseRow as any).worries : [];
    const recollection: Record<string, unknown> = (caseRow as any).recollection ?? {};

    let workDoneClassify = 0;

    // --- Phase A: classify any unclassified files (fast, single call per file) ---
    for (const f of files) {
      if (workDoneClassify >= 6) break; // cap classifications per run
      if (f.doc_type) continue; // already known (user-supplied or earlier run)
      try {
        await setStatus("processing", `Identifying document: ${f.file_name}`);
        const sample = await getClassificationSample(admin, f);
        const content = await callAI(
          [
            { role: "system", content: CLASSIFY_SYSTEM },
            { role: "user", content: `FILE NAME: ${f.file_name}\nFILE TYPE: ${f.file_type || "unknown"}\n\nSAMPLE TEXT (first ~3000 chars):\n${sample}` },
          ],
          MODEL_CLASSIFY,
          true,
        );
        const parsed = safeParseJson<{ doc_type?: string; confidence?: number; signals?: string[] }>(content, {});
        const docType = (DOC_TYPES as readonly string[]).includes(parsed.doc_type || "")
          ? (parsed.doc_type as DocType)
          : "unknown";
        await admin
          .from("patient_self_help_files")
          .update({ doc_type: docType, doc_type_source: "auto" })
          .eq("id", f.id);
        f.doc_type = docType;
        workDoneClassify += 1;
      } catch (e) {
        console.warn("classify failed", f.file_name, e);
        await admin.from("patient_self_help_files").update({ doc_type: "unknown", doc_type_source: "auto" }).eq("id", f.id);
        f.doc_type = "unknown";
      }
    }

    // --- Compute analysis modes from classified files ---
    const docTypes: DocType[] = files.map((f: any) => (f.doc_type as DocType) || "unknown");
    const modes = {
      clinical: docTypes.some((d) => (CLINICAL_DOC_TYPES as string[]).includes(d)),
      billing: docTypes.some((d) => (BILLING_DOC_TYPES as string[]).includes(d)),
      consent: docTypes.some((d) => (CONSENT_DOC_TYPES as string[]).includes(d)),
    };
    const disabledReasons: string[] = [];
    if (!modes.billing && worries.includes("billing")) {
      disabledReasons.push("Billing/payment analysis is disabled because no itemized bill, EOB, UB-04, CMS-1500, 837, or charge detail was uploaded.");
    }
    if (!modes.clinical) {
      disabledReasons.push("Clinical reconciliation is limited because no clinical chart, lab, imaging, or discharge summary was detected in this upload.");
    }
    if (!modes.consent && (worries.includes("med_before_consent") || worries.includes("procedure_without_consent"))) {
      disabledReasons.push("Consent review is limited because no consent packet or clinical chart with consent forms was detected.");
    }
    const disabledReason = disabledReasons.join(" ");
    await admin
      .from("patient_self_help_cases")
      .update({ analysis_modes: modes, disabled_modes_reason: disabledReason })
      .eq("id", case_id);

    let workDone = 0;
    let moreWork = false;

    for (const f of files) {
      if (workDone >= CHUNKS_PER_RUN) { moreWork = true; break; }
      if (f.file_status === "done" || f.file_status === "error") continue;

      const docType = ((f.doc_type as DocType) || "unknown");
      const chunkSystem = buildChunkSystem({ worries, recollection, docType, modes });

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
                { role: "system", content: chunkSystem },
                { role: "user", content: userText },
              ],
              MODEL_FAST,
              true,
            );
            const parsed = safeParseJson<ChunkExtract>(content, { events: [], observations: [] });

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
              { role: "system", content: chunkSystem + "\n\nThis input is a photograph of a paper record, monitor strip, or sign-in sheet. Transcribe everything you can read, then return JSON observations." },
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
          const parsed = safeParseJson<ChunkExtract>(content, { events: [], observations: [] });
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
              { role: "system", content: chunkSystem },
              { role: "user", content: `FILE: ${f.file_name}\n\n${text}` },
            ],
            MODEL_FAST,
            true,
          );
          const parsed = safeParseJson<ChunkExtract>(content, { events: [], observations: [] });
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
              { chunkLabel: "error", extract: { events: [], observations: [], notes: `Could not process: ${e instanceof Error ? e.message : String(e)}` } },
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
      .select("file_name, chunk_results, doc_type")
      .eq("case_id", case_id);

    const allExtracts: Array<{ file: string; chunkLabel: string; extract: unknown }> = [];
    const docTypeCounts: Record<string, number> = {};
    for (const ff of finalFiles ?? []) {
      const dt = (ff as any).doc_type || "unknown";
      docTypeCounts[dt] = (docTypeCounts[dt] || 0) + 1;
      const arr = Array.isArray(ff.chunk_results) ? ff.chunk_results : [];
      for (const c of arr) {
        allExtracts.push({ file: ff.file_name, chunkLabel: (c as any).chunkLabel, extract: (c as any).extract });
      }
    }

    const synthSystem = buildSynthSystem({ worries, modes, disabledReason, docTypeCounts });

    const synthUser = JSON.stringify({
      case_title: caseRow.case_title,
      scope: caseRow.scope,
      narrative: caseRow.narrative,
      worries,
      recollection,
      doc_type_counts: docTypeCounts,
      analysis_modes: modes,
      disabled_reason: disabledReason,
      extracts: allExtracts,
    }).slice(0, 600000);

    let synthRaw = "";
    try {
      synthRaw = await callAI(
        [
          { role: "system", content: synthSystem },
          { role: "user", content: synthUser },
        ],
        MODEL_SYNTH,
        true,
      );
    } catch (e) {
      console.warn("synth pro failed, retrying with flash", e);
      synthRaw = await callAI(
        [
          { role: "system", content: synthSystem },
          { role: "user", content: synthUser },
        ],
        MODEL_FAST,
        true,
      );
    }

    let results = safeParseJson<Record<string, any>>(synthRaw, {
      summary: "Report could not be generated.",
      structuredSummary: { supports: "", contains: [], doesNotInclude: [], disabledModes: [], headlineAsks: [] },
      cards: [],
      timeline: [],
      complaintPacket: { intro: "", sections: [], requestedActions: [] },
      attorneySummary: { caseTheory: "", keyDeviations: [], damagesNarrative: "", recordsCited: [] },
    });

    // Validate cards. Retry once with stricter prompt if any invalid.
    const validation = validateCards(results.cards || [], modes);
    if (!validation.ok) {
      console.warn("card validation failed, retrying", validation.reasons);
      try {
        const stricter = await callAI(
          [
            { role: "system", content: synthSystem + `\n\nPREVIOUS OUTPUT FAILED VALIDATION:\n- ${validation.reasons.join("\n- ")}\nFIX EVERY CARD. Every card must include a non-empty whatItDoesNotProve. No billing cards if billing=false. Every Missing Source Document card needs a paired Ask For This Next card.` },
            { role: "user", content: synthUser },
          ],
          MODEL_SYNTH,
          true,
        );
        const retried = safeParseJson<Record<string, any>>(stricter, results);
        const retryValidation = validateCards(retried.cards || [], modes);
        if (retryValidation.ok || (retried.cards || []).length > 0) {
          results = retried;
        }
      } catch (e) {
        console.warn("strict retry failed", e);
      }
    }
    // Always drop any invalid cards as a final safety net
    results.cards = (results.cards || []).filter((c: any) => isValidCard(c, modes));

    await admin
      .from("patient_self_help_cases")
      .update({
        status: "complete",
        progress_message: "Review complete",
        results: {
          ...results,
          analysisModes: modes,
          disabledModesReason: disabledReason,
          docTypeCounts,
          generatedAt: new Date().toISOString(),
          chunkCount: allExtracts.length,
        },
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
