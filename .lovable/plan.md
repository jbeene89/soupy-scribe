

## Plan: Clean Up Landing Page & Persistent Upload Button

### What changes

1. **Remove salesy sections from ModeSelectionGate** — Delete the `PilotPipeline`, `ROICalculator`, and `PricingSection` imports and renders. Keep only the mode selection cards and neutrality statement.

2. **Make Upload Case button always visible in header** — Remove the `AuthGate hide` wrapper around `CaseUpload` and `ProviderCaseUpload` in `Index.tsx` header. Instead, show the button always and handle auth prompting inside the upload flow (prompt sign-in when they actually try to submit, not before they can even see the button).

### Files modified
- `src/components/ModeSelectionGate.tsx` — Remove PilotPipeline, ROICalculator, PricingSection
- `src/pages/Index.tsx` — Unwrap CaseUpload/ProviderCaseUpload from AuthGate

### Technical detail
- The `AuthGate hide` wrapper currently prevents the upload buttons from rendering at all for unauthenticated users. Removing it makes the button visible; the upload flow itself can check `isAuthenticated` and show SignInDialog if needed before submitting.

