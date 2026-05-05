/**
 * Minimal X12 EDI parser for healthcare 837 (claim), 835 (remit), and 277
 * (claim status). Real-world X12 is gnarly — full HIPAA implementation guides
 * run hundreds of pages. This parser pulls the high-value loops the audit
 * engine needs: claim ID, patient, dx/proc, charge/paid amounts, and adjustment
 * reason codes.
 */

export interface X12Segment {
  tag: string;
  elements: string[];
}

export interface X12IngestResult {
  transactionType: '837' | '835' | '277' | 'unknown';
  interchangeSender: string;
  interchangeReceiver: string;
  controlNumber: string;
  date: string;
  claims: X12Claim[];
  segmentsParsed: number;
  warnings: string[];
  normalizedSummary: string;
}

export interface X12Claim {
  claimId: string;            // CLM01 (837) or CLP01 (835) or TRN02 (277)
  patient: { name: string; memberId: string };
  totalCharge: string;
  totalPaid?: string;         // 835 only
  status?: string;            // 835 CLP02 or 277 STC01
  diagnoses: string[];        // HI segments
  serviceLines: { code: string; modifier?: string; charge: string; paid?: string; adjustments: string[] }[];
  payer?: string;
  provider?: string;
}

const SEG_DELIM_DEFAULT = '~';
const ELEM_DELIM_DEFAULT = '*';

function detectDelimiters(raw: string) {
  // ISA segment is fixed-width 106 chars; element delimiter is char 4, segment delimiter follows ISA16.
  if (!raw.startsWith('ISA')) return { seg: SEG_DELIM_DEFAULT, elem: ELEM_DELIM_DEFAULT };
  const elem = raw.charAt(3);
  // Find ISA16 (component delim) at position 105, then segment delim at 106
  const seg = raw.charAt(105) || SEG_DELIM_DEFAULT;
  return { seg, elem };
}

export function isX12(text: string): boolean {
  return /^ISA[*|^]/.test(text.trim());
}

export function parseX12(raw: string): X12IngestResult | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('ISA')) return null;

  const { seg, elem } = detectDelimiters(trimmed);
  const segments: X12Segment[] = trimmed
    .split(seg)
    .map(s => s.replace(/\r?\n/g, '').trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(elem);
      return { tag: parts[0], elements: parts };
    });

  const warnings: string[] = [];
  const isa = segments.find(s => s.tag === 'ISA');
  const st = segments.find(s => s.tag === 'ST');
  const txCode = st?.elements[1] ?? '';
  const txType: X12IngestResult['transactionType'] =
    txCode === '837' ? '837' :
    txCode === '835' ? '835' :
    txCode === '277' ? '277' : 'unknown';

  if (txType === 'unknown') warnings.push(`Transaction type ${txCode} not recognized — supported: 837, 835, 277`);

  const claims: X12Claim[] = [];
  let current: X12Claim | null = null;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];

    // 837 claim header
    if (s.tag === 'CLM') {
      if (current) claims.push(current);
      current = {
        claimId: s.elements[1] ?? '',
        patient: { name: '', memberId: '' },
        totalCharge: s.elements[2] ?? '',
        diagnoses: [],
        serviceLines: [],
      };
    }
    // 835 claim payment
    else if (s.tag === 'CLP') {
      if (current) claims.push(current);
      current = {
        claimId: s.elements[1] ?? '',
        patient: { name: '', memberId: '' },
        status: s.elements[2] ?? '',
        totalCharge: s.elements[3] ?? '',
        totalPaid: s.elements[4] ?? '',
        diagnoses: [],
        serviceLines: [],
      };
    }
    // 277 claim status info
    else if (s.tag === 'TRN' && txType === '277') {
      if (current) claims.push(current);
      current = {
        claimId: s.elements[2] ?? '',
        patient: { name: '', memberId: '' },
        totalCharge: '',
        diagnoses: [],
        serviceLines: [],
      };
    }
    else if (s.tag === 'STC' && current && txType === '277') {
      // STC01 = composite of category^code; pull the readable parts
      current.status = (s.elements[1] ?? '').replace(/\:/g, ' / ');
    }
    // Patient name
    else if (s.tag === 'NM1' && (s.elements[1] === 'QC' || s.elements[1] === 'IL') && current) {
      const ln = s.elements[3] ?? '';
      const fn = s.elements[4] ?? '';
      current.patient.name = [fn, ln].filter(Boolean).join(' ');
      current.patient.memberId = s.elements[9] ?? current.patient.memberId;
    }
    // Payer (835)
    else if (s.tag === 'N1' && s.elements[1] === 'PR' && current) {
      current.payer = s.elements[2] ?? '';
    }
    // Provider (835)
    else if (s.tag === 'N1' && s.elements[1] === 'PE' && current) {
      current.provider = s.elements[2] ?? '';
    }
    // Diagnoses (837)
    else if (s.tag === 'HI' && current) {
      for (let j = 1; j < s.elements.length; j++) {
        const composite = s.elements[j];
        if (!composite) continue;
        const parts = composite.split(':');
        if (parts[1]) current.diagnoses.push(parts[1]);
      }
    }
    // Service line (837 SV1, 835 SVC)
    else if ((s.tag === 'SV1' || s.tag === 'SVC') && current) {
      const composite = s.elements[1] ?? '';
      const parts = composite.split(':');
      const proc = parts[1] ?? '';
      const modifier = parts[2] || undefined;
      const charge = s.elements[2] ?? '';
      const paid = s.tag === 'SVC' ? s.elements[3] : undefined;
      current.serviceLines.push({ code: proc, modifier, charge, paid, adjustments: [] });
    }
    // Adjustment reason (835 CAS)
    else if (s.tag === 'CAS' && current) {
      const grp = s.elements[1];
      const reason = s.elements[2];
      const amount = s.elements[3];
      const adj = `${grp}-${reason}: $${amount}`;
      const last = current.serviceLines[current.serviceLines.length - 1];
      if (last) last.adjustments.push(adj);
    }
  }
  if (current) claims.push(current);

  // Build summary
  const lines: string[] = [];
  lines.push(`X12 ${txType} | ISA sender ${isa?.elements[6]?.trim() ?? ''} → receiver ${isa?.elements[8]?.trim() ?? ''}`);
  lines.push(`Claims parsed: ${claims.length}`);
  for (const c of claims) {
    lines.push('---');
    lines.push(`Claim ${c.claimId} | Patient: ${c.patient.name || 'unknown'} (${c.patient.memberId})`);
    if (c.payer) lines.push(`Payer: ${c.payer}`);
    if (c.provider) lines.push(`Provider: ${c.provider}`);
    if (c.status) lines.push(`Status: ${c.status}`);
    lines.push(`Total charge: $${c.totalCharge}${c.totalPaid ? ` | Total paid: $${c.totalPaid}` : ''}`);
    if (c.diagnoses.length) lines.push(`Diagnoses: ${c.diagnoses.join(', ')}`);
    if (c.serviceLines.length) {
      lines.push('Service lines:');
      c.serviceLines.forEach(sl => {
        lines.push(`  - ${sl.code}${sl.modifier ? `-${sl.modifier}` : ''} charge $${sl.charge}${sl.paid ? ` paid $${sl.paid}` : ''}${sl.adjustments.length ? ` [${sl.adjustments.join(' | ')}]` : ''}`);
      });
    }
  }

  return {
    transactionType: txType,
    interchangeSender: isa?.elements[6]?.trim() ?? '',
    interchangeReceiver: isa?.elements[8]?.trim() ?? '',
    controlNumber: isa?.elements[13] ?? '',
    date: isa?.elements[9] ?? '',
    claims,
    segmentsParsed: segments.length,
    warnings,
    normalizedSummary: lines.join('\n'),
  };
}

export const SAMPLE_835 = `ISA*00*          *00*          *ZZ*PAYER123456    *ZZ*PROVIDER999    *260505*1200*^*00501*000000001*0*P*:~GS*HP*PAYER*PROVIDER*20260505*1200*1*X*005010X221A1~ST*835*0001~BPR*I*1250.00*C*ACH*CCP*01*999999999*DA*123456789*1234567890**01*888888888*DA*987654321*20260505~TRN*1*12345*1999999999~DTM*405*20260505~N1*PR*ACME HEALTH PLAN~N1*PE*UF HEALTH*XX*1234567890~CLP*CLAIM987*1*2500.00*1250.00*250.00*MC*PATCTL123*11*1~NM1*QC*1*DOE*JOHN****MI*MEMBER12345~SVC*HC:99284*1500.00*750.00**1~CAS*CO*45*750.00~SVC*HC:71046*1000.00*500.00**1~CAS*PR*1*250.00~SE*13*0001~GE*1*1~IEA*1*000000001~`;