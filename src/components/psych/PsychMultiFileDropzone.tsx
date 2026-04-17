import { useRef, useState } from 'react';
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractTextFromFile } from '@/lib/fileTextExtractor';
import { toast } from 'sonner';

export type ExtractedFile = {
  id: string;
  fileName: string;
  text: string;
  chars: number;
  pages?: number;
};

interface PsychMultiFileDropzoneProps {
  files: ExtractedFile[];
  onFilesChange: (files: ExtractedFile[]) => void;
  /** Called once with the first successful filename, useful for auto-labeling */
  onFirstFileName?: (fileName: string) => void;
  label?: string;
  sublabel?: string;
}

export function PsychMultiFileDropzone({
  files,
  onFilesChange,
  onFirstFileName,
  label = 'Drop one or more documents here',
  sublabel = 'PDF, Word (.docx), or text files · up to 20MB each',
}: PsychMultiFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<{ fileName: string; message: string }[]>([]);

  const handleFiles = async (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length === 0) return;

    setExtracting(prev => [...prev, ...list.map(f => f.name)]);

    const wasEmpty = files.length === 0;
    const newlyExtracted: ExtractedFile[] = [];
    const newErrors: { fileName: string; message: string }[] = [];

    for (const file of list) {
      try {
        const result = await extractTextFromFile(file);
        if (result.warning && !result.text) {
          newErrors.push({ fileName: file.name, message: result.warning });
          continue;
        }
        newlyExtracted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          text: result.text,
          chars: result.text.length,
          pages: result.pages,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to read file';
        newErrors.push({ fileName: file.name, message });
      }
    }

    setExtracting(prev => prev.filter(n => !list.some(f => f.name === n)));
    setErrors(prev => [...prev, ...newErrors]);

    if (newlyExtracted.length > 0) {
      onFilesChange([...files, ...newlyExtracted]);
      if (wasEmpty && onFirstFileName) onFirstFileName(newlyExtracted[0].fileName);
      toast.success(
        newlyExtracted.length === 1
          ? `Read ${newlyExtracted[0].fileName}`
          : `Read ${newlyExtracted.length} files`,
        {
          description: `${newlyExtracted.reduce((s, f) => s + f.chars, 0).toLocaleString()} characters extracted`,
        }
      );
    }

    if (newErrors.length > 0) {
      toast.error(
        newErrors.length === 1
          ? `Couldn't read ${newErrors[0].fileName}`
          : `Couldn't read ${newErrors.length} files`,
        { description: newErrors[0].message }
      );
    }
  };

  const onPick = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    onFilesChange(files.filter(f => f.id !== id));
  };

  const clearError = (idx: number) => {
    setErrors(prev => prev.filter((_, i) => i !== idx));
  };

  const isExtracting = extracting.length > 0;
  const isEmpty = files.length === 0 && !isExtracting;

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={isEmpty ? onPick : undefined}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          isEmpty && 'cursor-pointer border-border hover:border-violet-500/60 hover:bg-violet-500/5 p-5 text-center',
          !isEmpty && 'border-violet-500/40 bg-violet-500/[0.03] p-3',
          dragOver && 'border-violet-500 bg-violet-500/10',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.csv,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {isEmpty && (
          <div className="flex flex-col items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-violet-500" />
            </div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{sublabel}</p>
            <Button type="button" variant="outline" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); onPick(); }}>
              Choose files
            </Button>
          </div>
        )}

        {!isEmpty && (
          <div className="space-y-1.5">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-2 rounded-md bg-background/60 border border-border px-2.5 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{f.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {f.chars.toLocaleString()} chars{f.pages ? ` · ${f.pages}p` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={(e) => { e.stopPropagation(); removeFile(f.id); }}
                  aria-label={`Remove ${f.fileName}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {extracting.map(name => (
              <div key={name} className="flex items-center gap-2 rounded-md bg-background/60 border border-border px-2.5 py-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500 shrink-0" />
                <p className="text-xs text-muted-foreground truncate flex-1">Reading {name}...</p>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-1 text-xs gap-1.5"
              onClick={(e) => { e.stopPropagation(); onPick(); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add more files
            </Button>
          </div>
        )}
      </div>

      {errors.map((err, i) => (
        <div key={i} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-2">
          <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{err.fileName}</p>
            <p className="text-[10px] text-muted-foreground">{err.message}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 shrink-0"
            onClick={() => clearError(i)}
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
