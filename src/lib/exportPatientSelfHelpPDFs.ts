import {
  createPDFContext, addDocumentHeader, addSectionHeader, addTitle, addSubtitle,
  addBody, addBullet, addKeyValue,
} from './pdfHelpers';
import type { FindingCard, StructuredSummary } from './patientSelfHelpTypes';

export type SelfHelpResults = {
  summary?: string;
  structuredSummary?: StructuredSummary;
  cards?: FindingCard[];
  analysisModes?: { clinical: boolean; billing: boolean; consent: boolean };
  disabledModesReason?: string;
  docTypeCounts?: Record<string, number>;
  findings?: Array<{
    title: string;
    severity?: string;
    plainLanguage?: string;
    standardCited?: string;
    evidenceQuote?: string;
    sourceFile?: string;
    sourcePages?: number[];
  }>;
  timeline?: Array<{
    timestamp?: string;
    event: string;
    sourceFile?: string;
    sourcePages?: number[];
  }>;
  complaintPacket?: {
    intro?: string;
    sections?: Array<{ heading: string; body: string }>;
    requestedActions?: string[];
  };
  attorneySummary?: {
    caseTheory?: string;
    keyDeviations?: Array<{ title: string; whyItMatters: string; recordCitation?: string }>;
    damagesNarrative?: string;
    recordsCited?: string[];
  };
  generatedAt?: string;
};

function header(caseTitle: string | null | undefined, title: string, subtitle: string) {
  const ctx = createPDFContext('portrait');
  addDocumentHeader(ctx, title, subtitle);
  if (caseTitle) {
    addSectionHeader(ctx, 'Case');
    addKeyValue(ctx, 'Case title', caseTitle);
  }
  return ctx;
}

function disclaimer(ctx: ReturnType<typeof createPDFContext>) {
  addSectionHeader(ctx, 'Important Notice');
  addBody(
    ctx,
    'This report is records reconciliation only. It does not decide whether care was wrong. ' +
    'It describes what the record says, what the record does not show, what does not reconcile, and what to ask for next. ' +
    'It is not medical advice and is not legal advice. Quoted text is taken verbatim from the records uploaded.'
  );
}

export function exportSelfHelpFindingsPDF(
  caseTitle: string | null | undefined,
  results: SelfHelpResults,
  filename = 'self-help-findings.pdf',
) {
  const generated = results.generatedAt ? new Date(results.generatedAt).toLocaleString() : new Date().toLocaleString();
  const ctx = header(caseTitle, 'Patient Record Review — Findings', `Prepared ${generated}`);

  if (results.summary) {
    addSectionHeader(ctx, 'Plain-Language Summary');
    addBody(ctx, results.summary);
  }

  const s = results.structuredSummary;
  if (s) {
    if (s.supports) { addSectionHeader(ctx, 'What the record supports'); addBody(ctx, s.supports); }
    if (s.contains?.length) { addSectionHeader(ctx, 'What the record contains'); for (const x of s.contains) addBullet(ctx, x); }
    if (s.doesNotInclude?.length) { addSectionHeader(ctx, 'What the record does NOT include'); for (const x of s.doesNotInclude) addBullet(ctx, x); }
    if (s.disabledModes?.length) { addSectionHeader(ctx, 'Analysis modes disabled'); for (const x of s.disabledModes) addBullet(ctx, x); }
  } else if (results.disabledModesReason) {
    addSectionHeader(ctx, 'Analysis modes disabled');
    addBody(ctx, results.disabledModesReason);
  }

  const cards = results.cards ?? [];
  if (cards.length > 0) {
    const byBucket = new Map<string, FindingCard[]>();
    for (const c of cards) {
      const k = c.bucket || 'Other';
      if (!byBucket.has(k)) byBucket.set(k, []);
      byBucket.get(k)!.push(c);
    }
    const order = ['Record Mismatch', 'Consent / Patient-Rights Flag', 'Missing Source Document', 'Needs Clarification', 'Looks Routine', 'Ask For This Next'];
    const sortedBuckets = Array.from(byBucket.keys()).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    for (const bucket of sortedBuckets) {
      addSectionHeader(ctx, bucket);
      for (const c of byBucket.get(bucket)!) {
        addTitle(ctx, c.title, 12);
        if (c.whyItMatters) { addSubtitle(ctx, 'Why it matters'); addBody(ctx, c.whyItMatters); }
        if (c.whatRecordShows) { addSubtitle(ctx, 'What the record shows'); addBody(ctx, c.whatRecordShows); }
        if (c.whatItDoesNotProve) { addSubtitle(ctx, 'What it does NOT prove'); addBody(ctx, c.whatItDoesNotProve); }
        if (c.askNext) { addSubtitle(ctx, 'Ask next'); addBody(ctx, c.askNext); }
        if (c.sourceFile) {
          const pages = c.sourcePages?.length ? ` (pages ${c.sourcePages.join(', ')})` : '';
          addKeyValue(ctx, 'Source', `${c.sourceFile}${pages}`);
        }
      }
    }
  } else {
    // Legacy fallback
    const findings = results.findings ?? [];
    if (findings.length === 0) {
      addSectionHeader(ctx, 'Findings');
      addBody(ctx, 'No findings were generated from the materials provided.');
    } else {
      addSectionHeader(ctx, 'Findings');
      for (const f of findings) {
        addTitle(ctx, `${(f.severity ?? 'finding').toUpperCase()} — ${f.title}`, 12);
        if (f.plainLanguage) addBody(ctx, f.plainLanguage);
        if (f.standardCited) addKeyValue(ctx, 'Standard cited', f.standardCited);
        if (f.sourceFile) {
          const pages = f.sourcePages?.length ? ` (pages ${f.sourcePages.join(', ')})` : '';
          addKeyValue(ctx, 'Source', `${f.sourceFile}${pages}`);
        }
        if (f.evidenceQuote) { addSubtitle(ctx, 'Verbatim from record'); addBody(ctx, `"${f.evidenceQuote}"`); }
      }
    }
  }

  disclaimer(ctx);
  ctx.doc.save(filename);
}

export function exportSelfHelpRecordsToRequestPDF(
  caseTitle: string | null | undefined,
  contactName: string | null | undefined,
  results: SelfHelpResults,
  filename = 'records-to-request.pdf',
) {
  const generated = results.generatedAt ? new Date(results.generatedAt).toLocaleString() : new Date().toLocaleString();
  const ctx = header(caseTitle, 'Records To Request', `Prepared ${generated}`);
  const asks: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    asks.push(t);
  };
  for (const a of results.structuredSummary?.headlineAsks ?? []) push(a);
  for (const c of results.cards ?? []) {
    if (c.bucket === 'Ask For This Next' || c.bucket === 'Missing Source Document') push(c.askNext);
  }
  for (const a of results.complaintPacket?.requestedActions ?? []) push(a);

  addSectionHeader(ctx, 'Suggested records-request message');
  addBody(
    ctx,
    `To Whom It May Concern,\n\nI am requesting complete copies of the following records${contactName ? ` related to my care (${contactName})` : ''}. Please provide unredacted copies including any audit trails or metadata where available.`,
  );
  addSectionHeader(ctx, 'Items requested');
  if (!asks.length) addBody(ctx, 'No specific records were identified to request.');
  for (const a of asks) addBullet(ctx, a);

  disclaimer(ctx);
  ctx.doc.save(filename);
}

export function exportSelfHelpTimelinePDF(
  caseTitle: string | null | undefined,
  results: SelfHelpResults,
  filename = 'self-help-timeline.pdf',
) {
  const generated = results.generatedAt ? new Date(results.generatedAt).toLocaleString() : new Date().toLocaleString();
  const ctx = header(caseTitle, 'Patient Record Review — Timeline', `Prepared ${generated}`);
  addSectionHeader(ctx, 'Reconstructed Timeline');
  const events = results.timeline ?? [];
  if (events.length === 0) addBody(ctx, 'No timestamped events were extracted.');
  for (const e of events) {
    const t = e.timestamp || '—';
    const src = e.sourceFile ? ` · ${e.sourceFile}${e.sourcePages?.length ? ` p.${e.sourcePages.join(',')}` : ''}` : '';
    addBullet(ctx, `${t}: ${e.event}${src}`);
  }
  disclaimer(ctx);
  ctx.doc.save(filename);
}

export function exportSelfHelpComplaintPDF(
  caseTitle: string | null | undefined,
  contactName: string | null | undefined,
  contactEmail: string | null | undefined,
  results: SelfHelpResults,
  filename = 'self-help-complaint-packet.pdf',
) {
  const generated = results.generatedAt ? new Date(results.generatedAt).toLocaleString() : new Date().toLocaleString();
  const ctx = header(caseTitle, 'Patient Complaint / Grievance Packet', `Prepared ${generated}`);
  addSectionHeader(ctx, 'Submitted by');
  if (contactName) addKeyValue(ctx, 'Name', contactName);
  if (contactEmail) addKeyValue(ctx, 'Email', contactEmail);

  const packet = results.complaintPacket ?? {};
  if (packet.intro) {
    addSectionHeader(ctx, 'Statement of Concern');
    addBody(ctx, packet.intro);
  }
  for (const s of packet.sections ?? []) {
    addSectionHeader(ctx, s.heading);
    addBody(ctx, s.body);
  }
  if (packet.requestedActions?.length) {
    addSectionHeader(ctx, 'Requested Actions');
    for (const a of packet.requestedActions) addBullet(ctx, a);
  }
  disclaimer(ctx);
  ctx.doc.save(filename);
}

export function exportSelfHelpAttorneyPDF(
  caseTitle: string | null | undefined,
  results: SelfHelpResults,
  filename = 'self-help-attorney-summary.pdf',
) {
  const generated = results.generatedAt ? new Date(results.generatedAt).toLocaleString() : new Date().toLocaleString();
  const ctx = header(caseTitle, 'Attorney-Ready Case Summary', `Prepared ${generated}`);
  const a = results.attorneySummary ?? {};
  if (a.caseTheory) { addSectionHeader(ctx, 'Case Theory'); addBody(ctx, a.caseTheory); }
  if (a.keyDeviations?.length) {
    addSectionHeader(ctx, 'Key Deviations from Standard of Care');
    for (const d of a.keyDeviations) {
      addTitle(ctx, d.title, 12);
      if (d.whyItMatters) addBody(ctx, d.whyItMatters);
      if (d.recordCitation) addKeyValue(ctx, 'Record citation', d.recordCitation);
    }
  }
  if (a.damagesNarrative) { addSectionHeader(ctx, 'Damages Narrative (Patient-Reported)'); addBody(ctx, a.damagesNarrative); }
  if (a.recordsCited?.length) {
    addSectionHeader(ctx, 'Records Cited');
    for (const r of a.recordsCited) addBullet(ctx, r);
  }
  disclaimer(ctx);
  ctx.doc.save(filename);
}

export function exportSelfHelpRecordsChecklistPDF(
  caseTitle: string | null | undefined,
  contactName: string | null | undefined,
  items: Array<{ text: string; checked: boolean }>,
  filename = 'records-to-request-checklist.pdf',
) {
  const generated = new Date().toLocaleString();
  const ctx = header(caseTitle, 'Records To Request — Checklist', `Prepared ${generated}`);
  if (contactName) addKeyValue(ctx, 'Patient', contactName);

  addSectionHeader(ctx, 'Checklist');
  addBody(
    ctx,
    'Use this list when contacting the health system\'s records department or patient relations office. ' +
    'Mark each item as you request it. Checked items below were marked requested before this PDF was generated.',
  );

  const { doc } = ctx;
  const boxSize = 11;
  const lineGap = 6;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const textLeft = ctx.margin + boxSize + 8;
    const textWidth = ctx.maxWidth - boxSize - 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(`${i + 1}. ${item.text}`, textWidth);
    const blockHeight = Math.max(boxSize, lines.length * 12) + lineGap;
    if (ctx.y + blockHeight > ctx.pageHeight - 60) {
      doc.addPage();
      ctx.pageNumber++;
      ctx.y = 44;
    }
    // Checkbox
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.8);
    doc.rect(ctx.margin, ctx.y - boxSize + 2, boxSize, boxSize, 'S');
    if (item.checked) {
      doc.setLineWidth(1.4);
      // Draw a check mark inside the box
      const x = ctx.margin;
      const y = ctx.y - boxSize + 2;
      doc.line(x + 2, y + boxSize * 0.55, x + boxSize * 0.4, y + boxSize - 2);
      doc.line(x + boxSize * 0.4, y + boxSize - 2, x + boxSize - 1, y + 2);
      doc.setLineWidth(0.8);
    }
    doc.setTextColor(30, 30, 30);
    doc.text(lines, textLeft, ctx.y);
    ctx.y += blockHeight;
  }

  disclaimer(ctx);
  ctx.doc.save(filename);
}