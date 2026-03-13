# Lyric AI — SOUPY Payment Integrity Platform

> Multi-model AI consensus engine for healthcare payment integrity, provider readiness, and pre-appeal resolution.

Built on React + TypeScript + Vite + Tailwind CSS + shadcn/ui with Lovable Cloud (Supabase) backend.

---

## Table of Contents

- [Overview](#overview)
- [Dual-Mode Architecture](#dual-mode-architecture)
- [SOUPY Engine v3](#soupy-engine-v3)
- [Case Intelligence Module](#case-intelligence-module)
- [Pre-Appeal Resolution](#pre-appeal-resolution)
- [Database Schema](#database-schema)
- [Edge Functions](#edge-functions)
- [File Structure](#file-structure)
- [Design System](#design-system)
- [Getting Started](#getting-started)

---

## Overview

Lyric AI is a healthcare payment integrity platform that uses **SOUPY** (Structured Orchestrated Unified Perspective Yielder) — a multi-model AI consensus engine — to analyze medical claims through four specialized adversarial roles. The platform supports two operational modes (Payer and Provider), generates defensible audit-ready documentation, and enforces human-in-the-loop safeguards at every confidence boundary.

### Key Capabilities

- **4-role adversarial AI analysis** with optional Devil's Advocate 5th pass
- **Consensus scoring** across model families (Gemini + GPT)
- **Curable vs non-curable classification** for every case
- **Dynamic evidence checklists** generated from case-specific violations and risk factors
- **Human review gating** with 8 trigger conditions
- **Structured JSON + PDF export** packages
- **Payer-specific adversarial tuning** with denial pattern injection
- **Ghost case injection** and **gold set replay** for engine calibration
- **Decision trace auditing** (structured entries, no raw chain-of-thought)

---

## Dual-Mode Architecture

### Payer Mode (`payment-integrity` | `compliance-coaching`)

The payer-facing mode supports two postures:

| Posture | Focus |
|---------|-------|
| **Payment Integrity** | Risk identification, violation detection, audit defense |
| **Compliance Coaching** | Proactive documentation guidance, clean claim rate improvement |

**Tabs:** Case Queue → Audit Detail → Pattern Analysis → Value Demo → Lyric Enhancement → AI Integration → Platform Value → Case History

### Provider Mode

Provider-facing readiness assessment with education-first language:

- **Documentation sufficiency** scoring (strong / moderate / weak / insufficient)
- **Coding vulnerability** detection with corrective guidance
- **Appeal viability** assessment with effort/success estimates
- **Evidence readiness** checklists (required / helpful / unlikely-to-help)
- **Recurring issue** identification for staff education

**Tabs:** Dashboard → Case Reviews → Education Insights

---

## SOUPY Engine v3

### Roles & Models

| Role | Model | Purpose |
|------|-------|---------|
| **Builder** | `google/gemini-2.5-flash` | Optimistic — best-case interpretation |
| **Red Team** | `openai/gpt-5-mini` | Critical — weakness and risk identification (+ payer adversarial injection) |
| **Systems Analyst** | `google/gemini-2.5-pro` | Structural — regulatory and systemic analysis |
| **Frame Breaker** | `openai/gpt-5-mini` | Unconventional — challenges assumptions |
| **Devil's Advocate** | `openai/gpt-5` | 5th pass — attacks consensus (Consensus Integrity Engine) |
| **Drift Check** | `google/gemini-2.5-flash-lite` | Stability — cheapest model for prompt-order variance |

### 12 Consolidated Modules

1. **Consensus Integrity Engine** — Merged adversarial self-doubt + epistemic diversity + consensus stress testing. DA pass attacks the 4-role consensus; if it breaks, triggers reanalysis.
2. **Decision Trace** — Structured audit-ready reasoning entries per case. Never stores raw chain-of-thought.
3. **Evidence Sufficiency Score** — Separate from risk; calculates sufficiency for each outcome path (approve / deny / pend / appeal defense / appeal not recommended).
4. **Contradiction Detector** — Identifies code-vs-documentation, modifier, time, and diagnosis inconsistencies across case materials.
5. **Confidence Floor Enforcement** — Routes to human when confidence (<40%), consensus (<35%), or evidence (<30%) breach thresholds. Logs uncertainty drivers.
6. **Regulatory Currency Monitor** — Flags CMS / AMA / LCD / NCD changes within 90 days of date of service. Admin-managed, awareness-only.
7. **Action Pathway Recommender** — Recommends operational actions: approve, pend for records, modifier clarification, admin correction, route to human, build pre-appeal, not recommended for appeal.
8. **Minimal Winning Packet Builder** — Identifies the smallest set of documentation needed to move a case from weak → defensible.
9. **Source Reliability Weighting** — Weighted trust by source type (operative note = 1.0, billing summary = 0.5, admin data = 0.3) with recency decay.
10. **Physician Behavioral Fingerprint** — Pattern intelligence: code frequency, risk trends, rejection rates, cross-case graph connections.
11. **Payer-Specific Adversarial Tuning** — Per-payer denial pattern injection into Red Team analysis. Seeded with UHC, Anthem, Aetna, Cigna, Humana profiles.
12. **Appeal Outcome Memory** — Tracks rebuttal, evidence strategy, and success/failure rates by payer and denial type.

### Engine Safeguards

- Human-in-the-loop preserved at all decision boundaries
- No autonomous legal conclusions — all outputs are "operational guidance only"
- Regulatory flags are "awareness flags, not legal completeness guarantees"
- Confidence floor breaches always route to human review

---

## Case Intelligence Module

**File:** `src/lib/caseIntelligence.ts`

Centralized logic ensuring consistent case status across all views. Every component that displays case signals MUST use this module.

### Exports

| Function | Purpose |
|----------|---------|
| `deriveCaseSignals()` | Master function — returns risk, consensus, confidence, disposition, human review triggers, review complexity |
| `classifyDisposition()` | 5-state classification: defensible now, curable with documentation, admin fix only, human review required, not defensible |
| `evaluateHumanReviewGating()` | 8 trigger conditions for human escalation |
| `evaluateExportReadiness()` | 4-state readiness: ready, conditional, incomplete, not ready |
| `generateDynamicEvidenceChecklist()` | Builds evidence items from violations, risk factors, and missing documentation |
| `buildStructuredExportPackage()` | Structured JSON export with full case analysis |
| `deriveActionPath()` | Derives recommended action for mock/non-live cases |
| `classifyEvidenceImpact()` | Tiers evidence as critical / supporting / low value |
| `isEvidenceLikelyCurable()` | Determines if an evidence gap is curable |

### Case Disposition States

| State | Meaning |
|-------|---------|
| `defensible_now` | Current documentation sufficiently supports the claim |
| `curable_with_documentation` | Specific records can resolve identified gaps |
| `admin_fix_only` | Issues are clerical corrections, not clinical deficiencies |
| `human_review_required` | Automated analysis cannot render a confident determination |
| `not_defensible` | Structural issues make the case unlikely to survive appeal |

### Human Review Triggers (8 conditions)

1. High divergence across AI models (consensus < 50%)
2. Low analysis confidence (< 60%)
3. ≥2 critical contradictions
4. Evidence sufficiency critically low (< 40%)
5. Confidence floor breached
6. Engine action pathway flags human review
7. Critical risk + low data completeness (< 65%)
8. ≥2 determinative risk factors triggered with model disagreement

---

## Pre-Appeal Resolution

**Types:** `src/lib/preAppealTypes.ts`

A resolution pathway between denial and formal appeal:

- **Curability assessment** — curable-with-records, curable-with-coding, partial, structurally-weak, formal-appeal-appropriate, not-likely-supportable
- **Issue classification** — 9 categories (missing documentation, coding clarification, modifier support, etc.)
- **Rapid resolution checklist** — prioritized evidence items with appeal-push indicators
- **Provider submission builder** — structured cover note, coding explanation, supporting doc checklist
- **Payer response simulation** — resolved, partial, additional records, uphold denial, route to appeal

---

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `audit_cases` | Main case records with CPT/ICD codes, claim amounts, risk scores, decisions |
| `case_analyses` | Per-role AI analysis results (confidence, violations, insights, assessments) |
| `case_files` | Uploaded documents with extraction status |
| `processing_queue` | Async processing status tracking |

### SOUPY Engine Tables

| Table | Purpose |
|-------|---------|
| `decision_traces` | Structured audit-ready reasoning per case |
| `evidence_sufficiency` | Sufficiency scores for each outcome path |
| `contradictions` | Detected inconsistencies across case materials |
| `confidence_floor_events` | Logged confidence/consensus/evidence floor breaches |
| `action_pathways` | Engine-recommended actions with rationale |
| `minimal_winning_packets` | Smallest documentation sets to make cases defensible |
| `source_weights` | Trust weights by source type with recency decay |
| `regulatory_flags` | Active CMS/AMA/LCD/NCD change flags |

### Calibration & Quality Tables

| Table | Purpose |
|-------|---------|
| `ghost_cases` | Synthetic known-answer cases for engine testing |
| `ghost_case_results` | Engine accuracy per ghost case injection |
| `gold_set_cases` | Locked reference cases for regression testing |
| `engine_calibration` | Predicted vs actual outcome tracking |
| `stability_checks` | Prompt-order variance (drift) detection |
| `devils_advocate_results` | Consensus integrity — did the DA break consensus? |
| `reasoning_chains` | Per-role reasoning forensics |

### Intelligence Tables

| Table | Purpose |
|-------|---------|
| `payer_profiles` | Per-payer denial patterns, appeal success rates, behavioral notes |
| `appeal_outcomes` | Historical appeal results by strategy and payer |
| `case_graph_edges` | Cross-case relationships for physician pattern detection |
| `code_combinations` | Flagged code combination analysis |

---

## Edge Functions

### `analyze-case` (1162 lines)

Main SOUPY pipeline. Two actions:

- **`extract`** — Parses raw case text via AI, creates `audit_cases` record with extracted CPT/ICD codes, claim amounts, and metadata
- **`analyze`** — Runs full 4-role SOUPY analysis plus all v3 modules (consensus integrity, evidence sufficiency, contradictions, confidence floors, decision trace, action pathway, minimal winning packet, source weighting, regulatory checks)

### `soupy-engine` (494 lines)

Engine operations and health:

- `engine-health` — Returns accuracy rates, stability metrics, consensus integrity, module status
- `list-ghost-cases` / `inject-ghost` / `validate-ghost` — Ghost case management
- `list-gold-set-cases` / `replay-gold-set` — Gold set regression testing
- `calibrate` — Submit actual outcomes for calibration tracking
- `physician-profile` — Behavioral fingerprint for a physician
- `list-payer-profiles` — Payer adversarial tuning profiles

### `provider-analyze` (302 lines)

Provider-mode analysis:

- **`extract`** — Same as analyze-case extract, but creates case with provider context
- **`analyze`** — Readiness assessment with provider-safe language (documentation insufficiency, coding vulnerability, support gap)

---

## File Structure

```
src/
├── App.tsx                              # Router + providers
├── main.tsx                             # Entry point
├── index.css                            # Design system tokens (HSL)
│
├── pages/
│   ├── Index.tsx                         # Main app — dual-mode, tabs, case management
│   ├── Auth.tsx                          # Auth page
│   └── NotFound.tsx                      # 404
│
├── lib/
│   ├── types.ts                         # Core types (AuditCase, RiskScore, AIRoleAnalysis, etc.)
│   ├── caseService.ts                   # Case CRUD + decision persistence
│   ├── caseIntelligence.ts              # Centralized case signals, disposition, human review gating
│   ├── soupyEngineService.ts            # Client service for all v3 engine features
│   ├── providerTypes.ts                 # Provider mode types
│   ├── providerService.ts              # Provider analysis service
│   ├── providerMockData.ts             # Mock provider reviews
│   ├── preAppealTypes.ts               # Pre-appeal resolution types
│   ├── preAppealMockData.ts            # Mock pre-appeal data
│   ├── mockData.ts                      # Demo cases, patterns, SOUPY config
│   ├── cptCodeInfo.ts                   # CPT code reference data
│   ├── exportPlatformSummary.ts        # PDF export
│   └── utils.ts                         # Tailwind merge utility
│
├── components/
│   ├── AuditDetail.tsx                  # Full case detail — violations, evidence, disposition, decisions
│   ├── CaseQueue.tsx                    # Case list with risk/complexity columns
│   ├── CaseUpload.tsx                   # Multi-file/folder/ZIP upload with batch processing
│   ├── AIRoleCard.tsx                   # Per-role analysis display
│   ├── ConsensusMeter.tsx               # Visual consensus score
│   ├── RiskIndicator.tsx                # Risk level display
│   ├── EvidenceChecklist.tsx            # Tiered evidence items
│   ├── CPTCodeBadge.tsx                 # CPT code with tooltip info
│   ├── ComparisonView.tsx               # Before/after value demonstration
│   ├── PatternAnalysis.tsx              # Physician pattern detection
│   ├── AuditPostureToggle.tsx           # Payment integrity ↔ compliance coaching
│   ├── SOUPYConfigDialog.tsx            # Model selection per role
│   ├── PresentationMode.tsx             # Sales presentation mode
│   ├── AuthGate.tsx                     # Auth wrapper + sign-in dialog
│   ├── IntegrationArchitecture.tsx      # Architecture diagram
│   ├── LyricAIIntegration.tsx           # AI integration showcase
│   ├── LyricProductComparison.tsx       # Product comparison
│   ├── PlatformValueCard.tsx            # Platform value metrics
│   │
│   ├── spark/                           # Decision + export components
│   │   ├── DecisionPanel.tsx            # Approve/reject/info-request with persistence
│   │   ├── EnhancedAppealSummary.tsx    # Appeal summary with JSON export
│   │   ├── CodeCombinationAnalysisCard.tsx
│   │   ├── PayerExportDialog.tsx        # Payer-formatted export
│   │   ├── PayerTemplateInfo.tsx
│   │   ├── CaseCard.tsx
│   │   └── LoadingState.tsx
│   │
│   ├── pre-appeal/                      # Pre-appeal resolution components
│   │   ├── PreAppealResolutionTab.tsx   # Main tab (payer + provider views)
│   │   ├── CurabilityBadge.tsx
│   │   ├── DispositionCard.tsx
│   │   ├── IssueClassification.tsx
│   │   ├── PayerReviewPanel.tsx
│   │   ├── ProviderSubmissionBuilder.tsx
│   │   ├── RapidResolutionChecklist.tsx
│   │   ├── ResolutionLikelihoodCard.tsx
│   │   └── ResolutionSummary.tsx
│   │
│   ├── provider/                        # Provider mode components
│   │   ├── ProviderDashboard.tsx
│   │   ├── ProviderCaseDetail.tsx       # Provider case view with disposition parity
│   │   ├── ProviderCaseReview.tsx
│   │   ├── ProviderCaseUpload.tsx
│   │   ├── ProviderPacket.tsx           # Appeal assessment packet
│   │   ├── EvidenceReadinessChecklist.tsx
│   │   ├── EducationInsights.tsx
│   │   └── AppModeToggle.tsx
│   │
│   └── ui/                              # shadcn/ui primitives
│
├── hooks/
│   ├── useAuth.tsx                      # Auth provider + hook
│   ├── use-mobile.tsx                   # Mobile breakpoint detection
│   └── use-toast.ts                     # Toast hook
│
└── integrations/supabase/
    ├── client.ts                        # Auto-generated Supabase client
    └── types.ts                         # Auto-generated database types

supabase/
├── config.toml                          # Supabase project config
├── functions/
│   ├── analyze-case/index.ts            # Main SOUPY pipeline (1162 lines)
│   ├── soupy-engine/index.ts            # Engine ops & health (494 lines)
│   └── provider-analyze/index.ts        # Provider readiness analysis (302 lines)
└── migrations/                          # Database migrations
```

---

## Design System

### Semantic Color Tokens (HSL)

| Token | Usage |
|-------|-------|
| `--primary` | Brand, primary actions |
| `--consensus` | Agreement, defensible, approved states |
| `--disagreement` | Split opinion, curable, warnings |
| `--violation` | Critical violations, human review |
| `--info-blue` | Informational, admin-fix, moderate |
| `--accent` | SOUPY branding, interactive elements |
| `--destructive` | Not defensible, rejected |
| `--role-builder` | Builder role color |
| `--role-redteam` | Red Team role color |
| `--role-analyst` | Systems Analyst role color |
| `--role-breaker` | Frame Breaker role color |

### Typography

- **Display:** Inter (via `@fontsource/inter`)
- **Monospace:** JetBrains Mono (via `@fontsource/jetbrains-mono`) — used for case numbers, CPT codes, scores

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:8080`.

### Demo Mode

The app includes demo cases with mock data by default. Toggle to **Live** mode to use database-backed cases (requires authentication).

### Authentication

Sign up/sign in via the header. Required for:
- Uploading cases
- Running SOUPY analysis
- Making audit decisions
- Accessing live database cases

---

## Architecture Constraints

- **No autonomous legal conclusions** — all AI outputs are operational guidance
- **Human-in-the-loop** — enforced at every confidence boundary
- **No raw chain-of-thought storage** — decision traces use structured entries only
- **Epistemic diversity** — different model families (Gemini + GPT) for different roles
- **Provider-safe language** — provider mode uses education-first terminology
- **RLS-protected** — all database tables use row-level security policies

---

## License

Proprietary — All rights reserved.

---

*Built with [Lovable](https://lovable.dev)*
