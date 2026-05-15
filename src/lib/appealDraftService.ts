import { supabase } from "@/integrations/supabase/client";
import { extractEdgeError } from "@/lib/edgeErrors";
import type { SOUPYRole } from "@/lib/types";

export interface AppealDraft {
  violationId: string;
  code: string;
  type: string;
  severity: string;
  description: string;
  regulationRef?: string;
  letterBody: string;
  roleRationales: Record<SOUPYRole, string>;
  supportingEvidence: string[];
  rebuttalToPayer: string;
  confidence: number;
  keyAuthorities: string[];
  generatedAt: string;
}

export interface AppealDraftsBundle {
  drafts: Record<string, AppealDraft>;
  generatedAt: string;
  caseNumber: string;
}

export async function generateAppealDrafts(
  caseId: string,
  opts: { regenerate?: boolean; violationIds?: string[] } = {},
): Promise<AppealDraftsBundle> {
  const response = await supabase.functions.invoke("generate-appeal-drafts", {
    body: { caseId, regenerate: !!opts.regenerate, violationIds: opts.violationIds },
  });
  if (response.error || !response.data?.success) {
    throw new Error(await extractEdgeError(response, "Appeal draft generation failed"));
  }
  return response.data.appealDrafts as AppealDraftsBundle;
}

export async function getStoredAppealDrafts(caseId: string): Promise<AppealDraftsBundle | null> {
  const { data, error } = await supabase
    .from("audit_cases")
    .select("metadata")
    .eq("id", caseId)
    .single();
  if (error || !data) return null;
  const md = data.metadata as any;
  return md?.appealDrafts || null;
}