---
name: Recovery Cockpit
description: Multi-lens revenue recovery orchestrator and cockpit page that runs every leak-detection module in parallel and ranks findings by recoverable dollars
type: feature
---
Revenue Recovery Cockpit at `/app/recovery` (Experimental sidebar group).

Architecture:
- `recovery-engine` edge function fans out N "lenses" in parallel via Promise.allSettled, each calling Lovable AI Gateway with a lens-specific system prompt and shared JSON finding schema. Default lenses: hcc, cdi, counterfactual, modifier, bundling, contract, clawback_exposure, policy_time, supply.
- Synthesizer clusters findings by `code:<normalized>` or `title:<normalized>` and marks the max-$ row as `is_primary_in_cluster=true`. Only primaries count toward the run rollup → no double-counting when CDI + Counterfactual + HCC all surface the same Dx.
- Tables: `recovery_runs` (rollup totals, lenses_run, status, encounter_excerpt) and `recovery_findings` (per-finding with lens, category, $ at risk, $ recoverable, dedup_cluster_key, is_primary_in_cluster, resolved). Standard RLS by user_id.
- Service: `src/lib/recoveryService.ts`. Page: `src/pages/AppRecovery.tsx`.

Existing per-module pages (HCC Sweep, Clawback Shield, Policy Time Machine, Revenue Integrity, etc.) remain untouched and are still sold independently. The cockpit is purely additive — it does NOT replace them.

**Why:** "Revenue recovery" wedge — single surface that watches every dollar that could be missed, undercoded, underpaid, or clawed back. Same trust story as SOUPY v3: adversarial multi-perspective, every dollar gets N independent eyes.