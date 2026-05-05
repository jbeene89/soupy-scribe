---
name: EHR Integration
description: FHIR Bundle/NDJSON ingestion + EHR Integration page covering connectors, security, pilot path
type: feature
---
EHR support is real and pilot-grade as of this build.

## What works today
- `src/lib/fhirIngest.ts` — schema-tolerant FHIR R4 normalizer (Bundle, NDJSON, single resource). Handles Patient, Encounter, Coverage, Condition, Procedure, Observation, Claim, ExplanationOfBenefit, MedicationRequest, DocumentReference (decodes base64 narrative), DiagnosticReport, ServiceRequest.
- `fileTextExtractor.ts` auto-detects FHIR `.json`/`.ndjson` and normalizes before any pipeline. Provider, Psych, and Payer upload paths all benefit transparently.
- `src/lib/fhirSampleBundle.ts` — Synthea-style fictitious bundle with sepsis + ARF (CC/MCC capture demo), denied EOB line (CO-50), and embedded progress note. Downloadable via `downloadSyntheticFhirBundle()`.
- `src/pages/AppEHR.tsx` — `/app/ehr` route. 5 tabs: Ingest & Try (live parser), Resources, Connectors matrix, Security posture, Pilot Path. Real working file upload + paste + sample button.
- Sidebar: "EHR Integration" added under Experimental.

## What's labeled roadmap (do not claim as available)
- Live SMART-on-FHIR OAuth2 against production Epic / Cerner (requires App Orchard / Code Console membership).
- HL7 v2 → FHIR converter.
- C-CDA → FHIR converter.

## Honest framing in outreach
"Ingests FHIR R4 EHR exports (Bundle / NDJSON from Epic, Cerner, Athena, MEDITECH) — Patient, Encounter, Claim, EOB, Condition, Procedure, Observation, and embedded clinical narratives." Live API integrations are pilot-by-pilot.
