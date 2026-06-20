---
name: Patient Self-Help — Records Reconciliation
description: Patient-facing record review module. Reconciliation, not malpractice judgment. Document-type gating, six-bucket findings, mandatory "what it does NOT prove" disclaimer per card.
type: feature
---

## Promise (verbatim)
"We don't decide if care was wrong. We tell you what the record says, what it does not show, what does not reconcile, and what to ask for next."

## Hard rules
- Never use the words "malpractice", "negligence", "below the standard of care", "wrong care", "lawsuit", or "you have a case" in patient-facing copy or AI output.
- Every finding card MUST include `whatItDoesNotProve` and `askNext`. Server validator rejects/retries if missing.
- Document-type gate: classify each upload first; lock `analysis_modes` (clinical/billing/consent). Never generate billing findings unless a billing artifact was uploaded. Surface a disabled-mode banner explaining why.

## Six buckets
Looks Routine · Needs Clarification · Record Mismatch · Consent / Patient-Rights Flag · Missing Source Document · Ask For This Next.
Every Missing Source Document card must pair with an Ask For This Next card.

## Pre-analysis intake (3 questions)
1. What are you worried happened? (multi-select chips from `WORRIES` in `src/lib/patientSelfHelpTypes.ts`)
2. What do you remember? (optional structured fields: time, who, what was said, what consented to, what NOT told, quote)
3. What kind of file is this? (per-file dropdown from `DOC_TYPES`; defaults to auto-detect)

## Pipeline
`patient-self-help-submit` stores worries + recollection + per-file doc_type overrides.
`patient-self-help-process` runs: (A) classify unclassified files with gemini-2.5-flash-lite, (B) compute analysis_modes from classifications, (C) chunk-extract per file with prompts targeted by worries/recollection/docType/modes, (D) synthesize with gemini-2.5-pro, validate cards, retry once with stricter prompt if validation fails, drop invalid cards as final safety net.

## Forbidden surface
No "AI says hospital bad". No advocacy framing. Output is records reconciliation framed for a non-clinician patient.