import type { AuditCase, AuditPosture } from './types';
import type {
  EvidenceSufficiency, Contradiction, ActionPathway,
  DecisionTrace, MinimalWinningPacket, ConfidenceFloorEvent,
} from './soupyEngineService';
import { deriveCaseSignals, evaluateExportReadiness } from './caseIntelligence';
import {
  createPDFContext, addDocumentHeader, addSectionHeader, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage, addScoreCards, addAlertBox,
  addDivider, addKeyValueGrid, addTable, addBadge, addSubtitle,
  riskColor, severityColor,
  type ScoreCardItem,
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

const POSTURE_LABELS: Record<AuditPosture, { title: string; subtitle: string; footer: string }> = {
  'payment-integrity': {
    title: 'Payment Integrity Case Report',
    subtitle: 'SOUPY ThinkTank — Multi-AI Consensus Audit',
    footer: 'Confidential — SOUPY Payment Integrity Case Report — For authorized recipients only',
  },
  'compliance-coaching': {
    title: 'Claim Accuracy Program — Case Report',
    subtitle: 'SOUPY ThinkTank — Documentation Accuracy Assessment',
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

  // ── Banner Header ──
  addDocumentHeader(ctx, `${labels.title} — ${auditCase.caseNumber}`, labels.subtitle);
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 6);

  // ── Case Overview (two-column grid) ──
  addSectionHeader(ctx, 'Case Overview');
  addKeyValueGrid(ctx, [
    ['Case Number', auditCase.caseNumber],
    ['Physician', `${auditCase.physicianName} (${auditCase.physicianId})`],
    ['Patient ID', auditCase.patientId],
    ['Date of Service', auditCase.dateOfService],
    ['Date Submitted', auditCase.dateSubmitted],
    ['Claim Amount', `$${auditCase.claimAmount.toLocaleString()}`],
    ['CPT Codes', auditCase.cptCodes.join(', ')],
    ['ICD-10 Codes', auditCase.icdCodes.join(', ')],
  ]);
  addKeyValue(ctx, 'Audit Mode', isCAP ? 'Claim Accuracy Program' : 'Payment Integrity');
  addSpacer(ctx, 8);

  // ── Disposition Alert ──
  const dispSeverity = signals.riskLevel === 'critical' || signals.riskLevel === 'high' ? 'error'
    : signals.riskLevel === 'medium' ? 'warning' : 'success';
  addAlertBox(ctx, signals.disposition.description, dispSeverity as any, signals.disposition.label);
  addSpacer(ctx, 4);

  // ── Score Cards (mirroring the app's metric row) ──
  const scoreCards: ScoreCardItem[] = [
    { label: 'Claim Risk', value: `${signals.riskScore}/100`, sublabel: signals.riskLevel.charAt(0).toUpperCase() + signals.riskLevel.slice(1), color: riskColor(signals.riskLevel) },
    { label: 'Automation Confidence', value: `${signals.confidence}%`, sublabel: signals.confidenceLabel, color: signals.confidence >= 70 ? 'green' : signals.confidence >= 40 ? 'amber' : 'red' },
    { label: 'Evidence Sufficiency', value: data.evidenceSuff ? `${Math.round(data.evidenceSuff.overall_score)}%` : 'N/A', sublabel: data.evidenceSuff?.is_defensible ? 'Defensible' : 'Insufficient', color: data.evidenceSuff && data.evidenceSuff.overall_score >= 50 ? 'green' : 'red' },
    { label: 'Consensus Integrity', value: `${signals.consensusScore}%`, sublabel: signals.consensusLabel, color: signals.consensusScore >= 70 ? 'green' : signals.consensusScore >= 40 ? 'amber' : 'red' },
  ];
  addScoreCards(ctx, scoreCards);

  // ── Human Review Triggers ──
  if (signals.humanReview.triggered) {
    addAlertBox(ctx, signals.humanReview.reasons.join(' • '), 'warning', 'Human Review Required');
    addSpacer(ctx, 4);
  }

  // ── Risk Factors ──
  const triggeredFactors = auditCase.riskScore?.factors.filter(f => f.triggered) || [];
  if (triggeredFactors.length > 0) {
    addSectionHeader(ctx, isCAP ? 'Claim Accuracy Findings' : 'Active Risk Factors', [185, 28, 28]);
    triggeredFactors.forEach(f => {
      checkPage(ctx, 60);
      addSubtitle(ctx, `${f.title} (weight: ${f.weight}${f.isDeterminative ? ' — DETERMINATIVE' : ''})`);
      addBody(ctx, f.whyItMatters);
      if (f.evidenceToConfirm.length > 0) {
        f.evidenceToConfirm.forEach(e => addBullet(ctx, e));
      }
      addSpacer(ctx, 4);
    });
    addDivider(ctx);
  }

  // ── AI Role Analyses ──
  if (auditCase.analyses.length > 0) {
    addSectionHeader(ctx, 'AI Role Analyses');
    const roleLabels: Record<string, string> = {
      builder: 'Builder (Clinical Analyst)',
      redteam: 'Red Team (Compliance Adversary)',
      analyst: 'Systems Analyst (Pattern Detective)',
      breaker: 'Frame Breaker (Perspective Challenger)',
    };

    auditCase.analyses.forEach(analysis => {
      checkPage(ctx, 80);
      const roleLabel = roleLabels[analysis.role] || analysis.role;

      // Role header with confidence badge
      addSubtitle(ctx, `${roleLabel} — ${analysis.model}`);
      const confColor = analysis.confidence >= 70 ? 'green' : analysis.confidence >= 40 ? 'amber' : 'red';
      addBadge(ctx, `${analysis.confidence}% confidence`, confColor);
      ctx.y += 8;

      if (analysis.perspectiveStatement) {
        addBody(ctx, `"${analysis.perspectiveStatement}"`);
      }
      if (analysis.keyInsights.length > 0) {
        addBody(ctx, 'Key Insights:');
        analysis.keyInsights.forEach(i => addBullet(ctx, i));
      }
      if (analysis.assumptions && analysis.assumptions.length > 0) {
        addBody(ctx, 'Assumptions:');
        analysis.assumptions.forEach(a => addBullet(ctx, a));
      }
      if (analysis.violations.length > 0) {
        const violLabel = isCAP ? 'Accuracy Findings' : 'Violations';
        addBody(ctx, `${violLabel} (${analysis.violations.length}):`);
        analysis.violations.forEach(v => {
          const sev = severityColor(v.severity);
          addBullet(ctx, `[${v.severity.toUpperCase()}] ${v.code} — ${v.type}: ${v.description}`);
        });
      }
      if (analysis.overallAssessment) {
        addBody(ctx, `Assessment: ${analysis.overallAssessment}`);
      }
      addSpacer(ctx, 6);
      addDivider(ctx);
    });
  }

  // ── Contradictions ──
  if (data.contradictions && data.contradictions.length > 0) {
    addSectionHeader(ctx, isCAP ? 'Consistency Findings' : 'Contradictions Detected', [217, 119, 6]);
    data.contradictions.forEach(c => {
      addBullet(ctx, `[${c.severity.toUpperCase()}] ${c.contradiction_type}: ${c.description}`);
      if (c.explanation) addBody(ctx, `  → ${c.explanation}`);
    });
    addSpacer(ctx, 6);
  }

  // ── Evidence Sufficiency ──
  if (data.evidenceSuff) {
    addSectionHeader(ctx, 'Evidence Sufficiency');
    addKeyValueGrid(ctx, [
      ['Overall Score', `${Math.round(data.evidenceSuff.overall_score)}%`],
      ['Defensible', data.evidenceSuff.is_defensible ? 'Yes' : 'No'],
      ['Under-Supported', data.evidenceSuff.is_under_supported ? 'Yes' : 'No'],
      ['Appeal Defense Sufficiency', `${data.evidenceSuff.sufficiency_for_appeal_defense ?? 'N/A'}%`],
    ]);
    const missing = data.evidenceSuff.missing_evidence as any[];
    if (Array.isArray(missing) && missing.length > 0) {
      addAlertBox(ctx, missing.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' • '), 'warning', 'Missing Evidence');
    }
    addSpacer(ctx, 6);
  }

  // ── Action Pathway ──
  if (data.actionPathway) {
    addSectionHeader(ctx, 'Recommended Action', [22, 163, 74]);
    addAlertBox(ctx, data.actionPathway.action_rationale, 'info', data.actionPathway.recommended_action);
    addKeyValueGrid(ctx, [
      ['Confidence', `${data.actionPathway.confidence_in_recommendation}%`],
      ['Human Review Required', data.actionPathway.is_human_review_required ? 'Yes' : 'No'],
    ]);
    addSpacer(ctx, 6);
  }

  // ── Decision Trace ──
  if (data.decisionTrace) {
    addSectionHeader(ctx, 'Decision Trace');
    addKeyValueGrid(ctx, [
      ['Final Recommendation', data.decisionTrace.final_recommendation || 'N/A'],
      ['Consensus Grade', data.decisionTrace.consensus_integrity_grade || 'N/A'],
      ['Confidence at Completion', `${data.decisionTrace.confidence_at_completion}%`],
      ['Rationale', ''],
    ]);
    if (data.decisionTrace.recommendation_rationale) {
      addBody(ctx, data.decisionTrace.recommendation_rationale);
    }
    addSpacer(ctx, 6);
  }

  // ── Minimal Winning Packet ──
  if (data.winningPacket) {
    addSectionHeader(ctx, isCAP ? 'Priority Documentation Packet' : 'Minimal Winning Packet');
    if (data.winningPacket.top_priority_item) {
      addAlertBox(ctx, data.winningPacket.top_priority_item, 'info', 'Top Priority Item');
    }
    addKeyValueGrid(ctx, [
      ['Curable Items', String(data.winningPacket.estimated_curable_count || 0)],
      ['Not Worth Pursuing', String(data.winningPacket.estimated_not_worth_chasing || 0)],
    ]);
    const checklist = data.winningPacket.checklist as any[];
    if (Array.isArray(checklist) && checklist.length > 0) {
      addBody(ctx, 'Checklist:');
      checklist.forEach(item => addBullet(ctx, typeof item === 'string' ? item : (item.description || JSON.stringify(item))));
    }
    addSpacer(ctx, 6);
  }

  // ── Confidence Floor Events ──
  if (data.floorEvents && data.floorEvents.length > 0) {
    addSectionHeader(ctx, 'Confidence Floor Breaches', [185, 28, 28]);
    const rows = data.floorEvents.map(e => [
      e.floor_type,
      String(e.actual_value),
      String(e.threshold_value),
      e.routed_to_human ? 'Yes' : 'No',
      e.explanation || '',
    ]);
    addTable(ctx, [
      { header: 'Type', width: 100 },
      { header: 'Actual', width: 60, align: 'center' },
      { header: 'Threshold', width: 70, align: 'center' },
      { header: 'Human', width: 50, align: 'center' },
      { header: 'Explanation', width: ctx.maxWidth - 280 },
    ], rows);
    addSpacer(ctx, 6);
  }

  // ── Export Readiness ──
  const readiness = evaluateExportReadiness(auditCase, { evidenceSuff: data.evidenceSuff, contradictions: data.contradictions });
  addSectionHeader(ctx, 'Export Readiness');
  const readinessColor = readiness.label.toLowerCase().includes('ready') ? 'success' : 'warning';
  addAlertBox(ctx, readiness.description, readinessColor as any, readiness.label);
  if (readiness.missingItems.length > 0) {
    readiness.missingItems.forEach(m => addBullet(ctx, m));
  }

  addFooter(ctx, labels.footer);

  const modeTag = isCAP ? 'CAP' : 'PI';
  ctx.doc.save(`Case_Report_${modeTag}_${auditCase.caseNumber}_${Date.now()}.pdf`);
}
