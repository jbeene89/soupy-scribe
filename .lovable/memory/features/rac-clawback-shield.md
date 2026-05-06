---
name: RAC Clawback Shield
description: Bulk retroactive audit defense module — ingests claims roster, runs adversarial defense per claim, attacks RAC extrapolation math, exports settlement-leverage packet
type: feature
---
RAC Clawback Shield — vendor-targeted weapon (primary target: Cotiviti).

## Tables
- clawback_audits — one per RAC audit (contractor, demand, N, n, stratification)
- clawback_claims — contested claims (defense_strength: full_defense|strong|partial|weak|conceded|pending)
- clawback_extrapolation — CMS Ch.8 compliance + recomputed point estimate + 90% LCB + leverage_score
- clawback_defense_packets — generated packet PDFs

## Storage
clawback-files bucket, private, user-scoped folders.

## Edge functions
- clawback-ingest: parse CSV roster, create audit + claims rows
- clawback-analyze-claim: per-claim adversarial defense via google/gemini-2.5-flash, JSON output, calibrated strength scale
- clawback-extrapolation-attack: CMS MPIM Ch.8 compliance check (universe, sample size, stratification, RAT-STATS seed), recomputes point estimate + one-sided 90% lower confidence bound using t-distribution from per-claim defense outcomes, computes leverage score (0-100)

## Statistical method
- defense_strength → credit (full=1.0, strong=0.85, partial=0.5, weak=0.2, conceded=0.0, pending=0.3)
- per-claim remaining_overpayment = disallowed × (1 - credit)
- extrapolated point estimate = mean × N
- 90% LCB = (mean - t_{0.10,n-1} × SE) × N → defensible settlement floor
- leverage_score weights high-severity procedural defects most heavily (one defect can void the whole extrapolation)

## UI
/app/clawback-shield — list + intake, detail view with stats cards, CMS compliance grid, defects, claim roster with chart upload, packet PDF export.
Sidebar entry under Experimental.
