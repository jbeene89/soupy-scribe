import jsPDF from 'jspdf';
import type { AuditCase } from './types';
import type {
  EvidenceSufficiency, Contradiction, ActionPathway,
  DecisionTrace, MinimalWinningPacket, ConfidenceFloorEvent,
} from './soupyEngineService';
import { deriveCaseSignals, evaluateExportReadiness, deriveActionPath } from './caseIntelligence';

interface CaseReportData {
  auditCase: AuditCase;
  evidenceSuff?: EvidenceSufficiency | null;
  contradictions?: Contradiction[];
  actionPathway?: ActionPathway | null;
  decisionTrace?: DecisionTrace | null;
  winningPacket?: MinimalWinningPacket | null;
  floorEvents?: ConfidenceFloorEvent[];
}

export function exportCaseReportPDF(data: CaseReportData) {
  const { auditCase } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  let y = 50;

  const addTitle = (text: string, size = 16) => {
    checkPage(size + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(30, 58, 95);
    doc.text(text, margin, y);
    y += size + 8;
  };

  const addSubtitle = (text: string, size = 12) => {
    checkPage(size + 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(55, 80, 120);
    doc.text(text, margin, y);
    y += size + 6;
  };

  const addBody = (text: string, size = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, maxWidth);
    checkPage(lines.length * (size + 3) + 8);
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 4;
  };

  const addBullet = (text: string, size = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, maxWidth - 14);
    checkPage(lines.length * (size + 3) + 4);
    doc.text('•', margin, y);
    doc.text(lines, margin + 14, y);
    y += lines.length * (size + 3) + 2;
  };

  const addKeyValue = (key: string, value: string, size = 10) => {
    checkPage(size + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(80, 80, 80);
    doc.text(`${key}:`, margin, y);
    const keyWidth = doc.getTextWidth(`${key}: `);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.text(value, margin + keyWidth, y);
    y += size + 5;
  };

  const addSpacer = (h = 10) => { y += h; };

  const checkPage = (needed = 60) => {
    if (y + needed > pageHeight - 50) {
      doc.addPage();
      y = 50;
    }
  };

  const signals = deriveCaseSignals(auditCase, {
    contradictions: data.contradictions,
    evidenceSuff: data.evidenceSuff,
    floorEvents: data.floorEvents,
    actionPathway: data.actionPathway,
  });

  // ── Header ──
  addTitle(`SOUPY Case Report — ${auditCase.caseNumber}`, 18);
  addBody(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(12);

  // ── Case Overview ──
  addTitle('Case Overview');
  addKeyValue('Case Number', auditCase.caseNumber);
  addKeyValue('Physician', `${auditCase.physicianName} (${auditCase.physicianId})`);
  addKeyValue('Patient ID', auditCase.patientId);
  addKeyValue('Date of Service', auditCase.dateOfService);
  addKeyValue('Date Submitted', auditCase.dateSubmitted);
  addKeyValue('Claim Amount', `$${auditCase.claimAmount.toLocaleString()}`);
  addKeyValue('CPT Codes', auditCase.cptCodes.join(', '));
  addKeyValue('ICD-10 Codes', auditCase.icdCodes.join(', '));
  addSpacer(12);

  // ── Risk Summary ──
  addTitle('Risk Assessment');
  addKeyValue('Risk Score', `${signals.riskScore}/100 (${signals.riskLevel.toUpperCase()})`);
  addKeyValue('Consensus', `${signals.consensusScore}% — ${signals.consensusLabel}`);
  addKeyValue('Confidence', `${signals.confidence}% — ${signals.confidenceLabel}`);
  addKeyValue('Data Completeness', `${signals.dataCompleteness}%`);
  addKeyValue('Disposition', signals.disposition.label);
  addBody(signals.disposition.description);
  addKeyValue('Review Complexity', signals.reviewComplexity.label);

  if (signals.humanReview.triggered) {
    addSpacer(4);
    addSubtitle('Human Review Triggers');
    signals.humanReview.reasons.forEach(r => addBullet(r));
  }
  addSpacer(12);

  // ── Risk Factors ──
  const triggeredFactors = auditCase.riskScore?.factors.filter(f => f.triggered) || [];
  if (triggeredFactors.length > 0) {
    addTitle('Active Risk Factors');
    triggeredFactors.forEach(f => {
      addSubtitle(`${f.title} (weight: ${f.weight}${f.isDeterminative ? ', DETERMINATIVE' : ''})`);
      addBody(f.whyItMatters);
      if (f.evidenceToConfirm.length > 0) {
        addBody('Evidence to confirm:');
        f.evidenceToConfirm.forEach(e => addBullet(e));
      }
      addSpacer(4);
    });
    addSpacer(8);
  }

  // ── AI Role Analyses ──
  if (auditCase.analyses.length > 0) {
    addTitle('AI Role Analyses');
    auditCase.analyses.forEach(analysis => {
      const roleLabel = analysis.role === 'builder' ? 'Builder (Clinical Analyst)' :
        analysis.role === 'redteam' ? 'Red Team (Compliance Adversary)' :
        analysis.role === 'analyst' ? 'Systems Analyst (Pattern Detective)' :
        'Frame Breaker (Perspective Challenger)';
      addSubtitle(`${roleLabel} — ${analysis.model} (${analysis.confidence}% confidence)`);
      if (analysis.perspectiveStatement) addBody(analysis.perspectiveStatement);
      if (analysis.keyInsights.length > 0) {
        addBody('Key Insights:');
        analysis.keyInsights.forEach(i => addBullet(i));
      }
      if (analysis.violations.length > 0) {
        addBody(`Violations (${analysis.violations.length}):`);
        analysis.violations.forEach(v => {
          addBullet(`[${v.severity.toUpperCase()}] ${v.code} — ${v.type}: ${v.description}`);
        });
      }
      addSpacer(8);
    });
  }

  // ── Contradictions ──
  if (data.contradictions && data.contradictions.length > 0) {
    addTitle('Contradictions Detected');
    data.contradictions.forEach(c => {
      addBullet(`[${c.severity.toUpperCase()}] ${c.contradiction_type}: ${c.description}`);
      if (c.explanation) addBody(`  → ${c.explanation}`);
    });
    addSpacer(8);
  }

  // ── Evidence Sufficiency ──
  if (data.evidenceSuff) {
    addTitle('Evidence Sufficiency');
    addKeyValue('Overall Score', `${Math.round(data.evidenceSuff.overall_score)}%`);
    addKeyValue('Defensible', data.evidenceSuff.is_defensible ? 'Yes' : 'No');
    addKeyValue('Under-Supported', data.evidenceSuff.is_under_supported ? 'Yes' : 'No');
    const missing = data.evidenceSuff.missing_evidence as any[];
    if (Array.isArray(missing) && missing.length > 0) {
      addBody('Missing Evidence:');
      missing.forEach(m => addBullet(typeof m === 'string' ? m : JSON.stringify(m)));
    }
    addSpacer(8);
  }

  // ── Action Pathway ──
  if (data.actionPathway) {
    addTitle('Recommended Action');
    addKeyValue('Action', data.actionPathway.recommended_action);
    addBody(data.actionPathway.action_rationale);
    addKeyValue('Confidence', `${data.actionPathway.confidence_in_recommendation}%`);
    addKeyValue('Human Review Required', data.actionPathway.is_human_review_required ? 'Yes' : 'No');
    addSpacer(8);
  }

  // ── Decision Trace ──
  if (data.decisionTrace) {
    addTitle('Decision Trace');
    addKeyValue('Final Recommendation', data.decisionTrace.final_recommendation || 'N/A');
    addKeyValue('Consensus Integrity Grade', data.decisionTrace.consensus_integrity_grade || 'N/A');
    addKeyValue('Confidence at Completion', `${data.decisionTrace.confidence_at_completion}%`);
    if (data.decisionTrace.recommendation_rationale) {
      addBody(data.decisionTrace.recommendation_rationale);
    }
    addSpacer(8);
  }

  // ── Minimal Winning Packet ──
  if (data.winningPacket) {
    addTitle('Minimal Winning Packet');
    if (data.winningPacket.top_priority_item) {
      addKeyValue('Top Priority', data.winningPacket.top_priority_item);
    }
    addKeyValue('Curable Items', String(data.winningPacket.estimated_curable_count || 0));
    addKeyValue('Not Worth Chasing', String(data.winningPacket.estimated_not_worth_chasing || 0));
    const checklist = data.winningPacket.checklist as any[];
    if (Array.isArray(checklist) && checklist.length > 0) {
      addBody('Checklist:');
      checklist.forEach(item => addBullet(typeof item === 'string' ? item : (item.description || JSON.stringify(item))));
    }
    addSpacer(8);
  }

  // ── Confidence Floor Events ──
  if (data.floorEvents && data.floorEvents.length > 0) {
    addTitle('Confidence Floor Breaches');
    data.floorEvents.forEach(e => {
      addBullet(`${e.floor_type}: actual ${e.actual_value} < threshold ${e.threshold_value}${e.routed_to_human ? ' → Routed to human' : ''}`);
      if (e.explanation) addBody(`  ${e.explanation}`);
    });
    addSpacer(8);
  }

  // ── Export Readiness ──
  const readiness = evaluateExportReadiness(auditCase, { evidenceSuff: data.evidenceSuff, contradictions: data.contradictions });
  addTitle('Export Readiness');
  addKeyValue('Status', readiness.label);
  addBody(readiness.description);
  if (readiness.missingItems.length > 0) {
    readiness.missingItems.forEach(m => addBullet(m));
  }

  // ── Footer ──
  addSpacer(20);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Confidential — SOUPY ThinkTank Case Report — For authorized recipients only', margin, y);

  doc.save(`Case_Report_${auditCase.caseNumber}_${Date.now()}.pdf`);
}
