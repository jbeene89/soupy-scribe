
# Patient Self-Help v2 — Records Reconciliation, Not Malpractice Oracle

Reframe the module around one promise: **"We don't decide if care was wrong. We tell you what the record says, what it doesn't show, what doesn't reconcile, and what to ask for next."**

## 1. Pre-analysis intake (replaces free-text narrative as the only input)

Three structured questions before any file is analyzed:

**Q1. What are you worried happened?** (multi-select chips)
- Medication before consent
- Procedure without consent
- Wrong diagnosis
- Missing test / missing result
- "They said X but chart says Y"
- Billing / charges look wrong
- I don't know, just check it
- Other (free text)

**Q2. What do you remember?** (optional structured fields)
- Approximate date/time of the event
- Who was present
- What was said to you
- What you consented to
- What you were NOT told
- Any quote you remember (e.g. "I think she just did a membrane sweep")

**Q3. What kind of file are you uploading?** (per-file, with auto-detect fallback)
- Clinical medical record / chart release
- Itemized bill / EOB / UB-04 / CMS-1500
- Lab report
- Imaging report
- Discharge instructions
- Consent packet
- Portal message / screenshot
- Insurance denial
- Unknown / mixed

These get stored on the case row and passed into every chunk extraction prompt so the AI looks for what the patient is actually worried about.

## 2. Document-type gate (the anti-hallucination guardrail)

Before deep analysis runs, each file is classified by a fast pass into one of the categories above. The case-level `analysis_modes` flag is then locked:

- **Billing analysis** only enabled if at least one billing artifact is detected.
- **Clinical reconciliation** only enabled if a clinical record is detected.
- **Consent review** only enabled if consent docs or clinical record present.

If the patient asked about billing but uploaded only a clinical EMR, the UI shows a clear banner:

> "This appears to be a clinical medical record, not a billing claim. Billing/payment analysis is disabled unless you upload an itemized bill, EOB, UB-04, CMS-1500, 837, or charge detail."

No billing finding cards can be generated in that mode. Same logic for the inverse.

## 3. New finding bucket taxonomy

Replace the current severity-only model with six buckets. Every finding card belongs to exactly one:

1. **Looks Routine** — normal admin/forms/meds, expected language
2. **Needs Clarification** — documented but not enough to verify
3. **Record Mismatch** — two parts of the chart disagree
4. **Consent / Patient-Rights Flag** — missing, late, generic, or post-hoc consent
5. **Missing Source Document** — chart references something not provided
6. **Ask For This Next** — concrete record request language the patient can send verbatim

## 4. Finding card shape (the trust mechanic)

Every card returned by the synthesizer must have these fields:

```
{
  bucket: "Record Mismatch" | "Needs Clarification" | ...,
  title: "Misoprostol order/admin/consent timing needs reconciliation",
  whyItMatters: "Medication appears ordered before visible consent completion.",
  whatRecordShows: "Order at 14:02; consent signed at 15:10; MAR shows no admin in window.",
  whatItDoesNotProve: "Does not prove medication was given before consent without full eMAR / BCMA scan history.",
  askNext: "Request complete MAR, BCMA scan log, consent metadata, and audit trail for the induction window.",
  severity: "high-documentation-issue" | "moderate" | "low" | "informational",
  sourceFile: "...",
  sourcePages: [12, 13]
}
```

The `whatItDoesNotProve` field is non-optional. If the model omits it, we reject the card and retry. This is the line that keeps the app from sounding like a lawsuit vending machine.

## 5. Plain-language summary section

Replace the current 2-3 sentence summary with a structured recap:

- What the record supports
- What the record contains (key clinical language found)
- What the record does NOT include (gaps)
- What analysis was disabled and why (document-type gate)
- The headline ask-next list (top 3-5 records to request)

## 6. UI changes (`PatientSelfHelp.tsx`)

- New intake step before upload: the three questions above.
- Per-file dropdown for document type (defaults to auto-detect, patient can override).
- Results view grouped by bucket with collapsible cards, color-coded by bucket not severity.
- Prominent "Ask For This Next" panel at top with copy-to-clipboard for each request line.
- Banner area for disabled analysis modes.
- Disclaimer copy updated to the new promise wording.

## 7. PDF export changes (`exportPatientSelfHelpPDFs.ts`)

- Findings PDF reorganized by bucket.
- New "Records To Request" PDF — just the Ask-Next items formatted as a letter-ready request.
- Complaint packet and attorney summary stay but pull from the new card shape.

---

## Technical Section

### Schema migration

```sql
ALTER TABLE public.patient_self_help_cases
  ADD COLUMN IF NOT EXISTS worries text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recollection jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_modes jsonb DEFAULT '{"clinical":false,"billing":false,"consent":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS disabled_modes_reason text;

ALTER TABLE public.patient_self_help_files
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS doc_type_source text;  -- 'user' | 'auto'
```

No new GRANTs needed (columns added to existing tables; existing policies cover them).

### Edge function changes

**`patient-self-help-submit`**: accept `worries`, `recollection`, per-file `doc_type` overrides; persist them.

**`patient-self-help-process`**: three changes —
1. **New first phase** per file: a fast classification call (gemini-2.5-flash-lite) that returns `{ doc_type, confidence, signals }`. Persist to `patient_self_help_files.doc_type` (skip if user overrode). After all files classified, compute `analysis_modes` on the case row.
2. **Chunk extraction prompt** updated: receives `worries` + `recollection` + `doc_type` + `analysis_modes` so extraction is targeted. Billing extraction is skipped on non-billing docs. New JSON schema for chunk output includes `bucket` hints.
3. **Synthesis prompt** rewritten around the six-bucket taxonomy and the mandatory `whatItDoesNotProve` field. Validator rejects and retries if any card is missing it.

### Frontend

- New `PatientSelfHelpIntake.tsx` component (the 3 questions).
- `PatientSelfHelp.tsx` upload step gains per-file doc-type selector.
- New `FindingCard.tsx` and `BucketSection.tsx` components.
- New `RecordsToRequestPanel.tsx` with per-line copy buttons.
- `DisabledModeBanner.tsx` for the gate messaging.

### Validation

After synthesis returns, validator runs server-side:
- Every card must have non-empty `whatItDoesNotProve` and `askNext`.
- No billing-bucket cards allowed when `analysis_modes.billing === false`.
- Cards with `bucket === "Missing Source Document"` must also produce a matching `Ask For This Next` card.

Failures trigger one automatic retry with a stricter system prompt, then fall back to whatever passes.

---

## Out of scope for this pass

- Multi-patient cases / family bulk uploads
- Long-term storage tier for case re-review months later
- Direct send to hospital patient relations (still PDF export only)

Approve and I'll build it.
