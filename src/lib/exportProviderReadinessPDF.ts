import type { ProviderDashboardStats } from './providerTypes';
import {
  ROOT_CAUSE_LABELS, REMEDIATION_TYPE_LABELS,
  PATTERN_SEVERITY_LABELS,
} from './providerReadinessEngine';
import {
  createPDFContext, addDocumentHeader, addSectionHeader, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage, addScoreCards, addAlertBox,
  addDivider, addKeyValueGrid, addTable, addSubtitle, riskColor,
  type ScoreCardItem,
} from './pdfHelpers';

export function exportProviderReadinessPDF(stats: ProviderDashboardStats) {
  const ctx = createPDFContext();

  // ── Banner Header ──
  addDocumentHeader(ctx, 'Provider Readiness Summary', 'SOUPY ThinkTank — Compliance & Documentation Analysis');
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 8);

  // ── Score Cards (top-line metrics) ──
  addScoreCards(ctx, [
    { label: 'Cases Reviewed', value: String(stats.totalCasesReviewed), color: 'brand' },
    { label: 'Doc Weakness', value: String(stats.documentationWeakCases), sublabel: 'Identified', color: stats.documentationWeakCases > 0 ? 'amber' : 'green' },
    { label: 'Coding Vuln.', value: String(stats.codingVulnerableCases), sublabel: 'Identified', color: stats.codingVulnerableCases > 0 ? 'amber' : 'green' },
    { label: 'Appeals Not Rec.', value: String(stats.appealsNotWorthPursuing), sublabel: 'Cases', color: stats.appealsNotWorthPursuing > 0 ? 'red' : 'green' },
    { label: 'Education Opps', value: String(stats.staffEducationOpportunities), color: 'blue' },
  ]);

  // ── Avoidable Denial Cost ──
  addSectionHeader(ctx, 'Estimated Avoidable Denial Cost', [185, 28, 28]);
  addAlertBox(ctx, `Total Estimated Exposure: $${stats.estimatedAvoidableDenialCost.toLocaleString()}`, 'error', 'Financial Impact');
  addSpacer(ctx, 4);

  const bd = stats.avoidableDenialBreakdown;
  addTable(ctx, [
    { header: 'Root Cause', width: ctx.maxWidth * 0.5 },
    { header: 'Estimated Cost', width: ctx.maxWidth * 0.25, align: 'right' },
    { header: 'Share', width: ctx.maxWidth * 0.25, align: 'right' },
  ], [
    ['Documentation Gaps', `$${bd.documentationGaps.toLocaleString()}`, stats.estimatedAvoidableDenialCost > 0 ? `${Math.round(bd.documentationGaps / stats.estimatedAvoidableDenialCost * 100)}%` : '0%'],
    ['Coding Errors', `$${bd.codingErrors.toLocaleString()}`, stats.estimatedAvoidableDenialCost > 0 ? `${Math.round(bd.codingErrors / stats.estimatedAvoidableDenialCost * 100)}%` : '0%'],
    ['Modifier Issues', `$${bd.modifierIssues.toLocaleString()}`, stats.estimatedAvoidableDenialCost > 0 ? `${Math.round(bd.modifierIssues / stats.estimatedAvoidableDenialCost * 100)}%` : '0%'],
    ['Time Documentation', `$${bd.timeDocumentation.toLocaleString()}`, stats.estimatedAvoidableDenialCost > 0 ? `${Math.round(bd.timeDocumentation / stats.estimatedAvoidableDenialCost * 100)}%` : '0%'],
  ]);
  addBody(ctx, 'Formula: Cases Affected × Average Claim Value × Denial Probability (High: 70%, Medium: 40%, Low: 15%).');
  addSpacer(ctx, 8);

  // ── Recurring Themes ──
  if (stats.recurringThemes.length > 0) {
    addSectionHeader(ctx, 'Recurring Documentation Themes', [217, 119, 6]);
    stats.recurringThemes.forEach(theme => {
      checkPage(ctx, 70);
      const severity = theme.patternSeverity ? PATTERN_SEVERITY_LABELS[theme.patternSeverity] : '';
      const rootCause = theme.rootCause ? ROOT_CAUSE_LABELS[theme.rootCause] : '';
      addSubtitle(ctx, `${theme.title} (${theme.frequency} occurrences, ${theme.impact} impact)`);
      if (severity || rootCause) {
        addKeyValueGrid(ctx, [
          ...(severity ? [['Severity', severity] as [string, string]] : []),
          ...(rootCause ? [['Root Cause', rootCause] as [string, string]] : []),
        ]);
      }
      addBody(ctx, theme.description);
      if (theme.whyItMatters) addBody(ctx, `Why it matters: ${theme.whyItMatters}`);
      if (theme.suggestedRemediation) addAlertBox(ctx, theme.suggestedRemediation, 'info', 'Suggested Remediation');
      if (theme.estimatedDenialImpact) addKeyValue(ctx, 'Estimated Denial Impact', `$${theme.estimatedDenialImpact.toLocaleString()}`);
      addSpacer(ctx, 4);
      addDivider(ctx);
    });
  }

  // ── Correctable Patterns ──
  if (stats.correctablePatterns.length > 0) {
    addSectionHeader(ctx, 'Correctable Patterns', [22, 163, 74]);
    stats.correctablePatterns.forEach(p => {
      checkPage(ctx, 50);
      addSubtitle(ctx, `${p.title} — ${p.casesAffected} cases, $${p.estimatedRevenue.toLocaleString()} at risk`);
      addKeyValueGrid(ctx, [
        ['Root Cause', ROOT_CAUSE_LABELS[p.rootCause]],
        ['Correctable', p.isCorrectible ? 'Yes' : 'Requires further review'],
      ]);
      addBody(ctx, `Corrective action: ${p.correctiveAction}`);
      addSpacer(ctx, 4);
    });
    addDivider(ctx);
  }

  // ── High-Risk Behaviors ──
  if (stats.highRiskBehaviors.length > 0) {
    addSectionHeader(ctx, 'High-Risk Operational Behaviors', [185, 28, 28]);
    stats.highRiskBehaviors.forEach(b => {
      checkPage(ctx, 50);
      addSubtitle(ctx, `${b.title} — ${b.casesAffected} cases`);
      addBody(ctx, b.description);
      addAlertBox(ctx, b.suggestedAction, 'warning', 'Suggested Action');
      addSpacer(ctx, 4);
    });
    addDivider(ctx);
  }

  // ── Recommended Interventions ──
  if (stats.recommendedInterventions.length > 0) {
    addSectionHeader(ctx, 'Recommended Interventions');
    stats.recommendedInterventions.forEach(int => {
      checkPage(ctx, 60);
      const priorityColor = int.priority === 'high' ? [185, 28, 28] : int.priority === 'medium' ? [217, 119, 6] : [22, 163, 74];
      addSubtitle(ctx, `[${int.priority.toUpperCase()}] ${int.title}`);
      addKeyValueGrid(ctx, [
        ['Type', int.typeLabel],
        ['Implementation Effort', int.implementationEffort],
      ]);
      addBody(ctx, int.description);
      addKeyValue(ctx, 'Estimated Impact', int.estimatedImpact);
      if (int.affectedPatterns.length > 0) {
        int.affectedPatterns.forEach(p => addBullet(ctx, p));
      }
      addSpacer(ctx, 4);
      addDivider(ctx);
    });
  }

  // ── Top Vulnerabilities ──
  if (stats.topVulnerabilities.length > 0) {
    addSectionHeader(ctx, 'Top Vulnerabilities', [185, 28, 28]);
    stats.topVulnerabilities.forEach(v => addBullet(ctx, v));
    addSpacer(ctx, 6);
  }

  addFooter(ctx, 'Confidential — SOUPY Provider Readiness Report — For authorized recipients only');
  ctx.doc.save(`Provider_Readiness_${Date.now()}.pdf`);
}
