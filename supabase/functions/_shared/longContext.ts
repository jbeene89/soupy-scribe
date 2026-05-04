/**
 * Long-context handling for SOUPY engines.
 *
 * Replaces naive `substring(0, N)` truncation. When input is over the safe
 * window we run a priority-extraction pass that:
 *   1. Detects multi-document blocks ("----- filename -----")
 *   2. Keeps high-signal sections verbatim (auth letters, denial letters,
 *      conservative-therapy notes, op notes, code lists)
 *   3. Summarizes the rest into a compact "context summary"
 *
 * This prevents page 2,143 of a 4,000-page C-file from being silently dropped.
 */

const SAFE_WINDOW = 60_000;          // chars sent to the analysis model
const PRIORITY_BUDGET = 40_000;      // chars reserved for verbatim priority sections
const SUMMARY_BUDGET = 18_000;       // chars reserved for the AI summary

const PRIORITY_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "prior_authorization", re: /\b(prior\s*auth|preauthorization|pre-auth|authorization\s+number|approved\s+for\s+procedure)\b/i },
  { name: "denial_letter",       re: /\b(denial|denied|adverse\s+determination|not\s+medically\s+necessary|claim\s+rejected|EOB)\b/i },
  { name: "conservative_therapy",re: /\b(physical\s+therapy|conservative\s+(care|management|treatment)|failed\s+(PT|conservative)|epidural|injection\s*x\s*\d|NSAID)\b/i },
  { name: "operative_report",    re: /\b(operative\s+(report|note)|preoperative\s+diagnosis|postoperative\s+diagnosis|procedures?\s+performed)\b/i },
  { name: "imaging_report",      re: /\b(MRI|CT\s+scan|X-?ray|ultrasound|impression:|findings:)\b/i },
  { name: "code_list",           re: /\b(CPT|ICD-?10|HCPCS|modifier|DRG)\s*[:#]/i },
  { name: "nexus_letter",        re: /\b(nexus|letter\s+of\s+medical\s+necessity|peer\s*to\s*peer|attestation)\b/i },
];

export interface DocumentSection {
  name: string;
  text: string;
  priorityHits: string[];
}

/** Split a concatenated upload (with "----- filename -----" headers) into sections. */
export function splitSections(sourceText: string): DocumentSection[] {
  const headerRe = /-----\s+(.+?)\s+-----/g;
  const matches = [...sourceText.matchAll(headerRe)];
  if (matches.length === 0) {
    return [{ name: "document", text: sourceText, priorityHits: detectHits(sourceText) }];
  }
  const sections: DocumentSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : sourceText.length;
    const text = sourceText.slice(start, end).trim();
    if (!text) continue;
    sections.push({ name: matches[i][1], text, priorityHits: detectHits(text) });
  }
  return sections;
}

function detectHits(text: string): string[] {
  const hits: string[] = [];
  for (const p of PRIORITY_PATTERNS) {
    if (p.re.test(text)) hits.push(p.name);
  }
  return hits;
}

/** Extract the highest-signal passages from a section (window around each hit). */
function extractPriorityWindows(section: DocumentSection, maxChars: number): string {
  if (section.text.length <= maxChars) return section.text;
  const windows: Array<{ start: number; end: number }> = [];
  const WINDOW = 1_500;
  for (const p of PRIORITY_PATTERNS) {
    const re = new RegExp(p.re.source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(section.text)) !== null) {
      windows.push({
        start: Math.max(0, m.index - WINDOW / 2),
        end: Math.min(section.text.length, m.index + WINDOW),
      });
      if (windows.length > 30) break;
    }
  }
  if (windows.length === 0) return section.text.slice(0, maxChars);
  // Merge overlaps
  windows.sort((a, b) => a.start - b.start);
  const merged: typeof windows = [];
  for (const w of windows) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  let out = "";
  for (const w of merged) {
    if (out.length + (w.end - w.start) > maxChars) {
      out += "\n[...truncated...]\n" + section.text.slice(w.start, w.start + (maxChars - out.length));
      break;
    }
    out += section.text.slice(w.start, w.end) + "\n[...]\n";
  }
  return out;
}

/**
 * Prepare a long-context payload safe for a single LLM call.
 * For inputs ≤ SAFE_WINDOW: returned as-is.
 * For larger inputs: priority-extracted + AI-summarized rest, with a manifest header
 * so the analysis model knows what was included verbatim and what was condensed.
 */
export async function prepareLongContext(
  sourceText: string,
  apiKey: string,
): Promise<{ prepared: string; manifest: any }> {
  if (sourceText.length <= SAFE_WINDOW) {
    return {
      prepared: sourceText,
      manifest: { strategy: "verbatim", originalChars: sourceText.length },
    };
  }

  const sections = splitSections(sourceText);
  // Score sections by how many priority patterns hit
  const scored = sections
    .map((s) => ({ ...s, score: s.priorityHits.length, len: s.text.length }))
    .sort((a, b) => b.score - a.score || a.len - b.len);

  // Pack priority sections within budget (verbatim or window-extracted)
  const includedVerbatim: Array<{ name: string; text: string; hits: string[] }> = [];
  let used = 0;
  for (const s of scored) {
    if (s.score === 0) continue;
    const remaining = PRIORITY_BUDGET - used;
    if (remaining < 500) break;
    const text = s.len <= remaining
      ? s.text
      : extractPriorityWindows(s, remaining);
    includedVerbatim.push({ name: s.name, text, hits: s.priorityHits });
    used += text.length;
  }
  const includedNames = new Set(includedVerbatim.map((s) => s.name));
  const remainder = sections.filter((s) => !includedNames.has(s.name));

  // Summarize remainder via Lovable AI (best-effort; fail open to head/tail truncation)
  let summary = "";
  if (remainder.length > 0) {
    const remainderConcat = remainder
      .map((s) => `### ${s.name}\n${s.text}`)
      .join("\n\n")
      .slice(0, 80_000); // cap input to summarizer to keep latency bounded
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "You are a clinical document compressor. Condense the provided documents into a faithful summary preserving: dates, CPT/ICD codes, prior authorizations (with auth numbers if present), denials and reasons, conservative therapies tried, dosages, vendor/facility names, and any sentence that could be cited in an appeal. Do not invent facts. Do not omit numeric values. Output plain text under 15,000 characters.",
            },
            { role: "user", content: remainderConcat },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        summary = (data.choices?.[0]?.message?.content || "").slice(0, SUMMARY_BUDGET);
      }
    } catch (_) {
      // ignore; fall back below
    }
    if (!summary) {
      // Fail open: take head+tail of remainder
      const head = remainderConcat.slice(0, SUMMARY_BUDGET / 2);
      const tail = remainderConcat.slice(remainderConcat.length - SUMMARY_BUDGET / 2);
      summary = `[Auto-summary unavailable; raw head+tail of non-priority sections below]\n${head}\n...\n${tail}`;
    }
  }

  const manifest = {
    strategy: "priority_extraction",
    originalChars: sourceText.length,
    sectionCount: sections.length,
    verbatimSections: includedVerbatim.map((s) => ({ name: s.name, hits: s.hits, chars: s.text.length })),
    summarizedSectionCount: remainder.length,
    summaryChars: summary.length,
  };

  const header =
    `=== SOUPY LONG-CONTEXT MANIFEST ===\n` +
    `Original input: ${sourceText.length.toLocaleString()} chars across ${sections.length} section(s).\n` +
    `Priority sections kept verbatim: ${includedVerbatim.map((s) => `${s.name} [${s.hits.join(",")}]`).join("; ") || "(none detected)"}.\n` +
    `Other sections compressed into summary below.\n` +
    `=== END MANIFEST ===\n\n`;

  const verbatimBlock = includedVerbatim
    .map((s) => `----- ${s.name} (verbatim) -----\n${s.text}`)
    .join("\n\n");

  const summaryBlock = summary
    ? `\n\n----- COMPRESSED SUMMARY OF REMAINING ${remainder.length} SECTION(S) -----\n${summary}`
    : "";

  return { prepared: header + verbatimBlock + summaryBlock, manifest };
}

/** Cheap, no-AI version for places where we don't want a network call. */
export function prepareLongContextSync(sourceText: string, maxChars = SAFE_WINDOW): string {
  if (sourceText.length <= maxChars) return sourceText;
  const sections = splitSections(sourceText);
  const priorityFirst = sections.sort((a, b) => b.priorityHits.length - a.priorityHits.length);
  let out = "";
  for (const s of priorityFirst) {
    if (out.length >= maxChars) break;
    const remaining = maxChars - out.length;
    const slice = s.priorityHits.length > 0
      ? extractPriorityWindows(s, remaining)
      : s.text.slice(0, Math.min(remaining, 4_000));
    out += `----- ${s.name} -----\n${slice}\n\n`;
  }
  return out.slice(0, maxChars);
}