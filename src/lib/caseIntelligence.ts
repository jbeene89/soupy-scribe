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
    label: 'Supportable as Documented',
    description: 'Available documentation and evidence appear sufficient to sustain this claim.',
    colorClass: 'text-consensus',
    bgClass: 'bg-consensus/10',
    borderClass: 'border-consensus/30',
  },
  curable_with_documentation: {
    label: 'Requires Supporting Documentation',
    description: 'Specific records or clarifications could resolve identified evidentiary gaps.',
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
    label: 'Analyst Review Required',
    description: 'Automated analysis cannot render a confident determination — manual review is necessary.',
    colorClass: 'text-violation',
    bgClass: 'bg-violation/10',
    borderClass: 'border-violation/30',
  },
  not_defensible: {
    label: 'Unlikely to Sustain on Appeal',
    description: 'Structural compliance concerns make this claim unlikely to withstand appeal review.',
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
  /** Composite review complexity for queue display — never shows "Low" when analyses indicate issues */
  reviewComplexity: { level: 'routine' | 'moderate' | 'complex' | 'critical'; label: string; colorClass: string };
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
  else if (consensusScore >= 50) consensusLabel = 'Moderate Agreement';
  else consensusLabel = 'High Divergence';

  const confidence = auditCase.riskScore?.confidence || 0;
  let confidenceLabel: string;
  if (confidence >= 85) confidenceLabel = 'High Confidence';
  else if (confidence >= 65) confidenceLabel = 'Moderate Confidence';
  else if (confidence >= 45) confidenceLabel = 'Low Confidence';
  else confidenceLabel = 'Very Low Confidence';

  // ─── Review Complexity ───
  // Composite metric that never shows "routine" when real issues exist
  const reviewComplexity = computeReviewComplexity(auditCase, {
    violationCount: allViolations.length,
    criticalViolationCount: criticalViolations.length,
    humanReviewTriggered: humanReview.triggered,
    disposition: disposition.disposition,
  });

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
    reviewComplexity,
  };
}

function computeReviewComplexity(
  auditCase: AuditCase,
  ctx: {
    violationCount: number;
    criticalViolationCount: number;
    humanReviewTriggered: boolean;
    disposition: CaseDisposition;
  }
): CaseSummarySignals['reviewComplexity'] {
  const riskScore = auditCase.riskScore?.score || 0;
  const hasAnalyses = auditCase.analyses.length > 0;

  // Critical: human review required OR not defensible OR critical risk w/ critical violations
  if (ctx.humanReviewTriggered || ctx.disposition === 'not_defensible') {
    return { level: 'critical', label: 'Critical', colorClass: 'text-violation' };
  }
  if (riskScore >= 80 && ctx.criticalViolationCount > 0) {
    return { level: 'critical', label: 'Critical', colorClass: 'text-violation' };
  }

  // Complex: high risk, or multiple violations, or low consensus w/ analyses
  if (riskScore >= 65 || (ctx.violationCount >= 2 && hasAnalyses) || 
      (auditCase.consensusScore < 60 && hasAnalyses)) {
    return { level: 'complex', label: 'Complex', colorClass: 'text-disagreement' };
  }

  // Moderate: medium risk or has some violations
  if (riskScore >= 40 || ctx.violationCount > 0) {
    return { level: 'moderate', label: 'Moderate', colorClass: 'text-info-blue' };
  }

  // Routine: only if genuinely low risk with no issues
  return { level: 'routine', label: 'Routine', colorClass: 'text-consensus' };
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

// ─── Dynamic Evidence Checklist Generation ───

export type EvidenceImpactTier = 'critical' | 'supporting' | 'low_value';

export function classifyEvidenceImpact(item: EvidenceChecklistItem): EvidenceImpactTier {
  if (item.priority === 'high' && item.impactOnRisk >= 8) return 'critical';
  if (item.priority === 'high' || (item.priority === 'medium' && item.impactOnRisk >= 5)) return 'supporting';
  return 'low_value';
}

export function isEvidenceLikelyCurable(item: EvidenceChecklistItem): boolean {
  const curableCategories = ['documentation', 'authorization'];
  const curablePriorities = ['high', 'medium'];
  return curableCategories.includes(item.category) && curablePriorities.includes(item.priority);
}

/**
 * Generates a dynamic evidence checklist from case-specific data instead of
 * static mock arrays. Uses violations, risk factors, and missing documentation
 * to build a contextual, prioritized evidence list.
 */
export function generateDynamicEvidenceChecklist(auditCase: AuditCase): EvidenceChecklistItem[] {
  const items: EvidenceChecklistItem[] = [];
  let idx = 0;

  // 1. From missing documentation in riskScore.dataCompleteness
  const missingDocs = auditCase.riskScore?.dataCompleteness.missing || [];
  const presentDocs = auditCase.riskScore?.dataCompleteness.present || [];

  missingDocs.forEach(doc => {
    const isCriticalDoc = doc.toLowerCase().includes('operative note') ||
      doc.toLowerCase().includes('time log') || doc.toLowerCase().includes('time documentation') ||
      doc.toLowerCase().includes('medical necessity');
    items.push({
      id: `dyn-miss-${idx++}`,
      description: doc,
      category: 'documentation',
      priority: isCriticalDoc ? 'high' : 'medium',
      status: 'missing',
      relatedCodes: [],
      impactOnRisk: isCriticalDoc ? 20 : 10,
    });
  });

  // 2. From risk factors — extract evidenceToConfirm
  const factors = auditCase.riskScore?.factors.filter(f => f.triggered) || [];
  factors.forEach(factor => {
    factor.evidenceToConfirm.forEach(ev => {
      // Avoid duplicating items already from missing docs
      if (items.some(i => i.description.toLowerCase() === ev.toLowerCase())) return;
      items.push({
        id: `dyn-factor-${idx++}`,
        description: ev,
        category: factor.isDeterminative ? 'clinical' : 'documentation',
        priority: factor.isDeterminative ? 'high' : 'medium',
        status: 'missing',
        relatedCodes: auditCase.cptCodes.slice(0, 2),
        impactOnRisk: factor.isDeterminative ? factor.weight : Math.min(factor.weight, 10),
      });
    });
  });

  // 3. From violations — specific evidence needed
  const violations = auditCase.analyses.flatMap(a => a.violations);
  violations.forEach(v => {
    const description = `Documentation supporting ${v.code} — ${v.type.replace(/-/g, ' ')} defense`;
    if (items.some(i => i.description === description)) return;
    items.push({
      id: `dyn-viol-${idx++}`,
      description,
      category: 'coding',
      priority: v.severity === 'critical' ? 'high' : 'medium',
      status: 'missing',
      relatedCodes: [v.code],
      impactOnRisk: v.severity === 'critical' ? 25 : 12,
    });
  });

  // 4. Mark present items
  presentDocs.forEach(doc => {
    items.push({
      id: `dyn-pres-${idx++}`,
      description: doc,
      category: 'documentation',
      priority: 'low',
      status: 'received',
      relatedCodes: [],
      impactOnRisk: 2,
    });
  });

  // Sort: missing critical first, then supporting, then received
  items.sort((a, b) => {
    const statusOrder = { missing: 0, requested: 1, received: 2, na: 3 };
    const prioOrder = { high: 0, medium: 1, low: 2 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return prioOrder[a.priority] - prioOrder[b.priority];
  });

  return items;
}

// ─── Structured Export Package ───

export interface StructuredExportPackage {
  meta: {
    caseNumber: string;
    physicianName: string;
    physicianId: string;
    patientId: string;
    dateOfService: string;
    claimAmount: number;
    cptCodes: string[];
    icdCodes: string[];
    exportDate: string;
    packageStatus: string;
  };
  riskAssessment: {
    score: number;
    level: string;
    confidence: number;
    dataCompleteness: number;
    recommendation: string;
  };
  consensusAnalysis: {
    score: number;
    label: string;
    dispositionLabel: string;
    dispositionCategory: string;
    humanReviewRequired: boolean;
    humanReviewReasons: string[];
  };
  violations: {
    code: string;
    type: string;
    severity: string;
    description: string;
    regulationRef: string;
    bestDefenseStrength: number;
    bestDefenseStrategy: string;
    defenseStrengths: string[];
    failurePoints: string[];
  }[];
  evidenceStatus: {
    present: string[];
    missing: string[];
    completenessScore: number;
  };
  actionRecommendation: {
    action: string;
    rationale: string;
    confidence: number;
  };
  exportReadiness: {
    status: string;
    label: string;
    missingItems: string[];
  };
}

export function buildStructuredExportPackage(
  auditCase: AuditCase,
  signals: CaseSummarySignals,
  exportReadiness: ExportReadinessResult,
  actionPath?: { action: string; rationale: string; confidence: number } | null,
): StructuredExportPackage {
  const violations = auditCase.analyses.flatMap(a => a.violations);

  return {
    meta: {
      caseNumber: auditCase.caseNumber,
      physicianName: auditCase.physicianName,
      physicianId: auditCase.physicianId,
      patientId: auditCase.patientId,
      dateOfService: auditCase.dateOfService,
      claimAmount: auditCase.claimAmount,
      cptCodes: auditCase.cptCodes,
      icdCodes: auditCase.icdCodes,
      exportDate: new Date().toISOString(),
      packageStatus: exportReadiness.label,
    },
    riskAssessment: {
      score: signals.riskScore,
      level: signals.riskLevel,
      confidence: signals.confidence,
      dataCompleteness: signals.dataCompleteness,
      recommendation: auditCase.riskScore?.recommendation || '',
    },
    consensusAnalysis: {
      score: signals.consensusScore,
      label: signals.consensusLabel,
      dispositionLabel: signals.disposition.label,
      dispositionCategory: signals.disposition.disposition,
      humanReviewRequired: signals.humanReview.triggered,
      humanReviewReasons: signals.humanReview.reasons,
    },
    violations: violations.map(v => {
      const best = v.defenses?.reduce((b, d) => d.strength > b.strength ? d : b, { strength: 0, strategy: '', strengths: [] as string[], weaknesses: [] as string[] });
      return {
        code: v.code,
        type: v.type,
        severity: v.severity,
        description: v.description,
        regulationRef: v.regulationRef,
        bestDefenseStrength: best?.strength || 0,
        bestDefenseStrategy: best?.strategy || '',
        defenseStrengths: best?.strengths || [],
        failurePoints: best?.weaknesses || [],
      };
    }),
    evidenceStatus: {
      present: auditCase.riskScore?.dataCompleteness.present || [],
      missing: auditCase.riskScore?.dataCompleteness.missing || [],
      completenessScore: signals.dataCompleteness,
    },
    actionRecommendation: actionPath || { action: 'pending', rationale: 'Action recommendation pending analysis.', confidence: 0 },
    exportReadiness: {
      status: exportReadiness.status,
      label: exportReadiness.label,
      missingItems: exportReadiness.missingItems,
    },
  };
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
