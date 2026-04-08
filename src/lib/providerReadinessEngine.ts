/**
 * Provider Readiness Engine
 *
 * Analyzes recurring patterns across provider cases to produce
 * actionable operational insights: correctable patterns, high-risk
 * behaviors, and recommended interventions.
 *
 * Does NOT replace providerService.ts — this is additive analysis
 * logic consumed by the enhanced ProviderDashboard.
 */

import type {
  ProviderDashboardStats,
  RecurringIssue,
  CorrectablePattern,
  HighRiskBehavior,
  RecommendedIntervention,
  RootCause,
  RemediationType,
  PatternSeverity,
} from './providerTypes';

// ─── Root Cause Labels ───

export const ROOT_CAUSE_LABELS: Record<RootCause, string> = {
  physician_documentation: 'Physician Documentation',
  coder_interpretation: 'Coder Interpretation',
  missing_modifier_support: 'Missing Modifier Support',
  missing_operative_detail: 'Missing Operative Detail',
  missing_time_logs: 'Missing Time Logs',
  insufficient_medical_necessity: 'Insufficient Medical Necessity',
  workflow_gap: 'Workflow Gap',
  template_deficiency: 'Template Deficiency',
};

export const REMEDIATION_TYPE_LABELS: Record<RemediationType, string> = {
  training: 'Staff Training',
  workflow: 'Workflow Change',
  template: 'Template Update',
  coding_review: 'Coding Review',
  policy_change: 'Policy Change',
  specialist_escalation: 'Specialist Escalation',
};

export const PATTERN_SEVERITY_LABELS: Record<PatternSeverity, string> = {
  high_operational_risk: 'High Operational Risk',
  medium_recurring_weakness: 'Medium Recurring Weakness',
  low_informational: 'Low-Frequency Informational',
};

export const PATTERN_SEVERITY_COLORS: Record<PatternSeverity, { text: string; bg: string; border: string }> = {
  high_operational_risk: { text: 'text-violation', bg: 'bg-violation/10', border: 'border-violation/30' },
  medium_recurring_weakness: { text: 'text-disagreement', bg: 'bg-disagreement/10', border: 'border-disagreement/30' },
  low_informational: { text: 'text-muted-foreground', bg: 'bg-muted', border: 'border-muted' },
};

// ─── Pattern Severity Classification ───

export function classifyPatternSeverity(theme: RecurringIssue): PatternSeverity {
  if (theme.frequency >= 3 && theme.impact === 'high') return 'high_operational_risk';
  if (theme.frequency >= 2 || theme.impact === 'high') return 'medium_recurring_weakness';
  return 'low_informational';
}

// ─── Root Cause Detection ───

export function detectRootCause(theme: RecurringIssue): RootCause {
  const title = theme.title.toLowerCase();
  const desc = theme.description.toLowerCase();
  const combined = `${title} ${desc}`;

  if (/time.?log|time.?doc|duration|start.?stop|contemporaneous/.test(combined)) return 'missing_time_logs';
  if (/modifier|modifier.?59|xe|xs|xp|xu/.test(combined)) return 'missing_modifier_support';
  if (/operative.?note|compartment|surgical.?detail|graft.?source/.test(combined)) return 'missing_operative_detail';
  if (/medical.?necessity|mdm|level.?5|e\/m/.test(combined)) return 'insufficient_medical_necessity';
  if (/coder|coding.?staff|ncci.?edit|unbundl/.test(combined)) return 'coder_interpretation';
  if (/template|ehr|auto.?map/.test(combined)) return 'template_deficiency';
  if (/workflow|pre.?submission|hold.?rule|checklist/.test(combined)) return 'workflow_gap';
  return 'physician_documentation';
}

// ─── Remediation Type Detection ───

export function detectRemediationType(rootCause: RootCause): RemediationType {
  switch (rootCause) {
    case 'physician_documentation': return 'training';
    case 'coder_interpretation': return 'coding_review';
    case 'missing_modifier_support': return 'template';
    case 'missing_operative_detail': return 'training';
    case 'missing_time_logs': return 'workflow';
    case 'insufficient_medical_necessity': return 'template';
    case 'workflow_gap': return 'workflow';
    case 'template_deficiency': return 'template';
  }
}

// ─── Denial Impact Estimation ───
// Formula: casesAffected × averageClaimValue × denialProbability
// denialProbability = 0.7 for high, 0.4 for medium, 0.15 for low

export function estimateDenialImpact(
  theme: RecurringIssue,
  avgClaimValue: number,
): number {
  const probability = theme.impact === 'high' ? 0.7 : theme.impact === 'medium' ? 0.4 : 0.15;
  return Math.round(theme.frequency * avgClaimValue * probability);
}

// ─── Correctable Pattern Builder ───

export function buildCorrectablePatterns(
  themes: RecurringIssue[],
  avgClaimValue: number,
): CorrectablePattern[] {
  return themes
    .filter(t => t.impact !== 'low' && t.frequency >= 2)
    .map((t, i) => {
      const rootCause = t.rootCause || detectRootCause(t);
      const isCorrectible = rootCause !== 'coder_interpretation' || t.frequency <= 3;
      return {
        id: `cp-${i}`,
        title: t.title,
        casesAffected: t.frequency,
        estimatedRevenue: estimateDenialImpact(t, avgClaimValue),
        isCorrectible,
        correctiveAction: t.suggestedRemediation || t.educationOpportunity,
        rootCause,
      };
    })
    .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);
}

// ─── High-Risk Behavior Detection ───

export function buildHighRiskBehaviors(
  themes: RecurringIssue[],
): HighRiskBehavior[] {
  return themes
    .filter(t => (t.patternSeverity || classifyPatternSeverity(t)) === 'high_operational_risk')
    .map((t, i) => ({
      id: `hrb-${i}`,
      title: t.title,
      description: t.whyItMatters || t.description,
      casesAffected: t.frequency,
      riskLevel: 'high_operational_risk' as PatternSeverity,
      suggestedAction: t.suggestedRemediation || t.educationOpportunity,
    }));
}

// ─── Intervention Generator ───

export function generateInterventions(
  themes: RecurringIssue[],
): RecommendedIntervention[] {
  const interventionMap = new Map<string, RecommendedIntervention>();

  for (const theme of themes) {
    const rootCause = theme.rootCause || detectRootCause(theme);
    const remType = theme.remediationType || detectRemediationType(rootCause);
    const severity = theme.patternSeverity || classifyPatternSeverity(theme);

    // Group by remediation type to avoid duplicate interventions
    const key = `${remType}-${rootCause}`;
    const existing = interventionMap.get(key);

    if (existing) {
      existing.affectedPatterns.push(theme.title);
      if (severity === 'high_operational_risk' && existing.priority !== 'critical') {
        existing.priority = 'high';
      }
      continue;
    }

    const intervention = buildInterventionForType(remType, rootCause, theme, severity);
    intervention.affectedPatterns = [theme.title];
    interventionMap.set(key, intervention);
  }

  return Array.from(interventionMap.values())
    .sort((a, b) => {
      const prioOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return prioOrder[a.priority] - prioOrder[b.priority];
    });
}

function buildInterventionForType(
  remType: RemediationType,
  rootCause: RootCause,
  theme: RecurringIssue,
  severity: PatternSeverity,
): RecommendedIntervention {
  const priority = severity === 'high_operational_risk' ? 'high' : severity === 'medium_recurring_weakness' ? 'medium' : 'low';

  const templates: Record<RemediationType, Omit<RecommendedIntervention, 'id' | 'affectedPatterns'>> = {
    training: {
      title: 'Conduct Staff Documentation Training',
      description: 'Targeted training on documentation requirements for high-risk code categories. Focus on real cases where documentation gaps led to denials.',
      type: 'training',
      typeLabel: 'Staff Training',
      priority,
      estimatedImpact: 'Reduce documentation-related denials by 40–60% within 90 days',
      implementationEffort: 'medium',
    },
    workflow: {
      title: 'Add Mandatory Documentation Fields to Workflow',
      description: 'Implement required fields in EHR workflows for time logs, modifier justification, and operative detail capture at point of care.',
      type: 'workflow',
      typeLabel: 'Workflow Change',
      priority,
      estimatedImpact: 'Prevent missing documentation at source — eliminates retroactive record requests',
      implementationEffort: 'high',
    },
    template: {
      title: 'Update Note Templates with Required Elements',
      description: 'Add structured prompts for modifier justification, medical necessity criteria, and compartment-specific documentation to existing note templates.',
      type: 'template',
      typeLabel: 'Template Update',
      priority,
      estimatedImpact: 'Standardize documentation quality and reduce variation across providers',
      implementationEffort: 'low',
    },
    coding_review: {
      title: 'Conduct Coding Accuracy Review',
      description: 'Review coding patterns for common NCCI edit violations and unbundling risks. Verify coders understand modifier requirements for flagged combinations.',
      type: 'coding_review',
      typeLabel: 'Coding Review',
      priority,
      estimatedImpact: 'Reduce coding-related denials and prevent potential audit exposure',
      implementationEffort: 'medium',
    },
    policy_change: {
      title: 'Add Claim Hold Rules for Missing Evidence',
      description: 'Implement pre-submission claim hold rules that flag claims missing required documentation elements before they are released to payers.',
      type: 'policy_change',
      typeLabel: 'Policy Change',
      priority,
      estimatedImpact: 'Catch preventable denials before submission — shift from reactive to proactive',
      implementationEffort: 'medium',
    },
    specialist_escalation: {
      title: 'Escalate Specific Claim Types to Specialist Review',
      description: 'Route high-risk code combinations (e.g., TKA + add-ons, same-day ED + critical care) to specialist coders or compliance before submission.',
      type: 'specialist_escalation',
      typeLabel: 'Specialist Escalation',
      priority,
      estimatedImpact: 'Expert review reduces error rate on complex claims by 50–70%',
      implementationEffort: 'low',
    },
  };

  return {
    id: `int-${remType}-${rootCause}`,
    ...templates[remType],
    priority,
    affectedPatterns: [],
  };
}

// ─── Avoidable Denial Breakdown ───

export function computeDenialBreakdown(
  themes: RecurringIssue[],
  avgClaimValue: number,
): ProviderDashboardStats['avoidableDenialBreakdown'] {
  let documentationGaps = 0;
  let codingErrors = 0;
  let modifierIssues = 0;
  let timeDocumentation = 0;

  for (const theme of themes) {
    const impact = estimateDenialImpact(theme, avgClaimValue);
    const rootCause = theme.rootCause || detectRootCause(theme);

    switch (rootCause) {
      case 'missing_time_logs':
        timeDocumentation += impact;
        break;
      case 'missing_modifier_support':
        modifierIssues += impact;
        break;
      case 'coder_interpretation':
        codingErrors += impact;
        break;
      default:
        documentationGaps += impact;
        break;
    }
  }

  return { documentationGaps, codingErrors, modifierIssues, timeDocumentation };
}

// ─── Enrich Themes with Computed Fields ───

export function enrichThemes(
  themes: RecurringIssue[],
  avgClaimValue: number,
): RecurringIssue[] {
  return themes.map(t => ({
    ...t,
    rootCause: t.rootCause || detectRootCause(t),
    remediationType: t.remediationType || detectRemediationType(t.rootCause || detectRootCause(t)),
    patternSeverity: t.patternSeverity || classifyPatternSeverity(t),
    estimatedDenialImpact: t.estimatedDenialImpact || estimateDenialImpact(t, avgClaimValue),
    fixUpstreamInstead: t.fixUpstreamInstead ?? (t.impact === 'high' && (detectRootCause(t) === 'physician_documentation' || detectRootCause(t) === 'missing_time_logs')),
  }));
}
