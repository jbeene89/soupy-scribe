import { supabase } from '@/integrations/supabase/client';
import { logPhiAccess } from '@/lib/phiAccessLog';
import type { OBAuditRequest, OBAuditResult, CareEvent, VitalsReading } from './obFetalTypes';

export async function runOBAudit(req: OBAuditRequest): Promise<OBAuditResult> {
  await logPhiAccess({ resourceType: 'ob_fetal_audit', resourceId: 'run', action: 'analyze' }).catch(() => {});
  const { data, error } = await supabase.functions.invoke('ob-fetal-audit', { body: req });
  if (error) throw new Error(error.message);
  if (!data || (data as any).error) throw new Error((data as any)?.error || 'Audit failed');
  return data as OBAuditResult;
}

/** Built-in demo bundle approximating a high-acuity L&D case with all four added rule types
 *  firing: sustained hypotension on arrival, undocumented membrane sweep, Cervidil → Misoprostol
 *  → Pitocin stack, then a 3.5-hour unattended overnight gap with continued Pitocin escalation
 *  through a deteriorating tracing. */
export function buildDemoOBBundle(): OBAuditRequest {
  // Anchor everything to "yesterday" so timestamps look like a real overnight admission.
  const start = new Date();
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0); // 18:00 arrival
  const isoAt = (min: number) => new Date(start.getTime() + min * 60_000).toISOString();

  const samples: NonNullable<OBAuditRequest['stripSamples']> = [];
  // 14 hours of samples at 1/min starting from Cervidil placement at 18:30.
  for (let m = 30; m < 14 * 60; m++) {
    let fhr = 145 + Math.round(Math.sin(m / 4) * 4);
    // Recurrent late decels begin shortly after Pitocin escalates (around 21:00 = min 180).
    if (m >= 180 && m % 4 === 1) fhr = 115;
    if (m >= 480 && m % 3 === 1) fhr = 100; // by 02:00, deeper decels
    if (m >= 700 && m % 3 === 1) fhr = 88;  // by ~05:40, profound decels, loss of variability
    // Contractions: spaced before Pit, then frequent — tachysystole develops.
    const ucPeriod = m < 180 ? 3 : (m < 480 ? 1.6 : 1.2);
    const uc = Math.abs(Math.sin((m * Math.PI) / ucPeriod)) > 0.8 ? 90 : 10;
    samples.push({ t: isoAt(m), fhr, uc });
  }

  const events: NonNullable<OBAuditRequest['marEvents']> = [
    { t: isoAt(30),  medication: 'cervidil',    medicationLabel: 'Cervidil (dinoprostone)', action: 'dose',     amount: 10, unit: 'mg',    evidence: '18:30 Cervidil 10 mg placed intravaginally' },
    { t: isoAt(150), medication: 'misoprostol', medicationLabel: 'Misoprostol',             action: 'dose',     amount: 25, unit: 'mcg',   evidence: '20:30 Misoprostol 25 mcg PO' },
    { t: isoAt(210), medication: 'misoprostol', medicationLabel: 'Misoprostol',             action: 'dose',     amount: 25, unit: 'mcg',   evidence: '21:30 Misoprostol 25 mcg PO (2nd dose, 60 min after first)' },
    { t: isoAt(270), medication: 'pitocin',     medicationLabel: 'Oxytocin (Pitocin)',      action: 'start',    amount: 2,  unit: 'mU/min', evidence: '22:30 Pitocin started at 2 mU/min (Cervidil never removed; 60 min after last Miso)' },
    { t: isoAt(330), medication: 'pitocin',     medicationLabel: 'Oxytocin (Pitocin)',      action: 'increase', amount: 6,  unit: 'mU/min', evidence: '23:30 Pitocin increased to 6 mU/min' },
    { t: isoAt(450), medication: 'pitocin',     medicationLabel: 'Oxytocin (Pitocin)',      action: 'increase', amount: 12, unit: 'mU/min', evidence: '01:30 Pitocin increased to 12 mU/min' },
    { t: isoAt(795), medication: 'pitocin',     medicationLabel: 'Oxytocin (Pitocin)',      action: 'increase', amount: 16, unit: 'mU/min', evidence: '07:15 Pitocin increased to 16 mU/min (per Dr. order)' },
    { t: isoAt(815), medication: 'pitocin',     medicationLabel: 'Oxytocin (Pitocin)',      action: 'discontinue',                          evidence: '07:35 Pitocin discontinued — prepping for emergency C-section' },
  ];

  const vitalsReadings: VitalsReading[] = [
    { t: isoAt(0),   sbp: 54, dbp: 36, hr: 118, evidence: '18:00 BP 54/36, HR 118 (eval room, unattended)' },
    { t: isoAt(5),   sbp: 56, dbp: 38, hr: 120, evidence: '18:05 BP 56/38, HR 120' },
    { t: isoAt(10),  sbp: 52, dbp: 34, hr: 122, evidence: '18:10 BP 52/34, HR 122' },
    { t: isoAt(15),  sbp: 98, dbp: 60, hr: 96,  evidence: '18:15 BP 98/60 after recheck triggered by OB call' },
    { t: isoAt(45),  sbp: 112, dbp: 70, hr: 88, evidence: '18:45 BP 112/70' },
    { t: isoAt(150), sbp: 118, dbp: 72, hr: 86, evidence: '20:30 BP 118/72' },
    { t: isoAt(210), sbp: 116, dbp: 70, hr: 90, evidence: '21:30 BP 116/70' },
    { t: isoAt(270), sbp: 120, dbp: 74, hr: 92, evidence: '22:30 BP 120/74' },
    { t: isoAt(330), sbp: 118, dbp: 72, hr: 96, evidence: '23:30 BP 118/72' },
    { t: isoAt(795), sbp: 92,  dbp: 56, hr: 128, evidence: '07:15 BP 92/56, HR 128 — RN Brittany reassessing' },
  ];

  const careEvents: CareEvent[] = [
    { t: isoAt(35),  kind: 'cervidil_placed', description: '18:35 Cervidil placed by RN' },
    { t: isoAt(36),  kind: 'membrane_sweep',  description: '18:36 Patient reports possible membrane sweep performed at time of Cervidil placement (no consent or provider order documented)' },
    { t: isoAt(150), kind: 'cervical_exam',   description: '20:30 SVE: 1 cm / 50% / -2' },
    { t: isoAt(210), kind: 'cervical_exam',   description: '21:30 SVE: no change' },
    { t: isoAt(270), kind: 'provider_notified', description: '22:30 OB notified, Pitocin order received' },
    { t: isoAt(795), kind: 'rn_at_bedside',   description: '07:15 RN Brittany at bedside, concerned re: maternal and fetal vitals since Pitocin start' },
    { t: isoAt(805), kind: 'provider_notified', description: '07:25 OB notified — Pitocin increased per order; vitals dropped within minutes' },
    { t: isoAt(820), kind: 'consent_obtained', description: '07:40 C-section consent obtained' },
  ];

  return {
    stripSamples: samples,
    marEvents: events,
    vitalsReadings,
    careEvents,
    notesText: [
      '18:10 No staff in room.',
      '18:15 OB called remotely demanding bedside check; nurse responds.',
      '18:30 Cervidil placed.',
      '22:30 Pitocin started per order.',
      '03:30 Last documented bedside check.',
      '07:15 RN Brittany reassessing — vitals poor since Pit start, advocating for C-section.',
      '07:35 Pitocin discontinued, prepping for emergency C-section.',
    ].join('\n'),
    windowMinutes: 10,
    caseHeader: {
      patientInitials: 'L.',
      facility: 'Baptist Medical Center Downtown',
      unit: 'Labor & Delivery',
      roomNumber: 'Room 10 (2nd floor)',
      narrative:
        'Patient was sent directly to L&D by an outpatient specialist with instructions for emergency C-section. On arrival to the evaluation room her blood pressure was approximately 50s/36 for nearly 10 minutes with no bedside response until the OB called remotely. She was subsequently moved to a second-floor interior room, hooked back up to monitors, allowed to eat, and Cervidil was placed; the patient believed a membrane sweep was performed at the same time without consent or explanation. Misoprostol was given twice, followed by Pitocin started while Cervidil was still in place. No bedside vitals were documented from approximately 03:30 to 07:15. When the next nurse came on, she advocated immediately for a C-section, and shortly after a further Pitocin increase, maternal and fetal vitals deteriorated again and the patient was taken for emergency C-section.',
    },
  };
}
