import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Loader2, Sparkles, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { extractTextFromFile } from '@/lib/fileTextExtractor';
import { uploadVendorWatchDocument, analyzeVendorWatchDocument } from '@/lib/vendorWatchService';

type ModuleKey =
  | 'auto'
  | 'vendor_watch'
  | 'clawback'
  | 'imaging'
  | 'cases'
  | 'psych'
  | 'ehr';

type Classification = {
  module: Exclude<ModuleKey, 'auto'> | 'unknown';
  doc_type: string;
  detected_vendor_name: string;
  summary: string;
  confidence: number;
  reasoning: string;
};

const MODULE_LABELS: Record<Exclude<ModuleKey, 'auto'>, string> = {
  vendor_watch: 'Vendor Watch (contracts, fee schedules, remits, EOBs)',
  clawback: 'Clawback Shield (RAC / Cotiviti audit rosters)',
  imaging: 'Imaging Audit (radiology reports, peer-review denials)',
  cases: 'Case Reviews (single claim or chart for adversarial audit)',
  psych: 'Psych Practice (behavioral-health notes & evals)',
  ehr: 'EHR Integration (FHIR, HL7, C-CDA, EHR exports)',
};

const MODULE_ROUTES: Record<Exclude<ModuleKey, 'auto'> | 'unknown', string | null> = {
  vendor_watch: '/app/vendor-watch',
  clawback: '/app/clawback-shield',
  imaging: '/app/imaging',
  cases: '/app/cases',
  psych: '/app',          // psych mode entry is /app
  ehr: '/app/ehr',
  unknown: null,
};

export default function AppSmartUpload() {
  const navigate = useNavigate();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ModuleKey>('auto');
  const [busy, setBusy] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [vendorWatchDone, setVendorWatchDone] = useState<{ id: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function resetForFile(f: File | null) {
    setPendingFile(f);
    setClassification(null);
    setExtractedText('');
    setVendorWatchDone(null);
  }

  function onFiles(files: FileList | File[] | null) {
    if (!files || !('length' in files) || files.length === 0) return;
    const f = (files as FileList)[0] ?? (files as File[])[0];
    resetForFile(f);
  }

  async function classify() {
    if (!pendingFile) return null;
    let text = extractedText;
    if (!text) {
      try {
        const r = await extractTextFromFile(pendingFile);
        text = r.text || '';
        setExtractedText(text);
      } catch (e) {
        toast.error(`Could not read file: ${(e as Error).message}`);
        return null;
      }
    }
    const { data, error } = await supabase.functions.invoke('classify-upload', {
      body: { text: text.slice(0, 8000), filename: pendingFile.name, mimeType: pendingFile.type },
    });
    if (error) {
      toast.error(`Auto-detect failed: ${error.message}`);
      return null;
    }
    const c = data as Classification;
    setClassification(c);
    return c;
  }

  async function handleProcess() {
    if (!pendingFile) { toast.error('Pick a file first'); return; }
    setBusy(true);
    try {
      let target: Exclude<ModuleKey, 'auto'> | 'unknown';
      let info: Classification | null = classification;

      if (mode === 'auto') {
        info = await classify();
        if (!info) return;
        if (info.module === 'unknown') {
          toast.warning('Auto-detect could not identify this file. Pick a module manually.');
          return;
        }
        target = info.module;
      } else {
        target = mode;
      }

      // Vendor Watch is fully wired end-to-end here: upload + analyze in place.
      if (target === 'vendor_watch') {
        toast.info('Uploading to Vendor Watch…');
        const doc = await uploadVendorWatchDocument({
          file: pendingFile,
          vendorKey: '',
          vendorName: info?.detected_vendor_name || '',
          docType: 'auto',
        });
        setVendorWatchDone({ id: doc.id });
        if (doc.status === 'pending') {
          toast.info('Analyzing…');
          try {
            await analyzeVendorWatchDocument(doc.id);
            toast.success('Analyzed. Opening Vendor Watch.');
          } catch (e) {
            toast.error(`Analysis failed: ${(e as Error).message}`);
          }
        }
        navigate('/app/vendor-watch');
        return;
      }

      // Other modules — deep-link the user with the file kept in a handoff state.
      const route = MODULE_ROUTES[target];
      if (!route) {
        toast.warning('No route available for this module yet.');
        return;
      }
      toast.success(`Routing to ${MODULE_LABELS[target as Exclude<ModuleKey, 'auto'>] || target}`);
      navigate(route);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePeek() {
    if (!pendingFile) { toast.error('Pick a file first'); return; }
    setBusy(true);
    try {
      await classify();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> Smart Upload
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop any file. SOUPY peeks inside and routes it to the right module — or pick a module yourself.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose a file</CardTitle>
          <CardDescription>PDF, DOCX, XLSX, CSV, TXT, JSON, FHIR, HL7, X12 / 835 / 837. Max 100 MB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/30',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            {pendingFile ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{pendingFile.name}</span>
                <span className="text-muted-foreground">({(pendingFile.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drop a file here, or click to browse</p>
              </div>
            )}
          </div>
          {pendingFile && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => resetForFile(null)}>Clear</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Routing</CardTitle>
          <CardDescription>Let SOUPY peek and decide, or pick the module yourself.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Where should this go?</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ModuleKey)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">✨ Auto-detect (SOUPY reads the file and picks)</SelectItem>
                {(Object.keys(MODULE_LABELS) as Array<Exclude<ModuleKey, 'auto'>>).map(k => (
                  <SelectItem key={k} value={k}>{MODULE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'auto' && pendingFile && (
            <Button variant="outline" size="sm" onClick={handlePeek} disabled={busy}>
              {busy ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Peeking…</> : <><Sparkles className="h-3 w-3 mr-1" />Peek first (preview the guess)</>}
            </Button>
          )}

          {classification && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {classification.module === 'unknown' ? (
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />Could not classify
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {MODULE_LABELS[classification.module] || classification.module}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px]">{classification.doc_type}</Badge>
                {classification.detected_vendor_name && (
                  <Badge variant="secondary" className="text-[10px]">{classification.detected_vendor_name}</Badge>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">
                  confidence {Math.round(classification.confidence * 100)}%
                </span>
              </div>
              {classification.summary && <p className="text-foreground/90">{classification.summary}</p>}
              {classification.reasoning && <p className="text-[11px] text-muted-foreground italic">Why: {classification.reasoning}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button onClick={handleProcess} disabled={!pendingFile || busy} size="lg">
          {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Working…</> : <>Process file<ArrowRight className="h-4 w-4 ml-1" /></>}
        </Button>
      </div>

      {vendorWatchDone && (
        <div className="text-xs text-muted-foreground text-right">
          Vendor Watch document created. Redirecting…
        </div>
      )}
    </div>
  );
}