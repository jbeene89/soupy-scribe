import {
  createPDFContext, addDocumentHeader, addSectionHeader, addBody, addBullet,
  addSpacer, addFooter, checkPage, addSubtitle, addDivider,
} from './pdfHelpers';

export const PLATFORM_SUMMARY_SECTIONS = [
  { id: 'executive', label: 'Executive Summary' },
  { id: 'protocol', label: 'SOUPY ThinkTank Protocol' },
  { id: 'payer', label: 'Payer Mode' },
  { id: 'provider', label: 'Provider Mode' },
  { id: 'pipeline', label: 'Ingestion & Processing Pipeline' },
  { id: 'architecture', label: 'Technical Architecture' },
  { id: 'strategy', label: 'Presentation & Strategy' },
  { id: 'security', label: 'Security & Compliance' },
  { id: 'market', label: 'Market Context & Sources' },
];

export function exportPlatformSummaryPDF(sectionIds?: string[]) {
  const ctx = createPDFContext();
  const allIds = PLATFORM_SUMMARY_SECTIONS.map(s => s.id);
  const enabled = new Set(!sectionIds || sectionIds.length === 0 ? allIds : sectionIds);
  const has = (id: string) => enabled.has(id);

  // ── Cover ──
  addDocumentHeader(ctx, 'SOUPY ThinkTank Platform', 'Confidential Executive Summary — Platform Architecture & Strategic Overview');
  addBody(ctx, `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  addSpacer(ctx, 12);

  // ── 1. Executive Summary ──
  if (has('executive')) {
  addSectionHeader(ctx, '1. Executive Summary');
  addBody(ctx, 'The SOUPY ThinkTank is an adversarial multi-AI reasoning engine designed to transform how health plans adjudicate complex medical claims. Rather than relying on a single AI model\'s opinion, SOUPY orchestrates four distinct AI "roles" that analyze each case from different clinical, regulatory, and statistical perspectives, then synthesizes their outputs into a consensus-weighted risk score.');
  addSpacer(ctx, 4);
  addBody(ctx, 'The platform operates in two modes:');
  addBullet(ctx, 'Payer Mode — Payment integrity auditing, denial defense, and pre-appeal resolution for health plans.');
  addBullet(ctx, 'Provider Mode — Compliance readiness, documentation sufficiency analysis, and denial prevention for hospitals and physician groups.');
  addSpacer(ctx, 8);
  addDivider(ctx);
  }

  // ── 2. The SOUPY Protocol ──
  if (has('protocol')) {
  addSectionHeader(ctx, '2. The SOUPY ThinkTank Protocol');
  addBody(ctx, 'SOUPY stands for the multi-perspective adversarial analysis framework. Each submitted case is processed through four AI roles running on Google Gemini:');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'AI Role Architecture');
  addBullet(ctx, 'Builder (Clinical Analyst) — Validates medical necessity, documentation completeness, and clinical pathway appropriateness.');
  addBullet(ctx, 'Red Team (Compliance Adversary) — Actively seeks coding vulnerabilities, unbundling risks, modifier misuse, and regulatory exposure.');
  addBullet(ctx, 'Systems Analyst (Pattern Detective) — Identifies statistical anomalies, billing pattern outliers, and cross-case correlations.');
  addBullet(ctx, 'Frame Breaker (Perspective Challenger) — Challenges assumptions made by the other three roles. Surfaces alternative interpretations and edge cases.');
  addSpacer(ctx, 4);
  addBody(ctx, 'Each role produces: a confidence score (0-100%), key insights, assumptions, identified violations with severity ratings, and an overall assessment. These are synthesized into a weighted consensus score that drives the final risk classification.');
  addDivider(ctx);
  }

  // ── 3. Payer Mode ──
  if (has('payer')) {
  checkPage(ctx);
  addSectionHeader(ctx, '3. Payer Mode — Payment Integrity');
  addSubtitle(ctx, 'Case Queue & Management');
  addBody(ctx, 'The case queue displays all submitted claims with real-time status tracking. Each case shows CPT/ICD codes, claim amounts, physician info, risk indicators, and consensus scores.');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Audit Detail View');
  addBody(ctx, 'Deep-dive into individual cases showing: four AI role analyses side-by-side, consensus meter, risk score breakdown, data completeness assessment, and evidence checklist.');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Pre-Appeal Resolution');
  addBody(ctx, 'Intercepts potential denials before formal appeals. Includes: issue classification, curability assessment, payer review simulation, and resolution likelihood scoring.');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Claim Accuracy Program (CAP)');
  addBody(ctx, 'Compliance coaching mode that surfaces recurring documentation vulnerabilities, coding patterns, and projected savings from proactive intervention.');
  addDivider(ctx);
  }

  // ── 4. Provider Mode ──
  if (has('provider')) {
  checkPage(ctx);
  addSectionHeader(ctx, '4. Provider Mode — Compliance Readiness');
  addBody(ctx, 'The provider-facing module uses deliberately softened language to make the tool safe for provider adoption without creating discoverable compliance risk.');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Provider Dashboard');
  addBody(ctx, 'Shows compliance readiness scores, avoidable denial cost projections, documentation sufficiency ratings, and coding vulnerability heat maps.');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Case Review');
  addBody(ctx, 'Individual case analysis: documentation sufficiency, coding vulnerability assessment, appeal viability, evidence readiness checklist, and denial pressure points.');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Education Insights');
  addBody(ctx, 'Aggregated learning module that identifies recurring documentation patterns and common coding mistakes.');
  addDivider(ctx);
  }

  // ── 5. Data Pipeline ──
  if (has('pipeline')) {
  checkPage(ctx);
  addSectionHeader(ctx, '5. Ingestion & Processing Pipeline');
  addBullet(ctx, 'File Upload: PDF, TXT, CSV, HL7, JSON, XML — with client-side PDF parsing');
  addBullet(ctx, 'Folder Upload: Drag-and-drop entire directories with recursive scanning');
  addBullet(ctx, 'ZIP Archive Upload: Automatic extraction and processing');
  addBullet(ctx, 'Batch Processing: Multiple files queued simultaneously');
  addBullet(ctx, 'Text Paste: Direct paste of operative reports');
  addSpacer(ctx, 4);
  addBody(ctx, 'Flow: File Parse → Clinical Data Extraction → Structured Case Creation → SOUPY Multi-Role Analysis → Consensus Scoring → Risk Classification.');
  addDivider(ctx);
  }

  // ── 6. Technical Architecture ──
  if (has('architecture')) {
  checkPage(ctx);
  addSectionHeader(ctx, '6. Technical Architecture');
  addSubtitle(ctx, 'Frontend');
  addBullet(ctx, 'React 18 with TypeScript, Vite build system');
  addBullet(ctx, 'Tailwind CSS with shadcn/ui component library');
  addBullet(ctx, 'Recharts for data visualization');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Backend (Lovable Cloud)');
  addBullet(ctx, 'PostgreSQL database with Row-Level Security (RLS)');
  addBullet(ctx, 'Deno-based Edge Functions for serverless processing');
  addBullet(ctx, 'Secure file storage for case documents');
  addSpacer(ctx, 4);
  addSubtitle(ctx, 'Database Schema');
  addBullet(ctx, 'audit_cases — Core case records with CPT/ICD codes, claim amounts, risk scores');
  addBullet(ctx, 'case_analyses — Individual AI role outputs linked to cases');
  addBullet(ctx, 'case_files — Uploaded document metadata and extracted text');
  addBullet(ctx, 'code_combinations — Flagged code pair analysis');
  addBullet(ctx, 'processing_queue — Async job tracking');
  addDivider(ctx);
  }

  // ── 7-8. Presentation & Strategy ──
  if (has('strategy')) {
  checkPage(ctx);
  addSectionHeader(ctx, '7. Executive Presentation Deck');
  addBody(ctx, 'An integrated 11-slide pitch deck built directly into the platform for live executive demonstrations.');
  addSpacer(ctx, 4);
  addSectionHeader(ctx, '8. Strategic Positioning');
  addBullet(ctx, 'Rule-Based Editing — Pre-payment code auditing enhancement with multi-AI consensus');
  addBullet(ctx, 'Analytics Dashboard — Clinical validation and medical necessity AI layer');
  addBullet(ctx, 'Workflow Orchestration — Claims workflow with embedded intelligence');
  addBullet(ctx, 'Data Transparency — Cross-claim pattern detection and recovery optimization');
  addDivider(ctx);
  }

  // ── 9. Security ──
  if (has('security')) {
  checkPage(ctx);
  addSectionHeader(ctx, '9. Security & Compliance');
  addBullet(ctx, 'Row-Level Security (RLS) on all data tables');
  addBullet(ctx, 'JWT-verified Edge Functions with input validation');
  addBullet(ctx, 'HIPAA "ride-along" deployment model');
  addBullet(ctx, 'AuthGate pattern — public browsing with authenticated state modifications');
  addBullet(ctx, 'No PHI stored in client-side storage');
  addDivider(ctx);
  }

  // ── 10. Market Context ──
  if (has('market')) {
  checkPage(ctx);
  addSectionHeader(ctx, '10. Market Context & Sources');
  addBullet(ctx, '40%+ of denied claims are overturned on appeal (KFF, AHA data)');
  addBullet(ctx, '$20B+ addressable market in payment integrity and denial management');
  addBullet(ctx, 'CMS regulatory environment increasingly favoring transparency and AI-assisted adjudication');
  addBullet(ctx, 'Provider-side denial prevention is a greenfield opportunity');
  }

  addFooter(ctx, 'Confidential — SOUPY ThinkTank — For authorized recipients only');
  ctx.doc.save('SOUPY-ThinkTank-Platform-Summary.pdf');
}
