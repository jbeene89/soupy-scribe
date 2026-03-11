// Provider Readiness Mode types

export type AppMode = 'payer' | 'provider';

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

export interface RecurringIssue {
  id: string;
  category: 'modifier-misuse' | 'documentation-gap' | 'time-element' | 'medical-necessity' | 'em-separation' | 'addon-vulnerability';
  title: string;
  description: string;
  frequency: number; // how many cases affected
  impact: 'high' | 'medium' | 'low';
  educationOpportunity: string;
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
}
