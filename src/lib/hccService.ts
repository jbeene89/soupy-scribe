import { supabase } from "@/integrations/supabase/client";

export interface HCCSweep {
  id: string;
  user_id: string;
  patient_ref: string;
  payer: string | null;
  plan_year: number | null;
  baseline_raf: number;
  current_raf: number;
  raf_delta: number;
  estimated_revenue_impact: number;
  benchmark_per_raf: number;
  historical_problem_list: any[];
  current_encounter_text: string | null;
  status: string;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface HCCSuspect {
  id: string;
  sweep_id: string;
  hcc_code: string | null;
  hcc_label: string;
  icd_code: string | null;
  raf_weight: number;
  estimated_dollar_impact: number;
  last_documented_date: string | null;
  status: string;
  confidence: string;
  evidence_snippet: string | null;
  recapture_recommendation: string | null;
  resolved: boolean;
  created_at: string;
}

export async function listSweeps(): Promise<HCCSweep[]> {
  const { data, error } = await supabase.from("hcc_sweeps").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function listSuspects(sweepId: string): Promise<HCCSuspect[]> {
  const { data, error } = await supabase.from("hcc_suspects").select("*").eq("sweep_id", sweepId).order("estimated_dollar_impact", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function runSweep(params: {
  patient_ref: string;
  payer?: string | null;
  plan_year?: number;
  historical_problem_list: any[];
  current_encounter_text: string;
  benchmark_per_raf?: number;
  notes?: string | null;
}): Promise<{ sweep: HCCSweep; suspects: HCCSuspect[]; summary: string }> {
  const { data, error } = await supabase.functions.invoke("hcc-sweep", { body: params });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Sweep failed");
  return data;
}

export async function deleteSweep(id: string) {
  const { error } = await supabase.from("hcc_sweeps").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleResolved(id: string, resolved: boolean) {
  const { error } = await supabase.from("hcc_suspects").update({ resolved }).eq("id", id);
  if (error) throw error;
}