import { supabase } from "@/integrations/supabase/client";

export type RecoveryLensId =
  | "hcc"
  | "cdi"
  | "counterfactual"
  | "modifier"
  | "bundling"
  | "contract"
  | "clawback_exposure"
  | "policy_time"
  | "supply";

export const LENS_LABELS: Record<RecoveryLensId, string> = {
  hcc: "HCC / RAF",
  cdi: "CDI",
  counterfactual: "Counterfactual",
  modifier: "Modifier",
  bundling: "Bundling",
  contract: "Contract",
  clawback_exposure: "Clawback Exposure",
  policy_time: "Policy Time",
  supply: "Supply / Implant",
};

export const CATEGORY_LABELS: Record<string, string> = {
  "pre-bill": "Pre-bill",
  "bill-vs-contract": "Bill vs Contract",
  "post-pay": "Post-pay",
  "operational": "Operational",
};

export interface RecoveryRun {
  id: string;
  user_id: string;
  batch_id: string | null;
  patient_ref: string | null;
  payer: string | null;
  date_of_service: string | null;
  encounter_excerpt: string | null;
  lenses_run: string[];
  total_dollars_at_risk: number;
  total_dollars_recoverable: number;
  status: string;
  error: string | null;
  notes: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface RecoveryFinding {
  id: string;
  run_id: string;
  user_id: string;
  lens: RecoveryLensId;
  category: string;
  title: string;
  description: string | null;
  evidence_snippet: string | null;
  code: string | null;
  confidence: "high" | "medium" | "low";
  dollars_at_risk: number;
  dollars_recoverable: number;
  dedup_cluster_key: string | null;
  is_primary_in_cluster: boolean;
  recommended_action: string | null;
  source_ref: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_note: string | null;
  adversarial_verdict: "kept" | "demoted" | "removed" | "pending";
  adversarial_note: string | null;
  adversarial_checked_at: string | null;
  metadata: any;
  created_at: string;
}

export interface RecoveryBatch {
  id: string;
  user_id: string;
  label: string | null;
  status: string;
  encounter_count: number;
  completed_count: number;
  failed_count: number;
  total_dollars_at_risk: number;
  total_dollars_recoverable: number;
  metadata: any;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunRecoveryInput {
  encounter_text: string;
  patient_ref?: string | null;
  payer?: string | null;
  date_of_service?: string | null;
  lenses?: RecoveryLensId[];
  notes?: string | null;
}

export interface BatchEncounterInput {
  patient_ref?: string | null;
  encounter_text: string;
  payer?: string | null;
  date_of_service?: string | null;
  notes?: string | null;
}

export interface RunBatchInput {
  batch_label?: string;
  encounters: BatchEncounterInput[];
  lenses?: RecoveryLensId[];
  payer?: string | null;
  date_of_service?: string | null;
  concurrency?: number;
  /** If provided, encounters are appended to an existing batch instead of creating a new one. */
  batch_id?: string;
}

export async function runRecovery(input: RunRecoveryInput) {
  const { data, error } = await supabase.functions.invoke("recovery-engine", { body: input });
  if (error) throw error;
  return data as { success: boolean; run: RecoveryRun; findings: RecoveryFinding[]; lens_errors: Record<string, string> };
}

export async function runRecoveryBatch(input: RunBatchInput) {
  const { data, error } = await supabase.functions.invoke("recovery-engine", { body: input });
  if (error) throw error;
  return data as { success: boolean; mode: "batch"; batch: RecoveryBatch; runs: any[] };
}

export async function listBatches(): Promise<RecoveryBatch[]> {
  const { data, error } = await supabase
    .from("recovery_batches")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as any;
}

export async function listRunsInBatch(batchId: string): Promise<RecoveryRun[]> {
  const { data, error } = await supabase
    .from("recovery_runs")
    .select("*")
    .eq("batch_id", batchId)
    .order("total_dollars_recoverable", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function deleteBatch(id: string) {
  const { error } = await supabase.from("recovery_batches").delete().eq("id", id);
  if (error) throw error;
}

export async function listRecoveryRuns(): Promise<RecoveryRun[]> {
  const { data, error } = await supabase
    .from("recovery_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as any;
}

export async function getRecoveryRun(id: string): Promise<RecoveryRun | null> {
  const { data, error } = await supabase.from("recovery_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function listFindings(runId: string): Promise<RecoveryFinding[]> {
  const { data, error } = await supabase
    .from("recovery_findings")
    .select("*")
    .eq("run_id", runId)
    .order("dollars_recoverable", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function setFindingResolved(id: string, resolved: boolean, note?: string) {
  const { error } = await supabase
    .from("recovery_findings")
    .update({ resolved, resolved_at: resolved ? new Date().toISOString() : null, resolved_note: note || null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRecoveryRun(id: string) {
  const { error } = await supabase.from("recovery_runs").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Mark any runs in this batch that are still "running" (i.e. the edge function
 * died or timed out mid-encounter) as "failed", then recompute the batch totals
 * from the surviving completed runs so the rollup reflects reality.
 */
export async function finalizeStuckBatch(batchId: string): Promise<{
  stuckFixed: number;
  totalRecoverable: number;
  totalAtRisk: number;
  completed: number;
  failed: number;
}> {
  // 1. Flip stuck rows
  const { data: stuck, error: stuckErr } = await supabase
    .from("recovery_runs")
    .update({ status: "failed", error: "Run did not complete (timed out or worker crashed). Marked failed by finalize." })
    .eq("batch_id", batchId)
    .eq("status", "running")
    .select("id");
  if (stuckErr) throw stuckErr;

  // 2. Pull all runs in batch and recompute
  const { data: runs, error: runsErr } = await supabase
    .from("recovery_runs")
    .select("status,total_dollars_at_risk,total_dollars_recoverable")
    .eq("batch_id", batchId);
  if (runsErr) throw runsErr;

  let totalRecoverable = 0;
  let totalAtRisk = 0;
  let completed = 0;
  let failed = 0;
  for (const r of runs || []) {
    if (r.status === "completed" || r.status === "partial") {
      completed++;
      totalRecoverable += Number(r.total_dollars_recoverable || 0);
      totalAtRisk += Number(r.total_dollars_at_risk || 0);
    } else if (r.status === "failed") {
      failed++;
    }
  }

  const batchStatus = failed === 0 ? "completed" : completed === 0 ? "failed" : "partial";
  const { error: updErr } = await supabase
    .from("recovery_batches")
    .update({
      status: batchStatus,
      completed_count: completed,
      failed_count: failed,
      total_dollars_recoverable: +totalRecoverable.toFixed(2),
      total_dollars_at_risk: +totalAtRisk.toFixed(2),
    })
    .eq("id", batchId);
  if (updErr) throw updErr;

  return {
    stuckFixed: stuck?.length || 0,
    totalRecoverable,
    totalAtRisk,
    completed,
    failed,
  };
}