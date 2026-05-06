import { supabase } from "@/integrations/supabase/client";

export interface PolicyTimelineCheck {
  id: string;
  user_id: string;
  case_id: string | null;
  payer: string | null;
  policy_id: string;
  policy_type: string;
  cited_policy_version: string | null;
  cited_policy_date: string | null;
  date_of_service: string;
  active_policy_version: string | null;
  active_policy_date: string | null;
  mismatch: boolean;
  severity: string;
  cited_policy_excerpt: string | null;
  active_policy_excerpt: string | null;
  diff_summary: string | null;
  recommendation: string | null;
  citations: any[];
  metadata: Record<string, any>;
  created_at: string;
}

export async function listChecks(): Promise<PolicyTimelineCheck[]> {
  const { data, error } = await supabase.from("policy_timeline_checks").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function runTimelineCheck(params: {
  case_id?: string | null;
  payer?: string | null;
  policy_id: string;
  policy_type?: string;
  date_of_service: string;
  cited_policy_version?: string | null;
  cited_policy_date?: string | null;
  cited_policy_text: string;
  active_policy_text?: string;
  active_policy_version?: string | null;
  active_policy_date?: string | null;
}): Promise<PolicyTimelineCheck> {
  const { data, error } = await supabase.functions.invoke("policy-time-machine", { body: params });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Check failed");
  return data.check;
}

export async function deleteCheck(id: string) {
  const { error } = await supabase.from("policy_timeline_checks").delete().eq("id", id);
  if (error) throw error;
}