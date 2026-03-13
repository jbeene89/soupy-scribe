/**
 * Case Intelligence Module
 * 
 * Centralized logic for deriving consistent case status, classifications,
 * human review gating, and action recommendations from raw case data.
 * 
 * Every component that displays case status MUST use this module to ensure
 * internal consistency across all views.
 */

import type { AuditCase, RiskScore, EvidenceChecklistItem } from './types';
import type {
  EvidenceSufficiency, Contradiction, ActionPathway,
  ConfidenceFloorEvent, DecisionTrace,
} from './soupyEngineService';

// ─── Curable vs Non-Curable Classification ───

export type CaseDisposition =
  | 'defensible_now'
  | 'curable_with_documentation'
  | 'admin_fix_only'
  | 'human_review_required'
  | 'not_defensible';

export interface CaseDispositionResult {
  disposition: CaseDisposition;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

const DISPOSITION_CONFIG: Record<CaseDisposition, Omit<CaseDispositionResult, 'disposition'>> = {
  defensible_now: {
    label: 'Defensible Now',
    description: 'Current documentation and evidence sufficiently support this claim.',
    colorClass: 'text-consensus',
    bgClass: 'bg-consensus/10',
    borderClass: 'border-consensus/30',
  },
  curable_with_documentation: {
    label: 'Curable with Additional Documentation',
    description: 'Specific records or clarifications can resolve identified gaps.',
    colorClass: 'text-disagreement',
    bgClass: 'bg-disagreement/10',
    borderClass: 'border-disagreement/30',
  },
  admin_fix_only: {
    label: 'Administrative Fix Only',
    description: 'Issues are clerical or coding corrections, not clinical deficiencies.',
    colorClass: 'text-info-blue',
    bgClass: 'bg-info-blue/10',
    borderClass: 'border-info-blue/30',
  },
  human_review_required: {
    label: 'Human Review Required',
    description: 'Automated analysis cannot render a confident determination for this case.',
    colorClass: 'text-violation',
    bgClass: 'bg-violation/10',
    borderClass: 'border-violation/30',
  },
  not_defensible: {
    label: 'Not Defensible on Appeal',
    description: 'Structural issues make this case unlikely to survive appeal review.',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
  },
};

// ─── Human Review Gating ───

export interface HumanReviewTrigger {
  triggered: boolean;
  reasons: string[];
}

export function evaluateHumanReviewGating(
  auditCase: AuditCase,
  opts?: {
    contradictions?: Contradiction[];
    evidenceSuff?: EvidenceSufficiency | null;
    floorEvents?: ConfidenceFloorEvent[];
    actionPathway?: ActionPathway | null;
  }
): HumanReviewTrigger {
  const reasons: string[] = [];

  // 1. High divergence across SOUPY voices
  if (auditCase.consensusScore < 50) {
    reasons.push('High divergence across AI analysis models (consensus < 50%)');
  }

  // 2. Low confidence
  if (auditCase.riskScore?.confidence < 60) {
    reasons.push(`Low analysis confidence (${auditCase.riskScore.confidence}%)`);
  }

  // 3. High contradiction burden
  const criticalContradictions = (opts?.contradictions || []).filter(c => c.severity === 'critical');
  if (criticalContradictions.length >= 2) {
    reasons.push(`${criticalContradictions.length} critical contradictions identified`);
  }

  // 4. Low evidence sufficiency
  if (opts?.evidenceSuff && opts.evidenceSuff.overall_score < 40) {
    reasons.push(`Evidence sufficiency critically low (${Math.round(opts.evidenceSuff.overall_score)}%)`);
  }

  // 5. Confidence floor breach
  if (opts?.floorEvents && opts.floorEvents.length > 0) {
    reasons.push('Confidence floor breached — automated determination unreliable');
  }

  // 6. Action pathway itself flags human review
  if (opts?.actionPathway?.is_human_review_required) {
    reasons.push('Engine action pathway requires human review');
  }

  // 7. Critical risk + low data completeness
  if (auditCase.riskScore?.level === 'critical' && auditCase.riskScore.dataCompleteness.score < 65) {
    reasons.push('Critical risk level with incomplete data');
  }

  // 8. Multiple determinative risk factors triggered with low consensus
  const deterFactors = auditCase.riskScore?.factors.filter(f => f.isDeterminative && f.triggered) || [];
  if (deterFactors.length >= 2 && auditCase.consensusScore < 60) {
    reasons.push(`${deterFactors.length} determinative risk factors triggered with model disagreement`);
  }

  return {
    triggered: reasons.length > 0,
    reasons,
  };
}

// ─── Case Disposition Classification ───

export function classifyDisposition(
  auditCase: AuditCase,
  opts?: {
    contradictions?: Contradiction[];
    evidenceSuff?: EvidenceSufficiency | null;
    floorEvents?: ConfidenceFloorEvent[];
  }
): CaseDispositionResult {
  const humanReview = evaluateHumanReviewGating(auditCase, opts);
  
  // Check if human review is required first
  if (humanReview.triggered && humanReview.reasons.length >= 3) {
    return { disposition: 'human_review_required', ...DISPOSITION_CONFIG.human_review_required };
  }

  const riskScore = auditCase.riskScore?.score || 0;
  const confidence = auditCase.riskScore?.confidence || 0;
  const dataCompleteness = auditCase.riskScore?.dataCompleteness.score || 0;
  const evidenceScore = opts?.evidenceSuff?.overall_score || 0;
  const contradictionCount = opts?.contradictions?.length || 0;
  const criticalContradictions = (opts?.contradictions || []).filter(c => c.severity === 'critical').length;
  const allViolations = auditCase.analyses.flatMap(a => a.violations);
  const criticalViolations = allViolations.filter(v => v.severity === 'critical');

  // Not defensible: high risk + critical violations + low defense strength
  if (criticalViolations.length >= 2 && riskScore >= 80) {
    const avgDefense = criticalViolations.reduce((sum, v) => {
      const best = v.defenses?.reduce((b, d) => d.strength > b.strength ? d : b, { strength: 0 });
      return sum + (best?.strength || 0);
    }, 0) / criticalViolations.length;
    if (avgDefense < 35) {
      return { disposition: 'not_defensible', ...DISPOSITION_CONFIG.not_defensible };
    }
  }

  // Human review: multiple triggers
  if (humanReview.triggered) {
    return { disposition: 'human_review_required', ...DISPOSITION_CONFIG.human_review_required };
  }

  // Admin fix: only warnings, no critical issues, high data completeness
  const onlyWarnings = allViolations.every(v => v.severity !== 'critical');
  if (onlyWarnings && allViolations.length > 0 && riskScore < 50 && dataCompleteness >= 75) {
    return { disposition: 'admin_fix_only', ...DISPOSITION_CONFIG.admin_fix_only };
  }

  // Curable: medium risk, missing docs but obtainable
  if (riskScore >= 40 && dataCompleteness < 80) {
    return { disposition: 'curable_with_documentation', ...DISPOSITION_CONFIG.curable_with_documentation };
  }

  // Defensible: low-medium risk, good data, high consensus
  if (riskScore < 50 && auditCase.consensusScore >= 70 && confidence >= 70) {
    return { disposition: 'defensible_now', ...DISPOSITION_CONFIG.defensible_now };
  }

  // Default to curable for medium cases
  if (riskScore < 70) {
    return { disposition: 'curable_with_documentation', ...DISPOSITION_CONFIG.curable_with_documentation };
  }

  return { disposition: 'human_review_required', ...DISPOSITION_CONFIG.human_review_required };
}

// ─── Synchronized Case Summary ───

export interface CaseSummarySignals {
  riskLevel: string;
  riskScore: number;
  consensusLabel: string;
  consensusScore: number;
  confidenceLabel: string;
  confidence: number;
  violationCount: number;
  criticalViolationCount: number;
  dataCompleteness: number;
  disposition: CaseDispositionResult;
  humanReview: HumanReviewTrigger;
  hasAnalyses: boolean;
  isAnalyzing: boolean;
}

export function deriveCaseSignals(
  auditCase: AuditCase,
  opts?: {
    contradictions?: Contradiction[];
    evidenceSuff?: EvidenceSufficiency | null;
    floorEvents?: ConfidenceFloorEvent[];
    actionPathway?: ActionPathway | null;
  }
): CaseSummarySignals {
  const allViolations = auditCase.analyses.flatMap(a => a.violations);
  const criticalViolations = allViolations.filter(v => v.severity === 'critical');

  const humanReview = evaluateHumanReviewGating(auditCase, opts);
  const disposition = classifyDisposition(auditCase, opts);

  const consensusScore = auditCase.consensusScore;
  let consensusLabel: string;
  if (consensusScore >= 90) consensusLabel = 'Strong Agreement';
  else if (consensusScore >= 75) consensusLabel = 'Majority Agreement';
  else if (consensusScore >= 50) consensusLabel = 'Split Opinion';
  else consensusLabel = 'High Divergence';

  const confidence = auditCase.riskScore?.confidence || 0;
  let confidenceLabel: string;
  if (confidence >= 85) confidenceLabel = 'High Confidence';
  else if (confidence >= 65) confidenceLabel = 'Moderate Confidence';
  else if (confidence >= 45) confidenceLabel = 'Low Confidence';
  else confidenceLabel = 'Very Low Confidence';

  return {
    riskLevel: auditCase.riskScore?.level || 'medium',
    riskScore: auditCase.riskScore?.score || 0,
    consensusLabel,
    consensusScore,
    confidenceLabel,
    confidence,
    violationCount: allViolations.length,
    criticalViolationCount: criticalViolations.length,
    dataCompleteness: auditCase.riskScore?.dataCompleteness.score || 0,
    disposition,
    humanReview,
    hasAnalyses: auditCase.analyses.length > 0,
    isAnalyzing: auditCase.analyses.some(a => a.status === 'analyzing'),
  };
}

// ─── Export Readiness ───

export type ExportReadiness = 'ready' | 'conditional' | 'incomplete' | 'not_ready';

export interface ExportReadinessResult {
  status: ExportReadiness;
  label: string;
  description: string;
  colorClass: string;
  missingItems: string[];
}

export function evaluateExportReadiness(
  auditCase: AuditCase,
  opts?: {
    evidenceSuff?: EvidenceSufficiency | null;
    contradictions?: Contradiction[];
  }
): ExportReadinessResult {
  const missingItems: string[] = [];
  const violations = auditCase.analyses.flatMap(a => a.violations);

  if (violations.length === 0 && auditCase.analyses.length > 0) {
    missingItems.push('No violations to build appeal against');
  }

  const missingData = auditCase.riskScore?.dataCompleteness.missing || [];
  if (missingData.length > 2) {
    missingItems.push(`${missingData.length} documentation items still missing`);
  }

  if (opts?.evidenceSuff && opts.evidenceSuff.overall_score < 50) {
    missingItems.push('Evidence sufficiency below appeal threshold');
  }

  const criticalContradictions = (opts?.contradictions || []).filter(c => c.severity === 'critical');
  if (criticalContradictions.length > 0) {
    missingItems.push(`${criticalContradictions.length} unresolved critical contradiction(s)`);
  }

  const avgDefenseStrength = violations.length > 0
    ? violations.reduce((sum, v) => {
        const best = v.defenses?.reduce((b, d) => d.strength > b.strength ? d : b, { strength: 0 });
        return sum + (best?.strength || 0);
      }, 0) / violations.length
    : 0;

  if (avgDefenseStrength < 30 && violations.length > 0) {
    missingItems.push('Average defense strength too low for viable appeal');
  }

  if (missingItems.length === 0) {
    return { status: 'ready', label: 'Ready for Export', description: 'Package contains sufficient evidence and analysis for submission.', colorClass: 'text-consensus', missingItems };
  }
  if (missingItems.length <= 2 && avgDefenseStrength >= 40) {
    return { status: 'conditional', label: 'Conditional — Awaiting Records', description: 'Package can be exported but key items should be obtained first.', colorClass: 'text-disagreement', missingItems };
  }
  if (missingItems.length <= 3) {
    return { status: 'incomplete', label: 'Incomplete', description: 'Significant gaps exist. Export for internal review only.', colorClass: 'text-violation', missingItems };
  }
  return { status: 'not_ready', label: 'Not Ready for Submission', description: 'Package has critical gaps that must be resolved before export.', colorClass: 'text-destructive', missingItems };
}

// ─── Evidence Impact Tiers ───

export type EvidenceImpactTier = 'critical' | 'supporting' | 'low_value';

export function classifyEvidenceImpact(item: EvidenceChecklistItem): EvidenceImpactTier {
  if (item.priority === 'high' && item.impactOnRisk >= 8) return 'critical';
  if (item.priority === 'high' || (item.priority === 'medium' && item.impactOnRisk >= 5)) return 'supporting';
  return 'low_value';
}

export function isEvidenceLikelyCurable(item: EvidenceChecklistItem): boolean {
  // Records that are typically obtainable
  const curableCategories = ['documentation', 'authorization'];
  const curablePriorities = ['high', 'medium'];
  return curableCategories.includes(item.category) && curablePriorities.includes(item.priority);
}

// ─── Action Path Display ───

export const ACTION_PATH_CONFIG: Record<string, {
  label: string;
  shortLabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: string;
}> = {
  approve: {
    label: 'Approve Claim',
    shortLabel: 'Approve',
    colorClass: 'text-consensus',
    bgClass: 'bg-consensus/10',
    borderClass: 'border-consensus/30',
    icon: 'CheckCircle',
  },
  pend_for_records: {
    label: 'Pend for Additional Records',
    shortLabel: 'Pend',
    colorClass: 'text-disagreement',
    bgClass: 'bg-disagreement/10',
    borderClass: 'border-disagreement/30',
    icon: 'Clock',
  },
  modifier_clarification: {
    label: 'Request Modifier Clarification',
    shortLabel: 'Clarify',
    colorClass: 'text-info-blue',
    bgClass: 'bg-info-blue/10',
    borderClass: 'border-info-blue/30',
    icon: 'HelpCircle',
  },
  admin_correction: {
    label: 'Administrative Correction Only',
    shortLabel: 'Admin Fix',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted',
    borderClass: 'border-muted',
    icon: 'FileText',
  },
  route_to_human: {
    label: 'Route to Human Audit',
    shortLabel: 'Human Review',
    colorClass: 'text-violation',
    bgClass: 'bg-violation/10',
    borderClass: 'border-violation/30',
    icon: 'AlertTriangle',
  },
  build_pre_appeal: {
    label: 'Build Pre-Appeal Packet',
    shortLabel: 'Pre-Appeal',
    colorClass: 'text-accent',
    bgClass: 'bg-accent/10',
    borderClass: 'border-accent/30',
    icon: 'Shield',
  },
  not_recommended_for_appeal: {
    label: 'Not Recommended for Appeal',
    shortLabel: 'No Appeal',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
    icon: 'XCircle',
  },
};

// ─── Derive action path from case data (for mock/non-live cases) ───

export function deriveActionPath(auditCase: AuditCase, opts?: {
  evidenceSuff?: EvidenceSufficiency | null;
  contradictions?: Contradiction[];
}): { action: string; rationale: string; confidence: number } {
  const signals = deriveCaseSignals(auditCase, opts);

  if (signals.disposition.disposition === 'not_defensible') {
    return {
      action: 'not_recommended_for_appeal',
      rationale: `${signals.criticalViolationCount} critical violations with low defense strength. Documentation gaps are structurally significant.`,
      confidence: 75,
    };
  }

  if (signals.humanReview.triggered) {
    return {
      action: 'route_to_human',
      rationale: signals.humanReview.reasons.slice(0, 2).join('. ') + '.',
      confidence: 60,
    };
  }

  if (signals.riskScore < 30 && signals.consensusScore >= 80) {
    return {
      action: 'approve',
      rationale: 'Low risk with strong model consensus and sufficient documentation.',
      confidence: 85,
    };
  }

  if (signals.dataCompleteness < 70) {
    return {
      action: 'pend_for_records',
      rationale: `Data completeness at ${signals.dataCompleteness}%. Key documentation needed before determination.`,
      confidence: 70,
    };
  }

  if (signals.disposition.disposition === 'admin_fix_only') {
    return {
      action: 'admin_correction',
      rationale: 'Issues identified are administrative in nature and do not affect clinical validity.',
      confidence: 78,
    };
  }

  if (signals.riskScore >= 70) {
    return {
      action: 'route_to_human',
      rationale: `Risk score ${signals.riskScore}/100 with ${signals.violationCount} violation(s). Complex case requires human review.`,
      confidence: 65,
    };
  }

  return {
    action: 'pend_for_records',
    rationale: 'Additional records recommended to strengthen determination.',
    confidence: 60,
  };
}
