import { supabase } from "@/integrations/supabase/client";
import type { ClawbackAudit, ClawbackClaim, ClawbackExtrapolation } from "./clawbackTypes";
import { extractTextFromFile } from "./fileTextExtractor";

export async function listAudits(): Promise<ClawbackAudit[]> {
  const { data, error } = await supabase.from("clawback_audits").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function getAudit(id: string): Promise<ClawbackAudit | null> {
  const { data, error } = await supabase.from("clawback_audits").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listClaims(auditId: string): Promise<ClawbackClaim[]> {
  const { data, error } = await supabase.from("clawback_claims").select("*").eq("audit_id", auditId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as any;
}

export async function getExtrapolation(auditId: string): Promise<ClawbackExtrapolation | null> {
  const { data, error } = await supabase.from("clawback_extrapolation").select("*").eq("audit_id", auditId).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function ingestAudit(params: {
  auditMeta: Record<string, any>;
  csvText: string;
  chartIndex?: Record<string, string>;
}): Promise<{ auditId: string; claimCount: number }> {
  const { data, error } = await supabase.functions.invoke("clawback-ingest", { body: params });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Ingest failed");
  return { auditId: data.auditId, claimCount: data.claimCount };
}

export async function analyzeClaim(claimId: string, chartText?: string) {
  const { data, error } = await supabase.functions.invoke("clawback-analyze-claim", { body: { claimId, chartText } });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Analyze failed");
  return data;
}

export async function runExtrapolationAttack(auditId: string): Promise<ClawbackExtrapolation> {
  const { data, error } = await supabase.functions.invoke("clawback-extrapolation-attack", { body: { auditId } });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Extrapolation attack failed");
  return data as any;
}

/** Helper: extract chart text from a stored file path. */
export async function fetchChartText(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("clawback-files").download(path);
  if (error || !data) return "";
  const file = new File([data], path.split("/").pop() || "chart");
  try {
    const r = await extractTextFromFile(file);
    return r.text || "";
  } catch { return ""; }
}

export async function uploadChartForClaim(userId: string, auditId: string, claimId: string, file: File): Promise<string> {
  const path = `${userId}/${auditId}/charts/${claimId}-${file.name}`;
  const { error } = await supabase.storage.from("clawback-files").upload(path, file, { upsert: true });
  if (error) throw error;
  await supabase.from("clawback_claims").update({ chart_file_path: path }).eq("id", claimId);
  return path;
}

export async function deleteAudit(id: string) {
  const { error } = await supabase.from("clawback_audits").delete().eq("id", id);
  if (error) throw error;
}