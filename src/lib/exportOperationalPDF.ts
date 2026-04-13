import type { ORReadinessEvent, TriageAccuracyEvent, PostOpFlowEvent } from './operationalTypes';
import { OR_EVENT_TYPES, CLASSIFICATION_OPTIONS, FORESEEABILITY_OPTIONS, DELAY_CATEGORY_OPTIONS, estimateEventCost } from './operationalTypes';
import {
  createPDFContext, addDocumentHeader, addSectionHeader, addBody, addBullet,
  addKeyValue, addSpacer, addFooter, checkPage, addScoreCards, addAlertBox,
  addDivider, addTable, addBadge, addSubtitle,
  riskColor, type ScoreCardItem, type PDFContext,
} from './pdfHelpers';
import type { AuditPosture } from './types';

const POSTURE_FOOTER: Record<AuditPosture, string> = {
  'payment-integrity': 'Confidential — SOUPY Operational Intelligence Report — Payment Integrity',
  'compliance-coaching': 'Confidential — SOUPY Operational Intelligence Report — Claim Accuracy Program',
};

function postureLabel(posture: AuditPosture) {
  return posture === 'compliance-coaching' ? 'Claim Accuracy' : 'Payment Integrity';
}

/* ═══════════════════════════════════════════════════
   OR Readiness & Sterile Integrity PDF
   ═══════════════════════════════════════════════════ */

export function exportORReadinessPDF(events: ORReadinessEvent[], posture: AuditPosture = 'payment-integrity') {
  const ctx = createPDFContext();
  const isPayer = posture === 'payment-integrity';

  addDocumentHeader(ctx,
    isPayer ? 'OR Readiness — Payment Integrity Report' : 'OR Readiness — Operational Improvement Report',
    `SOUPY ThinkTank — ${postureLabel(posture)} · ${events.length} events analyzed`
  );
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 6);

  // ── Summary Score Cards ──
  const totalDelay = events.reduce((s, e) => s + e.delay_minutes, 0);
  const totalCost = events.reduce((s, e) => s + (e.estimated_cost || estimateEventCost(e.delay_minutes, e.event_type)), 0);
  const repeats = events.filter(e => e.classification === 'repeat_pattern').length;
  const safetyFlags = events.filter(e => e.safety_flag).length;
  const underAnesthesia = events.filter(e => e.patient_wait_status === 'under_anesthesia').length;

  addSectionHeader(ctx, 'Executive Summary');
  addScoreCards(ctx, [
    { label: 'Total Events', value: String(events.length), color: 'blue' },
    { label: 'Total Delay (min)', value: String(totalDelay), sublabel: `Avg ${events.length ? Math.round(totalDelay / events.length) : 0} min`, color: 'amber' },
    { label: 'Est. Cost Impact', value: `$${totalCost.toLocaleString()}`, sublabel: '$80/min base', color: 'red' },
    { label: 'Safety Flags', value: String(safetyFlags), sublabel: safetyFlags > 0 ? 'Action Required' : 'Clear', color: safetyFlags > 0 ? 'red' : 'green' },
  ]);

  // ── Safety Alert ──
  const sterilEvents = events.filter(e => e.event_type === 'sterilization_lapse' || e.event_type === 'contaminated');
  if (sterilEvents.length > 0) {
    addAlertBox(ctx,
      `${sterilEvents.length} sterilization/contamination event(s) detected. These carry a 1.5× cost multiplier and require immediate review per safety protocols.`,
      'error', '⚠ Sterile Integrity Alert'
    );
    addSpacer(ctx, 4);
  }

  // ── Repeat Patterns ──
  if (repeats > 0) {
    addAlertBox(ctx,
      `${repeats} event(s) classified as repeat patterns — systemic issues that may indicate process failures requiring root-cause analysis.`,
      'warning', 'Repeat Pattern Warning'
    );
    addSpacer(ctx, 4);
  }

  // ── Under-Anesthesia Wait ──
  if (underAnesthesia > 0) {
    addAlertBox(ctx,
      `${underAnesthesia} event(s) occurred while the patient was under anesthesia, carrying increased clinical risk and cost.`,
      'error', 'Patient Safety: Under Anesthesia'
    );
    addSpacer(ctx, 4);
  }

  // ── Breakdown by Event Type ──
  addSectionHeader(ctx, 'Breakdown by Event Type');
  const typeGroups: Record<string, ORReadinessEvent[]> = {};
  events.forEach(e => {
    const label = OR_EVENT_TYPES.find(t => t.value === e.event_type)?.label || e.event_type;
    if (!typeGroups[label]) typeGroups[label] = [];
    typeGroups[label].push(e);
  });

  const typeRows = Object.entries(typeGroups).map(([label, evts]) => [
    label,
    String(evts.length),
    `${evts.reduce((s, e) => s + e.delay_minutes, 0)} min`,
    `$${evts.reduce((s, e) => s + (e.estimated_cost || estimateEventCost(e.delay_minutes, e.event_type)), 0).toLocaleString()}`,
    String(evts.filter(e => e.safety_flag).length),
  ]);
  addTable(ctx, [
    { header: 'Event Type', width: 160 },
    { header: 'Count', width: 60, align: 'center' },
    { header: 'Total Delay', width: 90, align: 'center' },
    { header: 'Est. Cost', width: 100, align: 'right' },
    { header: 'Safety', width: ctx.maxWidth - 410, align: 'center' },
  ], typeRows);

  // ── Classification Distribution ──
  addSectionHeader(ctx, 'Classification Distribution');
  const classGroups: Record<string, number> = {};
  events.forEach(e => {
    const label = CLASSIFICATION_OPTIONS.find(c => c.value === e.classification)?.label || e.classification;
    classGroups[label] = (classGroups[label] || 0) + 1;
  });
  Object.entries(classGroups).forEach(([label, count]) => {
    const pct = events.length ? Math.round((count / events.length) * 100) : 0;
    addBullet(ctx, `${label}: ${count} events (${pct}%)`);
  });
  addSpacer(ctx, 6);

  // ── Detailed Event Log ──
  addSectionHeader(ctx, 'Event Log');
  const logRows = events.slice(0, 50).map(e => [
    new Date(e.created_at).toLocaleDateString(),
    OR_EVENT_TYPES.find(t => t.value === e.event_type)?.label || e.event_type,
    e.room_id || '—',
    `${e.delay_minutes} min`,
    `$${(e.estimated_cost || estimateEventCost(e.delay_minutes, e.event_type)).toLocaleString()}`,
    CLASSIFICATION_OPTIONS.find(c => c.value === e.classification)?.label || e.classification,
  ]);
  addTable(ctx, [
    { header: 'Date', width: 80 },
    { header: 'Type', width: 130 },
    { header: 'Room', width: 50, align: 'center' },
    { header: 'Delay', width: 60, align: 'center' },
    { header: 'Cost', width: 80, align: 'right' },
    { header: 'Classification', width: ctx.maxWidth - 400 },
  ], logRows);

  if (events.length > 50) {
    addBody(ctx, `Showing 50 of ${events.length} events. Full data available in the application.`);
  }

  addFooter(ctx, POSTURE_FOOTER[posture]);
  ctx.doc.save(`OR_Readiness_Report_${Date.now()}.pdf`);
}

/* ═══════════════════════════════════════════════════
   Triage Accuracy PDF
   ═══════════════════════════════════════════════════ */

export function exportTriageAccuracyPDF(events: TriageAccuracyEvent[], posture: AuditPosture = 'payment-integrity') {
  const ctx = createPDFContext();
  const isPayer = posture === 'payment-integrity';

  addDocumentHeader(ctx,
    isPayer ? 'Case-Triage Accuracy — Payment Integrity Report' : 'Case-Triage Accuracy — Booking Accuracy Report',
    `SOUPY ThinkTank — ${postureLabel(posture)} · ${events.length} cases reviewed`
  );
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 6);

  // ── Summary ──
  const predictable = events.filter(e => e.foreseeability_class === 'predictable').length;
  const avgScore = events.length ? Math.round(events.reduce((s, e) => s + e.foreseeability_score, 0) / events.length) : 0;
  const totalExtraMin = events.reduce((s, e) => s + Math.max(0, (e.actual_duration || 0) - (e.expected_duration || 0)), 0);
  const avgDelta = events.length ? (events.reduce((s, e) => s + e.complexity_delta, 0) / events.length).toFixed(1) : '0';
  const staffMismatches = events.filter(e => (e.actual_staff_count || 0) > (e.expected_staff_count || 0)).length;
  const pendingFollowUps = events.filter(e => e.follow_up_status === 'pending' || e.follow_up_status === 'escalated').length;

  addSectionHeader(ctx, 'Executive Summary');
  addScoreCards(ctx, [
    { label: 'Total Cases', value: String(events.length), color: 'blue' },
    { label: 'Predictable Mismatches', value: String(predictable), sublabel: `${events.length ? Math.round((predictable / events.length) * 100) : 0}%`, color: predictable > 0 ? 'red' : 'green' },
    { label: 'Avg Foreseeability', value: `${avgScore}%`, color: avgScore >= 60 ? 'red' : avgScore >= 30 ? 'amber' : 'green' },
    { label: 'Extra OR Minutes', value: String(totalExtraMin), sublabel: `~$${(totalExtraMin * 80).toLocaleString()} cost`, color: 'amber' },
  ]);

  if (pendingFollowUps > 0) {
    addAlertBox(ctx, `${pendingFollowUps} case(s) have pending or escalated follow-ups that require attention.`, 'warning', 'Follow-Up Required');
    addSpacer(ctx, 4);
  }

  // ── Foreseeability Distribution ──
  addSectionHeader(ctx, 'Foreseeability Breakdown');
  FORESEEABILITY_OPTIONS.forEach(opt => {
    const count = events.filter(e => e.foreseeability_class === opt.value).length;
    const pct = events.length ? Math.round((count / events.length) * 100) : 0;
    addBullet(ctx, `${opt.label}: ${count} cases (${pct}%)`);
  });
  addSpacer(ctx, 6);

  // ── Top Surgeons by Predictable Mismatches ──
  addSectionHeader(ctx, isPayer ? 'Surgeon Risk Profile' : 'Surgeon Booking Accuracy');
  const surgeonGroups: Record<string, TriageAccuracyEvent[]> = {};
  events.forEach(e => {
    const key = e.surgeon_name || 'Unknown';
    if (!surgeonGroups[key]) surgeonGroups[key] = [];
    surgeonGroups[key].push(e);
  });
  const surgeonRows = Object.entries(surgeonGroups)
    .sort((a, b) => b[1].filter(e => e.foreseeability_class === 'predictable').length - a[1].filter(e => e.foreseeability_class === 'predictable').length)
    .slice(0, 15)
    .map(([name, evts]) => [
      name,
      String(evts.length),
      String(evts.filter(e => e.foreseeability_class === 'predictable').length),
      `${Math.round(evts.reduce((s, e) => s + e.foreseeability_score, 0) / evts.length)}%`,
      avgDelta,
      `${evts.reduce((s, e) => s + Math.max(0, (e.actual_duration || 0) - (e.expected_duration || 0)), 0)} min`,
    ]);
  addTable(ctx, [
    { header: 'Surgeon', width: 130 },
    { header: 'Cases', width: 50, align: 'center' },
    { header: 'Predictable', width: 80, align: 'center' },
    { header: 'Avg Score', width: 70, align: 'center' },
    { header: 'Avg Δ', width: 50, align: 'center' },
    { header: 'Extra Time', width: ctx.maxWidth - 380, align: 'right' },
  ], surgeonRows);

  // ── Detailed Log ──
  addSectionHeader(ctx, 'Case Detail Log');
  const logRows = events.slice(0, 40).map(e => [
    new Date(e.created_at).toLocaleDateString(),
    e.surgeon_name || '—',
    e.expected_procedure?.slice(0, 20) || '—',
    e.actual_procedure?.slice(0, 20) || '—',
    FORESEEABILITY_OPTIONS.find(o => o.value === e.foreseeability_class)?.label || e.foreseeability_class,
    `${e.foreseeability_score}%`,
  ]);
  addTable(ctx, [
    { header: 'Date', width: 72 },
    { header: 'Surgeon', width: 100 },
    { header: 'Expected', width: 110 },
    { header: 'Actual', width: 110 },
    { header: 'Foreseeability', width: 90 },
    { header: 'Score', width: ctx.maxWidth - 482, align: 'center' },
  ], logRows);

  if (events.length > 40) {
    addBody(ctx, `Showing 40 of ${events.length} cases. Full data available in the application.`);
  }

  addFooter(ctx, POSTURE_FOOTER[posture]);
  ctx.doc.save(`Triage_Accuracy_Report_${Date.now()}.pdf`);
}

/* ═══════════════════════════════════════════════════
   Post-Op Flow PDF
   ═══════════════════════════════════════════════════ */

export function exportPostOpFlowPDF(events: PostOpFlowEvent[], posture: AuditPosture = 'payment-integrity') {
  const ctx = createPDFContext();
  const isPayer = posture === 'payment-integrity';

  addDocumentHeader(ctx,
    isPayer ? 'Post-Op Flow — Payment Integrity Report' : 'Post-Op Flow — Recovery Efficiency Report',
    `SOUPY ThinkTank — ${postureLabel(posture)} · ${events.length} events analyzed`
  );
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
  addSpacer(ctx, 6);

  // ── Summary ──
  const totalPatientWait = events.reduce((s, e) => s + e.patient_wait_minutes, 0);
  const totalStaffIdle = events.reduce((s, e) => s + e.staff_idle_minutes, 0);
  const totalExtraAnesthesia = events.reduce((s, e) => s + (e.extra_anesthesia_minutes || 0), 0);
  const totalExtraMonitoring = events.reduce((s, e) => s + (e.extra_monitoring_minutes || 0), 0);
  const noBed = events.filter(e => !e.bed_available).length;
  const over30 = events.filter(e => e.patient_wait_minutes > 30).length;
  const interventions = events.filter(e => e.intervention_applied);
  const effectiveCount = interventions.filter(e => e.intervention_effective).length;

  addSectionHeader(ctx, 'Executive Summary');
  addScoreCards(ctx, [
    { label: 'Total Events', value: String(events.length), color: 'blue' },
    { label: 'Avg Patient Wait', value: `${events.length ? Math.round(totalPatientWait / events.length) : 0} min`, sublabel: `${over30} over 30 min`, color: over30 > 0 ? 'red' : 'green' },
    { label: 'Staff Idle Time', value: `${totalStaffIdle} min`, color: 'amber' },
    { label: 'No Bed Available', value: `${noBed}/${events.length}`, sublabel: `${events.length ? Math.round((noBed / events.length) * 100) : 0}%`, color: noBed > 0 ? 'red' : 'green' },
  ]);

  // ── Extra Resource Consumption ──
  if (totalExtraAnesthesia > 0 || totalExtraMonitoring > 0) {
    addAlertBox(ctx,
      `Extra anesthesia time: ${totalExtraAnesthesia} min (~$${(totalExtraAnesthesia * 80).toLocaleString()}). Extra monitoring: ${totalExtraMonitoring} min. These represent avoidable costs from post-op bottlenecks.`,
      'warning', 'Avoidable Resource Consumption'
    );
    addSpacer(ctx, 4);
  }

  // ── Intervention Effectiveness ──
  if (interventions.length > 0) {
    const rate = Math.round((effectiveCount / interventions.length) * 100);
    addAlertBox(ctx,
      `${interventions.length} intervention(s) applied, ${effectiveCount} effective (${rate}% success rate).`,
      rate >= 60 ? 'success' : 'warning',
      'Intervention Effectiveness'
    );
    addSpacer(ctx, 4);
  }

  // ── Delay Category Breakdown ──
  addSectionHeader(ctx, isPayer ? 'Root-Cause Analysis' : 'Delay Category Breakdown');
  const catGroups: Record<string, PostOpFlowEvent[]> = {};
  events.forEach(e => {
    const label = DELAY_CATEGORY_OPTIONS.find(o => o.value === e.delay_category)?.label || e.delay_reason || 'Uncategorized';
    if (!catGroups[label]) catGroups[label] = [];
    catGroups[label].push(e);
  });
  const catRows = Object.entries(catGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, evts]) => [
      label,
      String(evts.length),
      `${Math.round(evts.reduce((s, e) => s + e.patient_wait_minutes, 0) / evts.length)} min`,
      `${Math.round(evts.reduce((s, e) => s + e.staff_idle_minutes, 0) / evts.length)} min`,
      `${evts.filter(e => !e.bed_available).length}`,
    ]);
  addTable(ctx, [
    { header: 'Category', width: 150 },
    { header: 'Count', width: 60, align: 'center' },
    { header: 'Avg Wait', width: 80, align: 'center' },
    { header: 'Avg Idle', width: 80, align: 'center' },
    { header: 'No Bed', width: ctx.maxWidth - 370, align: 'center' },
  ], catRows);

  // ── Event Log ──
  addSectionHeader(ctx, 'Event Log');
  const logRows = events.slice(0, 40).map(e => [
    new Date(e.created_at).toLocaleDateString(),
    e.surgeon_name || '—',
    `${e.patient_wait_minutes} min`,
    `${e.staff_idle_minutes} min`,
    e.bed_available ? 'Yes' : 'No',
    DELAY_CATEGORY_OPTIONS.find(o => o.value === e.delay_category)?.label || e.delay_reason || '—',
  ]);
  addTable(ctx, [
    { header: 'Date', width: 72 },
    { header: 'Surgeon', width: 100 },
    { header: 'Patient Wait', width: 80, align: 'center' },
    { header: 'Staff Idle', width: 80, align: 'center' },
    { header: 'Bed', width: 50, align: 'center' },
    { header: 'Reason', width: ctx.maxWidth - 382 },
  ], logRows);

  if (events.length > 40) {
    addBody(ctx, `Showing 40 of ${events.length} events. Full data available in the application.`);
  }

  addFooter(ctx, POSTURE_FOOTER[posture]);
  ctx.doc.save(`PostOp_Flow_Report_${Date.now()}.pdf`);
}
