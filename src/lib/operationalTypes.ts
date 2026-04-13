export interface ORReadinessEvent {
  id: string;
  case_id?: string;
  room_id?: string;
  event_type: 'dropped_implant' | 'wrong_size' | 'sterilization_lapse' | 'missing_instrument' | 'other';
  delay_minutes: number;
  replacement_source?: string;
  patient_wait_status: 'stable' | 'under_anesthesia' | 'awake_waiting' | 'repositioned';
  classification: 'isolated' | 'workflow_issue' | 'repeat_pattern';
  vendor_rep?: string;
  service_line?: string;
  shift?: string;
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
  extra_equipment?: string[];
  unplanned_support?: string[];
  foreseeability_score: number;
  foreseeability_class: 'unavoidable' | 'predictable' | 'partially_foreseeable';
  complexity_delta: number;
  notes?: string;
  created_at: string;
}

export interface PostOpFlowEvent {
  id: string;
  case_id?: string;
  patient_wait_minutes: number;
  staff_idle_minutes: number;
  delay_reason?: string;
  facility?: string;
  surgeon_name?: string;
  service_line?: string;
  day_of_week?: string;
  shift?: string;
  bed_available: boolean;
  notes?: string;
  created_at: string;
}

export const OR_EVENT_TYPES = [
  { value: 'dropped_implant', label: 'Dropped Implant', severity: 'high' },
  { value: 'wrong_size', label: 'Wrong Size Delivered', severity: 'high' },
  { value: 'sterilization_lapse', label: 'Sterilization Lapse', severity: 'critical' },
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
