import { supabase } from "@/integrations/supabase/client";
import type { ProviderCaseReview, EvidenceReadinessItem } from "@/lib/providerTypes";

export async function submitProviderCase(sourceText: string): Promise<{ caseId: string; extracted: any }> {
  const response = await supabase.functions.invoke("provider-analyze", {
    body: { action: "submit", sourceText },
  });

  if (response.error) throw new Error(response.error.message || "Submission failed");
  const data = response.data;
  if (!data?.success) throw new Error(data?.error || "Submission failed");
  return { caseId: data.caseId, extracted: data.extracted };
}

export async function runProviderAnalysis(caseId: string): Promise<ProviderCaseReview> {
  const response = await supabase.functions.invoke("provider-analyze", {
    body: { action: "analyze", caseId },
  });

  if (response.error) throw new Error(response.error.message || "Analysis failed");
  const data = response.data;
  if (!data?.success) throw new Error(data?.error || "Analysis failed");

  const r = data.review;
  // Add IDs to evidence items
  const evidenceReadiness: EvidenceReadinessItem[] = (r.evidenceReadiness || []).map((item: any, idx: number) => ({
    ...item,
    id: `er-${caseId}-${idx}`,
  }));

  return {
    caseId,
    documentationSufficiency: r.documentationSufficiency,
    documentationAssessments: r.documentationAssessments || [],
    codingVulnerabilities: r.codingVulnerabilities || [],
    appealAssessment: r.appealAssessment,
    evidenceReadiness,
    timelineConsistency: r.timelineConsistency,
    denialPressurePoints: r.denialPressurePoints || [],
  };
}

export async function getStoredProviderReview(caseId: string): Promise<ProviderCaseReview | null> {
  const { data, error } = await supabase
    .from("audit_cases")
    .select("metadata")
    .eq("id", caseId)
    .single();

  if (error || !data) return null;
  const metadata = data.metadata as any;
  if (!metadata?.providerReview) return null;

  const r = metadata.providerReview;
  const evidenceReadiness: EvidenceReadinessItem[] = (r.evidenceReadiness || []).map((item: any, idx: number) => ({
    ...item,
    id: `er-${caseId}-${idx}`,
  }));

  return {
    caseId,
    documentationSufficiency: r.documentationSufficiency,
    documentationAssessments: r.documentationAssessments || [],
    codingVulnerabilities: r.codingVulnerabilities || [],
    appealAssessment: r.appealAssessment,
    evidenceReadiness,
    timelineConsistency: r.timelineConsistency,
    denialPressurePoints: r.denialPressurePoints || [],
  };
}
