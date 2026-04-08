/**
 * Defense Packet Builder
 *
 * Generates a structured, defense-ready claim support packet from
 * existing case findings, violations, evidence, and governance data.
 *
 * This is an ADDITIVE layer — it consumes existing findings and
 * produces actionable support requirements without altering them.
 */

import type { AuditCase, CodeViolation, EvidenceChecklistItem } from './types';
import type { EvidenceSufficiency, Contradiction, MinimalWinningPacket } from './soupyEngineService';
import {
  classifyFindingSeverity,
  type GovernedFinding,
  type GovernedSeverity,
} from './caseGovernance';
import {
  classifyEvidenceImpact,
  isEvidenceLikelyCurable,
  generateDynamicEvidenceChecklist,
} from './caseIntelligence';

// ─── Support Item Classification ───

export type SupportClassification =
  | 'required_to_defend'
  | 'supporting_strengthens'
  | 'low_value_not_worth_chasing'
  | 'human_review_required'
  | 'not_curable_consider_downgrade';

export type Obtainability = 'likely_obtainable' | 'possibly_obtainable' | 'unlikely' | 'unknown';
export type Curability = 'curable' | 'partially_curable' | 'not_curable';

export interface DefenseSupportItem {
  id: string;
  /** Code(s) or issue this support item relates to */
  relatedCodes: string[];
  /** The finding or issue this supports */
  issueDescription: string;
  /** What documentation would support the billed code */
  requiredDocumentation: string;
  /** What is currently missing */
  missingEvidence: string;
  /** Classification */
  classification: SupportClassification;
  classificationLabel: string;
  /** Priority */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Estimated impact on defense strength if obtained (0-100) */
  estimatedImpact: number;
  estimatedImpactLabel: string;
  /** Obtainability */
  obtainability: Obtainability;
  obtainabilityLabel: string;
  /** Curability */
  curability: Curability;
  curabilityLabel: string;
  /** Suggested next step */
  suggestedNextStep: string;
  /** Whether this should delay case resolution */
  shouldDelayResolution: boolean;
  /** Source — where this item was derived from */
  source: 'violation' | 'risk_factor' | 'evidence_gap' | 'engine_packet' | 'governance';
}

// ─── Claim Disposition ───

export type ClaimDisposition =
  | 'defend_as_billed'
  | 'defend_with_packet'
  | 'downgrade_resubmit'
  | 'route_to_human'
  | 'appeal_not_recommended';

export interface DefensePacketSummary {
  /** Overall recommended disposition */
  disposition: ClaimDisposition;
  dispositionLabel: string;
  dispositionDescription: string;

  /** Key billed services at risk */
  servicesAtRisk: ServiceAtRisk[];

  /** All support items sorted by impact */
  supportItems: DefenseSupportItem[];

  /** Breakdown counts */
  requiredCount: number;
  supportingCount: number;
  lowValueCount: number;
  notCurableCount: number;
  humanReviewCount: number;

  /** Aggregate metrics */
  overallDefenseStrength: number; // 0-100
  curedIfObtainedEstimate: number; // percentage of items that could cure findings
  notWorthChasingItems: DefenseSupportItem[];

  /** Cautious language summary */
  summaryNotes: string[];
}

export interface ServiceAtRisk {
  code: string;
  description: string;
  riskLevel: 'high' | 'medium' | 'low';
  missingDocCount: number;
  primaryGap: string;
  recommendedAttachments: string[];
}

// ─── Classification Config ───

const CLASSIFICATION_CONFIG: Record<SupportClassification, { label: string; colorClass: string; bgClass: string; borderClass: string }> = {
  required_to_defend: {
    label: 'Required — Essential to Sustain Claim',
    colorClass: 'text-violation',
    bgClass: 'bg-violation/10',
    borderClass: 'border-violation/30',
  },
  supporting_strengthens: {
    label: 'Supporting — Strengthens Position',
    colorClass: 'text-info-blue',
    bgClass: 'bg-info-blue/10',
    borderClass: 'border-info-blue/30',
  },
  low_value_not_worth_chasing: {
    label: 'Low-Recovery Value',
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/30',
    borderClass: 'border-muted',
  },
  human_review_required: {
    label: 'Requires Analyst Determination',
    colorClass: 'text-disagreement',
    bgClass: 'bg-disagreement/10',
    borderClass: 'border-disagreement/30',
  },
  not_curable_consider_downgrade: {
    label: 'Non-Curable — Consider Service Adjustment',
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/30',
  },
};

export { CLASSIFICATION_CONFIG };

// ─── Core Builder Functions ───

function estimateObtainability(description: string, category: string): Obtainability {
  const descLower = description.toLowerCase();

  // Likely obtainable: standard clinical docs
  const likelyPatterns = [
    'operative note', 'op note', 'progress note', 'discharge summary',
    'consent form', 'pre-op assessment', 'post-op note', 'nursing note',
    'lab results', 'pathology report', 'radiology report', 'vitals',
    'medication administration', 'mar', 'anesthesia record', 'time log',
  ];
  if (likelyPatterns.some(p => descLower.includes(p))) return 'likely_obtainable';

  // Possibly obtainable: external or older records
  const possiblyPatterns = [
    'consultant note', 'referral', 'prior authorization', 'payer',
    'billing entity', 'tin', 'npi', 'modifier documentation',
    'implant manifest', 'device log', 'manufacturer',
  ];
  if (possiblyPatterns.some(p => descLower.includes(p))) return 'possibly_obtainable';

  // Unlikely: systemic or structural issues
  const unlikelyPatterns = [
    'separate provider', 'intent', 'clinical judgment', 'medical necessity determination',
    'real-time documentation', 'contemporaneous', 'face-to-face time',
  ];
  if (unlikelyPatterns.some(p => descLower.includes(p))) return 'unlikely';

  // Default based on category
  if (category === 'documentation' || category === 'authorization') return 'likely_obtainable';
  if (category === 'clinical') return 'possibly_obtainable';
  return 'unknown';
}

function estimateCurability(
  violation: CodeViolation | null,
  obtainability: Obtainability,
  governedSeverity?: GovernedSeverity,
): Curability {
  // Not curable: direct rule conflicts with sufficient evidence
  if (governedSeverity === 'critical_confirmed') return 'not_curable';
  if (violation?.type === 'duplicate') return 'not_curable';

  // Curable: documentation gaps with obtainable evidence
  if (obtainability === 'likely_obtainable') {
    if (governedSeverity === 'documentation_deficiency' ||
        governedSeverity === 'high_risk_documentation_gap' ||
        governedSeverity === 'critical_pending_verification') {
      return 'curable';
    }
    return 'curable';
  }

  if (obtainability === 'possibly_obtainable') return 'partially_curable';
  if (obtainability === 'unlikely') return 'not_curable';

  // Default for warnings/info
  if (!violation || violation.severity === 'info') return 'partially_curable';
  return 'partially_curable';
}

function classifySupportItem(
  impact: number,
  curability: Curability,
  obtainability: Obtainability,
  isConfirmedCritical: boolean,
): SupportClassification {
  // Not curable + confirmed critical → consider downgrade
  if (curability === 'not_curable' && isConfirmedCritical) {
    return 'not_curable_consider_downgrade';
  }

  // Not curable + unlikely → low value
  if (curability === 'not_curable' && obtainability === 'unlikely') {
    return 'low_value_not_worth_chasing';
  }

  // High impact + curable → required to defend
  if (impact >= 60 && curability === 'curable') {
    return 'required_to_defend';
  }

  // High impact but only partially curable → human review
  if (impact >= 60 && curability === 'partially_curable') {
    return 'human_review_required';
  }

  // Medium impact + curable → supporting
  if (impact >= 30 && (curability === 'curable' || curability === 'partially_curable')) {
    return 'supporting_strengthens';
  }

  // Low impact → not worth chasing
  if (impact < 20) {
    return 'low_value_not_worth_chasing';
  }

  // Default: supporting
  return 'supporting_strengthens';
}

function generateNextStep(classification: SupportClassification, obtainability: Obtainability, description: string): string {
  switch (classification) {
    case 'required_to_defend':
      return obtainability === 'likely_obtainable'
        ? `Request ${description.toLowerCase()} from facility medical records. Essential to sustain billed service.`
        : `Attempt to obtain ${description.toLowerCase()}. If unavailable, evaluate alternative documentation strategies.`;
    case 'supporting_strengthens':
      return `Obtain if available — could materially strengthen the claim position.`;
    case 'low_value_not_worth_chasing':
      return `Low-recovery value. Do not delay resolution for this item — effort likely exceeds benefit.`;
    case 'human_review_required':
      return `Route to clinical reviewer for determination on obtainability and relevance.`;
    case 'not_curable_consider_downgrade':
      return `Evaluate whether to adjust the billed service level or withdraw the claim line.`;
    default:
      return `Review and determine appropriate action.`;
  }
}

function generateImpactLabel(impact: number): string {
  if (impact >= 70) return 'Could materially strengthen claim defense';
  if (impact >= 50) return 'May support modifier or service-level justification';
  if (impact >= 30) return 'Moderate evidentiary value';
  if (impact >= 15) return 'Minor supporting evidence';
  return 'Insufficient to resolve core compliance concern';
}

function generateObtainabilityLabel(obt: Obtainability): string {
  switch (obt) {
    case 'likely_obtainable': return 'Likely available from facility records';
    case 'possibly_obtainable': return 'May require external request';
    case 'unlikely': return 'Unlikely to be obtainable';
    case 'unknown': return 'Obtainability uncertain';
  }
}

function generateCurabilityLabel(cur: Curability): string {
  switch (cur) {
    case 'curable': return 'Could cure finding if obtained';
    case 'partially_curable': return 'Could strengthen but may not fully cure';
    case 'not_curable': return 'Unlikely to change outcome';
  }
}

// ─── Main Builder ───

export function buildDefensePacket(
  auditCase: AuditCase,
  opts?: {
    evidenceSuff?: EvidenceSufficiency | null;
    contradictions?: Contradiction[];
    winningPacket?: MinimalWinningPacket | null;
  },
): DefensePacketSummary {
  const items: DefenseSupportItem[] = [];
  let idx = 0;
  const missingDocs = auditCase.riskScore?.dataCompleteness.missing || [];
  const evidenceScore = opts?.evidenceSuff?.overall_score || 50;

  // ── 1. From violations → support requirements ──
  const allViolations = auditCase.analyses.flatMap(a => a.violations);
  for (const violation of allViolations) {
    const governed = classifyFindingSeverity(violation, missingDocs, evidenceScore);
    const obtainability = estimateObtainability(violation.description, 'coding');
    const curability = estimateCurability(violation, obtainability, governed.governedSeverity);
    const isConfirmed = governed.governedSeverity === 'critical_confirmed';

    // Estimate impact: critical confirmed = low impact (can't fix), pending = high (can fix)
    let rawImpact: number;
    if (isConfirmed) {
      rawImpact = 15; // low — already confirmed, doc won't fix
    } else if (governed.governedSeverity === 'critical_pending_verification') {
      rawImpact = 80; // high — verification could resolve
    } else if (governed.governedSeverity === 'high_risk_documentation_gap') {
      rawImpact = 70;
    } else if (governed.governedSeverity === 'needs_payer_entity_validation') {
      rawImpact = 55;
    } else if (violation.severity === 'warning') {
      rawImpact = 40;
    } else {
      rawImpact = 25;
    }

    // Adjust by best defense strength
    const bestDefense = violation.defenses.reduce((b, d) => d.strength > b.strength ? d : b, { strength: 0 });
    if (bestDefense.strength >= 60) rawImpact = Math.max(rawImpact - 15, 10);

    const classification = classifySupportItem(rawImpact, curability, obtainability, isConfirmed);

    items.push({
      id: `def-viol-${idx++}`,
      relatedCodes: [violation.code],
      issueDescription: violation.description,
      requiredDocumentation: `Documentation supporting ${violation.code} — ${violation.type.replace(/-/g, ' ')} defense`,
      missingEvidence: governed.dependsOnMissingMetadata
        ? `Missing: ${governed.metadataDependencies.join(', ')}`
        : `${violation.type.replace(/-/g, ' ')} documentation needed for ${violation.code}`,
      classification,
      classificationLabel: CLASSIFICATION_CONFIG[classification].label,
      priority: rawImpact >= 60 ? 'critical' : rawImpact >= 40 ? 'high' : rawImpact >= 20 ? 'medium' : 'low',
      estimatedImpact: rawImpact,
      estimatedImpactLabel: generateImpactLabel(rawImpact),
      obtainability,
      obtainabilityLabel: generateObtainabilityLabel(obtainability),
      curability,
      curabilityLabel: generateCurabilityLabel(curability),
      suggestedNextStep: generateNextStep(classification, obtainability, violation.description),
      shouldDelayResolution: classification === 'required_to_defend' || classification === 'human_review_required',
      source: 'violation',
    });
  }

  // ── 2. From evidence checklist ──
  const evidenceItems = generateDynamicEvidenceChecklist(auditCase);
  for (const ev of evidenceItems) {
    if (ev.status === 'received') continue; // skip present docs
    if (items.some(i => i.requiredDocumentation.toLowerCase().includes(ev.description.toLowerCase().slice(0, 30)))) continue;

    const obtainability = estimateObtainability(ev.description, ev.category);
    const curability = estimateCurability(null, obtainability);
    const impactTier = classifyEvidenceImpact(ev);
    const rawImpact = impactTier === 'critical' ? 75 : impactTier === 'supporting' ? 45 : 15;
    const classification = classifySupportItem(rawImpact, curability, obtainability, false);

    items.push({
      id: `def-ev-${idx++}`,
      relatedCodes: ev.relatedCodes || [],
      issueDescription: `Evidence gap: ${ev.description}`,
      requiredDocumentation: ev.description,
      missingEvidence: ev.description,
      classification,
      classificationLabel: CLASSIFICATION_CONFIG[classification].label,
      priority: ev.priority === 'high' ? 'critical' : ev.priority as any,
      estimatedImpact: rawImpact,
      estimatedImpactLabel: generateImpactLabel(rawImpact),
      obtainability,
      obtainabilityLabel: generateObtainabilityLabel(obtainability),
      curability,
      curabilityLabel: generateCurabilityLabel(curability),
      suggestedNextStep: generateNextStep(classification, obtainability, ev.description),
      shouldDelayResolution: classification === 'required_to_defend',
      source: 'evidence_gap',
    });
  }

  // ── 3. From minimal winning packet (engine-generated) ──
  if (opts?.winningPacket) {
    const checklist = opts.winningPacket.checklist as any[];
    for (const item of checklist) {
      if (items.some(i => i.requiredDocumentation.toLowerCase().includes((item.item || '').toLowerCase().slice(0, 25)))) continue;
      const obtainability: Obtainability = item.isCurable ? 'likely_obtainable' : 'unlikely';
      const curability: Curability = item.isCurable ? 'curable' : 'not_curable';
      const rawImpact = item.impactIfObtained === 'high' ? 70 : item.impactIfObtained === 'medium' ? 45 : 20;
      const classification = classifySupportItem(rawImpact, curability, obtainability, false);

      items.push({
        id: `def-pkt-${idx++}`,
        relatedCodes: [],
        issueDescription: item.item,
        requiredDocumentation: item.item,
        missingEvidence: item.item,
        classification,
        classificationLabel: CLASSIFICATION_CONFIG[classification].label,
        priority: item.priority === 'high' ? 'critical' : item.priority || 'medium',
        estimatedImpact: rawImpact,
        estimatedImpactLabel: generateImpactLabel(rawImpact),
        obtainability,
        obtainabilityLabel: generateObtainabilityLabel(obtainability),
        curability,
        curabilityLabel: generateCurabilityLabel(curability),
        suggestedNextStep: generateNextStep(classification, obtainability, item.item),
        shouldDelayResolution: classification === 'required_to_defend',
        source: 'engine_packet',
      });
    }
  }

  // ── Sort by impact descending, then obtainability ──
  items.sort((a, b) => {
    if (b.estimatedImpact !== a.estimatedImpact) return b.estimatedImpact - a.estimatedImpact;
    const obtOrder: Record<Obtainability, number> = { likely_obtainable: 0, possibly_obtainable: 1, unknown: 2, unlikely: 3 };
    return obtOrder[a.obtainability] - obtOrder[b.obtainability];
  });

  // ── Services at risk ──
  const codeRiskMap = new Map<string, { docs: string[]; gaps: string[] }>();
  for (const item of items) {
    for (const code of item.relatedCodes) {
      if (!codeRiskMap.has(code)) codeRiskMap.set(code, { docs: [], gaps: [] });
      const entry = codeRiskMap.get(code)!;
      if (item.classification === 'required_to_defend' || item.classification === 'human_review_required') {
        entry.gaps.push(item.missingEvidence);
      }
      entry.docs.push(item.requiredDocumentation);
    }
  }

  const servicesAtRisk: ServiceAtRisk[] = [];
  for (const [code, data] of codeRiskMap) {
    servicesAtRisk.push({
      code,
      description: `CPT ${code}`,
      riskLevel: data.gaps.length >= 2 ? 'high' : data.gaps.length >= 1 ? 'medium' : 'low',
      missingDocCount: data.gaps.length,
      primaryGap: data.gaps[0] || 'No critical gaps identified',
      recommendedAttachments: data.docs.slice(0, 3),
    });
  }
  servicesAtRisk.sort((a, b) => b.missingDocCount - a.missingDocCount);

  // ── Counts ──
  const requiredCount = items.filter(i => i.classification === 'required_to_defend').length;
  const supportingCount = items.filter(i => i.classification === 'supporting_strengthens').length;
  const lowValueCount = items.filter(i => i.classification === 'low_value_not_worth_chasing').length;
  const notCurableCount = items.filter(i => i.classification === 'not_curable_consider_downgrade').length;
  const humanReviewCount = items.filter(i => i.classification === 'human_review_required').length;
  const notWorthChasingItems = items.filter(i => i.classification === 'low_value_not_worth_chasing');

  // ── Overall defense strength ──
  const curableItems = items.filter(i => i.curability === 'curable');
  const curedIfObtainedEstimate = items.length > 0
    ? Math.round((curableItems.length / items.length) * 100)
    : 0;

  // Defense strength: weighted by what's available vs what's needed
  const totalImpact = items.reduce((s, i) => s + i.estimatedImpact, 0);
  const obtainableImpact = items
    .filter(i => i.obtainability === 'likely_obtainable' || i.obtainability === 'possibly_obtainable')
    .reduce((s, i) => s + i.estimatedImpact, 0);
  const overallDefenseStrength = totalImpact > 0
    ? Math.min(100, Math.round((obtainableImpact / totalImpact) * 100))
    : 50;

  // ── Disposition ──
  let disposition: ClaimDisposition;
  let dispositionLabel: string;
  let dispositionDescription: string;

  if (notCurableCount >= 2 && requiredCount === 0) {
    disposition = 'appeal_not_recommended';
    dispositionLabel = 'Appeal Not Recommended';
    dispositionDescription = 'Multiple findings are unlikely to be resolved with additional documentation. Consider service-level adjustment or withdrawal.';
  } else if (humanReviewCount >= 2) {
    disposition = 'route_to_human';
    dispositionLabel = 'Route to Human Audit';
    dispositionDescription = 'Multiple items require clinical reviewer determination before a defensible disposition can be reached.';
  } else if (notCurableCount >= 1 && requiredCount >= 1) {
    disposition = 'downgrade_resubmit';
    dispositionLabel = 'Correct and Resubmit';
    dispositionDescription = 'Some findings are structurally non-curable. Others may be defended with documentation. Evaluate partial service-level adjustment.';
  } else if (requiredCount >= 1) {
    disposition = 'defend_with_packet';
    dispositionLabel = 'Assemble Supporting Documentation';
    dispositionDescription = 'Required evidence has been identified. Assemble a defense-ready packet before submission or appeal.';
  } else if (overallDefenseStrength >= 70 && notCurableCount === 0) {
    disposition = 'defend_as_billed';
    dispositionLabel = 'Supportable as Billed';
    dispositionDescription = 'Available documentation appears sufficient to sustain the billed services. No critical evidentiary gaps identified.';
  } else {
    disposition = 'defend_with_packet';
    dispositionLabel = 'Assemble Supporting Documentation';
    dispositionDescription = 'Additional documentation could strengthen the claim position before submission or review.';
  }

  // ── Summary notes (cautious language) ──
  const summaryNotes: string[] = [];
  if (requiredCount > 0) {
    summaryNotes.push(`${requiredCount} document(s) are likely needed to sustain the billed services. Absence could materially weaken the defense.`);
  }
  if (supportingCount > 0) {
    summaryNotes.push(`${supportingCount} item(s) could strengthen the case position if obtained, but may not be individually determinative.`);
  }
  if (lowValueCount > 0) {
    summaryNotes.push(`${lowValueCount} item(s) are flagged as low value — effort to obtain likely exceeds benefit. Do not delay resolution for these.`);
  }
  if (notCurableCount > 0) {
    summaryNotes.push(`${notCurableCount} finding(s) are unlikely to be resolved by additional documentation. Consider service-level adjustments.`);
  }
  if (curedIfObtainedEstimate > 50) {
    summaryNotes.push(`Approximately ${curedIfObtainedEstimate}% of identified gaps appear curable with available records.`);
  }

  return {
    disposition,
    dispositionLabel,
    dispositionDescription,
    servicesAtRisk,
    supportItems: items,
    requiredCount,
    supportingCount,
    lowValueCount,
    notCurableCount,
    humanReviewCount,
    overallDefenseStrength,
    curedIfObtainedEstimate,
    notWorthChasingItems,
    summaryNotes,
  };
}
