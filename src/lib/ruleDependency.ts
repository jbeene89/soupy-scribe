/**
 * Rule Dependency and Validation Layer
 *
 * Classifies the regulatory basis and metadata dependencies of each
 * finding to prevent overconfident labeling when supporting data is
 * absent. Additive — does NOT alter the original violation objects.
 */

import type { CodeViolation } from './types';

// ─── Rule Dependency Classification ───

export type RuleDependency =
  | 'universal_rule_conflict'
  | 'cms_default_rule'
  | 'payer_specific_rule'
  | 'entity_specific_validation'
  | 'documentation_only';

export type MetadataFlag =
  | 'separate_tin_entity'
  | 'place_of_service'
  | 'modifier_support'
  | 'mar_timestamp'
  | 'consultant_note'
  | 'payer_policy';

export type CautionedLabel =
  | 'apparent_duplicate_risk'
  | 'potential_unbundling_concern'
  | 'requires_entity_verification'
  | 'requires_payer_policy_validation'
  | 'documentation_insufficient';

export type AuditBasis =
  | 'cms_ncci_default'
  | 'commercial_payer_approximation'
  | 'internal_rule_set'
  | 'payer_specific';

export interface RuleDependencyResult {
  violation: CodeViolation;
  ruleDependency: RuleDependency;
  ruleDependencyLabel: string;
  metadataFlags: MetadataFlag[];
  metadataFlagLabels: string[];
  /** If metadata-dependent, the cautioned label to use instead of raw severity */
  cautionedLabel: CautionedLabel | null;
  cautionedLabelText: string | null;
  /** Whether the finding's language should be guarded */
  languageGuarded: boolean;
  /** What would resolve this finding */
  resolutionSteps: string[];
  /** The audit basis this finding rests on */
  auditBasis: AuditBasis;
  auditBasisLabel: string;
  /** Whether the finding is strong enough to stand without guards */
  isStrongFinding: boolean;
}

// ─── Config Maps ───

const RULE_DEPENDENCY_LABELS: Record<RuleDependency, string> = {
  universal_rule_conflict: 'Universal Rule Conflict',
  cms_default_rule: 'CMS/NCCI Default',
  payer_specific_rule: 'Payer-Specific Rule',
  entity_specific_validation: 'Entity Verification Required',
  documentation_only: 'Documentation Issue',
};

const METADATA_FLAG_LABELS: Record<MetadataFlag, string> = {
  separate_tin_entity: 'Separate TIN / Entity Required',
  place_of_service: 'Place of Service Required',
  modifier_support: 'Modifier Documentation Required',
  mar_timestamp: 'MAR / Timestamp Required',
  consultant_note: 'Consultant Note Required',
  payer_policy: 'Payer Policy Required',
};

const CAUTIONED_LABEL_TEXT: Record<CautionedLabel, string> = {
  apparent_duplicate_risk: 'Apparent Duplicate Risk',
  potential_unbundling_concern: 'Potential Unbundling Concern',
  requires_entity_verification: 'Requires Entity Verification',
  requires_payer_policy_validation: 'Requires Payer Policy Validation',
  documentation_insufficient: 'Documentation Insufficient to Confirm',
};

const AUDIT_BASIS_LABELS: Record<AuditBasis, string> = {
  cms_ncci_default: 'CMS / NCCI Default Rules',
  commercial_payer_approximation: 'Commercial Payer Approximation',
  internal_rule_set: 'Internal Rule Set',
  payer_specific: 'Payer-Specific Policy',
};

export { RULE_DEPENDENCY_LABELS, METADATA_FLAG_LABELS, CAUTIONED_LABEL_TEXT, AUDIT_BASIS_LABELS };

// ─── Overconfident Language Guards ───

const GUARDED_PHRASES = [
  'clear and unambiguous error',
  'definitive duplicate billing',
  'invalid regardless of payer',
  'confirmed improper billing',
  'undeniable violation',
  'absolutely impermissible',
  'unquestionably incorrect',
];

export function containsOverconfidentLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return GUARDED_PHRASES.some(phrase => lower.includes(phrase));
}

export function guardLanguage(text: string): string {
  let result = text;
  const replacements: [string, string][] = [
    ['clear and unambiguous error', 'apparent compliance concern'],
    ['definitive duplicate billing', 'apparent duplicate risk'],
    ['invalid regardless of payer', 'likely noncompliant under CMS default rules'],
    ['confirmed improper billing', 'potential billing irregularity'],
    ['undeniable violation', 'significant compliance concern'],
    ['absolutely impermissible', 'likely impermissible under applicable rules'],
    ['unquestionably incorrect', 'appears inconsistent with applicable guidelines'],
  ];
  for (const [from, to] of replacements) {
    const regex = new RegExp(from, 'gi');
    result = result.replace(regex, to);
  }
  return result;
}

// ─── Detection Logic ───

interface ViolationText {
  description: string;
  defenseText: string;
  regulationRef: string;
}

function getViolationText(v: CodeViolation): ViolationText {
  const defenseText = v.defenses
    .flatMap(d => [d.strategy, ...d.strengths, ...d.weaknesses])
    .join(' ');
  return {
    description: v.description,
    defenseText,
    regulationRef: v.regulationRef,
  };
}

function detectMetadataFlags(combined: string): MetadataFlag[] {
  const flags: MetadataFlag[] = [];
  const lower = combined.toLowerCase();

  if (/separate tin|separate entity|billing entity|separate npi|distinct provider/.test(lower)) {
    flags.push('separate_tin_entity');
  }
  if (/place of service|facility.*professional|pos \d|outpatient.*inpatient/.test(lower)) {
    flags.push('place_of_service');
  }
  if (/modifier|(-25|-59|-76|-77|-xesu)|distinct procedural/.test(lower)) {
    flags.push('modifier_support');
  }
  if (/\bmar\b|medication administration|time.?stamp|time.?log|anesthesia.?record|start.?time|stop.?time/.test(lower)) {
    flags.push('mar_timestamp');
  }
  if (/consult(?:ant|ation)?\s*note|consult(?:ant|ation)?\s*report|requesting physician/.test(lower)) {
    flags.push('consultant_note');
  }
  if (/payer.?policy|payer.?specific|carrier.?rule|plan.?guideline|commercial.?payer|lcd|ncd/.test(lower)) {
    flags.push('payer_policy');
  }

  return flags;
}

function classifyRuleDependency(v: CodeViolation, flags: MetadataFlag[]): RuleDependency {
  const regLower = v.regulationRef.toLowerCase();
  const descLower = v.description.toLowerCase();
  const combined = `${regLower} ${descLower}`;

  // Entity-specific: duplicate/unbundling findings that depend on entity identity
  if (flags.includes('separate_tin_entity') &&
      (v.type === 'duplicate' || v.type === 'unbundling')) {
    return 'entity_specific_validation';
  }

  // Payer-specific: references LCD, NCD, payer policies, or commercial rules
  if (flags.includes('payer_policy') ||
      /lcd|ncd|commercial|carrier|plan guideline/.test(combined)) {
    return 'payer_specific_rule';
  }

  // Universal: NCCI column-1/column-2 edits, CPT definitional rules, true duplicates
  if (/ncci|column.?[12]|mutually exclusive|cpt instruction|ama guideline/.test(combined) &&
      flags.length === 0) {
    return 'universal_rule_conflict';
  }

  // CMS default: general CMS/NCCI reference without payer specificity
  if (/cms|ncci|cci edit|medicare/.test(combined)) {
    return 'cms_default_rule';
  }

  // Documentation-only: no rule conflict, just missing docs
  if (flags.length > 0 && v.severity !== 'critical') {
    return 'documentation_only';
  }

  return 'cms_default_rule'; // safe default
}

function determineCautionedLabel(
  v: CodeViolation,
  flags: MetadataFlag[],
  dep: RuleDependency,
): CautionedLabel | null {
  // Only apply caution labels when metadata is missing
  if (flags.length === 0 && dep === 'universal_rule_conflict') return null;

  if (v.type === 'duplicate' && flags.includes('separate_tin_entity')) {
    return 'apparent_duplicate_risk';
  }
  if (v.type === 'unbundling' && (flags.includes('modifier_support') || flags.includes('separate_tin_entity'))) {
    return 'potential_unbundling_concern';
  }
  if (dep === 'entity_specific_validation') {
    return 'requires_entity_verification';
  }
  if (dep === 'payer_specific_rule' || flags.includes('payer_policy')) {
    return 'requires_payer_policy_validation';
  }
  if (flags.length > 0 && v.severity === 'critical') {
    return 'documentation_insufficient';
  }
  return null;
}

function generateResolutionSteps(flags: MetadataFlag[], v: CodeViolation): string[] {
  const steps: string[] = [];

  if (flags.includes('separate_tin_entity')) {
    steps.push('Verify separate TIN and provider identity for each billing entity');
    steps.push('Confirm facility vs. professional component split');
  }
  if (flags.includes('place_of_service')) {
    steps.push('Confirm place of service designation (facility vs. non-facility)');
  }
  if (flags.includes('modifier_support')) {
    steps.push('Obtain modifier documentation supporting distinct procedural service');
  }
  if (flags.includes('mar_timestamp')) {
    steps.push('Obtain MAR with timestamps confirming administration details');
  }
  if (flags.includes('consultant_note')) {
    steps.push('Obtain consultant report documenting requesting physician and findings');
  }
  if (flags.includes('payer_policy')) {
    steps.push('Look up applicable payer policy for this code combination');
    steps.push('Confirm whether CMS/NCCI default applies or payer has override');
  }

  if (v.type === 'duplicate') {
    steps.push('Verify whether services were performed by the same or different providers');
  }
  if (v.type === 'unbundling') {
    steps.push('Review whether distinct procedural sessions justify separate billing');
  }

  return steps;
}

function determineAuditBasis(
  v: CodeViolation,
  dep: RuleDependency,
  hasPayer: boolean,
): AuditBasis {
  if (hasPayer && dep === 'payer_specific_rule') return 'payer_specific';
  if (dep === 'cms_default_rule' || dep === 'universal_rule_conflict') return 'cms_ncci_default';
  if (dep === 'entity_specific_validation') return 'commercial_payer_approximation';
  return 'internal_rule_set';
}

function isStrongFinding(
  v: CodeViolation,
  dep: RuleDependency,
  flags: MetadataFlag[],
): boolean {
  // Strong: universal rule conflict with no metadata dependencies
  if (dep === 'universal_rule_conflict' && flags.length === 0) return true;
  // Strong: CMS default with regulation ref + high defense strength
  if (dep === 'cms_default_rule' && flags.length === 0 &&
      v.regulationRef.length > 10 &&
      v.defenses.some(d => d.strength >= 60)) return true;
  return false;
}

// ─── Main Classification Function ───

export function classifyRuleDependencies(
  violations: CodeViolation[],
  opts?: { hasPayer?: boolean },
): RuleDependencyResult[] {
  return violations.map(v => {
    const text = getViolationText(v);
    const combined = `${text.description} ${text.defenseText} ${text.regulationRef}`;

    const flags = detectMetadataFlags(combined);
    const dep = classifyRuleDependency(v, flags);
    const cautioned = determineCautionedLabel(v, flags, dep);
    const strong = isStrongFinding(v, dep, flags);
    const languageGuarded = !strong && containsOverconfidentLanguage(combined);

    return {
      violation: v,
      ruleDependency: dep,
      ruleDependencyLabel: RULE_DEPENDENCY_LABELS[dep],
      metadataFlags: flags,
      metadataFlagLabels: flags.map(f => METADATA_FLAG_LABELS[f]),
      cautionedLabel: cautioned,
      cautionedLabelText: cautioned ? CAUTIONED_LABEL_TEXT[cautioned] : null,
      languageGuarded,
      resolutionSteps: flags.length > 0 || !strong ? generateResolutionSteps(flags, v) : [],
      auditBasis: determineAuditBasis(v, dep, !!opts?.hasPayer),
      auditBasisLabel: AUDIT_BASIS_LABELS[determineAuditBasis(v, dep, !!opts?.hasPayer)],
      isStrongFinding: strong,
    };
  });
}

// ─── Case-Level Audit Basis ───

export function deriveCaseAuditBasis(
  results: RuleDependencyResult[],
): { basis: AuditBasis; label: string; description: string } {
  if (results.length === 0) {
    return {
      basis: 'cms_ncci_default',
      label: AUDIT_BASIS_LABELS.cms_ncci_default,
      description: 'Analysis uses CMS/NCCI rules as default. Actual payer rules may differ.',
    };
  }

  const hasPayer = results.some(r => r.auditBasis === 'payer_specific');
  if (hasPayer) {
    return {
      basis: 'payer_specific',
      label: AUDIT_BASIS_LABELS.payer_specific,
      description: 'Analysis includes payer-specific policies loaded from payer profile.',
    };
  }

  const hasEntity = results.some(r => r.auditBasis === 'commercial_payer_approximation');
  if (hasEntity) {
    return {
      basis: 'commercial_payer_approximation',
      label: AUDIT_BASIS_LABELS.commercial_payer_approximation,
      description: 'CMS/NCCI rules applied as proxy. Entity and payer verification may alter findings.',
    };
  }

  return {
    basis: 'cms_ncci_default',
    label: AUDIT_BASIS_LABELS.cms_ncci_default,
    description: 'Analysis uses CMS/NCCI rules as default baseline. Actual payer policies may differ.',
  };
}
