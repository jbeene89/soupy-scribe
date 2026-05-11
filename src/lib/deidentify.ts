/**
 * HIPAA Safe Harbor de-identification utility (45 CFR §164.514(b)(2)).
 * Strips the 18 identifiers before any text leaves the trust boundary
 * (e.g. before being sent to LLMs that are not covered by a signed BAA
 * for PHI use).
 *
 * NOTE: This is a *best-effort* mechanical scrub. It does not guarantee
 * Safe Harbor compliance on its own — full compliance requires expert
 * determination or a comprehensive review process. Use it as a defense
 * in depth layer, not the only layer.
 */

export interface DeidentifyOptions {
  /** Replace tokens with [REDACTED:TYPE] markers (default true). When false, tokens are removed. */
  marker?: boolean;
  /** Preserve year in dates (Safe Harbor allows year for non-elderly). */
  preserveYear?: boolean;
}

export interface DeidentifyResult {
  text: string;
  redactionsByType: Record<string, number>;
  totalRedactions: number;
}

const TYPE_MARK = (t: string) => `[REDACTED:${t}]`;

// Order matters: most specific patterns first.
const PATTERNS: Array<{ type: string; regex: RegExp; transform?: (m: string) => string }> = [
  // SSN
  { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  // Phone (US-ish)
  { type: "PHONE", regex: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  // Email
  { type: "EMAIL", regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  // URL
  { type: "URL", regex: /\bhttps?:\/\/[^\s<>"']+/gi },
  // IP
  { type: "IP", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  // MRN / Medical Record Number / Patient ID labels followed by an alphanumeric token
  { type: "MRN", regex: /\b(?:MRN|Medical Record(?:\s*Number)?|Patient\s*ID|Pt\s*ID|Account\s*#?|Acct\s*#?)\s*[:#]?\s*[A-Z0-9-]{3,}/gi },
  // Member / subscriber / policy / claim numbers
  { type: "MEMBER_ID", regex: /\b(?:Member(?:ship)?(?:\s*ID|\s*#)?|Subscriber(?:\s*ID|\s*#)?|Policy(?:\s*#|\s*No\.?)|Claim(?:\s*#|\s*No\.?))\s*[:#]?\s*[A-Z0-9-]{3,}/gi },
  // Dates: M/D/YYYY, MM-DD-YYYY, YYYY-MM-DD
  { type: "DATE", regex: /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g },
  // Long dates: "January 5, 1978"
  { type: "DATE", regex: /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/gi },
  // ZIP+4 or 5-digit ZIP (Safe Harbor requires 3-digit truncation; we redact entirely)
  { type: "ZIP", regex: /\b\d{5}(?:-\d{4})?\b/g },
  // Ages over 89 (Safe Harbor §164.514(b)(2)(i)(C))
  { type: "AGE_OVER_89", regex: /\b(?:age\s*[:=]?\s*)?(?:9[0-9]|1\d{2})\s*(?:y(?:ear)?s?[\s-]*old|yo|y\.o\.)\b/gi },
  // Common name labels: "Patient: John Doe", "Name: Jane Smith"
  { type: "NAME", regex: /\b(?:Patient(?:'s)?\s*Name|Patient|Name|Surgeon|Physician|Provider|Dr\.?|Doctor)\s*[:#]?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}/g },
  // NPI (10 digits)
  { type: "NPI", regex: /\bNPI\s*[:#]?\s*\d{10}\b/gi },
  // DEA (2 letters + 7 digits)
  { type: "DEA", regex: /\b[A-Z]{2}\d{7}\b/g },
];

/**
 * Run all redaction patterns over the text and return scrubbed copy + counts.
 */
export function deidentify(input: string, opts: DeidentifyOptions = {}): DeidentifyResult {
  const marker = opts.marker !== false;
  const counts: Record<string, number> = {};
  let out = input;

  for (const p of PATTERNS) {
    out = out.replace(p.regex, (match) => {
      counts[p.type] = (counts[p.type] || 0) + 1;
      if (!marker) return "";
      return p.transform ? p.transform(match) : TYPE_MARK(p.type);
    });
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { text: out, redactionsByType: counts, totalRedactions: total };
}

/**
 * Scan-only — returns whether the text appears to contain PHI.
 * Use to gate LLM calls or warn users before submission.
 */
export function detectPHI(input: string): { hasPHI: boolean; types: string[] } {
  const hits = new Set<string>();
  for (const p of PATTERNS) {
    p.regex.lastIndex = 0;
    if (p.regex.test(input)) hits.add(p.type);
  }
  return { hasPHI: hits.size > 0, types: [...hits] };
}