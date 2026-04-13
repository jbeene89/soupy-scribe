import type { ORReadinessEvent, TriageAccuracyEvent, PostOpFlowEvent } from './operationalTypes';

export const mockORReadinessEvents: ORReadinessEvent[] = [
  {
    id: 'or-1', case_id: 'case-1', room_id: 'OR-3', event_type: 'dropped_implant',
    delay_minutes: 22, replacement_source: 'Vendor rep on-site', patient_wait_status: 'under_anesthesia',
    classification: 'isolated', vendor_rep: 'Stryker – J. Davis', service_line: 'Orthopedics',
    shift: 'AM', notes: 'Knee implant dropped during handoff. Backup available from rep.', created_at: '2026-04-10T08:30:00Z',
  },
  {
    id: 'or-2', case_id: 'case-2', room_id: 'OR-1', event_type: 'sterilization_lapse',
    delay_minutes: 45, replacement_source: 'Central sterile reprocessing', patient_wait_status: 'under_anesthesia',
    classification: 'workflow_issue', service_line: 'General Surgery',
    shift: 'AM', notes: 'Tray arrived with broken seal. Full reprocessing required.', created_at: '2026-04-09T07:15:00Z',
  },
  {
    id: 'or-3', case_id: 'case-3', room_id: 'OR-5', event_type: 'wrong_size',
    delay_minutes: 35, replacement_source: 'Hospital inventory', patient_wait_status: 'under_anesthesia',
    classification: 'repeat_pattern', vendor_rep: 'Zimmer – M. Chen', service_line: 'Orthopedics',
    shift: 'PM', notes: 'Third time wrong size hip stem delivered for this surgeon.', created_at: '2026-04-08T14:00:00Z',
  },
  {
    id: 'or-4', room_id: 'OR-2', event_type: 'missing_instrument',
    delay_minutes: 12, replacement_source: 'Borrowed from adjacent OR', patient_wait_status: 'stable',
    classification: 'isolated', service_line: 'Neurosurgery',
    shift: 'AM', notes: 'Kerrison rongeur missing from tray.', created_at: '2026-04-07T09:45:00Z',
  },
  {
    id: 'or-5', room_id: 'OR-3', event_type: 'dropped_implant',
    delay_minutes: 18, replacement_source: 'Vendor rep on-site', patient_wait_status: 'under_anesthesia',
    classification: 'workflow_issue', vendor_rep: 'Stryker – J. Davis', service_line: 'Orthopedics',
    shift: 'PM', notes: 'Second drop incident in OR-3 this month.', created_at: '2026-04-06T13:20:00Z',
  },
];

export const mockTriageEvents: TriageAccuracyEvent[] = [
  {
    id: 'tri-1', case_id: 'case-1', booker_name: 'K. Martinez', surgeon_name: 'Dr. Patel',
    service_line: 'Orthopedics', expected_procedure: 'Total Knee Arthroplasty',
    actual_procedure: 'Total Knee Arthroplasty w/ Revision Components', expected_duration: 90,
    actual_duration: 145, expected_implant: 'Primary TKA System', actual_implant: 'Revision Augment + Stems',
    extra_equipment: ['Revision tray', 'Bone cement mixer'], unplanned_support: ['Second scrub tech'],
    foreseeability_score: 72, foreseeability_class: 'predictable', complexity_delta: 3.2,
    notes: 'Pre-op X-ray showed bone loss. Should have been booked as potential revision.', created_at: '2026-04-10T08:00:00Z',
  },
  {
    id: 'tri-2', booker_name: 'L. Thompson', surgeon_name: 'Dr. Kim',
    service_line: 'General Surgery', expected_procedure: 'Laparoscopic Cholecystectomy',
    actual_procedure: 'Open Cholecystectomy + CBD Exploration', expected_duration: 60,
    actual_duration: 140, expected_implant: 'None', actual_implant: 'T-tube drain',
    extra_equipment: ['Open tray', 'Cholangiogram supplies'], unplanned_support: ['Anesthesia attending'],
    foreseeability_score: 35, foreseeability_class: 'unavoidable', complexity_delta: 4.5,
    notes: 'Extensive adhesions from prior surgery. Conversion clinically appropriate.', created_at: '2026-04-09T10:00:00Z',
  },
  {
    id: 'tri-3', booker_name: 'K. Martinez', surgeon_name: 'Dr. Patel',
    service_line: 'Orthopedics', expected_procedure: 'Hip Arthroplasty',
    actual_procedure: 'Hip Arthroplasty + Fracture Fixation', expected_duration: 120,
    actual_duration: 195, expected_implant: 'Cementless Hip System',
    actual_implant: 'Cemented Hip System + Cables', extra_equipment: ['Cable cerclage system'],
    unplanned_support: ['Trauma fellow'], foreseeability_score: 58,
    foreseeability_class: 'partially_foreseeable', complexity_delta: 2.8,
    notes: 'Intra-op fracture during reaming. History of osteoporosis was documented.', created_at: '2026-04-08T07:30:00Z',
  },
];

export const mockPostOpFlowEvents: PostOpFlowEvent[] = [
  {
    id: 'po-1', case_id: 'case-1', patient_wait_minutes: 42, staff_idle_minutes: 25,
    delay_reason: 'No PACU bed available', facility: 'Main Campus', surgeon_name: 'Dr. Patel',
    service_line: 'Orthopedics', day_of_week: 'Monday', shift: 'AM', bed_available: false,
    notes: 'Patient kept under light anesthesia. PACU at capacity from overnight backlog.', created_at: '2026-04-10T11:30:00Z',
  },
  {
    id: 'po-2', patient_wait_minutes: 28, staff_idle_minutes: 15,
    delay_reason: 'Miscommunication with transport', facility: 'Main Campus', surgeon_name: 'Dr. Kim',
    service_line: 'General Surgery', day_of_week: 'Tuesday', shift: 'AM', bed_available: true,
    notes: 'Bed was available but transport never called. OR nurse had to walk patient.', created_at: '2026-04-09T12:15:00Z',
  },
  {
    id: 'po-3', patient_wait_minutes: 55, staff_idle_minutes: 40,
    delay_reason: 'Scheduling overlap — two cases finishing simultaneously', facility: 'Ambulatory Center',
    surgeon_name: 'Dr. Patel', service_line: 'Orthopedics', day_of_week: 'Monday', shift: 'PM',
    bed_available: false, notes: 'Chronic Monday PM bottleneck. Both ORs release patients to single recovery bay.', created_at: '2026-04-07T15:00:00Z',
  },
  {
    id: 'po-4', patient_wait_minutes: 15, staff_idle_minutes: 5,
    delay_reason: 'Brief handoff delay', facility: 'Main Campus', surgeon_name: 'Dr. Lee',
    service_line: 'Neurosurgery', day_of_week: 'Wednesday', shift: 'AM', bed_available: true,
    notes: 'Minimal delay. Within acceptable range.', created_at: '2026-04-06T10:45:00Z',
  },
  {
    id: 'po-5', patient_wait_minutes: 38, staff_idle_minutes: 20,
    delay_reason: 'Overcrowded PACU', facility: 'Main Campus', surgeon_name: 'Dr. Kim',
    service_line: 'General Surgery', day_of_week: 'Monday', shift: 'AM', bed_available: false,
    notes: 'Monday mornings consistently show PACU saturation.', created_at: '2026-04-05T11:00:00Z',
  },
];
