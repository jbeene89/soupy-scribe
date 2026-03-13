export type CaseStatus = 'pending' | 'in-review' | 'approved' | 'rejected' | 'appealed';
export type AuditPosture = 'payment-integrity' | 'compliance-coaching';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SeverityLevel = 'critical' | 'warning' | 'info';
export type SOUPYRole = 'builder' | 'redteam' | 'analyst' | 'breaker';
export type AIModel = 'GPT-4o' | 'GPT-4o Mini' | 'Claude 3.5' | 'Gemini Pro' | 'Gemini 2.5 Flash' | 'GPT-5 Mini' | 'Gemini 2.5 Pro';
export type EvidenceStatus = 'missing' | 'requested' | 'received' | 'na';

export interface RiskFactor {
  id: string;
  title: string;
  description: string;
  whyItMatters: string;
  evidenceToConfirm: string[];
  weight: number;
  isDeterminative: boolean;
  triggered: boolean;
}

export interface DataCompleteness {
  score: number;
  present: string[];
  missing: string[];
}

export interface RiskScore {
  level: RiskLevel;
  score: number;
  rawScore: number;
  percentile: number;
  confidence: number;
  factors: RiskFactor[];
  recommendation: string;
  dataCompleteness: DataCompleteness;
}

export interface CodeViolation {
  id: string;
  code: string;
  type: 'upcoding' | 'unbundling' | 'medical-necessity' | 'modifier-misuse' | 'duplicate';
  severity: SeverityLevel;
  description: string;
  regulationRef: string;
  defenses: RoleDefense[];
}

export interface RoleDefense {
  role: SOUPYRole;
  strategy: string;
  strengths: string[];
  weaknesses: string[];
  strength: number;
}

export interface AIRoleAnalysis {
  role: SOUPYRole;
  model: AIModel;
  status: 'analyzing' | 'complete' | 'error';
  confidence: number;
  perspectiveStatement: string;
  keyInsights: string[];
  assumptions: string[];
  violations: CodeViolation[];
  overallAssessment: string;
}

export interface AuditCase {
  id: string;
  caseNumber: string;
  patientId: string;
  physicianId: string;
  physicianName: string;
  dateOfService: string;
  dateSubmitted: string;
  createdAt?: string;
  status: CaseStatus;
  assignedTo?: string;
  cptCodes: string[];
  icdCodes: string[];
  claimAmount: number;
  riskScore: RiskScore;
  analyses: AIRoleAnalysis[];
  consensusScore: number;
  decision?: {
    outcome: CaseStatus;
    reasoning: string;
    auditor: string;
    timestamp: string;
    overrides: string[];
  };
  metadata?: CaseMetadata;
}

export interface CaseMetadata {
  dayOfWeek: string;
  timeOfDay: string;
  anesthesiaType: string;
  patientObesity: boolean;
  understaffing: boolean;
  errorsFound: number;
  upchargeAmount: number;
  procedureDuration: number;
}

export interface SOUPYConfig {
  roles: Record<SOUPYRole, AIModel>;
  executionOrder: SOUPYRole[];
}

export interface EvidenceChecklistItem {
  id: string;
  description: string;
  category: 'documentation' | 'clinical' | 'coding' | 'authorization';
  priority: 'high' | 'medium' | 'low';
  status: EvidenceStatus;
  relatedCodes?: string[];
  impactOnRisk: number;
}

export interface CodeCombinationAnalysis {
  codes: string[];
  flagReason: string;
  legitimateExplanations: string[];
  noncompliantExplanations: string[];
  requiredDocumentation: string[];
}

export interface PhysicianPattern {
  patternId: string;
  physicianId: string;
  physicianName: string;
  cptCodes: string[];
  cases: AuditCase[];
  totalCases: number;
  rejectionRate: number;
  totalClaimAmount: number;
  averageClaimAmount: number;
  dateRange: { start: string; end: string };
  insights: string[];
}

export const ROLE_META: Record<SOUPYRole, { label: string; description: string; color: string; icon: string }> = {
  builder: { label: 'Builder', description: 'Optimistic perspective — finds the best-case interpretation', color: 'role-builder', icon: 'Lightbulb' },
  redteam: { label: 'Red Team', description: 'Critical analysis — identifies weaknesses and risks', color: 'role-redteam', icon: 'ShieldAlert' },
  analyst: { label: 'Systems Analyst', description: 'Structural thinking — regulatory and systemic analysis', color: 'role-analyst', icon: 'Network' },
  breaker: { label: 'Frame Breaker', description: 'Unconventional angles — challenges assumptions', color: 'role-breaker', icon: 'Sparkles' },
};
