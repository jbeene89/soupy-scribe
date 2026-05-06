---
name: Policy Time Versioning
description: Versioned payer policy library (LCD/NCD/MA/commercial) with effective_start/end ranges, used by the Policy Time Machine to auto-resolve the active-on-DOS version
type: feature
---
Tables: `payer_policies` (one row per logical policy per user; unique on user_id+policy_id+COALESCE(payer,'')), `payer_policy_versions` (effective_start required, effective_end nullable=current). RLS owner-scoped.
Resolver: `effective_start <= dos AND (effective_end IS NULL OR effective_end >= dos)` ordered by effective_start DESC.
`policy_timeline_checks` now has `library_policy_id` and `policy_version_id` to link a saved check to the resolved version.
UI: `/app/policy-library` manages policies + versions; `/app/policy-time-machine` has a "Resolve from Library" button that auto-fills cited (current) + active-on-DOS text/version/date.
