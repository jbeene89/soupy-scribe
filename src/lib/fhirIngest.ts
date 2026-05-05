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
}

const KNOWN_RESOURCE_TYPES = new Set([
  'Patient', 'Encounter', 'Condition', 'Procedure', 'Observation',
  'Claim', 'ExplanationOfBenefit', 'Coverage', 'MedicationRequest',
  'DocumentReference', 'DiagnosticReport', 'ServiceRequest', 'Practitioner',
  'Organization', 'AllergyIntolerance', 'Immunization',
]);

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
  }

  // Coverage / payer.
  for (const c of byType.Coverage || []) {
    sections.push(`\n----- Coverage -----`);
    const payer = c?.payor?.[0]?.display || c?.payor?.[0]?.reference;
    if (payer) sections.push(`Payer: ${payer}`);
    if (c?.subscriberId) sections.push(`Subscriber ID: ${c.subscriberId}`);
    if (c?.period?.start) sections.push(`Effective: ${c.period.start}${c.period.end ? ' → ' + c.period.end : ''}`);
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
        sections.push(`  Dx ${d?.sequence ?? ''}: ${code || '?'} — ${text || ''}`.trim());
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
      sections.push(`- ${display || code || 'observation'}: ${val ?? '?'}${dt ? ` (${dt})` : ''}`);
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
    }
  }

  return {
    text: sections.join('\n').trim(),
    resourceCounts,
    totalResources: resources.length,
    format,
    patientLabel,
    warnings,
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