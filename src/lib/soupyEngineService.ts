import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════════
// SOUPY Engine v3 — Client Service Layer
// ═══════════════════════════════════════════════════════════════

// ─── Engine Health ───

export interface EngineHealth {
  engineVersion: string;
  health: {
    ghostCaseAccuracy: number | null;
    ghostCasesConfigured: number;
    goldSetAccuracy: number | null;
    goldSetCasesConfigured: number;
    calibrationAccuracy: number | null;
    calibrationSamples: number;
    stabilityRate: number | null;
    avgDriftScore: number | null;
    stabilityChecks: number;
    consensusIntegrity: {
      totalRuns: number;
      consensusSurvivedRate: number;
      reanalysisRate: number;
    } | null;
    confidenceFloorEvents: number;
    contradictionFrequency: number;
    decisionTracesStored: number;
    payerProfilesLoaded: number;
    caseGraphEdges: number;
    regulatoryFlagsActive: number;
    appealOutcomesTracked: number;
  };
  modules: string[];
}

export async function getEngineHealth(): Promise<EngineHealth> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "engine-health" },
  });
  if (response.error) throw new Error(response.error.message || "Failed to get engine health");
  return response.data;
}

// ─── Ghost Cases ───

export interface GhostCase {
  id: string;
  case_template: any;
  known_answer: any;
  difficulty: string;
  category: string;
  last_injected_at: string | null;
  times_tested: number;
  times_correct: number;
  accuracy_rate: number;
}

export async function listGhostCases(): Promise<GhostCase[]> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "list-ghost-cases" },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.ghostCases;
}

export async function injectGhostCase(ghostCaseId: string): Promise<{ caseId: string }> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "inject-ghost", ghostCaseId },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

export interface GhostCaseValidation {
  accuracyScore: number;
  isCorrect: boolean;
  deviations: Array<{ type: string; expected: any; actual: any; penalty: number }>;
  keyTest: string;
}

export async function validateGhostCase(caseId: string, ghostCaseId: string): Promise<GhostCaseValidation> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "validate-ghost", caseId, ghostCaseId },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

// ─── Gold Set Cases ───

export interface GoldSetCase {
  id: string;
  case_label: string;
  case_template: any;
  known_outcome: any;
  category: string;
  is_locked: boolean;
  last_replayed_at: string | null;
  total_replays: number;
  total_correct: number;
  accuracy_rate: number;
}

export async function listGoldSetCases(): Promise<GoldSetCase[]> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "list-gold-set-cases" },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.goldCases;
}

export async function replayGoldSetCase(goldCaseId: string): Promise<{ caseId: string }> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "replay-gold-set", goldCaseId },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

// ─── Calibration ───

export interface CalibrationResult {
  predicted: string;
  actual: string;
  deviationScore: number;
  wasCorrect: boolean;
}

export async function submitCalibration(caseId: string, actualOutcome: string): Promise<CalibrationResult> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "calibrate", caseId, actualOutcome },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

// ─── Physician Profiles ───

export interface PhysicianProfile {
  physicianId: string;
  physicianName: string;
  totalCases: number;
  statusBreakdown: { pending: number; inReview: number; approved: number; rejected: number };
  topCodes: [string, number][];
  avgRiskScore: number;
  avgConsensusScore: number;
  rejectionRate: number;
  graphConnections: number;
  predictionAccuracy: number | null;
  riskTrend: number[];
}

export async function getPhysicianProfile(physicianId: string): Promise<PhysicianProfile> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "physician-profile", physicianId },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.profile;
}

// ─── Payer Profiles ───

export interface PayerProfile {
  id: string;
  payer_name: string;
  payer_code: string;
  denial_patterns: any[];
  appeal_success_rates: Record<string, number>;
  behavioral_notes: string;
  last_updated: string;
}

export async function listPayerProfiles(): Promise<PayerProfile[]> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "list-payer-profiles" },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.profiles;
}

// ─── Decision Traces (direct DB query) ───

export interface DecisionTrace {
  id: string;
  case_id: string;
  trace_entries: Array<{
    trigger: string;
    documentationGap?: string;
    counterargumentConsidered?: string;
    evidenceSupporting?: string;
    regulationReferenced?: string;
    confidenceImpact?: string;
    sourceRole?: string;
  }>;
  final_recommendation: string;
  recommendation_rationale: string;
  confidence_at_completion: number;
  consensus_integrity_grade: string;
  created_at: string;
}

export async function getDecisionTrace(caseId: string): Promise<DecisionTrace | null> {
  const { data, error } = await supabase
    .from("decision_traces")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as unknown as DecisionTrace;
}

// ─── Evidence Sufficiency (direct DB query) ───

export interface EvidenceSufficiency {
  id: string;
  case_id: string;
  overall_score: number;
  sufficiency_for_approve: number;
  sufficiency_for_deny: number;
  sufficiency_for_info_request: number;
  sufficiency_for_appeal_defense: number;
  sufficiency_for_appeal_not_recommended: number;
  missing_evidence: Array<{ item: string; impact: string; obtainable?: boolean }>;
  is_defensible: boolean;
  is_under_supported: boolean;
  source_weights_applied: Record<string, number>;
  created_at: string;
}

export async function getEvidenceSufficiency(caseId: string): Promise<EvidenceSufficiency | null> {
  const { data, error } = await supabase
    .from("evidence_sufficiency")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as unknown as EvidenceSufficiency;
}

// ─── Contradictions (direct DB query) ───

export interface Contradiction {
  id: string;
  case_id: string;
  contradiction_type: string;
  description: string;
  explanation: string | null;
  severity: string;
  source_a: string | null;
  source_b: string | null;
  created_at: string;
}

export async function getContradictions(caseId: string): Promise<Contradiction[]> {
  const { data, error } = await supabase
    .from("contradictions")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at");
  if (error) throw error;
  return (data || []) as unknown as Contradiction[];
}

// ─── Action Pathways (direct DB query) ───

export interface ActionPathway {
  id: string;
  case_id: string;
  recommended_action: string;
  action_rationale: string;
  confidence_in_recommendation: number;
  input_factors: Record<string, any>;
  alternative_actions: Array<{ action: string; rationale: string }>;
  is_human_review_required: boolean;
  created_at: string;
}

export async function getActionPathway(caseId: string): Promise<ActionPathway | null> {
  const { data, error } = await supabase
    .from("action_pathways")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as unknown as ActionPathway;
}

// ─── Minimal Winning Packet (direct DB query) ───

export interface MinimalWinningPacket {
  id: string;
  case_id: string;
  checklist: Array<{
    item: string;
    category: string;
    priority: string;
    isMissing: boolean;
    isCurable: boolean;
    effort: string;
    impactIfObtained: string;
  }>;
  top_priority_item: string | null;
  estimated_curable_count: number;
  estimated_not_worth_chasing: number;
  created_at: string;
}

export async function getMinimalWinningPacket(caseId: string): Promise<MinimalWinningPacket | null> {
  const { data, error } = await supabase
    .from("minimal_winning_packets")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as unknown as MinimalWinningPacket;
}

// ─── Confidence Floor Events (direct DB query) ───

export interface ConfidenceFloorEvent {
  id: string;
  case_id: string;
  floor_type: string;
  threshold_value: number;
  actual_value: number;
  uncertainty_drivers: any[];
  routed_to_human: boolean;
  explanation: string;
  created_at: string;
}

export async function getConfidenceFloorEvents(caseId: string): Promise<ConfidenceFloorEvent[]> {
  const { data, error } = await supabase
    .from("confidence_floor_events")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at");
  if (error) throw error;
  return (data || []) as unknown as ConfidenceFloorEvent[];
}

// ─── Regulatory Flags ───

export interface RegulatoryFlag {
  id: string;
  case_id: string | null;
  flag_type: string;
  description: string;
  effective_date: string | null;
  source_reference: string | null;
  severity: string;
  is_active: boolean;
  created_at: string;
}

export async function getRegulatoryFlags(caseId?: string): Promise<RegulatoryFlag[]> {
  let query = supabase.from("regulatory_flags").select("*").eq("is_active", true);
  if (caseId) {
    query = query.eq("case_id", caseId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as RegulatoryFlag[];
}

export async function listAllRegulatoryFlags(): Promise<RegulatoryFlag[]> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "list-regulatory-flags" },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.flags;
}

// ─── Appeal Outcomes ───

export interface AppealOutcome {
  id: string;
  payer_code: string | null;
  denial_type: string | null;
  cpt_codes: string[];
  appeal_strategy: string;
  outcome: string;
  success_factors: any[];
  failure_factors: any[];
  notes: string | null;
  case_id: string | null;
  created_at: string;
}

export async function recordAppealOutcome(data: {
  caseId?: string;
  payerCode?: string;
  denialType?: string;
  appealStrategy: string;
  outcome: string;
  successFactors?: any[];
  failureFactors?: any[];
  notes?: string;
  cptCodes?: string[];
}): Promise<void> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "record-appeal-outcome", ...data },
  });
  if (response.error) throw new Error(response.error.message);
}

// ─── Stability Checks (direct DB query) ───

export interface StabilityCheck {
  id: string;
  case_id: string;
  run_a_output: any;
  run_b_output: any;
  drift_score: number;
  unstable_roles: string[];
  is_stable: boolean;
  created_at: string;
}

export async function getStabilityCheck(caseId: string): Promise<StabilityCheck | null> {
  const { data, error } = await supabase
    .from("stability_checks")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as unknown as StabilityCheck;
}

// ─── Code Combinations (direct DB query) ───

export interface CodeCombination {
  id: string;
  case_id: string | null;
  codes: string[];
  flag_reason: string;
  legitimate_explanations: string[];
  noncompliant_explanations: string[];
  required_documentation: string[];
  created_at: string;
}

export async function getCodeCombinations(caseId: string): Promise<CodeCombination[]> {
  const { data, error } = await supabase
    .from("code_combinations")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at");
  if (error) return [];
  return (data || []) as unknown as CodeCombination[];
}

// ─── Case Deletion ───

export async function deleteCase(caseId: string): Promise<void> {
  const { error } = await supabase
    .from("audit_cases")
    .delete()
    .eq("id", caseId);
  if (error) throw new Error(`Failed to delete case: ${error.message}`);
}

// ─── Live Pattern Analysis ───

export interface LivePhysicianPattern {
  physicianId: string;
  physicianName: string;
  totalCases: number;
  cptCodes: string[];
  rejectionRate: number;
  avgClaimAmount: number;
  avgRiskScore: number;
  cases: any[];
}

export function deriveLivePatterns(cases: any[]): LivePhysicianPattern[] {
  const byPhysician = new Map<string, any[]>();
  cases.forEach(c => {
    const existing = byPhysician.get(c.physicianId) || [];
    existing.push(c);
    byPhysician.set(c.physicianId, existing);
  });

  return Array.from(byPhysician.entries())
    .filter(([, cs]) => cs.length >= 1)
    .map(([physicianId, cs]) => {
      const rejected = cs.filter((c: any) => c.status === 'rejected').length;
      const allCodes = cs.flatMap((c: any) => c.cptCodes || []);
      const uniqueCodes = [...new Set(allCodes)];
      const avgClaim = cs.reduce((s: number, c: any) => s + (c.claimAmount || 0), 0) / cs.length;
      const avgRisk = cs.reduce((s: number, c: any) => s + (c.riskScore?.score || 0), 0) / cs.length;
      return {
        physicianId,
        physicianName: cs[0].physicianName || physicianId,
        totalCases: cs.length,
        cptCodes: uniqueCodes,
        rejectionRate: Math.round((rejected / cs.length) * 100),
        avgClaimAmount: Math.round(avgClaim),
        avgRiskScore: Math.round(avgRisk),
        cases: cs,
      };
    })
    .sort((a, b) => b.totalCases - a.totalCases);
}

// ─── Payer Profiles (direct DB query for dropdown) ───

export async function listPayerProfilesDirect(): Promise<Array<{ payer_code: string; payer_name: string }>> {
  const { data, error } = await supabase
    .from("payer_profiles")
    .select("payer_code, payer_name")
    .order("payer_name");
  if (error) return [];
  return (data || []).filter(p => p.payer_code) as Array<{ payer_code: string; payer_name: string }>;
}

// ─── Enhanced Analysis (with payer support) ───

export async function runEnhancedSOUPYAnalysis(caseId: string, payerCode?: string): Promise<{
  consensusScore: number;
  riskScore: number;
  engineFeatures: Record<string, any>;
}> {
  const response = await supabase.functions.invoke("analyze-case", {
    body: { action: "analyze", caseId, payerCode },
  });
  if (response.error) throw new Error(response.error.message || "Analysis failed");
  const data = response.data;
  if (!data?.success) throw new Error(data?.error || "Analysis failed");
  return {
    consensusScore: data.consensusScore,
    riskScore: data.riskScore,
    engineFeatures: data.engineFeatures || {},
  };
}
