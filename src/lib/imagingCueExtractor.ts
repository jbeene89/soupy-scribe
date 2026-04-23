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
import exifr from 'exifr';

export interface ImagingCues {
  bodyRegion?: string;
  laterality?: 'left' | 'right' | 'bilateral';
  cptCodes: string[];
  patientId?: string;
  physicianFragment?: string;
  procedureKeywords: string[];
  rawTokens: string[];
  /** Where each cue came from — useful for the UI badge ("from EXIF" vs "from filename"). */
  sources?: Partial<Record<keyof Omit<ImagingCues, 'rawTokens' | 'sources'>, 'filename' | 'exif' | 'dicom'>>;
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

/**
 * Merge two cue sets. `primary` wins on conflicts (use it for the more
 * trustworthy source, e.g. DICOM tags over filename guesses).
 */
export function mergeCues(primary: ImagingCues, secondary: ImagingCues): ImagingCues {
  const merged: ImagingCues = {
    bodyRegion: primary.bodyRegion ?? secondary.bodyRegion,
    laterality: primary.laterality ?? secondary.laterality,
    patientId: primary.patientId ?? secondary.patientId,
    physicianFragment: primary.physicianFragment ?? secondary.physicianFragment,
    cptCodes: Array.from(new Set([...primary.cptCodes, ...secondary.cptCodes])),
    procedureKeywords: Array.from(new Set([...primary.procedureKeywords, ...secondary.procedureKeywords])),
    rawTokens: [...primary.rawTokens, ...secondary.rawTokens],
    sources: { ...secondary.sources, ...primary.sources },
  };
  return merged;
}

/**
 * Try to pull cues from image EXIF / IPTC / XMP metadata. Works on JPEG/TIFF
 * (and many DICOMs that carry an embedded JPEG). We look at common free-text
 * fields (ImageDescription, UserComment, Artist, Software, Caption, Keywords)
 * for the same patterns we look for in filenames.
 */
export async function extractCuesFromExif(file: File): Promise<ImagingCues> {
  const empty: ImagingCues = { cptCodes: [], procedureKeywords: [], rawTokens: [], sources: {} };
  try {
    const meta = await exifr.parse(file, {
      tiff: true, exif: true, iptc: true, xmp: true, icc: false, jfif: false,
      mergeOutput: true, sanitize: true, translateValues: true,
    });
    if (!meta) return empty;
    const fields = [
      meta.ImageDescription, meta.UserComment, meta.Artist, meta.Author,
      meta.Caption, meta['Caption-Abstract'], meta.Headline, meta.Subject,
      meta.Keywords, meta.title, meta.description, meta.Software, meta.Make,
      meta.Model, meta.OwnerName, meta.HostComputer,
    ];
    const blob = fields
      .flat()
      .filter((v) => typeof v === 'string' && v.length)
      .join(' ');
    if (!blob) return empty;
    const cues = extractCuesFromFilename(blob);
    return tagSources(cues, 'exif');
  } catch {
    return empty;
  }
}

/**
 * Best-effort DICOM tag reader. We don't pull in a full DICOM library —
 * we scan the first ~2MB of the file for the well-known ASCII tag values
 * we care about: PatientID, PatientName, BodyPartExamined, Laterality,
 * StudyDescription, SeriesDescription, PerformingPhysicianName.
 * If the file isn't a DICOM the scan returns nothing — safe to call on any image.
 */
export async function extractCuesFromDicom(file: File): Promise<ImagingCues> {
  const empty: ImagingCues = { cptCodes: [], procedureKeywords: [], rawTokens: [], sources: {} };
  try {
    const head = await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(head);
    // DICOM preamble starts at offset 128 with magic 'DICM'.
    const isDicom =
      bytes.length > 132 &&
      bytes[128] === 0x44 && bytes[129] === 0x49 && bytes[130] === 0x43 && bytes[131] === 0x4d;
    if (!isDicom && !file.name.toLowerCase().match(/\.(dcm|dicom)$/)) return empty;

    const text = new TextDecoder('latin1').decode(bytes);
    const cues: ImagingCues = { cptCodes: [], procedureKeywords: [], rawTokens: [], sources: {} };

    const grab = (tag: string): string | undefined => {
      // DICOM stores tag as 4 little-endian bytes; we look for the textual VR
      // marker following the tag (e.g., "PN", "LO", "CS"). Easiest portable
      // approach: find the binary tag pattern then read the next ASCII run.
      const [g, e] = tag.split(',').map((h) => parseInt(h, 16));
      const needle = new Uint8Array([g & 0xff, (g >> 8) & 0xff, e & 0xff, (e >> 8) & 0xff]);
      for (let i = 132; i < bytes.length - 12; i++) {
        if (
          bytes[i] === needle[0] && bytes[i + 1] === needle[1] &&
          bytes[i + 2] === needle[2] && bytes[i + 3] === needle[3]
        ) {
          // Skip VR (2 bytes) + length (2 bytes for short VRs)
          const valStart = i + 8;
          // Read up to 128 bytes of ASCII printable
          let end = valStart;
          while (end < Math.min(valStart + 128, bytes.length) && bytes[end] >= 0x20 && bytes[end] < 0x7f) end++;
          const v = text.slice(valStart, end).trim();
          if (v) return v;
        }
      }
      return undefined;
    };

    const patientId = grab('0010,0020');
    const patientName = grab('0010,0010');
    const bodyPart = grab('0018,0015');
    const laterality = grab('0020,0060') || grab('0020,0062');
    const studyDesc = grab('0008,1030');
    const seriesDesc = grab('0008,103e');
    const physician = grab('0008,1050') || grab('0008,0090'); // PerformingPhysicianName / ReferringPhysicianName

    if (patientId) { cues.patientId = patientId.replace(/\s+/g, ''); cues.sources!.patientId = 'dicom'; }
    if (bodyPart) {
      const bp = bodyPart.toLowerCase();
      const region = (BODY_REGIONS as readonly string[]).find((r) => bp.includes(r));
      if (region) { cues.bodyRegion = region; cues.sources!.bodyRegion = 'dicom'; }
    }
    if (laterality) {
      const l = laterality.toLowerCase();
      if (l.startsWith('l')) cues.laterality = 'left';
      else if (l.startsWith('r')) cues.laterality = 'right';
      else if (l.startsWith('b')) cues.laterality = 'bilateral';
      if (cues.laterality) cues.sources!.laterality = 'dicom';
    }
    if (physician) {
      const frag = physician.toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/).find((w) => w.length >= 3);
      if (frag) { cues.physicianFragment = frag; cues.sources!.physicianFragment = 'dicom'; }
    }
    // Mine free-text descriptions for CPT codes and keywords
    const desc = [studyDesc, seriesDesc, patientName].filter(Boolean).join(' ');
    if (desc) {
      const sub = extractCuesFromFilename(desc);
      if (!cues.bodyRegion && sub.bodyRegion) { cues.bodyRegion = sub.bodyRegion; cues.sources!.bodyRegion = 'dicom'; }
      if (!cues.laterality && sub.laterality) { cues.laterality = sub.laterality; cues.sources!.laterality = 'dicom'; }
      for (const c of sub.cptCodes) if (!cues.cptCodes.includes(c)) cues.cptCodes.push(c);
      for (const k of sub.procedureKeywords) if (!cues.procedureKeywords.includes(k)) cues.procedureKeywords.push(k);
      cues.rawTokens.push(...sub.rawTokens);
    }
    if (cues.cptCodes.length) cues.sources!.cptCodes = 'dicom';
    if (cues.procedureKeywords.length) cues.sources!.procedureKeywords = 'dicom';
    return cues;
  } catch {
    return empty;
  }
}

function tagSources(cues: ImagingCues, src: 'filename' | 'exif' | 'dicom'): ImagingCues {
  const sources: ImagingCues['sources'] = { ...cues.sources };
  if (cues.bodyRegion) sources.bodyRegion = src;
  if (cues.laterality) sources.laterality = src;
  if (cues.patientId) sources.patientId = src;
  if (cues.physicianFragment) sources.physicianFragment = src;
  if (cues.cptCodes.length) sources.cptCodes = src;
  if (cues.procedureKeywords.length) sources.procedureKeywords = src;
  return { ...cues, sources };
}

/**
 * One-shot extractor: filename + EXIF + DICOM, merged with DICOM > EXIF > filename.
 */
export async function extractAllCues(file: File): Promise<ImagingCues> {
  const fname = tagSources(extractCuesFromFilename(file.name), 'filename');
  const [exif, dicom] = await Promise.all([
    extractCuesFromExif(file),
    extractCuesFromDicom(file),
  ]);
  // DICOM is most trustworthy, then EXIF, then filename
  return mergeCues(dicom, mergeCues(exif, fname));
}

/** Build a human-readable list of cues for the UI. */
export function describeCues(cues: ImagingCues): string[] {
  const out: string[] = [];
  const tag = (k: keyof NonNullable<ImagingCues['sources']>) => {
    const s = cues.sources?.[k];
    return s && s !== 'filename' ? ` (${s})` : '';
  };
  if (cues.bodyRegion) out.push(`Body region: ${cues.bodyRegion}${tag('bodyRegion')}`);
  if (cues.laterality) out.push(`Side: ${cues.laterality}${tag('laterality')}`);
  if (cues.cptCodes.length) out.push(`CPT: ${cues.cptCodes.join(', ')}${tag('cptCodes')}`);
  if (cues.patientId) out.push(`Patient: ${cues.patientId}${tag('patientId')}`);
  if (cues.physicianFragment) out.push(`Physician: ${cues.physicianFragment}${tag('physicianFragment')}`);
  if (cues.procedureKeywords.length) out.push(`Procedure: ${cues.procedureKeywords.join(', ')}${tag('procedureKeywords')}`);
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
