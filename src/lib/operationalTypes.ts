export interface ORReadinessEvent {
  id: string;
  case_id?: string;
  room_id?: string;
  event_type: 'dropped_implant' | 'wrong_size' | 'sterilization_lapse' | 'missing_instrument' | 'contaminated' | 'tray_not_ready' | 'other';
  delay_minutes: number;
  replacement_source?: string;
  patient_wait_status: 'stable' | 'under_anesthesia' | 'awake_waiting' | 'repositioned';
  classification: 'isolated' | 'workflow_issue' | 'repeat_pattern';
  vendor_rep?: string;
  service_line?: string;
  shift?: string;
  day_of_week?: string;
  estimated_cost?: number;
  safety_flag?: boolean;
  notes?: string;
  created_at: string;
}

export interface TriageAccuracyEvent {
  id: string;
  case_id?: string;
  booker_name?: string;
  surgeon_name?: string;
  service_line?: string;
  expected_procedure?: string;
  actual_procedure?: string;
  expected_duration?: number;
  actual_duration?: number;
  expected_implant?: string;
  actual_implant?: string;
  expected_staff_count?: number;
  actual_staff_count?: number;
  extra_equipment?: string[];
  unplanned_support?: string[];
  foreseeability_score: number;
  foreseeability_class: 'unavoidable' | 'predictable' | 'partially_foreseeable';
  complexity_delta: number;
  follow_up_status?: 'none' | 'pending' | 'completed' | 'escalated';
  follow_up_notes?: string;
  month?: string; // for longitudinal tracking e.g. '2026-04'
  notes?: string;
  created_at: string;
}

export interface PostOpFlowEvent {
  id: string;
  case_id?: string;
  patient_wait_minutes: number;
  staff_idle_minutes: number;
  delay_reason?: string;
  delay_category?: 'bed_misallocation' | 'pacu_understaffing' | 'transport_delay' | 'emergent_bump' | 'scheduling_overlap' | 'miscommunication' | 'other';
  facility?: string;
  surgeon_name?: string;
  service_line?: string;
  day_of_week?: string;
  shift?: string;
  bed_available: boolean;
  extra_anesthesia_minutes?: number;
  extra_monitoring_minutes?: number;
  intervention_applied?: string;
  intervention_effective?: boolean;
  notes?: string;
  created_at: string;
}

export const OR_EVENT_TYPES = [
  { value: 'dropped_implant', label: 'Dropped Implant', severity: 'high' },
  { value: 'wrong_size', label: 'Wrong Size Delivered', severity: 'high' },
  { value: 'sterilization_lapse', label: 'Sterilization Lapse', severity: 'critical' },
  { value: 'contaminated', label: 'Contaminated Implant/Instrument', severity: 'critical' },
  { value: 'tray_not_ready', label: 'Tray Not Sterilized On Time', severity: 'high' },
  { value: 'missing_instrument', label: 'Missing Instrument', severity: 'medium' },
  { value: 'other', label: 'Other', severity: 'low' },
] as const;

export const CLASSIFICATION_OPTIONS = [
  { value: 'isolated', label: 'Isolated Incident', color: 'text-info-blue' },
  { value: 'workflow_issue', label: 'Workflow Issue', color: 'text-disagreement' },
  { value: 'repeat_pattern', label: 'Repeat Pattern', color: 'text-violation' },
] as const;

export const FORESEEABILITY_OPTIONS = [
  { value: 'unavoidable', label: 'Unavoidable', color: 'text-consensus' },
  { value: 'partially_foreseeable', label: 'Partially Foreseeable', color: 'text-disagreement' },
  { value: 'predictable', label: 'Predictable', color: 'text-violation' },
] as const;

export const DELAY_CATEGORY_OPTIONS = [
  { value: 'bed_misallocation', label: 'Bed Misallocation' },
  { value: 'pacu_understaffing', label: 'PACU Understaffing' },
  { value: 'transport_delay', label: 'Transport Delay' },
  { value: 'emergent_bump', label: 'Emergent Case Bump' },
  { value: 'scheduling_overlap', label: 'Scheduling Overlap' },
  { value: 'miscommunication', label: 'Miscommunication' },
  { value: 'other', label: 'Other' },
] as const;

// Cost estimation per event type (industry-average OR minute cost ~$60-100)
export const OR_COST_PER_MINUTE = 80;
export function estimateEventCost(delayMinutes: number, eventType: string): number {
  const baseCost = delayMinutes * OR_COST_PER_MINUTE;
  const multiplier = eventType === 'sterilization_lapse' || eventType === 'contaminated' ? 1.5 : 1;
  return Math.round(baseCost * multiplier);
}
