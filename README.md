# SOUPY Audit

> Multi-perspective AI audit engine for healthcare claims, denials, operational risk, and behavioral health pre-submission review.

Built on React 18 + TypeScript + Vite + Tailwind + shadcn/ui with Lovable Cloud (Supabase) backend. Live at [soupyaudit.com](https://soupyaudit.com).

---

## Platform Overview

SOUPY Audit runs three distinct operating modes from a single codebase, gated by a full-page **Mode Selection Gate** at entry. All output uses enterprise-grade neutral language with vendor-neutral labels — no advocacy framing.

### Three Modes

| Mode | Purpose | Primary Users |
|------|---------|---------------|
| **Payer** | Payment integrity / compliance coaching on submitted claims | Payer review teams, SIU |
| **Provider** | Pre-submission readiness + denial defense | RCM, CDI, appeals teams |
| **Behavioral Health (Psych)** | Pre-submission audit for private psych practices, telehealth-aware | Solo / small group practices |

---

## SOUPY Engine v3

Two-phase pipeline (split to avoid Deno edge timeouts):

1. **`analyze-case`** — extraction + 4-role parallel adversarial analysis
2. **`analyze-v3`** — consolidated modules (drift, consensus integrity, evidence sufficiency, contradictions, confidence floors, decision traces, action pathways)

### Roles & Models

| Role | Model | Purpose |
|------|-------|---------|
| Builder | `google/gemini-2.5-flash` | Best-case interpretation |
| Red Team | `openai/gpt-5-mini` | Weakness/risk + payer denial-pattern injection |
| Systems Analyst | `google/gemini-2.5-pro` | Regulatory/structural analysis |
| Frame Breaker | `openai/gpt-5-mini` | Challenges assumptions |
| Devil's Advocate | `openai/gpt-5` | Attacks consensus (5th pass) |
| Drift Check | `google/gemini-2.5-flash-lite` | Prompt-order stability |

### Decision Governance Layer (`src/lib/caseGovernance.ts`)

Separates six concepts surfaced in `GovernancePanel`:

1. Claim Risk Score (aggregate 0–100)
2. Finding Severity (per-violation, metadata-guarded)
3. Automation Confidence (penalized by contradictions)
4. Evidence Sufficiency
5. Consensus Integrity (cross-model agreement)
6. Final Recommended Action

**Severity reclassification**: findings dependent on missing metadata cannot be "critical confirmed" — they downgrade to *Critical Pending Verification*, *High-Risk Documentation Gap*, *Needs Payer/Entity Validation*, or *Documentation Deficiency*. See [`src/lib/ruleDependency.ts`](src/lib/ruleDependency.ts).

**Risk formula**: `10 + (confirmedCriticals × 30) + (pendingCriticals × 15) + (warnings × 8) + consensusPenalty + confidencePenalty`

**Routing floors**: evidence ≥50%, consensus ≥45%, confidence ≥55%, ≤1 contradiction, ≤1 pending critical for auto-disposition.

---

## Modules

### Core Audit
- **Case Queue / Audit Detail** — risk-scored cases with full SOUPY drill-down
- **Claim Parser + Clinical Crosswalk + Perspectives Panel** — structured claim extraction with code↔note evidence linking
- **Pre-Appeal Resolution** — curability assessment, rapid resolution checklist, provider submission builder, payer response simulation
- **Defense Packet Builder** — minimal winning packet generator
- **Governance Panel** + **Score Transparency Panel** — full reasoning visibility

### Provider Readiness
- Documentation sufficiency, coding vulnerability, appeal viability
- CDI Findings Panel, Fix-Before-Submission Checklist, Payer Perspective View, Evidence Readiness Checklist
- Provider Packet export

### Behavioral Health (Psych)
- Telehealth-aware checks: POS 02 vs 10, audio-only billing, interstate licensing, platform documentation, crisis/safety plan, consent re-attestation, parity flags
- Missed revenue lanes: collaborative care (99492–99494), caregiver sessions (90846/90847), screening add-ons (96127), extended intake (90792), pharmacogenomics (0029U), CCM (99490/99491)
- Standardized scales panel, dual-risk card, TL;DR card, version switcher, readiness packet

### Imaging Audit
- `ImagingAuditModule`, FTD review, finding cards, upload dialog
- Edge: `imaging-analyze`, `imaging-ftd-review`

### Operational
- OR Readiness, Triage Accuracy, Post-Op Flow, ER Acute, Patient Advocate, Supply/Waste
- System Impact summary, unified timeline, related-activity badges

### Revenue Integrity
- Dedicated page + service surfacing missed revenue across modules

### Sales / GTM
- ROI Calculator, Pricing Section, Pilot Pipeline, Platform Enhancement Map, Landing page
- Phase 0 **Shadow Audit** workflow for prospect conversion

### Strategic Analytical Tools (`/app/strategic-tools`)
High-signal differentiators surfaced in a single tabbed workspace:

| Tool | Purpose |
|------|---------|
| **Audit the Auditor** | Audits payer denial letters for medical-policy misapplication, ERISA defects, and state prompt-pay violations; drafts a state-DOI complaint. Backed by `audit-the-auditor` edge function (Gemini 2.5 Flash). |
| **Counterfactual Coding** | Identifies documentation gaps (e.g., Sepsis vs Bacteremia, AKI specificity) and quantifies the **$ delta + CMI impact** of a potential DRG shift. |
| **Contract Leakage Detector** | Scans X12 835 remits against a reference fee schedule, flagging underpayments and silent denials by CPT. |
| **Regulatory Clock Tracker** | Computes state-specific (30+ states) and payer-specific (ERISA, MA, Medicaid MCO) appeal deadlines and clean-claim clocks. |
| **Denial Drift & Reviewer Fingerprinting** | Detects accelerating CARC/RARC codes (last 30d vs prior 30d) and clusters denials by boilerplate signatures to identify specific MD reviewer bias. |
| **Appeal Letter A/B Testing** | Tracks variants of appeal letters per (payer, denial-reason) combo and records overturn outcomes. |
| **Documentation Debt Scoring** | Per-physician documentation-debt scores with remediation pathways. |
| **Prior-Auth / Outcome Predictor** | Per-payer outcome prediction with strength/weakness factors and remediation pathways. |

### Integration Depth (`/app/ehr`)
- **SMART-on-FHIR** launch (beyond file upload)
- **Bulk FHIR `$export`** support
- **HL7 v2** ADT/DFT fallback ingest (`src/lib/hl7v2Ingest.ts`)
- **X12** 837 / 835 / 277 claim + remit parsing (`src/lib/x12Ingest.ts`)
- Epic App Orchard / Cerner Code listing path documented
- SSO: SAML + SCIM provisioning

### AI Governance (`/ai-governance`)
Public-facing AI trust surface:
- Per-agent **model cards** (provider, version, eval scores, known failure modes)
- "No PHI used for training" attestation
- Hallucination rate / confidence calibration metrics
- Human-in-the-loop checkpoint documentation
- Prompt-injection defenses
- NIST AI RMF + ISO 42001 alignment statement

### Email Infrastructure
- Transactional templates (inbox notification, inbox reply) via React Email
- Suppression + unsubscribe handling, queue processor, preview function
- Public `Unsubscribe` page

### Admin
- Admin layout/sidebar, ghost case manager, gold set replay, calibration tools

---

## Routes

| Path | Page | Access |
|------|------|--------|
| `/` | `Landing` | Public |
| `/auth` | `Auth` | Public |
| `/unsubscribe` | `Unsubscribe` | Public |
| `/trust` | `Trust` | Public |
| `/security` | `Security` | Public |
| `/sub-processors` | `SubProcessors` | Public |
| `/status` | `Status` | Public |
| `/ai-governance` | `AIGovernance` | Public |
| `/app` | `Index` (mode gate) | Protected |
| `/app/dashboard` | `AppDashboard` | Protected |
| `/app/cases` | `AppCases` | Protected |
| `/app/history` | `AppHistory` | Protected |
| `/app/patterns` | `AppPatterns` | Protected |
| `/app/imaging` | `AppImaging` | Protected |
| `/app/operational` | `AppOperational` | Protected |
| `/app/revenue-integrity` | `AppRevenueIntegrity` | Protected |
| `/app/system-impact` | `AppSystemImpact` | Protected |
| `/app/inbox` | `AppInbox` | Protected |
| `/app/platform` | `AppPlatform` | Protected |
| `/app/ehr` | `AppEHR` (integration depth) | Protected |
| `/app/strategic-tools` | `AppStrategicTools` | Protected |

See [`mem://architecture/access-control`] for the public/protected split policy.

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `analyze-case` | Phase 1: extraction + 4-role SOUPY analysis |
| `analyze-v3` | Phase 2: consolidated v3 modules |
| `provider-analyze` | Provider readiness assessment |
| `pre-appeal-analyze` | Pre-appeal curability + resolution analysis |
| `psych-parse-note` | Behavioral health note parsing |
| `claim-parser` | Structured claim extraction |
| `claim-clinical-crosswalk` | Code ↔ documentation crosswalk |
| `claim-perspectives` | Multi-perspective claim review |
| `note-parse-structured` | Generic structured note parser |
| `imaging-analyze` | Imaging case analysis |
| `imaging-ftd-review` | Imaging fitness-to-defend review |
| `audit-the-auditor` | Payer denial-letter defect audit + DOI complaint draft |
| `soupy-engine` | Engine health, ghost cases, gold set, calibration, payer profiles |
| `send-transactional-email` | Outbound transactional email |
| `process-email-queue` | Email queue worker |
| `preview-transactional-email` | Template preview |
| `handle-email-suppression` | Suppression handling |
| `handle-email-unsubscribe` | Unsubscribe handling |

Shared helpers in `supabase/functions/_shared/` (`longContext.ts`, transactional email templates + registry).

---

## Key Library Modules (`src/lib/`)

| File | Purpose |
|------|---------|
| `caseIntelligence.ts` | Master signal derivation — disposition, human review gating, evidence checklist |
| `caseGovernance.ts` | Decision governance layer (severity reclassification, contradiction-aware downgrades) |
| `ruleDependency.ts` | Metadata dependency keywords for finding-basis classification |
| `caseService.ts` | Case CRUD + decision persistence |
| `soupyEngineService.ts` | Client for v3 engine features |
| `providerService.ts` / `providerReadinessEngine.ts` / `providerTypes.ts` | Provider mode |
| `psychAuditEngine.ts` / `psychTypes.ts` / `psychDemoData.ts` | Behavioral health |
| `preAppealService.ts` / `preAppealTypes.ts` | Pre-appeal resolution |
| `imagingService.ts` / `imagingCueExtractor.ts` / `imagingTypes.ts` | Imaging |
| `operationalService.ts` / `operationalTypes.ts` / `operationalMockData.ts` | Operational modules |
| `erAcuteService.ts` / `supplyService.ts` / `cdiService.ts` / `crosswalkService.ts` / `parsedClaimService.ts` / `revenueIntegrityService.ts` / `systemImpactService.ts` | Module services |
| `defensePacketBuilder.ts` | Minimal winning packet builder |
| `fileTextExtractor.ts` | Multi-format upload text extraction |
| `hl7v2Ingest.ts` | HL7 v2 ADT/DFT message parser |
| `x12Ingest.ts` | X12 837/835/277 claim + remit parser |
| `counterfactualCoding.ts` | DRG-shift $ delta + CMI impact engine |
| `contractLeakage.ts` | 835 vs fee-schedule underpayment detector |
| `regulatoryClock.ts` | State + payer appeal-deadline / clean-claim clocks |
| `denialDrift.ts` | CARC/RARC drift detection + reviewer-fingerprint clustering |
| `appealABTest.ts` | Appeal letter variant tracking + overturn outcomes |
| `documentationDebt.ts` | Per-physician documentation-debt scoring |
| `priorAuthPredictor.ts` | Per-payer prior-auth outcome predictor |
| `pdfHelpers.ts` | Standardized PDF layout helpers |
| `exportAppealPacketPDF.ts` / `exportCaseReportPDF.ts` / `exportOperationalPDF.ts` / `exportProviderCaseDetailPDF.ts` / `exportProviderReadinessPDF.ts` / `exportPlatformSummary.ts` | PDF exports |

---

## Database (high-level)

All tables RLS-protected. Major groups:

- **Core**: `audit_cases`, `case_analyses`, `case_files`, `processing_queue`
- **SOUPY v3**: `decision_traces`, `evidence_sufficiency`, `contradictions`, `confidence_floor_events`, `action_pathways`, `minimal_winning_packets`, `source_weights`, `regulatory_flags`
- **Calibration**: `ghost_cases`, `ghost_case_results`, `gold_set_cases`, `engine_calibration`, `stability_checks`, `devils_advocate_results`, `reasoning_chains`
- **Intelligence**: `payer_profiles`, `appeal_outcomes`, `case_graph_edges`, `code_combinations`
- **Email**: transactional queue, suppression list, unsubscribe tokens

Schema source of truth: `src/integrations/supabase/types.ts` (auto-generated — never edit manually).

---

## Design System

Semantic HSL tokens defined in `src/index.css` and `tailwind.config.ts`. Never hardcode colors in components.

Notable tokens: `--primary`, `--consensus`, `--disagreement`, `--violation`, `--info-blue`, `--accent`, `--destructive`, `--role-builder`, `--role-redteam`, `--role-analyst`, `--role-breaker`.

Typography: Inter (display) + JetBrains Mono (codes/scores).

---

## Architecture Constraints

- No autonomous legal conclusions — all output is operational guidance
- Human-in-the-loop enforced at every confidence boundary
- No raw chain-of-thought storage (structured decision traces only)
- Epistemic diversity: different model families per role
- Provider-safe language in provider mode; neutral enterprise tone everywhere
- Every visible button must be functional — no fake UI
- RLS on every table

---

## Getting Started

```bash
npm install
npm run dev
```

App runs at `http://localhost:8080`. Demo cases load by default; toggle to **Live** mode for database-backed cases (requires auth).

---

## Strategic Positioning

- Target: mid-size academic health systems, surgery centers, behavioral health practices
- Compliance piggybacks on provider security infrastructure
- Vendor-neutral labels everywhere — never advocate for a specific payer or vendor

---

## Changelog

Versioned record of major shipped features. Routes are app-relative; module paths are repo-relative.

### v0.9.0 — 2026-05-05 (AM batch)

**Strategic Analytical Tools** — new tabbed workspace at [`/app/strategic-tools`](src/pages/AppStrategicTools.tsx):

| Feature | Module / Edge | Notes |
|---------|---------------|-------|
| Audit the Auditor | [`supabase/functions/audit-the-auditor/`](supabase/functions/audit-the-auditor/index.ts) | Audits payer denial letters for medical-policy misapplication, ERISA defects, prompt-pay violations; drafts state-DOI complaint. Gemini 2.5 Flash. **Copy JSON** export. |
| Counterfactual Coding | [`src/lib/counterfactualCoding.ts`](src/lib/counterfactualCoding.ts) | DRG-shift detection (Sepsis/Bacteremia, AKI specificity, etc.) with $ delta + CMI impact. **CSV** export. |
| Contract Leakage Detector | [`src/lib/contractLeakage.ts`](src/lib/contractLeakage.ts) | X12 835 vs reference fee schedule; underpayment + silent-denial flagging by CPT. **CSV** export. |
| Regulatory Clock Tracker | [`src/lib/regulatoryClock.ts`](src/lib/regulatoryClock.ts) | State-specific (30+) and payer-specific (ERISA, MA, Medicaid MCO) appeal + clean-claim deadlines. **CSV** export. |
| Denial Drift + Reviewer Fingerprinting | [`src/lib/denialDrift.ts`](src/lib/denialDrift.ts) | CARC/RARC drift (last-30d vs prior-30d) + boilerplate-signature reviewer clustering. Two **CSV** exports. |
| Appeal Letter A/B Testing | [`src/lib/appealABTest.ts`](src/lib/appealABTest.ts) | Per (payer, denial-reason) variant tracking with overturn outcomes + lift. **CSV** export. |
| NCD/LCD Alerts | [`src/lib/ncdLcdAlerts.ts`](src/lib/ncdLcdAlerts.ts) | Recent CMS coverage changes correlated to provider code mix; retroactive recoupment risk surfaced. **CSV** export. |
| Documentation Debt Scoring | [`src/lib/documentationDebt.ts`](src/lib/documentationDebt.ts) | Per-physician 12-month debt + CMI opportunity + trend. **CSV** export. |
| Prior-Auth / Outcome Predictor | [`src/lib/priorAuthPredictor.ts`](src/lib/priorAuthPredictor.ts) | Per-payer PA outcome prediction with strength/weakness factors and remediation. **Copy JSON** export. |

**Integration Depth** — new workspace at [`/app/ehr`](src/pages/AppEHR.tsx):

| Feature | Module | Notes |
|---------|--------|-------|
| HL7 v2 ingest (ADT/DFT/ORM/ORU) | [`src/lib/hl7v2Ingest.ts`](src/lib/hl7v2Ingest.ts) | Pipe-delimited parser; MSH/PID/PV1/DG1/PR1/FT1; normalized into shared internal shape. |
| X12 EDI ingest (837/835/277) | [`src/lib/x12Ingest.ts`](src/lib/x12Ingest.ts) | CAS adjustment reasons feed appeal-defense module. |
| FHIR Bulk `$export` (file-based) | [`src/lib/fhirIngest.ts`](src/lib/fhirIngest.ts) | NDJSON ingestion from Epic/Cerner/MEDITECH. |
| SMART-on-FHIR launch posture | EHR Standards tab | Documented and roadmapped against existing FHIR normalizer. |
| SAML 2.0 SSO + SCIM posture | EHR Connectors tab | Native SAML available; SCIM scoped for first enterprise contract. |
| EHR connectivity matrix | EHR Connectors tab | 12-vendor matrix (Epic, Cerner, athena, MEDITECH, eCW, NextGen, …) with status badges + **CSV** export. |

**AI Governance** — public trust surface at [`/ai-governance`](src/pages/AIGovernance.tsx):

- Per-agent **model cards** (provider, version, eval scores, known failure modes)
- "No PHI used for training" attestation
- Hallucination rate / confidence calibration metrics
- Documented human-in-the-loop checkpoints
- Prompt-injection defenses
- NIST AI RMF + ISO 42001 alignment statement
- Linked from [`Trust`](src/pages/Trust.tsx) and registered in [`src/App.tsx`](src/App.tsx)

**UX polish**

- Strategic Tools and EHR tab strips converted to horizontal-scroll `flex-nowrap` to fix label run-off at all viewports.
- Standardized export affordances (CSV / Copy JSON) on every panel that produces structured output.

---

## License

Proprietary — All rights reserved.

*Built with [Lovable](https://lovable.dev)*