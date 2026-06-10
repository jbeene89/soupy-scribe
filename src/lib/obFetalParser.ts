// Forgiving client-side parsers for OB Fetal Audit ingestion.
// We accept whatever column names the EHR exports tend to use.

import type { MAREvent, MedName, StripSample } from './obFetalTypes';

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
