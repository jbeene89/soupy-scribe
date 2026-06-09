# Make the audit findings the source of truth, not the playbook

## The problem in plain language

Today the audit tool takes the whole Code Bay bundle, mashes it into one big block of "encounter text," and asks the AI to write a nice report. The report says things like *"Bundling: $2,624 across 3 encounters."* That sounds good, but Code Bay's hidden answer key is line-level — it expects you to point at **chg-pt-0005-18 = upcoding**, **ven-pt-0002-1 = vendor_overbilling**, etc. The current report can't be checked against the answer key because it never names the rows it accused.

## The fix

Make the tool output a **structured findings list first**, where every finding points at one specific row in one specific file. The pretty playbook becomes a *view* of that list — not the report itself.

## What every finding must contain

| Field | Example |
|---|---|
| `sourceId` | `chg-pt-0005-18` |
| `sourceType` | `charge` / `vendor` / `note` / `timesheet` / `fhir` |
| `defectType` | `upcoding`, `vendor_overbilling`, `phantom_charge`, `modifier_abuse`, `unbundling`, `policy_time`, `contract_underpay`, … (controlled vocabulary, matches Code Bay's) |
| `confidence` | `high` / `medium` / `low` |
| `recoverableAmount` | dollars |
| `evidence` | the exact cell values / row snippet that triggered it (verbatim, no paraphrase) |
| `explanation` | one or two sentences |

This is the contract. Nothing downstream gets to invent a finding that doesn't have these fields filled in.

## How the new pipeline runs

```text
Code Bay .zip
    │
    ▼
parseCodeBayBundle  (already exists — keeps sourceIds intact)
    │
    ▼
NEW: per-row detectors           ← the new core
   • walks charges row-by-row, vendors row-by-row, notes row-by-row
   • each candidate gets a sourceId tag before anything else happens
   • emits Finding[] (the structured contract above)
    │
    ▼
Validator (rejects any finding missing sourceId / evidence / defectType,
           confirms the sourceId actually exists in the bundle,
           confirms the evidence string appears verbatim in that row)
    │
    ▼
Persist Finding[]  ← THIS is the source of truth, exportable as JSON
    │
    ├──► Code Bay scoring  (already exists in scoreDetector — just feed it Finding[])
    │
    └──► Prevention Playbook is now a *rollup view*:
         group by defectType, sum recoverableAmount, list contributing sourceIds.
         The playbook can never report a category without naming the rows behind it.
```

## What changes in the codebase (technical section)

1. **New module `src/lib/auditFindings.ts`** — defines the `AuditFinding` type (the contract above), plus `validateFinding()` that enforces:
   - `sourceId` exists in the parsed bundle
   - `evidence` substring appears in the referenced row
   - `defectType` is in the allowed enum
   - `recoverableAmount >= 0`

2. **New edge function `audit-bundle`** — replaces the "flatten to prose" path for Code Bay inputs. Iterates each `charges` / `vendor_invoices` / `clinical_notes` row, asks the model **per row** (or in small same-source batches) to return zero or more findings tagged with that row's `sourceId`. Each model call's prompt includes the row JSON and forces the schema above. Findings that fail `validateFinding` are dropped, not rewritten.

3. **Rework `recovery-engine`'s Code Bay path** — when the input came from a Code Bay bundle, route through `audit-bundle` instead of the prose lenses. The lens-on-prose path stays for free-text encounters that have no row IDs.

4. **`PreventionPlaybook.tsx` becomes a rollup view** — reads `AuditFinding[]`, groups by `defectType`, and every category card lists the contributing `sourceId`s underneath the dollar total. No category total can be shown without the row-level breakdown that produced it.

5. **`CodeBayIntake.tsx` "Run SoupyAudit" button** — already accepts detector JSON via upload; add a "Run SoupyAudit on this bundle" action that calls `audit-bundle` and pipes the result straight into `scoreDetector` so precision/recall shows immediately.

6. **Export** — `AuditFinding[]` is downloadable as JSON in the exact shape `scoreDetector` and Code Bay's `hidden_ground_truth.json` use (`{sourceId, findingType, reasoning}` plus the extra fields). This is the artifact an external evaluator can verify.

## What this fixes

- Code Bay (or any third party) can now score the tool, because every dollar in the playbook traces to a named row with a named defect type.
- "Bundling: $2,624 across 3 encounters" becomes "Bundling: $2,624 — `chg-pt-0005-15`, `chg-pt-0005-18`, `chg-pt-0003-12`."
- Hallucinated findings get filtered out by the validator before they reach the playbook.

## What does NOT change

- The free-text encounter path (paste a chart note, no row IDs) still uses the existing lens pipeline.
- The existing `recovery_findings` table, UI shell, and PDF export stay; they just render from the new structured list.
- No DB schema changes required for v1 — `AuditFinding` rows fit into the existing `recovery_findings` table via the `metadata` JSON field, with `code` carrying `sourceId` and `lens` carrying `defectType`. (We can add proper columns later if you want them queryable.)
