import type { AuditCase, AuditPosture } from './types';
import type {
  EvidenceSufficiency, Contradiction, ActionPathway,
  DecisionTrace, MinimalWinningPacket, ConfidenceFloorEvent,
} from './soupyEngineService';
import { deriveCaseSignals, evaluateExportReadiness } from './caseIntelligence';
import {
  createPDFContext, addTitle, addSubtitle, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage,
} from './pdfHelpers';

interface CaseReportData {
  auditCase: AuditCase;
  evidenceSuff?: EvidenceSufficiency | null;
  contradictions?: Contradiction[];
  actionPathway?: ActionPathway | null;
  decisionTrace?: DecisionTrace | null;
  winningPacket?: MinimalWinningPacket | null;
  floorEvents?: ConfidenceFloorEvent[];
  posture?: AuditPosture;
}

const POSTURE_LABELS: Record<AuditPosture, { title: string; footer: string }> = {
  'payment-integrity': {
    title: 'Payment Integrity Case Report',
    footer: 'Confidential — SOUPY Payment Integrity Case Report — For authorized recipients only',
  },
  'compliance-coaching': {
    title: 'Claim Accuracy Program — Case Report',
    footer: 'Confidential — SOUPY Claim Accuracy Program Case Report — For authorized recipients only',
  },
};

export function exportCaseReportPDF(data: CaseReportData) {
  const { auditCase, posture = 'payment-integrity' } = data;
  const ctx = createPDFContext();
  const labels = POSTURE_LABELS[posture];
  const isCAP = posture === 'compliance-coaching';

  const signals = deriveCaseSignals(auditCase, {
    contradictions: data.contradictions,
    evidenceSuff: data.evidenceSuff,
    floorEvents: data.floorEvents,
    actionPathway: data.actionPathway,
  });

  // ── Header ──
  addTitle(ctx, `${labels.title} — ${auditCase.caseNumber}`, 18);
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 12);

  // ── Case Overview ──
  addTitle(ctx, 'Case Overview');
  addKeyValue(ctx, 'Case Number', auditCase.caseNumber);
  addKeyValue(ctx, 'Physician', `${auditCase.physicianName} (${auditCase.physicianId})`);
  addKeyValue(ctx, 'Patient ID', auditCase.patientId);
  addKeyValue(ctx, 'Date of Service', auditCase.dateOfService);
  addKeyValue(ctx, 'Date Submitted', auditCase.dateSubmitted);
  addKeyValue(ctx, 'Claim Amount', `$${auditCase.claimAmount.toLocaleString()}`);
  addKeyValue(ctx, 'CPT Codes', auditCase.cptCodes.join(', '));
  addKeyValue(ctx, 'ICD-10 Codes', auditCase.icdCodes.join(', '));
  addKeyValue(ctx, 'Audit Mode', isCAP ? 'Claim Accuracy Program' : 'Payment Integrity');
  addSpacer(ctx, 12);

  // ── Risk Summary ──
  addTitle(ctx, isCAP ? 'Compliance Assessment' : 'Risk Assessment');
  addKeyValue(ctx, isCAP ? 'Accuracy Score' : 'Risk Score', `${signals.riskScore}/100 (${signals.riskLevel.toUpperCase()})`);
  addKeyValue(ctx, 'Consensus', `${signals.consensusScore}% — ${signals.consensusLabel}`);
  addKeyValue(ctx, 'Confidence', `${signals.confidence}% — ${signals.confidenceLabel}`);
  addKeyValue(ctx, 'Data Completeness', `${signals.dataCompleteness}%`);
  addKeyValue(ctx, 'Disposition', signals.disposition.label);
  addBody(ctx, signals.disposition.description);
  addKeyValue(ctx, 'Review Complexity', signals.reviewComplexity.label);

  if (signals.humanReview.triggered) {
    addSpacer(ctx, 4);
    addSubtitle(ctx, 'Human Review Triggers');
    signals.humanReview.reasons.forEach(r => addBullet(ctx, r));
  }
  addSpacer(ctx, 12);

  // ── Risk Factors ──
  const triggeredFactors = auditCase.riskScore?.factors.filter(f => f.triggered) || [];
  if (triggeredFactors.length > 0) {
    addTitle(ctx, isCAP ? 'Claim Accuracy Findings' : 'Active Risk Factors');
    triggeredFactors.forEach(f => {
      addSubtitle(ctx, `${f.title} (weight: ${f.weight}${f.isDeterminative ? ', DETERMINATIVE' : ''})`);
      addBody(ctx, f.whyItMatters);
      if (f.evidenceToConfirm.length > 0) {
        addBody(ctx, isCAP ? 'Supporting documentation needed:' : 'Evidence to confirm:');
        f.evidenceToConfirm.forEach(e => addBullet(ctx, e));
      }
      addSpacer(ctx, 4);
    });
    addSpacer(ctx, 8);
  }

  // ── AI Role Analyses ──
  if (auditCase.analyses.length > 0) {
    addTitle(ctx, 'AI Role Analyses');
    auditCase.analyses.forEach(analysis => {
      const roleLabel = analysis.role === 'builder' ? 'Builder (Clinical Analyst)' :
        analysis.role === 'redteam' ? 'Red Team (Compliance Adversary)' :
        analysis.role === 'analyst' ? 'Systems Analyst (Pattern Detective)' :
        'Frame Breaker (Perspective Challenger)';
      addSubtitle(ctx, `${roleLabel} — ${analysis.model} (${analysis.confidence}% confidence)`);
      if (analysis.perspectiveStatement) addBody(ctx, analysis.perspectiveStatement);
      if (analysis.keyInsights.length > 0) {
        addBody(ctx, 'Key Insights:');
        analysis.keyInsights.forEach(i => addBullet(ctx, i));
      }
      if (analysis.violations.length > 0) {
        addBody(ctx, isCAP ? `Accuracy Findings (${analysis.violations.length}):` : `Violations (${analysis.violations.length}):`);
        analysis.violations.forEach(v => {
          addBullet(ctx, `[${v.severity.toUpperCase()}] ${v.code} — ${v.type}: ${v.description}`);
        });
      }
      addSpacer(ctx, 8);
    });
  }

  // ── Contradictions ──
  if (data.contradictions && data.contradictions.length > 0) {
    addTitle(ctx, isCAP ? 'Consistency Findings' : 'Contradictions Detected');
    data.contradictions.forEach(c => {
      addBullet(ctx, `[${c.severity.toUpperCase()}] ${c.contradiction_type}: ${c.description}`);
      if (c.explanation) addBody(ctx, `  → ${c.explanation}`);
    });
    addSpacer(ctx, 8);
  }

  // ── Evidence Sufficiency ──
  if (data.evidenceSuff) {
    addTitle(ctx, 'Evidence Sufficiency');
    addKeyValue(ctx, 'Overall Score', `${Math.round(data.evidenceSuff.overall_score)}%`);
    addKeyValue(ctx, 'Defensible', data.evidenceSuff.is_defensible ? 'Yes' : 'No');
    addKeyValue(ctx, 'Under-Supported', data.evidenceSuff.is_under_supported ? 'Yes' : 'No');
    const missing = data.evidenceSuff.missing_evidence as any[];
    if (Array.isArray(missing) && missing.length > 0) {
      addBody(ctx, 'Missing Evidence:');
      missing.forEach(m => addBullet(ctx, typeof m === 'string' ? m : JSON.stringify(m)));
    }
    addSpacer(ctx, 8);
  }

  // ── Action Pathway ──
  if (data.actionPathway) {
    addTitle(ctx, 'Recommended Action');
    addKeyValue(ctx, 'Action', data.actionPathway.recommended_action);
    addBody(ctx, data.actionPathway.action_rationale);
    addKeyValue(ctx, 'Confidence', `${data.actionPathway.confidence_in_recommendation}%`);
    addKeyValue(ctx, 'Human Review Required', data.actionPathway.is_human_review_required ? 'Yes' : 'No');
    addSpacer(ctx, 8);
  }

  // ── Decision Trace ──
  if (data.decisionTrace) {
    addTitle(ctx, 'Decision Trace');
    addKeyValue(ctx, 'Final Recommendation', data.decisionTrace.final_recommendation || 'N/A');
    addKeyValue(ctx, 'Consensus Integrity Grade', data.decisionTrace.consensus_integrity_grade || 'N/A');
    addKeyValue(ctx, 'Confidence at Completion', `${data.decisionTrace.confidence_at_completion}%`);
    if (data.decisionTrace.recommendation_rationale) {
      addBody(ctx, data.decisionTrace.recommendation_rationale);
    }
    addSpacer(ctx, 8);
  }

  // ── Minimal Winning Packet ──
  if (data.winningPacket) {
    addTitle(ctx, isCAP ? 'Priority Documentation Packet' : 'Minimal Winning Packet');
    if (data.winningPacket.top_priority_item) {
      addKeyValue(ctx, 'Top Priority', data.winningPacket.top_priority_item);
    }
    addKeyValue(ctx, 'Curable Items', String(data.winningPacket.estimated_curable_count || 0));
    addKeyValue(ctx, 'Not Worth Pursuing', String(data.winningPacket.estimated_not_worth_chasing || 0));
    const checklist = data.winningPacket.checklist as any[];
    if (Array.isArray(checklist) && checklist.length > 0) {
      addBody(ctx, 'Checklist:');
      checklist.forEach(item => addBullet(ctx, typeof item === 'string' ? item : (item.description || JSON.stringify(item))));
    }
    addSpacer(ctx, 8);
  }

  // ── Confidence Floor Events ──
  if (data.floorEvents && data.floorEvents.length > 0) {
    addTitle(ctx, 'Confidence Floor Breaches');
    data.floorEvents.forEach(e => {
      addBullet(ctx, `${e.floor_type}: actual ${e.actual_value} < threshold ${e.threshold_value}${e.routed_to_human ? ' → Routed to human' : ''}`);
      if (e.explanation) addBody(ctx, `  ${e.explanation}`);
    });
    addSpacer(ctx, 8);
  }

  // ── Export Readiness ──
  const readiness = evaluateExportReadiness(auditCase, { evidenceSuff: data.evidenceSuff, contradictions: data.contradictions });
  addTitle(ctx, 'Export Readiness');
  addKeyValue(ctx, 'Status', readiness.label);
  addBody(ctx, readiness.description);
  if (readiness.missingItems.length > 0) {
    readiness.missingItems.forEach(m => addBullet(ctx, m));
  }

  addFooter(ctx, labels.footer);

  const modeTag = isCAP ? 'CAP' : 'PI';
  ctx.doc.save(`Case_Report_${modeTag}_${auditCase.caseNumber}_${Date.now()}.pdf`);
}
