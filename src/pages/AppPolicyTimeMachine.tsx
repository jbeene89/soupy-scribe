import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Play, Trash2, ArrowLeft, Loader2, AlertTriangle, CheckCircle2, ScrollText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { listChecks, runTimelineCheck, deleteCheck, type PolicyTimelineCheck } from "@/lib/policyTimelineService";

const SEV_VARIANT: Record<string, "destructive"|"secondary"|"outline"> = { high: "destructive", medium: "secondary", low: "outline" };

export default function AppPolicyTimeMachine() {
  const { session } = useAuth();
  const user = session?.user;

  const [checks, setChecks] = useState<PolicyTimelineCheck[]>([]);
  const [active, setActive] = useState<PolicyTimelineCheck | null>(null);
  const [running, setRunning] = useState(false);

  const [policyId, setPolicyId] = useState("");
  const [policyType, setPolicyType] = useState("commercial");
  const [payer, setPayer] = useState("");
  const [dos, setDos] = useState("");
  const [citedVersion, setCitedVersion] = useState("");
  const [citedDate, setCitedDate] = useState("");
  const [activeVersion, setActiveVersion] = useState("");
  const [activeDate, setActiveDate] = useState("");
  const [citedText, setCitedText] = useState("");
  const [activeText, setActiveText] = useState("");

  async function refresh() {
    try { setChecks(await listChecks()); } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { if (user) refresh(); }, [user?.id]);

  async function handleRun() {
    if (!policyId.trim() || !dos || !citedText.trim()) {
      toast.error("Policy ID, Date of Service, and cited policy text are required.");
      return;
    }
    setRunning(true);
    try {
      const res = await runTimelineCheck({
        policy_id: policyId.trim(),
        policy_type: policyType,
        payer: payer.trim() || null,
        date_of_service: dos,
        cited_policy_version: citedVersion.trim() || null,
        cited_policy_date: citedDate || null,
        active_policy_version: activeVersion.trim() || null,
        active_policy_date: activeDate || null,
        cited_policy_text: citedText,
        active_policy_text: activeText || undefined,
      });
      toast.success(res.mismatch ? `Mismatch detected — ${res.severity} severity.` : "No timeline mismatch.");
      setActive(res);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Check failed");
    } finally { setRunning(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this check?")) return;
    try { await deleteCheck(id); if (active?.id === id) setActive(null); await refresh(); }
    catch (e: any) { toast.error(e.message); }
  }

  if (!user) return <div className="p-6"><Card><CardContent className="p-8 text-center"><p className="text-muted-foreground">Sign in to run policy timeline checks.</p></CardContent></Card></div>;

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Payer Policy Time Machine</h1>
          <p className="text-sm text-muted-foreground">DOS-aware policy version reconciliation — flags retroactive application of newer, stricter medical policy.</p>
        </div>
      </div>

      {!active ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Run a Timeline Check</CardTitle><CardDescription>Compare the cited policy version against the version active on the Date of Service.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Policy ID (LCD/NCD/CP#)</Label><Input value={policyId} onChange={(e)=>setPolicyId(e.target.value)} placeholder="L34466" /></div>
                <div><Label>Policy Type</Label>
                  <select className="w-full h-10 px-3 rounded-md border bg-background" value={policyType} onChange={(e)=>setPolicyType(e.target.value)}>
                    <option value="commercial">Commercial</option><option value="LCD">LCD</option><option value="NCD">NCD</option><option value="MA">Medicare Advantage</option>
                  </select>
                </div>
                <div><Label>Payer</Label><Input value={payer} onChange={(e)=>setPayer(e.target.value)} placeholder="Aetna" /></div>
                <div><Label>Date of Service</Label><Input type="date" value={dos} onChange={(e)=>setDos(e.target.value)} /></div>
                <div><Label>Cited Policy Version</Label><Input value={citedVersion} onChange={(e)=>setCitedVersion(e.target.value)} placeholder="v8.0" /></div>
                <div><Label>Cited Effective Date</Label><Input type="date" value={citedDate} onChange={(e)=>setCitedDate(e.target.value)} /></div>
                <div><Label>Active-on-DOS Version (optional)</Label><Input value={activeVersion} onChange={(e)=>setActiveVersion(e.target.value)} placeholder="v6.2" /></div>
                <div><Label>Active-on-DOS Effective Date</Label><Input type="date" value={activeDate} onChange={(e)=>setActiveDate(e.target.value)} /></div>
              </div>
              <div><Label>Cited Policy Text (what payer applied)</Label><Textarea rows={6} value={citedText} onChange={(e)=>setCitedText(e.target.value)} placeholder="Paste the policy excerpt referenced in the denial letter…" /></div>
              <div><Label>Active-on-DOS Policy Text (optional)</Label><Textarea rows={6} value={activeText} onChange={(e)=>setActiveText(e.target.value)} placeholder="Paste the prior version that was in force on DOS, if available…" /></div>
              <Button onClick={handleRun} disabled={running} className="w-full">
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                {running ? "Reconciling timeline…" : "Run Timeline Check"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Checks</CardTitle><CardDescription>{checks.length} on record</CardDescription></CardHeader>
            <CardContent>
              {checks.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No checks yet.</p> :
              <div className="space-y-2">
                {checks.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded border bg-card hover:bg-accent/30 cursor-pointer" onClick={()=>setActive(c)}>
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {c.policy_id}
                        {c.mismatch ? <Badge variant={SEV_VARIANT[c.severity] as any}>mismatch · {c.severity}</Badge> : <Badge variant="outline">aligned</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.payer || "—"} · DOS {c.date_of_service} · {new Date(c.created_at).toLocaleString()}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e)=>{ e.stopPropagation(); handleDelete(c.id); }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={()=>setActive(null)}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
            <Button variant="destructive" size="sm" onClick={()=>handleDelete(active.id)}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {active.mismatch ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-primary" />}
                    {active.policy_id} · DOS {active.date_of_service}
                  </CardTitle>
                  <CardDescription>{active.payer || "Unknown payer"} · {active.policy_type}</CardDescription>
                </div>
                {active.mismatch ? <Badge variant={SEV_VARIANT[active.severity] as any}>Mismatch · {active.severity}</Badge> : <Badge variant="outline">Timeline Aligned</Badge>}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded border bg-muted/30">
                  <div className="font-medium mb-1">Cited (applied) version</div>
                  <div>{active.cited_policy_version || "—"}{active.cited_policy_date ? ` · eff ${active.cited_policy_date}` : ""}</div>
                </div>
                <div className="p-3 rounded border bg-muted/30">
                  <div className="font-medium mb-1">Active on DOS</div>
                  <div>{active.active_policy_version || "—"}{active.active_policy_date ? ` · eff ${active.active_policy_date}` : ""}</div>
                </div>
              </div>

              {active.diff_summary && (
                <div>
                  <div className="font-medium text-sm mb-1 flex items-center gap-2"><ScrollText className="h-4 w-4" /> Substantive Difference</div>
                  <p className="text-sm leading-relaxed">{active.diff_summary}</p>
                </div>
              )}

              {active.recommendation && (
                <div>
                  <div className="font-medium text-sm mb-1">Appeal Recommendation</div>
                  <p className="text-sm leading-relaxed border-l-2 border-primary pl-3">{active.recommendation}</p>
                </div>
              )}

              {Array.isArray(active.citations) && active.citations.length > 0 && (
                <div>
                  <div className="font-medium text-sm mb-1">Citations</div>
                  <ul className="text-sm space-y-1">
                    {active.citations.map((c: any, i: number) => (
                      <li key={i} className="text-muted-foreground">
                        <span className="font-medium text-foreground">{c.label || c.source}</span>{c.source ? ` · ${c.source}` : ""}{c.detail ? ` — ${c.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}