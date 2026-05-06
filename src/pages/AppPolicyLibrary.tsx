import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, ArrowLeft, FileText, ExternalLink, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listPolicies, upsertPolicy, deletePolicy,
  listVersions, addVersion, deleteVersion,
  type PayerPolicy, type PayerPolicyVersion,
} from "@/lib/policyLibraryService";

export default function AppPolicyLibrary() {
  const { session } = useAuth();
  const user = session?.user;

  const [policies, setPolicies] = useState<PayerPolicy[]>([]);
  const [active, setActive] = useState<PayerPolicy | null>(null);
  const [versions, setVersions] = useState<PayerPolicyVersion[]>([]);
  const [loading, setLoading] = useState(false);

  // New policy form
  const [showNew, setShowNew] = useState(false);
  const [pPayer, setPPayer] = useState("");
  const [pPolicyId, setPPolicyId] = useState("");
  const [pType, setPType] = useState("commercial");
  const [pTitle, setPTitle] = useState("");
  const [pUrl, setPUrl] = useState("");

  // New version form
  const [vLabel, setVLabel] = useState("");
  const [vStart, setVStart] = useState("");
  const [vEnd, setVEnd] = useState("");
  const [vText, setVText] = useState("");
  const [vSummary, setVSummary] = useState("");
  const [vUrl, setVUrl] = useState("");

  async function refresh() {
    try { setPolicies(await listPolicies()); } catch (e: any) { toast.error(e.message); }
  }
  async function openPolicy(p: PayerPolicy) {
    setActive(p); setLoading(true);
    try { setVersions(await listVersions(p.id)); } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user) refresh(); }, [user?.id]);

  async function handleCreatePolicy() {
    if (!pPolicyId.trim()) { toast.error("Policy ID required."); return; }
    try {
      const created = await upsertPolicy({
        payer: pPayer.trim() || null, policy_id: pPolicyId.trim(),
        policy_type: pType, title: pTitle.trim() || null, source_url: pUrl.trim() || null,
      });
      toast.success("Policy added.");
      setShowNew(false); setPPayer(""); setPPolicyId(""); setPTitle(""); setPUrl(""); setPType("commercial");
      await refresh();
      await openPolicy(created);
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleAddVersion() {
    if (!active) return;
    if (!vStart || !vText.trim()) { toast.error("Effective start and policy text are required."); return; }
    try {
      await addVersion({
        policy_id: active.id, version_label: vLabel.trim() || null,
        effective_start: vStart, effective_end: vEnd || null,
        policy_text: vText, change_summary: vSummary.trim() || null, source_url: vUrl.trim() || null,
      });
      toast.success("Version added.");
      setVLabel(""); setVStart(""); setVEnd(""); setVText(""); setVSummary(""); setVUrl("");
      setVersions(await listVersions(active.id));
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleDeleteVersion(id: string) {
    if (!confirm("Delete this version?")) return;
    try { await deleteVersion(id); if (active) setVersions(await listVersions(active.id)); }
    catch (e: any) { toast.error(e.message); }
  }

  async function handleDeletePolicy(p: PayerPolicy) {
    if (!confirm(`Delete policy ${p.policy_id} and all its versions?`)) return;
    try { await deletePolicy(p.id); if (active?.id === p.id) { setActive(null); setVersions([]); } await refresh(); toast.success("Deleted."); }
    catch (e: any) { toast.error(e.message); }
  }

  if (!user) return <div className="p-6"><Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">Sign in to manage the policy library.</p></CardContent></Card></div>;

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Payer Policy Library</h1>
          <p className="text-sm text-muted-foreground">Versioned LCD/NCD/MA/commercial policies. Stored versions feed the Policy Time Machine for DOS-aware audits.</p>
        </div>
      </div>

      {!active ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowNew(s => !s)}><Plus className="h-4 w-4 mr-2" />{showNew ? "Cancel" : "Add Policy"}</Button>
          </div>
          {showNew && (
            <Card>
              <CardHeader><CardTitle className="text-base">New Policy</CardTitle><CardDescription>One row per logical policy. Versions get added next.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Payer</Label><Input value={pPayer} onChange={(e)=>setPPayer(e.target.value)} placeholder="Aetna" /></div>
                  <div><Label>Policy ID</Label><Input value={pPolicyId} onChange={(e)=>setPPolicyId(e.target.value)} placeholder="L34466 / CP-0123 / NCD 220.6.17" /></div>
                  <div><Label>Policy Type</Label>
                    <select className="w-full h-10 px-3 rounded-md border bg-background" value={pType} onChange={(e)=>setPType(e.target.value)}>
                      <option value="commercial">Commercial</option><option value="LCD">LCD</option><option value="NCD">NCD</option><option value="MA">Medicare Advantage</option>
                    </select>
                  </div>
                  <div><Label>Title (optional)</Label><Input value={pTitle} onChange={(e)=>setPTitle(e.target.value)} placeholder="Spinal Fusion Coverage" /></div>
                </div>
                <div><Label>Source URL (optional)</Label><Input value={pUrl} onChange={(e)=>setPUrl(e.target.value)} placeholder="https://…" /></div>
                <Button onClick={handleCreatePolicy} className="w-full">Save Policy</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Policies ({policies.length})</CardTitle></CardHeader>
            <CardContent>
              {policies.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No policies yet — add one to start tracking versions.</p> :
                <div className="space-y-2">
                  {policies.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded border bg-card hover:bg-accent/30 cursor-pointer" onClick={()=>openPolicy(p)}>
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {p.policy_id}
                          <Badge variant="outline">{p.policy_type}</Badge>
                          {p.payer && <span className="text-xs text-muted-foreground font-normal">· {p.payer}</span>}
                        </div>
                        {p.title && <div className="text-xs text-muted-foreground">{p.title}</div>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e)=>{ e.stopPropagation(); handleDeletePolicy(p); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={()=>{ setActive(null); setVersions([]); }}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <Button variant="destructive" size="sm" onClick={()=>handleDeletePolicy(active)}><Trash2 className="h-4 w-4 mr-2" />Delete policy</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">{active.policy_id} <Badge variant="outline">{active.policy_type}</Badge></CardTitle>
              <CardDescription>{active.payer || "—"}{active.title ? ` · ${active.title}` : ""}</CardDescription>
              {active.source_url && <a href={active.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" /> source</a>}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Add Version</CardTitle><CardDescription>Each version stores the policy text in force during a date range. Leave Effective End blank if it's the current version.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Version Label</Label><Input value={vLabel} onChange={(e)=>setVLabel(e.target.value)} placeholder="v6.2" /></div>
                <div><Label>Effective Start *</Label><Input type="date" value={vStart} onChange={(e)=>setVStart(e.target.value)} /></div>
                <div><Label>Effective End</Label><Input type="date" value={vEnd} onChange={(e)=>setVEnd(e.target.value)} /></div>
              </div>
              <div><Label>Source URL (optional)</Label><Input value={vUrl} onChange={(e)=>setVUrl(e.target.value)} /></div>
              <div><Label>Change Summary (optional)</Label><Input value={vSummary} onChange={(e)=>setVSummary(e.target.value)} placeholder="Tightened conservative therapy requirement to 6 months" /></div>
              <div><Label>Policy Text *</Label><Textarea rows={8} value={vText} onChange={(e)=>setVText(e.target.value)} placeholder="Full policy excerpt…" /></div>
              <Button onClick={handleAddVersion} className="w-full"><Plus className="h-4 w-4 mr-2" />Save Version</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Versions ({versions.length})</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
               versions.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No versions yet — add the earliest version above.</p> :
              (
                <div className="space-y-3">
                  {versions.map((v, i) => (
                    <div key={v.id} className="p-3 rounded border bg-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{v.effective_start}</span>
                            <span className="text-muted-foreground">→</span>
                            <span>{v.effective_end || "current"}</span>
                            {v.version_label && <Badge variant="outline">{v.version_label}</Badge>}
                            {i === 0 && !v.effective_end && <Badge>active</Badge>}
                          </div>
                          {v.change_summary && <div className="text-sm mt-1">{v.change_summary}</div>}
                          <details className="mt-2"><summary className="text-xs text-muted-foreground cursor-pointer">Show policy text</summary><pre className="text-xs bg-muted/40 p-2 rounded mt-2 whitespace-pre-wrap max-h-64 overflow-auto">{v.policy_text}</pre></details>
                        </div>
                        <Button variant="ghost" size="icon" onClick={()=>handleDeleteVersion(v.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}