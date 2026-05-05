/**
 * Minimal HL7 v2.x parser focused on ADT (admit/discharge/transfer) and DFT
 * (detail financial transaction) messages — the two flavors most hospitals
 * still emit alongside or instead of FHIR.
 *
 * This is intentionally permissive: real-world v2 feeds vary wildly in
 * encoding characters, segment ordering, and Z-segments. We accept the
 * standard delimiters declared in MSH-1/MSH-2 and surface a structured
 * summary the audit pipeline can normalize alongside FHIR output.
 */

export interface Hl7Segment {
  name: string;
  fields: string[];
}

export interface Hl7v2IngestResult {
  messageType: string;          // e.g. "ADT^A01"
  triggerEvent: string;         // e.g. "A01"
  controlId: string;
  sendingApp: string;
  sendingFacility: string;
  receivingApp: string;
  receivingFacility: string;
  timestamp: string;
  patient: {
    mrn: string;
    name: string;
    dob: string;
    sex: string;
  };
  encounter: {
    visitNumber: string;
    patientClass: string;       // I=Inpatient, O=Outpatient, E=Emergency
    admitDateTime: string;
    dischargeDateTime: string;
    attendingProvider: string;
    admitDiagnosis: string;
  };
  diagnoses: { code: string; description: string; type: string }[];
  procedures: { code: string; description: string; date: string }[];
  charges: { code: string; description: string; amount: string }[]; // FT1 segments for DFT
  segmentsParsed: number;
  warnings: string[];
  normalizedSummary: string;    // plain-text rollup for the audit pipeline
}

const STD = { field: '|', component: '^', repetition: '~', escape: '\\', subcomponent: '&' };

function detect(message: string) {
  const trimmed = message.trim();
  if (!trimmed.startsWith('MSH')) return null;
  // MSH segment encodes its own delimiters: MSH|^~\&|...
  const field = trimmed.charAt(3);
  const enc = trimmed.substring(4, 8);
  return {
    field,
    component: enc[0] || STD.component,
    repetition: enc[1] || STD.repetition,
    escape: enc[2] || STD.escape,
    subcomponent: enc[3] || STD.subcomponent,
  };
}

function fmtDate(v: string): string {
  if (!v) return '';
  // HL7 v2 timestamps: YYYYMMDDHHMMSS
  const y = v.substring(0, 4);
  const m = v.substring(4, 6);
  const d = v.substring(6, 8);
  if (!y || !m || !d) return v;
  return `${y}-${m}-${d}${v.length > 8 ? `T${v.substring(8, 10)}:${v.substring(10, 12)}` : ''}`;
}

export function parseHl7v2(raw: string): Hl7v2IngestResult | null {
  const enc = detect(raw);
  if (!enc) return null;

  const lines = raw
    .replace(/\r\n/g, '\r')
    .replace(/\n/g, '\r')
    .split('\r')
    .map(l => l.trim())
    .filter(Boolean);

  const segments: Hl7Segment[] = lines.map((line) => {
    const fields = line.split(enc.field);
    return { name: fields[0], fields };
  });

  const warnings: string[] = [];
  const get = (segName: string, ...indices: number[]) => {
    const s = segments.find(x => x.name === segName);
    if (!s) return '';
    let cur: string = s.fields[indices[0]] ?? '';
    for (let i = 1; i < indices.length; i++) {
      cur = (cur ?? '').split(enc.component)[indices[i]] ?? '';
    }
    return cur;
  };

  const msh = segments.find(s => s.name === 'MSH');
  if (!msh) return null;

  // MSH-9 = MessageType^TriggerEvent^MessageStructure
  const msgType = msh.fields[9] ?? '';
  const [type, trigger] = msgType.split(enc.component);

  // PID-3 = Patient ID list (MRN typically first), PID-5 = name (LN^FN^MN), PID-7 = DOB, PID-8 = sex
  const pidName = get('PID', 5);
  const [ln, fn, mn] = pidName.split(enc.component);
  const patientName = [fn, mn, ln].filter(Boolean).join(' ');

  // PV1-2=Patient class, PV1-19=Visit number, PV1-44=Admit DT, PV1-45=Discharge DT, PV1-7=Attending
  const dg1Segments = segments.filter(s => s.name === 'DG1');
  const diagnoses = dg1Segments.map((s) => ({
    code: (s.fields[3] ?? '').split(enc.component)[0] ?? '',
    description: (s.fields[3] ?? '').split(enc.component)[1] ?? (s.fields[4] ?? ''),
    type: s.fields[6] ?? '',
  })).filter(d => d.code);

  const pr1Segments = segments.filter(s => s.name === 'PR1');
  const procedures = pr1Segments.map((s) => ({
    code: (s.fields[3] ?? '').split(enc.component)[0] ?? '',
    description: (s.fields[3] ?? '').split(enc.component)[1] ?? '',
    date: fmtDate(s.fields[5] ?? ''),
  })).filter(p => p.code);

  // FT1 (DFT charges): FT1-7 = transaction code, FT1-6 = transaction type, FT1-10 = amount
  const ft1Segments = segments.filter(s => s.name === 'FT1');
  const charges = ft1Segments.map((s) => ({
    code: (s.fields[7] ?? '').split(enc.component)[0] ?? '',
    description: (s.fields[7] ?? '').split(enc.component)[1] ?? '',
    amount: s.fields[10] ?? '',
  })).filter(c => c.code);

  if (!segments.find(s => s.name === 'PID')) warnings.push('Missing PID segment — patient identity not extractable');
  if (!segments.find(s => s.name === 'PV1') && (type === 'ADT')) warnings.push('Missing PV1 segment — encounter context unavailable');

  const result: Hl7v2IngestResult = {
    messageType: msgType,
    triggerEvent: trigger ?? '',
    controlId: msh.fields[10] ?? '',
    sendingApp: msh.fields[3] ?? '',
    sendingFacility: msh.fields[4] ?? '',
    receivingApp: msh.fields[5] ?? '',
    receivingFacility: msh.fields[6] ?? '',
    timestamp: fmtDate(msh.fields[7] ?? ''),
    patient: {
      mrn: (get('PID', 3) ?? '').split(enc.component)[0] ?? '',
      name: patientName,
      dob: fmtDate(get('PID', 7)),
      sex: get('PID', 8),
    },
    encounter: {
      visitNumber: (get('PV1', 19) ?? '').split(enc.component)[0] ?? '',
      patientClass: get('PV1', 2),
      admitDateTime: fmtDate(get('PV1', 44)),
      dischargeDateTime: fmtDate(get('PV1', 45)),
      attendingProvider: get('PV1', 7, 1) + (get('PV1', 7, 2) ? ` ${get('PV1', 7, 2)}` : ''),
      admitDiagnosis: get('PV1', 18),
    },
    diagnoses,
    procedures,
    charges,
    segmentsParsed: segments.length,
    warnings,
    normalizedSummary: '',
  };

  // Plain-text rollup for the audit pipeline
  const lines2: string[] = [];
  lines2.push(`HL7 v2 ${result.messageType} from ${result.sendingApp}@${result.sendingFacility} (${result.timestamp})`);
  lines2.push(`Patient: ${result.patient.name} | MRN ${result.patient.mrn} | DOB ${result.patient.dob} | Sex ${result.patient.sex}`);
  if (result.encounter.visitNumber) {
    lines2.push(`Encounter: visit ${result.encounter.visitNumber}, class ${result.encounter.patientClass}, admit ${result.encounter.admitDateTime}, discharge ${result.encounter.dischargeDateTime || 'n/a'}, attending ${result.encounter.attendingProvider}`);
  }
  if (diagnoses.length) {
    lines2.push('Diagnoses:');
    diagnoses.forEach(d => lines2.push(`  - ${d.code} ${d.description}${d.type ? ` (${d.type})` : ''}`));
  }
  if (procedures.length) {
    lines2.push('Procedures:');
    procedures.forEach(p => lines2.push(`  - ${p.code} ${p.description} ${p.date}`));
  }
  if (charges.length) {
    lines2.push('Charges (FT1):');
    charges.forEach(c => lines2.push(`  - ${c.code} ${c.description} $${c.amount}`));
  }
  result.normalizedSummary = lines2.join('\n');

  return result;
}

export function isHl7v2(text: string): boolean {
  return /^MSH[|^~\\&]/.test(text.trim());
}

export const SAMPLE_ADT_A01 = `MSH|^~\\&|EPIC|UFHEALTH|SOUPY|AUDIT|20260505120000||ADT^A01|MSG00001|P|2.5
EVN|A01|20260505120000
PID|1||MRN12345^^^UFHEALTH^MR||DOE^JOHN^A||19550412|M|||123 MAIN ST^^GAINESVILLE^FL^32601
PV1|1|I|3W^301^A^UFHEALTH||||1234^SMITH^SARAH^MD|||MED||||||||V12345|||||||||||||||||||||||||20260505120000
DG1|1|I10|J18.9^Pneumonia, unspecified organism^I10|Pneumonia|20260505|A
DG1|2|I10|N17.9^Acute kidney failure, unspecified^I10|AKI|20260505|W`;