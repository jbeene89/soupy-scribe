import { supabase } from '@/integrations/supabase/client';
import type { ORReadinessEvent, TriageAccuracyEvent, PostOpFlowEvent } from './operationalTypes';
import { estimateEventCost } from './operationalTypes';

// ── OR Readiness Events ──

export async function fetchORReadinessEvents(): Promise<ORReadinessEvent[]> {
  const { data, error } = await supabase
    .from('or_readiness_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    case_id: row.case_id ?? undefined,
    room_id: row.room_id ?? undefined,
    event_type: (row.event_type as ORReadinessEvent['event_type']) || 'other',
    delay_minutes: row.delay_minutes ?? 0,
    replacement_source: row.replacement_source ?? undefined,
    patient_wait_status: (row.patient_wait_status as ORReadinessEvent['patient_wait_status']) || 'stable',
    classification: (row.classification as ORReadinessEvent['classification']) || 'isolated',
    vendor_rep: row.vendor_rep ?? undefined,
    service_line: row.service_line ?? undefined,
    shift: row.shift ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    // Compute fields not in DB
    estimated_cost: estimateEventCost(row.delay_minutes ?? 0, row.event_type || 'other'),
    safety_flag: row.event_type === 'sterilization_lapse' || row.event_type === 'contaminated',
  }));
}

// ── Triage Accuracy Events ──

export async function fetchTriageAccuracyEvents(): Promise<TriageAccuracyEvent[]> {
  const { data, error } = await supabase
    .from('triage_accuracy_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    case_id: row.case_id ?? undefined,
    booker_name: row.booker_name ?? undefined,
    surgeon_name: row.surgeon_name ?? undefined,
    service_line: row.service_line ?? undefined,
    expected_procedure: row.expected_procedure ?? undefined,
    actual_procedure: row.actual_procedure ?? undefined,
    expected_duration: row.expected_duration ?? undefined,
    actual_duration: row.actual_duration ?? undefined,
    expected_implant: row.expected_implant ?? undefined,
    actual_implant: row.actual_implant ?? undefined,
    extra_equipment: row.extra_equipment ?? [],
    unplanned_support: row.unplanned_support ?? [],
    foreseeability_score: Number(row.foreseeability_score ?? 0),
    foreseeability_class: (row.foreseeability_class as TriageAccuracyEvent['foreseeability_class']) || 'unavoidable',
    complexity_delta: Number(row.complexity_delta ?? 0),
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    // Fields not yet in DB — defaults
    expected_staff_count: undefined,
    actual_staff_count: undefined,
    follow_up_status: 'none' as const,
    follow_up_notes: undefined,
    month: row.created_at?.slice(0, 7),
  }));
}

// ── Post-Op Flow Events ──

export async function fetchPostOpFlowEvents(): Promise<PostOpFlowEvent[]> {
  const { data, error } = await supabase
    .from('postop_flow_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    case_id: row.case_id ?? undefined,
    patient_wait_minutes: row.patient_wait_minutes ?? 0,
    staff_idle_minutes: row.staff_idle_minutes ?? 0,
    delay_reason: row.delay_reason ?? undefined,
    facility: row.facility ?? undefined,
    surgeon_name: row.surgeon_name ?? undefined,
    service_line: row.service_line ?? undefined,
    day_of_week: row.day_of_week ?? undefined,
    shift: row.shift ?? undefined,
    bed_available: row.bed_available ?? true,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    // Fields not yet in DB — defaults
    delay_category: undefined,
    extra_anesthesia_minutes: undefined,
    extra_monitoring_minutes: undefined,
    intervention_applied: undefined,
    intervention_effective: undefined,
  }));
}
