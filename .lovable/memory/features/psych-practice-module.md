---
name: Psych Practice Module
description: Pre-submission audit and denial defense module for psychological/psychiatric private practices, with deep telehealth-only practice support
type: feature
---

## Telehealth-Specific Audit Checks (7 new)
1. **POS 02 vs 10** — warns when using facility POS 02 instead of patient-at-home POS 10 (post-2022 rules)
2. **Audio-only billing** — flags standard therapy codes (90834/90837) used for phone-only sessions
3. **Interstate licensing** — critical flag when patient state differs from provider state
4. **Platform documentation** — warns if HIPAA-compliant platform not documented
5. **Crisis/safety plan** — flags missing patient location and emergency contact documentation
6. **Consent re-attestation** — tracks annual telehealth consent renewal deadlines
7. **Telehealth parity** — informational flag about potential rate reductions

## Missed Revenue Lanes (6 new)
1. **Collaborative Care Model** (99492-99494) — consulting psych to PCPs
2. **Caregiver sessions** (90846/90847) — family therapy when caregiver participates
3. **Screening tool add-ons** (96127) — PHQ-9, GAD-7, PCL-5 billing per instrument
4. **Extended intake** (90792 vs 90791) — when medical exam components included
5. **Pharmacogenomic testing** (0029U) — for treatment-resistant patients
6. **Chronic Care Management** (99490/99491) — patients with 2+ chronic conditions

## Demo Data
12 cases, all telehealth (FL-based practice). Includes:
- Audio-only session (Patient K)
- Interstate patient in GA (Patient L)
- Expired consent re-attestation (Patient C)
- Missing crisis/safety plan (Patient B, E)
- POS 02 warning (Patient B)
- Screening tool add-on opportunities (Patients B, C, H, J)
- Pharmacogenomic + collaborative care opportunities (Patients G, H)

## Payer Warnings (telehealth-enhanced)
Added audio-only coverage rules, interstate warnings, POS 10 Medicare guidance, emergency contact best practices.
