import { supabase } from "@/integrations/supabase/client";
import type { PreAppealResolution } from "@/lib/preAppealTypes";

export async function runPreAppealAnalysis(caseId: string): Promise<PreAppealResolution> {
  const response = await supabase.functions.invoke("pre-appeal-analyze", {
    body: { caseId },
  });

  if (response.error) throw new Error(response.error.message || "Pre-appeal analysis failed");
  const data = response.data;
  if (!data?.success) throw new Error(data?.error || "Pre-appeal analysis failed");

  return data.resolution as PreAppealResolution;
}

export async function getStoredPreAppealResolution(caseId: string): Promise<PreAppealResolution | null> {
  const { data, error } = await supabase
    .from("audit_cases")
    .select("metadata")
    .eq("id", caseId)
    .single();

  if (error || !data) return null;
  const metadata = data.metadata as any;
  return metadata?.preAppealResolution || null;
}
