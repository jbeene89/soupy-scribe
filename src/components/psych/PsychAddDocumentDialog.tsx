import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FilePlus, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PsychMultiFileDropzone, type ExtractedFile } from './PsychMultiFileDropzone';

interface PsychAddDocumentDialogProps {
  caseLabel: string;
  currentVersion: number;
  onAddDocument: (docLabel: string, docText: string) => void;
  trigger?: React.ReactNode;
}

const DOC_TYPE_SUGGESTIONS = [
  'Superbill / Claim',
  'Updated Treatment Plan',
  'Authorization Letter',
  'Addendum to Note',
  'Screening Tool Results',
  'Supervisor Sign-Off',
];

export function PsychAddDocumentDialog({
  caseLabel,
  currentVersion,
  onAddDocument,
  trigger,
}: PsychAddDocumentDialogProps) {
  const [open, setOpen] = useState(false);
  const [docLabel, setDocLabel] = useState('');
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [pastedText, setPastedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const reset = () => {
    setDocLabel('');
    setExtractedFiles([]);
    setPastedText('');
    setAnalyzing(false);
  };

  // Combine all uploaded files + pasted text into one document blob.
  const combinedText = (() => {
    const parts: string[] = [];
    for (const f of extractedFiles) {
      parts.push(`=== ${f.fileName} ===\n${f.text}`);
    }
    if (pastedText.trim()) {
      parts.push(`=== Pasted Text ===\n${pastedText.trim()}`);
    }
    return parts.join('\n\n');
  })();

  const totalChars = combinedText.length;
  const hasContent = totalChars > 0;

  const handleSubmit = () => {
    if (!docLabel.trim() || !hasContent) {
      toast.error('Please add a label and at least one file or pasted text');
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      onAddDocument(docLabel.trim(), combinedText);
      const fileCount = extractedFiles.length;
      const desc = fileCount > 0
        ? `${fileCount} file${fileCount !== 1 ? 's' : ''}${pastedText.trim() ? ' + pasted text' : ''} merged`
        : 'Pasted text added';
      toast.success(`Re-audited as version ${currentVersion + 1}`, { description: desc });
      setOpen(false);
      reset();
    }, 900);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <FilePlus className="h-3.5 w-3.5" />
            Add Document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-violet-500" />
            Add Document(s) to {caseLabel}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Upload one or more supporting documents — superbill, addendum, lab report, etc.
            Everything gets combined and re-audited as <span className="font-semibold">version {currentVersion + 1}</span>.
            Your previous report stays available.
          </DialogDescription>
        </DialogHeader>

        {!analyzing ? (
          <div className="space-y-4">
            {/* Doc type suggestions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">What kind of document(s)?</p>
              <div className="flex flex-wrap gap-1.5">
                {DOC_TYPE_SUGGESTIONS.map((s) => (
                  <Badge
                    key={s}
                    variant={docLabel === s ? 'default' : 'outline'}
                    className="cursor-pointer text-[10px] hover:bg-secondary"
                    onClick={() => setDocLabel(s)}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Custom label input */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Document label</p>
              <Input
                placeholder="e.g. Superbill, Updated Treatment Plan, Lab Results..."
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* Multi-file upload */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Upload files</p>
              <PsychMultiFileDropzone
                files={extractedFiles}
                onFilesChange={setExtractedFiles}
                onFirstFileName={(fileName) => {
                  if (!docLabel.trim()) {
                    const cleanName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
                    setDocLabel(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
                  }
                }}
                label="Drop one or more documents here"
                sublabel="PDF, Word (.docx), or text files · up to 20MB each"
              />
            </div>

            {/* Optional pasted text */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Or paste additional text {extractedFiles.length > 0 && <span className="text-muted-foreground/70">(combined with uploaded files)</span>}
              </p>
              <Textarea
                placeholder="Paste any extra notes, billing codes, or supporting language..."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="min-h-[120px] font-mono text-xs"
              />
            </div>

            {hasContent && (
              <div className="rounded-md bg-violet-500/5 border border-violet-500/20 px-3 py-2">
                <p className="text-[11px] text-foreground">
                  <span className="font-semibold">Ready to re-audit:</span>{' '}
                  {extractedFiles.length > 0 && (
                    <span>{extractedFiles.length} file{extractedFiles.length !== 1 ? 's' : ''}</span>
                  )}
                  {extractedFiles.length > 0 && pastedText.trim() && <span> + pasted text</span>}
                  {extractedFiles.length === 0 && pastedText.trim() && <span>pasted text only</span>}
                  <span className="text-muted-foreground"> · {totalChars.toLocaleString()} total characters</span>
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={!docLabel.trim() || !hasContent}
              >
                <FileText className="h-4 w-4" />
                Add & Re-Audit
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-violet-500" />
            <p className="text-sm font-medium">Re-running audit with new documents...</p>
            <p className="text-xs text-muted-foreground">
              Combining {extractedFiles.length > 0 ? `${extractedFiles.length} file${extractedFiles.length !== 1 ? 's' : ''}` : 'pasted text'} with the original case and re-checking all rules
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
