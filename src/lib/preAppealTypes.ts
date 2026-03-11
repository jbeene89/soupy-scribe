// Pre-Appeal Resolution types

export type CurabilityStatus =
  | 'curable-with-records'
  | 'curable-with-coding'
  | 'partial-resolution'
  | 'structurally-weak'
  | 'formal-appeal-appropriate'
  | 'not-likely-supportable';

export type ResolutionLikelihood =
  | 'likely-resolvable-clarification'
  | 'likely-resolvable-records'
  | 'partially-resolvable'
  | 'weak-candidate'
  | 'requires-formal-appeal'
  | 'not-supportable';

export type IssueCategory =
  | 'missing-documentation'
  | 'documentation-contradiction'
  | 'coding-clarification'
  | 'modifier-support'
  | 'medical-necessity'
  | 'timeline-mismatch'
  | 'likely-non-curable'
  | 'likely-formal-appeal'
  | 'administrative-correction';

export type PayerResponseType =
  | 'resolved-pay-as-submitted'
  | 'resolved-partial'
  | 'additional-records-needed'
  | 'clarification-needed'
  | 'uphold-denial'
  | 'route-to-formal-appeal'
  | 'escalate-compliance';

export type RecommendedDisposition =
  | 'submit-pre-appeal'
  | 'gather-more-records'
  | 'correct-and-resubmit'
  | 'pursue-formal-appeal'
  | 'do-not-pursue'
  | 'escalate-internally';

export interface DenialIssue {
  id: string;
  category: IssueCategory;
  title: string;
  description: string;
  isCurable: boolean;
  clarificationNeeded: string;
  supportingEvidence: string[];
}

export interface ResolutionAssessment {
  likelihood: ResolutionLikelihood;
  confidence: number; // 0-100
  whatIsMissing: string[];
  whatWouldChangeResult: string[];
}

export interface RapidResolutionItem {
  id: string;
  record: string;
  priority: 'required' | 'helpful' | 'unlikely-to-change-outcome';
  whyItMatters: string;
  linkedIssueCategory: IssueCategory;
  supportsQuickReconsideration: boolean;
  absencePushesToAppeal: boolean;
}

export interface ProviderSubmission {
  issueSummary: string;
  codingExplanation: string;
  supportingDocChecklist: string[];
  chronologyClarification: string;
  medicalNecessityClarification: string;
  coverNote: string;
}

export interface PayerResponse {
  type: PayerResponseType;
  rationale: string;
  missingItems: string[];
  reconsiderationNeeded: string;
  formalAppealLikely: boolean;
}

export interface PreAppealResolution {
  caseId: string;
  denialReason: string;
  curability: CurabilityStatus;
  issues: DenialIssue[];
  resolution: ResolutionAssessment;
  evidenceChecklist: RapidResolutionItem[];
  recommendedDisposition: RecommendedDisposition;
  providerSummary: {
    whyResolvableQuickly: string;
    exactlyNeeded: string[];
    doNotWasteTimeOn: string[];
    appearsCurable: boolean;
    fullAppealPoorUse: boolean;
  };
  payerSummary: {
    issueAppearsCurable: boolean;
    clarificationNeeded: string[];
    partialReversalPossible: boolean;
    denialStandsWithoutSupport: boolean;
    moveToStandardAppeal: boolean;
  };
  payerResponse?: PayerResponse;
  providerSubmission?: ProviderSubmission;
}
