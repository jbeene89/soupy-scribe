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