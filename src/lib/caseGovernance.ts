/**
 * Case Governance Module
 * 
 * Separates and formalizes the following decision-layer concepts:
 *   1. Claim Risk Score — aggregate case-level risk
 *   2. Finding Severity — per-violation severity with metadata guards
 *   3. Automation Confidence — engine's confidence in its own output
 *   4. Evidence Sufficiency — completeness of supporting documentation
 *   5. Consensus Integrity — cross-model agreement quality
 *   6. Final Recommended Action — synthesized from all of the above
 * 
 * Key rules:
 *   - Findings dependent on missing metadata CANNOT be "critical confirmed"
 *   - Contradictions reduce consensus integrity and automation confidence
 *   - Transparent routing logic with plain-language explanations
 */

import type { AuditCase, CodeViolation, SeverityLevel } from './types';
import type { Contradiction, EvidenceSufficiency, ConfidenceFloorEvent } from './soupyEngineService';

// ─── Governed Severity Classification ───

export type GovernedSeverity =
  | 'critical_confirmed'
  | 'critical_pending_verification'
  | 'high_risk_documentation_gap'
  | 'needs_payer_entity_validation'
  | 'documentation_deficiency'
  | 'warning'
  | 'info';

export interface GovernedFinding {
  violation: CodeViolation;
  originalSeverity: SeverityLevel;
  governedSeverity: GovernedSeverity;
  governedLabel: string;
  downgradeReason: string | null;
  dependsOnMissingMetadata: boolean;
  metadataDependencies: string[];
}

const METADATA_DEPENDENT_KEYWORDS = [
  'separate tin', 'separate billing entity', 'billing entity',
  'missing mar', 'medication administration record',
  'missing consultant note', 'consultant note', 'consult note',
  'missing operative note', 'operative note', 'op note',
  'time log', 'time documentation', 'anesthesia record',
  'separate npi', 'separate provider', 'modifier documentation',
  'medical necessity documentation', 'prior authorization',
  'implant manifest', 'implant log', 'device log',
  'pathology report', 'lab results',
];

function detectMetadataDependencies(violation: CodeViolation, missingDocs: string[]): string[] {
  const deps: string[] = [];
  const descLower = violation.description.toLowerCase();
  const allDefenseText = violation.defenses
    .flatMap(d => [...d.strengths, ...d.weaknesses, d.strategy])
    .join(' ')
    .toLowerCase();
  const combinedText = `${descLower} ${allDefenseText}`;

  for (const keyword of METADATA_DEPENDENT_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      deps.push(keyword);
    }
  }

  // Cross-check with actually missing documentation
  for (const doc of missingDocs) {
    const docLower = doc.toLowerCase();
    if (combinedText.includes(docLower) && !deps.includes(docLower)) {
      deps.push(doc);
    }
  }

  return [...new Set(deps)];
}

function hasDirectRuleConflict(violation: CodeViolation): boolean {
  // A finding has direct rule conflict if it references specific regulations
  // AND has evidence-based defenses with measurable strength
  const hasRegRef = violation.regulationRef && violation.regulationRef.length > 5;
  const hasStrongEvidence = violation.defenses.some(d => d.strength >= 60);
  const isSpecificType = ['unbundling', 'upcoding', 'duplicate'].includes(violation.type);
  return !!(hasRegRef && (hasStrongEvidence || isSpecificType));
}

export function classifyFindingSeverity(
  violation: CodeViolation,
  missingDocs: string[],
  evidenceScore: number,
): GovernedFinding {
  const deps = detectMetadataDependencies(violation, missingDocs);
  const dependsOnMissing = deps.length > 0;
  const originalSeverity = violation.severity;

  // Rule: only findings with direct rule conflict AND sufficient evidence
  // can be marked as confirmed critical errors
  if (originalSeverity === 'critical') {
    if (dependsOnMissing) {
      // Determine the most appropriate downgrade
      if (deps.some(d => d.includes('billing entity') || d.includes('tin') || d.includes('npi') || d.includes('payer'))) {
        return {
          violation, originalSeverity, dependsOnMissingMetadata: true,
          metadataDependencies: deps,
          governedSeverity: 'needs_payer_entity_validation',
          governedLabel: 'Entity Validation Required',
          downgradeReason: `Finding depends on unverified entity or payer data: ${deps.join(', ')}. Cannot confirm severity without validation.`,
        };
      }
      if (evidenceScore < 50) {
        return {
          violation, originalSeverity,
          dependsOnMissingMetadata: true,
          metadataDependencies: deps,
          governedSeverity: 'high_risk_documentation_gap',
          governedLabel: 'Documentation Insufficient to Sustain',
          downgradeReason: `Evidence sufficiency at ${Math.round(evidenceScore)}% with unresolved metadata dependencies: ${deps.join(', ')}. Insufficient to confirm critical severity.`,
        };
      }
      return {
        violation, originalSeverity, dependsOnMissingMetadata: true,
        metadataDependencies: deps,
        governedSeverity: 'critical_pending_verification',
        governedLabel: 'High-Risk — Pending Verification',
        downgradeReason: `Finding flagged as critical but depends on: ${deps.join(', ')}. Requires verification before confirmed status.`,
      };
    }

    // No missing metadata dependency — check for direct rule conflict
    if (hasDirectRuleConflict(violation)) {
      return {
        violation, originalSeverity, dependsOnMissingMetadata: false,
        metadataDependencies: [],
        governedSeverity: 'critical_confirmed',
        governedLabel: 'Confirmed — Strong Rule Conflict',
        downgradeReason: null,
      };
    }

    // Critical without direct rule conflict → pending verification
    return {
      violation, originalSeverity, dependsOnMissingMetadata: false,
      metadataDependencies: [],
      governedSeverity: 'critical_pending_verification',
      governedLabel: 'High-Risk — Pending Verification',
      downgradeReason: 'Finding lacks direct regulatory reference or sufficient evidence strength to confirm as a strong rule conflict.',
    };
  }

  if (originalSeverity === 'warning' && dependsOnMissing) {
    return {
      violation, originalSeverity, dependsOnMissingMetadata: true,
      metadataDependencies: deps,
      governedSeverity: 'documentation_deficiency',
      governedLabel: 'Documentation Deficiency',
      downgradeReason: `Warning finding depends on missing metadata: ${deps.join(', ')}.`,
    };
  }

  return {
    violation, originalSeverity, dependsOnMissingMetadata: dependsOnMissing,
    metadataDependencies: deps,
    governedSeverity: originalSeverity as GovernedSeverity,
    governedLabel: originalSeverity === 'warning' ? 'Warning' : 'Informational',
    downgradeReason: null,
  };
}

// ─── Contradiction-Aware Downgrade Mechanism ───

export interface ContradictionDowngrade {
  consensusIntegrityReduction: number;
  automationConfidenceReduction: number;
  mandatoryHumanReview: boolean;
  explanations: string[];
}

export function computeContradictionDowngrade(
  contradictions: Contradiction[],
  evidenceScore: number,
  baseConsensus: number,
): ContradictionDowngrade {
  const explanations: string[] = [];
  let consensusReduction = 0;
  let confidenceReduction = 0;
  let mandatoryHuman = false;

  const criticalCount = contradictions.filter(c => c.severity === 'critical').length;
  const warningCount = contradictions.filter(c => c.severity !== 'critical').length;

  // Rule: If perspectives disagree materially, lower consensus integrity
  if (criticalCount > 0) {
    consensusReduction += criticalCount * 12;
    confidenceReduction += criticalCount * 8;
    explanations.push(
      `${criticalCount} critical contradiction(s) detected between analysis perspectives — consensus integrity reduced by ${criticalCount * 12} points.`
    );
  }

  if (warningCount > 0) {
    consensusReduction += warningCount * 5;
    confidenceReduction += warningCount * 3;
    explanations.push(
      `${warningCount} material disagreement(s) between perspectives — automation confidence reduced by ${warningCount * 3} points.`
    );
  }

  // Rule: contradictions + low evidence = mandatory human review
  if (contradictions.length > 0 && evidenceScore < 50) {
    mandatoryHuman = true;
    explanations.push(
      `Contradictions present with evidence sufficiency below 50% (${Math.round(evidenceScore)}%) — mandatory human review triggered.`
    );
  }

  // Rule: high contradiction burden alone triggers human review
  if (criticalCount >= 2) {
    mandatoryHuman = true;
    explanations.push(
      `${criticalCount} critical contradictions exceed threshold — automated determination unreliable.`
    );
  }

  // Additional: low consensus after reduction
  const effectiveConsensus = Math.max(0, baseConsensus - consensusReduction);
  if (effectiveConsensus < 40 && contradictions.length > 0) {
    mandatoryHuman = true;
    explanations.push(
      `Effective consensus integrity at ${effectiveConsensus}% after contradiction adjustments — below automation floor.`
    );
  }

  return {
    consensusIntegrityReduction: consensusReduction,
    automationConfidenceReduction: confidenceReduction,
    mandatoryHumanReview: mandatoryHuman,
    explanations,
  };
}

// ─── Governance Assessment (Full) ───

export interface GovernanceAssessment {
  // Separated concepts
  claimRiskScore: number;
  claimRiskLevel: string;
  automationConfidence: number;
  automationConfidenceLabel: string;
  evidenceSufficiency: number;
  consensusIntegrity: number;
  consensusIntegrityLabel: string;

  // Governed findings
  governedFindings: GovernedFinding[];
  confirmedCriticalCount: number;
  pendingVerificationCount: number;
  documentationGapCount: number;

  // Contradiction downgrades
  contradictionDowngrade: ContradictionDowngrade;

  // Routing decision
  routingDecision: RoutingDecision;
}

export interface RoutingDecision {
  outcome: 'automated_approve' | 'automated_review' | 'human_audit' | 'escalate';
  outcomeLabel: string;
  factors: RoutingFactor[];
}

export interface RoutingFactor {
  signal: string;
  value: string;
  status: 'pass' | 'warn' | 'fail';
  explanation: string;
}

const ROUTING_THRESHOLDS = {
  evidenceSufficiencyFloor: 50,
  consensusIntegrityFloor: 45,
  automationConfidenceFloor: 55,
  maxContradictionsForAuto: 1,
  maxPendingCriticalsForAuto: 1,
};

export function assessGovernance(
  auditCase: AuditCase,
  opts?: {
    contradictions?: Contradiction[];
    evidenceSuff?: EvidenceSufficiency | null;
    floorEvents?: ConfidenceFloorEvent[];
  }
): GovernanceAssessment {
  const contradictions = opts?.contradictions || [];
  const evidenceScore = opts?.evidenceSuff?.overall_score || 0;
  const missingDocs = auditCase.riskScore?.dataCompleteness.missing || [];

  // 1. Classify all findings
  const allViolations = auditCase.analyses.flatMap(a => a.violations);
  const governedFindings = allViolations.map(v =>
    classifyFindingSeverity(v, missingDocs, evidenceScore)
  );

  const confirmedCriticalCount = governedFindings.filter(f => f.governedSeverity === 'critical_confirmed').length;
  const pendingVerificationCount = governedFindings.filter(f =>
    f.governedSeverity === 'critical_pending_verification' ||
    f.governedSeverity === 'high_risk_documentation_gap' ||
    f.governedSeverity === 'needs_payer_entity_validation'
  ).length;
  const documentationGapCount = governedFindings.filter(f =>
    f.governedSeverity === 'documentation_deficiency' ||
    f.governedSeverity === 'high_risk_documentation_gap'
  ).length;

  // 2. Contradiction downgrades
  const contradictionDowngrade = computeContradictionDowngrade(
    contradictions, evidenceScore, auditCase.consensusScore
  );

  // 3. Compute separated metrics
  const claimRiskScore = auditCase.riskScore?.score || 0;
  const claimRiskLevel = auditCase.riskScore?.level || 'medium';

  const baseConfidence = auditCase.riskScore?.confidence || 50;
  const automationConfidence = Math.max(0, baseConfidence - contradictionDowngrade.automationConfidenceReduction);
  const automationConfidenceLabel =
    automationConfidence >= 80 ? 'High' :
    automationConfidence >= 60 ? 'Moderate' :
    automationConfidence >= 40 ? 'Low' : 'Very Low';

  const consensusIntegrity = Math.max(0, auditCase.consensusScore - contradictionDowngrade.consensusIntegrityReduction);
  const consensusIntegrityLabel =
    consensusIntegrity >= 85 ? 'Strong' :
    consensusIntegrity >= 70 ? 'Adequate' :
    consensusIntegrity >= 50 ? 'Moderate' : 'Weak';

  // 4. Routing decision
  const factors: RoutingFactor[] = [];

  // Evidence sufficiency
  const evPass = evidenceScore >= ROUTING_THRESHOLDS.evidenceSufficiencyFloor;
  factors.push({
    signal: 'Evidence Sufficiency',
    value: `${Math.round(evidenceScore)}%`,
    status: evPass ? 'pass' : evidenceScore >= 35 ? 'warn' : 'fail',
    explanation: evPass
      ? 'Documentation meets minimum threshold for automated processing.'
      : `Below ${ROUTING_THRESHOLDS.evidenceSufficiencyFloor}% threshold — insufficient documentation for automated determination.`,
  });

  // Consensus integrity
  const ciPass = consensusIntegrity >= ROUTING_THRESHOLDS.consensusIntegrityFloor;
  factors.push({
    signal: 'Consensus Integrity',
    value: `${consensusIntegrity}% (${consensusIntegrityLabel})`,
    status: ciPass ? 'pass' : consensusIntegrity >= 30 ? 'warn' : 'fail',
    explanation: ciPass
      ? 'Analysis models show adequate agreement after contradiction adjustments.'
      : `Consensus integrity at ${consensusIntegrity}% after ${contradictions.length} contradiction adjustment(s) — below automation floor.`,
  });

  // Contradictions
  const contPass = contradictions.length <= ROUTING_THRESHOLDS.maxContradictionsForAuto;
  factors.push({
    signal: 'Contradictions',
    value: `${contradictions.length} found`,
    status: contPass ? 'pass' : contradictions.some(c => c.severity === 'critical') ? 'fail' : 'warn',
    explanation: contPass
      ? 'Contradiction burden within acceptable range.'
      : `${contradictions.length} contradiction(s) detected between analysis perspectives.`,
  });

  // Automation confidence
  const acPass = automationConfidence >= ROUTING_THRESHOLDS.automationConfidenceFloor;
  factors.push({
    signal: 'Automation Confidence',
    value: `${automationConfidence}% (${automationConfidenceLabel})`,
    status: acPass ? 'pass' : automationConfidence >= 35 ? 'warn' : 'fail',
    explanation: acPass
      ? 'Engine confidence supports automated processing.'
      : `Automation confidence at ${automationConfidence}% — below ${ROUTING_THRESHOLDS.automationConfidenceFloor}% floor.`,
  });

  // Pending criticals
  const pcPass = pendingVerificationCount <= ROUTING_THRESHOLDS.maxPendingCriticalsForAuto;
  factors.push({
    signal: 'Unverified Critical Findings',
    value: `${pendingVerificationCount}`,
    status: pcPass ? 'pass' : 'warn',
    explanation: pcPass
      ? 'All critical findings are confirmed or within threshold.'
      : `${pendingVerificationCount} finding(s) pending verification — severity cannot be confirmed without additional metadata.`,
  });

  // Confidence floor breaches
  const floorBreached = (opts?.floorEvents?.length || 0) > 0;
  if (floorBreached) {
    factors.push({
      signal: 'Confidence Floor',
      value: 'Breached',
      status: 'fail',
      explanation: 'One or more confidence floors were breached — automated determination unreliable.',
    });
  }

  // Determine outcome
  const failCount = factors.filter(f => f.status === 'fail').length;
  const warnCount = factors.filter(f => f.status === 'warn').length;

  let outcome: RoutingDecision['outcome'];
  let outcomeLabel: string;

  if (contradictionDowngrade.mandatoryHumanReview || failCount >= 2 || floorBreached) {
    outcome = 'human_audit';
    outcomeLabel = 'Route to Analyst Review';
  } else if (failCount >= 1 || warnCount >= 3) {
    outcome = 'escalate';
    outcomeLabel = 'Escalate for Senior Review';
  } else if (warnCount >= 1) {
    outcome = 'automated_review';
    outcomeLabel = 'Automated Processing with Flags';
  } else {
    outcome = 'automated_approve';
    outcomeLabel = 'Eligible for Automated Processing';
  }

  return {
    claimRiskScore,
    claimRiskLevel,
    automationConfidence,
    automationConfidenceLabel,
    evidenceSufficiency: evidenceScore,
    consensusIntegrity,
    consensusIntegrityLabel,
    governedFindings,
    confirmedCriticalCount,
    pendingVerificationCount,
    documentationGapCount,
    contradictionDowngrade,
    routingDecision: { outcome, outcomeLabel, factors },
  };
}

// ─── Severity Badge Config ───

export const GOVERNED_SEVERITY_CONFIG: Record<GovernedSeverity, {
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  critical_confirmed: {
    label: 'Confirmed — Strong Rule Conflict',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
  },
  critical_pending_verification: {
    label: 'High-Risk — Pending Verification',
    colorClass: 'text-violation',
    bgClass: 'bg-violation/10',
    borderClass: 'border-violation/30',
  },
  high_risk_documentation_gap: {
    label: 'Documentation Insufficient to Sustain',
    colorClass: 'text-disagreement',
    bgClass: 'bg-disagreement/10',
    borderClass: 'border-disagreement/30',
  },
  needs_payer_entity_validation: {
    label: 'Entity Validation Required',
    colorClass: 'text-info-blue',
    bgClass: 'bg-info-blue/10',
    borderClass: 'border-info-blue/30',
  },
  documentation_deficiency: {
    label: 'Documentation Deficiency',
    colorClass: 'text-disagreement',
    bgClass: 'bg-disagreement/10',
    borderClass: 'border-disagreement/30',
  },
  warning: {
    label: 'Warning',
    colorClass: 'text-disagreement',
    bgClass: 'bg-disagreement/10',
    borderClass: 'border-disagreement/30',
  },
  info: {
    label: 'Informational',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/30',
    borderClass: 'border-muted',
  },
};
