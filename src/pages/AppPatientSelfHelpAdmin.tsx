import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw } from 'lucide-react';

type Invite = { code: string; label: string | null; max_uses: number; uses_count: number; expires_at: string | null; is_active: boolean; created_at: string };
type Case = { id: string; case_title: string | null; scope: string | null; status: string; file_count: number; created_at: string; contact_email: string | null; invite_code: string | null };

function randomCode() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
  return `PSH-${s.slice(0, 4)}-${s.slice(4)}`;
}

export default function AppPatientSelfHelpAdmin() {
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [newCode, setNewCode] = useState(randomCode());
  const [newLabel, setNewLabel] = useState('');
  const [newMaxUses, setNewMaxUses] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: inv }, { data: cs }] = await Promise.all([
      supabase.from('patient_self_help_invites').select('*').order('created_at', { ascending: false }),
      supabase.from('patient_self_help_cases').select('id, case_title, scope, status, file_count, created_at, contact_email, invite_code').order('created_at', { ascending: false }).limit(100),
    ]);
    setInvites((inv as Invite[]) ?? []);
    setCases((cs as Case[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newCode.trim()) return;
    const { error } = await supabase.from('patient_self_help_invites').insert({
      code: newCode.trim(),
      label: newLabel.trim() || null,
      max_uses: Math.max(1, newMaxUses),
    });
    if (error) {
      toast({ title: 'Could not create code', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Invite created', description: newCode });
    setNewCode(randomCode()); setNewLabel(''); setNewMaxUses(1);
    load();
  };

  const toggleActive = async (code: string, isActive: boolean) => {
    const { error } = await supabase.from('patient_self_help_invites').update({ is_active: !isActive }).eq('code', code);
    if (error) toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    load();
  };

  const copyShareLink = (code: string) => {
    const url = `${window.location.origin}/patient-self-help?code=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Share link copied', description: url });
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Patient Self-Help</h1>
        <p className="text-sm text-muted-foreground">Invite codes and submitted cases for the public patient record review.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create invite code</CardTitle>
          <CardDescription>Share the code (or share link) with a patient/family. Codes work once by default.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label>Code</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} />
          </div>
          <div>
            <Label>Label (private)</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Smith family - 6/18" />
          </div>
          <div>
            <Label>Max uses</Label>
            <Input type="number" min={1} value={newMaxUses} onChange={(e) => setNewMaxUses(parseInt(e.target.value || '1'))} />
          </div>
          <div className="flex gap-2">
            <Button onClick={create}>Create</Button>
            <Button variant="outline" onClick={() => setNewCode(randomCode())}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Active invite codes</CardTitle></CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && invites.length === 0 && <p className="text-sm text-muted-foreground">No codes yet.</p>}
          <div className="space-y-2">
            {invites.map((i) => (
              <div key={i.code} className="flex flex-wrap items-center gap-3 border rounded px-3 py-2 text-sm">
                <span className="font-mono font-bold">{i.code}</span>
                {i.label && <span className="text-muted-foreground">{i.label}</span>}
                <Badge variant="outline">{i.uses_count}/{i.max_uses} used</Badge>
                <Badge variant={i.is_active ? 'default' : 'secondary'}>{i.is_active ? 'Active' : 'Disabled'}</Badge>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyShareLink(i.code)}><Copy className="h-3 w-3 mr-1" /> Share link</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(i.code, i.is_active)}>{i.is_active ? 'Disable' : 'Enable'}</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent self-help cases</CardTitle></CardHeader>
        <CardContent>
          {cases.length === 0 && <p className="text-sm text-muted-foreground">No cases submitted yet.</p>}
          <div className="space-y-2">
            {cases.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 border rounded px-3 py-2 text-sm">
                <span className="font-mono text-xs">{c.id.slice(0, 8)}</span>
                <span>{c.case_title || '(no title)'}</span>
                {c.scope && <Badge variant="outline">{c.scope}</Badge>}
                <Badge variant={c.status === 'complete' ? 'default' : c.status === 'error' ? 'destructive' : 'secondary'}>{c.status}</Badge>
                <span className="text-muted-foreground">{c.file_count} files</span>
                {c.contact_email && <span className="text-muted-foreground">{c.contact_email}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}