import type { ProviderDashboardStats } from './providerTypes';
import {
  ROOT_CAUSE_LABELS, REMEDIATION_TYPE_LABELS,
  PATTERN_SEVERITY_LABELS,
} from './providerReadinessEngine';
import {
  createPDFContext, addTitle, addSubtitle, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage,
} from './pdfHelpers';

export function exportProviderReadinessPDF(stats: ProviderDashboardStats) {
  const ctx = createPDFContext();

  // ── Header ──
  addTitle(ctx, 'Provider Readiness Summary', 18);
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 12);

  // ── Overview Metrics ──
  addTitle(ctx, 'Portfolio Overview');
  addKeyValue(ctx, 'Cases Reviewed', String(stats.totalCasesReviewed));
  addKeyValue(ctx, 'Documentation Weakness Identified', String(stats.documentationWeakCases));
  addKeyValue(ctx, 'Coding Vulnerability Identified', String(stats.codingVulnerableCases));
  addKeyValue(ctx, 'Appeals Not Recommended', String(stats.appealsNotWorthPursuing));
  addKeyValue(ctx, 'Staff Education Opportunities', String(stats.staffEducationOpportunities));
  addSpacer(ctx, 12);

  // ── Avoidable Denial Cost ──
  addTitle(ctx, 'Estimated Avoidable Denial Cost');
  addKeyValue(ctx, 'Total Estimated Exposure', `$${stats.estimatedAvoidableDenialCost.toLocaleString()}`);
  addSpacer(ctx, 4);
  addBody(ctx, 'Breakdown by root cause category:');
  const bd = stats.avoidableDenialBreakdown;
  addBullet(ctx, `Documentation Gaps: $${bd.documentationGaps.toLocaleString()}`);
  addBullet(ctx, `Coding Errors: $${bd.codingErrors.toLocaleString()}`);
  addBullet(ctx, `Modifier Issues: $${bd.modifierIssues.toLocaleString()}`);
  addBullet(ctx, `Time Documentation: $${bd.timeDocumentation.toLocaleString()}`);
  addSpacer(ctx, 4);
  addBody(ctx, 'Formula: Cases Affected × Average Claim Value × Denial Probability (High: 70%, Medium: 40%, Low: 15%).');
  addSpacer(ctx, 12);

  // ── Recurring Documentation Themes ──
  if (stats.recurringThemes.length > 0) {
    checkPage(ctx);
    addTitle(ctx, 'Recurring Documentation Themes');
    stats.recurringThemes.forEach(theme => {
      const severity = theme.patternSeverity ? PATTERN_SEVERITY_LABELS[theme.patternSeverity] : '';
      const rootCause = theme.rootCause ? ROOT_CAUSE_LABELS[theme.rootCause] : '';
      addSubtitle(ctx, `${theme.title} (${theme.frequency} occurrences, ${theme.impact} impact)`);
      if (severity) addKeyValue(ctx, 'Severity', severity);
      if (rootCause) addKeyValue(ctx, 'Root Cause', rootCause);
      addBody(ctx, theme.description);
      if (theme.whyItMatters) addBody(ctx, `Why it matters: ${theme.whyItMatters}`);
      if (theme.suggestedRemediation) addBody(ctx, `Suggested remediation: ${theme.suggestedRemediation}`);
      if (theme.estimatedDenialImpact) addKeyValue(ctx, 'Estimated Denial Impact', `$${theme.estimatedDenialImpact.toLocaleString()}`);
      addSpacer(ctx, 6);
    });
    addSpacer(ctx, 8);
  }

  // ── Correctable Patterns ──
  if (stats.correctablePatterns.length > 0) {
    checkPage(ctx);
    addTitle(ctx, 'Correctable Patterns');
    stats.correctablePatterns.forEach(p => {
      addSubtitle(ctx, `${p.title} — ${p.casesAffected} cases, $${p.estimatedRevenue.toLocaleString()} at risk`);
      addKeyValue(ctx, 'Root Cause', ROOT_CAUSE_LABELS[p.rootCause]);
      addKeyValue(ctx, 'Correctable', p.isCorrectible ? 'Yes' : 'Requires further review');
      addBody(ctx, `Corrective action: ${p.correctiveAction}`);
      addSpacer(ctx, 4);
    });
    addSpacer(ctx, 8);
  }

  // ── High-Risk Behaviors ──
  if (stats.highRiskBehaviors.length > 0) {
    checkPage(ctx);
    addTitle(ctx, 'High-Risk Operational Behaviors');
    stats.highRiskBehaviors.forEach(b => {
      addSubtitle(ctx, `${b.title} — ${b.casesAffected} cases`);
      addBody(ctx, b.description);
      addBody(ctx, `Suggested action: ${b.suggestedAction}`);
      addSpacer(ctx, 4);
    });
    addSpacer(ctx, 8);
  }

  // ── Recommended Interventions ──
  if (stats.recommendedInterventions.length > 0) {
    checkPage(ctx);
    addTitle(ctx, 'Recommended Interventions');
    stats.recommendedInterventions.forEach(int => {
      addSubtitle(ctx, `[${int.priority.toUpperCase()}] ${int.title}`);
      addKeyValue(ctx, 'Type', int.typeLabel);
      addKeyValue(ctx, 'Implementation Effort', int.implementationEffort);
      addBody(ctx, int.description);
      addKeyValue(ctx, 'Estimated Impact', int.estimatedImpact);
      if (int.affectedPatterns.length > 0) {
        addBody(ctx, 'Affected patterns:');
        int.affectedPatterns.forEach(p => addBullet(ctx, p));
      }
      addSpacer(ctx, 6);
    });
    addSpacer(ctx, 8);
  }

  // ── Top Vulnerabilities ──
  if (stats.topVulnerabilities.length > 0) {
    checkPage(ctx);
    addTitle(ctx, 'Top Vulnerabilities');
    stats.topVulnerabilities.forEach(v => addBullet(ctx, v));
    addSpacer(ctx, 8);
  }

  addFooter(ctx, 'Confidential — SOUPY Provider Readiness Report — For authorized recipients only');
  ctx.doc.save(`Provider_Readiness_${Date.now()}.pdf`);
}
