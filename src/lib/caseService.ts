import { supabase } from "@/integrations/supabase/client";
import type { AuditCase, AIRoleAnalysis, RiskScore, CaseStatus } from "@/lib/types";

// Transform DB row to app type
function dbCaseToAuditCase(row: any): AuditCase {
  const riskScore: RiskScore = row.risk_score && Object.keys(row.risk_score).length > 0
    ? {
        level: row.risk_score.level || 'medium',
        score: row.risk_score.score || 0,
        rawScore: row.risk_score.rawScore || 0,
        percentile: row.risk_score.percentile || 0,
        confidence: row.risk_score.confidence || 0,
        recommendation: row.risk_score.recommendation || '',
        dataCompleteness: row.risk_score.dataCompleteness || { score: 0, present: [], missing: [] },
        factors: row.risk_score.factors || [],
      }
    : {
        // Default for cases without a computed risk score — use "medium" not "low"
        // to avoid misleading Low(0) in queue for unscored cases
        level: 'medium',
        score: 0,
        rawScore: 0,
        percentile: 0,
        confidence: 0,
        recommendation: 'Risk score pending — run SOUPY analysis for full assessment.',
        dataCompleteness: { score: 0, present: [], missing: [] },
        factors: [],
      };

  return {
    id: row.id,
    caseNumber: row.case_number,
    patientId: row.patient_id,
    physicianId: row.physician_id,
    physicianName: row.physician_name,
    dateOfService: row.date_of_service,
    dateSubmitted: row.date_submitted,
    createdAt: row.created_at,
    status: row.status,
    assignedTo: row.assigned_to || undefined,
    cptCodes: row.cpt_codes || [],
    icdCodes: row.icd_codes || [],
    claimAmount: Number(row.claim_amount),
    consensusScore: row.consensus_score || 0,
    riskScore,
    analyses: [],
    decision: row.decision || undefined,
    metadata: row.metadata || undefined,
    bodyRegion: row.body_region || undefined,
    linkedCaseId: row.linked_case_id || undefined,
  };
}

function dbAnalysisToRoleAnalysis(row: any): AIRoleAnalysis {
  // Transform violations from DB format to app format (add defenses array)
  const violations = (row.violations || []).map((v: any, idx: number) => ({
    id: `v-${row.id}-${idx}`,
    code: v.code,
    type: v.type,
    severity: v.severity,
    description: v.description,
    regulationRef: v.regulationRef,
    defenses: v.defenses || [],
  }));

  return {
    role: row.role,
    model: row.model,
    status: row.status,
    confidence: row.confidence || 0,
    perspectiveStatement: row.perspective_statement || '',
    keyInsights: row.key_insights || [],
    assumptions: row.assumptions || [],
    violations,
    overallAssessment: row.overall_assessment || '',
  };
}

export async function fetchCases(): Promise<AuditCase[]> {
  const { data: cases, error } = await supabase
    .from("audit_cases")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!cases || cases.length === 0) return [];

  // Fetch analyses for all cases
  const caseIds = cases.map(c => c.id);
  const { data: analyses } = await supabase
    .from("case_analyses")
    .select("*")
    .in("case_id", caseIds);

  const analysesByCase = new Map<string, AIRoleAnalysis[]>();
  (analyses || []).forEach(a => {
    const existing = analysesByCase.get(a.case_id) || [];
    existing.push(dbAnalysisToRoleAnalysis(a));
    analysesByCase.set(a.case_id, existing);
  });

  return cases.map(c => {
    const auditCase = dbCaseToAuditCase(c);
    auditCase.analyses = analysesByCase.get(c.id) || [];
    return auditCase;
  });
}

export async function fetchCase(caseId: string): Promise<AuditCase | null> {
  const { data: row, error } = await supabase
    .from("audit_cases")
    .select("*")
    .eq("id", caseId)
    .single();

  if (error || !row) return null;

  const { data: analyses } = await supabase
    .from("case_analyses")
    .select("*")
    .eq("case_id", caseId);

  const auditCase = dbCaseToAuditCase(row);
  auditCase.analyses = (analyses || []).map(dbAnalysisToRoleAnalysis);
  return auditCase;
}

export async function submitCaseText(sourceText: string): Promise<{ caseId: string; extracted: any }> {
  const response = await supabase.functions.invoke("analyze-case", {
    body: { action: "extract", sourceText },
  });

  if (response.error) throw new Error(response.error.message || "Extraction failed");
  
  const data = response.data;
  if (!data?.success) throw new Error(data?.error || "Extraction failed");

  return { caseId: data.case.id, extracted: data.extracted };
}

export async function runSOUPYAnalysis(caseId: string, payerCode?: string): Promise<{ consensusScore: number; riskScore: number }> {
  // Phase 1: Run primary 4-role analysis (with optional payer adversarial tuning)
  const response = await supabase.functions.invoke("analyze-case", {
    body: { action: "analyze", caseId, payerCode },
  });

  if (response.error) throw new Error(response.error.message || "Analysis failed");
  
  const data = response.data;
  if (!data?.success) throw new Error(data?.error || "Analysis failed");

  // Phase 2: Run v3 modules (drift, consensus integrity, evidence sufficiency, etc.)
  try {
    const v3Response = await supabase.functions.invoke("analyze-v3", {
      body: { caseId },
    });

    if (v3Response.error) {
      console.error("V3 modules failed (non-fatal):", v3Response.error.message);
    } else if (v3Response.data?.success) {
      // Use updated scores from v3 if available
      return {
        consensusScore: v3Response.data.consensusScore ?? data.consensusScore,
        riskScore: v3Response.data.riskScore ?? data.riskScore,
      };
    }
  } catch (v3Err) {
    console.error("V3 module chain failed (non-fatal):", v3Err);
  }

  return { consensusScore: data.consensusScore, riskScore: data.riskScore };
}

export async function getProcessingStatus(caseId: string) {
  const { data } = await supabase
    .from("processing_queue")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data;
}

// ─── Decision Persistence ───

export interface AuditDecision {
  outcome: CaseStatus;
  reasoning: string;
  auditor: string;
  timestamp: string;
  overrides: string[];
}

export async function saveDecision(
  caseId: string,
  decision: AuditDecision
): Promise<void> {
  const newStatus = decision.outcome === 'approved' ? 'approved'
    : decision.outcome === 'rejected' ? 'rejected'
    : 'in-review'; // info-requested keeps it in review

  const { error } = await supabase
    .from("audit_cases")
    .update({
      decision: decision as any,
      status: newStatus,
    })
    .eq("id", caseId);

  if (error) throw new Error(`Failed to save decision: ${error.message}`);
}
