import { supabase } from "@/integrations/supabase/client";
import type { ClawbackAudit, ClawbackClaim, ClawbackExtrapolation } from "./clawbackTypes";
import { extractTextFromFile } from "./fileTextExtractor";
import JSZip from "jszip";

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

/**
 * Bulk-attach charts from a ZIP file by matching filenames to claim_number.
 * A chart matches a claim if its base filename (without extension) contains the claim_number,
 * or vice versa. Returns counts of matched/unmatched files.
 */
export async function bulkAttachChartsFromZip(
  userId: string,
  auditId: string,
  zipFile: File,
  onProgress?: (done: number, total: number) => void,
): Promise<{ matched: number; unmatched: string[]; total: number }> {
  const claims = await listClaims(auditId);
  const claimByKey = new Map<string, ClawbackClaim>();
  for (const c of claims) {
    if (c.claim_number) claimByKey.set(c.claim_number.toLowerCase().trim(), c);
  }

  const zip = await JSZip.loadAsync(await zipFile.arrayBuffer());
  const entries = Object.values(zip.files).filter(f => !f.dir);
  let matched = 0;
  const unmatched: string[] = [];
  let i = 0;
  for (const entry of entries) {
    i++;
    onProgress?.(i, entries.length);
    const base = (entry.name.split("/").pop() || entry.name).replace(/\.[^.]+$/, "").toLowerCase();
    let claim: ClawbackClaim | undefined;
    // Direct match
    claim = claimByKey.get(base);
    if (!claim) {
      // Fuzzy: any claim_number that appears in or contains the basename
      for (const [k, c] of claimByKey) {
        if (base.includes(k) || k.includes(base)) { claim = c; break; }
      }
    }
    if (!claim) { unmatched.push(entry.name); continue; }
    try {
      const blob = await entry.async("blob");
      const ext = entry.name.split(".").pop() || "bin";
      const file = new File([blob], `${claim.claim_number}.${ext}`);
      await uploadChartForClaim(userId, auditId, claim.id, file);
      matched++;
    } catch (e) {
      console.error("bulk chart upload failed for", entry.name, e);
      unmatched.push(entry.name);
    }
  }
  return { matched, unmatched, total: entries.length };
}

/** Concurrency-limited batch claim analyzer with retry-on-rate-limit. */
export async function batchAnalyzeClaims(
  claims: ClawbackClaim[],
  opts: { concurrency?: number; onProgress?: (done: number, total: number) => void; onClaimError?: (claim: ClawbackClaim, err: Error) => void } = {},
): Promise<{ ok: number; failed: number }> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  let ok = 0, failed = 0, done = 0;
  const queue = [...claims];
  async function worker() {
    while (queue.length) {
      const c = queue.shift()!;
      let attempt = 0;
      while (attempt < 3) {
        try {
          const chartText = c.chart_file_path ? await fetchChartText(c.chart_file_path) : "";
          await analyzeClaim(c.id, chartText);
          ok++;
          break;
        } catch (e: any) {
          attempt++;
          const msg = String(e?.message || e || "");
          if (msg.includes("Rate limit") && attempt < 3) {
            await new Promise(r => setTimeout(r, 1500 * attempt));
            continue;
          }
          if (attempt >= 3) {
            failed++;
            opts.onClaimError?.(c, e instanceof Error ? e : new Error(msg));
          }
        }
      }
      done++;
      opts.onProgress?.(done, claims.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { ok, failed };
}