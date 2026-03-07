import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, FileText, Brain, CheckCircle, AlertCircle, Loader2, File } from 'lucide-react';
import { toast } from 'sonner';
import { submitCaseText, runSOUPYAnalysis, getProcessingStatus } from '@/lib/caseService';

interface CaseUploadProps {
  onCaseCreated: (caseId: string) => void;
}

const SAMPLE_CASE = `OPERATIVE REPORT
Date of Service: 2024-04-12
Patient ID: PT-92104
Surgeon: Dr. Thomas Kramer (DR-8801)
Facility: St. Mary's Regional Medical Center

PREOPERATIVE DIAGNOSIS:
1. Right knee osteoarthritis, primary (M17.11)
2. Right knee medial meniscus tear (M23.21)

POSTOPERATIVE DIAGNOSIS:
1. Right knee osteoarthritis, primary (M17.11)  
2. Right knee medial meniscus tear (M23.21)
3. Right knee chondromalacia, grade III-IV (M94.261)

PROCEDURES PERFORMED:
1. Right total knee arthroplasty (CPT 27447)
2. Right knee arthroscopic medial meniscectomy (CPT 29881)
3. Application of bone graft, morselized allograft (CPT 20930)

ANESTHESIA: General endotracheal
ESTIMATED BLOOD LOSS: 250cc
TOURNIQUET TIME: 82 minutes
TOTAL OR TIME: 145 minutes

OPERATIVE FINDINGS:
Patient is a 67-year-old male with progressive right knee pain unresponsive to conservative management including 6 months of physical therapy, NSAIDs, and two cortisone injections. Pre-operative imaging showed tricompartmental osteoarthritis with medial compartment bone-on-bone changes.

Upon arthroscopic evaluation, a complex degenerative medial meniscus tear was identified and debrided. Grade III-IV chondromalacia was noted in all three compartments. Decision made to proceed with TKA.

Medial parapatellar approach was used. Bone cuts were made using measured resection technique. Due to significant medial tibial bone deficiency, morselized allograft (AlloSource, Lot #AG-2024-4481) was used to augment the tibial plateau before component placement. 

Components placed:
- Zimmer NexGen LPS femoral component, size F
- Zimmer NexGen tibial baseplate, size 4
- Zimmer NexGen 10mm polyethylene insert
- Zimmer NexGen patellar component, 32mm

CHARGES:
27447 - Total knee arthroplasty: $4,200
29881 - Arthroscopic meniscectomy: $1,800  
20930 - Bone graft, morselized: $2,400
Implants: $8,200
Facility fee: $3,400
Total: $20,000`;

type UploadStep = 'input' | 'parsing-pdf' | 'extracting' | 'extracted' | 'analyzing' | 'complete' | 'error';

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ');
    pages.push(text);
  }
  
  return pages.join('\n\n--- Page Break ---\n\n');
}

export function CaseUpload({ onCaseCreated }: CaseUploadProps) {
  const [open, setOpen] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [step, setStep] = useState<UploadStep>('input');
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setSourceText('');
    setStep('input');
    setProgress(0);
    setExtractedData(null);
    setCaseId(null);
    setError(null);
    setCurrentRole('');
    setUploadedFileName(null);
    setIsDragging(false);
  }, []);

  const handlePDFFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      // Try as plain text
      const text = await file.text();
      setSourceText(text);
      setUploadedFileName(file.name);
      toast.success(`Loaded ${file.name} as text`);
      return;
    }

    setStep('parsing-pdf');
    setProgress(5);
    setUploadedFileName(file.name);

    try {
      const text = await extractTextFromPDF(file);
      if (!text.trim()) {
        toast.error('No text found in PDF — it may be a scanned image. Try pasting the text instead.');
        setStep('input');
        setProgress(0);
        return;
      }
      setSourceText(text);
      setStep('input');
      setProgress(0);
      toast.success(`Extracted ${text.length.toLocaleString()} characters from ${file.name}`);
    } catch (err) {
      console.error('PDF parse error:', err);
      toast.error('Failed to parse PDF. Try pasting the text content instead.');
      setStep('input');
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePDFFile(file);
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePDFFile(file);
  };

  const handleExtract = async () => {
    if (!sourceText.trim()) {
      toast.error('Please paste case file content');
      return;
    }

    setStep('extracting');
    setProgress(10);
    setError(null);

    try {
      const result = await submitCaseText(sourceText);
      setCaseId(result.caseId);
      setExtractedData(result.extracted);
      setStep('extracted');
      setProgress(25);
      toast.success('Case data extracted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setStep('error');
      toast.error('Failed to extract case data');
    }
  };

  const handleAnalyze = async () => {
    if (!caseId) return;

    setStep('analyzing');
    setProgress(30);

    // Poll for progress
    const pollInterval = setInterval(async () => {
      try {
        const status = await getProcessingStatus(caseId);
        if (status) {
          setProgress(status.progress || 30);
          setCurrentRole(status.current_step?.replace('analyzing_', '') || '');
          if (status.status === 'complete') {
            clearInterval(pollInterval);
          }
        }
      } catch { /* ignore polling errors */ }
    }, 2000);

    try {
      await runSOUPYAnalysis(caseId);
      clearInterval(pollInterval);
      setStep('complete');
      setProgress(100);
      toast.success('SOUPY analysis complete!');
    } catch (err) {
      clearInterval(pollInterval);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('error');
      toast.error('Analysis failed');
    }
  };

  const handleViewCase = () => {
    if (caseId) {
      onCaseCreated(caseId);
      setOpen(false);
      reset();
    }
  };

  const loadSample = () => {
    setSourceText(SAMPLE_CASE);
    toast.info('Sample case loaded — this is a TKA with potential unbundling');
  };

  const roleLabels: Record<string, string> = {
    builder: '🔨 Builder — Finding best-case interpretation...',
    redteam: '🛡️ Red Team — Identifying audit vulnerabilities...',
    analyst: '📊 Systems Analyst — Applying regulatory framework...',
    breaker: '⚡ Frame Breaker — Challenging assumptions...',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Case
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            New Case — AI-Powered Intake
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{step === 'input' ? 'Upload or paste case data' : step === 'parsing-pdf' ? 'Parsing PDF...' : step === 'extracting' ? 'Extracting...' : step === 'extracted' ? 'Review extraction' : step === 'analyzing' ? 'SOUPY Analysis' : step === 'complete' ? 'Complete' : 'Error'}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* PDF Parsing state */}
        {step === 'parsing-pdf' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
            <p className="text-sm font-medium">Parsing PDF: {uploadedFileName}...</p>
            <p className="text-xs text-muted-foreground">Extracting text from all pages</p>
          </div>
        )}

        {/* Step 1: Input */}
        {step === 'input' && (
          <div className="space-y-4">
            {/* PDF Upload Zone */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.txt,.csv,.hl7,.json,.xml"
              className="hidden"
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-accent bg-accent/10'
                  : uploadedFileName
                    ? 'border-consensus/40 bg-consensus/5'
                    : 'border-muted-foreground/20 hover:border-accent/40 hover:bg-accent/5'
              }`}
            >
              {uploadedFileName ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="h-5 w-5 text-consensus" />
                  <span className="text-sm font-medium">{uploadedFileName}</span>
                  <Badge variant="secondary" className="text-[10px]">Loaded</Badge>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium">Drop a PDF operative report here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">Supports: PDF, TXT, CSV, HL7, JSON, XML</p>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or paste text</span>
              <Separator className="flex-1" />
            </div>

            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={loadSample} className="text-xs">
                Load Sample Case
              </Button>
            </div>
            <Textarea
              placeholder="Paste operative report, 837 claim data, EHR notes, or any case documentation here..."
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              className="min-h-[200px] font-mono text-xs"
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {sourceText.length > 0 ? `${sourceText.length.toLocaleString()} characters${uploadedFileName ? ` from ${uploadedFileName}` : ''}` : 'Supports: Op reports, 837 files, clinical notes, claim summaries'}
              </span>
              <Button onClick={handleExtract} disabled={!sourceText.trim()}>
                <FileText className="h-4 w-4 mr-2" />
                Extract & Create Case
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Extracting */}
        {step === 'extracting' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
            <p className="text-sm font-medium">Extracting case data with AI...</p>
            <p className="text-xs text-muted-foreground">Identifying CPT codes, ICD-10 codes, provider info, and claim amounts</p>
          </div>
        )}

        {/* Step 3: Extracted — Review */}
        {step === 'extracted' && extractedData && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-consensus" />
                Extracted Case Data
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Patient</span>
                  <p className="font-mono">{extractedData.patient_id}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Provider</span>
                  <p>{extractedData.physician_name} ({extractedData.physician_id})</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Date of Service</span>
                  <p>{extractedData.date_of_service}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Claim Amount</span>
                  <p className="font-semibold">${extractedData.claim_amount?.toLocaleString()}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">CPT Codes</span>
                <div className="flex gap-2 flex-wrap">
                  {extractedData.cpt_codes?.map((c: string) => (
                    <Badge key={c} variant="outline" className="font-mono">{c}</Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">ICD-10 Codes</span>
                <div className="flex gap-2 flex-wrap">
                  {extractedData.icd_codes?.map((c: string) => (
                    <Badge key={c} variant="secondary" className="font-mono">{c}</Badge>
                  ))}
                </div>
              </div>
              {extractedData.summary && (
                <div>
                  <span className="text-xs text-muted-foreground">Clinical Summary</span>
                  <p className="text-xs mt-1">{extractedData.summary}</p>
                </div>
              )}
            </Card>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setStep('input'); setProgress(0); }}>
                Edit Source
              </Button>
              <Button onClick={handleAnalyze} className="gap-2">
                <Brain className="h-4 w-4" />
                Run SOUPY Analysis
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Analyzing */}
        {step === 'analyzing' && (
          <div className="py-8 space-y-6">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-accent" />
              <p className="text-sm font-medium">SOUPY ThinkTank Protocol Running...</p>
              <p className="text-xs text-muted-foreground">4 AI perspectives analyzing your case simultaneously</p>
            </div>
            <div className="space-y-2">
              {['builder', 'redteam', 'analyst', 'breaker'].map((role) => {
                const isActive = currentRole === role;
                const isDone = ['builder', 'redteam', 'analyst', 'breaker'].indexOf(role) < 
                               ['builder', 'redteam', 'analyst', 'breaker'].indexOf(currentRole);
                return (
                  <div key={role} className={`rounded-md border p-3 text-xs transition-all ${isActive ? 'border-accent bg-accent/5' : isDone ? 'border-consensus/30 bg-consensus/5' : 'opacity-50'}`}>
                    {isDone ? (
                      <span className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-consensus" /> {role.charAt(0).toUpperCase() + role.slice(1)} — Complete</span>
                    ) : isActive ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> {roleLabels[role]}</span>
                    ) : (
                      <span className="text-muted-foreground">{role.charAt(0).toUpperCase() + role.slice(1)} — Waiting</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-consensus mx-auto" />
            <div>
              <p className="text-lg font-semibold">Analysis Complete</p>
              <p className="text-sm text-muted-foreground">4 AI perspectives generated. Case is ready for review.</p>
            </div>
            <Button onClick={handleViewCase} size="lg" className="gap-2">
              View Full Analysis
            </Button>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <p className="text-lg font-semibold">Something went wrong</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={reset}>Try Again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
