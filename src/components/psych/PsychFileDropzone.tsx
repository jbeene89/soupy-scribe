import { useRef, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractTextFromFile } from '@/lib/fileTextExtractor';
import { toast } from 'sonner';

interface PsychFileDropzoneProps {
  /** Called with extracted plain text and the original filename */
  onTextExtracted: (text: string, fileName: string) => void;
  /** Optional label override */
  label?: string;
  /** Optional sublabel override */
  sublabel?: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'extracting'; fileName: string }
  | { kind: 'success'; fileName: string; chars: number; pages?: number }
  | { kind: 'error'; message: string };

export function PsychFileDropzone({
  onTextExtracted,
  label = 'Drop a session note, superbill, or claim PDF here',
  sublabel = 'PDF, Word, text, or FHIR (.json/.ndjson) · up to 20MB',
}: PsychFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File) => {
    setState({ kind: 'extracting', fileName: file.name });
    try {
      const result = await extractTextFromFile(file);
      if (result.warning && !result.text) {
        setState({ kind: 'error', message: result.warning });
        toast.error('Could not read this file', { description: result.warning });
        return;
      }
      setState({
        kind: 'success',
        fileName: file.name,
        chars: result.text.length,
        pages: result.pages,
      });
      onTextExtracted(result.text, file.name);
      toast.success('File read successfully', {
        description: `${result.text.length.toLocaleString()} characters extracted`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to read file';
      setState({ kind: 'error', message });
      toast.error('Could not read this file', { description: message });
    }
  };

  const onPick = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => setState({ kind: 'idle' });

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={state.kind === 'idle' || state.kind === 'error' ? onPick : undefined}
        className={cn(
          'relative rounded-lg border-2 border-dashed p-5 text-center transition-colors',
          state.kind === 'idle' && 'cursor-pointer border-border hover:border-violet-500/60 hover:bg-violet-500/5',
          state.kind === 'error' && 'cursor-pointer border-destructive/50 bg-destructive/5',
          state.kind === 'extracting' && 'border-violet-500/60 bg-violet-500/5',
          state.kind === 'success' && 'border-emerald-500/50 bg-emerald-500/5',
          dragOver && 'border-violet-500 bg-violet-500/10',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.xlsx,.xls,.txt,.md,.csv,.tsv,.rtf,.json,.ndjson,.xml,.hl7,.png,.jpg,.jpeg,.webp,.tif,.tiff,.dcm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/dicom,text/*,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        {state.kind === 'idle' && (
          <div className="flex flex-col items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
            <Button type="button" variant="outline" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); onPick(); }}>
              Choose file
            </Button>
          </div>
        )}

        {state.kind === 'extracting' && (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
            <p className="text-sm font-medium text-foreground">Reading {state.fileName}...</p>
            <p className="text-xs text-muted-foreground">Extracting text from your document</p>
          </div>
        )}

        {state.kind === 'success' && (
          <div className="flex items-center gap-3 text-left">
            <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {state.fileName}
              </p>
              <p className="text-xs text-muted-foreground">
                {state.chars.toLocaleString()} characters
                {state.pages ? ` · ${state.pages} page${state.pages !== 1 ? 's' : ''}` : ''}
                {' · '}loaded into the form below
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={(e) => { e.stopPropagation(); reset(); }}
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-sm font-medium text-foreground">Couldn't read that file</p>
            <p className="text-xs text-muted-foreground max-w-md">{state.message}</p>
            <Button type="button" variant="outline" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); reset(); onPick(); }}>
              Try a different file
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
