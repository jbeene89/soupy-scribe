import type { AuditCase } from './types';
import type {
  ORReadinessEvent,
  TriageAccuracyEvent,
  PostOpFlowEvent,
  ERAcuteEvent,
  PatientAdvocateEvent,
} from './operationalTypes';
import type { ImagingFinding } from './imagingTypes';

// ─── Cost assumptions (industry-average, conservative) ───
export const COST_ASSUMPTIONS = {
  orMinute: 80,           // $/min OR time
  staffIdleMinute: 1.5,   // $/min loaded labor (per idle minute, blended)
  pacuBedMinute: 2.5,     // $/min PACU hold
  triageMissBase: 450,    // base cost for unplanned support / extra equipment per item
  contaminationMultiplier: 1.5,
  implantReplacementBase: 1200, // typical implant replacement cost when dropped/contaminated
  deniedClaimRecovery: 0.32,    // % of denied claims actually recoverable on appeal
};

export type ImpactCategory =
  | 'or_event'
  | 'triage_miss'
  | 'denied_claim'
  | 'postop_delay'
  | 'advocate_event'
  | 'er_acute'
  | 'imaging';

export interface ImpactEntry {
  id: string;
  source_id: string;
  category: ImpactCategory;
  category_label: string;
  occurred_at: string;
  estimated_loss: number;
  description: string;
  patient_id?: string;
  physician_name?: string;
  case_id?: string;
  service_line?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detail: Record<string, string | number | boolean | undefined>;
  // Where to deep-link
  module_path: string;
}

// ─── Per-event cost calculators ───

function orEventCost(e: ORReadinessEvent): number {
  const time = (e.delay_minutes ?? 0) * COST_ASSUMPTIONS.orMinute;
  const implant =
    e.event_type === 'dropped_implant' ||
    e.event_type === 'contaminated' ||
    e.event_type === 'wrong_size'
      ? COST_ASSUMPTIONS.implantReplacementBase
      : 0;
  const mult =
    e.event_type === 'sterilization_lapse' || e.event_type === 'contaminated'
      ? COST_ASSUMPTIONS.contaminationMultiplier
      : 1;
  return Math.round((time + implant) * mult);
}

function triageEventCost(e: TriageAccuracyEvent): number {
  const equipCost = (e.extra_equipment?.length ?? 0) * COST_ASSUMPTIONS.triageMissBase;
  const supportCost = (e.unplanned_support?.length ?? 0) * COST_ASSUMPTIONS.triageMissBase;
  const overrunMin = Math.max(0, (e.actual_duration ?? 0) - (e.expected_duration ?? 0));
  const overrunCost = overrunMin * COST_ASSUMPTIONS.orMinute;
  return Math.round(equipCost + supportCost + overrunCost);
}

function postOpCost(e: PostOpFlowEvent): number {
  const idle = (e.staff_idle_minutes ?? 0) * COST_ASSUMPTIONS.staffIdleMinute;
  const wait = (e.patient_wait_minutes ?? 0) * COST_ASSUMPTIONS.pacuBedMinute;
  return Math.round(idle + wait);
}

function erAcuteCost(e: ERAcuteEvent): number {
  // Boarding hours and LWBS are the primary loss drivers
  const boarding = (e.boarding_hours ?? 0) * 60 * COST_ASSUMPTIONS.pacuBedMinute;
  const lwbsPenalty = e.left_without_seen ? 850 : 0;
  return Math.round(boarding + lwbsPenalty);
}

function deniedClaimLoss(c: AuditCase): number {
  // Conservative: full claim amount minus expected recovery on appeal
  return Math.round(c.claimAmount * (1 - COST_ASSUMPTIONS.deniedClaimRecovery));
}

function advocateSeverityCost(e: PatientAdvocateEvent): number {
  const map = { low: 250, medium: 750, high: 2200, critical: 6500 };
  return map[e.severity] ?? 250;
}

// ─── Aggregation ───

export interface SystemImpactInput {
  cases: AuditCase[];
  orEvents: ORReadinessEvent[];
  triageEvents: TriageAccuracyEvent[];
  postOpEvents: PostOpFlowEvent[];
  erAcuteEvents: ERAcuteEvent[];
  advocateEvents: PatientAdvocateEvent[];
  imagingFindings?: ImagingFinding[];
}

export function buildImpactEntries(input: SystemImpactInput): ImpactEntry[] {
  const entries: ImpactEntry[] = [];

  for (const e of input.orEvents) {
    const loss = orEventCost(e);
    if (loss <= 0) continue;
    entries.push({
      id: `or-${e.id}`,
      source_id: e.id,
      category: 'or_event',
      category_label: 'OR Readiness',
      occurred_at: e.created_at,
      estimated_loss: loss,
      description: orEventDescription(e),
      service_line: e.service_line,
      case_id: e.case_id,
      severity:
        e.event_type === 'sterilization_lapse' || e.event_type === 'contaminated'
          ? 'critical'
          : e.delay_minutes > 30
          ? 'high'
          : 'medium',
      detail: {
        event_type: e.event_type,
        delay_minutes: e.delay_minutes,
        room_id: e.room_id,
        vendor_rep: e.vendor_rep,
      },
      module_path: '/app/or-readiness',
    });
  }

  for (const e of input.triageEvents) {
    const loss = triageEventCost(e);
    if (loss <= 0) continue;
    entries.push({
      id: `tri-${e.id}`,
      source_id: e.id,
      category: 'triage_miss',
      category_label: 'Triage Accuracy',
      occurred_at: e.created_at,
      estimated_loss: loss,
      description: `Triage miss — ${e.expected_procedure ?? 'expected procedure'} → ${e.actual_procedure ?? 'actual procedure'}`,
      physician_name: e.surgeon_name,
      service_line: e.service_line,
      case_id: e.case_id,
      severity: e.foreseeability_class === 'predictable' ? 'high' : 'medium',
      detail: {
        booker: e.booker_name,
        complexity_delta: e.complexity_delta,
        foreseeability: e.foreseeability_class,
      },
      module_path: '/app/triage',
    });
  }

  for (const e of input.postOpEvents) {
    const loss = postOpCost(e);
    if (loss <= 0) continue;
    entries.push({
      id: `po-${e.id}`,
      source_id: e.id,
      category: 'postop_delay',
      category_label: 'Post-Op Flow',
      occurred_at: e.created_at,
      estimated_loss: loss,
      description: `Post-op delay — ${e.delay_reason ?? 'unspecified'} (${e.patient_wait_minutes}m wait, ${e.staff_idle_minutes}m idle)`,
      physician_name: e.surgeon_name,
      service_line: e.service_line,
      case_id: e.case_id,
      severity: e.patient_wait_minutes > 60 ? 'high' : 'medium',
      detail: {
        wait_minutes: e.patient_wait_minutes,
        idle_minutes: e.staff_idle_minutes,
        bed_available: e.bed_available,
      },
      module_path: '/app/postop',
    });
  }

  for (const e of input.erAcuteEvents) {
    const loss = erAcuteCost(e);
    if (loss <= 0) continue;
    entries.push({
      id: `er-${e.id}`,
      source_id: e.id,
      category: 'er_acute',
      category_label: 'ER / Acute',
      occurred_at: e.created_at,
      estimated_loss: loss,
      description: e.left_without_seen
        ? 'ER patient left without being seen'
        : `ER boarding — ${e.boarding_hours}h hold (ESI ${e.acuity_level})`,
      patient_id: e.patient_id,
      case_id: e.case_id,
      severity: e.left_without_seen || e.boarding_hours > 4 ? 'high' : 'medium',
      detail: {
        acuity_level: e.acuity_level,
        boarding_hours: e.boarding_hours,
        lwbs: e.left_without_seen,
      },
      module_path: '/app/er-acute',
    });
  }

  for (const e of input.advocateEvents) {
    const loss = advocateSeverityCost(e);
    entries.push({
      id: `adv-${e.id}`,
      source_id: e.id,
      category: 'advocate_event',
      category_label: 'Patient Advocate',
      occurred_at: e.created_at,
      estimated_loss: loss,
      description: e.description,
      patient_id: e.patient_id,
      case_id: e.case_id,
      severity: e.severity,
      detail: {
        category: e.event_category,
        deviation_minutes: e.deviation_minutes,
        unit: e.unit,
      },
      module_path: '/app/advocate',
    });
  }

  for (const c of input.cases) {
    if (c.status !== 'rejected') continue;
    const loss = deniedClaimLoss(c);
    if (loss <= 0) continue;
    entries.push({
      id: `case-${c.id}`,
      source_id: c.id,
      category: 'denied_claim',
      category_label: 'Denied Claim',
      occurred_at: c.dateSubmitted ?? c.createdAt ?? new Date().toISOString(),
      estimated_loss: loss,
      description: `Claim ${c.caseNumber} denied — ${c.cptCodes.slice(0, 3).join(', ')}`,
      patient_id: c.patientId,
      physician_name: c.physicianName,
      case_id: c.id,
      severity: c.claimAmount > 5000 ? 'high' : 'medium',
      detail: {
        claim_amount: c.claimAmount,
        cpt_count: c.cptCodes.length,
      },
      module_path: '/app/cases',
    });
  }

  for (const f of input.imagingFindings ?? []) {
    if (f.status === 'dismissed') continue;
    if (f.estimated_loss <= 0 && f.severity === 'low') continue;
    entries.push({
      id: `img-${f.id}`,
      source_id: f.id,
      category: 'imaging',
      category_label: 'Imaging Audit',
      occurred_at: f.created_at,
      estimated_loss: f.estimated_loss,
      description: f.ai_summary || `${f.procedure_label || 'Imaging'} — ${f.body_region ?? 'unspecified region'}`,
      patient_id: f.patient_id,
      physician_name: f.physician_name,
      case_id: f.case_id,
      severity: f.severity,
      detail: {
        procedure: f.procedure_label,
        body_region: f.body_region,
        expected_implants: f.expected_implant_count,
        detected_implants: f.detected_implant_count,
        confidence: f.ai_confidence,
      },
      module_path: '/app/imaging',
    });
  }

  return entries.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

function orEventDescription(e: ORReadinessEvent): string {
  const labels: Record<string, string> = {
    dropped_implant: 'Dropped implant',
    wrong_size: 'Wrong implant size delivered',
    sterilization_lapse: 'Sterilization lapse',
    missing_instrument: 'Missing instrument',
    contaminated: 'Contaminated implant/instrument',
    tray_not_ready: 'Tray not sterilized on time',
    other: 'OR readiness event',
  };
  const base = labels[e.event_type] ?? 'OR event';
  return e.delay_minutes > 0 ? `${base} — ${e.delay_minutes}m delay` : base;
}

// ─── Roll-ups ───

export interface CategoryRollup {
  category: ImpactCategory;
  category_label: string;
  total_loss: number;
  event_count: number;
}

export function rollupByCategory(entries: ImpactEntry[]): CategoryRollup[] {
  const map = new Map<ImpactCategory, CategoryRollup>();
  for (const e of entries) {
    const r = map.get(e.category) ?? {
      category: e.category,
      category_label: e.category_label,
      total_loss: 0,
      event_count: 0,
    };
    r.total_loss += e.estimated_loss;
    r.event_count += 1;
    map.set(e.category, r);
  }
  return Array.from(map.values()).sort((a, b) => b.total_loss - a.total_loss);
}

export interface PhysicianRollup {
  physician_name: string;
  total_loss: number;
  event_count: number;
  categories: ImpactCategory[];
  entries: ImpactEntry[];
}

export function rollupByPhysician(entries: ImpactEntry[]): PhysicianRollup[] {
  const map = new Map<string, PhysicianRollup>();
  for (const e of entries) {
    if (!e.physician_name) continue;
    const key = e.physician_name.trim().toLowerCase();
    const r = map.get(key) ?? {
      physician_name: e.physician_name,
      total_loss: 0,
      event_count: 0,
      categories: [],
      entries: [],
    };
    r.total_loss += e.estimated_loss;
    r.event_count += 1;
    if (!r.categories.includes(e.category)) r.categories.push(e.category);
    r.entries.push(e);
    map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => b.total_loss - a.total_loss);
}

export interface PatientRollup {
  patient_id: string;
  total_loss: number;
  event_count: number;
  categories: ImpactCategory[];
  entries: ImpactEntry[];
}

export function rollupByPatient(entries: ImpactEntry[]): PatientRollup[] {
  const map = new Map<string, PatientRollup>();
  for (const e of entries) {
    if (!e.patient_id) continue;
    const key = e.patient_id.trim();
    const r = map.get(key) ?? {
      patient_id: key,
      total_loss: 0,
      event_count: 0,
      categories: [],
      entries: [],
    };
    r.total_loss += e.estimated_loss;
    r.event_count += 1;
    if (!r.categories.includes(e.category)) r.categories.push(e.category);
    r.entries.push(e);
    map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => b.total_loss - a.total_loss);
}

// ─── Pattern detection ───

export interface DetectedPattern {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  total_loss: number;
  related_entries: ImpactEntry[];
}

export function detectPatterns(entries: ImpactEntry[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const physicians = rollupByPhysician(entries);
  const patients = rollupByPatient(entries);

  // Physician with multiple categories
  for (const p of physicians) {
    if (p.categories.length >= 2 && p.event_count >= 3) {
      patterns.push({
        id: `phys-multi-${p.physician_name}`,
        severity: p.categories.length >= 3 ? 'critical' : 'warning',
        title: `${p.physician_name} — recurring issues across ${p.categories.length} modules`,
        detail: `${p.event_count} events, ${p.categories.map(formatCategoryShort).join(' + ')}`,
        total_loss: p.total_loss,
        related_entries: p.entries,
      });
    }
  }

  // Repeat dropped implants
  const droppedImplants = entries.filter(
    (e) => e.category === 'or_event' && e.detail.event_type === 'dropped_implant'
  );
  if (droppedImplants.length >= 2) {
    patterns.push({
      id: 'repeat-dropped-implants',
      severity: droppedImplants.length >= 4 ? 'critical' : 'warning',
      title: `${droppedImplants.length} dropped implants this period`,
      detail: 'Repeat occurrence — review handling protocol and vendor process.',
      total_loss: droppedImplants.reduce((s, e) => s + e.estimated_loss, 0),
      related_entries: droppedImplants,
    });
  }

  // Repeat contamination
  const contaminations = entries.filter(
    (e) =>
      e.category === 'or_event' &&
      (e.detail.event_type === 'contaminated' || e.detail.event_type === 'sterilization_lapse')
  );
  if (contaminations.length >= 1) {
    patterns.push({
      id: 'contamination-events',
      severity: 'critical',
      title: `${contaminations.length} sterilization/contamination event${contaminations.length > 1 ? 's' : ''}`,
      detail: 'Patient-safety reportable. Review sterile processing workflow.',
      total_loss: contaminations.reduce((s, e) => s + e.estimated_loss, 0),
      related_entries: contaminations,
    });
  }

  // Patients appearing in multiple modules
  for (const p of patients) {
    if (p.categories.length >= 2) {
      patterns.push({
        id: `pt-multi-${p.patient_id}`,
        severity: p.categories.length >= 3 ? 'critical' : 'warning',
        title: `Patient ${p.patient_id} touched ${p.categories.length} modules`,
        detail: `${p.event_count} events: ${p.categories.map(formatCategoryShort).join(' + ')}`,
        total_loss: p.total_loss,
        related_entries: p.entries,
      });
    }
  }

  return patterns.sort((a, b) => {
    const sevRank = { critical: 0, warning: 1, info: 2 };
    return sevRank[a.severity] - sevRank[b.severity] || b.total_loss - a.total_loss;
  });
}

function formatCategoryShort(c: ImpactCategory): string {
  const map: Record<ImpactCategory, string> = {
    or_event: 'OR',
    triage_miss: 'Triage',
    denied_claim: 'Denials',
    postop_delay: 'Post-op',
    advocate_event: 'Advocate',
    er_acute: 'ER',
    imaging: 'Imaging',
  };
  return map[c];
}

// ─── Timeline (per patient or physician) ───

export interface TimelineEntry extends ImpactEntry {}

export function timelineFor(
  entries: ImpactEntry[],
  filter: { patient_id?: string; physician_name?: string }
): TimelineEntry[] {
  return entries
    .filter((e) => {
      if (filter.patient_id && e.patient_id?.trim() === filter.patient_id.trim()) return true;
      if (
        filter.physician_name &&
        e.physician_name?.trim().toLowerCase() === filter.physician_name.trim().toLowerCase()
      )
        return true;
      return false;
    })
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

// ─── Related-activity counts (for badges) ───

export function relatedCounts(
  entries: ImpactEntry[],
  filter: { patient_id?: string; physician_name?: string },
  excludeCategory?: ImpactCategory
): { count: number; total_loss: number; categories: ImpactCategory[] } {
  const filtered = timelineFor(entries, filter).filter(
    (e) => !excludeCategory || e.category !== excludeCategory
  );
  const categories: ImpactCategory[] = [];
  for (const e of filtered) if (!categories.includes(e.category)) categories.push(e.category);
  return {
    count: filtered.length,
    total_loss: filtered.reduce((s, e) => s + e.estimated_loss, 0),
    categories,
  };
}

export function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}