import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Paperclip, Trash2, Loader2, Download, FileText, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export type VendorScope = "contract" | "anomaly" | "deal" | "roi";

type Attachment = { path: string; name: string; size: number; mime: string };

interface Submission {
  id: string;
  entry_type: string;
  title: string | null;
  body: string;
  attachments: Attachment[];
  occurred_at: string;
  created_at: string;
}

const ENTRY_TYPES: { value: string; label: string }[] = [
  { value: "note",        label: "Note" },
  { value: "call",        label: "Call log" },
  { value: "email_draft", label: "Email draft" },
  { value: "email_sent",  label: "Email sent" },
  { value: "response",    label: "Vendor response" },
  { value: "evidence",    label: "Evidence" },
];

const BUCKET = "vendor-submissions";

export function VendorSubmissions({
  vendorKey, scope, scopeRef, label,
}: { vendorKey: string; scope: VendorScope; scopeRef?: string; label?: string }) {
  const { session } = useAuth();
  const user = session?.user ?? null;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [entryType, setEntryType] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("vendor_submissions")
      .select("*").eq("owner_id", user.id)
      .eq("vendor_key", vendorKey).eq("scope", scope)
      .order("occurred_at", { ascending: false });
    if (scopeRef) q = q.eq("scope_ref", scopeRef);
    const { data, error } = await q;
    if (error) { toast.error(error.message); }
    else setItems((data ?? []) as unknown as Submission[]);
    setLoading(false);
  }

  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, vendorKey, scope, scopeRef, user?.id]);

  async function submit() {
    if (!user) { toast.error("Sign in to save submissions"); return; }
    if (!body.trim() && pendingFiles.length === 0) { toast.error("Add a note or a file"); return; }
    setSaving(true);
    try {
      const attachments: Attachment[] = [];
      for (const f of pendingFiles) {
        const path = `${user.id}/${vendorKey}/${scope}/${Date.now()}-${f.name.replace(/[^a-z0-9._-]/gi, "_")}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f, { upsert: false, contentType: f.type || undefined });
        if (up.error) throw up.error;
        attachments.push({ path, name: f.name, size: f.size, mime: f.type || "application/octet-stream" });
      }
      const { error } = await supabase.from("vendor_submissions").insert([{
        owner_id: user.id, vendor_key: vendorKey, scope, scope_ref: scopeRef ?? null,
        entry_type: entryType, title: title.trim() || null, body: body.trim(),
        attachments: attachments as unknown as object,
      }]);
      if (error) throw error;
      toast.success("Submission saved");
      setBody(""); setTitle(""); setPendingFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function remove(s: Submission) {
    if (!confirm("Delete this submission?")) return;
    if (s.attachments?.length) {
      await supabase.storage.from(BUCKET).remove(s.attachments.map(a => a.path));
    }
    const { error } = await supabase.from("vendor_submissions").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    setItems(prev => prev.filter(p => p.id !== s.id));
  }

  async function downloadAttachment(a: Attachment) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.path, 60);
    if (error || !data) { toast.error(error?.message || "Failed to sign URL"); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="mt-2 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Submissions{label ? ` · ${label}` : ""}
        {items.length > 0 && <Badge variant="outline" className="text-[10px] ml-1">{items.length}</Badge>}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {!user && (
            <div className="text-[11px] text-muted-foreground">Sign in to add submissions and attachments.</div>
          )}

          {user && (
            <div className="rounded-md border bg-muted/30 p-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger className="h-7 text-xs w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  className="h-7 text-xs flex-1 min-w-[140px]"
                  placeholder="Title (optional)"
                  value={title} onChange={e => setTitle(e.target.value)}
                />
              </div>
              <Textarea
                className="text-xs min-h-[60px]"
                placeholder="Notes, what was said, next step…"
                value={body} onChange={e => setBody(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => setPendingFiles(Array.from(e.target.files ?? []))}
                />
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => fileRef.current?.click()}>
                  <Paperclip className="h-3 w-3 mr-1" />Attach files
                </Button>
                {pendingFiles.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {pendingFiles.length} file{pendingFiles.length === 1 ? "" : "s"} ready
                  </span>
                )}
                <div className="ml-auto">
                  <Button type="button" size="sm" className="h-7 text-xs" disabled={saving} onClick={submit}>
                    {saving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                    Save submission
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {loading && <div className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Loading…</div>}
            {!loading && items.length === 0 && <div className="text-[11px] text-muted-foreground">No submissions yet.</div>}
            {items.map(s => (
              <div key={s.id} className="rounded-md border p-2 text-xs space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {ENTRY_TYPES.find(t => t.value === s.entry_type)?.label ?? s.entry_type}
                  </Badge>
                  {s.title && <span className="font-semibold">{s.title}</span>}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {new Date(s.occurred_at).toLocaleString()}
                  </span>
                  <button onClick={() => remove(s)} className="text-muted-foreground hover:text-red-500" aria-label="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                {s.body && <div className="whitespace-pre-wrap text-foreground/90">{s.body}</div>}
                {s.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {s.attachments.map(a => (
                      <button
                        key={a.path}
                        onClick={() => downloadAttachment(a)}
                        className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] hover:bg-muted"
                      >
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[160px] truncate">{a.name}</span>
                        <Download className="h-3 w-3 opacity-60" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
