# Lyric AI — Payment Integrity & Provider Readiness Platform

A dual-sided healthcare SaaS platform for medical code auditing, payment integrity analysis, and provider claim readiness — powered by the **SOUPY ThinkTank Protocol** for multi-perspective AI reasoning.

## Overview

Lyric AI enables **payers** and **providers** to collaboratively improve claim accuracy, reduce audit friction, and streamline the payment integrity lifecycle.

### Payer Mode
- **Case Queue** — Triage and review flagged claims with AI-generated risk scores and consensus metrics
- **Audit Detail** — Deep-dive into individual cases with CPT/ICD code analysis, evidence checklists, and multi-agent AI perspectives
- **Pattern Analysis** — Identify billing trends, anomalies, and systemic documentation gaps
- **SOUPY ThinkTank** — Configurable multi-AI panel (Auditor, Coder, Clinician, Compliance, Appeals) that debates each case to surface balanced decisions
- **Presentation Mode** — Executive-ready slides for stakeholder demos

### Provider Mode
- **Provider Dashboard** — At-a-glance view of claim readiness, submission quality, and education metrics
- **Case Reviews** — Review flagged cases from the provider perspective with appeal-ready evidence building
- **Education Insights** — Targeted guidance to improve documentation and reduce future denials

## Tech Stack

- **Frontend:** React · TypeScript · Vite · Tailwind CSS · shadcn/ui
- **Backend:** Lovable Cloud (database, auth, edge functions, file storage)
- **AI Analysis:** Multi-model orchestration via backend functions
- **PDF Processing:** Client-side text extraction with pdfjs-dist
- **Charts:** Recharts

## Getting Started

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the dev server
npm run dev
```

## Key Concepts

| Concept | Description |
|---------|-------------|
| **SOUPY Protocol** | Multi-agent AI consensus framework — each "role" analyzes a case independently, then results are synthesized into a consensus score |
| **Audit Posture** | Toggle between *Payment Integrity* (flag & recover) and *Compliance Coaching* (educate & prevent) modes |
| **Consensus Score** | Weighted agreement metric across AI perspectives indicating confidence in a billing determination |
| **Risk Score** | Composite indicator combining code combination flags, documentation gaps, and historical patterns |

## Project Structure

```
src/
├── components/
│   ├── spark/          # Core case analysis UI (decision panel, appeal summary, exports)
│   ├── provider/       # Provider-mode components (dashboard, case review, education)
│   ├── pre-appeal/     # Pre-appeal resolution workflow
│   └── ui/             # shadcn/ui primitives
├── hooks/              # Auth, toast, mobile detection
├── lib/                # Services, types, mock data, utilities
├── pages/              # Route-level pages (Index, Auth, NotFound)
└── integrations/       # Backend client & types
supabase/
└── functions/          # Edge functions (analyze-case, provider-analyze)
```

## License

Proprietary — All rights reserved.
