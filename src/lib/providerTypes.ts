// Provider Readiness Mode types

export type AppMode = 'payer' | 'provider' | 'psych';

export type ReadinessLevel = 'strong' | 'moderate' | 'weak' | 'insufficient';
export type AppealViability = 'recommended' | 'conditional' | 'not-recommended';

export interface DocumentationAssessment {
  category: string;
  status: ReadinessLevel;
  detail: string;
  whyItMatters: string;
  recommendation: string;
}

export interface CodingVulnerability {
  code: string;
  issue: string;
  severity: ReadinessLevel;
  recommendation: string;
  isCorrectible: boolean;
}

export interface AppealAssessment {
  viability: AppealViability;
  estimatedSuccessRate: number;
  estimatedEffortHours: number;
  strengths: string[];
  weaknesses: string[];
  missingSupport: string[];
  recommendedAction: 'do-not-appeal' | 'gather-records' | 'recode-resubmit' | 'seek-compliance-review' | 'educate-staff';
  actionRationale: string;
}

export interface EvidenceReadinessItem {
  id: string;
  record: string;
  category: 'required' | 'helpful' | 'unlikely-to-help';
  status: 'present' | 'missing' | 'partial';
  whyItMatters: string;
  whatItSupports: string;
  essentialForAppeal: boolean;
  materiallyImproves: boolean;
}

// ─── Enhanced: Root Cause + Remediation Types ───

export type RootCause =
  | 'physician_documentation'
  | 'coder_interpretation'
  | 'missing_modifier_support'
  | 'missing_operative_detail'
  | 'missing_time_logs'
  | 'insufficient_medical_necessity'
  | 'workflow_gap'
  | 'template_deficiency';

export type RemediationType =
  | 'training'
  | 'workflow'
  | 'template'
  | 'coding_review'
  | 'policy_change'
  | 'specialist_escalation';

export type PatternSeverity =
  | 'high_operational_risk'
  | 'medium_recurring_weakness'
  | 'low_informational';

export interface RecurringIssue {
  id: string;
  category: 'modifier-misuse' | 'documentation-gap' | 'time-element' | 'medical-necessity' | 'em-separation' | 'addon-vulnerability';
  title: string;
  description: string;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  educationOpportunity: string;
  // Enhanced fields
  rootCause?: RootCause;
  remediationType?: RemediationType;
  patternSeverity?: PatternSeverity;
  estimatedDenialImpact?: number;
  whyItMatters?: string;
  suggestedRemediation?: string;
  fixUpstreamInstead?: boolean;
}

export interface RecommendedIntervention {
  id: string;
  title: string;
  description: string;
  type: RemediationType;
  typeLabel: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  affectedPatterns: string[];
  estimatedImpact: string;
  implementationEffort: 'low' | 'medium' | 'high';
}

export interface CorrectablePattern {
  id: string;
  title: string;
  casesAffected: number;
  estimatedRevenue: number;
  isCorrectible: boolean;
  correctiveAction: string;
  rootCause: RootCause;
}

export interface HighRiskBehavior {
  id: string;
  title: string;
  description: string;
  casesAffected: number;
  riskLevel: PatternSeverity;
  suggestedAction: string;
}

export interface ProviderCaseReview {
  caseId: string;
  documentationSufficiency: ReadinessLevel;
  documentationAssessments: DocumentationAssessment[];
  codingVulnerabilities: CodingVulnerability[];
  appealAssessment: AppealAssessment;
  evidenceReadiness: EvidenceReadinessItem[];
  timelineConsistency: ReadinessLevel;
  denialPressurePoints: string[];
}

export interface ProviderDashboardStats {
  totalCasesReviewed: number;
  documentationWeakCases: number;
  codingVulnerableCases: number;
  appealsNotWorthPursuing: number;
  estimatedAvoidableDenialCost: number;
  staffEducationOpportunities: number;
  recurringThemes: RecurringIssue[];
  topVulnerabilities: string[];
  // Enhanced
  correctablePatterns: CorrectablePattern[];
  highRiskBehaviors: HighRiskBehavior[];
  recommendedInterventions: RecommendedIntervention[];
  avoidableDenialBreakdown: {
    documentationGaps: number;
    codingErrors: number;
    modifierIssues: number;
    timeDocumentation: number;
  };
}
