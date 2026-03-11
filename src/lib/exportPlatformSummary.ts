import jsPDF from 'jspdf';

export function exportPlatformSummaryPDF() {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  let y = 50;

  const addTitle = (text: string, size = 18) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(30, 58, 95);
    doc.text(text, margin, y);
    y += size + 8;
  };

  const addSubtitle = (text: string, size = 13) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(55, 80, 120);
    doc.text(text, margin, y);
    y += size + 6;
  };

  const addBody = (text: string, size = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 4;
  };

  const addBullet = (text: string, size = 10) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, maxWidth - 14);
    doc.text('•', margin, y);
    doc.text(lines, margin + 14, y);
    y += lines.length * (size + 3) + 2;
  };

  const addSpacer = (h = 10) => { y += h; };

  const checkPage = (needed = 80) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 50;
    }
  };

  // ── Cover ──
  addTitle('Lyric AI — SOUPY ThinkTank Platform', 22);
  addSpacer(4);
  addBody('Confidential Executive Summary — Platform Architecture & Strategic Overview');
  addBody(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
  addSpacer(16);

  // ── 1. Executive Summary ──
  addTitle('1. Executive Summary');
  addBody('The SOUPY ThinkTank is an adversarial multi-AI reasoning engine designed to transform how health plans adjudicate complex medical claims. Rather than relying on a single AI model\'s opinion, SOUPY orchestrates four distinct AI "roles" that analyze each case from different clinical, regulatory, and statistical perspectives, then synthesizes their outputs into a consensus-weighted risk score.');
  addSpacer();
  addBody('The platform operates in two modes:');
  addBullet('Payer Mode — Payment integrity auditing, denial defense, and pre-appeal resolution for health plans.');
  addBullet('Provider Mode — Compliance readiness, documentation sufficiency analysis, and denial prevention for hospitals and physician groups.');
  addSpacer(12);

  // ── 2. The SOUPY Protocol ──
  checkPage();
  addTitle('2. The SOUPY ThinkTank Protocol');
  addBody('SOUPY stands for the multi-perspective adversarial analysis framework. Each submitted case is processed through four AI roles running on Google Gemini:');
  addSpacer(4);
  addSubtitle('AI Role Architecture');
  addBullet('Builder (Clinical Analyst) — Validates medical necessity, documentation completeness, and clinical pathway appropriateness. Evaluates whether the documented clinical narrative supports the procedures performed.');
  addBullet('Red Team (Compliance Adversary) — Actively seeks coding vulnerabilities, unbundling risks, modifier misuse, and regulatory exposure. Stress-tests the case from a payer denial perspective.');
  addBullet('Systems Analyst (Pattern Detective) — Identifies statistical anomalies, billing pattern outliers, and cross-case correlations. Compares against population-level benchmarks.');
  addBullet('Frame Breaker (Perspective Challenger) — Challenges assumptions made by the other three roles. Surfaces alternative interpretations, edge cases, and unconsidered regulatory angles.');
  addSpacer(6);
  addBody('Each role produces: a confidence score (0-100%), key insights, assumptions, identified violations with severity ratings, and an overall assessment. These are synthesized into a weighted consensus score that drives the final risk classification (low/medium/high/critical).');
  addSpacer(12);

  // ── 3. Payer Mode ──
  checkPage();
  addTitle('3. Payer Mode — Payment Integrity');
  addSubtitle('Case Queue & Management');
  addBody('The case queue displays all submitted claims with real-time status tracking (pending → analyzing → reviewed → decided). Each case shows CPT/ICD codes, claim amounts, physician info, risk indicators, and consensus scores. Cases can be sourced from live database submissions or demonstration mock data.');
  addSpacer(4);
  addSubtitle('Audit Detail View');
  addBody('Deep-dive into individual cases showing: the four AI role analyses side-by-side, a consensus meter visualizing agreement across roles, risk score breakdown with contributing factors, data completeness assessment, and an evidence checklist for audit defense.');
  addSpacer(4);
  addSubtitle('Pre-Appeal Resolution');
  addBody('A premium capability that intercepts potential denials before they enter the formal appeals process. Includes: issue classification (clinical vs. coding vs. administrative), curability assessment, payer review simulation, provider submission builder with auto-generated language, rapid resolution checklists, and resolution likelihood scoring.');
  addSpacer(4);
  addSubtitle('Claim Accuracy Program (CAP)');
  addBody('Rebranded from "Pattern Analysis" to align with Lyric\'s compliance coaching language. Surfaces recurring documentation vulnerabilities, coding patterns, and projected savings from proactive intervention.');
  addSpacer(12);

  // ── 4. Provider Mode ──
  checkPage();
  addTitle('4. Provider Mode — Compliance Readiness');
  addBody('The provider-facing module uses deliberately softened language — "readiness gaps" instead of "violations," "documentation improvement opportunities" instead of "deficiencies" — to make the tool safe for provider adoption without creating discoverable compliance risk.');
  addSpacer(4);
  addSubtitle('Provider Dashboard');
  addBody('Shows compliance readiness scores, avoidable denial cost projections, documentation sufficiency ratings, and coding vulnerability heat maps across the provider\'s case portfolio.');
  addSpacer(4);
  addSubtitle('Case Review');
  addBody('Individual case analysis showing: documentation sufficiency score with specific gap identification, coding vulnerability assessment with fix recommendations, appeal viability analysis (likelihood of overturn if denied), evidence readiness checklist, timeline consistency verification, and denial pressure points.');
  addSpacer(4);
  addSubtitle('Education Insights');
  addBody('Aggregated learning module that identifies recurring documentation patterns, common coding mistakes, and provides targeted educational content to reduce future denial rates.');
  addSpacer(12);

  // ── 5. Data Pipeline ──
  checkPage();
  addTitle('5. Ingestion & Processing Pipeline');
  addBody('The platform supports turnkey ingestion of real medical records through multiple channels:');
  addBullet('File Upload: PDF, TXT, CSV, HL7, JSON, XML — with client-side PDF parsing via pdfjs-dist.');
  addBullet('Folder Upload: Drag-and-drop entire directories with recursive file scanning.');
  addBullet('ZIP Archive Upload: Automatic extraction and processing of compressed archives.');
  addBullet('Batch Processing: Multiple files queued simultaneously with parallel parsing and sequential AI analysis.');
  addBullet('Text Paste: Direct paste of operative reports and clinical documentation.');
  addSpacer(4);
  addBody('Processing Flow: File Parse → Clinical Data Extraction (Gemini AI) → Structured Case Creation → SOUPY Multi-Role Analysis → Consensus Scoring → Risk Classification.');
  addSpacer(12);

  // ── 6. Technical Architecture ──
  checkPage();
  addTitle('6. Technical Architecture');
  addSubtitle('Frontend');
  addBullet('React 18 with TypeScript, Vite build system');
  addBullet('Tailwind CSS with shadcn/ui component library');
  addBullet('Recharts for data visualization');
  addBullet('Framer-motion-ready animation architecture');
  addSpacer(4);
  addSubtitle('Backend (Lovable Cloud)');
  addBullet('PostgreSQL database with Row-Level Security (RLS)');
  addBullet('Deno-based Edge Functions for serverless processing');
  addBullet('Supabase Auth with email/password authentication');
  addBullet('Secure file storage for case documents');
  addSpacer(4);
  addSubtitle('Database Schema');
  addBullet('audit_cases — Core case records with CPT/ICD codes, claim amounts, risk scores, owner-scoped RLS');
  addBullet('case_analyses — Individual AI role outputs linked to cases');
  addBullet('case_files — Uploaded document metadata and extracted text');
  addBullet('code_combinations — Flagged code pair analysis with explanations');
  addBullet('processing_queue — Async job tracking for batch operations');
  addSpacer(4);
  addSubtitle('Edge Functions');
  addBullet('analyze-case — Orchestrates extraction and the 4-role SOUPY protocol for payer audits');
  addBullet('provider-analyze — Clinical extraction and compliance assessment for provider mode');
  addSpacer(12);

  // ── 7. Executive Presentation ──
  checkPage();
  addTitle('7. Executive Presentation Deck');
  addBody('An integrated 11-slide pitch deck built directly into the platform, designed for live executive demonstrations:');
  addSpacer(4);
  addBullet('Slide 1-3 (Strategy): "The Opportunity" (40%+ denial overturn rate), "Live Case Demo" (interactive risk scoring), "The Next Layer" (amplification strategy).');
  addBullet('Slide 4-6 (Product): "Day 0 Defense" (new pre-appeal capability), "Premium Add-On" (pre-appeal resolution module), "New Revenue Stream" ($20B market sizing).');
  addBullet('Slide 7-8 (Operations): "The Flywheel" (value cycle visualization), "Technical Architecture" (data pipeline blueprint).');
  addBullet('Slide 9 (The Pilot): 30-day sandbox program — Upload → Analyze → Compare — with HIPAA "ride-along" compliance (no new BAA required).');
  addBullet('Slide 10-11 (Closing): "The Offer" (partnership terms) and "Sources & Citations" (KFF, AHA, CMS references).');
  addSpacer(12);

  // ── 8. Strategic Positioning ──
  checkPage();
  addTitle('8. Strategic Positioning for Lyric');
  addSubtitle('Lyric Product Mapping');
  addBody('The platform maps directly onto Lyric\'s existing product suite:');
  addBullet('ClaimsXten — Pre-payment code auditing enhancement with multi-AI consensus');
  addBullet('Virtuoso — Clinical validation and medical necessity AI layer');
  addBullet('Rhythm — Claims workflow orchestration with embedded intelligence');
  addBullet('Vesion (Subrogation) — Cross-claim pattern detection and recovery optimization');
  addSpacer(4);
  addSubtitle('Value Demonstration');
  addBody('The Value Demo tab provides a side-by-side comparison of Single Model AI vs. SOUPY ThinkTank multi-model approach, showing how adversarial consensus produces higher-confidence audit decisions with lower false-positive rates.');
  addSpacer(4);
  addSubtitle('Integration Architecture');
  addBody('An 8-week rollout blueprint showing how SOUPY integrates into Lyric\'s existing data pipeline: Claim Intake → Pre-Payment Screening → SOUPY Analysis → Decision Engine → Outcome Tracking.');
  addSpacer(12);

  // ── 9. Security ──
  checkPage();
  addTitle('9. Security & Compliance');
  addBullet('Row-Level Security (RLS) on all data tables — users can only access their own cases');
  addBullet('JWT-verified Edge Functions with input validation to prevent IDOR attacks');
  addBullet('HIPAA "ride-along" deployment model — no new BAA or recertification required');
  addBullet('AuthGate pattern — public browsing with authentication required for all state-modifying actions');
  addBullet('No PHI stored in client-side storage; all sensitive data server-side with encrypted transport');
  addSpacer(12);

  // ── 10. Market Context ──
  checkPage();
  addTitle('10. Market Context & Sources');
  addBullet('40%+ of denied claims are overturned on appeal (KFF, AHA data) — proving systematic over-denial');
  addBullet('$20B+ addressable market in payment integrity and denial management');
  addBullet('CMS regulatory environment increasingly favoring transparency and AI-assisted adjudication');
  addBullet('Provider-side denial prevention is a greenfield opportunity — most tools are payer-only');
  addSpacer(16);

  // ── Footer ──
  checkPage(40);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Confidential — Lyric AI / SOUPY ThinkTank — For authorized recipients only', margin, y);

  doc.save('SOUPY-ThinkTank-Platform-Summary.pdf');
}
