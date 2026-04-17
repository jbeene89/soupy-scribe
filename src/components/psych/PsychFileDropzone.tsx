/**
 * Reusable drag-and-drop file picker for the Behavioral Health flows.
 *
 * Accepts PDF, DOCX, TXT, MD, CSV, RTF. Extracts text in the browser and
 * passes the result up. Shows clear feedback for scanned PDFs (no text layer).
 */
import { useRef, useState, type DragEvent, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ACCEPT_ATTRIBUTE, extractTextFromFile, type ExtractResult } from '@/lib/fileTextExtractor';

interface Props {
  onExtracted: (result: ExtractResult) => void;
  /** Optional label shown above the drop area */
  label?: string;
  /** Hide the dropzone entirely once a file has been processed (useful in dialogs) */
  resetTrigger?: number;
}

export function PsychFileDropzone({ onExtracted, label = 'Or upload a file', resetTrigger }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastFile, setLastFile] = useState<{ name: string; pages?: number; warning?: string } | null>(null);

  // Reset state when parent flips the resetTrigger
  if (resetTrigger !== undefined && lastFile && resetTrigger === 0) {
    setLastFile(null);
  }

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error('File is larger than 20 MB. Please use a smaller file or split it.');
      return;
    }
    setBusy(true);
    try {
      const result = await extractTextFromFile(file);
      if (result.warning && !result.text) {
        // Scanned PDF / unreadable — surface the warning, don't pretend we got text.
        setLastFile({ name: result.fileName, pages: result.pageCount, warning: result.warning });
        toast.error('Could not read text from this file', { description: result.warning });
      } else {
        setLastFile({ name: result.fileName, pages: result.pageCount, warning: result.warning });
        onExtracted(result);
        toast.success(`Loaded "${result.fileName}"`, {
          description: result.pageCount
            ? `${result.pageCount} page${result.pageCount !== 1 ? 's' : ''} · ${result.text.length.toLocaleString()} characters`
            : `${result.text.length.toLocaleString()} characters`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong reading the file.';
      toast.error('Upload failed', { description: msg });
    } finally {
      setBusy(false);
      // Reset the input so the same file can be picked again if needed
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  const clear = () => {
    setLastFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed transition-colors
          px-4 py-5 text-center
          ${dragOver ? 'border-violet-500 bg-violet-500/5' : 'border-border hover:border-violet-500/50 hover:bg-secondary/40'}
          ${busy ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          onChange={onChange}
          className="hidden"
        />

        {busy ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            Reading file…
          </div>
        ) : lastFile ? (
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2 text-xs">
              <FileText className="h-4 w-4 text-violet-500 shrink-0" />
              <span className="font-medium text-foreground truncate max-w-[260px]">{lastFile.name}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={(e) => { e.stopPropagation(); clear(); }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {lastFile.pages && (
              <p className="text-[10px] text-muted-foreground">{lastFile.pages} page{lastFile.pages !== 1 ? 's' : ''} extracted</p>
            )}
            {lastFile.warning && (
              <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-600 bg-amber-500/10 rounded px-2 py-1.5 text-left">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{lastFile.warning}</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">Click to choose a different file</p>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-xs font-medium text-foreground">
              Drop a file or <span className="text-violet-600 dark:text-violet-400">browse</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              PDF, Word (.docx), or text · up to 20 MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
