import { supabase } from "@/integrations/supabase/client";

export interface PayerPolicy {
  id: string;
  user_id: string;
  payer: string | null;
  policy_id: string;
  policy_type: string;
  title: string | null;
  source_url: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PayerPolicyVersion {
  id: string;
  policy_id: string;
  user_id: string;
  version_label: string | null;
  effective_start: string;       // YYYY-MM-DD
  effective_end: string | null;
  policy_text: string;
  source_url: string | null;
  change_summary: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

/* ============ Policies ============ */

export async function listPolicies(): Promise<PayerPolicy[]> {
  const { data, error } = await supabase
    .from("payer_policies").select("*")
    .order("payer", { ascending: true })
    .order("policy_id", { ascending: true });
  if (error) throw error;
  return (data || []) as any;
}

export async function getPolicy(id: string): Promise<PayerPolicy | null> {
  const { data, error } = await supabase.from("payer_policies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function upsertPolicy(p: {
  id?: string;
  payer?: string | null;
  policy_id: string;
  policy_type?: string;
  title?: string | null;
  source_url?: string | null;
  notes?: string | null;
}): Promise<PayerPolicy> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (p.id) {
    const { data, error } = await supabase.from("payer_policies").update({
      payer: p.payer ?? null, policy_id: p.policy_id, policy_type: p.policy_type ?? "commercial",
      title: p.title ?? null, source_url: p.source_url ?? null, notes: p.notes ?? null,
    }).eq("id", p.id).select("*").single();
    if (error) throw error;
    return data as any;
  }
  const { data, error } = await supabase.from("payer_policies").insert({
    user_id: user.id, payer: p.payer ?? null, policy_id: p.policy_id, policy_type: p.policy_type ?? "commercial",
    title: p.title ?? null, source_url: p.source_url ?? null, notes: p.notes ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function deletePolicy(id: string) {
  const { error } = await supabase.from("payer_policies").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Versions ============ */

export async function listVersions(policyId: string): Promise<PayerPolicyVersion[]> {
  const { data, error } = await supabase
    .from("payer_policy_versions").select("*")
    .eq("policy_id", policyId)
    .order("effective_start", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function addVersion(v: {
  policy_id: string;
  version_label?: string | null;
  effective_start: string;
  effective_end?: string | null;
  policy_text: string;
  source_url?: string | null;
  change_summary?: string | null;
}): Promise<PayerPolicyVersion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase.from("payer_policy_versions").insert({
    user_id: user.id, ...v,
    version_label: v.version_label ?? null,
    effective_end: v.effective_end ?? null,
    source_url: v.source_url ?? null,
    change_summary: v.change_summary ?? null,
  }).select("*").single();
  if (error) throw error;
  return data as any;
}

export async function updateVersion(id: string, patch: Partial<PayerPolicyVersion>) {
  const { error } = await supabase.from("payer_policy_versions").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteVersion(id: string) {
  const { error } = await supabase.from("payer_policy_versions").delete().eq("id", id);
  if (error) throw error;
}

/* ============ Bulk import ============ */

export interface BulkVersionRow {
  version_label?: string | null;
  effective_start: string;
  effective_end?: string | null;
  policy_text: string;
  change_summary?: string | null;
  source_url?: string | null;
}

/** Parse a minimal CSV (RFC-4180-ish) into rows of objects keyed by header. */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        cur.push(field); field = ""; rows.push(cur); cur = [];
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  const cleaned = rows.filter(r => r.some(v => v && v.trim() !== ""));
  if (cleaned.length === 0) return [];
  const headers = cleaned[0].map(h => h.trim());
  return cleaned.slice(1).map(r => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
    return o;
  });
}

function normalizeDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // Accept M/D/YYYY or MM/DD/YYYY
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, mm, dd, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  // Fallback: Date parse
  const d = new Date(t);
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const da = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${mo}-${da}`;
  }
  return null;
}

/** Coerce an arbitrary parsed row into a BulkVersionRow with validation. */
export function coerceVersionRow(raw: Record<string, any>): { ok: true; row: BulkVersionRow } | { ok: false; error: string } {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(raw).find(rk => rk.toLowerCase() === k.toLowerCase());
      if (found && raw[found] != null && String(raw[found]).trim() !== "") return String(raw[found]);
    }
    return "";
  };
  const start = normalizeDate(get("effective_start", "start", "effectiveStart", "effective start"));
  if (!start) return { ok: false, error: "Missing or invalid effective_start" };
  const endRaw = get("effective_end", "end", "effectiveEnd", "effective end");
  const end = endRaw ? normalizeDate(endRaw) : null;
  if (endRaw && !end) return { ok: false, error: "Invalid effective_end" };
  const policy_text = get("policy_text", "text", "policyText", "policy text");
  if (!policy_text) return { ok: false, error: "Missing policy_text" };
  return {
    ok: true,
    row: {
      version_label: get("version_label", "label", "version") || null,
      effective_start: start,
      effective_end: end,
      policy_text,
      change_summary: get("change_summary", "summary", "changeSummary", "change summary") || null,
      source_url: get("source_url", "url", "sourceUrl", "source url") || null,
    },
  };
}

/** Bulk insert versions for a policy. Returns inserted count. */
export async function bulkAddVersions(policyId: string, rows: BulkVersionRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const payload = rows.map(r => ({
    user_id: user.id,
    policy_id: policyId,
    version_label: r.version_label ?? null,
    effective_start: r.effective_start,
    effective_end: r.effective_end ?? null,
    policy_text: r.policy_text,
    change_summary: r.change_summary ?? null,
    source_url: r.source_url ?? null,
  }));
  const { data, error } = await supabase.from("payer_policy_versions").insert(payload).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/**
 * Resolve which version was active on a given Date of Service.
 * Active = effective_start <= dos AND (effective_end IS NULL OR effective_end >= dos).
 * If multiple match, pick the one with the most recent effective_start.
 */
export async function resolveVersionForDOS(policyId: string, dos: string): Promise<PayerPolicyVersion | null> {
  const { data, error } = await supabase
    .from("payer_policy_versions").select("*")
    .eq("policy_id", policyId)
    .lte("effective_start", dos)
    .or(`effective_end.is.null,effective_end.gte.${dos}`)
    .order("effective_start", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data[0]) as any || null;
}

/** Get the current (most recent) version for a policy. */
export async function getCurrentVersion(policyId: string): Promise<PayerPolicyVersion | null> {
  const { data, error } = await supabase
    .from("payer_policy_versions").select("*")
    .eq("policy_id", policyId)
    .order("effective_start", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data[0]) as any || null;
}

/** Find a policy by (payer, policy_id) within the current user's library. */
export async function findPolicy(policyId: string, payer?: string | null): Promise<PayerPolicy | null> {
  let q = supabase.from("payer_policies").select("*").eq("policy_id", policyId);
  if (payer != null && payer !== "") q = q.eq("payer", payer);
  else q = q.is("payer", null);
  const { data, error } = await q.limit(1);
  if (error) throw error;
  return (data && data[0]) as any || null;
}