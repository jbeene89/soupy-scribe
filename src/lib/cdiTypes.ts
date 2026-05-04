export type CDIFindingType =
  | 'missing_cc_mcc'
  | 'weak_specificity'
  | 'modifier_risk'
  | 'missing_documentation'
  | 'query_opportunity';

export type CDISeverity = 'low' | 'medium' | 'high';
export type CDIStatus = 'open' | 'queried' | 'resolved' | 'dismissed';

export interface CDIFinding {
  id: string;
  case_id: string;
  finding_type: CDIFindingType;
  severity: CDISeverity;
  description: string;
  current_code: string | null;
  suggested_code: string | null;
  evidence_excerpt: string | null;
  estimated_revenue_impact: number;
  status: CDIStatus;
  rationale: string | null;
  created_at: string;
  updated_at: string;
}

export type NewCDIFinding = Omit<CDIFinding, 'id' | 'created_at' | 'updated_at'>;

/**
 * Heuristic CDI detector — runs against the narrative + coded claim.
 * Conservative; flags clear gaps a CDI specialist would query before bill drop.
 */
export function detectCDIGaps(args: {
  caseId: string;
  sourceText: string | null | undefined;
  cptCodes: string[];
  icdCodes: string[];
}): NewCDIFinding[] {
  const findings: NewCDIFinding[] = [];
  const text = (args.sourceText || '').toLowerCase();
  const icd = args.icdCodes.map(c => c.toUpperCase());
  const cpt = args.cptCodes;

  const has = (...needles: string[]) => needles.some(n => text.includes(n));
  const hasIcdPrefix = (prefix: string) => icd.some(c => c.startsWith(prefix.toUpperCase()));

  // 1. Sepsis mentioned but no R65 / A41 family coded → missing CC/MCC
  if (has('sepsis', 'septic shock') && !hasIcdPrefix('A41') && !hasIcdPrefix('R65')) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'missing_cc_mcc',
      severity: 'high',
      description: 'Documentation references sepsis but no sepsis ICD-10 (A41.x / R65.2x) is coded.',
      current_code: null,
      suggested_code: 'A41.9',
      evidence_excerpt: extractSnippet(args.sourceText, ['sepsis', 'septic shock']),
      estimated_revenue_impact: 3200,
      status: 'open',
      rationale: 'Sepsis is an MCC. Adding it can shift DRG to a higher-weight pair.',
    });
  }

  // 2. Acute respiratory failure mentioned but J96 family not coded
  if (has('acute respiratory failure', 'respiratory failure') && !hasIcdPrefix('J96')) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'missing_cc_mcc',
      severity: 'high',
      description: 'Acute respiratory failure documented but J96.x not coded.',
      current_code: null,
      suggested_code: 'J96.0',
      evidence_excerpt: extractSnippet(args.sourceText, ['respiratory failure']),
      estimated_revenue_impact: 2400,
      status: 'open',
      rationale: 'Acute respiratory failure is an MCC and frequently missed.',
    });
  }

  // 3. Acute kidney injury / AKI mentioned but N17 not coded
  if (has('acute kidney injury', 'aki', 'acute renal failure') && !hasIcdPrefix('N17')) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'missing_cc_mcc',
      severity: 'medium',
      description: 'AKI / acute kidney injury documented but N17.x not coded.',
      current_code: null,
      suggested_code: 'N17.9',
      evidence_excerpt: extractSnippet(args.sourceText, ['acute kidney', 'aki']),
      estimated_revenue_impact: 1100,
      status: 'open',
      rationale: 'AKI is a CC and impacts DRG severity tier.',
    });
  }

  // 4. Malnutrition mentioned but E40-E46 not coded
  if (has('malnutrition', 'cachexia') && !icd.some(c => /^E4[0-6]/.test(c))) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'missing_cc_mcc',
      severity: 'medium',
      description: 'Malnutrition referenced but E40–E46 family not coded.',
      current_code: null,
      suggested_code: 'E44.0',
      evidence_excerpt: extractSnippet(args.sourceText, ['malnutrition', 'cachexia']),
      estimated_revenue_impact: 1800,
      status: 'open',
      rationale: 'Severe malnutrition (E40–E43) is an MCC; moderate (E44.0) is a CC.',
    });
  }

  // 5. Diabetes coded as E11.9 (unspecified) — weak specificity
  if (icd.includes('E11.9')) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'weak_specificity',
      severity: 'low',
      description: 'E11.9 (Type 2 diabetes without complications) is unspecified — query for complications.',
      current_code: 'E11.9',
      suggested_code: 'E11.x (specific)',
      evidence_excerpt: null,
      estimated_revenue_impact: 400,
      status: 'open',
      rationale: 'Specifying complications (e.g., neuropathy, nephropathy) can add CCs.',
    });
  }

  // 6. Bilateral procedure language without modifier 50
  if (has('bilateral') && cpt.length > 0 && !cpt.some(c => c.includes('-50') || c.includes('50'))) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'modifier_risk',
      severity: 'medium',
      description: '"Bilateral" referenced in note but modifier 50 not appended to procedure code.',
      current_code: cpt[0] ?? null,
      suggested_code: `${cpt[0] ?? ''}-50`,
      evidence_excerpt: extractSnippet(args.sourceText, ['bilateral']),
      estimated_revenue_impact: 600,
      status: 'open',
      rationale: 'Modifier 50 typically reimburses at 150% of unilateral.',
    });
  }

  // 7. Time-based E/M without documented time
  if (cpt.some(c => ['99417', '99418'].includes(c)) && !/\b\d+\s*minutes?\b/.test(text)) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'missing_documentation',
      severity: 'medium',
      description: 'Prolonged service code billed without documented total time.',
      current_code: cpt.find(c => ['99417', '99418'].includes(c)) ?? null,
      suggested_code: null,
      evidence_excerpt: null,
      estimated_revenue_impact: 0,
      status: 'open',
      rationale: 'Time-based codes require explicit minutes in the note.',
    });
  }

  // 8. Pressure ulcer mentioned without stage
  if (has('pressure ulcer', 'decubitus', 'pressure injury') && !/\bstage\s*[1-4iv]/i.test(args.sourceText || '')) {
    findings.push({
      case_id: args.caseId,
      finding_type: 'query_opportunity',
      severity: 'medium',
      description: 'Pressure ulcer documented without staging.',
      current_code: null,
      suggested_code: 'L89.x (staged)',
      evidence_excerpt: extractSnippet(args.sourceText, ['pressure ulcer', 'decubitus']),
      estimated_revenue_impact: 900,
      status: 'open',
      rationale: 'Stage 3+ pressure ulcers are MCCs.',
    });
  }

  return findings;
}

function extractSnippet(text: string | null | undefined, needles: string[]): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const n of needles) {
    const idx = lower.indexOf(n.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(text.length, idx + n.length + 80);
      return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
    }
  }
  return null;
}