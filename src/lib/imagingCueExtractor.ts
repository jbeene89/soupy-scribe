// Extracts procedure cues from an image filename and finds the most likely
// matching case. Pure heuristics — no AI calls — so the dialog can suggest
// a link the moment a file is dropped.
//
// Cues we look for:
//   • Body region (knee, hip, shoulder, spine, foot, hand, wrist, elbow, ankle)
//   • Laterality (left/right/bilateral and L/R/BIL shorthand)
//   • CPT codes (5-digit numbers that land in the CPT range we care about)
//   • Patient ID (PT-####, MRN-####, or a long digit run)
//   • Physician name fragments (Dr_Smith, drsmith, smith-md, etc.)
//   • Procedure keywords (TKA, THA, ACL, RCR, fusion, arthroscopy, …)
//
// Matching strategy: score every candidate case and return the top match
// only if it clears a confidence floor — otherwise we return null and the
// dialog stays in manual mode.

import type { AuditCase } from './types';
import { BODY_REGIONS } from './imagingTypes';

export interface ImagingCues {
  bodyRegion?: string;
  laterality?: 'left' | 'right' | 'bilateral';
  cptCodes: string[];
  patientId?: string;
  physicianFragment?: string;
  procedureKeywords: string[];
  rawTokens: string[];
}

export interface CaseMatch {
  case: AuditCase;
  score: number;
  reasons: string[];
}

const PROCEDURE_KEYWORDS: Record<string, { region?: string; cpt?: string[] }> = {
  tka: { region: 'knee', cpt: ['27447'] },
  tkr: { region: 'knee', cpt: ['27447'] },
  tha: { region: 'hip', cpt: ['27130'] },
  thr: { region: 'hip', cpt: ['27130'] },
  acl: { region: 'knee', cpt: ['29888'] },
  meniscectomy: { region: 'knee', cpt: ['29880', '29881'] },
  arthroscopy: {},
  arthroplasty: {},
  rcr: { region: 'shoulder', cpt: ['29827'] },
  rotator: { region: 'shoulder' },
  fusion: { region: 'spine' },
  laminectomy: { region: 'spine' },
  discectomy: { region: 'spine' },
  bunionectomy: { region: 'foot' },
  carpal: { region: 'hand' },
  ankle: { region: 'ankle' },
  elbow: { region: 'elbow' },
  wrist: { region: 'wrist' },
};

const LATERALITY_TOKENS: Record<string, 'left' | 'right' | 'bilateral'> = {
  left: 'left', lt: 'left', l: 'left',
  right: 'right', rt: 'right', r: 'right',
  bilateral: 'bilateral', bil: 'bilateral', both: 'bilateral',
};

/** Pull every cue we can from a filename. Safe to call on any string. */
export function extractCuesFromFilename(filename: string): ImagingCues {
  const stem = filename.replace(/\.[^.]+$/, '').toLowerCase();
  const tokens = stem.split(/[^a-z0-9]+/).filter(Boolean);

  const cues: ImagingCues = { cptCodes: [], procedureKeywords: [], rawTokens: tokens };

  for (const t of tokens) {
    // Body region
    if (!cues.bodyRegion && (BODY_REGIONS as readonly string[]).includes(t)) {
      cues.bodyRegion = t;
    }
    // Laterality
    if (!cues.laterality && LATERALITY_TOKENS[t]) {
      cues.laterality = LATERALITY_TOKENS[t];
    }
    // CPT (5 digits, surgical/E&M ranges 10000–99999)
    if (/^\d{5}$/.test(t)) {
      cues.cptCodes.push(t);
    }
    // Patient ID — common formats
    if (!cues.patientId && /^(pt|mrn|pat|p)\d{3,}$/.test(t)) {
      cues.patientId = t.toUpperCase();
    }
    // Procedure keywords
    if (PROCEDURE_KEYWORDS[t]) {
      cues.procedureKeywords.push(t);
      const k = PROCEDURE_KEYWORDS[t];
      if (k.region && !cues.bodyRegion) cues.bodyRegion = k.region;
      if (k.cpt) for (const c of k.cpt) if (!cues.cptCodes.includes(c)) cues.cptCodes.push(c);
    }
  }

  // Patient ID with separator (PT-1234, MRN_5678)
  if (!cues.patientId) {
    const m = stem.match(/\b(pt|mrn|pat)[-_]?(\d{3,})\b/);
    if (m) cues.patientId = `${m[1].toUpperCase()}-${m[2]}`;
  }

  // Physician fragment: dr_smith, drsmith, smith-md, smithmd
  const drMatch = stem.match(/\bdr[-_]?([a-z]{3,})\b/) || stem.match(/\b([a-z]{3,})[-_]?md\b/);
  if (drMatch) cues.physicianFragment = drMatch[1];

  return cues;
}

/** Build a human-readable list of cues for the UI. */
export function describeCues(cues: ImagingCues): string[] {
  const out: string[] = [];
  if (cues.bodyRegion) out.push(`Body region: ${cues.bodyRegion}`);
  if (cues.laterality) out.push(`Side: ${cues.laterality}`);
  if (cues.cptCodes.length) out.push(`CPT: ${cues.cptCodes.join(', ')}`);
  if (cues.patientId) out.push(`Patient: ${cues.patientId}`);
  if (cues.physicianFragment) out.push(`Physician: ${cues.physicianFragment}`);
  if (cues.procedureKeywords.length) out.push(`Procedure: ${cues.procedureKeywords.join(', ')}`);
  return out;
}

/** Score a single case against the extracted cues. Higher = better match. */
function scoreCase(c: AuditCase, cues: ImagingCues): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (cues.patientId && c.patientId.toLowerCase() === cues.patientId.toLowerCase()) {
    score += 50; reasons.push(`Patient ID match (${c.patientId})`);
  }
  if (cues.physicianFragment && c.physicianName.toLowerCase().includes(cues.physicianFragment)) {
    score += 25; reasons.push(`Physician name match (${c.physicianName})`);
  }
  for (const cpt of cues.cptCodes) {
    if (c.cptCodes.includes(cpt)) {
      score += 20; reasons.push(`CPT ${cpt} match`);
    }
  }
  if (cues.bodyRegion && (c as any).bodyRegion?.toLowerCase() === cues.bodyRegion) {
    score += 10; reasons.push(`Body region match (${cues.bodyRegion})`);
  }
  // Case number appearing in filename
  if (c.caseNumber && cues.rawTokens.some((t) => c.caseNumber.toLowerCase().includes(t) && t.length >= 4)) {
    score += 30; reasons.push(`Case number reference (${c.caseNumber})`);
  }
  return { score, reasons };
}

/** Return up to `limit` best-scoring cases above the floor. */
export function findCaseMatches(
  cues: ImagingCues,
  cases: AuditCase[],
  opts: { floor?: number; limit?: number } = {}
): CaseMatch[] {
  const floor = opts.floor ?? 20;
  const limit = opts.limit ?? 3;
  return cases
    .map((c) => ({ case: c, ...scoreCase(c, cues) }))
    .filter((m) => m.score >= floor)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
