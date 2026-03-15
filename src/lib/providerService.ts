import { supabase } from "@/integrations/supabase/client";
import type { ProviderCaseReview, ProviderDashboardStats, RecurringIssue, EvidenceReadinessItem } from "@/lib/providerTypes";

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

/**
 * Compute dashboard stats from all provider-reviewed cases in the database.
 */
export async function computeProviderDashboardStats(): Promise<ProviderDashboardStats> {
  const { data: cases, error } = await supabase
    .from("audit_cases")
    .select("id, metadata, claim_amount")
    .order("created_at", { ascending: false });

  if (error || !cases) {
    return emptyDashboardStats();
  }

  // Filter to cases with provider reviews
  const reviewed: Array<{ review: any; claimAmount: number }> = [];
  for (const c of cases) {
    const meta = c.metadata as any;
    if (meta?.providerReview) {
      reviewed.push({ review: meta.providerReview, claimAmount: Number(c.claim_amount) });
    }
  }

  if (reviewed.length === 0) return emptyDashboardStats();

  let documentationWeakCases = 0;
  let codingVulnerableCases = 0;
  let appealsNotWorthPursuing = 0;
  let estimatedAvoidableDenialCost = 0;
  const vulnerabilityCounter: Record<string, number> = {};
  const issueCategories: Record<string, { count: number; impact: 'high' | 'medium' | 'low' }> = {};

  for (const { review, claimAmount } of reviewed) {
    const docSuff = review.documentationSufficiency;
    if (docSuff === 'weak' || docSuff === 'insufficient') {
      documentationWeakCases++;
      estimatedAvoidableDenialCost += claimAmount;
    }

    if (review.codingVulnerabilities && review.codingVulnerabilities.length > 0) {
      codingVulnerableCases++;
    }

    if (review.appealAssessment?.viability === 'not-recommended') {
      appealsNotWorthPursuing++;
    }

    // Track vulnerabilities for top list
    for (const assessment of (review.documentationAssessments || [])) {
      if (assessment.status === 'weak' || assessment.status === 'insufficient') {
        const key = assessment.category;
        vulnerabilityCounter[key] = (vulnerabilityCounter[key] || 0) + 1;
      }
    }

    // Track coding vulnerabilities for recurring issues
    for (const vuln of (review.codingVulnerabilities || [])) {
      const key = `coding:${vuln.code}`;
      if (!issueCategories[key]) {
        issueCategories[key] = { count: 0, impact: vuln.severity === 'weak' || vuln.severity === 'insufficient' ? 'high' : 'medium' };
      }
      issueCategories[key].count++;
    }

    // Track denial pressure points
    for (const point of (review.denialPressurePoints || [])) {
      const key = `pressure:${point}`;
      if (!issueCategories[key]) {
        issueCategories[key] = { count: 0, impact: 'medium' };
      }
      issueCategories[key].count++;
    }
  }

  // Build top vulnerabilities (sorted by frequency)
  const topVulnerabilities = Object.entries(vulnerabilityCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Build recurring themes from doc assessments and coding vulns
  const recurringThemes = buildRecurringThemes(reviewed);

  return {
    totalCasesReviewed: reviewed.length,
    documentationWeakCases,
    codingVulnerableCases,
    appealsNotWorthPursuing,
    estimatedAvoidableDenialCost,
    staffEducationOpportunities: recurringThemes.length,
    recurringThemes,
    topVulnerabilities,
  };
}

function buildRecurringThemes(reviewed: Array<{ review: any; claimAmount: number }>): RecurringIssue[] {
  const themeMap: Map<string, { title: string; description: string; category: RecurringIssue['category']; frequency: number; impact: 'high' | 'medium' | 'low'; educationOpportunity: string }> = new Map();

  for (const { review } of reviewed) {
    for (const assessment of (review.documentationAssessments || [])) {
      if (assessment.status !== 'weak' && assessment.status !== 'insufficient') continue;
      const key = assessment.category.toLowerCase();
      const existing = themeMap.get(key);
      if (existing) {
        existing.frequency++;
      } else {
        themeMap.set(key, {
          title: assessment.category,
          description: assessment.detail || assessment.whyItMatters || '',
          category: categorizeAssessment(assessment.category),
          frequency: 1,
          impact: assessment.status === 'insufficient' ? 'high' : 'medium',
          educationOpportunity: assessment.recommendation || '',
        });
      }
    }

    for (const vuln of (review.codingVulnerabilities || [])) {
      const key = `coding-${vuln.code}`;
      const existing = themeMap.get(key);
      if (existing) {
        existing.frequency++;
      } else {
        themeMap.set(key, {
          title: `Coding Vulnerability: ${vuln.code}`,
          description: vuln.issue,
          category: 'addon-vulnerability',
          frequency: 1,
          impact: vuln.severity === 'weak' || vuln.severity === 'insufficient' ? 'high' : 'medium',
          educationOpportunity: vuln.recommendation || '',
        });
      }
    }
  }

  return Array.from(themeMap.entries())
    .sort((a, b) => b[1].frequency - a[1].frequency)
    .map(([key, theme], idx) => ({
      id: `ri-live-${idx}`,
      ...theme,
    }));
}

function categorizeAssessment(category: string): RecurringIssue['category'] {
  const lower = category.toLowerCase();
  if (lower.includes('modifier')) return 'modifier-misuse';
  if (lower.includes('time') || lower.includes('duration')) return 'time-element';
  if (lower.includes('necessity')) return 'medical-necessity';
  if (lower.includes('e/m') || lower.includes('separation')) return 'em-separation';
  if (lower.includes('add-on') || lower.includes('addon')) return 'addon-vulnerability';
  return 'documentation-gap';
}

function emptyDashboardStats(): ProviderDashboardStats {
  return {
    totalCasesReviewed: 0,
    documentationWeakCases: 0,
    codingVulnerableCases: 0,
    appealsNotWorthPursuing: 0,
    estimatedAvoidableDenialCost: 0,
    staffEducationOpportunities: 0,
    recurringThemes: [],
    topVulnerabilities: [],
  };
}
