SOUPY Engine v3 is 100% core functionality complete for enterprise pilots.

## Pipeline Architecture (2-Phase)
To prevent Deno edge function timeouts, analysis is split into two phases:
- **Phase 1 (analyze-case)**: Handles extraction and 4-role parallel adversarial analysis (Builder, Red Team, Analyst, Breaker).
- **Phase 2 (analyze-v3)**: Populates consolidated modules including Drift, Consensus Integrity, Evidence Sufficiency, Contradictions, Confidence Floors, Decision Traces, and Action Pathways.

## Decision Governance Layer (v2)
Added `src/lib/caseGovernance.ts` — separates six concepts:
1. **Claim Risk Score** — aggregate case-level risk (0-100)
2. **Finding Severity** — per-violation governed severity with metadata guards
3. **Automation Confidence** — engine's confidence minus contradiction penalties
4. **Evidence Sufficiency** — completeness of supporting documentation
5. **Consensus Integrity** — cross-model agreement quality (renamed from "Split Opinion" → "Moderate Agreement")
6. **Final Recommended Action** — synthesized routing decision

### Severity Reclassification Rules
- Findings dependent on missing metadata (separate TIN, missing MAR, consultant note, etc.) CANNOT be "critical confirmed"
- Reclassified as: Critical Pending Verification, High-Risk Documentation Gap, Needs Payer/Entity Validation, Documentation Deficiency
- Only findings with direct rule conflict + sufficient evidence = confirmed critical

### Contradiction-Aware Downgrades
- Critical contradictions: -12 consensus integrity, -8 automation confidence each
- Warning contradictions: -5 consensus, -3 confidence each
- Contradictions + evidence <50% = mandatory human review
- 2+ critical contradictions = mandatory human review
- All downgrades shown in plain language in GovernancePanel

### Edge Function Severity Guard
- `analyze-case` now distinguishes confirmed vs pending criticals at scoring time
- Confirmed criticals: 30 pts, Pending criticals: 15 pts (halved weight)

### Routing Thresholds
- Evidence sufficiency floor: 50%
- Consensus integrity floor: 45%
- Automation confidence floor: 55%
- Max contradictions for auto: 1
- Max pending criticals for auto: 1

## Risk Scoring & Logic
- **Formula**: `10 + (confirmedCriticals * 30) + (pendingCriticals * 15) + (warnings * 8) + consensusPenalty + confidencePenalty`
- **Thresholds**: Critical (75+), High (55+), Medium (35+), Low (<35)

## UI Components
- `GovernancePanel.tsx` — transparent routing logic with signal grid, contradiction adjustments, governed findings
- Integrated into AuditDetail between Human Review Alert and Action Pathway Banner
