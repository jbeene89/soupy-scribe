---
name: Auto-Generated Appeal Drafts
description: Per-violation appeal defense drafts with role-specific rationales (builder/redteam/analyst/breaker)
type: feature
---
Edge function `generate-appeal-drafts` produces a structured appeal draft for each flagged CodeViolation:
- letterBody (4–8 paragraphs, neutral provider-to-payer voice)
- roleRationales for all 4 SOUPY roles, each operationally distinct
- supportingEvidence list, rebuttalToPayer, confidence 0–100, keyAuthorities

Stored at `audit_cases.metadata.appealDrafts.drafts[code|type]`. Service: `src/lib/appealDraftService.ts`. UI: `AppealDraftsPanel` mounted as the "Appeal Drafts" tab in `AuditDetail`. Generation requires a live (saved) case — disabled in demo mode. Per-violation Generate / Regenerate plus bulk "Generate Missing" / "Regenerate All". Drafts copyable to clipboard and exportable as plain text.
