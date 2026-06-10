// Forgiving client-side parsers for OB Fetal Audit ingestion.
// We accept whatever column names the EHR exports tend to use.

import type { CareEvent, CareEventKind, MAREvent, MedName, StripSample, VitalsReading } from './obFetalTypes';

const FHR_KEYS = ['fhr', 'fhr_bpm', 'fetal_heart_rate', 'heart_rate', 'baseline_fhr', 'fhr1'];
const UC_KEYS = ['uc', 'toco', 'contraction', 'uterine_activity', 'ua', 'iupc', 'mvu'];
const TIME_KEYS = ['t', 'time', 'timestamp', 'datetime', 'recorded_at', 'sample_time', 'sampletime'];

function splitCSV(text: string): string[][] {
  const out: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    // Very simple CSV — no quoted commas. EHR exports usually don't need them.
    out.push(raw.split(/,|\t|;/).map((c) => c.trim()));
  }
  return out;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function findIdx(headers: string[], candidates: string[]): number {
  const lower = headers.map(normHeader);
  for (const c of candidates) {
    const i = lower.indexOf(c);
    if (i >= 0) return i;
  }
  // partial match
  for (let i = 0; i < lower.length; i++) {
    if (candidates.some((c) => lower[i].includes(c))) return i;
  }
  return -1;
}

function toIso(value: string): string | null {
  if (!value) return null;
  const v = value.trim();
  // Already ISO-ish
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Try epoch seconds
  if (/^\d{9,13}$/.test(v)) {
    const n = Number(v);
    const ms = v.length <= 10 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  return null;
}

export function parseStripCSV(text: string): { samples: StripSample[]; warnings: string[] } {
  const warnings: string[] = [];
  const rows = splitCSV(text);
  if (rows.length < 2) return { samples: [], warnings: ['Empty strip file.'] };
  const headers = rows[0];
  const ti = findIdx(headers, TIME_KEYS);
  const fi = findIdx(headers, FHR_KEYS);
  const ui = findIdx(headers, UC_KEYS);
  if (ti < 0 || fi < 0) {
    return { samples: [], warnings: [`Couldn't find timestamp + FHR columns. Headers seen: ${headers.join(', ')}`] };
  }
  const samples: StripSample[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const iso = toIso(row[ti] ?? '');
    if (!iso) {
      if (warnings.length < 5) warnings.push(`Row ${r + 1}: unparseable timestamp "${row[ti]}"`);
      continue;
    }
    const fhr = Number(row[fi]);
    const uc = ui >= 0 ? Number(row[ui]) : NaN;
    samples.push({
      t: iso,
      fhr: isFinite(fhr) ? fhr : null,
      uc: isFinite(uc) ? uc : null,
    });
  }
  samples.sort((a, b) => a.t.localeCompare(b.t));
  return { samples, warnings };
}

const MED_VOCAB: { match: RegExp; med: MedName; label: string }[] = [
  { match: /pitocin|oxytocin/i, med: 'pitocin', label: 'Oxytocin (Pitocin)' },
  { match: /miso|cytotec/i, med: 'misoprostol', label: 'Misoprostol' },
  { match: /cervidil|dinoprostone/i, med: 'cervidil', label: 'Cervidil (dinoprostone)' },
  { match: /magnesium|mag\s*sulf|mgso4/i, med: 'magnesium', label: 'Magnesium sulfate' },
  { match: /terbutaline|brethine/i, med: 'terbutaline', label: 'Terbutaline' },
];

const ACTION_VOCAB: { match: RegExp; action: MAREvent['action'] }[] = [
  { match: /discontinue|d\/c|dc\b|stop/i, action: 'discontinue' },
  { match: /hold|paused?/i, action: 'hold' },
  { match: /resume/i, action: 'resume' },
  { match: /decrease|titrate down|reduce|down/i, action: 'decrease' },
  { match: /increase|titrate up|up\b/i, action: 'increase' },
  { match: /start|begin|initiate/i, action: 'start' },
  { match: /dose|admin|given|administer/i, action: 'dose' },
];

function classifyMed(text: string): { med: MedName; label: string } | null {
  for (const v of MED_VOCAB) if (v.match.test(text)) return { med: v.med, label: v.label };
  return null;
}

function classifyAction(text: string): MAREvent['action'] {
  for (const v of ACTION_VOCAB) if (v.match.test(text)) return v.action;
  return 'dose';
}

/** Parse a MAR text or CSV. Accepts two shapes:
 *   1. CSV with headers like time, medication, action, amount, unit
 *   2. Free-text, one event per line: "14:32  Pitocin increased to 8 mU/min"
 */
export function parseMAR(text: string, anchorDate?: string): { events: MAREvent[]; warnings: string[] } {
  const warnings: string[] = [];
  const events: MAREvent[] = [];
  if (!text.trim()) return { events, warnings };

  const rows = splitCSV(text);
  // Try CSV path first when first row looks like headers.
  const headers = rows[0]?.map(normHeader) || [];
  const looksLikeCSV = rows.length > 1 && headers.some((h) => TIME_KEYS.includes(h)) && headers.some((h) => /med|drug/.test(h));

  if (looksLikeCSV) {
    const ti = findIdx(rows[0], TIME_KEYS);
    const mi = findIdx(rows[0], ['medication', 'med', 'drug']);
    const ai = findIdx(rows[0], ['action', 'event', 'type']);
    const di = findIdx(rows[0], ['amount', 'dose', 'rate']);
    const ui = findIdx(rows[0], ['unit', 'units']);
    const ni = findIdx(rows[0], ['notes', 'note', 'comment']);
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const iso = toIso(row[ti] ?? '');
      if (!iso) { warnings.push(`MAR row ${r + 1}: bad timestamp`); continue; }
      const medText = row[mi] ?? '';
      const m = classifyMed(medText);
      if (!m) { warnings.push(`MAR row ${r + 1}: unknown medication "${medText}"`); continue; }
      const rawAction = (ai >= 0 ? row[ai] : '') || (ni >= 0 ? row[ni] : '') || medText;
      const amt = di >= 0 ? Number(row[di]) : NaN;
      events.push({
        t: iso,
        medication: m.med,
        medicationLabel: m.label,
        action: classifyAction(rawAction),
        amount: isFinite(amt) ? amt : undefined,
        unit: ui >= 0 ? row[ui] : undefined,
        evidence: row.join(' | '),
      });
    }
  } else {
    // Free-text path — one event per line.
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const m = classifyMed(line);
      if (!m) continue;
      const tMatch = line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
      let iso: string | null = null;
      if (tMatch) {
        const raw = tMatch[0];
        if (/\d{4}-\d{2}-\d{2}/.test(raw)) {
          iso = toIso(raw);
        } else if (anchorDate) {
          iso = toIso(`${anchorDate.slice(0, 10)} ${raw}`);
        } else {
          iso = toIso(`${new Date().toISOString().slice(0, 10)} ${raw}`);
        }
      }
      if (!iso) { warnings.push(`MAR line skipped (no timestamp): "${line.slice(0, 80)}"`); continue; }
      const amtMatch = line.match(/(\d+(?:\.\d+)?)\s*(mU\/min|mcg|mg|units?)/i);
      events.push({
        t: iso,
        medication: m.med,
        medicationLabel: m.label,
        action: classifyAction(line),
        amount: amtMatch ? Number(amtMatch[1]) : undefined,
        unit: amtMatch ? amtMatch[2] : undefined,
        evidence: line,
      });
    }
  }

  events.sort((a, b) => a.t.localeCompare(b.t));
  return { events, warnings };
}

export async function fileToText(file: File): Promise<string> {
  return await file.text();
}

export async function fileToDataURL(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result || ''));
    r.readAsDataURL(file);
  });
}

// ── Vitals parsing ───────────────────────────────────────────────────────

const SBP_KEYS = ['sbp', 'systolic', 'bp_systolic', 'sys'];
const DBP_KEYS = ['dbp', 'diastolic', 'bp_diastolic', 'dia'];
const HR_KEYS = ['hr', 'heart_rate', 'pulse', 'maternal_hr'];
const SPO2_KEYS = ['spo2', 'sao2', 'oxygen', 'sat'];
const TEMP_KEYS = ['temp', 'temperature', 'tempf'];

/** Parse vitals as either a CSV (time, sbp, dbp, hr, spo2) OR free-text lines like "21:14 BP 52/36, HR 118". */
export function parseVitals(text: string, anchorDate?: string): { readings: VitalsReading[]; warnings: string[] } {
  const warnings: string[] = [];
  const readings: VitalsReading[] = [];
  if (!text.trim()) return { readings, warnings };

  const rows = splitCSV(text);
  const headers = rows[0]?.map(normHeader) || [];
  const looksLikeCSV = rows.length > 1 && headers.some((h) => TIME_KEYS.includes(h)) && headers.some((h) => /bp|systolic|sbp|hr|spo2/.test(h));

  if (looksLikeCSV) {
    const ti = findIdx(rows[0], TIME_KEYS);
    const si = findIdx(rows[0], SBP_KEYS);
    const di = findIdx(rows[0], DBP_KEYS);
    const hi = findIdx(rows[0], HR_KEYS);
    const oi = findIdx(rows[0], SPO2_KEYS);
    const tempi = findIdx(rows[0], TEMP_KEYS);
    const bpi = findIdx(rows[0], ['bp', 'blood_pressure']);
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const iso = toIso(row[ti] ?? '');
      if (!iso) { warnings.push(`Vitals row ${r + 1}: bad timestamp`); continue; }
      let sbp: number | undefined, dbp: number | undefined;
      if (si >= 0) sbp = numOrU(row[si]);
      if (di >= 0) dbp = numOrU(row[di]);
      if ((!sbp || !dbp) && bpi >= 0) {
        const m = (row[bpi] || '').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
        if (m) { sbp = Number(m[1]); dbp = Number(m[2]); }
      }
      readings.push({
        t: iso,
        sbp, dbp,
        hr: hi >= 0 ? numOrU(row[hi]) : undefined,
        spo2: oi >= 0 ? numOrU(row[oi]) : undefined,
        tempF: tempi >= 0 ? numOrU(row[tempi]) : undefined,
        evidence: row.join(' | '),
      });
    }
  } else {
    for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      const tMatch = line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (!tMatch) continue;
      const raw = tMatch[0];
      const iso = /\d{4}-\d{2}-\d{2}/.test(raw)
        ? toIso(raw)
        : toIso(`${(anchorDate || new Date().toISOString()).slice(0, 10)} ${raw}`);
      if (!iso) continue;
      const bp = line.match(/(?:bp\s*)?(\d{2,3})\s*\/\s*(\d{2,3})/i);
      const hr = line.match(/hr\s*(\d{2,3})|pulse\s*(\d{2,3})/i);
      const spo2 = line.match(/(?:spo2|sat)\s*(\d{2,3})/i);
      const temp = line.match(/temp\s*([\d.]+)/i);
      readings.push({
        t: iso,
        sbp: bp ? Number(bp[1]) : undefined,
        dbp: bp ? Number(bp[2]) : undefined,
        hr: hr ? Number(hr[1] || hr[2]) : undefined,
        spo2: spo2 ? Number(spo2[1]) : undefined,
        tempF: temp ? Number(temp[1]) : undefined,
        evidence: line,
      });
    }
  }
  readings.sort((a, b) => a.t.localeCompare(b.t));
  return { readings, warnings };
}

function numOrU(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

// ── Care event parsing ───────────────────────────────────────────────────

const CARE_VOCAB: { match: RegExp; kind: CareEventKind }[] = [
  { match: /membrane\s*sweep|stripping of membranes|mucosal\s*sweep/i, kind: 'membrane_sweep' },
  { match: /\barom\b|artificial rupture|amniotomy/i, kind: 'arom' },
  { match: /cervidil\s*(placed|inserted)|dinoprostone\s*placed/i, kind: 'cervidil_placed' },
  { match: /cervidil\s*(removed|d\/c|discontinued)/i, kind: 'cervidil_removed' },
  { match: /cervical exam|sve|vaginal exam|dilated|effacement/i, kind: 'cervical_exam' },
  { match: /consent (signed|obtained|given)/i, kind: 'consent_obtained' },
  { match: /order (entered|placed|received)/i, kind: 'provider_order' },
  { match: /epidural (placed|dosed)/i, kind: 'epidural' },
  { match: /vital(s)? (checked|taken|obtained|recorded)|bp\s*\d{2,3}\s*\/\s*\d{2,3}/i, kind: 'vitals_check' },
  { match: /rn (at )?bedside|nurse at bedside|in room/i, kind: 'rn_at_bedside' },
  { match: /provider (notified|aware|called)|md notified|ob notified/i, kind: 'provider_notified' },
  { match: /iv (bolus|fluid)|lr bolus|ns bolus/i, kind: 'iv_bolus' },
  { match: /reposition|left lateral|right lateral|position changed/i, kind: 'position_change' },
  { match: /oxygen|o2 (started|applied|on)/i, kind: 'oxygen' },
  { match: /reassessed|reassessment/i, kind: 'reassessment' },
];

function classifyCare(line: string): CareEventKind {
  for (const v of CARE_VOCAB) if (v.match.test(line)) return v.kind;
  return 'other';
}

/** Parse care/nursing events from free-text. One line = one event. Any line with HH:MM is kept. */
export function parseCareEvents(text: string, anchorDate?: string): { events: CareEvent[]; warnings: string[] } {
  const warnings: string[] = [];
  const events: CareEvent[] = [];
  if (!text.trim()) return { events, warnings };

  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const tMatch = line.match(/(\d{4}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)|(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (!tMatch) { warnings.push(`Care line skipped (no timestamp): "${line.slice(0, 80)}"`); continue; }
    const raw = tMatch[0];
    const iso = /\d{4}-\d{2}-\d{2}/.test(raw)
      ? toIso(raw)
      : toIso(`${(anchorDate || new Date().toISOString()).slice(0, 10)} ${raw}`);
    if (!iso) continue;
    events.push({ t: iso, kind: classifyCare(line), description: line, evidence: line });
  }
  events.sort((a, b) => a.t.localeCompare(b.t));
  return { events, warnings };
}
