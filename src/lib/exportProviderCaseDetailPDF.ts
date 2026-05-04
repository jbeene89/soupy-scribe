import type { AuditCase } from './types';
import type { ProviderCaseReview } from './providerTypes';
import {
  createPDFContext, addDocumentHeader, addSectionHeader, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage, addScoreCards, addAlertBox,
  addDivider, addKeyValueGrid, addTable, addSubtitle, addBadge,
  riskColor, severityColor,
  type ScoreCardItem,
} from './pdfHelpers';

const READINESS_LABELS: Record<string, string> = {
  strong: 'Strong', moderate: 'Moderate', weak: 'Weak', insufficient: 'Insufficient',
};
const VIABILITY_LABELS: Record<string, string> = {
  recommended: 'Recommended', conditional: 'Conditional', 'not-recommended': 'Not Recommended',
};
const ACTION_LABELS: Record<string, string> = {
  'do-not-appeal': 'Do Not Appeal', 'gather-records': 'Gather Additional Records',
  'recode-resubmit': 'Recode and Resubmit', 'seek-compliance-review': 'Seek Compliance Review',
  'educate-staff': 'Staff Education',
};

export const PROVIDER_CASE_SECTIONS = [
  { id: 'summary', label: 'Case Summary & Score Cards', description: 'Header, IDs, key scores' },
  { id: 'doc-assessments', label: 'Documentation Assessments', description: 'Status + recommendation per category' },
  { id: 'coding', label: 'Coding Vulnerabilities', description: 'Code-level issues + fixes' },
  { id: 'appeal', label: 'Appeal Viability', description: 'Success rate, effort, action' },
  { id: 'evidence', label: 'Evidence Readiness', description: 'Records present / missing' },
  { id: 'pressure', label: 'Denial Pressure Points', description: 'Where payers will push' },
];

export function exportProviderCaseDetailPDF(
  auditCase: AuditCase,
  review: ProviderCaseReview,
  sectionIds?: string[],
) {
  const ctx = createPDFContext();
  const allIds = PROVIDER_CASE_SECTIONS.map(s => s.id);
  const enabled = new Set(!sectionIds || sectionIds.length === 0 ? allIds : sectionIds);
  const has = (id: string) => enabled.has(id);

  // ── Banner ──
  addDocumentHeader(ctx, `Provider Readiness — ${auditCase.caseNumber}`, 'SOUPY ThinkTank — Case-Level Documentation & Coding Analysis');
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 8);

  if (has('summary')) {
  // ── Score Cards ──
  const docColor = review.documentationSufficiency === 'strong' ? 'green' : review.documentationSufficiency === 'moderate' ? 'amber' : 'red';
  const tlColor = review.timelineConsistency === 'strong' ? 'green' : review.timelineConsistency === 'moderate' ? 'amber' : 'red';
  addScoreCards(ctx, [
    { label: 'Claim Amount', value: `$${auditCase.claimAmount.toLocaleString()}`, color: 'brand' },
    { label: 'Doc Sufficiency', value: READINESS_LABELS[review.documentationSufficiency] || review.documentationSufficiency, color: docColor },
    { label: 'Timeline', value: READINESS_LABELS[review.timelineConsistency] || review.timelineConsistency, color: tlColor },
    { label: 'Appeal Viability', value: VIABILITY_LABELS[review.appealAssessment.viability] || review.appealAssessment.viability, sublabel: `${review.appealAssessment.estimatedSuccessRate}%`, color: review.appealAssessment.viability === 'recommended' ? 'green' : review.appealAssessment.viability === 'conditional' ? 'amber' : 'red' },
  ]);

  // ── Case Info ──
  addSectionHeader(ctx, 'Case Summary');
  addKeyValueGrid(ctx, [
    ['Case Number', auditCase.caseNumber],
    ['Physician', `${auditCase.physicianName} (${auditCase.physicianId})`],
    ['Patient ID', auditCase.patientId],
    ['Date of Service', auditCase.dateOfService],
    ['CPT Codes', auditCase.cptCodes.join(', ')],
    ['ICD-10 Codes', auditCase.icdCodes.join(', ')],
  ]);
  addSpacer(ctx, 8);
  }

  // ── Documentation Assessments ──
  if (has('doc-assessments') && review.documentationAssessments.length > 0) {
    addSectionHeader(ctx, 'Documentation Assessments');
    const rows = review.documentationAssessments.map(da => [
      da.category,
      READINESS_LABELS[da.status] || da.status,
      da.detail,
      da.recommendation,
    ]);
    addTable(ctx, [
      { header: 'Category', width: 100 },
      { header: 'Status', width: 70, align: 'center' },
      { header: 'Detail', width: ctx.maxWidth - 270 },
      { header: 'Recommendation', width: 100 },
    ], rows);

    // Expanded details for each
    review.documentationAssessments.forEach(da => {
      if (da.whyItMatters) {
        checkPage(ctx, 40);
        addSubtitle(ctx, da.category);
        addBody(ctx, `Why it matters: ${da.whyItMatters}`);
        addSpacer(ctx, 3);
      }
    });
    addSpacer(ctx, 6);
  }

  // ── Coding Vulnerabilities ──
  if (has('coding') && review.codingVulnerabilities.length > 0) {
    addSectionHeader(ctx, 'Coding Vulnerabilities', [185, 28, 28]);
    review.codingVulnerabilities.forEach(cv => {
      checkPage(ctx, 50);
      addSubtitle(ctx, `${cv.code} — ${cv.issue}`);
      addKeyValueGrid(ctx, [
        ['Severity', (READINESS_LABELS[cv.severity] || cv.severity).toUpperCase()],
        ['Correctable', cv.isCorrectible ? 'Yes' : 'No'],
      ]);
      addAlertBox(ctx, cv.recommendation, cv.severity === 'weak' || cv.severity === 'insufficient' ? 'error' : 'warning', 'Recommendation');
      addSpacer(ctx, 4);
    });
    addDivider(ctx);
  }

  // ── Appeal Viability ──
  if (has('appeal')) {
  const aa = review.appealAssessment;
  addSectionHeader(ctx, 'Appeal Viability Assessment', aa.viability === 'recommended' ? [22, 163, 74] : aa.viability === 'conditional' ? [217, 119, 6] : [185, 28, 28]);

  addScoreCards(ctx, [
    { label: 'Success Rate', value: `${aa.estimatedSuccessRate}%`, color: aa.estimatedSuccessRate >= 60 ? 'green' : aa.estimatedSuccessRate >= 30 ? 'amber' : 'red' },
    { label: 'Effort Hours', value: String(aa.estimatedEffortHours), color: 'blue' },
    { label: 'Recommended Action', value: ACTION_LABELS[aa.recommendedAction] || aa.recommendedAction, color: 'brand' },
  ]);

  addBody(ctx, aa.actionRationale);
  addSpacer(ctx, 4);

  if (aa.strengths.length > 0) {
    addAlertBox(ctx, aa.strengths.join(' • '), 'success', 'Strengths');
  }
  if (aa.weaknesses.length > 0) {
    addAlertBox(ctx, aa.weaknesses.join(' • '), 'warning', 'Weaknesses');
  }
  if (aa.missingSupport.length > 0) {
    addAlertBox(ctx, aa.missingSupport.join(' • '), 'error', 'Missing Support');
  }
  addSpacer(ctx, 6);
  }

  // ── Evidence Readiness ──
  if (has('evidence') && review.evidenceReadiness.length > 0) {
    addSectionHeader(ctx, 'Evidence Readiness');
    const rows = review.evidenceReadiness.map(er => [
      er.status === 'present' ? '✓' : er.status === 'missing' ? '✗' : '◐',
      er.record,
      er.category,
      er.essentialForAppeal ? 'Yes' : 'No',
      er.materiallyImproves ? 'Yes' : 'No',
    ]);
    addTable(ctx, [
      { header: '', width: 24, align: 'center' },
      { header: 'Record', width: ctx.maxWidth * 0.35 },
      { header: 'Category', width: ctx.maxWidth * 0.2 },
      { header: 'Essential', width: ctx.maxWidth * 0.15, align: 'center' },
      { header: 'Material', width: ctx.maxWidth * 0.3 - 24, align: 'center' },
    ], rows);

    // Expand missing items
    const missingRecords = review.evidenceReadiness.filter(er => er.status === 'missing');
    if (missingRecords.length > 0) {
      addAlertBox(ctx, missingRecords.map(r => `${r.record}: ${r.whyItMatters || 'Required for complete case'}`).join(' • '), 'error', `${missingRecords.length} Missing Records`);
    }
    addSpacer(ctx, 6);
  }

  // ── Denial Pressure Points ──
  if (has('pressure') && review.denialPressurePoints.length > 0) {
    addSectionHeader(ctx, 'Denial Pressure Points', [217, 119, 6]);
    review.denialPressurePoints.forEach(dp => addBullet(ctx, dp));
    addSpacer(ctx, 6);
  }

  addFooter(ctx, 'Confidential — SOUPY Provider Readiness Case Report — For authorized recipients only');
  ctx.doc.save(`Provider_Case_Report_${auditCase.caseNumber}_${Date.now()}.pdf`);
}
