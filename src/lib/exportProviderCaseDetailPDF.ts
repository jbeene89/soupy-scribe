import type { AuditCase } from './types';
import type { ProviderCaseReview } from './providerTypes';
import {
  createPDFContext, addTitle, addSubtitle, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage,
} from './pdfHelpers';

const READINESS_LABELS: Record<string, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
  insufficient: 'Insufficient',
};

const VIABILITY_LABELS: Record<string, string> = {
  recommended: 'Recommended',
  conditional: 'Conditional',
  'not-recommended': 'Not Recommended',
};

const ACTION_LABELS: Record<string, string> = {
  'do-not-appeal': 'Do Not Appeal',
  'gather-records': 'Gather Additional Records',
  'recode-resubmit': 'Recode and Resubmit',
  'seek-compliance-review': 'Seek Compliance Review',
  'educate-staff': 'Staff Education',
};

export function exportProviderCaseDetailPDF(auditCase: AuditCase, review: ProviderCaseReview) {
  const ctx = createPDFContext();

  // ── Header ──
  addTitle(ctx, `Provider Readiness Report — ${auditCase.caseNumber}`, 18);
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 12);

  // ── Case Summary ──
  addTitle(ctx, 'Case Summary');
  addKeyValue(ctx, 'Case Number', auditCase.caseNumber);
  addKeyValue(ctx, 'Physician', `${auditCase.physicianName} (${auditCase.physicianId})`);
  addKeyValue(ctx, 'Patient ID', auditCase.patientId);
  addKeyValue(ctx, 'Date of Service', auditCase.dateOfService);
  addKeyValue(ctx, 'Claim Amount', `$${auditCase.claimAmount.toLocaleString()}`);
  addKeyValue(ctx, 'CPT Codes', auditCase.cptCodes.join(', '));
  addKeyValue(ctx, 'ICD-10 Codes', auditCase.icdCodes.join(', '));
  addKeyValue(ctx, 'Documentation Sufficiency', READINESS_LABELS[review.documentationSufficiency] || review.documentationSufficiency);
  addKeyValue(ctx, 'Timeline Consistency', READINESS_LABELS[review.timelineConsistency] || review.timelineConsistency);
  addSpacer(ctx, 12);

  // ── Documentation Assessments ──
  if (review.documentationAssessments.length > 0) {
    addTitle(ctx, 'Documentation Assessments');
    review.documentationAssessments.forEach(da => {
      checkPage(ctx, 80);
      addSubtitle(ctx, `${da.category} — ${READINESS_LABELS[da.status] || da.status}`);
      addBody(ctx, da.detail);
      addKeyValue(ctx, 'Why It Matters', da.whyItMatters);
      addKeyValue(ctx, 'Recommendation', da.recommendation);
      addSpacer(ctx, 6);
    });
    addSpacer(ctx, 8);
  }

  // ── Coding Vulnerabilities ──
  if (review.codingVulnerabilities.length > 0) {
    addTitle(ctx, 'Coding Vulnerabilities');
    review.codingVulnerabilities.forEach(cv => {
      checkPage(ctx, 60);
      addSubtitle(ctx, `${cv.code} — ${cv.issue}`);
      addKeyValue(ctx, 'Severity', READINESS_LABELS[cv.severity] || cv.severity);
      addKeyValue(ctx, 'Correctable', cv.isCorrectible ? 'Yes' : 'No');
      addKeyValue(ctx, 'Recommendation', cv.recommendation);
      addSpacer(ctx, 6);
    });
    addSpacer(ctx, 8);
  }

  // ── Appeal Viability Assessment ──
  const aa = review.appealAssessment;
  addTitle(ctx, 'Appeal Viability Assessment');
  addKeyValue(ctx, 'Viability', VIABILITY_LABELS[aa.viability] || aa.viability);
  addKeyValue(ctx, 'Estimated Success Rate', `${aa.estimatedSuccessRate}%`);
  addKeyValue(ctx, 'Estimated Effort', `${aa.estimatedEffortHours} hours`);
  addKeyValue(ctx, 'Recommended Action', ACTION_LABELS[aa.recommendedAction] || aa.recommendedAction);
  addBody(ctx, aa.actionRationale);
  addSpacer(ctx, 6);

  if (aa.strengths.length > 0) {
    addSubtitle(ctx, 'Strengths');
    aa.strengths.forEach(s => addBullet(ctx, s));
  }
  if (aa.weaknesses.length > 0) {
    addSubtitle(ctx, 'Weaknesses');
    aa.weaknesses.forEach(w => addBullet(ctx, w));
  }
  if (aa.missingSupport.length > 0) {
    addSubtitle(ctx, 'Missing Support');
    aa.missingSupport.forEach(m => addBullet(ctx, m));
  }
  addSpacer(ctx, 12);

  // ── Evidence Readiness ──
  if (review.evidenceReadiness.length > 0) {
    addTitle(ctx, 'Evidence Readiness');
    review.evidenceReadiness.forEach(er => {
      checkPage(ctx, 60);
      const statusTag = er.status === 'present' ? '✓' : er.status === 'missing' ? '✗' : '◐';
      addSubtitle(ctx, `${statusTag} ${er.record} [${er.category}]`);
      addKeyValue(ctx, 'Status', er.status.charAt(0).toUpperCase() + er.status.slice(1));
      addKeyValue(ctx, 'Essential for Appeal', er.essentialForAppeal ? 'Yes' : 'No');
      addKeyValue(ctx, 'Materially Improves Outcome', er.materiallyImproves ? 'Yes' : 'No');
      if (er.whyItMatters) addBody(ctx, er.whyItMatters);
      addSpacer(ctx, 4);
    });
    addSpacer(ctx, 8);
  }

  // ── Denial Pressure Points ──
  if (review.denialPressurePoints.length > 0) {
    addTitle(ctx, 'Denial Pressure Points');
    review.denialPressurePoints.forEach(dp => addBullet(ctx, dp));
    addSpacer(ctx, 8);
  }

  addFooter(ctx, 'Confidential — SOUPY Provider Readiness Case Report — For authorized recipients only');

  ctx.doc.save(`Provider_Case_Report_${auditCase.caseNumber}_${Date.now()}.pdf`);
}
