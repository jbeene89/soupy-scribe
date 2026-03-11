import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Brain, CheckCircle, AlertCircle, Loader2, File, X, Play, FolderOpen, FileArchive } from 'lucide-react';
import { toast } from 'sonner';
import { submitCaseText, runSOUPYAnalysis } from '@/lib/caseService';
import JSZip from 'jszip';

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

type FileItemStatus = 'pending' | 'parsing' | 'ready' | 'extracting' | 'extracted' | 'analyzing' | 'complete' | 'error';

interface FileItem {
  id: string;
  name: string;
  text: string;
  status: FileItemStatus;
  error?: string;
  caseId?: string;
  extractedData?: any;
}

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
  const [files, setFiles] = useState<FileItem[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFiles([]);
    setPasteText('');
    setIsDragging(false);
    setBatchRunning(false);
  }, []);

  const updateFile = (id: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const parseFile = async (file: File): Promise<{ name: string; text: string }> => {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const text = await extractTextFromPDF(file);
      if (!text.trim()) throw new Error('No text found — may be a scanned image');
      return { name: file.name, text };
    }
    const text = await file.text();
    return { name: file.name, text };
  };

  const addFiles = async (fileList: FileList) => {
    const newFiles: FileItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const id = crypto.randomUUID();
      newFiles.push({ id, name: file.name, text: '', status: 'parsing' });
    }
    setFiles(prev => [...prev, ...newFiles]);

    // Parse all in parallel
    const fileArray = Array.from(fileList);
    await Promise.all(fileArray.map(async (file, idx) => {
      const id = newFiles[idx].id;
      try {
        const { text } = await parseFile(file);
        updateFile(id, { text, status: 'ready' });
      } catch (err) {
        updateFile(id, { status: 'error', error: err instanceof Error ? err.message : 'Parse failed' });
      }
    }));
  };

  const addPasteAsFile = () => {
    if (!pasteText.trim()) return;
    const id = crypto.randomUUID();
    setFiles(prev => [...prev, { id, name: 'Pasted Text', text: pasteText, status: 'ready' }]);
    setPasteText('');
    toast.success('Text added to batch queue');
  };

  const loadSample = () => {
    const id = crypto.randomUUID();
    setFiles(prev => [...prev, { id, name: 'Sample TKA Case', text: SAMPLE_CASE, status: 'ready' }]);
    toast.info('Sample case added to batch queue');
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    if (e.target) e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const runBatch = async () => {
    const readyFiles = files.filter(f => f.status === 'ready');
    if (readyFiles.length === 0) {
      toast.error('No files ready to process');
      return;
    }

    setBatchRunning(true);
    let completedCount = 0;

    for (const fileItem of readyFiles) {
      // Step 1: Extract
      updateFile(fileItem.id, { status: 'extracting' });
      let caseId: string;
      try {
        const result = await submitCaseText(fileItem.text);
        caseId = result.caseId;
        updateFile(fileItem.id, { status: 'extracted', caseId, extractedData: result.extracted });
      } catch (err) {
        updateFile(fileItem.id, { status: 'error', error: err instanceof Error ? err.message : 'Extraction failed' });
        continue;
      }

      // Step 2: Analyze
      updateFile(fileItem.id, { status: 'analyzing' });
      try {
        await runSOUPYAnalysis(caseId);
        updateFile(fileItem.id, { status: 'complete' });
        completedCount++;
      } catch (err) {
        updateFile(fileItem.id, { status: 'error', error: err instanceof Error ? err.message : 'Analysis failed' });
      }
    }

    setBatchRunning(false);
    if (completedCount > 0) {
      toast.success(`${completedCount} case${completedCount > 1 ? 's' : ''} analyzed successfully`);
      // Notify parent about the first completed case
      const firstComplete = files.find(f => f.status === 'complete' && f.caseId);
      if (firstComplete?.caseId) {
        onCaseCreated(firstComplete.caseId);
      }
    }
  };

  const readyCount = files.filter(f => f.status === 'ready').length;
  const completeCount = files.filter(f => f.status === 'complete').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const processingCount = files.filter(f => ['extracting', 'extracted', 'analyzing'].includes(f.status)).length;
  const totalProgress = files.length > 0
    ? Math.round((completeCount / files.length) * 100)
    : 0;

  const statusIcon = (status: FileItemStatus) => {
    switch (status) {
      case 'parsing': return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
      case 'ready': return <FileText className="h-3.5 w-3.5 text-accent" />;
      case 'extracting': return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />;
      case 'extracted': return <CheckCircle className="h-3.5 w-3.5 text-accent" />;
      case 'analyzing': return <Brain className="h-3.5 w-3.5 animate-pulse text-accent" />;
      case 'complete': return <CheckCircle className="h-3.5 w-3.5 text-consensus" />;
      case 'error': return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <File className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: FileItemStatus) => {
    switch (status) {
      case 'parsing': return 'Parsing...';
      case 'ready': return 'Ready';
      case 'extracting': return 'Extracting...';
      case 'extracted': return 'Extracted';
      case 'analyzing': return 'Analyzing...';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return 'Pending';
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="h-4 w-4" />
          Upload Cases
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            Batch Case Upload
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        {files.length > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{completeCount} of {files.length} complete{errorCount > 0 ? ` · ${errorCount} error${errorCount > 1 ? 's' : ''}` : ''}</span>
              <span>{totalProgress}%</span>
            </div>
            <Progress value={totalProgress} className="h-2" />
          </div>
        )}

        {/* Drop zone */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.txt,.csv,.hl7,.json,.xml"
          className="hidden"
          multiple
        />
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-accent bg-accent/10'
              : 'border-muted-foreground/20 hover:border-accent/40 hover:bg-accent/5'
          }`}
        >
          <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">Drop multiple files here, or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, TXT, CSV, HL7, JSON, XML — select multiple at once</p>
        </div>

        {/* Paste text section */}
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or paste text</span>
          <Separator className="flex-1" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={loadSample} className="text-xs">
              Load Sample Case
            </Button>
          </div>
          <Textarea
            placeholder="Paste an operative report and click 'Add to Queue'..."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="min-h-[100px] font-mono text-xs"
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {pasteText.length > 0 ? `${pasteText.length.toLocaleString()} characters` : ''}
            </span>
            <Button variant="secondary" size="sm" onClick={addPasteAsFile} disabled={!pasteText.trim()}>
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Add to Queue
            </Button>
          </div>
        </div>

        {/* File queue */}
        {files.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Queue ({files.length} file{files.length !== 1 ? 's' : ''})</h3>
                {!batchRunning && readyCount > 0 && (
                  <Button onClick={runBatch} size="sm" className="gap-1.5">
                    <Play className="h-3.5 w-3.5" />
                    Process All ({readyCount})
                  </Button>
                )}
                {batchRunning && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing...
                  </Badge>
                )}
              </div>
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-1.5">
                  {files.map((f) => (
                    <Card key={f.id} className={`p-3 flex items-center gap-3 ${f.status === 'error' ? 'border-destructive/30' : f.status === 'complete' ? 'border-consensus/30' : ''}`}>
                      {statusIcon(f.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{f.name}</p>
                        {f.error && <p className="text-[10px] text-destructive truncate">{f.error}</p>}
                        {f.extractedData?.cpt_codes && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {f.extractedData.cpt_codes.slice(0, 4).map((c: string) => (
                              <Badge key={c} variant="outline" className="text-[9px] px-1 py-0 font-mono">{c}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Badge variant={f.status === 'complete' ? 'default' : f.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {statusLabel(f.status)}
                      </Badge>
                      {!batchRunning && f.status !== 'complete' && (
                        <button onClick={() => removeFile(f.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {f.status === 'complete' && f.caseId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => {
                            onCaseCreated(f.caseId!);
                            setOpen(false);
                            reset();
                          }}
                        >
                          View
                        </Button>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* All done summary */}
        {!batchRunning && completeCount > 0 && completeCount === files.length && (
          <div className="text-center py-4 space-y-3">
            <CheckCircle className="h-10 w-10 text-consensus mx-auto" />
            <p className="text-sm font-semibold">All {completeCount} cases analyzed!</p>
            <Button onClick={() => { setOpen(false); reset(); }}>
              Close & View Cases
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
