import { supabase } from "@/integrations/supabase/client";

// ═══════════════════════════════════════════════════════════════
// SOUPY Engine Service — Client-side interface for all 12 engine features
// ═══════════════════════════════════════════════════════════════

export interface EngineHealth {
  engineVersion: string;
  health: {
    ghostCaseAccuracy: number | null;
    ghostCasesConfigured: number;
    calibrationAccuracy: number | null;
    calibrationSamples: number;
    stabilityRate: number | null;
    avgDriftScore: number | null;
    stabilityChecks: number;
    devilsAdvocate: {
      totalRuns: number;
      consensusSurvivedRate: number;
      reanalysisRate: number;
    } | null;
    reasoningChains: {
      totalChains: number;
      avgTokens: number;
      avgLatencyMs: number;
    } | null;
    payerProfilesLoaded: number;
    caseGraphEdges: number;
  };
  features: string[];
}

export interface GhostCaseValidation {
  accuracyScore: number;
  isCorrect: boolean;
  deviations: Array<{
    type: string;
    expected: any;
    actual: any;
    penalty: number;
  }>;
  keyTest: string;
}

export interface CalibrationResult {
  predicted: string;
  actual: string;
  deviationScore: number;
  wasCorrect: boolean;
}

export interface PhysicianProfile {
  physicianId: string;
  physicianName: string;
  totalCases: number;
  statusBreakdown: {
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
  topCodes: [string, number][];
  avgRiskScore: number;
  avgConsensusScore: number;
  rejectionRate: number;
  graphConnections: number;
  predictionAccuracy: number | null;
  riskTrend: number[];
}

export interface PayerProfile {
  id: string;
  payer_name: string;
  payer_code: string;
  denial_patterns: any[];
  appeal_success_rates: Record<string, number>;
  behavioral_notes: string;
  last_updated: string;
}

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

export interface ReasoningChain {
  id: string;
  case_id: string;
  analysis_id: string;
  role: string;
  model: string;
  raw_reasoning: string;
  token_count: number;
  latency_ms: number;
  created_at: string;
}

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

export interface DevilsAdvocateResult {
  id: string;
  case_id: string;
  consensus_before: number;
  consensus_after: number | null;
  attack_vectors: any[];
  consensus_survived: boolean;
  vulnerabilities_found: any[];
  reanalysis_triggered: boolean;
  created_at: string;
}

// ─── Engine Health Dashboard ───

export async function getEngineHealth(): Promise<EngineHealth> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "engine-health" },
  });
  if (response.error) throw new Error(response.error.message || "Failed to get engine health");
  return response.data;
}

// ─── Ghost Case Operations ───

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

export async function validateGhostCase(caseId: string, ghostCaseId: string): Promise<GhostCaseValidation> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "validate-ghost", caseId, ghostCaseId },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

// ─── Calibration ───

export async function submitCalibration(caseId: string, actualOutcome: string): Promise<CalibrationResult> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "calibrate", caseId, actualOutcome },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

// ─── Physician Profiles ───

export async function getPhysicianProfile(physicianId: string): Promise<PhysicianProfile> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "physician-profile", physicianId },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.profile;
}

// ─── Payer Profiles ───

export async function listPayerProfiles(): Promise<PayerProfile[]> {
  const response = await supabase.functions.invoke("soupy-engine", {
    body: { action: "list-payer-profiles" },
  });
  if (response.error) throw new Error(response.error.message);
  return response.data.profiles;
}

// ─── Reasoning Chains (direct DB query) ───

export async function getReasoningChains(caseId: string): Promise<ReasoningChain[]> {
  const { data, error } = await supabase
    .from("reasoning_chains")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at");
  
  if (error) throw error;
  return (data || []) as unknown as ReasoningChain[];
}

// ─── Stability Checks (direct DB query) ───

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

// ─── Devil's Advocate Results (direct DB query) ───

export async function getDevilsAdvocateResult(caseId: string): Promise<DevilsAdvocateResult | null> {
  const { data, error } = await supabase
    .from("devils_advocate_results")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error) return null;
  return data as unknown as DevilsAdvocateResult;
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
