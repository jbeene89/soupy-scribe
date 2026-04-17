import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FilePlus, Loader2, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PsychFileDropzone } from './PsychFileDropzone';

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
  const [docText, setDocText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const reset = () => {
    setDocLabel('');
    setDocText('');
    setAnalyzing(false);
  };

  const handleSubmit = () => {
    if (!docLabel.trim() || !docText.trim()) {
      toast.error('Please add both a document label and document content');
      return;
    }
    setAnalyzing(true);
    // Simulated re-analysis delay (the engine itself is synchronous)
    setTimeout(() => {
      onAddDocument(docLabel.trim(), docText.trim());
      toast.success(`Re-audited as version ${currentVersion + 1}`);
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
            Add Document to {caseLabel}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Attach a superbill, addendum, or any supporting document. The audit will re-run with the new
            information and save as <span className="font-semibold">version {currentVersion + 1}</span>.
            Your previous report stays available.
          </DialogDescription>
        </DialogHeader>

        {!analyzing ? (
          <div className="space-y-4">
            {/* Doc type suggestions */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">What kind of document?</p>
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
                placeholder="e.g. Superbill, Updated Treatment Plan..."
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                className="text-xs"
              />
            </div>

            {/* File upload */}
            <PsychFileDropzone
              label="Upload a file"
              onExtracted={(r) => {
                setDocText(r.text);
                if (!docLabel) {
                  const stem = r.fileName.replace(/\.[^.]+$/, '');
                  setDocLabel(stem.length > 60 ? stem.slice(0, 60) : stem);
                }
              }}
            />

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">or paste text</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Doc content */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Document content</p>
              <Textarea
                placeholder="Paste the full text here, or use the upload area above..."
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                className="min-h-[140px] font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                {docText.length > 0 ? `${docText.length.toLocaleString()} characters` : 'Tip: include billing codes, dates, signatures, or supporting language'}
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); reset(); }}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={!docLabel.trim() || !docText.trim()}
              >
                <FileText className="h-4 w-4" />
                Add & Re-Audit
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-violet-500" />
            <p className="text-sm font-medium">Re-running audit with new document...</p>
            <p className="text-xs text-muted-foreground">Combining original case + {docLabel} and re-checking all rules</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
