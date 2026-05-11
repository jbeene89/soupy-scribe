---
name: HIPAA Compliance Stack
description: Tables, components, and controls supporting HIPAA Technical Safeguards
type: feature
---

## Tables
- `phi_access_log` — append-only audit trail (§164.312(b)). Users insert/read own; admins read all via `is_soupy_admin`.
- `phi_policy_acknowledgements` — per-user acceptance of the PHI policy. Versioned by `POLICY_VERSION` constant.

## Code
- `src/lib/deidentify.ts` — Safe Harbor scrub. `deidentify(text)` returns redacted text + counts. `detectPHI(text)` is scan-only.
- `src/lib/phiAccessLog.ts` — `logPhiAccess({resourceType, resourceId, action})` fire-and-forget. Call from any service touching PHI.
- `src/components/compliance/PHIAcknowledgmentGate.tsx` — wraps `/app/*`. Blocks until user accepts current policy version.
- `src/components/compliance/IdleTimeoutGuard.tsx` — 15-minute idle auto-sign-out, with 60s warning dialog.
- `src/pages/AppCompliance.tsx` — `/app/compliance` route showing controls + user's own access log.

## Auth config
- `password_hibp_enabled = true`
- `auto_confirm_email = false` (real email verification required)
- `external_anonymous_users_enabled = false`

## When adding new PHI-touching surface
1. Wrap reads/writes with `await logPhiAccess({...})`.
2. If sending text to LLMs, run `deidentify()` first or document a Safe Harbor exception.
3. Add the table to RLS audit list if it stores patient data.

## Bump policy version
Edit `POLICY_VERSION` in `PHIAcknowledgmentGate.tsx` to force re-acknowledgment after material policy changes.