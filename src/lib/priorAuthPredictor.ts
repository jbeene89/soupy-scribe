/**
 * Prior auth predictor.
 *
 * Heuristic predictor for whether a PA submission will be approved
 * quickly, approved with peer-to-peer, or denied. Inputs: clinical
 * note text + procedure code + payer.
 *
 * Real production version trains on historical PA outcomes per
 * provider org. This is a deterministic rule layer demonstrating the
 * UX and value.
 */

export interface PAPrediction {
  procedureCode: string;
  payer: string;
  predictedOutcome: "approve-fast" | "approve-after-p2p" | "delay-need-records" | "likely-deny";
  approvalLikelihood: number;     // 0-100
  estimatedDaysToDecision: number;
  strengthFactors: { factor: string; weight: "strong" | "moderate" | "weak" }[];
  weaknessFactors: { factor: string; weight: "strong" | "moderate" | "weak"; remediation: string }[];
  recommendedRevisions: string[];
  payerSpecificNotes: string[];
}

const PAYER_BIAS: Record<string, { conservativeTherapyWeeks: number; psychEvalRequired: string[]; imagingRequired: boolean }> = {
  "Aetna":    { conservativeTherapyWeeks: 12, psychEvalRequired: ["63685", "63688", "27447"], imagingRequired: true },
  "UHC":      { conservativeTherapyWeeks: 12, psychEvalRequired: ["63685", "63688"], imagingRequired: true },
  "BCBS":     { conservativeTherapyWeeks: 8,  psychEvalRequired: ["63685"], imagingRequired: true },
  "Cigna":    { conservativeTherapyWeeks: 6,  psychEvalRequired: ["63685"], imagingRequired: true },
  "Humana":   { conservativeTherapyWeeks: 8,  psychEvalRequired: [], imagingRequired: true },
  "Medicare": { conservativeTherapyWeeks: 6,  psychEvalRequired: [], imagingRequired: false },
};

export function predictPriorAuth(opts: {
  procedureCode: string;
  payer: string;
  clinicalText: string;
}): PAPrediction {
  const { procedureCode, payer, clinicalText } = opts;
  const text = clinicalText.toLowerCase();
  const bias = PAYER_BIAS[payer] ?? PAYER_BIAS["BCBS"];

  const strengths: PAPrediction["strengthFactors"] = [];
  const weaknesses: PAPrediction["weaknessFactors"] = [];
  const revisions: string[] = [];
  const payerNotes: string[] = [];
  let score = 50;

  // Imaging
  const hasImaging = /\b(mri|ct\s*scan|x-?ray|ultrasound|imaging)\b/.test(text);
  if (bias.imagingRequired) {
    if (hasImaging) {
      strengths.push({ factor: "Imaging documented", weight: "strong" });
      score += 12;
    } else {
      weaknesses.push({ factor: "No imaging mentioned", weight: "strong", remediation: "Reference the most recent MRI/CT and quote the impression line." });
      score -= 18;
    }
  }

  // Conservative therapy
  const ctMatch = text.match(/conservative\s+(?:therapy|management|care)\s+(?:for\s+)?(\d+)\s*(week|month)/);
  let documentedWeeks = 0;
  if (ctMatch) {
    const num = parseInt(ctMatch[1]);
    documentedWeeks = ctMatch[2].startsWith("month") ? num * 4 : num;
  } else if (/(physical\s+therapy|nsaid|injection)/.test(text)) {
    documentedWeeks = 4; // weak signal
  }

  if (documentedWeeks >= bias.conservativeTherapyWeeks) {
    strengths.push({ factor: `Conservative therapy ≥ ${bias.conservativeTherapyWeeks}w documented`, weight: "strong" });
    score += 18;
  } else if (documentedWeeks > 0) {
    weaknesses.push({
      factor: `Conservative therapy only ${documentedWeeks}w (payer requires ${bias.conservativeTherapyWeeks}w)`,
      weight: "moderate",
      remediation: `Add documentation of additional ${bias.conservativeTherapyWeeks - documentedWeeks} weeks of PT, NSAIDs, or injections.`,
    });
    score -= 8;
  } else {
    weaknesses.push({
      factor: "No conservative therapy documented",
      weight: "strong",
      remediation: `Document at least ${bias.conservativeTherapyWeeks} weeks of PT, NSAIDs, or injection therapy with response.`,
    });
    score -= 22;
  }

  // Psych eval (for spinal cord stimulators, joints in some payers)
  if (bias.psychEvalRequired.includes(procedureCode)) {
    if (/\b(psychological\s+evaluation|psych\s+eval|behavioral\s+health\s+assessment)\b/.test(text)) {
      strengths.push({ factor: "Psychological evaluation documented", weight: "moderate" });
      score += 8;
    } else {
      weaknesses.push({
        factor: `${payer} requires psychological evaluation for ${procedureCode}`,
        weight: "strong",
        remediation: "Obtain and reference a documented psychological evaluation prior to PA submission.",
      });
      score -= 20;
    }
  }

  // Failed conservative response
  if (/\bfailed\s+(pt|conservative|injection|nsaid)/.test(text)) {
    strengths.push({ factor: "Failed conservative response documented", weight: "moderate" });
    score += 10;
  } else {
    revisions.push("Add explicit 'patient failed conservative therapy' language with measurable function deficit (e.g., VAS pain ≥7, ODI ≥40).");
  }

  // Functional impact
  if (/\b(adl|activities of daily living|unable to|disability|work\s+restriction)\b/.test(text)) {
    strengths.push({ factor: "Functional impact documented", weight: "moderate" });
    score += 6;
  } else {
    revisions.push("Quantify functional impact: ADL limitations, work restrictions, or validated pain/disability score.");
  }

  // Specificity
  if (text.length < 400) {
    weaknesses.push({ factor: "Clinical narrative is short — payer reviewers often request more detail", weight: "moderate", remediation: "Expand the narrative to at least 400 words covering history, exam, imaging, and treatment timeline." });
    score -= 6;
  }

  // Payer-specific notes
  if (payer === "Aetna") payerNotes.push("Aetna routes spine and joint PAs to internal MD reviewers; peer-to-peer offered if denied.");
  if (payer === "UHC")   payerNotes.push("UHC uses Optum InterQual criteria — quote the specific criteria you meet.");
  if (payer === "Cigna") payerNotes.push("Cigna favors concise submissions with explicit citation of their coverage policy number.");
  if (payer === "BCBS")  payerNotes.push("BCBS varies by state plan — verify the specific Blue plan's medical policy.");

  score = Math.max(5, Math.min(95, score));

  let outcome: PAPrediction["predictedOutcome"];
  let days: number;
  if (score >= 75)      { outcome = "approve-fast"; days = 2; }
  else if (score >= 55) { outcome = "approve-after-p2p"; days = 5; }
  else if (score >= 40) { outcome = "delay-need-records"; days = 9; }
  else                  { outcome = "likely-deny"; days = 12; }

  return {
    procedureCode,
    payer,
    predictedOutcome: outcome,
    approvalLikelihood: score,
    estimatedDaysToDecision: days,
    strengthFactors: strengths,
    weaknessFactors: weaknesses,
    recommendedRevisions: revisions,
    payerSpecificNotes: payerNotes,
  };
}

export const PA_PAYERS = ["Aetna", "UHC", "BCBS", "Cigna", "Humana", "Medicare"];
export const PA_COMMON_CODES = ["27447", "27130", "63030", "63685", "63688", "29881", "70553", "73721"];