SOUPY Engine v3 architecture: 2-phase pipeline, 12 modules, edge functions split for timeout prevention

## Pipeline Architecture (2-phase)
- **Phase 1** (`analyze-case`): Extract + 4-role parallel analysis (Builder, Red Team, Analyst, Breaker) + store analyses + initial consensus/risk scores
- **Phase 2** (`analyze-v3`): Drift check + Consensus Integrity (DA) + Evidence Sufficiency + Contradictions + Confidence Floors + Decision Trace + Action Pathway + Minimal Winning Packet + Calibration + Physician Fingerprint
- Client chains Phase 2 after Phase 1 in `caseService.ts::runSOUPYAnalysis()`

## Edge Functions
- `analyze-case` — Phase 1: extract + 4-role analysis (~735 lines)
- `analyze-v3` — Phase 2: v3 modules (drift, CI, evidence, contradictions, floors, trace, pathway, packet, calibration)
- `soupy-engine` — Engine ops/health/ghost/gold/calibrate/payer
- `provider-analyze` — Provider mode analysis (302 lines)
- `pre-appeal-analyze` — Pre-appeal resolution analysis (generates curability, issues, evidence checklist, dispositions)

## V3 Module Tables (populated by analyze-v3)
- evidence_sufficiency, contradictions, decision_traces, action_pathways
- confidence_floor_events, minimal_winning_packets, engine_calibration
- devils_advocate_results, stability_checks

## Key Design Decisions
- Split at Phase 1→2 boundary to avoid Deno edge function timeout (~60s)
- Phase 2 is non-fatal — if it fails, Phase 1 results still display
- V3 data is cleaned (DELETE + INSERT) on re-run to prevent stale duplicates
- Drift uses gemini-2.5-flash-lite (cheapest); CI uses gpt-5 (strongest)
- Payer adversarial tuning: already wired in analyze-case lines 598-601 — injects payer_profiles.adversarial_prompt_additions into Red Team prompt when payerCode is passed
- Pre-appeal resolution stored in audit_cases.metadata.preAppealResolution
- Provider review stored in audit_cases.metadata.providerReview

## Wiring Status (as of 2026-03-15)
- Provider mode: LIVE — providerService.ts computes dashboard stats from live reviews, ProviderCaseDetail uses only live data
- Pre-appeal: LIVE — pre-appeal-analyze edge function, both payer and provider views can trigger it
- Payer adversarial: WIRED — runSOUPYAnalysis accepts optional payerCode param
- Mock data files still exist but only used in Demo mode
