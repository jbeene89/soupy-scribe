// RAC Clawback Shield — bulk ingest
// Accepts: { auditMeta, csvText, chartIndex? }
// Parses claims roster CSV, creates audit + claims rows.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitLine = (s: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) if (row[k] !== undefined && row[k] !== "") return row[k];
  return "";
}
function num(s: string): number {
  const n = parseFloat(String(s).replace(/[$,]/g, ""));
  return isFinite(n) ? n : 0;
}
function arr(s: string): string[] {
  return s.split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
}
function dateOrNull(s: string): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { auditMeta = {}, csvText = "", chartIndex = {} } = body;
    if (!csvText || typeof csvText !== "string") {
      return new Response(JSON.stringify({ error: "csvText required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No claim rows parsed from CSV" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create audit
    const sampleSize = Number(auditMeta.sampleSize) || rows.length;
    const universeSize = Number(auditMeta.universeSize) || 0;
    const demand = Number(auditMeta.demandAmount) || 0;
    const { data: audit, error: aErr } = await sb.from("clawback_audits").insert({
      owner_id: user.id,
      audit_name: auditMeta.auditName || `RAC Audit ${new Date().toISOString().slice(0,10)}`,
      contractor: auditMeta.contractor || null,
      contractor_type: auditMeta.contractorType || "rac",
      demand_amount: demand,
      universe_size: universeSize,
      sample_size: sampleSize,
      stratification: auditMeta.stratification || {},
      audit_period_start: dateOrNull(auditMeta.periodStart),
      audit_period_end: dateOrNull(auditMeta.periodEnd),
      notice_date: dateOrNull(auditMeta.noticeDate),
      response_deadline: dateOrNull(auditMeta.responseDeadline),
      status: "ingested",
      notes: auditMeta.notes || null,
    }).select().single();
    if (aErr) throw aErr;

    // Build claim rows
    const claimRows = rows.map((r) => {
      const claimNumber = pick(r, ["claim_number", "claim_id", "claim", "icn"]);
      return {
        audit_id: audit.id,
        owner_id: user.id,
        claim_number: claimNumber || null,
        patient_ref: pick(r, ["patient_id", "patient_ref", "mrn", "member_id"]) || null,
        date_of_service: dateOrNull(pick(r, ["date_of_service", "dos", "service_date"])),
        billed_amount: num(pick(r, ["billed_amount", "billed", "charge", "charge_amount"])),
        rac_disallowed_amount: num(pick(r, ["disallowed", "disallowed_amount", "overpayment", "denied_amount"])),
        cpt_codes: arr(pick(r, ["cpt", "cpt_codes", "procedure_codes"])),
        icd_codes: arr(pick(r, ["icd", "icd_codes", "diagnosis_codes", "dx"])),
        rac_finding_code: pick(r, ["finding_code", "rac_code", "denial_code"]) || null,
        rac_finding_text: pick(r, ["finding", "finding_text", "denial_reason", "reason"]) || null,
        chart_file_path: chartIndex[claimNumber] || null,
        defense_status: "pending",
      };
    });

    const { error: cErr } = await sb.from("clawback_claims").insert(claimRows);
    if (cErr) throw cErr;

    return new Response(JSON.stringify({ success: true, auditId: audit.id, claimCount: claimRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("clawback-ingest error", e);
    return new Response(JSON.stringify({ error: e?.message || "Ingest failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});