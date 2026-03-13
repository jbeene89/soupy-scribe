SOUPY Engine v3 architecture: 2-phase pipeline, 12 modules, edge functions split for timeout prevention

## Pipeline Architecture (2-phase)
- **Phase 1** (`analyze-case`): Extract + 4-role parallel analysis (Builder, Red Team, Analyst, Breaker) + store analyses + initial consensus/risk scores
- **Phase 2** (`analyze-v3`): Drift check + Consensus Integrity (DA) + Evidence Sufficiency + Contradictions + Confidence Floors + Decision Trace + Action Pathway + Minimal Winning Packet + Calibration + Physician Fingerprint
- Client chains Phase 2 after Phase 1 in `caseService.ts::runSOUPYAnalysis()`

## Edge Functions
- `analyze-case` — Phase 1: extract + 4-role analysis (was 1162 lines, now ~740)
- `analyze-v3` — Phase 2: v3 modules (drift, CI, evidence, contradictions, floors, trace, pathway, packet, calibration)
- `soupy-engine` — Engine ops/health/ghost/gold/calibrate/payer
- `provider-analyze` — Provider mode analysis (302 lines)

## V3 Module Tables (populated by analyze-v3)
- evidence_sufficiency, contradictions, decision_traces, action_pathways
- confidence_floor_events, minimal_winning_packets, engine_calibration
- devils_advocate_results, stability_checks

## Key Design Decisions
- Split at Phase 1→2 boundary to avoid Deno edge function timeout (~60s)
- Phase 2 is non-fatal — if it fails, Phase 1 results still display
- V3 data is cleaned (DELETE + INSERT) on re-run to prevent stale duplicates
- Drift uses gemini-2.5-flash-lite (cheapest); CI uses gpt-5 (strongest)
