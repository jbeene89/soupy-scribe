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