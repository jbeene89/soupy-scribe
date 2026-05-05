import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Brain, CheckCircle, Loader2, AlertCircle, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { submitProviderCase, runProviderAnalysis } from '@/lib/providerService';
import { extractTextFromFile } from '@/lib/fileTextExtractor';

interface ProviderCaseUploadProps {
  onCaseCreated: (caseId: string) => void;
}

const SAMPLE_PROVIDER_CASE = `OPERATIVE REPORT
Date of Service: 2024-06-18
Patient ID: PT-44210
Surgeon: Dr. Sarah Martinez (DR-5521)
Facility: Valley General Hospital

PREOPERATIVE DIAGNOSIS:
1. Lumbar spinal stenosis (M48.06)
2. Lumbar disc herniation L4-L5 (M51.16)

POSTOPERATIVE DIAGNOSIS:
Same as above

PROCEDURES PERFORMED:
1. Posterior lumbar decompression L4-L5 (CPT 63047)
2. Posterior lumbar decompression L5-S1 additional level (CPT 63048)
3. Posterior lumbar interbody fusion L4-L5 (CPT 22630)
4. Placement of biomechanical device L4-L5 (CPT 22853)

ANESTHESIA: General
EBL: 300cc
OR TIME: 195 minutes

CLINICAL NARRATIVE:
52-year-old female with 14 months of progressive bilateral lower extremity radiculopathy and neurogenic claudication. Failed conservative management including 3 months physical therapy, epidural steroid injections x2, and oral medications.

MRI shows severe central canal stenosis at L4-L5 with disc herniation and moderate stenosis at L5-S1. EMG confirms bilateral L5 radiculopathy.

CHARGES:
63047 - Posterior decompression: $4,800
63048 - Additional level decompression: $2,200
22630 - Posterior interbody fusion: $6,500
22853 - Biomechanical device: $3,200
Implants: $12,000
Facility fee: $4,500
Total: $33,200`;

type UploadStep = 'input' | 'extracting' | 'extracted' | 'analyzing' | 'complete' | 'error';

interface AttachedFile {
  id: string;
  name: string;
  size: number;
  text: string;
  pages?: number;
  warning?: string;
}

export function ProviderCaseUpload({ onCaseCreated }: ProviderCaseUploadProps) {
  const [open, setOpen] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [step, setStep] = useState<UploadStep>('input');
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setSourceText('');
    setStep('input');
    setCaseId(null);
    setError(null);
    setExtractedData(null);
    setFiles([]);
    setReading(null);
  };

  const handleFiles = async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    for (const f of list) {
      try {
        setReading(f.name);
        const result = await extractTextFromFile(f);
        if (!result.text || result.text.trim().length < 10) {
          toast.error(`No text extracted from ${f.name}`, {
            description: 'Scanned PDFs without a text layer aren\'t supported here — paste the text instead.',
          });
          continue;
        }
        const attached: AttachedFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          size: f.size,
          text: result.text,
          pages: result.pages,
          warning: result.warning,
        };
        setFiles((prev) => [...prev, attached]);
        // Append into the source text area so the user sees what will be analyzed.
        setSourceText((prev) => {
          const header = `\n\n----- ${f.name} -----\n`;
          return (prev ? prev + header : `----- ${f.name} -----\n`) + result.text;
        });
        toast.success(`Loaded ${f.name}`, { description: `${result.text.length.toLocaleString()} chars extracted` });
      } catch (err) {
        toast.error(`Couldn't read ${f.name}`, {
          description: err instanceof Error ? err.message : 'Extraction failed',
        });
      } finally {
        setReading(null);
      }
    }
  };

  const removeFile = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (!f) return;
    setFiles((prev) => prev.filter((x) => x.id !== id));
    // Best-effort: strip the chunk we appended.
    setSourceText((prev) => prev.replace(new RegExp(`\\n*-----\\s*${f.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*-----\\n[\\s\\S]*?(?=\\n*-----|$)`), '').trim());
  };

  const handleSubmit = async () => {
    if (!sourceText.trim()) return;
    setStep('extracting');
    setError(null);
    try {
      const result = await submitProviderCase(sourceText);
      setCaseId(result.caseId);
      setExtractedData(result.extracted);
      if (result.linkedTo) {
        toast.info('Auto-linked to existing case', { description: 'This document was linked to a related case based on patient ID and body region.' });
      }
      setStep('extracted');

      // Auto-run analysis
      setStep('analyzing');
      await runProviderAnalysis(result.caseId);
      setStep('complete');
      toast.success('Compliance readiness analysis complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
      setStep('error');
      toast.error(err instanceof Error ? err.message : 'Processing failed');
    }
  };

  const progressValue = step === 'extracting' ? 25 : step === 'extracted' ? 50 : step === 'analyzing' ? 75 : step === 'complete' ? 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Submit Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            Provider Compliance Readiness Review
          </DialogTitle>
        </DialogHeader>

        {step !== 'input' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {step === 'extracting' ? 'Extracting case data...' :
                 step === 'extracted' ? 'Case extracted' :
                 step === 'analyzing' ? 'Running readiness analysis...' :
                 step === 'complete' ? 'Analysis complete' :
                 'Error'}
              </span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}

        {step === 'input' && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Paste an operative report, clinical note, or claim summary</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => { setSourceText(SAMPLE_PROVIDER_CASE); toast.info('Sample case loaded'); }}
                >
                  Load Sample
                </Button>
              </div>

              {/* File attachments */}
              <div className="rounded-md border border-dashed bg-muted/20 p-3 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md,.csv,.tsv,.rtf,.json,.ndjson,.xml,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/*"
                  onChange={(e) => {
                    if (e.target.files?.length) handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Upload className="h-3.5 w-3.5" />
                    Attach PDF, DOCX, XLSX, TXT, or FHIR (.json/.ndjson) — auto-extracted
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={!!reading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {reading ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Reading {reading}…</>
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" />{files.length === 0 ? 'Choose files' : 'Add more'}</>
                    )}
                  </Button>
                </div>
                {files.length > 0 && (
                  <div className="space-y-1">
                    {files.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 border">
                        <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {f.text.length.toLocaleString()} chars{f.pages ? ` · ${f.pages} page(s)` : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFile(f.id)}
                          aria-label={`Remove ${f.name}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Textarea
                placeholder="Paste clinical documentation here..."
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {sourceText.length > 0 ? `${sourceText.length.toLocaleString()} characters` : ''}
                </span>
                <Button onClick={handleSubmit} disabled={!sourceText.trim()} className="gap-2">
                  <Brain className="h-4 w-4" />
                  Analyze for Compliance Readiness
                </Button>
              </div>
            </div>
          </>
        )}

        {(step === 'extracting' || step === 'analyzing') && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-accent" />
            <p className="text-sm font-medium">
              {step === 'extracting' ? 'Extracting case data from documentation...' : 'Running AI compliance readiness analysis...'}
            </p>
            <p className="text-xs text-muted-foreground">
              {step === 'analyzing' ? 'Evaluating documentation sufficiency, coding vulnerabilities, and appeal viability...' : 'Identifying CPT codes, ICD codes, and clinical details...'}
            </p>
          </div>
        )}

        {step === 'complete' && caseId && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-10 w-10 text-consensus mx-auto" />
            <div>
              <p className="text-sm font-semibold">Compliance Readiness Analysis Complete</p>
              <p className="text-xs text-muted-foreground mt-1">Your case has been analyzed for documentation sufficiency, coding vulnerability, and appeal viability.</p>
            </div>
            {extractedData?.cpt_codes && (
              <div className="flex gap-1.5 justify-center flex-wrap">
                {extractedData.cpt_codes.map((c: string) => (
                  <Badge key={c} variant="outline" className="font-mono text-xs">{c}</Badge>
                ))}
              </div>
            )}
            <Button onClick={() => { onCaseCreated(caseId); setOpen(false); reset(); }}>
              View Readiness Report
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <div>
              <p className="text-sm font-semibold">Analysis Failed</p>
              <p className="text-xs text-destructive mt-1">{error}</p>
            </div>
            <Button variant="outline" onClick={reset}>Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
