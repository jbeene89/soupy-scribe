// Demo imaging findings used when the user has Demo data source selected.
// Tied to the same patient_ids and physician names that appear in operational
// and case mock data so System Impact can connect them.
import type { ImagingFinding } from './imagingTypes';

const today = new Date();
const days = (n: number) => new Date(today.getTime() - n * 86400000).toISOString();

export const mockImagingFindings: ImagingFinding[] = [
  {
    id: 'img-mock-1',
    patient_id: 'PT-2024-0042',
    physician_name: 'Dr. Sarah Chen',
    procedure_label: 'Bilateral TKA — primary',
    body_region: 'knee',
    expected_implant_count: 2,
    detected_implant_count: 1,
    cpt_codes: ['27447', '27447-50'],
    ai_summary: 'Only ONE knee implant visible — billed as bilateral TKA. Likely missing post-op view of left knee.',
    ai_confidence: 88,
    severity: 'high',
    status: 'analyzed',
    estimated_loss: 5900,
    image_file_name: 'PT-2024-0042_postop_kneeAP.jpg',
    ai_findings: [
      { label: 'Implant count mismatch', severity: 'high', detail: 'Image shows a single right TKA. Claim bills 27447-50 (bilateral). Add the contralateral view or correct laterality.', matches_billing: false },
      { label: 'Hardware position', severity: 'low', detail: 'Visible femoral and tibial components are well-aligned, no obvious loosening.', matches_billing: true },
    ],
    created_at: days(2),
  },
  {
    id: 'img-mock-2',
    patient_id: 'PT-2024-0107',
    physician_name: 'Dr. Marcus Webb',
    procedure_label: 'Right hip arthroplasty',
    body_region: 'hip',
    expected_implant_count: 1,
    detected_implant_count: 1,
    cpt_codes: ['27130'],
    ai_summary: 'Single right total hip arthroplasty visualized — components match billed procedure.',
    ai_confidence: 94,
    severity: 'low',
    status: 'reviewed',
    estimated_loss: 0,
    image_file_name: 'PT-2024-0107_postop_hip.jpg',
    ai_findings: [
      { label: 'Implant match', severity: 'low', detail: 'Acetabular cup, femoral stem, and head ball visible. Consistent with 27130.', matches_billing: true },
    ],
    created_at: days(5),
  },
  {
    id: 'img-mock-3',
    patient_id: 'PT-2024-0042',
    physician_name: 'Dr. Sarah Chen',
    procedure_label: 'Lumbar fusion L4-L5',
    body_region: 'spine',
    expected_implant_count: 6,
    detected_implant_count: 4,
    cpt_codes: ['22633', '22634'],
    ai_summary: 'Four pedicle screws visible; claim implies 6-screw construct. Verify additional level documentation.',
    ai_confidence: 79,
    severity: 'medium',
    status: 'analyzed',
    estimated_loss: 2350,
    image_file_name: 'PT-2024-0042_postop_lumbar.jpg',
    ai_findings: [
      { label: 'Screw count', severity: 'medium', detail: 'AP view shows 4 pedicle screws across L4-L5. If add-on level (22634) was billed, lateral view should confirm 6-screw construct.', matches_billing: false },
      { label: 'Cage placement', severity: 'low', detail: 'Interbody cage appears centered with no migration.', matches_billing: true },
    ],
    created_at: days(8),
  },
  {
    id: 'img-mock-4',
    patient_id: 'PT-2024-0188',
    physician_name: 'Dr. Anita Rao',
    procedure_label: 'Right shoulder arthroscopy with rotator cuff repair',
    body_region: 'shoulder',
    expected_implant_count: 3,
    detected_implant_count: 0,
    cpt_codes: ['29827'],
    ai_summary: 'No suture anchors visible on this view — anchors may be radiolucent or post-op view missed them.',
    ai_confidence: 62,
    severity: 'medium',
    status: 'analyzed',
    estimated_loss: 850,
    image_file_name: 'PT-2024-0188_postop_shoulder.jpg',
    ai_findings: [
      { label: 'Anchor visualization', severity: 'medium', detail: 'Many modern suture anchors are radiolucent; absence on plain film does NOT confirm absence in the joint. Recommend confirming with op-note implant log.', matches_billing: true },
    ],
    created_at: days(11),
  },
];