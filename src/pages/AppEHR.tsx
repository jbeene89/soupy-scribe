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
import { parseHl7v2, isHl7v2, SAMPLE_ADT_A01, type Hl7v2IngestResult } from '@/lib/hl7v2Ingest';
import { parseX12, isX12, SAMPLE_835, type X12IngestResult } from '@/lib/x12Ingest';

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
  { vendor: 'Generic HL7 v2', method: 'ADT / DFT / ORM / ORU messages', status: 'available', notes: 'Pipe-delimited v2 parsed inline. ADT (admit/discharge) and DFT (charges) tested today; ORM/ORU normalized into the same internal shape.' },
  { vendor: 'CCDA / C-CDA', method: 'XML Continuity-of-Care', status: 'roadmap', notes: 'C-CDA → FHIR conversion roadmap.' },
  { vendor: 'X12 837 / 835 / 277', method: 'EDI claims, remits, status', status: 'available', notes: '837 (claim), 835 (remit with CARC/RARC adjustment reasons), and 277 (claim status) parsed inline. CAS-segment denial reasons feed the appeal-defense module directly.' },
  { vendor: 'SAML 2.0 SSO', method: 'Okta / Azure AD / Entra ID / OneLogin', status: 'available', notes: 'Native SAML SSO via Lovable Cloud. Configure metadata URL + email domains; allowlisted IdPs sign in directly.' },
  { vendor: 'SCIM 2.0 provisioning', method: 'Automated user lifecycle', status: 'roadmap', notes: 'JIT user creation + role/group sync from IdP. Targeted alongside first enterprise contract.' },
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

  // Standards Lab state (HL7 v2 + X12)
  const [hl7Input, setHl7Input] = useState('');
  const [hl7Result, setHl7Result] = useState<Hl7v2IngestResult | null>(null);
  const [hl7Error, setHl7Error] = useState<string | null>(null);
  const [x12Input, setX12Input] = useState('');
  const [x12Result, setX12Result] = useState<X12IngestResult | null>(null);
  const [x12Error, setX12Error] = useState<string | null>(null);

  const tryHl7 = (text: string) => {
    setHl7Error(null); setHl7Result(null);
    if (!isHl7v2(text)) { setHl7Error('Does not look like an HL7 v2 message — should start with "MSH|"'); return; }
    try {
      const r = parseHl7v2(text);
      if (!r) { setHl7Error('Parser returned no result'); return; }
      setHl7Result(r);
      toast.success(`Parsed ${r.messageType}`, { description: `${r.segmentsParsed} segments` });
    } catch (e: any) { setHl7Error(e?.message || 'HL7 parse failed'); }
  };

  const tryX12 = (text: string) => {
    setX12Error(null); setX12Result(null);
    if (!isX12(text)) { setX12Error('Does not look like an X12 EDI payload — should start with "ISA*"'); return; }
    try {
      const r = parseX12(text);
      if (!r) { setX12Error('Parser returned no result'); return; }
      setX12Result(r);
      toast.success(`Parsed X12 ${r.transactionType}`, { description: `${r.claims.length} claims` });
    } catch (e: any) { setX12Error(e?.message || 'X12 parse failed'); }
  };

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
        <div className="overflow-x-auto -mx-1 px-1">
        <TabsList className="flex flex-nowrap w-max min-w-full">
          <TabsTrigger value="ingest" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Ingest & Try</TabsTrigger>
          <TabsTrigger value="standards" className="gap-1.5"><FileJson className="h-3.5 w-3.5" />Standards Lab</TabsTrigger>
          <TabsTrigger value="resources" className="gap-1.5"><FileJson className="h-3.5 w-3.5" />Resources</TabsTrigger>
          <TabsTrigger value="connectors" className="gap-1.5"><Plug className="h-3.5 w-3.5" />Connectors</TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Security</TabsTrigger>
          <TabsTrigger value="pilot" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Pilot Path</TabsTrigger>
        </TabsList>
        </div>

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
                  {(result.extensionsRecognized.length + result.extensionsUnmapped.length > 0) && (
                    <div className="rounded-md border p-2 space-y-1.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Vendor extensions</p>
                      {result.extensionsRecognized.length > 0 && (
                        <div>
                          <p className="text-[10px] text-emerald-600 mb-1">Recognized · {result.extensionsRecognized.length}</p>
                          <div className="flex flex-wrap gap-1">
                            {result.extensionsRecognized.slice(0, 12).map((u) => (
                              <Badge key={u} variant="outline" className="text-[10px] font-mono max-w-full truncate">{u.split('/').pop()}</Badge>
                            ))}
                            {result.extensionsRecognized.length > 12 && (
                              <Badge variant="outline" className="text-[10px]">+{result.extensionsRecognized.length - 12} more</Badge>
                            )}
                          </div>
                        </div>
                      )}
                      {result.extensionsUnmapped.length > 0 && (
                        <div>
                          <p className="text-[10px] text-amber-600 mb-1">Unmapped · {result.extensionsUnmapped.length} (values still extracted when present)</p>
                          <div className="flex flex-wrap gap-1">
                            {result.extensionsUnmapped.slice(0, 8).map((u) => (
                              <Badge key={u} variant="outline" className="text-[10px] font-mono max-w-full truncate">{u.split('/').pop()}</Badge>
                            ))}
                            {result.extensionsUnmapped.length > 8 && (
                              <Badge variant="outline" className="text-[10px]">+{result.extensionsUnmapped.length - 8} more</Badge>
                            )}
                          </div>
                        </div>
                      )}
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

        {/* STANDARDS LAB — HL7 v2 + X12 */}
        <TabsContent value="standards" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Why this tab exists</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-3xl">
                Most US hospitals still emit HL7 v2 alongside (or instead of) FHIR, and every claim/remit moves as X12 EDI.
                Both parsers run in your browser. Paste a message, see the structured output the audit pipeline consumes.
              </p>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* HL7 v2 */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">HL7 v2.x — ADT / DFT / ORM / ORU</p>
                  <p className="text-xs text-muted-foreground">Pipe-delimited messages. MSH, PID, PV1, DG1, PR1, FT1.</p>
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5"
                  onClick={() => { setHl7Input(SAMPLE_ADT_A01); tryHl7(SAMPLE_ADT_A01); }}>
                  Load ADT^A01
                </Button>
              </div>
              <Textarea
                value={hl7Input}
                onChange={(e) => setHl7Input(e.target.value)}
                placeholder="MSH|^~\&|EPIC|UFHEALTH|SOUPY|AUDIT|..."
                className="font-mono text-[11px] min-h-[180px]"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!hl7Input.trim()} onClick={() => tryHl7(hl7Input)} className="gap-1.5">
                  Parse <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {hl7Error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{hl7Error}
                </div>
              )}
              {hl7Result && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-mono">{hl7Result.messageType}</Badge>
                    <Badge variant="outline" className="text-[10px]">{hl7Result.segmentsParsed} segments</Badge>
                    {hl7Result.patient.mrn && <Badge variant="secondary" className="text-[10px]">MRN {hl7Result.patient.mrn}</Badge>}
                    {hl7Result.diagnoses.length > 0 && <Badge variant="outline" className="text-[10px]">{hl7Result.diagnoses.length} dx</Badge>}
                    {hl7Result.charges.length > 0 && <Badge variant="outline" className="text-[10px]">{hl7Result.charges.length} charges</Badge>}
                  </div>
                  {hl7Result.warnings.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                      {hl7Result.warnings.join(' · ')}
                    </div>
                  )}
                  <pre className="text-[10px] bg-muted/40 rounded-md p-2 max-h-[280px] overflow-auto font-mono whitespace-pre-wrap">
                    {hl7Result.normalizedSummary}
                  </pre>
                </div>
              )}
            </Card>

            {/* X12 EDI */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">X12 EDI — 837 / 835 / 277</p>
                  <p className="text-xs text-muted-foreground">Claim, remit, and status. CAS adjustment reasons feed appeal defense.</p>
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5"
                  onClick={() => { setX12Input(SAMPLE_835); tryX12(SAMPLE_835); }}>
                  Load 835 sample
                </Button>
              </div>
              <Textarea
                value={x12Input}
                onChange={(e) => setX12Input(e.target.value)}
                placeholder="ISA*00*          *00*          *ZZ*PAYER..."
                className="font-mono text-[11px] min-h-[180px]"
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!x12Input.trim()} onClick={() => tryX12(x12Input)} className="gap-1.5">
                  Parse <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {x12Error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{x12Error}
                </div>
              )}
              {x12Result && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px] font-mono">X12 {x12Result.transactionType}</Badge>
                    <Badge variant="outline" className="text-[10px]">{x12Result.segmentsParsed} segments</Badge>
                    <Badge variant="outline" className="text-[10px]">{x12Result.claims.length} claims</Badge>
                  </div>
                  {x12Result.warnings.length > 0 && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                      {x12Result.warnings.join(' · ')}
                    </div>
                  )}
                  <pre className="text-[10px] bg-muted/40 rounded-md p-2 max-h-[280px] overflow-auto font-mono whitespace-pre-wrap">
                    {x12Result.normalizedSummary}
                  </pre>
                </div>
              )}
            </Card>
          </div>

          {/* SMART-on-FHIR + SSO posture */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">SMART on FHIR · Bulk FHIR · SSO</p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold mb-1">SMART on FHIR launch</p>
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40 mb-2">Roadmap</Badge>
                <p className="text-[11px] text-muted-foreground">OAuth2 against the customer's EHR for per-encounter pull. Built atop the same FHIR normalizer running today against file uploads — same downstream pipeline, different transport.</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold mb-1">Bulk FHIR ($export)</p>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] mb-2">Available — file-based</Badge>
                <p className="text-[11px] text-muted-foreground">NDJSON outputs from Epic, Cerner, MEDITECH bulk export ingest directly. Async polling client (Bulk Data API) is on roadmap for live pull.</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs font-semibold mb-1">SAML SSO + SCIM</p>
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] mb-2">SAML available</Badge>
                <p className="text-[11px] text-muted-foreground">Native SAML 2.0 via Lovable Cloud (Okta, Azure AD/Entra, OneLogin). SCIM 2.0 user provisioning targeted with first enterprise contract.</p>
              </div>
            </div>
          </Card>
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
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">EHR connectivity matrix</p>
              <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => {
                const rows = [["Vendor","Method","Status","Notes"], ...CONNECTORS.map(c => [c.vendor, c.method, c.status, c.notes])];
                const esc = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g,'""')}"` : v;
                const csv = rows.map(r => r.map(x => esc(String(x))).join(",")).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = "ehr-connectivity.csv"; a.click();
                URL.revokeObjectURL(url); toast.success("Exported ehr-connectivity.csv");
              }}>
                <Download className="h-3 w-3" />CSV
              </Button>
            </div>
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