import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Shield, Upload, FileText, Loader2, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  exportSelfHelpAttorneyPDF,
  exportSelfHelpComplaintPDF,
  exportSelfHelpFindingsPDF,
  exportSelfHelpTimelinePDF,
  type SelfHelpResults,
} from '@/lib/exportPatientSelfHelpPDFs';

type Phase = 'code' | 'intake' | 'uploading' | 'processing' | 'complete' | 'error';

const SCOPES = [
  { value: 'ob_ld', label: 'OB / Labor & Delivery' },
  { value: 'inpatient', label: 'Inpatient hospital care' },
  { value: 'general', label: 'Other / general' },
];

export default function PatientSelfHelp() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('code');
  const [inviteCode, setInviteCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [scope, setScope] = useState('ob_ld');
  const [narrative, setNarrative] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [results, setResults] = useState<SelfHelpResults | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore an in-progress case from localStorage so a refresh doesn't lose access
  useEffect(() => {
    try {
      const saved = localStorage.getItem('psh-active');
      if (saved) {
        const { caseId: cid, accessToken: at } = JSON.parse(saved);
        if (cid && at) {
          setCaseId(cid);
          setAccessToken(at);
          setPhase('processing');
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Poll status while processing
  useEffect(() => {
    if (phase !== 'processing' && phase !== 'complete') return;
    if (!caseId || !accessToken) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('patient-self-help-submit', {
          body: { phase: 'status', case_id: caseId, access_token: accessToken },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setStatus(data.status || '');
        setProgressMsg(data.progress_message || '');
        if (data.status === 'complete' && data.results) {
          setResults(data.results as SelfHelpResults);
          setPhase('complete');
        } else if (data.status === 'error') {
          setErrorMsg(data.error || 'Processing failed.');
          setPhase('error');
        }
      } catch (e) {
        if (!cancelled) {
          // Soft-fail polling; try again on next interval
          console.warn('poll failed', e);
        }
      }
    };
    poll();
    const iv = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [phase, caseId, accessToken]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setPhase('intake');
  };

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming);
    setFiles((prev) => [...prev, ...arr].slice(0, 25));
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const handleSubmit = async () => {
    if (files.length === 0 && !narrative.trim()) {
      toast({ title: 'Add records or a narrative', description: 'Upload at least one file or describe what happened.', variant: 'destructive' });
      return;
    }
    setPhase('uploading');
    setProgressMsg('Preparing upload…');
    try {
      const { data: startData, error: startErr } = await supabase.functions.invoke('patient-self-help-submit', {
        body: {
          phase: 'start',
          invite_code: inviteCode.trim(),
          contact_email: contactEmail.trim() || undefined,
          contact_name: contactName.trim() || undefined,
          case_title: caseTitle.trim() || undefined,
          scope,
          narrative: narrative.trim() || undefined,
          files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        },
      });
      if (startErr) throw startErr;
      if (startData?.error) throw new Error(startData.error);

      const { case_id, access_token, uploads } = startData as {
        case_id: string; access_token: string;
        uploads: Array<{ name: string; path: string; token: string; signed_url: string }>;
      };
      setCaseId(case_id);
      setAccessToken(access_token);
      try {
        localStorage.setItem('psh-active', JSON.stringify({ caseId: case_id, accessToken: access_token }));
      } catch { /* ignore */ }

      // Upload each file via signed URL
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const target = uploads.find((u) => u.name === file.name) || uploads[i];
        setProgressMsg(`Uploading ${file.name} (${i + 1} of ${files.length})…`);
        const { error: upErr } = await supabase.storage
          .from('patient-self-help')
          .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
      }

      setProgressMsg('Starting review…');
      const { error: finErr } = await supabase.functions.invoke('patient-self-help-submit', {
        body: { phase: 'finalize', case_id, access_token },
      });
      if (finErr) throw finErr;

      setPhase('processing');
      toast({ title: 'Submitted', description: 'Your records are being reviewed. This can take several minutes.' });
    } catch (e) {
      setPhase('intake');
      setErrorMsg(e instanceof Error ? e.message : String(e));
      toast({ title: 'Submission failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  };

  const startOver = () => {
    try { localStorage.removeItem('psh-active'); } catch { /* ignore */ }
    setPhase('code');
    setInviteCode(''); setContactEmail(''); setContactName(''); setCaseTitle('');
    setNarrative(''); setFiles([]); setCaseId(null); setAccessToken(null);
    setResults(null); setStatus(''); setProgressMsg(''); setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold">SOUPY Patient Self-Help</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {phase === 'code' && (
          <Card>
            <CardHeader>
              <CardTitle>Patient Record Review</CardTitle>
              <CardDescription>
                If you believe care for you or a family member was below the standard of care, upload
                the records here and we will read the entire file and flag anything that appears off.
                You need an invite code to begin.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStart} className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="code">Invite code</Label>
                  <Input id="code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} placeholder="e.g. PILOT-2026" />
                </div>
                <Button type="submit" disabled={!inviteCode.trim()}>Continue</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {phase === 'intake' && (
          <Card>
            <CardHeader>
              <CardTitle>Tell us about the case</CardTitle>
              <CardDescription>
                Anything you upload stays private to your case. Quoted text in the report comes verbatim from your records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="name">Your name (optional)</Label>
                  <Input id="name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="email">Email for follow-up (optional)</Label>
                  <Input id="email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="title">Short case title</Label>
                <Input id="title" value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} placeholder="e.g. L&D admission, Baptist Downtown, March 2026" />
              </div>
              <div>
                <Label>Type of care</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SCOPES.map((s) => (
                    <Button key={s.value} type="button"
                      variant={scope === s.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setScope(s.value)}>
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="narrative">What happened, in your own words</Label>
                <Textarea id="narrative" rows={6} value={narrative} onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Walk us through what happened, when, who was involved, and what felt off." />
              </div>

              <div>
                <Label>Upload records</Label>
                <div className="mt-1 border-2 border-dashed rounded-md p-6 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Drop PDFs, photos, or monitor strips here, or
                  </p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                    Choose files
                  </Button>
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    accept=".pdf,image/*,.txt,.rtf"
                    onChange={(e) => addFiles(e.target.files)} />
                  <p className="text-xs text-muted-foreground mt-2">Up to 25 files, 50 MB each.</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm border rounded px-3 py-2">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(i)}>Remove</Button>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">{files.length} file(s) · {(totalBytes / 1024 / 1024).toFixed(1)} MB total</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit}>Submit for review</Button>
                <Button variant="outline" onClick={startOver}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(phase === 'uploading' || phase === 'processing') && (
          <Card>
            <CardHeader>
              <CardTitle>Reviewing your records</CardTitle>
              <CardDescription>
                This usually takes a few minutes depending on how many pages were uploaded. You can leave this page open.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <div className="font-medium">{progressMsg || 'Working…'}</div>
                  {status && <div className="text-xs text-muted-foreground">Status: {status}</div>}
                </div>
              </div>
              {caseId && (
                <p className="text-xs text-muted-foreground mt-4">
                  Reference: <span className="font-mono">{caseId.slice(0, 8)}</span>. Keep this tab open or bookmark it to come back.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {phase === 'error' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Review failed</CardTitle>
              <CardDescription>{errorMsg || 'Something went wrong.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={startOver}>Start over</Button>
            </CardContent>
          </Card>
        )}

        {phase === 'complete' && results && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" /> Review complete</CardTitle>
                <CardDescription>{results.summary}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => exportSelfHelpFindingsPDF(caseTitle, results)}>
                  <Download className="h-4 w-4 mr-1" /> Findings PDF
                </Button>
                <Button variant="outline" onClick={() => exportSelfHelpTimelinePDF(caseTitle, results)}>
                  <Download className="h-4 w-4 mr-1" /> Timeline PDF
                </Button>
                <Button variant="outline" onClick={() => exportSelfHelpComplaintPDF(caseTitle, contactName, contactEmail, results)}>
                  <Download className="h-4 w-4 mr-1" /> Complaint Packet PDF
                </Button>
                <Button variant="outline" onClick={() => exportSelfHelpAttorneyPDF(caseTitle, results)}>
                  <Download className="h-4 w-4 mr-1" /> Attorney Summary PDF
                </Button>
                <Button variant="ghost" onClick={startOver}>Start a new case</Button>
              </CardContent>
            </Card>

            <Tabs defaultValue="findings">
              <TabsList>
                <TabsTrigger value="findings">Findings</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="complaint">Complaint Packet</TabsTrigger>
                <TabsTrigger value="attorney">Attorney Summary</TabsTrigger>
              </TabsList>

              <TabsContent value="findings" className="space-y-3">
                {(results.findings ?? []).length === 0 && (
                  <Card><CardContent className="py-6 text-sm text-muted-foreground">No deviations identified.</CardContent></Card>
                )}
                {(results.findings ?? []).map((f, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{f.title}</CardTitle>
                        <Badge variant={f.severity === 'critical' ? 'destructive' : 'secondary'}>{(f.severity || 'finding').toUpperCase()}</Badge>
                      </div>
                      {f.standardCited && <CardDescription>Standard: {f.standardCited}</CardDescription>}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {f.plainLanguage && <p>{f.plainLanguage}</p>}
                      {f.evidenceQuote && (
                        <blockquote className="border-l-2 pl-3 italic text-muted-foreground">"{f.evidenceQuote}"</blockquote>
                      )}
                      {f.sourceFile && (
                        <p className="text-xs text-muted-foreground">
                          Source: {f.sourceFile}{f.sourcePages?.length ? ` · pages ${f.sourcePages.join(', ')}` : ''}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="timeline">
                <Card>
                  <CardContent className="py-4">
                    {(results.timeline ?? []).length === 0 && <p className="text-sm text-muted-foreground">No timestamped events extracted.</p>}
                    <ul className="space-y-2 text-sm">
                      {(results.timeline ?? []).map((e, i) => (
                        <li key={i} className="border-l-2 border-primary/40 pl-3">
                          <span className="font-mono text-xs text-muted-foreground">{e.timestamp || '—'}</span>
                          <span className="ml-2">{e.event}</span>
                          {e.sourceFile && <span className="text-xs text-muted-foreground"> · {e.sourceFile}{e.sourcePages?.length ? ` p.${e.sourcePages.join(',')}` : ''}</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="complaint">
                <Card>
                  <CardContent className="py-4 space-y-3 text-sm">
                    {results.complaintPacket?.intro && <p>{results.complaintPacket.intro}</p>}
                    {(results.complaintPacket?.sections ?? []).map((s, i) => (
                      <div key={i}>
                        <h4 className="font-semibold">{s.heading}</h4>
                        <p className="whitespace-pre-wrap">{s.body}</p>
                      </div>
                    ))}
                    {results.complaintPacket?.requestedActions?.length ? (
                      <div>
                        <h4 className="font-semibold">Requested actions</h4>
                        <ul className="list-disc pl-5">
                          {results.complaintPacket.requestedActions.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="attorney">
                <Card>
                  <CardContent className="py-4 space-y-3 text-sm">
                    {results.attorneySummary?.caseTheory && <p><b>Case theory:</b> {results.attorneySummary.caseTheory}</p>}
                    {(results.attorneySummary?.keyDeviations ?? []).map((d, i) => (
                      <div key={i} className="border rounded p-3">
                        <div className="font-semibold">{d.title}</div>
                        <div>{d.whyItMatters}</div>
                        {d.recordCitation && <div className="text-xs text-muted-foreground">Citation: {d.recordCitation}</div>}
                      </div>
                    ))}
                    {results.attorneySummary?.damagesNarrative && (
                      <div><b>Damages narrative:</b> {results.attorneySummary.damagesNarrative}</div>
                    )}
                    {results.attorneySummary?.recordsCited?.length ? (
                      <div>
                        <b>Records cited:</b>
                        <ul className="list-disc pl-5">
                          {results.attorneySummary.recordsCited.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}