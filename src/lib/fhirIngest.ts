/**
 * FHIR Bundle / NDJSON ingestion (Level 1 EHR support).
 *
 * Converts FHIR R4 payloads exported from EHRs (Epic, Cerner, Athena, etc.)
 * into a plain-text representation that the existing SOUPY pipelines
 * (claim parser, provider readiness, psych, crosswalk) can ingest as if it
 * were a pasted note + claim summary.
 *
 * Supported resources (best-effort, schema-tolerant):
 *   Patient, Encounter, Condition, Procedure, Observation,
 *   Claim, ExplanationOfBenefit, Coverage, MedicationRequest,
 *   DocumentReference (text payload), DiagnosticReport, ServiceRequest
 *
 * Intentionally lenient: unknown resources are summarized, never thrown on.
 */

export interface FhirIngestResult {
  /** Human/AI-readable normalized text — feed this into existing parsers. */
  text: string;
  /** Detected resource counts, surfaced in the UI for trust. */
  resourceCounts: Record<string, number>;
  /** Number of top-level resources processed. */
  totalResources: number;
  /** Source format detected. */
  format: 'fhir-bundle' | 'fhir-ndjson' | 'fhir-resource';
  /** Best-effort patient label for case linking. */
  patientLabel?: string;
  /** Warnings worth surfacing (truncated bundles, unknown structure, etc.). */
  warnings: string[];
  /** URLs of extensions we recognized and surfaced (for transparency / debugging). */
  extensionsRecognized: string[];
  /** URLs of extensions we saw but did not specifically map (still scanned for value). */
  extensionsUnmapped: string[];
}

const KNOWN_RESOURCE_TYPES = new Set([
  'Patient', 'Encounter', 'Condition', 'Procedure', 'Observation',
  'Claim', 'ExplanationOfBenefit', 'Coverage', 'MedicationRequest',
  'DocumentReference', 'DiagnosticReport', 'ServiceRequest', 'Practitioner',
  'Organization', 'AllergyIntolerance', 'Immunization',
]);

/**
 * Extension URL → friendly label.
 * Covers US Core (HL7), CARIN, Da Vinci PDex, plus common vendor extensions
 * (Epic, Cerner, Athena). Lookups are case-sensitive on the canonical URL.
 */
const EXTENSION_LABELS: Record<string, string> = {
  // ===== US Core (HL7) — Patient demographics & social =====
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race': 'US Core Race',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity': 'US Core Ethnicity',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex': 'US Core Birth Sex',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-genderIdentity': 'Gender Identity',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-sex': 'Sex (admin)',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-tribal-affiliation': 'Tribal Affiliation',
  'http://hl7.org/fhir/StructureDefinition/patient-mothersMaidenName': "Mother's Maiden Name",
  'http://hl7.org/fhir/StructureDefinition/patient-birthPlace': 'Birth Place',
  'http://hl7.org/fhir/StructureDefinition/patient-religion': 'Religion',
  'http://hl7.org/fhir/StructureDefinition/patient-nationality': 'Nationality',
  'http://hl7.org/fhir/StructureDefinition/iso21090-preferred': 'Preferred',

  // ===== US Core — Condition (POA, asserted date) =====
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-asserted-date': 'Asserted Date',
  'http://hl7.org/fhir/StructureDefinition/condition-assertedDate': 'Asserted Date',
  'http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-presentOnAdmission': 'Present on Admission',
  'http://hl7.org/fhir/StructureDefinition/condition-dueTo': 'Due To',

  // ===== Encounter — Da Vinci / US Core =====
  'http://hl7.org/fhir/StructureDefinition/encounter-modeOfArrival': 'Mode of Arrival',
  'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-levelOfServiceCode': 'Level of Service',

  // ===== Claim / EOB — CARIN / Da Vinci =====
  'http://hl7.org/fhir/us/davinci-pas/StructureDefinition/extension-authorizationNumber': 'Authorization Number',
  'http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-AdjudicationDiscriminator': 'Adjudication Discriminator',
  'http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-PayerProvider': 'Payer-Provider',
  'http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-DRG': 'DRG',

  // ===== Observation =====
  'http://hl7.org/fhir/StructureDefinition/observation-bodyPosition': 'Body Position',

  // ===== Epic vendor extensions (commonly seen in real bundles) =====
  'http://open.epic.com/FHIR/StructureDefinition/extension/legal-sex': 'Epic Legal Sex',
  'http://open.epic.com/FHIR/StructureDefinition/extension/sex-for-clinical-use': 'Sex for Clinical Use',
  'http://open.epic.com/FHIR/StructureDefinition/extension/payer-id': 'Epic Payer ID',
  'http://open.epic.com/FHIR/StructureDefinition/extension/calculated-pregnancy-status': 'Pregnancy Status',
  'http://open.epic.com/FHIR/StructureDefinition/extension/accommodation-code': 'Accommodation Code',
  'http://open.epic.com/FHIR/StructureDefinition/extension/admission-source': 'Admission Source (Epic)',

  // ===== Cerner vendor extensions =====
  'https://fhir-ehr.cerner.com/r4/StructureDefinition/encounter-readmission': 'Cerner Readmission',
  'https://fhir-ehr.cerner.com/r4/StructureDefinition/admission-source': 'Cerner Admission Source',
  'https://fhir-ehr.cerner.com/r4/StructureDefinition/discharge-disposition': 'Cerner Discharge Disposition',

  // ===== athenahealth vendor extensions =====
  'http://fhir.athena.io/StructureDefinition/ah-encounter-class': 'Athena Encounter Class',
  'http://fhir.athena.io/StructureDefinition/ah-claim-batch': 'Athena Claim Batch',
};

/** Vendor URL prefixes — used to detect vendor extensions even if not in the lookup. */
const VENDOR_PREFIXES: Array<{ prefix: string; vendor: string }> = [
  { prefix: 'http://open.epic.com/', vendor: 'Epic' },
  { prefix: 'https://open.epic.com/', vendor: 'Epic' },
  { prefix: 'http://hl7.org/fhir/us/core/', vendor: 'US Core' },
  { prefix: 'http://hl7.org/fhir/us/carin-bb/', vendor: 'CARIN BB' },
  { prefix: 'http://hl7.org/fhir/us/davinci', vendor: 'Da Vinci' },
  { prefix: 'https://fhir-ehr.cerner.com/', vendor: 'Cerner' },
  { prefix: 'http://fhir.cerner.com/', vendor: 'Cerner' },
  { prefix: 'http://fhir.athena.io/', vendor: 'athena' },
  { prefix: 'http://meditech.com/', vendor: 'MEDITECH' },
  { prefix: 'http://nextgen.com/', vendor: 'NextGen' },
  { prefix: 'http://eclinicalworks.com/', vendor: 'eCW' },
  { prefix: 'http://va.gov/', vendor: 'VA' },
];

function vendorOf(url: string): string {
  const v = VENDOR_PREFIXES.find((p) => url.startsWith(p.prefix));
  return v?.vendor ?? 'unknown';
}

/** Render any of the value[x] choice fields on an extension to a short string. */
function renderExtensionValue(ext: any): string | null {
  if (ext == null) return null;
  if (ext.valueString != null) return String(ext.valueString);
  if (ext.valueCode != null) return String(ext.valueCode);
  if (ext.valueBoolean != null) return String(ext.valueBoolean);
  if (ext.valueInteger != null) return String(ext.valueInteger);
  if (ext.valueDecimal != null) return String(ext.valueDecimal);
  if (ext.valueDate) return String(ext.valueDate);
  if (ext.valueDateTime) return String(ext.valueDateTime);
  if (ext.valueUri) return String(ext.valueUri);
  if (ext.valueQuantity) {
    const q = ext.valueQuantity;
    return `${q.value ?? '?'}${q.unit ? ' ' + q.unit : ''}`;
  }
  if (ext.valueCoding) {
    const c = ext.valueCoding;
    return `${c.code || ''}${c.display ? ' (' + c.display + ')' : ''}`.trim() || null;
  }
  if (ext.valueCodeableConcept) {
    const cc = ext.valueCodeableConcept;
    if (cc.text) return cc.text;
    const c = cc.coding?.[0];
    if (c) return `${c.code || ''}${c.display ? ' (' + c.display + ')' : ''}`.trim() || null;
  }
  if (ext.valueAddress) {
    const a = ext.valueAddress;
    return [a.city, a.state, a.country].filter(Boolean).join(', ') || null;
  }
  if (ext.valueIdentifier?.value) return String(ext.valueIdentifier.value);
  if (ext.valueReference?.display) return String(ext.valueReference.display);
  // Nested extensions (US Core race/ethnicity pattern: ombCategory + text children)
  if (Array.isArray(ext.extension) && ext.extension.length) {
    const parts = ext.extension.map((child: any) => {
      const childVal = renderExtensionValue(child);
      const key = (child.url || '').split('/').pop();
      return childVal ? `${key}=${childVal}` : null;
    }).filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  return null;
}

interface ExtensionScan {
  /** Already-formatted lines to append to a section. */
  lines: string[];
  /** Recognized extension URLs encountered. */
  recognized: string[];
  /** Unmapped extension URLs encountered (still scanned, value extracted when possible). */
  unmapped: string[];
}

/**
 * Walk a resource for top-level + nested extensions and convert them into
 * human-readable lines. Also scans `modifierExtension` (which clinically
 * MUST be considered if present, per FHIR spec) and per-element extensions
 * (e.g. `_birthDate.extension`). Recurses into common nested structures.
 */
function scanExtensions(resource: any): ExtensionScan {
  const out: ExtensionScan = { lines: [], recognized: [], unmapped: [] };
  if (!resource || typeof resource !== 'object') return out;

  const visit = (obj: any, path: string) => {
    if (obj == null || typeof obj !== 'object') return;

    // Per-element extensions: any sibling key starting with "_"
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_') && obj[key]?.extension) {
        for (const ext of obj[key].extension) record(ext, `${path}${key}`);
      }
    }

    // Top-level + modifier extensions on this object
    for (const ext of obj.extension || []) record(ext, path);
    for (const ext of obj.modifierExtension || []) {
      record(ext, `${path}!modifier`); // marked so we know it's a MUST-consider
    }

    // Recurse into common nested clinical containers
    const nestedKeys = [
      'name', 'identifier', 'address', 'telecom', 'contact',
      'communication', 'item', 'diagnosis', 'procedure', 'careTeam',
      'supportingInfo', 'related', 'payment', 'total', 'adjudication',
      'detail', 'subDetail', 'participant', 'hospitalization', 'location',
      'reasonCode', 'category', 'code', 'value', 'component', 'note',
      'content', 'context', 'event', 'period', 'class', 'serviceProvider',
      'patient', 'subject', 'insurer', 'provider', 'payor',
    ];
    for (const k of nestedKeys) {
      const v = obj[k];
      if (Array.isArray(v)) v.forEach((it, i) => visit(it, `${path}${k}[${i}].`));
      else if (v && typeof v === 'object') visit(v, `${path}${k}.`);
    }
  };

  const record = (ext: any, path: string) => {
    const url = ext?.url;
    if (!url) return;
    const isModifier = path.endsWith('!modifier');
    const label = EXTENSION_LABELS[url];
    const val = renderExtensionValue(ext);
    if (label) {
      out.recognized.push(url);
      out.lines.push(`  ${isModifier ? '⚠ MODIFIER · ' : ''}${label}: ${val ?? '(structured)'}`);
    } else {
      out.unmapped.push(url);
      // Still surface a useful line if we can render any value.
      const vendor = vendorOf(url);
      const tail = url.split('/').filter(Boolean).pop() || url;
      if (val) {
        out.lines.push(`  ${isModifier ? '⚠ MODIFIER · ' : ''}${vendor} · ${tail}: ${val}`);
      }
    }
  };

  visit(resource, '');
  return out;
}

/** Append extension lines under a header if any were found. */
function appendExtensions(sections: string[], scan: ExtensionScan, header = '  Extensions:') {
  if (!scan.lines.length) return;
  sections.push(header);
  for (const ln of scan.lines) sections.push(ln);
}

/** Quick sniff — is this string likely a FHIR payload? */
export function looksLikeFhir(text: string): boolean {
  if (!text || text.length < 20) return false;
  const head = text.slice(0, 4000);
  // Bundle
  if (/"resourceType"\s*:\s*"Bundle"/.test(head)) return true;
  // NDJSON — first line is a FHIR resource
  const firstLine = head.split(/\r?\n/, 1)[0];
  if (/^\s*\{[^}]*"resourceType"\s*:\s*"[A-Z][A-Za-z]+"/.test(firstLine)) return true;
  // Single resource
  if (/"resourceType"\s*:\s*"(Patient|Encounter|Claim|ExplanationOfBenefit|Condition|Procedure|DocumentReference)"/.test(head)) return true;
  return false;
}

/** Parse a FHIR payload (Bundle, NDJSON, or single resource). */
export function ingestFhir(raw: string): FhirIngestResult {
  const trimmed = raw.trim();
  const warnings: string[] = [];
  const extensionsRecognized = new Set<string>();
  const extensionsUnmapped = new Set<string>();
  let resources: any[] = [];
  let format: FhirIngestResult['format'] = 'fhir-resource';

  // Try NDJSON first (one JSON object per line, most lines parse).
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const candidates: any[] = [];
    let parseFailures = 0;
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj && typeof obj === 'object' && obj.resourceType) candidates.push(obj);
      } catch { parseFailures++; }
    }
    if (candidates.length >= Math.max(2, Math.floor(lines.length * 0.5))) {
      resources = candidates;
      format = 'fhir-ndjson';
      if (parseFailures > 0) warnings.push(`${parseFailures} NDJSON line(s) could not be parsed and were skipped.`);
    }
  }

  // Fall back to single JSON parse.
  if (resources.length === 0) {
    let parsed: any;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      throw new Error('FHIR payload is not valid JSON.');
    }
    if (parsed?.resourceType === 'Bundle' && Array.isArray(parsed.entry)) {
      resources = parsed.entry.map((e: any) => e?.resource).filter(Boolean);
      format = 'fhir-bundle';
    } else if (parsed?.resourceType) {
      resources = [parsed];
      format = 'fhir-resource';
    } else {
      throw new Error('JSON does not look like a FHIR Bundle or resource (no resourceType found).');
    }
  }

  // Count by resource type.
  const resourceCounts: Record<string, number> = {};
  for (const r of resources) {
    const t = r?.resourceType || 'Unknown';
    resourceCounts[t] = (resourceCounts[t] || 0) + 1;
    if (!KNOWN_RESOURCE_TYPES.has(t) && t !== 'Unknown') {
      // Track but don't warn for every one
    }
  }

  // Build a per-resource grouped index.
  const byType: Record<string, any[]> = {};
  for (const r of resources) {
    const t = r?.resourceType || 'Unknown';
    (byType[t] ||= []).push(r);
  }

  const sections: string[] = [];
  sections.push(`===== FHIR EHR EXPORT =====`);
  sections.push(`Format: ${format} · Resources: ${resources.length}`);
  sections.push(`Counts: ${Object.entries(resourceCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // Patient — pick the first one for label.
  let patientLabel: string | undefined;
  for (const p of byType.Patient || []) {
    const name = renderHumanName(p?.name);
    const id = p?.id || p?.identifier?.[0]?.value;
    const dob = p?.birthDate;
    const sex = p?.gender;
    if (name && !patientLabel) patientLabel = name;
    sections.push(`\n----- Patient -----`);
    if (name) sections.push(`Name: ${name}`);
    if (id) sections.push(`Patient ID: ${id}`);
    if (dob) sections.push(`DOB: ${dob}`);
    if (sex) sections.push(`Sex: ${sex}`);
    const scan = scanExtensions(p);
    appendExtensions(sections, scan);
    scan.recognized.forEach((u) => extensionsRecognized.add(u));
    scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
  }

  // Coverage / payer.
  for (const c of byType.Coverage || []) {
    sections.push(`\n----- Coverage -----`);
    const payer = c?.payor?.[0]?.display || c?.payor?.[0]?.reference;
    if (payer) sections.push(`Payer: ${payer}`);
    if (c?.subscriberId) sections.push(`Subscriber ID: ${c.subscriberId}`);
    if (c?.period?.start) sections.push(`Effective: ${c.period.start}${c.period.end ? ' → ' + c.period.end : ''}`);
    const scan = scanExtensions(c);
    appendExtensions(sections, scan);
    scan.recognized.forEach((u) => extensionsRecognized.add(u));
    scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
  }

  // Encounter.
  for (const e of byType.Encounter || []) {
    sections.push(`\n----- Encounter -----`);
    const dos = e?.period?.start;
    if (dos) sections.push(`Date of Service: ${dos}${e?.period?.end ? ' → ' + e.period.end : ''}`);
    const cls = e?.class?.code || e?.class?.display;
    if (cls) sections.push(`Class: ${cls}`);
    const type = e?.type?.[0]?.text || e?.type?.[0]?.coding?.[0]?.display;
    if (type) sections.push(`Type: ${type}`);
    const reason = e?.reasonCode?.map((r: any) => r?.text || r?.coding?.[0]?.display).filter(Boolean).join('; ');
    if (reason) sections.push(`Reason: ${reason}`);
    const provider = e?.participant?.[0]?.individual?.display;
    if (provider) sections.push(`Provider: ${provider}`);
    const facility = e?.serviceProvider?.display;
    if (facility) sections.push(`Facility: ${facility}`);
    // Hospitalization sub-element carries admit source + discharge disposition,
    // both critical for inpatient audits / DRG context.
    if (e?.hospitalization) {
      const h = e.hospitalization;
      const admit = h.admitSource?.text || h.admitSource?.coding?.[0]?.display || h.admitSource?.coding?.[0]?.code;
      const disp = h.dischargeDisposition?.text || h.dischargeDisposition?.coding?.[0]?.display || h.dischargeDisposition?.coding?.[0]?.code;
      const reAdm = h.reAdmission?.text || h.reAdmission?.coding?.[0]?.display;
      if (admit) sections.push(`Admit Source: ${admit}`);
      if (disp) sections.push(`Discharge Disposition: ${disp}`);
      if (reAdm) sections.push(`Re-admission: ${reAdm}`);
    }
    const scan = scanExtensions(e);
    appendExtensions(sections, scan);
    scan.recognized.forEach((u) => extensionsRecognized.add(u));
    scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
  }

  // Conditions / diagnoses.
  if ((byType.Condition || []).length) {
    sections.push(`\n----- Conditions / Diagnoses -----`);
    for (const c of byType.Condition) {
      const code = c?.code?.coding?.[0]?.code;
      const display = c?.code?.text || c?.code?.coding?.[0]?.display;
      const onset = c?.onsetDateTime || c?.recordedDate;
      const status = c?.clinicalStatus?.coding?.[0]?.code;
      sections.push(`- ${code || '?'} — ${display || 'unspecified'}${status ? ` [${status}]` : ''}${onset ? ` (onset ${onset})` : ''}`);
      const scan = scanExtensions(c);
      appendExtensions(sections, scan);
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // Procedures.
  if ((byType.Procedure || []).length) {
    sections.push(`\n----- Procedures -----`);
    for (const p of byType.Procedure) {
      const code = p?.code?.coding?.[0]?.code;
      const display = p?.code?.text || p?.code?.coding?.[0]?.display;
      const dt = p?.performedDateTime || p?.performedPeriod?.start;
      sections.push(`- ${code || '?'} — ${display || 'unspecified'}${dt ? ` (${dt})` : ''}`);
      const scan = scanExtensions(p);
      appendExtensions(sections, scan);
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // Claim resources — the meat for payer/provider audits.
  if ((byType.Claim || []).length) {
    sections.push(`\n----- Claim(s) -----`);
    for (const cl of byType.Claim) {
      sections.push(`Claim ID: ${cl?.id || '?'}  Status: ${cl?.status || '?'}  Use: ${cl?.use || '?'}`);
      const billable = cl?.billablePeriod?.start;
      if (billable) sections.push(`Billable Period: ${billable}${cl?.billablePeriod?.end ? ' → ' + cl.billablePeriod.end : ''}`);
      const insurer = cl?.insurer?.display;
      if (insurer) sections.push(`Insurer: ${insurer}`);
      const provider = cl?.provider?.display;
      if (provider) sections.push(`Billing Provider: ${provider}`);
      const total = cl?.total?.value;
      if (total != null) sections.push(`Total: ${cl?.total?.currency || ''} ${total}`);
      // Diagnoses on the claim.
      for (const d of cl?.diagnosis || []) {
        const code = d?.diagnosisCodeableConcept?.coding?.[0]?.code;
        const text = d?.diagnosisCodeableConcept?.text || d?.diagnosisCodeableConcept?.coding?.[0]?.display;
        // POA indicator (US Core / X12 837I crosswalk: "onAdmission" coding)
        const poa = (d?.onAdmission?.coding?.[0]?.code) || (d?.onAdmission?.text);
        const dxType = d?.type?.[0]?.coding?.[0]?.code || d?.type?.[0]?.text;
        sections.push(`  Dx ${d?.sequence ?? ''}: ${code || '?'} — ${text || ''}${dxType ? ` [type=${dxType}]` : ''}${poa ? ` [POA=${poa}]` : ''}`.trim());
      }
      // Line items.
      for (const item of cl?.item || []) {
        const code = item?.productOrService?.coding?.[0]?.code;
        const display = item?.productOrService?.text || item?.productOrService?.coding?.[0]?.display;
        const mods = (item?.modifier || []).map((m: any) => m?.coding?.[0]?.code).filter(Boolean).join(',');
        const units = item?.quantity?.value;
        const charge = item?.unitPrice?.value;
        const dxPtrs = (item?.diagnosisSequence || []).join(',');
        sections.push(`  Line ${item?.sequence ?? ''}: ${code || '?'}${mods ? `-${mods}` : ''} units=${units ?? '?'} charge=${charge ?? '?'} dxPtr=${dxPtrs || '?'} ${display || ''}`.trim());
      }
      const scan = scanExtensions(cl);
      appendExtensions(sections, scan);
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // ExplanationOfBenefit — denials live here.
  if ((byType.ExplanationOfBenefit || []).length) {
    sections.push(`\n----- ExplanationOfBenefit -----`);
    for (const eob of byType.ExplanationOfBenefit) {
      sections.push(`EOB ID: ${eob?.id || '?'}  Outcome: ${eob?.outcome || '?'}  Status: ${eob?.status || '?'}`);
      if (eob?.disposition) sections.push(`Disposition: ${eob.disposition}`);
      // Adjudication category totals.
      for (const t of eob?.total || []) {
        const cat = t?.category?.coding?.[0]?.code || t?.category?.text;
        sections.push(`  Total ${cat}: ${t?.amount?.currency || ''} ${t?.amount?.value ?? '?'}`);
      }
      // Item-level adjudication + reason codes.
      for (const item of eob?.item || []) {
        const code = item?.productOrService?.coding?.[0]?.code;
        sections.push(`  Line ${item?.sequence ?? ''}: ${code || '?'}`);
        for (const a of item?.adjudication || []) {
          const cat = a?.category?.coding?.[0]?.code || a?.category?.text;
          const reason = a?.reason?.coding?.[0]?.code;
          const amt = a?.amount?.value;
          if (cat || reason || amt != null) {
            sections.push(`    ${cat || ''}${reason ? ` reason=${reason}` : ''}${amt != null ? ` amount=${amt}` : ''}`.trim());
          }
        }
      }
      const scan = scanExtensions(eob);
      appendExtensions(sections, scan);
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // Observations — labs, vitals, screening tools (PHQ-9, GAD-7).
  if ((byType.Observation || []).length) {
    sections.push(`\n----- Observations -----`);
    for (const o of byType.Observation.slice(0, 200)) {
      const code = o?.code?.coding?.[0]?.code;
      const display = o?.code?.text || o?.code?.coding?.[0]?.display;
      const val = o?.valueQuantity ? `${o.valueQuantity.value}${o.valueQuantity.unit ? ' ' + o.valueQuantity.unit : ''}`
                : o?.valueString ?? o?.valueCodeableConcept?.text ?? o?.valueInteger;
      const dt = o?.effectiveDateTime || o?.issued;
      const cat = o?.category?.[0]?.coding?.[0]?.code;
      const interp = o?.interpretation?.[0]?.coding?.[0]?.code || o?.interpretation?.[0]?.text;
      sections.push(`- ${display || code || 'observation'}: ${val ?? '?'}${dt ? ` (${dt})` : ''}${cat ? ` [cat=${cat}]` : ''}${interp ? ` [interp=${interp}]` : ''}`);
      // Component values (e.g. BP systolic + diastolic, PHQ-9 sub-items).
      for (const comp of o?.component || []) {
        const cd = comp?.code?.text || comp?.code?.coding?.[0]?.display || comp?.code?.coding?.[0]?.code;
        const cv = comp?.valueQuantity ? `${comp.valueQuantity.value}${comp.valueQuantity.unit ? ' ' + comp.valueQuantity.unit : ''}`
                 : comp?.valueString ?? comp?.valueCodeableConcept?.text;
        if (cd || cv != null) sections.push(`    · ${cd || 'component'}: ${cv ?? '?'}`);
      }
      const scan = scanExtensions(o);
      if (scan.lines.length) appendExtensions(sections, scan, '    Extensions:');
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
    if (byType.Observation.length > 200) warnings.push(`Truncated ${byType.Observation.length - 200} observations.`);
  }

  // Medications.
  if ((byType.MedicationRequest || []).length) {
    sections.push(`\n----- Medications -----`);
    for (const m of byType.MedicationRequest) {
      const med = m?.medicationCodeableConcept?.text || m?.medicationCodeableConcept?.coding?.[0]?.display
                || m?.medicationReference?.display;
      const dose = m?.dosageInstruction?.[0]?.text;
      sections.push(`- ${med || 'medication'}${dose ? ` — ${dose}` : ''}`);
      const scan = scanExtensions(m);
      if (scan.lines.length) appendExtensions(sections, scan, '    Extensions:');
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // DocumentReference — embedded clinical narrative (op notes, progress notes, etc.).
  if ((byType.DocumentReference || []).length) {
    sections.push(`\n----- Clinical Documents -----`);
    for (const d of byType.DocumentReference) {
      const title = d?.description || d?.type?.text || d?.type?.coding?.[0]?.display || 'Document';
      sections.push(`\n--- ${title} ---`);
      for (const c of d?.content || []) {
        const att = c?.attachment;
        if (att?.contentType?.startsWith('text/') && att?.data) {
          try {
            const decoded = atobSafe(att.data);
            sections.push(decoded);
          } catch {
            warnings.push(`Could not decode base64 attachment in DocumentReference ${d?.id || ''}.`);
          }
        } else if (att?.url) {
          sections.push(`[external attachment: ${att.url}]`);
        }
      }
    }
  }

  // DiagnosticReport — narrative often present.
  if ((byType.DiagnosticReport || []).length) {
    sections.push(`\n----- Diagnostic Reports -----`);
    for (const r of byType.DiagnosticReport) {
      const t = r?.code?.text || r?.code?.coding?.[0]?.display;
      sections.push(`- ${t || 'report'} (${r?.status || '?'}) ${r?.effectiveDateTime || ''}`);
      if (r?.conclusion) sections.push(`  Conclusion: ${r.conclusion}`);
      const scan = scanExtensions(r);
      appendExtensions(sections, scan);
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // ===== Sweep any remaining resource types for extensions so nothing is silently lost. =====
  for (const [type, list] of Object.entries(byType)) {
    if (['Patient','Coverage','Encounter','Condition','Procedure','Claim','ExplanationOfBenefit','Observation','MedicationRequest','DocumentReference','DiagnosticReport'].includes(type)) continue;
    for (const r of list) {
      const scan = scanExtensions(r);
      if (!scan.lines.length) continue;
      sections.push(`\n----- ${type} (extensions only) -----`);
      for (const ln of scan.lines) sections.push(ln);
      scan.recognized.forEach((u) => extensionsRecognized.add(u));
      scan.unmapped.forEach((u) => extensionsUnmapped.add(u));
    }
  }

  // Surface a vendor-extension footer for transparency in the parsed output.
  if (extensionsRecognized.size + extensionsUnmapped.size > 0) {
    sections.push(`\n----- Extensions Summary -----`);
    if (extensionsRecognized.size) sections.push(`Recognized (${extensionsRecognized.size}): ${[...extensionsRecognized].slice(0, 25).join(', ')}${extensionsRecognized.size > 25 ? ' …' : ''}`);
    if (extensionsUnmapped.size) {
      const vendors = new Map<string, number>();
      for (const u of extensionsUnmapped) vendors.set(vendorOf(u), (vendors.get(vendorOf(u)) || 0) + 1);
      sections.push(`Unmapped (${extensionsUnmapped.size}) by vendor: ${[...vendors.entries()].map(([v, n]) => `${v}=${n}`).join(', ')}`);
    }
  }

  return {
    text: sections.join('\n').trim(),
    resourceCounts,
    totalResources: resources.length,
    format,
    patientLabel,
    warnings,
    extensionsRecognized: [...extensionsRecognized],
    extensionsUnmapped: [...extensionsUnmapped],
  };
}

function renderHumanName(name: any[] | undefined): string | undefined {
  if (!Array.isArray(name) || name.length === 0) return undefined;
  const n = name.find((x) => x?.use === 'official') || name[0];
  if (n?.text) return n.text;
  const given = Array.isArray(n?.given) ? n.given.join(' ') : '';
  const family = n?.family || '';
  const out = [given, family].filter(Boolean).join(' ').trim();
  return out || undefined;
}

function atobSafe(b64: string): string {
  // Browser atob handles base64 → binary string; decode UTF-8 safely.
  const bin = atob(b64.replace(/\s+/g, ''));
  try {
    // Try UTF-8 decode
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return bin;
  }
}