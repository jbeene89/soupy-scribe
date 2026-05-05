import { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Database, Download, Upload, ShieldCheck, Lock, Network, Plug,
  CheckCircle2, AlertCircle, FileJson, Clock, ArrowRight, Copy, Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { ingestFhir, looksLikeFhir, type FhirIngestResult } from '@/lib/fhirIngest';
import { downloadSyntheticFhirBundle, getSyntheticFhirBundleJson } from '@/lib/fhirSampleBundle';

type ConnectorStatus = 'available' | 'sandbox' | 'roadmap';

interface Connector {
  vendor: string;
  method: string;
  status: ConnectorStatus;
  notes: string;
}

const CONNECTORS: Connector[] = [
  { vendor: 'Epic', method: 'FHIR R4 Bulk Export ($export)', status: 'available', notes: 'Drop NDJSON exports directly into the audit pipeline. App Orchard registration required for live API.' },
  { vendor: 'Epic', method: 'SMART on FHIR (App Orchard)', status: 'roadmap', notes: 'Per-patient pull with OAuth2; live integration unlocked after sandbox cert + customer install.' },
  { vendor: 'Oracle Cerner', method: 'FHIR R4 / Code Console', status: 'sandbox', notes: 'Sandbox-tested via Cerner FHIR R4. Production requires customer-side Code Console install.' },
  { vendor: 'athenahealth', method: 'FHIR R4 + athenaOne API', status: 'sandbox', notes: 'Bundle ingest available now; live API requires Marketplace partnership.' },
  { vendor: 'MEDITECH Expanse', method: 'FHIR R4 Bulk Export', status: 'available', notes: 'Bulk export NDJSON ingestion supported.' },
  { vendor: 'eClinicalWorks', method: 'FHIR R4 / CCDA', status: 'sandbox', notes: 'FHIR Bundles supported; CCDA conversion roadmap.' },
  { vendor: 'NextGen', method: 'FHIR R4', status: 'sandbox', notes: 'Bundle ingest works; live OAuth roadmap.' },
  { vendor: 'Generic HL7 v2', method: 'ADT/ORM/ORU messages', status: 'roadmap', notes: 'Pipe-delimited HL7 v2 → FHIR converter on roadmap.' },
  { vendor: 'CCDA / C-CDA', method: 'XML Continuity-of-Care', status: 'roadmap', notes: 'C-CDA → FHIR conversion roadmap.' },
  { vendor: 'X12 837 / 835', method: 'EDI claims & remits', status: 'available', notes: 'Already supported via the Claim Parser module.' },
];

const SUPPORTED_RESOURCES = [
  { name: 'Patient', purpose: 'Identity, demographics' },
  { name: 'Coverage', purpose: 'Payer, plan, policy ID' },
  { name: 'Encounter', purpose: 'DOS, type, facility, attending' },
  { name: 'Condition', purpose: 'ICD-10 diagnoses, CC/MCC capture' },
  { name: 'Procedure', purpose: 'CPT/HCPCS performed' },
  { name: 'Observation', purpose: 'Labs, vitals, screening (PHQ-9/GAD-7)' },
  { name: 'Claim', purpose: 'Line items, charges, dx pointers' },
  { name: 'ExplanationOfBenefit', purpose: 'Adjudication, denial reasons (CO/PR/OA)' },
  { name: 'MedicationRequest', purpose: 'Active meds for clinical context' },
  { name: 'DocumentReference', purpose: 'Embedded op notes, progress notes (base64)' },
  { name: 'DiagnosticReport', purpose: 'Lab/imaging report narrative' },
  { name: 'ServiceRequest', purpose: 'Orders & medical necessity context' },
];

const SECURITY_CONTROLS = [
  { label: 'Transport', value: 'TLS 1.3 in transit, AES-256 at rest' },
  { label: 'PHI Handling', value: 'No PHI persisted in shadow mode — analysis runs in-memory, results de-identified' },
  { label: 'Auth', value: 'SMART on FHIR / OAuth2 + JWT for live connections' },
  { label: 'Audit', value: 'Per-finding decision trace, model + prompt + evidence retained' },
  { label: 'BAA', value: 'BAA template available pre-pilot; signed before any live PHI' },
  { label: 'Tenancy', value: 'Per-org RLS; no cross-tenant data access' },
  { label: 'Logging', value: 'Structured edge logs, redacted PHI fields' },
  { label: 'Hosting', value: 'US-region managed Postgres + edge runtime' },
];

export default function AppEHR() {
  const [pasted, setPasted] = useState('');
  const [result, setResult] = useState<FhirIngestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tryIngest = (text: string) => {
    setError(null);
    setResult(null);
    if (!looksLikeFhir(text)) {
      setError('That does not look like a FHIR Bundle, NDJSON, or single resource. Look for "resourceType" near the top.');
      return;
    }
    try {
      const r = ingestFhir(text);
      setResult(r);
      toast.success(`Parsed ${r.totalResources} FHIR resources`, { description: r.format });
    } catch (e: any) {
      setError(e?.message || 'Could not parse FHIR payload');
    }
  };

  const onPickFile = async (file: File) => {
    const text = await file.text();
    setPasted(text.slice(0, 50_000));
    tryIngest(text);
  };

  const sample = useMemo(() => getSyntheticFhirBundleJson(), []);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">EHR Integration</h1>
          <Badge variant="outline" className="text-[10px]">PILOT-READY</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          What an evaluator typically asks: <em>“What can you ingest, how do you connect, and what touches PHI?”</em> Everything below is real,
          working today — except items explicitly marked as <span className="font-medium text-amber-600">roadmap</span>.
        </p>
      </div>

      <Tabs defaultValue="ingest" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ingest" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Ingest & Try</TabsTrigger>
          <TabsTrigger value="resources" className="gap-1.5"><FileJson className="h-3.5 w-3.5" />Resources</TabsTrigger>
          <TabsTrigger value="connectors" className="gap-1.5"><Plug className="h-3.5 w-3.5" />Connectors</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Security</TabsTrigger>
          <TabsTrigger value="pilot" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Pilot Path</TabsTrigger>
        </TabsList>

        {/* INGEST */}
        <TabsContent value="ingest" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Try it now — paste or drop a FHIR payload</p>
                  <p className="text-xs text-muted-foreground">Bundle, NDJSON, or single FHIR R4 resource. Nothing leaves your browser.</p>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadSyntheticFhirBundle()}>
                  <Download className="h-3.5 w-3.5" />Sample Bundle
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".json,.ndjson,application/fhir+json,application/json"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ''; }}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />Choose File
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => { setPasted(sample); tryIngest(sample); }}>
                  Load sample inline
                </Button>
              </div>
              <Textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder='Paste FHIR JSON here. Look for "resourceType": "Bundle" or "Patient"...'
                className="font-mono text-[11px] min-h-[280px]"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!pasted.trim()} onClick={() => tryIngest(pasted)} className="gap-1.5">
                  Parse <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <p className="text-sm font-semibold">Parsed result</p>
              {!result && !error && (
                <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Parse a payload to see what SOUPY extracts and feeds into the audit pipeline.
                </div>
              )}
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
              {result && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{result.format}</Badge>
                    <Badge variant="outline" className="text-[10px]">{result.totalResources} resources</Badge>
                    {result.patientLabel && <Badge variant="secondary" className="text-[10px]">{result.patientLabel}</Badge>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Resource counts</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(result.resourceCounts).map(([k, v]) => (
                        <Badge key={k} variant="outline" className="font-mono text-[10px]">{k} · {v}</Badge>
                      ))}
                    </div>
                  </div>
                  {result.warnings.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                      {result.warnings.join(' ')}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Normalized text fed to audit pipeline</p>
                      <Button
                        size="sm" variant="ghost" className="h-6 gap-1 text-[10px]"
                        onClick={() => { navigator.clipboard.writeText(result.text); toast.success('Copied'); }}
                      >
                        <Copy className="h-3 w-3" />Copy
                      </Button>
                    </div>
                    <pre className="text-[10px] bg-muted/40 rounded-md p-2 max-h-[280px] overflow-auto font-mono whitespace-pre-wrap">
                      {result.text.slice(0, 6000)}{result.text.length > 6000 ? '\n…(truncated for display)' : ''}
                    </pre>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* RESOURCES */}
        <TabsContent value="resources" className="space-y-3">
          <Card className="p-4">
            <p className="text-sm font-semibold mb-2">FHIR R4 resources extracted today</p>
            <p className="text-xs text-muted-foreground mb-3">Each resource is normalized into the same internal shape used by pasted notes and EDI claims, so every existing audit module works against EHR data with no extra wiring.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {SUPPORTED_RESOURCES.map((r) => (
                <div key={r.name} className="rounded-md border p-2.5">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-medium font-mono">{r.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{r.purpose}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="text-sm font-semibold mb-2">Coding systems recognized</p>
            <div className="flex flex-wrap gap-1.5">
              {['ICD-10-CM', 'ICD-10-PCS', 'CPT', 'HCPCS Level II', 'LOINC', 'SNOMED-CT', 'RxNorm', 'NDC', 'CARC (CO/PR/OA)', 'RARC', 'POS codes', 'UB-04 type-of-bill'].map((c) => (
                <Badge key={c} variant="outline" className="text-[10px] font-mono">{c}</Badge>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* CONNECTORS */}
        <TabsContent value="connectors" className="space-y-3">
          <Card className="p-4">
            <p className="text-sm font-semibold mb-1">EHR connectivity matrix</p>
            <p className="text-xs text-muted-foreground mb-3">
              <span className="text-emerald-600 font-medium">Available</span> = works today against real exports ·
              <span className="text-blue-600 font-medium"> Sandbox</span> = validated against vendor sandbox ·
              <span className="text-amber-600 font-medium"> Roadmap</span> = scoped, not built
            </p>
            <div className="space-y-2">
              {CONNECTORS.map((c) => (
                <div key={c.vendor + c.method} className="flex items-start gap-3 rounded-md border p-3">
                  <div className="shrink-0">
                    {c.status === 'available' && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">Available</Badge>}
                    {c.status === 'sandbox' && <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[10px]">Sandbox</Badge>}
                    {c.status === 'roadmap' && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">Roadmap</Badge>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{c.vendor} <span className="text-muted-foreground font-normal">· {c.method}</span></p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{c.notes}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Three onboarding shapes</p>
            </div>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal pl-4">
              <li><span className="font-medium text-foreground">Drop-files pilot (today)</span> — provider exports a de-identified FHIR Bundle / NDJSON; we run the audit, return findings + ROI ledger. Zero IT involvement.</li>
              <li><span className="font-medium text-foreground">SFTP / S3 batch (1–2 weeks)</span> — nightly batch of FHIR + 837/835. Read-only, write-nowhere. Fits any HIM / RCM workflow.</li>
              <li><span className="font-medium text-foreground">SMART-on-FHIR live (per customer)</span> — OAuth2 against the customer's EHR, per-encounter or per-claim pull. Requires App Orchard / Code Console membership for production Epic / Cerner.</li>
            </ol>
          </Card>
        </TabsContent>

        {/* SECURITY */}
        <TabsContent value="security" className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Security posture</p>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              The pilot model intentionally piggybacks on the provider's existing infrastructure — we do not store PHI in shadow mode and require a signed BAA before any live PHI flows.
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {SECURITY_CONTROLS.map((s) => (
                <div key={s.label} className="rounded-md border p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <p className="text-xs text-foreground mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="text-sm font-semibold">What we do NOT do</p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>No write-back to the EHR. Read-only, every integration shape.</li>
              <li>No model fine-tuning on customer PHI. Inference only.</li>
              <li>No cross-tenant access — every row is RLS-scoped to the originating organization.</li>
              <li>No third-party trackers in the audit application surface.</li>
              <li>No data residency outside US regions without explicit customer approval.</li>
            </ul>
          </Card>
        </TabsContent>

        {/* PILOT PATH */}
        <TabsContent value="pilot" className="space-y-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Zero-friction pilot path</p>
            </div>
            <ol className="text-xs space-y-3 list-decimal pl-4">
              <li>
                <span className="font-medium">Day 0 — Shadow audit.</span>
                <p className="text-muted-foreground mt-0.5">You export 25–100 de-identified denied claims as a FHIR Bundle (Epic: <code className="text-[10px]">$export</code>; Cerner: Bulk Data API). Drop them into this page. We return a findings ledger + estimated recoverable revenue. No BAA, no IT ticket, no risk.</p>
              </li>
              <li>
                <span className="font-medium">Week 1 — Validation.</span>
                <p className="text-muted-foreground mt-0.5">We walk the findings with your CDI / RCM lead. You decide whether the signal is real. If yes, we sign a mutual NDA + BAA template.</p>
              </li>
              <li>
                <span className="font-medium">Weeks 2–4 — Live shadow.</span>
                <p className="text-muted-foreground mt-0.5">SFTP / S3 batch of pre-bill claims, read-only. We run alongside existing tools, report missed CC/MCCs and DRG-downgrade risk weekly. No workflow change for your team.</p>
              </li>
              <li>
                <span className="font-medium">Months 2–3 — Decision.</span>
                <p className="text-muted-foreground mt-0.5">Net-new captured revenue is measured against a baseline. Expand to live SMART-on-FHIR or step away — your call.</p>
              </li>
            </ol>
          </Card>

          <Card className="p-4 space-y-2">
            <p className="text-sm font-semibold">What we'll need from you</p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>A batch of de-identified claims (FHIR Bundle, NDJSON, 837/835 EDI, or CSV — any of these work).</li>
              <li>Your top 3 denial reason categories (so we tune the adversarial agents to your actual leak).</li>
              <li>A 30-minute walkthrough with someone who reviews denied claims daily.</li>
            </ul>
            <Separator className="my-2" />
            <p className="text-[11px] text-muted-foreground italic">
              Honest scope note: production Epic / Cerner App Orchard / Code Console membership is a 6–18 month process. The pilot path above is designed to deliver provable ROI <em>before</em> that step is on the table.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}