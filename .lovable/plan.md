# OB Fetal Monitoring Audit Module

A new mode-agnostic module that audits labor & delivery cases over extended time windows. It compares the fetal monitor strip against the medications given (Pitocin, Misoprostol/Cervidil) and flags every moment where the nurse or provider **should have stopped or reduced the medication but did not** — with a verbatim timestamp and reason for each flag.

This is the all-three-in-one workflow you asked for: same engine output drives the retrospective clinical audit, the malpractice/risk timeline, and the billing audit for continuous fetal monitoring time units.

## What you'll be able to do

1. Open **L&D Fetal Monitoring Audit** from the sidebar.
2. Drop in any combination of:
   - A structured strip export (CSV / XML / HL7 from PeriGen, OBIX, Centricity, Philips) — timestamp, FHR bpm, contraction values.
   - One or more scanned strip images / PDFs — the engine reads the tracing visually, segment by segment, and turns it into the same timeline.
   - The medication record (MAR) — Pitocin rate changes, Misoprostol doses, mag, terbutaline, with timestamps.
   - Nursing notes / provider notes.
3. Click **Run OB Audit**.
4. See:
   - A scrollable **timeline** that shows every 10-minute window of the strip alongside what medication was running, what changed, and what was charted.
   - A **stop-rule violations** panel: each violation has the exact timestamp, the strip finding (e.g. "tachysystole — 7 contractions in 10 min at 14:32"), the medication that should have been held/decreased, the rule that was broken, and the verbatim chart quote (or "no documented action").
   - A **contraindication ledger**: for every dose of Pitocin or Misoprostol, the engine lists which contraindications were present at the time of administration (active labor, prior C-section, Category III, tachysystole within prior 30 min, etc.) — or explicitly says "none documented."
   - A printable PDF for legal / peer-review / payer use.

## Stop-rules covered in v1

**Oxytocin (Pitocin)** — ACOG / AWHONN aligned:
- Tachysystole (>5 contractions in any 10-min window averaged over 30 min) → reduce or discontinue
- Category III tracing → discontinue immediately
- Category II with recurrent late decels, recurrent variable decels, prolonged decel, minimal/absent variability → reduce/discontinue + intrauterine resuscitation
- Uterine rupture signs (sudden FHR change + loss of station + pain) → discontinue
- Continued increase in rate despite any of the above

**Misoprostol / Cervidil**:
- Redose before the minimum interval (Misoprostol 3–6h, Cervidil 12h)
- Use after spontaneous labor / regular contractions established
- Tachysystole within prior monitoring window
- Documented prior uterine surgery / C-section

## Technical section (skip if not technical)

### Files
- `supabase/functions/ob-fetal-audit/index.ts` — main engine. Accepts `{ stripStructured?, stripImages?[], mar?, notes? }`. Two-stage pipeline:
  - Stage A — normalize: if structured CSV present, parse to `StripWindow[]`; for each image, call multimodal vision model to extract per-window FHR/UC numerics into the same shape.
  - Stage B — analyze: deterministic stop-rule engine (no LLM) walks the merged timeline, joins MAR events, returns `StopRuleViolation[]` + `ContraindicationCheck[]` + per-window NICHD category.
- `src/lib/obFetalTypes.ts` — `StripWindow`, `MAREvent`, `StopRuleViolation`, `ContraindicationCheck`, `OBAuditResult`.
- `src/lib/obFetalParser.ts` — client-side CSV/text parsers for structured strip, MAR, notes (forgiving column matching).
- `src/lib/obFetalService.ts` — `runOBAudit()` invoker + result caching.
- `src/lib/exportOBAuditPDF.ts` — printable timeline + violations + contraindication ledger.
- `src/pages/AppOBFetalAudit.tsx` — route `/app/ob-fetal-audit`.
- `src/components/ob/StripIngestDropzones.tsx` — 4 dropzones (structured strip, strip images, MAR, notes) + sample-data button.
- `src/components/ob/StripTimeline.tsx` — visual 10-min-window timeline with med overlay + decel markers.
- `src/components/ob/StopRuleViolationsPanel.tsx` — grouped by severity with timestamp + verbatim evidence.
- `src/components/ob/ContraindicationLedger.tsx` — per-dose contraindication check.
- Sidebar link added under the existing operational/clinical group.

### Engine details
- Window size: 10 minutes (configurable). NICHD Cat I/II/III computed per window.
- Decel classification: late / variable / prolonged / early via timing offset from contraction peak (structured) or visual cue (image).
- Tachysystole rule: >5 contractions averaged over a rolling 30-min window.
- Med join: each MAR Pitocin rate change is annotated with the strip category in the 30 min **before and after** the change. Rate increases during tachysystole or Cat II/III are flagged.
- Misoprostol redose rule joins dose timestamps and computes elapsed time + contraction status at redose.

### What's NOT in v1 (called out in the UI so we don't overpromise)
- Real-time monitoring (this is retrospective only).
- Direct HL7 socket ingestion (file upload only).
- Maternal vitals / mag toxicity rules (next iteration — your "Med scope" answer was Pit + Miso first).

## Out of scope for this change
- No changes to existing Payer/Provider/Psych modes.
- No DB schema changes — results stay in-memory for v1 (can be persisted later if you want history).
- No PHI is sent to vision model if you use the structured strip path; image path runs through the existing de-identification helper before upload.
