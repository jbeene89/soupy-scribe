import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { FileText, Paperclip, Trash2, MessageSquarePlus } from 'lucide-react';

/**
 * Follow-up notes panel — patient can append new evidence (text + files)
 * after the initial review completes. Stored locally in the browser
 * (localStorage), keyed by case id. No re-analysis is triggered.
 * Files are kept as data-URLs so they survive a refresh.
 */

type FollowupFile = { name: string; type: string; size: number; dataUrl: string };
type FollowupEntry = {
  id: string;
  createdAt: string;
  text: string;
  files: FollowupFile[];
};

function storageKey(caseId: string) {
  return `psh-followups-${caseId}`;
}

function loadEntries(caseId: string): FollowupEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(caseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(caseId: string, entries: FollowupEntry[]) {
  try {
    localStorage.setItem(storageKey(caseId), JSON.stringify(entries));
  } catch (err) {
    console.warn('Could not save follow-up notes', err);
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function FollowupNotesPanel({ caseId }: { caseId: string | null }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<FollowupEntry[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!caseId) return;
    setEntries(loadEntries(caseId));
  }, [caseId]);

  if (!caseId) return null;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setPending((prev) => [...prev, ...Array.from(incoming)].slice(0, 10));
  };

  const removePending = (idx: number) => {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEntry = async () => {
    if (!text.trim() && pending.length === 0) {
      toast({ title: 'Nothing to save', description: 'Add a note or attach a file first.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const filesEncoded: FollowupFile[] = [];
      for (const f of pending) {
        if (f.size > 5 * 1024 * 1024) {
          toast({ title: `${f.name} skipped`, description: 'Follow-up attachments must be under 5 MB each.', variant: 'destructive' });
          continue;
        }
        const dataUrl = await fileToDataUrl(f);
        filesEncoded.push({ name: f.name, type: f.type, size: f.size, dataUrl });
      }
      const next: FollowupEntry[] = [
        ...entries,
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          text: text.trim(),
          files: filesEncoded,
        },
      ];
      setEntries(next);
      saveEntries(caseId, next);
      setText('');
      setPending([]);
      if (fileRef.current) fileRef.current.value = '';
      toast({ title: 'Saved', description: 'Your follow-up note was saved to this case (in this browser).' });
    } catch (err) {
      toast({ title: 'Could not save', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = (id: string) => {
    const next = entries.filter((e) => e.id !== id);
    setEntries(next);
    saveEntries(caseId, next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquarePlus className="h-5 w-5 text-primary" />
          Add follow-up note or new evidence
        </CardTitle>
        <CardDescription>
          Remembered something else? Got a new document? Add it here. Notes are kept on this device,
          attached to this case, and shown below. They are not re-analyzed automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Found a discharge instruction sheet that says X. Or: nurse name I forgot earlier was…"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Paperclip className="h-4 w-4 mr-1" /> Attach file
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,image/*,.txt,.rtf"
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button type="button" onClick={saveEntry} disabled={saving}>
            {saving ? 'Saving…' : 'Save follow-up'}
          </Button>
          <span className="text-xs text-muted-foreground">Up to 10 attachments per note, 5 MB each.</span>
        </div>

        {pending.length > 0 && (
          <div className="space-y-1">
            {pending.map((f, i) => (
              <div key={i} className="flex items-center justify-between border rounded px-2 py-1 text-sm">
                <span className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removePending(i)}>Remove</Button>
              </div>
            ))}
          </div>
        )}

        {entries.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Saved follow-ups ({entries.length})
            </div>
            {entries.slice().reverse().map((e) => (
              <div key={e.id} className="border rounded p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(e.createdAt).toLocaleString()}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => deleteEntry(e.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {e.text && <p className="whitespace-pre-wrap text-sm">{e.text}</p>}
                {e.files.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {e.files.map((f, i) => (
                      <a
                        key={i}
                        href={f.dataUrl}
                        download={f.name}
                        className="inline-flex items-center gap-1 text-xs underline text-primary"
                      >
                        <FileText className="h-3 w-3" /> {f.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}