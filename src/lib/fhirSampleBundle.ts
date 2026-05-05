/**
 * Synthea-style synthetic FHIR R4 Bundle for demos and self-service pilots.
 * 100% fictitious — no real PHI. Designed to exercise:
 *   - Patient, Coverage, Encounter
 *   - Condition (with CC/MCC potential — sepsis, acute respiratory failure)
 *   - Procedure (CPT-coded)
 *   - Claim with line items + diagnosis pointers
 *   - ExplanationOfBenefit with a denial reason (CO-50)
 *   - Observation (PHQ-9 — also useful for psych demo)
 *   - DocumentReference with embedded base64 progress note
 */

const PROGRESS_NOTE = `OPERATIVE / PROGRESS NOTE
Date of Service: 2025-11-12
Patient: Synthetic, Patient (DOB 1962-04-08)
Facility: Demo Regional Medical Center
Attending: Dr. A. Demo, MD

HPI: 63-year-old presenting with 4 days of productive cough, fever to 102.4F, hypoxia (SpO2 87% on RA), and altered mental status. Hx of COPD, HTN, T2DM.

ADMISSION DIAGNOSES:
1. Severe sepsis with acute respiratory failure secondary to community-acquired pneumonia (A41.9, J96.01)
2. Acute on chronic hypoxic respiratory failure (J96.21)
3. Acute kidney injury, stage 2 (N17.9)
4. Type 2 diabetes mellitus, uncontrolled (E11.65)

HOSPITAL COURSE: Admitted to ICU, started on broad-spectrum antibiotics (vancomycin, piperacillin-tazobactam), required HFNC then BiPAP. Lactate cleared from 4.2 to 1.1 over 36h. Renal function recovered with IVF.

PROCEDURES:
- Critical care services 30-74 minutes (CPT 99291) x 3 days
- Arterial line placement (CPT 36620)
- Mechanical ventilation initiation (CPT 94002)

DOCUMENTATION GAPS NOTED:
- Sepsis definition criteria (SIRS / SOFA) not explicitly stated in admission note
- No physician attestation tying ARF to sepsis (linkage required for MCC capture)
- Discharge summary missing — affects DRG assignment risk

DISCHARGE DISPOSITION: Home with home health, day 6.
`;

function b64(str: string): string {
  // Browser-safe UTF-8 → base64
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function buildSyntheticFhirBundle(): unknown {
  return {
    resourceType: 'Bundle',
    id: 'soupy-demo-bundle-001',
    type: 'collection',
    timestamp: '2025-11-18T12:00:00Z',
    entry: [
      {
        resource: {
          resourceType: 'Patient',
          id: 'pt-synthetic-001',
          identifier: [{ system: 'urn:demo:mrn', value: 'MRN-DEMO-001' }],
          name: [{ use: 'official', family: 'Synthetic', given: ['Patient'] }],
          gender: 'male',
          birthDate: '1962-04-08',
          address: [{ city: 'Springfield', state: 'FL', country: 'US' }],
        },
      },
      {
        resource: {
          resourceType: 'Coverage',
          id: 'cov-001',
          status: 'active',
          beneficiary: { reference: 'Patient/pt-synthetic-001' },
          payor: [{ display: 'Medicare Part A' }],
          period: { start: '2025-01-01' },
          subscriberId: 'XXX-XX-1234A',
        },
      },
      {
        resource: {
          resourceType: 'Encounter',
          id: 'enc-001',
          status: 'finished',
          class: { code: 'IMP', display: 'inpatient' },
          type: [{ text: 'Inpatient admission' }],
          subject: { reference: 'Patient/pt-synthetic-001' },
          period: { start: '2025-11-12T08:14:00Z', end: '2025-11-18T11:30:00Z' },
          reasonCode: [{ text: 'Sepsis with acute respiratory failure' }],
          serviceProvider: { display: 'Demo Regional Medical Center' },
        },
      },
      {
        resource: {
          resourceType: 'Condition',
          id: 'cond-001',
          clinicalStatus: { coding: [{ code: 'active' }] },
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'A41.9', display: 'Sepsis, unspecified organism' }], text: 'Severe sepsis' },
          subject: { reference: 'Patient/pt-synthetic-001' },
          recordedDate: '2025-11-12',
        },
      },
      {
        resource: {
          resourceType: 'Condition',
          id: 'cond-002',
          clinicalStatus: { coding: [{ code: 'active' }] },
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'J96.01', display: 'Acute respiratory failure with hypoxia' }] },
          subject: { reference: 'Patient/pt-synthetic-001' },
          recordedDate: '2025-11-12',
        },
      },
      {
        resource: {
          resourceType: 'Condition',
          id: 'cond-003',
          clinicalStatus: { coding: [{ code: 'resolved' }] },
          code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'N17.9', display: 'Acute kidney injury, unspecified' }] },
          subject: { reference: 'Patient/pt-synthetic-001' },
        },
      },
      {
        resource: {
          resourceType: 'Procedure',
          id: 'proc-001',
          status: 'completed',
          code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99291', display: 'Critical care, first 30-74 minutes' }] },
          subject: { reference: 'Patient/pt-synthetic-001' },
          performedDateTime: '2025-11-12',
        },
      },
      {
        resource: {
          resourceType: 'Procedure',
          id: 'proc-002',
          status: 'completed',
          code: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '36620', display: 'Arterial catheterization' }] },
          subject: { reference: 'Patient/pt-synthetic-001' },
          performedDateTime: '2025-11-12',
        },
      },
      {
        resource: {
          resourceType: 'Observation',
          id: 'obs-lactate',
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '2524-7', display: 'Lactate' }] },
          valueQuantity: { value: 4.2, unit: 'mmol/L' },
          effectiveDateTime: '2025-11-12T09:00:00Z',
          subject: { reference: 'Patient/pt-synthetic-001' },
        },
      },
      {
        resource: {
          resourceType: 'Claim',
          id: 'claim-001',
          status: 'active',
          use: 'claim',
          patient: { reference: 'Patient/pt-synthetic-001' },
          billablePeriod: { start: '2025-11-12', end: '2025-11-18' },
          insurer: { display: 'Medicare Part A' },
          provider: { display: 'Demo Regional Medical Center' },
          total: { value: 48720.0, currency: 'USD' },
          diagnosis: [
            { sequence: 1, diagnosisCodeableConcept: { coding: [{ code: 'A41.9' }], text: 'Sepsis' } },
            { sequence: 2, diagnosisCodeableConcept: { coding: [{ code: 'J96.01' }], text: 'Acute respiratory failure with hypoxia' } },
            { sequence: 3, diagnosisCodeableConcept: { coding: [{ code: 'N17.9' }], text: 'AKI' } },
          ],
          item: [
            { sequence: 1, productOrService: { coding: [{ code: '99291' }] }, quantity: { value: 3 }, unitPrice: { value: 1450, currency: 'USD' }, diagnosisSequence: [1, 2] },
            { sequence: 2, productOrService: { coding: [{ code: '36620' }] }, quantity: { value: 1 }, unitPrice: { value: 920, currency: 'USD' }, diagnosisSequence: [2] },
            { sequence: 3, productOrService: { coding: [{ code: '94002' }] }, quantity: { value: 1 }, unitPrice: { value: 540, currency: 'USD' }, diagnosisSequence: [2] },
          ],
        },
      },
      {
        resource: {
          resourceType: 'ExplanationOfBenefit',
          id: 'eob-001',
          status: 'active',
          outcome: 'partial',
          disposition: 'Line 1 denied: documentation does not support medical necessity for critical care services on day 3.',
          patient: { reference: 'Patient/pt-synthetic-001' },
          claim: { reference: 'Claim/claim-001' },
          insurer: { display: 'Medicare Part A' },
          total: [
            { category: { coding: [{ code: 'submitted' }] }, amount: { value: 48720.0, currency: 'USD' } },
            { category: { coding: [{ code: 'benefit' }] }, amount: { value: 41850.0, currency: 'USD' } },
          ],
          item: [
            {
              sequence: 1,
              productOrService: { coding: [{ code: '99291' }] },
              adjudication: [
                { category: { coding: [{ code: 'submitted' }] }, amount: { value: 4350.0 } },
                { category: { coding: [{ code: 'denial' }] }, reason: { coding: [{ code: 'CO-50' }] }, amount: { value: 1450.0 } },
              ],
            },
          ],
        },
      },
      {
        resource: {
          resourceType: 'DocumentReference',
          id: 'doc-001',
          status: 'current',
          type: { text: 'Operative / Progress Note' },
          description: 'Hospital course narrative — admission through discharge',
          subject: { reference: 'Patient/pt-synthetic-001' },
          content: [
            { attachment: { contentType: 'text/plain', data: b64(PROGRESS_NOTE), title: 'progress-note.txt' } },
          ],
        },
      },
    ],
  };
}

/** Pretty-printed JSON string ready to drop into a textarea or download. */
export function getSyntheticFhirBundleJson(): string {
  return JSON.stringify(buildSyntheticFhirBundle(), null, 2);
}

/** Triggers a browser download of the sample bundle. */
export function downloadSyntheticFhirBundle(filename = 'soupy-demo-fhir-bundle.json') {
  const blob = new Blob([getSyntheticFhirBundleJson()], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}