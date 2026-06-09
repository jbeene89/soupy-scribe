// audit-bundle — per-row detector for Code Bay synthetic audit bundles.
//
// Unlike recovery-engine, this function never flattens the bundle into prose.
// It walks each charge / vendor invoice / clinical note row, asks the model
// for zero-or-more findings tagged with that row's sourceId, then validates
// every finding so the playbook can never report a category without naming
// the rows behind it.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SourceType = "charge" | "vendor" | "note" | "timesheet";

type IncomingRow = {
  sourceId: string;
  sourceType: SourceType;
  row: Record<string, unknown>;
};

const SYSTEM_PROMPT = `You are a healthcare revenue-integrity auditor reviewing one row at a time.

You receive a single row from a charges / vendor invoices / clinical notes / timesheets file.
You return zero or more findings about THIS ROW ONLY.

RULES — every finding must obey these exactly:
1. "sourceId" MUST equal the sourceId of the row you were given. Do not invent ids.
2. "evidence" MUST be a verbatim substring of one of the row's cell values.
   If you cannot quote the row verbatim, OMIT the finding.
3. "defectType" MUST be one of:
   upcoding, unbundling, bundling, modifier_abuse, phantom_charge,
   duplicate_charge, vendor_overbilling, vendor_duplicate, policy_time,
   contract_underpay, documentation_gap, medical_necessity, other
4. "recoverableAmount" is the dollar amount this defect costs (>= 0).
5. Be conservative. If nothing is wrong with this row, return {"findings": []}.

Return JSON ONLY in this schema:
{
  "findings": [
    {
      "sourceId": "<exact id from the input>",
      "sourceType": "<charge|vendor|note|timesheet>",
      "defectType": "<from the list above>",
      "confidence": "high" | "medium" | "low",
      "recoverableAmount": <number>,
      "evidence": "<verbatim quote from the row>",
      "explanation": "<1-2 sentences>"
    }
  ]
}`;

const DEFECT_VOCAB = new Set([
  "upcoding","unbundling","bundling","modifier_abuse","phantom_charge",
  "duplicate_charge","vendor_overbilling","vendor_duplicate","policy_time",
  "contract_underpay","documentation_gap","medical_necessity","other",
]);

function getInferenceConfig(lovableKey: string) {
  const customUrl = Deno.env.get("CUSTOM_INFERENCE_URL");
  const customKey = Deno.env.get("CUSTOM_INFERENCE_API_KEY");
  const customModel = Deno.env.get("CUSTOM_INFERENCE_MODEL");
  if (customUrl && customKey && customModel) {
    return { url: customUrl, key: customKey, model: customModel };
  }
  return {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    key: lovableKey,
    model: "google/gemini-2.5-flash",
  };
}

// Build a haystack from a row's cell values so we can check `evidence` is verbatim.
function rowHaystack(row: Record<string, unknown>): string {
  return Object.values(row).map((v) => String(v ?? "")).join(" | ");
}

async function detectOnRow(
  incoming: IncomingRow,
  context: { peerRows?: IncomingRow[] } | null,
  apiKey: string,
): Promise<any[]> {
  const inf = getInferenceConfig(apiKey);
  const ctxBlock = context?.peerRows?.length
    ? `\nPEER ROWS (same patient/encounter, for context only — DO NOT report findings against them here):\n${JSON.stringify(context.peerRows.slice(0, 12), null, 2)}\n`
    : "";
  const user = `ROW:
${JSON.stringify(incoming, null, 2)}
${ctxBlock}
Return JSON only.`;

  const res = await fetch(inf.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${inf.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: inf.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`model_call_failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { parsed = {}; }
  return Array.isArray(parsed.findings) ? parsed.findings : [];
}

function validate(
  raw: any,
  expected: IncomingRow,
): { ok: true; finding: any } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "not_object" };
  const sourceId = String(raw.sourceId || "").trim();
  if (!sourceId) return { ok: false, reason: "missing_sourceId" };
  if (sourceId !== expected.sourceId) return { ok: false, reason: "sourceId_mismatch" };

  const defectType = String(raw.defectType || "").trim().toLowerCase();
  if (!defectType) return { ok: false, reason: "missing_defectType" };
  // We accept out-of-vocab defect types but normalize the common ones.
  const normalizedDefect = DEFECT_VOCAB.has(defectType) ? defectType : defectType;

  const evidence = String(raw.evidence || "").trim();
  if (!evidence) return { ok: false, reason: "missing_evidence" };

  // Verbatim check against the row.
  const hay = rowHaystack(expected.row).toLowerCase().replace(/\s+/g, " ");
  const needle = evidence.toLowerCase().replace(/\s+/g, " ");
  if (needle.length >= 3 && !hay.includes(needle)) {
    return { ok: false, reason: "evidence_not_in_row" };
  }

  const conf = String(raw.confidence || "medium").toLowerCase();
  const confidence = conf === "high" || conf === "low" ? conf : "medium";

  return {
    ok: true,
    finding: {
      sourceId,
      sourceType: expected.sourceType,
      defectType: normalizedDefect,
      confidence,
      recoverableAmount: Math.max(0, Number(raw.recoverableAmount) || 0),
      evidence: evidence.slice(0, 1000),
      explanation: String(raw.explanation || "").slice(0, 1000),
    },
  };
}

// Limit concurrency so the gateway doesn't get hammered when bundles have
// hundreds of rows. Tuned conservatively — bundles of a few hundred rows
// complete in well under a minute at this rate.
async function mapConcurrent<I, O>(
  items: I[],
  limit: number,
  worker: (item: I, idx: number) => Promise<O>,
): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    const hasCustom = !!(Deno.env.get("CUSTOM_INFERENCE_URL")
      && Deno.env.get("CUSTOM_INFERENCE_API_KEY")
      && Deno.env.get("CUSTOM_INFERENCE_MODEL"));
    if (!apiKey && !hasCustom) {
      return new Response(
        JSON.stringify({ error: "No inference provider configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const incoming: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!incoming.length) {
      return new Response(
        JSON.stringify({ error: "rows[] is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cap to protect the gateway and the user's wallet.
    const MAX_ROWS = 400;
    const work = incoming.slice(0, MAX_ROWS);
    const truncated = incoming.length > MAX_ROWS;

    // Build per-patient context groups so the model sees siblings of each
    // charge row when looking at one (helpful for bundling / duplicate calls).
    const peersByKey = new Map<string, IncomingRow[]>();
    for (const r of work) {
      const pid = String((r.row as any).patient_id ?? (r.row as any).patientId ?? "");
      const key = `${r.sourceType}:${pid}`;
      const arr = peersByKey.get(key) ?? [];
      arr.push(r);
      peersByKey.set(key, arr);
    }

    const validFindings: any[] = [];
    const rejected: Array<{ row: IncomingRow; reason: string }> = [];
    const rowErrors: Array<{ sourceId: string; error: string }> = [];

    await mapConcurrent(work, 6, async (item) => {
      try {
        const pid = String((item.row as any).patient_id ?? (item.row as any).patientId ?? "");
        const peerKey = `${item.sourceType}:${pid}`;
        const peers = (peersByKey.get(peerKey) ?? []).filter((p) => p.sourceId !== item.sourceId);
        const raw = await detectOnRow(item, { peerRows: peers }, apiKey);
        for (const r of raw) {
          const v = validate(r, item);
          if (v.ok) validFindings.push(v.finding);
          else rejected.push({ row: item, reason: v.reason });
        }
      } catch (e) {
        rowErrors.push({ sourceId: item.sourceId, error: (e as Error).message.slice(0, 200) });
      }
    });

    return new Response(
      JSON.stringify({
        findings: validFindings,
        stats: {
          rowsAnalyzed: work.length,
          rowsTruncated: truncated ? incoming.length - work.length : 0,
          findingsKept: validFindings.length,
          findingsRejected: rejected.length,
          rowErrors: rowErrors.length,
        },
        rejectedReasons: rejected.reduce<Record<string, number>>((acc, r) => {
          acc[r.reason] = (acc[r.reason] || 0) + 1;
          return acc;
        }, {}),
        errors: rowErrors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});