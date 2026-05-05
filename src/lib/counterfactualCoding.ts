/**
 * Counterfactual coding: given a clinical note and a current code set,
 * surface documentation deltas that, if added, would shift the code/DRG
 * and quantify the dollar impact.
 *
 * This is a deterministic rule layer. The AI agent can call this to
 * propose specific note additions; this file evaluates the financial
 * impact of each accepted suggestion so the UI can rank them.
 */

export interface CounterfactualOpportunity {
  id: string;
  category: "missing-cc" | "missing-mcc" | "missing-modifier" | "missing-laterality" | "missing-hcc" | "weak-medical-necessity" | "missing-procedure-detail";
  trigger: RegExp;            // pattern in the source text that suggests opportunity exists
  blocker: RegExp;            // pattern that suggests the documentation is already present
  suggestion: string;         // what to add to the note
  rationale: string;
  estimatedDollarImpact: number; // illustrative average uplift
  drgShift?: string;
  cmiDelta?: number;
}

const RULES: CounterfactualOpportunity[] = [
  {
    id: "ahf-on-chf",
    category: "missing-mcc",
    trigger: /\b(heart failure|CHF|HFrEF|HFpEF|systolic|diastolic dysfunction)\b/i,
    blocker: /\b(acute on chronic|acute decompensated|acute systolic|acute diastolic|ADHF)\b/i,
    suggestion: "If clinically supported, document acuity: 'acute on chronic systolic heart failure' or 'acute decompensated heart failure'.",
    rationale: "Acute heart failure is an MCC and shifts most cardiac DRGs. Chronic-only is a CC at best.",
    estimatedDollarImpact: 3847,
    drgShift: "291 → 291 with MCC",
    cmiDelta: 0.31,
  },
  {
    id: "aki-specificity",
    category: "missing-cc",
    trigger: /\b(creatinine|BUN|renal|kidney injury|AKI)\b/i,
    blocker: /\b(acute kidney injury|AKI stage|ATN|acute tubular necrosis)\b/i,
    suggestion: "If creatinine rise meets KDIGO criteria, document 'AKI stage 1/2/3' or 'acute tubular necrosis' with stage.",
    rationale: "Unspecified renal dysfunction codes to non-CC. AKI N17.x is a CC; ATN is an MCC.",
    estimatedDollarImpact: 2940,
    cmiDelta: 0.22,
  },
  {
    id: "sepsis-vs-bacteremia",
    category: "missing-mcc",
    trigger: /\b(bacteremia|positive blood culture|fever|leukocytosis|septic|SIRS)\b/i,
    blocker: /\b(sepsis|severe sepsis|septic shock|R65\.2)\b/i,
    suggestion: "If SIRS + infection criteria met, document 'sepsis' explicitly. If hypotension or lactate >2 with organ dysfunction, document 'severe sepsis' or 'septic shock'.",
    rationale: "Bacteremia alone is non-CC. Sepsis is MCC. Severe sepsis/shock pulls into DRG 871.",
    estimatedDollarImpact: 6120,
    drgShift: "Pulls to DRG 871 (Septicemia w MCC)",
    cmiDelta: 0.85,
  },
  {
    id: "respiratory-failure",
    category: "missing-mcc",
    trigger: /\b(hypoxia|hypoxemia|SpO2|oxygen|BiPAP|intubat|ventilator)\b/i,
    blocker: /\b(acute respiratory failure|J96\.0|chronic respiratory failure)\b/i,
    suggestion: "If on supplemental O2, BiPAP, or ventilator, document 'acute respiratory failure, hypoxic' or 'hypercapnic' as appropriate.",
    rationale: "ARF is one of the highest-frequency missed MCCs in inpatient documentation.",
    estimatedDollarImpact: 4230,
    cmiDelta: 0.42,
  },
  {
    id: "malnutrition-severity",
    category: "missing-cc",
    trigger: /\b(malnutrition|weight loss|cachexia|albumin|prealbumin|nutrition consult)\b/i,
    blocker: /\b(severe malnutrition|moderate malnutrition|E43|E44)\b/i,
    suggestion: "If a nutrition consult documented protein-calorie malnutrition, capture severity (E43 severe MCC; E44.0 moderate CC).",
    rationale: "Severity-coded malnutrition is one of the most under-documented CCs/MCCs.",
    estimatedDollarImpact: 2150,
  },
  {
    id: "laterality-knee",
    category: "missing-laterality",
    trigger: /\b(27447|27130|29881|knee|hip)\b/i,
    blocker: /\b(right knee|left knee|right hip|left hip|RT|LT|-RT|-LT|bilateral)\b/i,
    suggestion: "Add laterality (-RT or -LT modifier) and explicit 'right' or 'left' in the procedure text.",
    rationale: "Missing laterality is a top-5 commercial denial trigger and blocks bilateral payment.",
    estimatedDollarImpact: 1450,
  },
  {
    id: "modifier-25",
    category: "missing-modifier",
    trigger: /\b(99213|99214|99284|99285)\b.*\b(injection|procedure|biopsy|aspirat)\b/is,
    blocker: /\b-25\b|modifier 25/i,
    suggestion: "If a separately identifiable E/M was performed on the same day as a procedure, append modifier -25 to the E/M.",
    rationale: "Without -25, the E/M is bundled into the procedure and lost.",
    estimatedDollarImpact: 92,
  },
  {
    id: "obesity-bmi",
    category: "missing-hcc",
    trigger: /\b(BMI|body mass index|obese|obesity)\b/i,
    blocker: /\b(morbid obesity|severe obesity|E66\.01|BMI [4-9]\d)\b/i,
    suggestion: "If BMI ≥ 40 or BMI ≥ 35 with comorbidities, document 'morbid obesity' (E66.01) and 'BMI 40+' (Z68.41+).",
    rationale: "Morbid obesity is an HCC for risk-adjusted payment; plain obesity is not.",
    estimatedDollarImpact: 1820,
  },
];

export interface CounterfactualResult {
  opportunities: Array<CounterfactualOpportunity & { matched: boolean }>;
  totalEstimatedUplift: number;
  totalCmiDelta: number;
}

export function analyzeCounterfactuals(noteText: string): CounterfactualResult {
  const opportunities = RULES.map(rule => {
    const triggered = rule.trigger.test(noteText);
    const alreadyDocumented = rule.blocker.test(noteText);
    return { ...rule, matched: triggered && !alreadyDocumented };
  });

  const matched = opportunities.filter(o => o.matched);
  const totalEstimatedUplift = matched.reduce((a, o) => a + o.estimatedDollarImpact, 0);
  const totalCmiDelta = matched.reduce((a, o) => a + (o.cmiDelta ?? 0), 0);

  return {
    opportunities,
    totalEstimatedUplift,
    totalCmiDelta: Math.round(totalCmiDelta * 100) / 100,
  };
}