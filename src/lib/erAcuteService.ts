import { supabase } from '@/integrations/supabase/client';
import type { ERAcuteEvent, PatientAdvocateEvent } from './operationalTypes';

export async function fetchERAcuteEvents(): Promise<ERAcuteEvent[]> {
  const { data, error } = await supabase
    .from('er_acute_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    case_id: row.case_id ?? undefined,
    patient_id: row.patient_id ?? undefined,
    acuity_level: row.acuity_level ?? 3,
    chief_complaint: row.chief_complaint ?? undefined,
    arrival_method: (row.arrival_method as ERAcuteEvent['arrival_method']) || 'walk-in',
    triage_wait_minutes: row.triage_wait_minutes ?? 0,
    bed_assignment_minutes: row.bed_assignment_minutes ?? 0,
    provider_seen_minutes: row.provider_seen_minutes ?? 0,
    disposition: (row.disposition as ERAcuteEvent['disposition']) || 'discharged',
    boarding_hours: Number(row.boarding_hours ?? 0),
    left_without_seen: row.left_without_seen ?? false,
    overcrowding_at_arrival: row.overcrowding_at_arrival ?? false,
    shift: row.shift ?? undefined,
    day_of_week: row.day_of_week ?? undefined,
    department_zone: row.department_zone ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
  }));
}

export async function fetchPatientAdvocateEvents(): Promise<PatientAdvocateEvent[]> {
  const { data, error } = await supabase
    .from('patient_advocate_events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(row => ({
    id: row.id,
    case_id: row.case_id ?? undefined,
    patient_id: row.patient_id ?? undefined,
    event_category: (row.event_category as PatientAdvocateEvent['event_category']) || 'other',
    severity: (row.severity as PatientAdvocateEvent['severity']) || 'medium',
    description: row.description,
    expected_standard: row.expected_standard ?? undefined,
    actual_finding: row.actual_finding ?? undefined,
    deviation_minutes: row.deviation_minutes ?? 0,
    unit: row.unit ?? undefined,
    shift: row.shift ?? undefined,
    day_of_week: row.day_of_week ?? undefined,
    responsible_role: row.responsible_role ?? undefined,
    was_reported: row.was_reported ?? false,
    resolution_status: (row.resolution_status as PatientAdvocateEvent['resolution_status']) || 'open',
    resolution_notes: row.resolution_notes ?? undefined,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
  }));
}
